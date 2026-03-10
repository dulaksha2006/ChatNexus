import { useState, useEffect } from 'react';
import { MessageCircle, Copy, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function TelegramVerify() {
  const { user, logout }      = useAuth();
  const [otp, setOtp]         = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [manualOtp, setManualOtp]   = useState('');
  const [verifying, setVerifying]   = useState(false);

  async function requestOtp() {
    setRequesting(true);
    try {
      const res = await api.post('/auth/send-telegram-otp');
      setOtp(res.data.otp || '');
      setBotUsername(res.data.botUsername || '');
      toast.success('New OTP generated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate OTP');
    } finally { setRequesting(false); setLoading(false); }
  }

  useEffect(() => { requestOtp(); }, []);

  function copyOtp() {
    navigator.clipboard.writeText(otp);
    toast.success('OTP copied!');
  }

  async function verifyManual() {
    if (manualOtp.length !== 6) return toast.error('Enter your 6-digit OTP');
    setVerifying(true);
    try {
      await api.post('/auth/verify-telegram-otp', { otp: manualOtp });
      toast.success('Telegram linked!');
      window.location.href = '/';
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally { setVerifying(false); }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/25 items-center justify-center mb-4">
            <MessageCircle className="w-7 h-7 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Link Your Telegram</h1>
          <p className="text-slate-400 text-sm">One-time setup to receive sessions</p>
        </div>

        <div className="bg-surface-800 border border-white/10 rounded-2xl p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            </div>
          ) : (
            <>
              {/* Step 1 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-bold shrink-0">1</span>
                  <p className="text-sm font-medium text-white">
                    Open this bot on Telegram
                  </p>
                </div>
                {botUsername ? (
                  <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/15 transition-all group">
                    <MessageCircle className="w-5 h-5 text-brand-400 shrink-0" />
                    <span className="text-brand-400 font-mono text-sm font-medium">@{botUsername}</span>
                    <span className="text-xs text-slate-500 group-hover:text-slate-400 ml-auto">Open →</span>
                  </a>
                ) : (
                  <p className="text-sm text-slate-400 bg-surface-700 rounded-lg p-3 border border-white/5">
                    Open your support bot on Telegram
                  </p>
                )}
              </div>

              {/* Step 2 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center font-bold shrink-0">2</span>
                  <p className="text-sm font-medium text-white">Send this OTP to the bot</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-black border border-white/10 rounded-xl px-5 py-4 text-center">
                    <span className="font-mono text-3xl font-bold tracking-[0.3em] text-white">
                      {otp || '------'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={copyOtp} disabled={!otp}
                      className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={requestOtp} disabled={requesting}
                      className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all">
                      {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Just send the 6 digits — no command needed. Expires in 10 min.
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-slate-600">or verify manually</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* Manual entry */}
              <div>
                <p className="text-xs text-slate-400 mb-2">Already sent the OTP? Enter it here:</p>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 font-mono tracking-widest focus:outline-none focus:border-brand-500/50 transition-all text-center"
                    placeholder="123456"
                    maxLength={6}
                    value={manualOtp}
                    onChange={e => setManualOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && verifyManual()}
                  />
                  <button onClick={verifyManual} disabled={verifying || manualOtp.length !== 6}
                    className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 flex items-center gap-2">
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Verify
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <button onClick={() => { logout(); window.location.href = '/login'; }}
          className="mt-4 w-full text-center text-xs text-slate-600 hover:text-slate-400 transition-colors">
          Sign out
        </button>
      </div>
    </div>
  );
}
