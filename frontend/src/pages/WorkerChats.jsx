import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, where, onSnapshot, orderBy
} from 'firebase/firestore';
import {
  Send, MessageSquare, Mic, Video, FileText,
  X, Loader2, User, ChevronLeft, FileDown
} from 'lucide-react';
import Layout from '../components/Layout';
import { getDb } from '../firebase';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

/* ─── Media message renderer ──────────────────────────────────────────────── */
function MediaMessage({ msg }) {
  if (msg.type === 'image' && msg.fileUrl)
    return (
      <a href={msg.fileUrl} target="_blank" rel="noreferrer">
        <img
          src={msg.fileUrl} alt=""
          className="max-w-[220px] rounded-lg border border-white/10 hover:opacity-90 transition-opacity"
        />
        {msg.content && <p className="text-xs text-zinc-400 mt-1 italic">{msg.content}</p>}
      </a>
    );
  if (msg.type === 'voice')
    return (
      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
        <Mic className="w-4 h-4 text-brand-400 shrink-0" />
        {msg.fileUrl
          ? <audio src={msg.fileUrl} controls className="h-7 max-w-[180px]" />
          : <span className="text-xs text-zinc-400">Voice message</span>}
        {msg.duration && <span className="text-xs text-zinc-400">{msg.duration}s</span>}
      </div>
    );
  if (msg.type === 'video')
    return (
      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
        <Video className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-xs text-zinc-300">Video message</span>
      </div>
    );
  if (msg.type === 'document')
    return (
      <a href={msg.fileUrl} target="_blank" rel="noreferrer"
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors">
        <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
        <span className="text-xs text-zinc-300 truncate max-w-[160px]">{msg.fileName || 'Document'}</span>
      </a>
    );
  return <p className="text-sm text-white/90 break-words whitespace-pre-wrap">{msg.content}</p>;
}

/* ─── Chat bubble ──────────────────────────────────────────────────────────── */
function Bubble({ msg, isOwn }) {
  const ts = msg.timestamp?.toDate?.() || (msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000) : new Date());
  return (
    <div className={clsx('flex gap-2 max-w-[78%] group', isOwn ? 'ml-auto flex-row-reverse' : '')}>
      <div className={clsx(
        'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1',
        isOwn ? 'bg-brand-500 text-white' : 'bg-zinc-800 border border-white/10 text-white'
      )}>
        {(msg.senderName || '?')[0].toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className={clsx(
          'rounded-2xl px-3.5 py-2.5',
          isOwn
            ? 'bg-brand-500/20 border border-brand-500/25 rounded-tr-sm'
            : 'bg-zinc-900 border border-white/5 rounded-tl-sm'
        )}>
          <MediaMessage msg={msg} />
        </div>
        <p className={clsx('text-[10px] text-zinc-600 mt-0.5', isOwn ? 'text-right' : '')}>
          {format(ts, 'HH:mm')}
        </p>
      </div>
    </div>
  );
}

/* ─── Chat session list item ──────────────────────────────────────────────── */
function ChatListItem({ chat, isActive, onClick }) {
  const lastMsg = chat.lastMessage;
  const ts = lastMsg?.timestamp?.seconds
    ? new Date(lastMsg.timestamp.seconds * 1000)
    : null;
  const displayName = chat.customerFirstName || chat.customerUsername || `User ${String(chat.customerTelegramId).slice(-4)}`;

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-3 py-3 rounded-xl transition-all border',
        isActive
          ? 'bg-brand-500/10 border-brand-500/20'
          : 'hover:bg-white/5 border-transparent'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {displayName[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-semibold text-white truncate">{displayName}</p>
            {ts && (
              <span className="text-[10px] text-zinc-600 shrink-0">
                {formatDistanceToNow(ts, { addSuffix: false })}
              </span>
            )}
          </div>
          {chat.customerUsername && (
            <p className="text-[10px] text-zinc-500 truncate">@{chat.customerUsername}</p>
          )}
          {lastMsg && (
            <p className="text-[10px] text-zinc-600 truncate mt-0.5">
              {lastMsg.from === 'worker' ? '↑ ' : ''}{lastMsg.content || `[${lastMsg.type}]`}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function WorkerChats() {
  const { user } = useAuth();
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const bottomRef = useRef(null);

  const activeChat = chatSessions.find(c => c.sessionId === activeSessionId);

  // ── Wait for Firestore ─────────────────────────────────────────────────
  useEffect(() => {
    let attempts = 0;
    const check = () => {
      if (getDb()) { setDbReady(true); return; }
      if (++attempts < 20) setTimeout(check, 200);
    };
    check();
  }, []);

  // ── Real-time listener on chats collection ─────────────────────────────
  useEffect(() => {
    if (!dbReady) return;
    const db = getDb();
    if (!db) return;

    const q = query(
      collection(db, 'chats'),
      where('workerId', '==', user.id)
    );

    const unsub = onSnapshot(q, snap => {
      const allMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Group by sessionId
      const map = {};
      for (const msg of allMsgs) {
        const sid = msg.sessionId;
        if (!map[sid]) {
          map[sid] = {
            sessionId: sid,
            workerId: msg.workerId,
            customerTelegramId: msg.customerTelegramId,
            customerUsername: msg.customerUsername || '',
            customerFirstName: msg.customerFirstName || '',
            messages: [],
            lastMessage: null,
            lastTimestamp: 0,
          };
        }
        map[sid].messages.push(msg);
        const ts = msg.timestamp?.seconds || 0;
        if (ts > map[sid].lastTimestamp) {
          map[sid].lastTimestamp = ts;
          map[sid].lastMessage = msg;
        }
      }

      // Sort messages within session
      for (const sid in map) {
        map[sid].messages.sort(
          (a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)
        );
      }

      const sessions = Object.values(map).sort(
        (a, b) => b.lastTimestamp - a.lastTimestamp
      );

      setChatSessions(sessions);
      setLoading(false);
    }, err => {
      console.error('chats listener:', err.message);
      setLoading(false);
    });

    return unsub;
  }, [user.id, dbReady]);

  // ── Update messages when active session changes ───────────────────────
  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    const chat = chatSessions.find(c => c.sessionId === activeSessionId);
    setMessages(chat?.messages || []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [activeSessionId, chatSessions]);

  function openChat(sessionId) {
    setActiveSessionId(sessionId);
    setMobileShowChat(true);
  }

  // ── Send reply ────────────────────────────────────────────────────────
  async function send() {
    if (!input.trim() || !activeSessionId || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await api.post(`/chats/${activeSessionId}/reply`, { content: text });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  // ── Close chat (PDF + delete) ─────────────────────────────────────────
  async function closeChat() {
    if (!activeSessionId || closing) return;
    setClosing(true);
    try {
      await api.post(`/chats/${activeSessionId}/close`);
      setActiveSessionId(null);
      setMobileShowChat(false);
      toast.success('Chat closed — PDF sent to Telegram');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to close chat');
    } finally {
      setClosing(false);
    }
  }

  const displayName = activeChat
    ? (activeChat.customerFirstName || activeChat.customerUsername || `User ${String(activeChat.customerTelegramId).slice(-4)}`)
    : '';

  // ─────────────────────────────────────────────────────────────────────
  return (
    <Layout title="Chats">
      <div className="flex gap-4 h-[calc(100vh-9rem)]">

        {/* ── Chat list ──────────────────────────────────────────────────── */}
        <div className={clsx(
          'w-72 shrink-0 flex flex-col bg-zinc-950 border border-white/5 rounded-xl overflow-hidden',
          mobileShowChat ? 'hidden lg:flex' : 'flex'
        )}>
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Active Chats</p>
            {!loading && (
              <p className="text-[10px] text-zinc-700 mt-0.5">
                {chatSessions.length} conversation{chatSessions.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!dbReady || loading ? (
              <div className="flex flex-col items-center justify-center h-full pb-8">
                <Loader2 className="w-5 h-5 text-brand-400 animate-spin mb-2" />
                <p className="text-xs text-zinc-600">Loading chats…</p>
              </div>
            ) : chatSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full pb-8 text-center px-4">
                <MessageSquare className="w-7 h-7 text-zinc-800 mb-2" />
                <p className="text-xs text-zinc-600">No active chats</p>
                <p className="text-[10px] text-zinc-700 mt-1">Customer messages will appear here</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {chatSessions.map(chat => (
                  <ChatListItem
                    key={chat.sessionId}
                    chat={chat}
                    isActive={activeSessionId === chat.sessionId}
                    onClick={() => openChat(chat.sessionId)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Chat area ──────────────────────────────────────────────────── */}
        <div className={clsx(
          'flex-1 flex flex-col bg-zinc-950 border border-white/5 rounded-xl overflow-hidden min-w-0',
          !mobileShowChat && activeSessionId === null ? 'hidden lg:flex' : 'flex'
        )}>
          {!activeChat ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-4">
                <MessageSquare className="w-7 h-7 text-zinc-700" />
              </div>
              <p className="text-sm font-medium text-zinc-400">No chat selected</p>
              <p className="text-xs text-zinc-600 mt-1">
                {chatSessions.length > 0
                  ? 'Pick a conversation from the left'
                  : 'Waiting for customer messages…'}
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0 bg-zinc-900/40">
                <div className="flex items-center gap-3">
                  {/* Mobile back button */}
                  <button
                    className="lg:hidden p-1 rounded-lg text-zinc-500 hover:text-white"
                    onClick={() => { setMobileShowChat(false); setActiveSessionId(null); }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {displayName[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">
                      {displayName}
                      {activeChat.customerUsername && (
                        <span className="text-zinc-500 font-normal text-xs ml-1.5">
                          @{activeChat.customerUsername}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      ID: {activeChat.customerTelegramId}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeChat}
                  disabled={closing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all disabled:opacity-50"
                  title="Close chat — sends PDF transcript to Telegram"
                >
                  {closing
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <FileDown className="w-3 h-3" />}
                  Close & Send PDF
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-xs text-zinc-700 text-center pt-4">No messages yet.</p>
                )}
                {messages.map(msg => (
                  <Bubble
                    key={msg.id || String(msg.timestamp?.seconds || Math.random())}
                    msg={msg}
                    isOwn={msg.from === 'worker'}
                  />
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input bar */}
              <div className="px-4 py-3 border-t border-white/5 shrink-0">
                <div className="flex items-center gap-2 bg-zinc-900 rounded-xl border border-white/10 px-3 py-2 focus-within:border-brand-500/40 transition-colors">
                  <input
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
                    placeholder="Type a reply and press Enter…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                  />
                  <button
                    onClick={send}
                    disabled={sending || !input.trim()}
                    className="w-7 h-7 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-30 flex items-center justify-center transition-all active:scale-90 shrink-0"
                  >
                    {sending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      : <Send className="w-3.5 h-3.5 text-white" />}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-700 mt-1.5 px-1">
                  Replies are sent directly to the customer via Telegram bot
                </p>
              </div>
            </>
          )}
        </div>

      </div>
    </Layout>
  );
}
