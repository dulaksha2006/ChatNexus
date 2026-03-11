import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Edit3, X, Loader2, Terminal, LayoutList,
         ChevronDown, ChevronUp, GripVertical, Eye, EyeOff } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const ACTIONS = [
  { value: 'welcome',       label: '👋 Welcome Message' },
  { value: 'verify_otp',   label: '🔐 Verify OTP' },
  { value: 'contact_agent', label: '🎧 Contact Agent' },
  { value: 'send_menu',    label: '📋 Send Menu' },
  { value: 'custom_text',  label: '💬 Custom Text Reply' },
];

const EMPTY_CMD = { command: '', label: '', action: 'welcome', responseText: '', menuId: '', showInCommandList: true };

function ShowInListToggle({ checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div onClick={onChange}
        className={clsx(
          'w-8 h-4 rounded-full transition-all relative',
          checked ? 'bg-[#1474d4]' : 'bg-zinc-700'
        )}>
        <span className={clsx(
          'absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all',
          checked ? 'left-[18px]' : 'left-0.5'
        )} />
      </div>
      <span className="text-xs text-[#a8b4b4]">Show in Telegram command list</span>
    </label>
  );
}

function CommandForm({ form, menus, onChange, onSave, onCancel, saving }) {
  const u = (k, v) => onChange({ ...form, [k]: v });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#a8b4b4] mb-1">Command</label>
          <div className="flex items-center gap-1">
            <span className="text-[#6b7878] text-sm font-mono">/</span>
            <input className="input-field font-mono text-sm" placeholder="start"
              value={form.command}
              onChange={e => u('command', e.target.value.replace(/^\//, '').toLowerCase().replace(/\s/g, ''))} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-[#a8b4b4] mb-1">Button Label</label>
          <input className="input-field text-sm" placeholder="Get Started"
            value={form.label} onChange={e => u('label', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-[#a8b4b4] mb-1">Action</label>
        <select className="input-field text-sm" value={form.action} onChange={e => u('action', e.target.value)}>
          {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      {form.action === 'send_menu' && (
        <div>
          <label className="block text-xs text-[#a8b4b4] mb-1">Which Menu?</label>
          <select className="input-field text-sm" value={form.menuId || ''} onChange={e => u('menuId', e.target.value)}>
            <option value="">— Select menu —</option>
            {menus.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>
      )}

      {form.action === 'custom_text' && (
        <div>
          <label className="block text-xs text-[#a8b4b4] mb-1">
            Default Response Text
            <span className="ml-1 text-[#6b7878] font-normal">(override per-language in Languages)</span>
          </label>
          <textarea className="input-field text-sm resize-none" rows={3}
            value={form.responseText || ''} onChange={e => u('responseText', e.target.value)} />
        </div>
      )}

      <ShowInListToggle
        checked={form.showInCommandList !== false}
        onChange={() => u('showInCommandList', form.showInCommandList === false ? true : false)}
      />

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-[#3a4040] text-xs text-[#a8b4b4] hover:text-[#ffffff] transition-all">
          Cancel
        </button>
        <button onClick={onSave} disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-[#1474d4] hover:bg-[#1266be] text-[#ffffff] text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
        </button>
      </div>
    </div>
  );
}

function CommandRow({ cmd, menus, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ ...cmd });
  const [saving, setSaving]   = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/commands/${cmd.id}`, form);
      onSave({ ...cmd, ...form });
      setEditing(false);
      toast.success('Saved');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!confirm(`Delete /${cmd.command}?`)) return;
    try { await api.delete(`/commands/${cmd.id}`); onDelete(cmd.id); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); }
  }

  async function toggleActive() {
    try {
      await api.patch(`/commands/${cmd.id}`, { active: !cmd.active });
      onSave({ ...cmd, active: !cmd.active });
    } catch { toast.error('Update failed'); }
  }

  if (!editing) return (
    <div className={clsx(
      'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
      cmd.active ? 'border-[#3a4040] bg-[#2d3333]' : 'border-[#3a4040] bg-[#252b2b] opacity-50'
    )}>
      <GripVertical className="w-4 h-4 text-[#4a5252] shrink-0" />
      <code className="text-[#4d9fe0] text-sm font-mono w-24 shrink-0">/{cmd.command}</code>
      <span className="text-[#ffffff] text-sm flex-1">{cmd.label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {cmd.showInCommandList !== false
          ? <span className="text-[10px] text-[#22b14c] bg-[#22b14c]/10 border border-[#22b14c]/30 px-1.5 py-0.5 rounded-full">visible</span>
          : <span className="text-[10px] text-[#6b7878] bg-[#323838] border border-[#3a4040] px-1.5 py-0.5 rounded-full">hidden</span>}
        <span className="text-xs text-[#6b7878] bg-[#2d3333] px-2 py-0.5 rounded-full border border-[#3a4040]">
          {ACTIONS.find(a => a.value === cmd.action)?.label || cmd.action}
        </span>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button onClick={toggleActive}
          className={clsx('text-xs px-2 py-1 rounded-lg border transition-all',
            cmd.active
              ? 'text-[#2dcc5e] border-emerald-500/25 bg-[#22b14c]/10 hover:bg-[#22b14c]/20'
              : 'text-[#6b7878] border-[#3a4040] hover:text-[#ffffff]')}>
          {cmd.active ? 'On' : 'Off'}
        </button>
        <button onClick={() => { setForm({ ...cmd }); setEditing(true); }}
          className="p-1.5 rounded-lg text-[#6b7878] hover:text-[#4d9fe0] hover:bg-[#1474d4]/10 transition-all">
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button onClick={del} className="p-1.5 rounded-lg text-[#6b7878] hover:text-[#e05050] hover:bg-[#e05050]/10 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="border border-brand-500/25 bg-[#1474d4]/5 rounded-xl p-4">
      <CommandForm
        form={form} menus={menus}
        onChange={setForm}
        onSave={save}
        onCancel={() => setEditing(false)}
        saving={saving}
      />
    </div>
  );
}

function MenuEditor({ menu, onSave, onDelete }) {
  const [open, setOpen]       = useState(false);
  const [title, setTitle]     = useState(menu.title);
  const [items, setItems]     = useState(menu.items || []);
  const [saving, setSaving]   = useState(false);
  const [menus, setMenus]     = useState([]);

  useEffect(() => {
    api.get('/commands/menus').then(r => setMenus(r.data)).catch(() => {});
  }, []);

  function addItem() {
    setItems(p => [...p, { label: 'New Item', action: 'contact_agent' }]);
  }
  function updateItem(i, k, v) {
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/commands/menus/${menu.id}`, { title, items });
      onSave({ ...menu, title, items });
      toast.success('Menu saved');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!confirm(`Delete menu "${menu.title}"?`)) return;
    try { await api.delete(`/commands/menus/${menu.id}`); onDelete(menu.id); }
    catch { toast.error('Delete failed'); }
  }

  return (
    <div className="border border-[#3a4040] bg-[#2d3333] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#3a4040] transition-colors text-left">
        <LayoutList className="w-4 h-4 text-[#4d9fe0] shrink-0" />
        <span className="text-[#ffffff] text-sm font-medium flex-1">{menu.title}</span>
        <span className="text-xs text-[#6b7878]">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#6b7878]" /> : <ChevronDown className="w-4 h-4 text-[#6b7878]" />}
      </button>

      {open && (
        <div className="border-t border-[#3a4040] p-4 space-y-4">
          <div>
            <label className="block text-xs text-[#a8b4b4] mb-1">Menu Title</label>
            <input className="input-field text-sm" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#6b7878]">Items</p>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-start bg-[#252b2b] rounded-lg p-3 border border-[#3a4040]">
                <div className="flex-1 space-y-2">
                  <input className="input-field text-xs" placeholder="Button label" value={item.label}
                    onChange={e => updateItem(i, 'label', e.target.value)} />
                  <select className="input-field text-xs" value={item.action}
                    onChange={e => updateItem(i, 'action', e.target.value)}>
                    {ACTIONS.filter(a => a.value !== 'verify_otp').map(a =>
                      <option key={a.value} value={a.value}>{a.label}</option>
                    )}
                    <option value="submenu">📁 Open Submenu</option>
                  </select>
                  {item.action === 'submenu' && (
                    <select className="input-field text-xs" value={item.submenuId || ''}
                      onChange={e => updateItem(i, 'submenuId', e.target.value)}>
                      <option value="">— Select submenu —</option>
                      {menus.filter(m => m.id !== menu.id).map(m =>
                        <option key={m.id} value={m.id}>{m.title}</option>
                      )}
                    </select>
                  )}
                </div>
                <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                  className="p-1.5 text-[#6b7878] hover:text-[#e05050] transition-colors shrink-0 mt-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button onClick={addItem}
              className="w-full py-2 border border-dashed border-[#3a4040] rounded-lg text-xs text-[#6b7878] hover:text-[#ffffff] hover:border-white/20 transition-all flex items-center justify-center gap-1.5">
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>

          <div className="flex justify-between pt-1">
            <button onClick={del} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#e05050] bg-[#e05050]/10 hover:bg-[#e05050]/20 border border-[#e05050]/30 transition-all">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1474d4] hover:bg-[#1266be] text-[#ffffff] text-xs font-medium transition-all disabled:opacity-50">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Commands() {
  const [commands, setCommands] = useState([]);
  const [menus, setMenus]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('commands');
  const [showAdd, setShowAdd]   = useState(false);
  const [newCmd, setNewCmd]     = useState({ ...EMPTY_CMD });
  const [adding, setAdding]     = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [c, m] = await Promise.all([api.get('/commands'), api.get('/commands/menus')]);
      setCommands(c.data); setMenus(m.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function addCommand() {
    if (!newCmd.command.trim() || !newCmd.label.trim())
      return toast.error('Command and label are required');
    setAdding(true);
    try {
      const res = await api.post('/commands', { ...newCmd, order: commands.length + 1, active: true });
      setCommands(p => [...p, { id: res.data.id, ...newCmd, active: true }]);
      setNewCmd({ ...EMPTY_CMD });
      setShowAdd(false);
      toast.success('Command added');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setAdding(false); }
  }

  async function addMenu() {
    try {
      const res = await api.post('/commands/menus', { title: 'New Menu', items: [] });
      setMenus(p => [...p, { id: res.data.id, title: 'New Menu', items: [] }]);
      toast.success('Menu created');
    } catch { toast.error('Failed'); }
  }

  return (
    <Layout title="Bot Commands & Menus">
      <div className="flex gap-2 mb-6">
        {[['commands', Terminal, 'Commands'], ['menus', LayoutList, 'Menus']].map(([key, Icon, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === key ? 'bg-[#1474d4] text-[#ffffff]' : 'bg-[#2d3333] text-[#a8b4b4] hover:text-[#ffffff] border border-[#3a4040]')}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#4d9fe0]" /></div>
      ) : tab === 'commands' ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[#6b7878]">{commands.length} command{commands.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Command
            </button>
          </div>

          {showAdd && (
            <div className="bg-[#252b2b] border border-[#1474d4]/25 rounded-xl p-4 animate-slide-up">
              <p className="text-xs font-semibold text-[#a8b4b4] mb-3">New Command</p>
              <CommandForm
                form={newCmd} menus={menus}
                onChange={setNewCmd}
                onSave={addCommand}
                onCancel={() => { setShowAdd(false); setNewCmd({ ...EMPTY_CMD }); }}
                saving={adding}
              />
            </div>
          )}

          {commands.length === 0 && !showAdd ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Terminal className="w-8 h-8 text-zinc-800 mb-3" />
              <p className="text-sm text-[#6b7878]">No commands yet</p>
            </div>
          ) : (
            commands.map(cmd => (
              <CommandRow key={cmd.id} cmd={cmd} menus={menus}
                onSave={updated => setCommands(p => p.map(c => c.id === updated.id ? updated : c))}
                onDelete={id => setCommands(p => p.filter(c => c.id !== id))}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[#6b7878]">{menus.length} menu{menus.length !== 1 ? 's' : ''}</p>
            <button onClick={addMenu} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Menu
            </button>
          </div>
          {menus.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <LayoutList className="w-8 h-8 text-zinc-800 mb-3" />
              <p className="text-sm text-[#6b7878]">No menus yet</p>
            </div>
          ) : (
            menus.map(menu => (
              <MenuEditor key={menu.id} menu={menu}
                onSave={updated => setMenus(p => p.map(m => m.id === updated.id ? updated : m))}
                onDelete={id => setMenus(p => p.filter(m => m.id !== id))}
              />
            ))
          )}
        </div>
      )}
    </Layout>
  );
}
