import { useState, useEffect } from 'react';
import { Bell, X, Check, CheckCheck, Loader2 } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getDb } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { format } from 'date-fns';
import clsx from 'clsx';

export default function NotificationPanel() {
  const { user } = useAuth();
  const [open, setOpen]       = useState(false);
  const [notifs, setNotifs]   = useState([]);
  const [marking, setMarking] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const check = () => { if (getDb()) { setDbReady(true); return; } if (++attempts < 20) setTimeout(check, 200); };
    check();
  }, []);

  useEffect(() => {
    if (!dbReady || user?.role !== 'worker') return;
    const db = getDb();
    if (!db) return;
    const q = query(
      collection(db, 'notifications'),
      where('workerId', '==', user.id),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [dbReady, user]);

  const unread = notifs.filter(n => !n.read).length;

  async function markAllRead() {
    setMarking(true);
    try { await api.patch('/notifications/read-all'); }
    catch { }
    finally { setMarking(false); }
  }

  async function markOne(id) {
    try { await api.patch(`/notifications/${id}/read`); }
    catch { }
  }

  if (user?.role !== 'worker') return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="relative p-1.5 rounded-md text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-all">
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#da3633] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-80 bg-[#161b22] border border-[#30363d] rounded-md shadow-overlay animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#21262d]">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-[#58a6ff]" />
                <span className="text-sm font-medium text-[#e6edf3]">Notifications</span>
                {unread > 0 && (
                  <span className="text-[10px] bg-[#da3633]/20 text-[#f85149] border border-[#da3633]/30 rounded-full px-1.5 py-0.5 font-medium">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button onClick={markAllRead} disabled={marking}
                    className="text-xs text-[#58a6ff] hover:underline flex items-center gap-1 px-2 py-1">
                    {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  className="p-1 rounded-md text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-[#21262d]">
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center px-4">
                  <Bell className="w-6 h-6 text-[#30363d] mb-2" />
                  <p className="text-xs text-[#6e7681]">No notifications yet</p>
                </div>
              ) : notifs.map(n => {
                const ts = n.createdAt?.toDate?.() || new Date();
                return (
                  <div key={n.id}
                    className={clsx(
                      'px-4 py-3 transition-colors',
                      !n.read ? 'bg-[#1f6feb]/5 hover:bg-[#1f6feb]/10' : 'hover:bg-[#21262d]'
                    )}>
                    <div className="flex items-start gap-2.5">
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] mt-1.5 shrink-0" />}
                      {n.read && <span className="w-1.5 h-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-medium text-[#8b949e]">{n.sentByName || 'Admin'}</span>
                          <span className="text-[10px] text-[#6e7681]">· {format(ts, 'MMM d, HH:mm')}</span>
                        </div>
                        <p className="text-sm text-[#e6edf3] whitespace-pre-wrap break-words">{n.message}</p>
                      </div>
                      {!n.read && (
                        <button onClick={() => markOne(n.id)}
                          className="shrink-0 p-1 rounded-md text-[#6e7681] hover:text-[#3fb950] hover:bg-[#238636]/10 transition-all mt-0.5">
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
