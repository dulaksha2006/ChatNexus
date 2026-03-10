import { useState, useEffect } from 'react';
import { Save, Loader2, Mail, Settings2, Shield } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../api';
import toast from 'react-hot-toast';

export default function Settings() {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [config, setConfig]     = useState(null);
  const [smtp, setSmtp]         = useState({ host: '', port: '587', user: '', pass: '', from: '', secure: false });
  const [general, setGeneral]   = useState({ channelId: '', appName: '' });

  useEffect(() => {
    api.get('/settings')
      .then(r => {
        setConfig(r.data);
        if (r.data.smtp) setSmtp({ ...smtp, ...r.data.smtp, pass: '' });
        setGeneral({ channelId: r.data.channelId || '', appName: r.data.appName || 'SupportDesk' });
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  async function saveSmtp(e) {
    e.preventDefault();
    setSaving('smtp');
    try {
      await api.patch('/settings/smtp', smtp);
      toast.success('SMTP settings saved');
    } catch (err) {
      toast.error('Failed to save SMTP');
    } finally {
      setSaving(false);
    }
  }

  async function saveGeneral(e) {
    e.preventDefault();
    setSaving('general');
    try {
      await api.patch('/settings/general', general);
      toast.success('Settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout title="Settings">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Settings">
      <div className="max-w-2xl space-y-6">

        {/* General */}
        <div className="card p-6">
          <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-white/5">
            <Settings2 className="w-4 h-4 text-brand-400" />
            <h2 className="font-semibold text-white text-sm">General</h2>
          </div>
          <form onSubmit={saveGeneral} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">App Name</label>
              <input className="input-field" placeholder="SupportDesk"
                value={general.appName} onChange={e => setGeneral(p => ({ ...p, appName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Telegram Channel ID</label>
              <input className="input-field font-mono text-sm" placeholder="-1001234567890"
                value={general.channelId} onChange={e => setGeneral(p => ({ ...p, channelId: e.target.value }))} />
              <p className="text-xs text-slate-500 mt-1">Session reports and videos are sent to this channel</p>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving === 'general'} className="btn-primary text-sm flex items-center gap-2">
                {saving === 'general' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </div>
          </form>
        </div>

        {/* SMTP */}
        <div className="card p-6">
          <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-white/5">
            <Mail className="w-4 h-4 text-brand-400" />
            <div>
              <h2 className="font-semibold text-white text-sm">SMTP Email</h2>
              <p className="text-xs text-slate-500">Required for email verification and email-based password resets</p>
            </div>
          </div>
          <form onSubmit={saveSmtp} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Host</label>
                <input className="input-field" placeholder="smtp.gmail.com"
                  value={smtp.host} onChange={e => setSmtp(p => ({ ...p, host: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Port</label>
                <input className="input-field" placeholder="587"
                  value={smtp.port} onChange={e => setSmtp(p => ({ ...p, port: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
              <input className="input-field" type="email" placeholder="you@gmail.com"
                value={smtp.user} onChange={e => setSmtp(p => ({ ...p, user: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password / App Password</label>
              <input className="input-field" type="password" placeholder="Leave blank to keep current"
                value={smtp.pass} onChange={e => setSmtp(p => ({ ...p, pass: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">From Address</label>
              <input className="input-field" placeholder="Support &lt;noreply@company.com&gt;"
                value={smtp.from} onChange={e => setSmtp(p => ({ ...p, from: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="ssl" className="accent-brand-500"
                checked={smtp.secure} onChange={e => setSmtp(p => ({ ...p, secure: e.target.checked }))} />
              <label htmlFor="ssl" className="text-sm text-slate-300 cursor-pointer">Use SSL/TLS (port 465)</label>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving === 'smtp'} className="btn-primary text-sm flex items-center gap-2">
                {saving === 'smtp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save SMTP
              </button>
            </div>
          </form>
        </div>

        {/* System info */}
        <div className="card p-6">
          <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-white/5">
            <Shield className="w-4 h-4 text-brand-400" />
            <h2 className="font-semibold text-white text-sm">System Info</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Setup Status',  value: config?.setupComplete ? '✅ Complete' : '⚠️ Incomplete' },
              { label: 'SMTP Enabled',  value: config?.smtp?.host ? '✅ Configured' : '❌ Not configured' },
              { label: 'Bot Status',    value: '🟢 Running' },
            ].map(item => (
              <div key={item.label} className="flex justify-between py-2 border-b border-white/5 last:border-0 text-sm">
                <span className="text-slate-400">{item.label}</span>
                <span className="text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
