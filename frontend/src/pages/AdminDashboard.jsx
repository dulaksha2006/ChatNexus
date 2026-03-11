import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { MessageSquare, Users, Clock, Activity, TrendingUp, CheckCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { getDb } from '../firebase';
import api from '../api';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colors = {
    brand:  'from-brand-500/15  to-brand-600/5  border-[#1474d4]/25  text-[#4d9fe0]',
    green:  'from-accent-500/15 to-accent-600/5 border-accent-500/20 text-accent-400',
    amber:  'from-amber-500/15  to-amber-600/5  border-[#d4a017]/30  text-[#f0ba1c]',
    purple: 'from-purple-500/15 to-purple-600/5 border-purple-500/20 text-purple-400',
  };
  return (
    <div className={`card p-5 bg-gradient-to-br ${colors[color]} animate-fade-in`}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-lg bg-[#323838]">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-display font-bold text-[#ffffff] mb-0.5">{value ?? '—'}</p>
      <p className="text-xs font-medium text-slate-300">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function SessionRow({ session }) {
  const ts = session.createdAt?.toDate?.() || new Date();
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[#3a4040] last:border-0 group hover:bg-[#3a4040] px-2 -mx-2 rounded-lg transition-colors">
      <div className="w-2 h-2 rounded-full bg-[#22b14c] animate-pulse shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#ffffff] font-medium truncate">
          Customer #{String(session.customerTelegramId).slice(-6)}
        </p>
        <p className="text-xs text-slate-500">{session.workerName || 'Unassigned'}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-slate-400">{formatDistanceToNow(ts, { addSuffix: true })}</p>
        <span className={clsx(
          'text-xs px-2 py-0.5 rounded-full border',
          session.status === 'active'
            ? 'border-emerald-500/30 text-[#2dcc5e] bg-[#22b14c]/10'
            : 'border-zinc-700 text-[#6b7878] bg-[#2d3333]'
        )}>
          {session.status}
        </span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats]       = useState(null);
  const [sessions, setSessions] = useState([]);
  const [workers, setWorkers]   = useState([]);
  const [dbReady, setDbReady]   = useState(false);

  // Wait for Firestore db
  useEffect(() => {
    let attempts = 0;
    const check = () => {
      if (getDb()) { setDbReady(true); return; }
      if (++attempts < 20) setTimeout(check, 200);
    };
    check();
  }, []);

  // Fetch stats via API
  useEffect(() => {
    api.get('/sessions/stats/overview')
      .then(r => setStats(r.data))
      .catch(console.error);
  }, []);

  // Real-time active sessions (no orderBy to avoid composite index requirement)
  useEffect(() => {
    if (!dbReady) return;
    const db = getDb();
    if (!db) return;
    const q = query(
      collection(db, 'sessions'),
      where('status', '==', 'active'),
      limit(20)
    );
    return onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, 10);
      setSessions(list);
      // Refresh stats counters
      api.get('/sessions/stats/overview').then(r => setStats(r.data)).catch(() => {});
    });
  }, [dbReady]);

  // Real-time workers
  useEffect(() => {
    if (!dbReady) return;
    const db = getDb();
    if (!db) return;
    const q = query(collection(db, 'users'), where('role', '==', 'worker'));
    return onSnapshot(q, snap => {
      setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [dbReady]);

  const freeWorkers   = workers.filter(w => w.status === 'free'   && w.active).length;
  const busyWorkers   = workers.filter(w => w.status === 'busy'   && w.active).length;
  const offlineWorkers = workers.filter(w => (w.status === 'offline' || !w.status) && w.active).length;

  return (
    <Layout title="Dashboard">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Activity}     label="Active Sessions"  value={stats?.activeSessions ?? sessions.length} color="brand" />
        <StatCard icon={CheckCircle}  label="Closed Sessions"  value={stats?.closedSessions} color="green" />
        <StatCard icon={Users}        label="Online Workers"   value={freeWorkers} sub={`${busyWorkers} busy`} color="amber" />
        <StatCard icon={TrendingUp}   label="Total Workers"    value={stats?.totalWorkers ?? workers.length} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active sessions */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[#ffffff] mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#4d9fe0]" />
            Active Sessions
          </h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-[#6b7878] py-4 text-center">No active sessions</p>
          ) : (
            sessions.map(s => <SessionRow key={s.id} session={s} />)
          )}
        </div>

        {/* Worker status */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[#ffffff] mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#4d9fe0]" />
            Worker Status
          </h3>
          {workers.filter(w => w.active).length === 0 ? (
            <p className="text-sm text-[#6b7878] py-4 text-center">No workers added yet</p>
          ) : (
            <div className="space-y-2">
              {workers.filter(w => w.active).map(w => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-[#3a4040] last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#323838] border border-[#3a4040] flex items-center justify-center text-xs font-bold text-[#ffffff] shrink-0">
                      {(w.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#ffffff]">{w.name}</p>
                      <p className="text-[10px] text-[#6b7878]">{w.email}</p>
                    </div>
                  </div>
                  <span className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full border font-medium',
                    w.status === 'free'
                      ? 'border-emerald-500/30 text-[#2dcc5e] bg-[#22b14c]/10'
                      : w.status === 'busy'
                        ? 'border-amber-500/30 text-[#f0ba1c] bg-[#d4a017]/12'
                        : 'border-zinc-700 text-[#6b7878] bg-[#2d3333]'
                  )}>
                    {w.status === 'free' ? 'Online' : w.status === 'busy' ? 'Busy' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
