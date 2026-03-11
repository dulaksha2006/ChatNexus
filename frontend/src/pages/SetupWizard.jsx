import { useState } from 'react';
import { CheckCircle, ArrowRight, ArrowLeft, Bot, Database, Mail, User,
         Loader2, ShieldCheck, Upload, Eye, EyeOff, Building2, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import clsx from 'clsx';

function parseFirebaseConfig(raw) {
  if (!raw?.trim()) return null;
  let s = raw.trim()
    .replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[^{]*/, '').replace(/;?\s*$/, '').trim();
  if (!s.startsWith('{')) return null;
  try { return JSON.parse(s); } catch {}
  try { return JSON.parse(s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3')); } catch {}
  try { return Function('return (' + s + ')')(); } catch {}
  return null;
}

const STEPS = [
  { id: 1, label: 'Company',  icon: Building2 },
  { id: 2, label: 'Firebase', icon: Database },
  { id: 3, label: 'Telegram', icon: Bot },
  { id: 4, label: 'Email',    icon: Mail },
  { id: 5, label: 'Admin',    icon: User },
  { id: 6, label: 'Review',   icon: ShieldCheck },
];

function Label({ children }) {
  return <label className="block text-sm font-medium text-[#ffffff] mb-1.5">{children}</label>;
}
function Hint({ children }) {
  return <p className="text-xs text-[#6b7878] mt-1">{children}</p>;
}
function InfoBox({ children, color = 'blue' }) {
  const c = {
    blue:   'bg-[#1474d4]/10 border-[#1474d4]/30 text-[#4d9fe0]',
    yellow: 'bg-[#d4a017]/10 border-[#d4a017]/30 text-[#f0ba1c]',
    green:  'bg-[#22b14c]/10 border-[#22b14c]/30 text-[#2dcc5e]',
    red:    'bg-[#e05050]/10 border-[#e05050]/30 text-[#f06060]',
  }[color];
  return <div className={`p-3 rounded-md border text-xs ${c}`}>{children}</div>;
}

export default function SetupWizard({ onComplete }) {
  const [step, setStep]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [fbValid, setFbValid]     = useState(false);
  const [fbProjectId, setFbProjectId] = useState('');
  const [botValid, setBotValid]   = useState(false);
  const [botInfo, setBotInfo]     = useState(null);
  const [firestoreErr, setFirestoreErr] = useState(null);
  const [showPass, setShowPass]   = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);

  const [form, setForm] = useState({
    // Company
    companyName: '', companyTagline: '', companyWebsite: '', companyEmail: '',
    companyLogoBase64: '', companyPrimaryColor: '#1474d4',
    // Firebase
    serviceAccountJson: '', webConfigRaw: '', storageBucket: '',
    // Telegram
    botToken: '', channelId: '',
    // SMTP
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', smtpFrom: '',
    // Admin
    adminName: '', adminEmail: '', adminPassword: '',
  });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function handleServiceAccountFile(e) {
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

  function handleLogoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error('Logo must be under 500KB'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = ev.target.result;
      setLogoPreview(base64);
      u('companyLogoBase64', base64);
      toast.success('Logo loaded ✓');
    };
    reader.readAsDataURL(file);
  }

  async function validateFirebase() {
    if (!form.serviceAccountJson) return toast.error('Upload service account JSON file');
    const wc = parseFirebaseConfig(form.webConfigRaw);
    if (!wc?.apiKey) return toast.error('Could not parse Web SDK config');
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
        company: {
          name: form.companyName, tagline: form.companyTagline,
          website: form.companyWebsite, email: form.companyEmail,
          logoBase64: form.companyLogoBase64, primaryColor: form.companyPrimaryColor,
        },
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
    <div className="min-h-screen bg-[#252b2b] flex flex-col items-center justify-center p-4">
      {/* Grid bg */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(#4d9fe0 1px, transparent 1px), linear-gradient(90deg, #4d9fe0 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="w-full max-w-lg animate-fade-in relative">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-10 h-10 rounded-lg bg-[#2d3333] border border-[#3a4040] items-center justify-center mb-3">
            <Bot className="w-5 h-5 text-[#4d9fe0]" />
          </div>
          <h1 className="text-xl font-semibold text-[#ffffff]">ChatNexus Setup</h1>
          <p className="text-sm text-[#a8b4b4] mt-1">One-time configuration</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-0.5 mb-6 flex-wrap gap-y-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center gap-0.5">
                <div className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                  done   ? 'bg-[#22b14c]/20 text-[#2dcc5e] border border-[#22b14c]/30' :
                  active ? 'bg-[#1474d4]/15 text-[#4d9fe0] border border-[#1474d4]/30' :
                           'text-[#6b7878] border border-transparent'
                )}>
                  {done ? <CheckCircle className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={clsx('w-4 h-px mx-0.5', done ? 'bg-[#22b14c]/50' : 'bg-[#323838]')} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-[#2d3333] border border-[#3a4040] rounded-md shadow-overlay">
          {/* Step header */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[#323838]">
            {(() => { const Icon = STEPS[step-1].icon; return <Icon className="w-4 h-4 text-[#4d9fe0]" />; })()}
            <h2 className="font-medium text-[#ffffff] text-sm">{STEPS[step-1].label}</h2>
            <span className="ml-auto text-xs text-[#6b7878]">Step {step} of {STEPS.length}</span>
          </div>

          <div className="p-5">

            {/* ─── Step 1: Company ─── */}
            {step === 1 && (
              <div className="space-y-4">
                <InfoBox color="blue">
                  This info is used in PDF reports and notifications sent to workers.
                </InfoBox>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Company Name <span className="text-[#f06060]">*</span></Label>
                    <input className="gh-input" placeholder="Acme Corp"
                      value={form.companyName} onChange={e => u('companyName', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label>Tagline</Label>
                    <input className="gh-input" placeholder="Support that never sleeps"
                      value={form.companyTagline} onChange={e => u('companyTagline', e.target.value)} />
                  </div>
                  <div>
                    <Label>Website</Label>
                    <input className="gh-input" placeholder="https://acme.com"
                      value={form.companyWebsite} onChange={e => u('companyWebsite', e.target.value)} />
                  </div>
                  <div>
                    <Label>Support Email</Label>
                    <input className="gh-input" placeholder="support@acme.com"
                      value={form.companyEmail} onChange={e => u('companyEmail', e.target.value)} />
                  </div>
                </div>

                {/* Logo upload */}
                <div>
                  <Label>Logo</Label>
                  <label className={clsx(
                    'flex items-center gap-3 border-2 border-dashed rounded-md p-4 cursor-pointer transition-all',
                    logoPreview ? 'border-[#22b14c]/40 bg-[#22b14c]/5' : 'border-[#3a4040] hover:border-[#4d9fe0]/40 hover:bg-[#4d9fe0]/5'
                  )}>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                    {logoPreview ? (
                      <div className="flex items-center gap-3">
                        <img src={logoPreview} alt="logo" className="h-10 w-auto rounded object-contain" />
                        <div>
                          <p className="text-xs font-medium text-[#2dcc5e]">Logo loaded</p>
                          <p className="text-xs text-[#6b7878]">Click to replace</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-[#323838] flex items-center justify-center">
                          <Image className="w-5 h-5 text-[#6b7878]" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[#ffffff]">Upload logo</p>
                          <p className="text-xs text-[#6b7878]">PNG, SVG, JPG — max 500KB</p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>

                {/* Brand color */}
                <div>
                  <Label>Brand Color</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.companyPrimaryColor}
                      onChange={e => u('companyPrimaryColor', e.target.value)}
                      className="w-10 h-8 rounded cursor-pointer border border-[#3a4040] bg-[#1c2020] p-0.5" />
                    <input className="gh-input flex-1" placeholder="#1474d4"
                      value={form.companyPrimaryColor} onChange={e => u('companyPrimaryColor', e.target.value)} />
                  </div>
                  <Hint>Used in PDF reports and email templates</Hint>
                </div>

                <div className="flex justify-end pt-1">
                  <button onClick={() => setStep(2)} disabled={!form.companyName.trim()}
                    className="gh-btn-blue flex items-center gap-1.5">
                    Next <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ─── Step 2: Firebase ─── */}
            {step === 2 && (
              <div className="space-y-4">
                <InfoBox color="blue">
                  <p className="font-medium mb-1">Two things needed from Firebase Console:</p>
                  <p>① <span className="text-[#ffffff]">Service Account Key</span> → Project Settings → Service Accounts → Generate new key</p>
                  <p className="mt-0.5">② <span className="text-[#ffffff]">Web SDK Config</span> → Project Settings → Your apps → SDK setup</p>
                </InfoBox>

                <div>
                  <Label>① Service Account JSON</Label>
                  <label className={clsx(
                    'flex items-center gap-3 border-2 border-dashed rounded-md p-4 cursor-pointer transition-all',
                    form.serviceAccountJson ? 'border-[#22b14c]/40 bg-[#22b14c]/5' : 'border-[#3a4040] hover:border-[#4d9fe0]/40'
                  )}>
                    <input type="file" accept=".json" className="hidden" onChange={handleServiceAccountFile} />
                    {form.serviceAccountJson
                      ? <span className="text-[#2dcc5e] text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Service account loaded</span>
                      : <span className="text-[#6b7878] text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> Upload .json key file</span>}
                  </label>
                </div>

                <div>
                  <Label>Storage Bucket</Label>
                  <input className="gh-input font-mono text-xs" placeholder="project-id.firebasestorage.app"
                    value={form.storageBucket} onChange={e => u('storageBucket', e.target.value)} />
                </div>

                <div>
                  <Label>② Web SDK Config</Label>
                  <textarea className="gh-input text-xs font-mono resize-none" rows={5}
                    placeholder={`const firebaseConfig = {\n  apiKey: "...",\n  projectId: "..."\n};`}
                    value={form.webConfigRaw} onChange={e => u('webConfigRaw', e.target.value)} />
                  <Hint>Paste exactly as-is — JS or JSON both work</Hint>
                </div>

                {firestoreErr && (
                  <InfoBox color="red">
                    <p>{firestoreErr.error}</p>
                    <a href={firestoreErr.firestoreUrl} target="_blank" rel="noreferrer"
                      className="text-[#4d9fe0] hover:underline mt-1 inline-block">→ Enable Firestore API</a>
                  </InfoBox>
                )}
                {fbValid && <InfoBox color="green">Connected to <strong>{fbProjectId}</strong></InfoBox>}

                <div className="flex justify-between pt-1">
                  <button onClick={() => setStep(1)} className="gh-btn-secondary flex items-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <div className="flex gap-2">
                    <button onClick={validateFirebase} disabled={loading || !form.serviceAccountJson || !form.webConfigRaw}
                      className="gh-btn-secondary flex items-center gap-1.5">
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />} Test
                    </button>
                    <button onClick={() => setStep(3)} disabled={!fbValid} className="gh-btn-blue flex items-center gap-1.5">
                      Next <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 3: Telegram ─── */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label>Bot Token</Label>
                  <input className="gh-input font-mono text-xs" placeholder="110201543:AAHdqTcvCH1..."
                    value={form.botToken} onChange={e => { u('botToken', e.target.value); setBotValid(false); }} />
                  <Hint>Get from @BotFather on Telegram</Hint>
                </div>
                <div>
                  <Label>Channel ID</Label>
                  <input className="gh-input font-mono" placeholder="-1001234567890"
                    value={form.channelId} onChange={e => { u('channelId', e.target.value); setBotValid(false); }} />
                  <Hint>Bot must be admin in this channel. Session PDFs are sent here.</Hint>
                </div>
                {botValid && <InfoBox color="green">@{botInfo?.botUsername} verified ✓</InfoBox>}
                <div className="flex justify-between pt-1">
                  <button onClick={() => setStep(2)} className="gh-btn-secondary flex items-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <div className="flex gap-2">
                    <button onClick={validateBot} disabled={loading || !form.botToken || !form.channelId}
                      className="gh-btn-secondary flex items-center gap-1.5">
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test Bot'}
                    </button>
                    <button onClick={() => setStep(4)} disabled={!botValid} className="gh-btn-blue flex items-center gap-1.5">
                      Next <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 4: SMTP ─── */}
            {step === 4 && (
              <div className="space-y-4">
                <InfoBox color="yellow">
                  Optional. Skip if you don't need email verification or password resets via email.
                </InfoBox>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>SMTP Host</Label>
                    <input className="gh-input text-sm" placeholder="smtp.gmail.com"
                      value={form.smtpHost} onChange={e => u('smtpHost', e.target.value)} />
                  </div>
                  <div>
                    <Label>Port</Label>
                    <input className="gh-input text-sm" placeholder="587"
                      value={form.smtpPort} onChange={e => u('smtpPort', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Username</Label>
                  <input className="gh-input text-sm" placeholder="you@gmail.com"
                    value={form.smtpUser} onChange={e => u('smtpUser', e.target.value)} />
                </div>
                <div>
                  <Label>App Password</Label>
                  <input className="gh-input text-sm" type="password"
                    value={form.smtpPass} onChange={e => u('smtpPass', e.target.value)} />
                </div>
                <div>
                  <Label>From Address</Label>
                  <input className="gh-input text-sm" placeholder="Support <noreply@company.com>"
                    value={form.smtpFrom} onChange={e => u('smtpFrom', e.target.value)} />
                </div>
                <div className="flex justify-between pt-1">
                  <button onClick={() => setStep(3)} className="gh-btn-secondary flex items-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setStep(5)} className="gh-btn-secondary">Skip</button>
                    <button onClick={() => setStep(5)} className="gh-btn-blue flex items-center gap-1.5">
                      Next <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 5: Admin ─── */}
            {step === 5 && (
              <div className="space-y-4">
                {form.smtpHost && <InfoBox color="blue">A verification email will be sent to this admin account.</InfoBox>}
                <div>
                  <Label>Full Name</Label>
                  <input className="gh-input" placeholder="John Doe"
                    value={form.adminName} onChange={e => u('adminName', e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <input className="gh-input" type="email" placeholder="admin@company.com"
                    value={form.adminEmail} onChange={e => u('adminEmail', e.target.value)} />
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <input className="gh-input pr-10" type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
                      value={form.adminPassword} onChange={e => u('adminPassword', e.target.value)} />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7878] hover:text-[#ffffff] transition-colors">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between pt-1">
                  <button onClick={() => setStep(4)} className="gh-btn-secondary flex items-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button onClick={() => setStep(6)}
                    disabled={!form.adminName || !form.adminEmail || form.adminPassword.length < 8}
                    className="gh-btn-blue flex items-center gap-1.5">
                    Next <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ─── Step 6: Review ─── */}
            {step === 6 && (
              <div className="space-y-3">
                {/* Company preview */}
                {(form.companyLogoBase64 || form.companyName) && (
                  <div className="flex items-center gap-3 p-3 bg-[#323838] rounded-md border border-[#3a4040] mb-4">
                    {form.companyLogoBase64 && (
                      <img src={form.companyLogoBase64} alt="" className="h-8 w-auto object-contain" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-[#ffffff]">{form.companyName}</p>
                      {form.companyTagline && <p className="text-xs text-[#a8b4b4]">{form.companyTagline}</p>}
                    </div>
                    {form.companyPrimaryColor && (
                      <div className="ml-auto w-5 h-5 rounded-full border border-[#3a4040]"
                        style={{ background: form.companyPrimaryColor }} />
                    )}
                  </div>
                )}

                <div className="divide-y divide-[#323838]">
                  {[
                    ['Firebase Project', fbProjectId],
                    ['Storage Bucket', form.storageBucket],
                    ['Telegram Bot', botInfo ? `@${botInfo.botUsername}` : '—'],
                    ['Channel', form.channelId],
                    ['SMTP', form.smtpHost || 'Not configured'],
                    ['Admin', form.adminEmail],
                    ['Company', form.companyName || '—'],
                    ['Website', form.companyWebsite || '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between items-center py-2.5 text-sm">
                      <span className="text-[#a8b4b4]">{label}</span>
                      <span className="text-[#ffffff] font-mono text-xs bg-[#323838] px-2 py-0.5 rounded">{val}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between pt-2">
                  <button onClick={() => setStep(5)} className="gh-btn-secondary flex items-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button onClick={finish} disabled={loading} className="gh-btn-primary flex items-center gap-1.5">
                    {loading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Setting up…</>
                      : <><ShieldCheck className="w-3.5 h-3.5" /> Complete Setup</>}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
