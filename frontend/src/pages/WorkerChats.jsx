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
          className="max-w-[220px] rounded-lg border border-[#3a4040] hover:opacity-90 transition-opacity"
        />
        {msg.content && <p className="text-xs text-[#a8b4b4] mt-1 italic">{msg.content}</p>}
      </a>
    );
  if (msg.type === 'voice')
    return (
      <div className="flex items-center gap-2 bg-[#323838] rounded-lg px-3 py-2">
        <Mic className="w-4 h-4 text-[#4d9fe0] shrink-0" />
        {msg.fileUrl
          ? <audio src={msg.fileUrl} controls className="h-7 max-w-[180px]" />
          : <span className="text-xs text-[#a8b4b4]">Voice message</span>}
        {msg.duration && <span className="text-xs text-[#a8b4b4]">{msg.duration}s</span>}
      </div>
    );
  if (msg.type === 'video')
    return (
      <div className="flex items-center gap-2 bg-[#323838] rounded-lg px-3 py-2">
        <Video className="w-4 h-4 text-[#f0ba1c] shrink-0" />
        <span className="text-xs text-[#d0d8d8]">Video message</span>
      </div>
    );
  if (msg.type === 'document')
    return (
      <a href={msg.fileUrl} target="_blank" rel="noreferrer"
        className="flex items-center gap-2 bg-[#323838] hover:bg-[#3a4040] rounded-lg px-3 py-2 transition-colors">
        <FileText className="w-4 h-4 text-[#a8b4b4] shrink-0" />
        <span className="text-xs text-[#d0d8d8] truncate max-w-[160px]">{msg.fileName || 'Document'}</span>
      </a>
    );
  return <p className="text-sm text-[#ffffff]/90 break-words whitespace-pre-wrap">{msg.content}</p>;
}

/* ─── Chat bubble ──────────────────────────────────────────────────────────── */
function Bubble({ msg, isOwn }) {
  const ts = msg.timestamp?.toDate?.() || (msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000) : new Date());
  return (
    <div className={clsx('flex gap-2 max-w-[78%] group', isOwn ? 'ml-auto flex-row-reverse' : '')}>
      <div className={clsx(
        'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-1',
        isOwn ? 'bg-[#1474d4] text-[#ffffff]' : 'bg-[#323838] border border-[#3a4040] text-[#ffffff]'
      )}>
        {(msg.senderName || '?')[0].toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className={clsx(
          'rounded-2xl px-3.5 py-2.5',
          isOwn
            ? 'bg-[#1474d4]/20 border border-brand-500/25 rounded-tr-sm'
            : 'bg-[#2d3333] border border-[#3a4040] rounded-tl-sm'
        )}>
          <MediaMessage msg={msg} />
        </div>
        <p className={clsx('text-[10px] text-[#6b7878] mt-0.5', isOwn ? 'text-right' : '')}>
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
          ? 'bg-[#1474d4]/10 border-[#1474d4]/25'
          : 'hover:bg-[#3a4040] border-transparent'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#323838] border border-[#3a4040] flex items-center justify-center text-xs font-bold text-[#ffffff] shrink-0">
          {displayName[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-semibold text-[#ffffff] truncate">{displayName}</p>
            {ts && (
              <span className="text-[10px] text-[#6b7878] shrink-0">
                {formatDistanceToNow(ts, { addSuffix: false })}
              </span>
            )}
          </div>
          {chat.customerUsername && (
            <p className="text-[10px] text-[#6b7878] truncate">@{chat.customerUsername}</p>
          )}
          {lastMsg && (
            <p className="text-[10px] text-[#6b7878] truncate mt-0.5">
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
          'w-72 shrink-0 flex flex-col bg-[#252b2b] border border-[#3a4040] rounded-xl overflow-hidden',
          mobileShowChat ? 'hidden lg:flex' : 'flex'
        )}>
          <div className="px-4 py-3 border-b border-[#3a4040]">
            <p className="text-[11px] font-semibold text-[#6b7878] uppercase tracking-wider">Active Chats</p>
            {!loading && (
              <p className="text-[10px] text-[#4a5252] mt-0.5">
                {chatSessions.length} conversation{chatSessions.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!dbReady || loading ? (
              <div className="flex flex-col items-center justify-center h-full pb-8">
                <Loader2 className="w-5 h-5 text-[#4d9fe0] animate-spin mb-2" />
                <p className="text-xs text-[#6b7878]">Loading chats…</p>
              </div>
            ) : chatSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full pb-8 text-center px-4">
                <MessageSquare className="w-7 h-7 text-zinc-800 mb-2" />
                <p className="text-xs text-[#6b7878]">No active chats</p>
                <p className="text-[10px] text-[#4a5252] mt-1">Customer messages will appear here</p>
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
          'flex-1 flex flex-col bg-[#252b2b] border border-[#3a4040] rounded-xl overflow-hidden min-w-0',
          !mobileShowChat && activeSessionId === null ? 'hidden lg:flex' : 'flex'
        )}>
          {!activeChat ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-[#2d3333] border border-[#3a4040] flex items-center justify-center mb-4">
                <MessageSquare className="w-7 h-7 text-[#4a5252]" />
              </div>
              <p className="text-sm font-medium text-[#a8b4b4]">No chat selected</p>
              <p className="text-xs text-[#6b7878] mt-1">
                {chatSessions.length > 0
                  ? 'Pick a conversation from the left'
                  : 'Waiting for customer messages…'}
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#3a4040] shrink-0 bg-[#2d3333]/40">
                <div className="flex items-center gap-3">
                  {/* Mobile back button */}
                  <button
                    className="lg:hidden p-1 rounded-lg text-[#6b7878] hover:text-[#ffffff]"
                    onClick={() => { setMobileShowChat(false); setActiveSessionId(null); }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-[#323838] border border-[#3a4040] flex items-center justify-center text-sm font-bold text-[#ffffff] shrink-0">
                    {displayName[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#ffffff] leading-tight">
                      {displayName}
                      {activeChat.customerUsername && (
                        <span className="text-[#6b7878] font-normal text-xs ml-1.5">
                          @{activeChat.customerUsername}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[#6b7878]">
                      ID: {activeChat.customerTelegramId}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeChat}
                  disabled={closing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e05050] bg-[#e05050]/10 hover:bg-[#e05050]/20 border border-[#e05050]/30 transition-all disabled:opacity-50"
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
                  <p className="text-xs text-[#4a5252] text-center pt-4">No messages yet.</p>
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
              <div className="px-4 py-3 border-t border-[#3a4040] shrink-0">
                <div className="flex items-center gap-2 bg-[#2d3333] rounded-xl border border-[#3a4040] px-3 py-2 focus-within:border-[#1474d4]/40 transition-colors">
                  <input
                    className="flex-1 bg-transparent text-sm text-[#ffffff] placeholder-zinc-600 outline-none"
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
                    className="w-7 h-7 rounded-lg bg-[#1474d4] hover:bg-[#1266be] disabled:opacity-30 flex items-center justify-center transition-all active:scale-90 shrink-0"
                  >
                    {sending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ffffff]" />
                      : <Send className="w-3.5 h-3.5 text-[#ffffff]" />}
                  </button>
                </div>
                <p className="text-[10px] text-[#4a5252] mt-1.5 px-1">
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
