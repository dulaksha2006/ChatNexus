import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

export default function Login({ mode: initialMode = 'login' }) {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [mode, setMode]    = useState(initialMode);
  const [loading, setLoad] = useState(false);
  const [showPass, setShow] = useState(false);
  const [form, setForm] = useState({ email:'', password:'', otp:'', newPassword:'' });
  const u = (k,v) => setForm(p => ({ ...p, [k]:v }));

  async function handleLogin(e) {
    e.preventDefault(); setLoad(true);
    try {
      const { needsTelegramVerify } = await login(form.email, form.password);
      needsTelegramVerify ? navigate('/telegram-verify') : navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.code === 'EMAIL_UNVERIFIED' ? 'Verify your email first.' : err.response?.data?.error || 'Login failed');
    } finally { setLoad(false); }
  }
  async function handleForgot(e) {
    e.preventDefault(); setLoad(true);
    try { const r = await api.post('/auth/forgot-password', { email:form.email }); toast.success(`OTP sent via ${r.data.via}`); setMode('reset'); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoad(false); }
  }
  async function handleReset(e) {
    e.preventDefault(); setLoad(true);
    try { await api.post('/auth/reset-password', { email:form.email, otp:form.otp, newPassword:form.newPassword }); toast.success('Password updated!'); setMode('login'); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoad(false); }
  }

  const mono = { fontFamily:"'Space Mono', monospace" };

  return (
    <div style={{ minHeight:'100vh', background:'#000', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:'360px' }} className="animate-fade-in">

        {/* Brand */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ ...mono, fontSize:'11px', fontWeight:'700', letterSpacing:'0.14em', textTransform:'uppercase', color:'#555', marginBottom:'12px' }}>
            // CHATNEXUS
          </div>
          <h1 style={{ ...mono, fontSize:'20px', fontWeight:'700', color:'#fff', marginBottom:'6px' }}>
            {mode==='login' ? 'Sign In' : mode==='forgot' ? 'Reset Password' : 'New Password'}
          </h1>
          <p style={{ fontSize:'13px', color:'#555' }}>
            {mode==='login' ? 'Enter your credentials to continue' : mode==='forgot' ? 'We\'ll send a reset code' : 'Choose your new password'}
          </p>
        </div>

        {/* Card */}
        <div style={{ background:'#0a0a0a', border:'1px solid #1a1a1a', borderRadius:'2px', padding:'28px', position:'relative' }}
          className="cn-box">

          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ ...mono, display:'block', fontSize:'9px', letterSpacing:'0.12em', textTransform:'uppercase', color:'#888', marginBottom:'8px' }}>
                  Email Address
                </label>
                <input className="cn-input" type="email" placeholder="you@company.com"
                  value={form.email} onChange={e=>u('email',e.target.value)} required autoFocus />
              </div>
              <div style={{ marginBottom:'20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <label style={{ ...mono, fontSize:'9px', letterSpacing:'0.12em', textTransform:'uppercase', color:'#888' }}>Password</label>
                  <button type="button" onClick={() => setMode('forgot')}
                    style={{ ...mono, fontSize:'9px', letterSpacing:'0.06em', textTransform:'uppercase', color:'#555', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
                    Forgot?
                  </button>
                </div>
                <div style={{ position:'relative' }}>
                  <input className="cn-input" type={showPass?'text':'password'} placeholder="••••••••" style={{ paddingRight:'40px' }}
                    value={form.password} onChange={e=>u('password',e.target.value)} required />
                  <button type="button" onClick={() => setShow(p=>!p)}
                    style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#555', display:'flex', padding:'2px' }}>
                    {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="cn-btn-primary">
                {loading ? <Loader2 size={13} className="animate-spin"/> : <><span style={{ fontSize:'11px' }}>→</span> Sign In</>}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot}>
              <p style={{ fontSize:'13px', color:'#555', marginBottom:'20px', lineHeight:1.6 }}>
                Enter your email address and we'll send a reset code.
              </p>
              <div style={{ marginBottom:'20px' }}>
                <label style={{ ...mono, display:'block', fontSize:'9px', letterSpacing:'0.12em', textTransform:'uppercase', color:'#888', marginBottom:'8px' }}>Email Address</label>
                <input className="cn-input" type="email" placeholder="you@company.com"
                  value={form.email} onChange={e=>u('email',e.target.value)} required autoFocus />
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button type="button" className="cn-btn-ghost" onClick={() => setMode('login')} style={{ flex:'0 0 auto', gap:'6px' }}>
                  <ArrowLeft size={13}/> Back
                </button>
                <button type="submit" disabled={loading} className="cn-btn-primary" style={{ flex:1 }}>
                  {loading ? <Loader2 size={13} className="animate-spin"/> : 'Send Code'}
                </button>
              </div>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset}>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ ...mono, display:'block', fontSize:'9px', letterSpacing:'0.12em', textTransform:'uppercase', color:'#888', marginBottom:'8px' }}>OTP Code</label>
                <input className="cn-input" placeholder="1 2 3 4 5 6" maxLength={6}
                  style={{ fontFamily:"'Space Mono', monospace", letterSpacing:'8px', textAlign:'center', fontSize:'18px' }}
                  value={form.otp} onChange={e=>u('otp',e.target.value)} required autoFocus />
              </div>
              <div style={{ marginBottom:'20px' }}>
                <label style={{ ...mono, display:'block', fontSize:'9px', letterSpacing:'0.12em', textTransform:'uppercase', color:'#888', marginBottom:'8px' }}>New Password</label>
                <input className="cn-input" type="password" placeholder="Minimum 8 characters"
                  value={form.newPassword} onChange={e=>u('newPassword',e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="cn-btn-primary">
                {loading ? <Loader2 size={13} className="animate-spin"/> : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Footer note */}
        <div style={{ border:'1px solid #1a1a1a', marginTop:'16px', padding:'14px 20px', textAlign:'center' }}>
          <span style={{ ...mono, fontSize:'10px', letterSpacing:'0.06em', color:'#333' }}>
            New account? Contact your administrator.
          </span>
        </div>
      </div>
    </div>
  );
}
