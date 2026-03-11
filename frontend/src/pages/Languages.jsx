import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Save, X, Globe, Loader2, MessageSquare } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const FIXED_KEYS = [
  { key: 'welcome',              label: 'Welcome Message' },
  { key: 'selectLanguage',       label: 'Language Selection Prompt' },
  { key: 'noWorkers',            label: 'No Agents Available' },
  { key: 'sessionStarted',       label: 'Session Started' },
  { key: 'sessionEndedCustomer', label: 'Session Ended (to Customer)' },
  { key: 'sessionEndedManual',   label: 'Session Ended (Manual)' },
  { key: 'sessionEndedTimeout',  label: 'Session Ended (Timeout)' },
  { key: 'alreadyInSession',     label: 'Already In Session' },
];

function LangTextsEditor({ code, onClose }) {
  const [texts, setTexts]       = useState({});
  const [commands, setCommands] = useState([]); // custom_text commands
  const [cmdTexts, setCmdTexts] = useState({}); // { cmdId: text }
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/languages/${code}/texts`),
      api.get('/commands').catch(() => ({ data: [] }))
    ]).then(([tr, cr]) => {
      setTexts(tr.data || {});
      const customCmds = cr.data.filter(c => c.action === 'custom_text');
      setCommands(customCmds);
      const ct = {};
      customCmds.forEach(cmd => {
        ct[cmd.id] = (tr.data?.cmdTexts || {})[cmd.id] || cmd.responseText || '';
      });
      setCmdTexts(ct);
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [code]);

  async function save() {
    setSaving(true);
    try {
      await api.put(`/languages/${code}/texts`, { ...texts, cmdTexts });
      toast.success('Saved!');
      onClose();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#252b2b] border border-[#3a4040] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3a4040]">
          <h3 className="font-semibold text-[#ffffff] text-sm">Bot Texts — {code.toUpperCase()}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7878] hover:text-[#ffffff] hover:bg-[#3a4040]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#4d9fe0]" /></div> : <>
            <p className="text-[10px] font-semibold text-[#6b7878] uppercase tracking-widest">System Messages</p>
            {FIXED_KEYS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-[#a8b4b4] mb-1.5">{label}</label>
                <textarea className="input-field resize-none text-sm" rows={2}
                  value={texts[key] || ''} onChange={e => setTexts(t => ({ ...t, [key]: e.target.value }))} />
              </div>
            ))}
            {commands.length > 0 && <>
              <div className="pt-2 border-t border-[#3a4040]">
                <p className="text-[10px] font-semibold text-[#6b7878] uppercase tracking-widest mb-3">Command Responses</p>
                {commands.map(cmd => (
                  <div key={cmd.id} className="mb-4">
                    <label className="block text-xs font-medium text-[#a8b4b4] mb-1.5">
                      <code className="text-[#4d9fe0] text-[10px]">/{cmd.command}</code> — {cmd.label}
                    </label>
                    <textarea className="input-field resize-none text-sm" rows={2}
                      value={cmdTexts[cmd.id] || ''}
                      onChange={e => setCmdTexts(t => ({ ...t, [cmd.id]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </>}
          </>}
        </div>
        <div className="px-5 py-4 border-t border-[#3a4040] flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#3a4040] text-sm text-[#a8b4b4] hover:text-[#ffffff] transition-all">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Languages() {
  const [langs, setLangs]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [newLang, setNewLang]     = useState({ code: '', name: '', flag: '' });
  const [adding, setAdding]       = useState(false);

  async function load() {
    setLoading(true);
    try { const r = await api.get('/languages'); setLangs(r.data); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function addLang() {
    if (!newLang.code || !newLang.name) return toast.error('Code and name required');
    setAdding(true);
    try {
      await api.post('/languages', newLang);
      setNewLang({ code: '', name: '', flag: '' });
      setShowAdd(false);
      load();
      toast.success('Language added');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setAdding(false); }
  }

  async function toggleActive(l) {
    try {
      await api.patch(`/languages/${l.code}`, { active: !l.active });
      setLangs(ls => ls.map(x => x.code === l.code ? { ...x, active: !x.active } : x));
    } catch { toast.error('Update failed'); }
  }

  async function remove(l) {
    if (!confirm(`Delete ${l.name}?`)) return;
    try { await api.delete(`/languages/${l.code}`); load(); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); }
  }

  return (
    <Layout title="Languages">
      {editing && <LangTextsEditor code={editing} onClose={() => setEditing(null)} />}

      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-[#6b7878]">{langs.length} language{langs.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Language
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#252b2b] border border-[#3a4040] rounded-xl p-4 mb-4 animate-slide-up">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-[#a8b4b4] mb-1">Code (e.g. en)</label>
              <input className="input-field text-sm" placeholder="en"
                value={newLang.code} onChange={e => setNewLang(p => ({ ...p, code: e.target.value.toLowerCase() }))} />
            </div>
            <div>
              <label className="block text-xs text-[#a8b4b4] mb-1">Name</label>
              <input className="input-field text-sm" placeholder="English"
                value={newLang.name} onChange={e => setNewLang(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-[#a8b4b4] mb-1">Flag emoji</label>
              <input className="input-field text-sm" placeholder="🇺🇸"
                value={newLang.flag} onChange={e => setNewLang(p => ({ ...p, flag: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg border border-[#3a4040] text-xs text-[#a8b4b4] hover:text-[#ffffff] transition-all">Cancel</button>
            <button onClick={addLang} disabled={adding} className="btn-primary text-xs flex items-center gap-1.5">
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add
            </button>
          </div>
        </div>
      )}

      <div className="bg-[#252b2b] border border-[#3a4040] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#4d9fe0]" /></div>
        ) : langs.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Globe className="w-7 h-7 text-zinc-800 mb-2" />
            <p className="text-sm text-[#6b7878]">No languages yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#3a4040]">
                {['Language', 'Code', 'Active', 'Bot Texts', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-[#6b7878] uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {langs.map(l => (
                <tr key={l.code} className="border-b border-[#3a4040] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{l.flag}</span>
                      <span className="text-[#ffffff] font-medium">{l.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="text-xs text-[#6b7878] bg-[#2d3333] px-2 py-0.5 rounded">{l.code}</code>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleActive(l)}
                      className={clsx('text-xs px-2.5 py-1 rounded-full border transition-all',
                        l.active ? 'text-[#2dcc5e] bg-[#22b14c]/10 border-[#22b14c]/30 hover:bg-[#22b14c]/20'
                                 : 'text-[#6b7878] bg-zinc-500/10 border-zinc-700 hover:text-[#ffffff]')}>
                      {l.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => setEditing(l.code)}
                      className="flex items-center gap-1.5 text-xs text-[#6b7878] hover:text-[#4d9fe0] transition-colors">
                      <MessageSquare className="w-3.5 h-3.5" /> Edit Texts
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => remove(l)}
                      className="p-1.5 rounded-lg text-[#4a5252] hover:text-[#e05050] hover:bg-[#e05050]/10 transition-all">
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
