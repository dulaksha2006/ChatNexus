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
    brand:  'from-brand-500/15  to-brand-600/5  border-brand-500/20  text-brand-400',
    green:  'from-accent-500/15 to-accent-600/5 border-accent-500/20 text-accent-400',
    amber:  'from-amber-500/15  to-amber-600/5  border-amber-500/20  text-amber-400',
    purple: 'from-purple-500/15 to-purple-600/5 border-purple-500/20 text-purple-400',
  };
  return (
    <div className={`card p-5 bg-gradient-to-br ${colors[color]} animate-fade-in`}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-lg bg-white/5">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-display font-bold text-white mb-0.5">{value ?? '—'}</p>
      <p className="text-xs font-medium text-slate-300">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function SessionRow({ session }) {
  const ts = session.createdAt?.toDate?.() || new Date();
  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0 group hover:bg-white/5 px-2 -mx-2 rounded-lg transition-colors">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">
          Customer #{String(session.customerTelegramId).slice(-6)}
        </p>
        <p className="text-xs text-slate-500">{session.workerName || 'Unassigned'}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-slate-400">{formatDistanceToNow(ts, { addSuffix: true })}</p>
        <span className={clsx(
          'text-xs px-2 py-0.5 rounded-full border',
          session.status === 'active'
            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
            : 'border-zinc-700 text-zinc-500 bg-zinc-900'
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
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-400" />
            Active Sessions
          </h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-600 py-4 text-center">No active sessions</p>
          ) : (
            sessions.map(s => <SessionRow key={s.id} session={s} />)
          )}
        </div>

        {/* Worker status */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" />
            Worker Status
          </h3>
          {workers.filter(w => w.active).length === 0 ? (
            <p className="text-sm text-zinc-600 py-4 text-center">No workers added yet</p>
          ) : (
            <div className="space-y-2">
              {workers.filter(w => w.active).map(w => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {(w.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{w.name}</p>
                      <p className="text-[10px] text-zinc-500">{w.email}</p>
                    </div>
                  </div>
                  <span className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full border font-medium',
                    w.status === 'free'
                      ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                      : w.status === 'busy'
                        ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                        : 'border-zinc-700 text-zinc-500 bg-zinc-900'
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
