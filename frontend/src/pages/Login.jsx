import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

export default function Login({ mode: initialMode = 'login' }) {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [mode, setMode]     = useState(initialMode); // 'login' | 'forgot' | 'reset'
  const [loading, setLoading] = useState(false);
  const [showPass, setShow]   = useState(false);

  const [form, setForm] = useState({ email: '', password: '', otp: '', newPassword: '' });
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, needsTelegramVerify } = await login(form.email, form.password);
      if (needsTelegramVerify) {
        navigate('/telegram-verify');
      } else {
        navigate('/');
      }
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'EMAIL_UNVERIFIED') {
        toast.error('Please verify your email first. Check your inbox.');
      } else {
        toast.error(err.response?.data?.error || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: form.email });
      toast.success(`OTP sent via ${res.data.via}`);
      setMode('reset');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: form.email, otp: form.otp, newPassword: form.newPassword
      });
      toast.success('Password reset! Please log in.');
      setMode('login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-brand-500/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-accent-500/5 blur-[80px] rounded-full" />
      </div>

      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500/15 border border-brand-500/25 mb-4">
            <Bot className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white mb-1">Support Dashboard</h1>
          <p className="text-slate-400 text-sm">
            {mode === 'login'  ? 'Sign in to your account' :
             mode === 'forgot' ? 'Reset your password' :
                                 'Enter your OTP'}
          </p>
        </div>

        <div className="card p-6">
          {/* Login */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input className="input-field" type="email" placeholder="you@company.com" required
                  value={form.email} onChange={e => update('email', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <input className="input-field pr-10" type={showPass ? 'text' : 'password'} placeholder="••••••••" required
                    value={form.password} onChange={e => update('password', e.target.value)} />
                  <button type="button" onClick={() => setShow(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
              </button>
              <button type="button" onClick={() => setMode('forgot')}
                className="w-full text-center text-xs text-slate-500 hover:text-brand-400 transition-colors mt-2">
                Forgot password?
              </button>
            </form>
          )}

          {/* Forgot password */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input className="input-field" type="email" placeholder="you@company.com" required
                  value={form.email} onChange={e => update('email', e.target.value)} />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset OTP'}
              </button>
              <button type="button" onClick={() => setMode('login')}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors mx-auto">
                <ArrowLeft className="w-3 h-3" /> Back to login
              </button>
            </form>
          )}

          {/* Reset password */}
          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input className="input-field" type="email" required
                  value={form.email} onChange={e => update('email', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">OTP Code</label>
                <input className="input-field font-mono tracking-widest text-center text-lg" placeholder="000000" maxLength={6} required
                  value={form.otp} onChange={e => update('otp', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">New Password</label>
                <input className="input-field" type="password" placeholder="Min 8 characters" required
                  value={form.newPassword} onChange={e => update('newPassword', e.target.value)} />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
