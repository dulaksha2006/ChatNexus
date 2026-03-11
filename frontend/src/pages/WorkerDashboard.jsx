import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  doc, onSnapshot as docSnap, orderBy
} from 'firebase/firestore';
import {
  Send, MessageSquare, Mic, Video, FileText,
  X, Loader2, Bell, Edit3, Save, User,
  Wifi, WifiOff, Clock, ChevronDown
} from 'lucide-react';
import Layout from '../components/Layout';
import { getDb } from '../firebase';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

/* ─── Audio notification ───────────────────────────────────────────────────── */
function playNotif() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

/* ─── Status badge config ──────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  free:    { label: 'Online',  color: 'bg-[#22b14c]', ring: 'border-emerald-500/40', text: 'text-[#2dcc5e]' },
  busy:    { label: 'Busy',    color: 'bg-[#d4a017]',   ring: 'border-amber-500/40',   text: 'text-[#f0ba1c]'   },
  offline: { label: 'Offline', color: 'bg-zinc-600',    ring: 'border-zinc-600/40',    text: 'text-[#a8b4b4]'    },
};

/* ─── Media message renderer ───────────────────────────────────────────────── */
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
  const ts = msg.timestamp?.toDate?.() || new Date();
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

/* ─── Greeting editor modal ────────────────────────────────────────────────── */
function GreetingPanel({ user, onClose }) {
  const [greeting, setGreeting] = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    const db = getDb();
    if (!db) { setLoading(false); return; }
    const unsub = onSnapshot(doc(db, 'users', user.id), snap => {
      if (snap.exists()) {
        setGreeting(snap.data().greeting || `Hi! My name is ${user.name}. How can I assist you today?`);
      }
      setLoading(false);
    });
    return unsub;
  }, [user.id, user.name]);

  async function save() {
    setSaving(true);
    try {
      await api.patch('/workers/me/greeting', { greeting });
      toast.success('Greeting saved!');
      onClose();
    } catch {
      toast.error('Failed to save greeting');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#252b2b] border border-[#3a4040] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[#ffffff] text-sm">Edit My Greeting</h3>
            <p className="text-[11px] text-[#6b7878] mt-0.5">Sent automatically when a customer connects to you.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7878] hover:text-[#ffffff] hover:bg-[#3a4040]">
            <X className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#4d9fe0]" /></div>
        ) : (
          <>
            <textarea
              className="w-full bg-[#2d3333] border border-[#3a4040] rounded-xl px-4 py-3 text-sm text-[#ffffff] placeholder-zinc-600 outline-none focus:border-brand-500/50 resize-none transition-colors"
              rows={4}
              value={greeting}
              onChange={e => setGreeting(e.target.value)}
              placeholder="Enter your greeting message…"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={onClose}
                className="flex-1 py-2 rounded-lg border border-[#3a4040] text-sm text-[#a8b4b4] hover:text-[#ffffff] hover:bg-[#3a4040] transition-all">
                Cancel
              </button>
              <button onClick={save} disabled={saving || !greeting.trim()}
                className="flex-1 py-2 rounded-lg bg-[#1474d4] hover:bg-[#1266be] text-[#ffffff] text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Save</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── New session notification banner ─────────────────────────────────────── */
function NewSessionBanner({ session, onDismiss, onOpen }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed top-5 right-5 z-50 animate-slide-up">
      <div className="bg-[#2d3333] border border-[#1474d4]/40 rounded-2xl p-4 shadow-2xl flex items-start gap-3 max-w-xs">
        <div className="w-8 h-8 rounded-full bg-[#1474d4]/20 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-[#4d9fe0]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#ffffff]">New Customer Connected!</p>
          <p className="text-[11px] text-[#a8b4b4] mt-0.5 truncate">
            {session.customerFirstName || `User ${String(session.customerTelegramId).slice(-4)}`}
            {session.customerUsername ? ` (@${session.customerUsername})` : ''}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button onClick={onOpen}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-[#1474d4] hover:bg-[#1266be] text-[#ffffff] font-medium transition-all">
            Open
          </button>
          <button onClick={onDismiss}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-[#3a4040] text-[#6b7878] hover:text-[#ffffff] transition-all">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Status toggle dropdown ───────────────────────────────────────────────── */
function StatusToggle({ currentStatus, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.free;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
          cfg.ring, cfg.text, 'bg-[#323838] hover:bg-[#3a4040]'
        )}
      >
        {loading
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <span className={clsx('w-2 h-2 rounded-full', cfg.color)} />}
        {cfg.label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[#2d3333] border border-[#3a4040] rounded-xl shadow-2xl overflow-hidden z-20 min-w-[130px]">
          {Object.entries(STATUS_CONFIG).map(([key, s]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className={clsx(
                'flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors hover:bg-[#3a4040]',
                currentStatus === key ? s.text + ' font-semibold' : 'text-[#a8b4b4]'
              )}
            >
              <span className={clsx('w-2 h-2 rounded-full', s.color)} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Quick replies panel ──────────────────────────────────────────────────── */
function QuickReplies({ onSelect }) {
  const [replies, setReplies] = useState([]);

  useEffect(() => {
    api.get('/settings/quick-replies')
      .then(r => setReplies(r.data || []))
      .catch(() => {});
  }, []);

  if (!replies.length) return null;
  return (
    <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
      {replies.map((r, i) => (
        <button
          key={i}
          onClick={() => onSelect(r.text)}
          className="text-[10px] px-2.5 py-1 rounded-lg bg-[#323838] border border-[#3a4040] text-[#a8b4b4] hover:text-[#ffffff] hover:bg-zinc-700 transition-all truncate max-w-[160px]"
          title={r.text}
        >
          {r.label || r.text}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function WorkerDashboard() {
  const { user, setUser } = useAuth();
  const [sessions, setSessions]           = useState([]);
  const [activeId, setActiveId]           = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState('');
  const [sending, setSending]             = useState(false);
  const [closing, setClosing]             = useState(false);
  const [showGreeting, setShowGreeting]   = useState(false);
  const [newSessionBanner, setNewSessionBanner] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [dbReady, setDbReady]             = useState(false);

  const prevSessionIdsRef = useRef(null);
  const bottomRef         = useRef(null);
  const activeSession     = sessions.find(s => s.id === activeId);

  // ── Wait for Firestore db to be available ────────────────────────────────
  useEffect(() => {
    let attempts = 0;
    const check = () => {
      if (getDb()) { setDbReady(true); return; }
      if (++attempts < 20) setTimeout(check, 200);
    };
    check();
  }, []);

  // ── Listen to MY active sessions in real-time ────────────────────────────
  useEffect(() => {
    if (!dbReady) return;
    const db = getDb();
    if (!db) return;

    // ✅ FIX: Do NOT combine where() + orderBy() on different fields without a
    //    composite Firestore index. Sort in JS instead to avoid index errors
    //    on fresh deployments.
    const q = query(
      collection(db, 'sessions'),
      where('workerId', '==', user.id),
      where('status',   '==', 'active')
    );

    const unsub = onSnapshot(q, snap => {
      const active = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      setSessions(active);

      // Show banner for genuinely new sessions
      if (prevSessionIdsRef.current !== null) {
        const prevIds = prevSessionIdsRef.current;
        const newOnes = active.filter(s => !prevIds.includes(s.id));
        if (newOnes.length > 0) {
          const newest = newOnes[0];
          playNotif();
          setNewSessionBanner(newest);
          setActiveId(prev => prev || newest.id);
        }
      }
      prevSessionIdsRef.current = active.map(s => s.id);

      // Keep activeId valid; fall back to first session
      setActiveId(prev => {
        if (prev && active.find(s => s.id === prev)) return prev;
        return active.length > 0 ? active[0].id : null;
      });
    }, err => console.error('sessions listener:', err.message));

    return unsub;
  }, [user.id, dbReady]);

  // ── Listen to messages for the active session ────────────────────────────
  useEffect(() => {
    if (!activeId || !dbReady) { setMessages([]); return; }
    const db = getDb();
    if (!db) return;

    // ✅ FIX: Use orderBy('timestamp') on the messages subcollection.
    //    This is safe because messages only have one field to sort by.
    const q = query(
      collection(db, 'sessions', activeId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(list);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }, err => console.error('messages listener:', err.message));

    return unsub;
  }, [activeId, dbReady]);

  // ── Send message ─────────────────────────────────────────────────────────
  async function send() {
    if (!input.trim() || !activeId || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await api.post(`/sessions/${activeId}/message`, { content: text });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send';
      toast.error(msg);
      setInput(text); // restore on failure
    } finally {
      setSending(false);
    }
  }

  // ── Close session ────────────────────────────────────────────────────────
  async function closeSession() {
    if (!activeId || closing) return;
    setClosing(true);
    try {
      await api.post(`/sessions/${activeId}/close`);
      setActiveId(null);
      toast.success('Session closed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to close session');
    } finally {
      setClosing(false);
    }
  }

  // ── Change worker status ─────────────────────────────────────────────────
  async function changeStatus(newStatus) {
    setStatusLoading(true);
    try {
      await api.patch('/workers/me/status', { status: newStatus });
      setUser(prev => ({ ...prev, status: newStatus }));
      toast.success(`Status: ${STATUS_CONFIG[newStatus]?.label}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout title="Dashboard">
      {showGreeting && <GreetingPanel user={user} onClose={() => setShowGreeting(false)} />}

      {newSessionBanner && (
        <NewSessionBanner
          session={newSessionBanner}
          onDismiss={() => setNewSessionBanner(null)}
          onOpen={() => { setActiveId(newSessionBanner.id); setNewSessionBanner(null); }}
        />
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[#6b7878]">
          {!dbReady
            ? 'Connecting to real-time database…'
            : sessions.length > 0
              ? `${sessions.length} active session${sessions.length > 1 ? 's' : ''}`
              : 'No active sessions'}
        </p>
        <StatusToggle
          currentStatus={user?.status || 'free'}
          onChange={changeStatus}
          loading={statusLoading}
        />
      </div>

      <div className="flex gap-4 h-[calc(100vh-9rem)]">

        {/* ── Session list ─────────────────────────────────────────────── */}
        <div className="w-60 shrink-0 flex flex-col bg-[#252b2b] border border-[#3a4040] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#3a4040] flex items-center justify-between">
            <p className="text-[11px] font-semibold text-[#6b7878] uppercase tracking-wider">Active Sessions</p>
            <div className="flex items-center gap-2">
              {sessions.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#1474d4]/20 text-[#4d9fe0] text-[10px] font-bold flex items-center justify-center">
                  {sessions.length}
                </span>
              )}
              <button
                onClick={() => setShowGreeting(true)}
                title="Edit my greeting"
                className="p-1 rounded-lg text-[#6b7878] hover:text-[#4d9fe0] hover:bg-[#1474d4]/10 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!dbReady ? (
              <div className="flex flex-col items-center justify-center h-full pb-8">
                <Loader2 className="w-5 h-5 text-[#4d9fe0] animate-spin mb-2" />
                <p className="text-xs text-[#6b7878]">Connecting…</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full pb-8 text-center px-4">
                <MessageSquare className="w-7 h-7 text-zinc-800 mb-2" />
                <p className="text-xs text-[#6b7878]">No active sessions</p>
                <p className="text-[10px] text-[#4a5252] mt-1">
                  {user?.status === 'free'
                    ? 'Waiting for customers…'
                    : 'Set status to Online to receive chats'}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {sessions.map(s => (
                  <button key={s.id} onClick={() => setActiveId(s.id)}
                    className={clsx(
                      'w-full text-left px-3 py-2.5 rounded-lg transition-all border',
                      activeId === s.id
                        ? 'bg-[#1474d4]/10 border-[#1474d4]/25'
                        : 'hover:bg-[#3a4040] border-transparent'
                    )}>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22b14c] shrink-0 animate-pulse" />
                      <p className="text-xs font-medium text-[#ffffff] truncate">
                        {s.customerFirstName || `User ${String(s.customerTelegramId).slice(-4)}`}
                      </p>
                    </div>
                    {s.customerUsername && (
                      <p className="text-[10px] text-[#6b7878] mt-0.5 ml-3.5 truncate">@{s.customerUsername}</p>
                    )}
                    <p className="text-[10px] text-[#4a5252] mt-0.5 ml-3.5">
                      {s.createdAt?.toDate
                        ? formatDistanceToNow(s.createdAt.toDate(), { addSuffix: true })
                        : 'just now'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Chat area ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-[#252b2b] border border-[#3a4040] rounded-xl overflow-hidden min-w-0">
          {!activeSession ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-[#2d3333] border border-[#3a4040] flex items-center justify-center mb-4">
                <MessageSquare className="w-7 h-7 text-[#4a5252]" />
              </div>
              <p className="text-sm font-medium text-[#a8b4b4]">No session selected</p>
              <p className="text-xs text-[#6b7878] mt-1">
                {sessions.length > 0
                  ? 'Pick a session from the left'
                  : user?.status !== 'free'
                    ? 'Set your status to Online to receive chats'
                    : 'Waiting for customers to connect…'}
              </p>
              <button
                onClick={() => setShowGreeting(true)}
                className="mt-5 flex items-center gap-2 text-xs text-[#6b7878] hover:text-[#4d9fe0] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#1474d4]/10"
              >
                <Edit3 className="w-3 h-3" /> Edit my greeting message
              </button>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#3a4040] shrink-0 bg-[#2d3333]/40">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#323838] border border-[#3a4040] flex items-center justify-center text-sm font-bold text-[#ffffff] shrink-0">
                    {(activeSession.customerFirstName || 'C')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#ffffff] leading-tight">
                      {activeSession.customerFirstName || 'Customer'}
                      {activeSession.customerUsername &&
                        <span className="text-[#6b7878] font-normal text-xs ml-1.5">
                          @{activeSession.customerUsername}
                        </span>}
                    </p>
                    <p className="text-[10px] text-[#6b7878]">
                      ID: {activeSession.customerTelegramId}
                      {activeSession.language && ` · ${activeSession.language.toUpperCase()}`}
                    </p>
                  </div>
                </div>
                <button onClick={closeSession} disabled={closing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#e05050] bg-[#e05050]/10 hover:bg-[#e05050]/20 border border-[#e05050]/30 transition-all disabled:opacity-50">
                  {closing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  End Session
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-xs text-[#4a5252] text-center pt-4">Session started. Say hello!</p>
                )}
                {messages.map(msg => (
                  <Bubble
                    key={msg.id || String(msg.timestamp?.toMillis?.() || Math.random())}
                    msg={msg}
                    isOwn={msg.from === 'worker'}
                  />
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Quick replies */}
              <QuickReplies onSelect={text => setInput(text)} />

              {/* Input bar */}
              <div className="px-4 py-3 border-t border-[#3a4040] shrink-0">
                <div className="flex items-center gap-2 bg-[#2d3333] rounded-xl border border-[#3a4040] px-3 py-2 focus-within:border-[#1474d4]/40 transition-colors">
                  <input
                    className="flex-1 bg-transparent text-sm text-[#ffffff] placeholder-zinc-600 outline-none"
                    placeholder="Type a message and press Enter…"
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
              </div>
            </>
          )}
        </div>

      </div>
    </Layout>
  );
}
