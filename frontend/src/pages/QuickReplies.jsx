import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Zap } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api';
import toast from 'react-hot-toast';

export default function QuickReplies() {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel]     = useState('');
  const [text, setText]       = useState('');
  const [saving, setSaving]   = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/settings/quick-replies');
      setReplies(r.data || []);
    } catch { toast.error('Failed to load quick replies'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.post('/settings/quick-replies', { label: label.trim(), text: text.trim() });
      setLabel(''); setText('');
      toast.success('Quick reply added');
      await load();
    } catch { toast.error('Failed to add'); }
    finally { setSaving(false); }
  }

  async function remove(id) {
    try {
      await api.delete(`/settings/quick-replies/${id}`);
      toast.success('Removed');
      setReplies(prev => prev.filter(r => r.id !== id));
    } catch { toast.error('Failed to remove'); }
  }

  return (
    <Layout title="Quick Replies">
      <div className="max-w-2xl">
        <div className="card p-5 mb-4">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Zap className="w-4 h-4 text-white" /> Add Quick Reply
          </h3>
          <p className="text-xs text-white mb-4">Workers can insert these with one click while chatting.</p>
          <div className="space-y-3">
            <input
              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-brand-500/50"
              placeholder="Short label (optional, e.g. 'Greeting')"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
            <textarea
              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-brand-500/50 resize-none"
              placeholder="Message text…"
              rows={3}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <button
              onClick={add}
              disabled={saving || !text.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded bg-white hover:bg-white text-white text-sm font-medium transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Reply
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Existing Quick Replies</h3>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-white" /></div>
          ) : replies.length === 0 ? (
            <p className="text-sm text-white text-center py-4">No quick replies yet</p>
          ) : (
            <div className="space-y-2">
              {replies.map(r => (
                <div key={r.id} className="flex items-start gap-3 p-3 bg-[#0a0a0a]/60 rounded border border-[#1a1a1a]">
                  <div className="flex-1 min-w-0">
                    {r.label && <p className="text-xs font-semibold text-white mb-0.5">{r.label}</p>}
                    <p className="text-sm text-white break-words">{r.text}</p>
                  </div>
                  <button
                    onClick={() => remove(r.id)}
                    className="p-1.5 rounded text-white hover:text-white hover:bg-white/10 transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
