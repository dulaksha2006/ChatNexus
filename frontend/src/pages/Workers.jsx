import { useState, useEffect } from 'react';
import { UserPlus, Trash2, ToggleLeft, ToggleRight, Loader2, Shield, CheckCircle,
         Eye, EyeOff, X, Edit3, Save, Bell, Send, Users } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

/* ── Shared modal shell ─────────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-md w-full max-w-md animate-slide-up shadow-overlay">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#21262d]">
          <h3 className="font-semibold text-[#e6edf3] text-sm">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Add Worker modal ───────────────────────────────────────────────────── */
function AddWorkerModal({ onClose, onAdded }) {
  const [form, setForm]         = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8)
      return toast.error('Fill all fields. Password min 8 characters.');
    setLoading(true);
    try {
      await api.post('/auth/register', { name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password });
      toast.success('Worker created!');
      onAdded(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create worker'); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="Add Worker" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-[#e6edf3] mb-1.5">Full Name</label>
          <input className="gh-input" placeholder="Jane Smith"
            value={form.name} onChange={e => u('name', e.target.value)} autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#e6edf3] mb-1.5">Email</label>
          <input className="gh-input" type="email" placeholder="jane@company.com"
            value={form.email} onChange={e => u('email', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#e6edf3] mb-1.5">Password</label>
          <div className="relative">
            <input className="gh-input pr-10" type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
              value={form.password} onChange={e => u('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} />
            <button type="button" onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6e7681] hover:text-[#e6edf3] transition-colors">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="gh-btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={loading} className="gh-btn-blue flex-1 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Worker'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Greeting modal ─────────────────────────────────────────────────────── */
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
    <Modal title={`Edit Greeting — ${worker.name}`} onClose={onClose}>
      <p className="text-xs text-[#8b949e] mb-3">Sent automatically when a customer connects to this agent.</p>
      <textarea className="gh-input resize-none text-sm" rows={4}
        value={greeting} onChange={e => setGreeting(e.target.value)} />
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="gh-btn-secondary flex-1">Cancel</button>
        <button onClick={save} disabled={saving} className="gh-btn-blue flex-1 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Save</>}
        </button>
      </div>
    </Modal>
  );
}

/* ── Notification modal ─────────────────────────────────────────────────── */
function NotifyModal({ workers, onClose }) {
  const [selected, setSelected] = useState(new Set(workers.filter(w => w.active).map(w => w.id)));
  const [message, setMessage]   = useState('');
  const [sendTg, setSendTg]     = useState(true);
  const [sending, setSending]   = useState(false);

  function toggleWorker(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAll()   { setSelected(new Set(workers.map(w => w.id))); }
  function deselectAll() { setSelected(new Set()); }

  async function send() {
    if (!message.trim())       return toast.error('Write a message first');
    if (selected.size === 0)   return toast.error('Select at least one worker');
    setSending(true);
    try {
      const res = await api.post('/notifications/send', {
        workerIds: [...selected],
        message: message.trim(),
        sendTelegram: sendTg,
      });
      toast.success(`Notification sent to ${res.data.sent} worker(s)`);
      onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to send'); }
    finally { setSending(false); }
  }

  const activeWorkers = workers.filter(w => w.active);

  return (
    <Modal title="Send Notification" onClose={onClose}>
      {/* Worker checkboxes */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[#e6edf3]">Recipients</label>
          <div className="flex gap-2 text-xs">
            <button onClick={selectAll} className="text-[#58a6ff] hover:underline">All</button>
            <span className="text-[#6e7681]">·</span>
            <button onClick={deselectAll} className="text-[#58a6ff] hover:underline">None</button>
          </div>
        </div>
        <div className="bg-[#010409] border border-[#30363d] rounded-md divide-y divide-[#21262d] max-h-40 overflow-y-auto">
          {activeWorkers.length === 0 && (
            <p className="text-xs text-[#6e7681] p-3">No active workers</p>
          )}
          {activeWorkers.map(w => (
            <label key={w.id}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#21262d] transition-colors">
              <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggleWorker(w.id)}
                className="accent-[#1f6feb] w-3.5 h-3.5" />
              <div className="w-5 h-5 rounded-full bg-[#1f6feb]/20 flex items-center justify-center text-[9px] font-bold text-[#58a6ff] shrink-0">
                {w.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm text-[#e6edf3] flex-1 truncate">{w.name}</span>
              {w.telegramVerified && (
                <span className="text-[10px] text-[#3fb950] shrink-0">TG</span>
              )}
            </label>
          ))}
        </div>
        <p className="text-xs text-[#6e7681] mt-1">{selected.size} of {activeWorkers.length} selected</p>
      </div>

      {/* Message */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-[#e6edf3] mb-1.5">Message</label>
        <textarea className="gh-input resize-none text-sm" rows={4}
          placeholder="Write your notification message here…"
          value={message} onChange={e => setMessage(e.target.value)} autoFocus />
        <p className="text-xs text-[#6e7681] mt-1">{message.length} characters</p>
      </div>

      {/* Telegram toggle */}
      <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none group">
        <input type="checkbox" checked={sendTg} onChange={e => setSendTg(e.target.checked)}
          className="accent-[#1f6feb] w-3.5 h-3.5" />
        <span className="text-sm text-[#c9d1d9]">Also send via Telegram</span>
        <span className="text-xs text-[#6e7681]">(for linked accounts)</span>
      </label>

      <div className="flex gap-2">
        <button onClick={onClose} className="gh-btn-secondary flex-1">Cancel</button>
        <button onClick={send} disabled={sending || selected.size === 0 || !message.trim()}
          className="gh-btn-blue flex-1 flex items-center justify-center gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Send</>}
        </button>
      </div>
    </Modal>
  );
}

/* ── Main Workers page ──────────────────────────────────────────────────── */
export default function Workers() {
  const [workers, setWorkers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [editGreeting, setEditGreeting] = useState(null);
  const [showNotify, setShowNotify] = useState(false);

  async function load() {
    setLoading(true);
    try { const res = await api.get('/workers'); setWorkers(res.data); }
    catch { toast.error('Failed to load workers'); }
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

  const statusBadge = s => ({
    free:    'status-free',
    busy:    'status-busy',
    offline: 'status-offline',
  }[s] || 'status-offline');

  return (
    <Layout title="Workers">
      {showAdd && <AddWorkerModal onClose={() => setShowAdd(false)} onAdded={load} />}
      {editGreeting && (
        <GreetingModal worker={editGreeting} onClose={() => setEditGreeting(null)}
          onSaved={u => setWorkers(ws => ws.map(w => w.id === u.id ? u : w))} />
      )}
      {showNotify && <NotifyModal workers={workers} onClose={() => setShowNotify(false)} />}

      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-[#e6edf3] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#58a6ff]" />
            Workers
          </h2>
          <p className="text-xs text-[#8b949e] mt-0.5">{workers.length} total · {workers.filter(w=>w.active).length} active</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNotify(true)} disabled={workers.length === 0}
            className="gh-btn-secondary flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Notify
          </button>
          <button onClick={() => setShowAdd(true)} className="gh-btn-blue flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Add Worker
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="gh-box overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#58a6ff]" /></div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Shield className="w-8 h-8 text-[#30363d] mb-3" />
            <p className="text-sm text-[#8b949e] font-medium">No workers yet</p>
            <p className="text-xs text-[#6e7681] mt-1">Add your first support agent to get started</p>
            <button onClick={() => setShowAdd(true)} className="gh-btn-blue mt-4 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Add First Worker
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#21262d]">
                {['Worker', 'Status', 'Email', 'Telegram', 'Greeting', 'Active', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-medium text-[#6e7681] px-4 py-2.5 first:pl-5 last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map(w => (
                <tr key={w.id} className="border-b border-[#21262d] last:border-0 hover:bg-[#1c2128] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#1f6feb]/15 border border-[#1f6feb]/25 flex items-center justify-center text-xs font-semibold text-[#58a6ff] shrink-0">
                        {w.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[#e6edf3] font-medium text-sm leading-tight">{w.name}</p>
                        <p className="text-xs text-[#6e7681]">{w.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(w.status)}>{w.status || 'offline'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {w.emailVerified
                      ? <CheckCircle className="w-4 h-4 text-[#3fb950]" />
                      : <span className="text-xs text-[#d29922]">Pending</span>}
                  </td>
                  <td className="px-4 py-3">
                    {w.telegramVerified
                      ? <span className="text-xs text-[#3fb950] font-medium">Linked</span>
                      : <span className="text-xs text-[#6e7681]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditGreeting(w)}
                      className="flex items-center gap-1 text-xs text-[#6e7681] hover:text-[#58a6ff] transition-colors">
                      <Edit3 className="w-3 h-3" /> {w.greeting ? 'Edit' : 'Set'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(w)} className="transition-colors">
                      {w.active
                        ? <ToggleRight className="w-6 h-6 text-[#3fb950]" />
                        : <ToggleLeft className="w-6 h-6 text-[#30363d]" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 pr-5">
                    <button onClick={() => remove(w)}
                      className="p-1.5 rounded-md text-[#6e7681] hover:text-[#f85149] hover:bg-[#da3633]/10 transition-all">
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
