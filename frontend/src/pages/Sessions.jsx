import { useState, useEffect } from 'react';
import { MessageSquare, Search, Filter, Clock, CheckCircle, User } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import clsx from 'clsx';

export default function Sessions() {
  const { user }            = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/sessions', { params: { status: filter === 'all' ? undefined : filter, limit: 100 } })
      .then(r => setSessions(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const filtered = sessions.filter(s =>
    !search ||
    s.customerTelegramId?.includes(search) ||
    s.workerName?.toLowerCase().includes(search.toLowerCase()) ||
    s.customerFirstName?.toLowerCase().includes(search.toLowerCase())
  );

  function formatTs(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts._seconds * 1000);
    return format(d, 'MMM d, HH:mm');
  }

  return (
    <Layout title="Sessions">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-9 text-sm" placeholder="Search by customer, worker..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'closed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx('px-4 py-2 rounded text-sm font-medium transition-all capitalize',
                filter === f ? 'bg-white text-white' : 'bg-surface-700 text-slate-400 hover:text-white border border-[#1a1a1a]')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              {['Session', 'Customer', user.role === 'admin' && 'Worker', 'Language', 'Status', 'Created'].filter(Boolean).map(h => (
                <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center py-16 text-center">
                    <MessageSquare className="w-8 h-8 text-slate-700 mb-3" />
                    <p className="text-sm text-slate-400">No sessions found</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="border-b border-[#1a1a1a] last:border-0 hover:bg-white/2 transition-colors">
                <td className="px-5 py-3.5">
                  <span className="font-mono text-xs text-slate-400">#{s.id.slice(-8)}</span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-surface-700 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">{s.customerFirstName || 'Customer'}</p>
                      <p className="text-slate-500 text-xs">ID: {s.customerTelegramId}</p>
                    </div>
                  </div>
                </td>
                {user.role === 'admin' && (
                  <td className="px-5 py-3.5 text-xs text-slate-300">{s.workerName || '—'}</td>
                )}
                <td className="px-5 py-3.5">
                  <span className="text-xs bg-surface-700 border border-[#1a1a1a] px-2 py-0.5 rounded text-slate-300 uppercase">{s.language || 'en'}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={clsx('text-xs px-2.5 py-1 rounded border',
                    s.status === 'active' ? 'status-free' : 'status-offline')}>
                    {s.status === 'active' ? (
                      <span className="flex items-center gap-1"><span className="w-1 h-1 rounded bg-accent-500 animate-pulse-dot inline-block" /> Active</span>
                    ) : 'Closed'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-400">{formatTs(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
