import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

export default function Login({ mode: initialMode = 'login' }) {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [mode, setMode]     = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [showPass, setShow]   = useState(false);
  const [form, setForm] = useState({ email: '', password: '', otp: '', newPassword: '' });
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, needsTelegramVerify } = await login(form.email, form.password);
      if (needsTelegramVerify) navigate('/telegram-verify');
      else navigate('/');
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_UNVERIFIED') toast.error('Please verify your email first.');
      else toast.error(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: form.email });
      toast.success(`OTP sent via ${res.data.via}`);
      setMode('reset');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  }

  async function handleReset(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email: form.email, otp: form.otp, newPassword: form.newPassword });
      toast.success('Password reset! Please log in.');
      setMode('login');
    } catch (err) { toast.error(err.response?.data?.error || 'Reset failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-4">
      {/* Subtle grid bg */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#58a6ff 1px, transparent 1px), linear-gradient(90deg, #58a6ff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="w-full max-w-sm animate-fade-in relative">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#161b22] border border-[#30363d] mb-4">
            <Bot className="w-6 h-6 text-[#58a6ff]" />
          </div>
          <h1 className="text-xl font-semibold text-[#e6edf3]">
            {mode === 'login' ? 'Sign in to ChatNexus' : mode === 'forgot' ? 'Reset your password' : 'Enter new password'}
          </h1>
        </div>

        {/* Card */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-md p-5 shadow-overlay">
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#e6edf3] mb-1.5">Email address</label>
                <input className="gh-input" type="email" placeholder="you@company.com"
                  value={form.email} onChange={e => update('email', e.target.value)} required autoFocus />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-[#e6edf3]">Password</label>
                  <button type="button" onClick={() => setMode('forgot')}
                    className="text-xs text-[#58a6ff] hover:underline">Forgot password?</button>
                </div>
                <div className="relative">
                  <input className="gh-input pr-10" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    value={form.password} onChange={e => update('password', e.target.value)} required />
                  <button type="button" onClick={() => setShow(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6e7681] hover:text-[#e6edf3] transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="gh-btn-blue w-full py-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-xs text-[#8b949e]">Enter your email and we'll send a reset OTP.</p>
              <div>
                <label className="block text-sm font-medium text-[#e6edf3] mb-1.5">Email address</label>
                <input className="gh-input" type="email" placeholder="you@company.com"
                  value={form.email} onChange={e => update('email', e.target.value)} required autoFocus />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMode('login')} className="gh-btn-secondary flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button type="submit" disabled={loading} className="gh-btn-blue flex-1">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP'}
                </button>
              </div>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#e6edf3] mb-1.5">OTP Code</label>
                <input className="gh-input font-mono tracking-widest" placeholder="123456" maxLength={6}
                  value={form.otp} onChange={e => update('otp', e.target.value)} required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#e6edf3] mb-1.5">New Password</label>
                <input className="gh-input" type="password" placeholder="Min 8 characters"
                  value={form.newPassword} onChange={e => update('newPassword', e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="gh-btn-blue w-full py-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
