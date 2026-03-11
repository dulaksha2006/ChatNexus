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
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleLogin(e) {
    e.preventDefault(); setLoading(true);
    try {
      const { user, needsTelegramVerify } = await login(form.email, form.password);
      if (needsTelegramVerify) navigate('/telegram-verify'); else navigate('/');
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_UNVERIFIED') toast.error('Please verify your email first.');
      else toast.error(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  }

  async function handleForgot(e) {
    e.preventDefault(); setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: form.email });
      toast.success(`OTP sent via ${res.data.via}`); setMode('reset');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  }

  async function handleReset(e) {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/auth/reset-password', { email: form.email, otp: form.otp, newPassword: form.newPassword });
      toast.success('Password reset! Please log in.'); setMode('login');
    } catch (err) { toast.error(err.response?.data?.error || 'Reset failed'); }
    finally { setLoading(false); }
  }

  const titles = { login: 'Sign in', forgot: 'Reset password', reset: 'New password' };

  return (
    <div className="min-h-screen bg-[#252b2b] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#1474d4] flex items-center justify-center shadow-lg">
              <Bot className="w-5 h-5 text-[#ffffff]" />
            </div>
            <span className="text-xl font-bold text-[#ffffff] tracking-tight">ChatNexus</span>
          </div>
          <h1 className="text-lg font-semibold text-[#ffffff]">{titles[mode]}</h1>
          <p className="text-sm text-[#6b7878] mt-0.5">
            {mode === 'login' ? 'Sign in to your account' : mode === 'forgot' ? 'We\'ll send you a reset code' : 'Enter your new password'}
          </p>
        </div>

        {/* Form card */}
        <div className="bg-[#2d3333] border border-[#3a4040] rounded-lg p-5 shadow-overlay">

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#a8b4b4] mb-1.5">Email</label>
                <input className="cn-input" type="email" placeholder="you@company.com"
                  value={form.email} onChange={e => u('email', e.target.value)} required autoFocus />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-[#a8b4b4]">Password</label>
                  <button type="button" onClick={() => setMode('forgot')}
                    className="text-xs text-[#1474d4] hover:text-[#4d9fe0] transition-colors">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input className="cn-input pr-10" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    value={form.password} onChange={e => u('password', e.target.value)} required />
                  <button type="button" onClick={() => setShow(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7878] hover:text-[#ffffff] transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="cn-btn-blue w-full py-2 mt-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-xs text-[#6b7878]">Enter your email and we'll send a reset OTP via email or Telegram.</p>
              <div>
                <label className="block text-sm font-medium text-[#a8b4b4] mb-1.5">Email</label>
                <input className="cn-input" type="email" placeholder="you@company.com"
                  value={form.email} onChange={e => u('email', e.target.value)} required autoFocus />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMode('login')} className="cn-btn-ghost flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button type="submit" disabled={loading} className="cn-btn-blue flex-1">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP'}
                </button>
              </div>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#a8b4b4] mb-1.5">OTP Code</label>
                <input className="cn-input font-mono tracking-widest text-center text-lg" placeholder="123456" maxLength={6}
                  value={form.otp} onChange={e => u('otp', e.target.value)} required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#a8b4b4] mb-1.5">New Password</label>
                <input className="cn-input" type="password" placeholder="Min 8 characters"
                  value={form.newPassword} onChange={e => u('newPassword', e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="cn-btn-primary w-full py-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
