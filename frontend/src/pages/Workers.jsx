import { useState, useEffect } from 'react';
import { UserPlus, Trash2, ToggleLeft, ToggleRight, Loader2, Shield, CheckCircle,
         MessageCircle, Eye, EyeOff, X, Edit3, Save } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function AddWorkerModal({ onClose, onAdded }) {
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]  = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      return toast.error('Fill all fields. Password min 8 characters.');
    }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password
      });
      toast.success('Worker created!');
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create worker');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-md animate-slide-up shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">Add Worker</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full Name</label>
            <input className="input-field" placeholder="Jane Smith"
              value={form.name} onChange={e => u('name', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
            <input className="input-field" type="email" placeholder="jane@company.com"
              value={form.email} onChange={e => u('email', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
            <div className="relative">
              <input className="input-field pr-10" type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
                value={form.password} onChange={e => u('password', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()} />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-all">Cancel</button>
            <button onClick={submit} disabled={loading}
              className="flex-1 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Worker'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GreetingModal({ worker, onClose, onSaved }) {
  const [greeting, setGreeting] = useState(worker.greeting || `Hi! My name is ${worker.name}. How can I assist you today?`);
  const [saving, setSaving]     = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/workers/${worker.id}`, { greeting });
      onSaved({ ...worker, greeting });
      toast.success('Greeting saved');
      onClose();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white text-sm">Edit Greeting — {worker.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-zinc-500 mb-3">Sent automatically when a customer connects to this agent.</p>
        <textarea
          className="input-field resize-none text-sm"
          rows={4}
          value={greeting}
          onChange={e => setGreeting(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-zinc-400 hover:text-white transition-all">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Workers() {
  const [workers, setWorkers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [editGreeting, setEditGreeting] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/workers');
      setWorkers(res.data);
    } catch { toast.error('Failed to load workers'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(w) {
    try {
      await api.patch(`/workers/${w.id}`, { active: !w.active });
      setWorkers(ws => ws.map(x => x.id === w.id ? { ...x, active: !x.active } : x));
    } catch { toast.error('Update failed'); }
  }

  async function remove(w) {
    if (!confirm(`Remove ${w.name}?`)) return;
    try {
      await api.delete(`/workers/${w.id}`);
      setWorkers(ws => ws.filter(x => x.id !== w.id));
      toast.success('Worker removed');
    } catch { toast.error('Failed to remove'); }
  }

  const statusColor = s => s === 'free' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : s === 'busy' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';

  return (
    <Layout title="Workers">
      {showAdd && <AddWorkerModal onClose={() => setShowAdd(false)} onAdded={load} />}
      {editGreeting && <GreetingModal worker={editGreeting} onClose={() => setEditGreeting(null)}
        onSaved={updated => setWorkers(ws => ws.map(w => w.id === updated.id ? updated : w))} />}

      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-zinc-500">{workers.length} worker{workers.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Add Worker
        </button>
      </div>

      <div className="bg-zinc-950 border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /></div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Shield className="w-8 h-8 text-zinc-800 mb-3" />
            <p className="text-sm text-zinc-500">No workers yet</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm mt-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Add First Worker
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Worker', 'Status', 'Verified', 'Telegram', 'Greeting', 'Active', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-zinc-600 uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map(w => (
                <tr key={w.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {w.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm leading-tight">{w.name}</p>
                        <p className="text-xs text-zinc-600">{w.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full border', statusColor(w.status))}>
                      {w.status || 'offline'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {w.emailVerified
                      ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                      : <span className="text-xs text-amber-500">Email</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {w.telegramVerified
                      ? <span className="text-xs text-emerald-400">Linked</span>
                      : <span className="text-xs text-zinc-600">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => setEditGreeting(w)}
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-brand-400 transition-colors">
                      <Edit3 className="w-3 h-3" />
                      {w.greeting ? 'Edit' : 'Set'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleActive(w)} className="transition-colors">
                      {w.active
                        ? <ToggleRight className="w-6 h-6 text-emerald-400" />
                        : <ToggleLeft className="w-6 h-6 text-zinc-700" />}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => remove(w)}
                      className="p-1.5 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
