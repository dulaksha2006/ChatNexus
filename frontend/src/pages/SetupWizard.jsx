import { useState } from 'react';
import { CheckCircle, ArrowRight, ArrowLeft, Bot, Database, Mail, User,
         Loader2, ShieldCheck, Upload, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import clsx from 'clsx';

function parseFirebaseConfig(raw) {
  if (!raw?.trim()) return null;
  let s = raw.trim()
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[^{]*/, '')
    .replace(/;?\s*$/, '')
    .trim();
  if (!s.startsWith('{')) return null;
  try { return JSON.parse(s); } catch {}
  try { return JSON.parse(s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3')); } catch {}
  try { return Function('return (' + s + ')')(); } catch {}
  return null;
}

const STEPS = [
  { id: 1, label: 'Firebase' },
  { id: 2, label: 'Telegram' },
  { id: 3, label: 'Email (SMTP)' },
  { id: 4, label: 'Admin' },
  { id: 5, label: 'Confirm' },
];

export default function SetupWizard({ onComplete }) {
  const [step, setStep]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [fbValid, setFbValid]         = useState(false);
  const [fbProjectId, setFbProjectId] = useState('');
  const [botValid, setBotValid]       = useState(false);
  const [botInfo, setBotInfo]         = useState(null);
  const [firestoreErr, setFirestoreErr] = useState(null);
  const [showPass, setShowPass]       = useState(false);

  const [form, setForm] = useState({
    serviceAccountJson: '', webConfigRaw: '', storageBucket: '',
    botToken: '', channelId: '',
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', smtpFrom: '',
    adminName: '', adminEmail: '', adminPassword: '',
  });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target.result;
        const parsed = JSON.parse(text);
        u('serviceAccountJson', text);
        if (parsed.project_id && !form.storageBucket)
          u('storageBucket', `${parsed.project_id}.firebasestorage.app`);
        toast.success('Service account loaded ✓');
      } catch { toast.error('Invalid JSON file'); }
    };
    reader.readAsText(file);
  }

  async function validateFirebase() {
    if (!form.serviceAccountJson) return toast.error('Upload service account JSON file');
    const wc = parseFirebaseConfig(form.webConfigRaw);
    if (!wc?.apiKey) return toast.error('Could not parse Web SDK config — paste the firebaseConfig block');
    setFirestoreErr(null);
    setLoading(true);
    try {
      const r = await api.post('/setup/validate-firebase', {
        serviceAccountJson: form.serviceAccountJson, storageBucket: form.storageBucket
      });
      setFbValid(true); setFbProjectId(r.data.projectId);
      toast.success(`Connected to "${r.data.projectId}"`);
    } catch (err) {
      const d = err.response?.data || {};
      if (d.firestoreUrl) setFirestoreErr(d);
      else toast.error(d.error || 'Connection failed');
    } finally { setLoading(false); }
  }

  async function validateBot() {
    if (!form.botToken || !form.channelId) return toast.error('Enter bot token and channel ID');
    setLoading(true);
    try {
      const r = await api.post('/setup/validate-bot', { botToken: form.botToken, channelId: form.channelId });
      setBotValid(true); setBotInfo(r.data);
      toast.success(`@${r.data.botUsername} verified!`);
    } catch (err) { toast.error(err.response?.data?.error || 'Bot validation failed'); }
    finally { setLoading(false); }
  }

  async function finish() {
    if (!form.adminName || !form.adminEmail || form.adminPassword.length < 8)
      return toast.error('Fill all admin fields. Password min 8 chars.');
    setLoading(true);
    try {
      const payload = {
        botToken: form.botToken, channelId: form.channelId,
        adminName: form.adminName, adminEmail: form.adminEmail, adminPassword: form.adminPassword,
        firebaseWebConfig: parseFirebaseConfig(form.webConfigRaw),
      };
      if (form.smtpHost) {
        payload.smtp = { host: form.smtpHost, port: Number(form.smtpPort), user: form.smtpUser, pass: form.smtpPass, from: form.smtpFrom, secure: false };
      }
      await api.post('/setup/complete', payload);
      toast.success('Setup complete!');
      setTimeout(() => { window.location.href = '/'; }, 1200);
    } catch (err) { toast.error(err.response?.data?.error || 'Setup failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 items-center justify-center mb-4">
            <Bot className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">System Setup</h1>
          <p className="text-zinc-500 text-sm mt-1">One-time configuration</p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <div className={clsx(
                'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all',
                step > s.id  ? 'bg-emerald-500 text-white' :
                step === s.id ? 'bg-brand-500 text-white ring-2 ring-brand-500/30' :
                               'bg-zinc-900 text-zinc-600 border border-white/5'
              )}>
                {step > s.id ? '✓' : s.id}
              </div>
              {i < STEPS.length - 1 && <div className={clsx('w-6 h-px', step > s.id ? 'bg-emerald-500' : 'bg-zinc-800')} />}
            </div>
          ))}
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/5">
            <div className="w-1 h-4 rounded-full bg-brand-500" />
            <h2 className="font-semibold text-white text-sm">{STEPS[step-1].label}</h2>
          </div>

          {/* ── Step 1: Firebase ─────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3 bg-zinc-900 rounded-xl border border-white/5 text-xs text-zinc-400 space-y-1">
                <p className="text-white font-medium mb-1">Two things needed from Firebase Console:</p>
                <p>① <span className="text-brand-400">Service Account Key</span> → Project Settings → Service Accounts → Generate new key</p>
                <p>② <span className="text-brand-400">Web SDK Config</span> → Project Settings → Your apps → SDK setup → Config</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">① Service Account Key</label>
                <label className={clsx(
                  'flex items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all',
                  form.serviceAccountJson ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 hover:border-brand-500/30 hover:bg-brand-500/5'
                )}>
                  <input type="file" accept=".json" className="hidden" onChange={handleFile} />
                  {form.serviceAccountJson
                    ? <span className="text-emerald-400 text-sm font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Service account loaded</span>
                    : <span className="text-zinc-500 text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> Upload .json file</span>}
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Storage Bucket</label>
                <input className="input-field text-sm font-mono" placeholder="project-id.firebasestorage.app"
                  value={form.storageBucket} onChange={e => u('storageBucket', e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">② Web SDK Config</label>
                <textarea className="input-field text-xs font-mono resize-none" rows={6}
                  placeholder={`const firebaseConfig = {\n  apiKey: "...",\n  projectId: "..."\n};`}
                  value={form.webConfigRaw} onChange={e => u('webConfigRaw', e.target.value)} />
                <p className="text-[10px] text-zinc-600 mt-1">Paste exactly as-is — JS or JSON both work</p>
              </div>

              {firestoreErr && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                  <p className="text-xs text-red-400">{firestoreErr.error}</p>
                  <a href={firestoreErr.firestoreUrl} target="_blank" rel="noreferrer"
                    className="text-xs text-brand-400 hover:text-brand-300 underline">
                    → Enable Firestore API for this project
                  </a>
                  <p className="text-[10px] text-zinc-600">Wait 1–2 min after enabling, then retry.</p>
                </div>
              )}
              {fbValid && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
                  <CheckCircle className="w-4 h-4 shrink-0" /> Connected to <strong>{fbProjectId}</strong>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={validateFirebase} disabled={loading || !form.serviceAccountJson || !form.webConfigRaw}
                  className="px-4 py-2 rounded-lg border border-white/10 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40 flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} Test
                </button>
                <button onClick={() => setStep(2)} disabled={!fbValid} className="btn-primary text-sm flex items-center gap-2">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Telegram ─────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Bot Token</label>
                <input className="input-field font-mono text-xs" placeholder="110201543:AAHdqTcvCH1..."
                  value={form.botToken} onChange={e => { u('botToken', e.target.value); setBotValid(false); }} />
                <p className="text-[10px] text-zinc-600 mt-1">Get from @BotFather on Telegram</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Channel ID</label>
                <input className="input-field" placeholder="-1001234567890"
                  value={form.channelId} onChange={e => { u('channelId', e.target.value); setBotValid(false); }} />
                <p className="text-[10px] text-zinc-600 mt-1">Bot must be admin in this channel</p>
              </div>
              {botValid && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
                  <CheckCircle className="w-4 h-4 shrink-0" /> @{botInfo?.botUsername} verified ✓
                </div>
              )}
              <div className="flex justify-between pt-1">
                <button onClick={() => setStep(1)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex gap-2">
                  <button onClick={validateBot} disabled={loading || !form.botToken || !form.channelId}
                    className="px-4 py-2 rounded-lg border border-white/10 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40 flex items-center gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test Bot'}
                  </button>
                  <button onClick={() => setStep(3)} disabled={!botValid} className="btn-primary text-sm flex items-center gap-2">
                    Next <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: SMTP ─────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                Optional. Skip if you don't need email verification or email password resets.
                If SMTP is set, the admin account you create will also receive a verification email.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Host</label>
                  <input className="input-field text-sm" placeholder="smtp.gmail.com"
                    value={form.smtpHost} onChange={e => u('smtpHost', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Port</label>
                  <input className="input-field text-sm" placeholder="587"
                    value={form.smtpPort} onChange={e => u('smtpPort', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Username</label>
                <input className="input-field text-sm" placeholder="you@gmail.com"
                  value={form.smtpUser} onChange={e => u('smtpUser', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">App Password</label>
                <input className="input-field text-sm" type="password"
                  value={form.smtpPass} onChange={e => u('smtpPass', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">From Address</label>
                <input className="input-field text-sm" placeholder="Support <noreply@company.com>"
                  value={form.smtpFrom} onChange={e => u('smtpFrom', e.target.value)} />
              </div>
              <div className="flex justify-between pt-1">
                <button onClick={() => setStep(2)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setStep(4)} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-zinc-400 hover:text-white transition-all">Skip</button>
                  <button onClick={() => setStep(4)} className="btn-primary text-sm flex items-center gap-2">Next <ArrowRight className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Admin ─────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              {form.smtpHost && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-400">
                  SMTP is configured — a verification email will be sent to the admin account.
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Full Name</label>
                <input className="input-field" placeholder="John Doe"
                  value={form.adminName} onChange={e => u('adminName', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
                <input className="input-field" type="email" placeholder="admin@company.com"
                  value={form.adminEmail} onChange={e => u('adminEmail', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
                <div className="relative">
                  <input className="input-field pr-10" type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
                    value={form.adminPassword} onChange={e => u('adminPassword', e.target.value)} />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between pt-1">
                <button onClick={() => setStep(3)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={() => setStep(5)}
                  disabled={!form.adminName || !form.adminEmail || form.adminPassword.length < 8}
                  className="btn-primary text-sm flex items-center gap-2">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Confirm ───────────────── */}
          {step === 5 && (
            <div className="space-y-3">
              {[
                ['Firebase Project', fbProjectId],
                ['Storage Bucket', form.storageBucket],
                ['Bot', botInfo ? `@${botInfo.botUsername}` : '—'],
                ['Channel', form.channelId],
                ['SMTP', form.smtpHost || 'Not configured'],
                ['Admin Email', form.adminEmail],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between py-2.5 border-b border-white/5 text-sm last:border-0">
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-white font-mono text-xs">{val}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(4)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={finish} disabled={loading} className="btn-primary text-sm flex items-center gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up...</> : <><ShieldCheck className="w-4 h-4" /> Complete Setup</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
