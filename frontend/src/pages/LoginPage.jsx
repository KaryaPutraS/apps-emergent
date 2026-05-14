import React, { useCallback, useState, useEffect } from 'react';
import { useApp } from '../App';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Lock, Eye, EyeOff, Bot, ShieldCheck, User, Gift, X, Copy, CheckCircle, ArrowRight, Smartphone, Mail } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ─── Demo Registration Modal ───────────────────────────────────────────────
const DemoModal = ({ onClose, onAutoLogin }) => {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/public/demo-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.message || 'Terjadi kesalahan, coba lagi.');
      } else {
        setResult(data);
      }
    } catch {
      setError('Gagal menghubungi server. Periksa koneksi Anda.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          {!result ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Gift className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Coba Gratis 14 Hari</h2>
                  <p className="text-xs text-slate-500">Isi data di bawah untuk membuat akun demo</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nama */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Nama Lengkap <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Masukkan nama lengkap"
                      required
                      className="w-full pl-10 pr-3 h-11 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {/* No WA */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">No. WhatsApp <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="08xxxxxxxxxx"
                      required
                      className="w-full pl-10 pr-3 h-11 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {/* Email (optional) */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1.5 block">Email <span className="text-slate-400 font-normal">(opsional)</span></label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="email@anda.com"
                      className="w-full pl-10 pr-3 h-11 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !form.name || !form.phone}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Membuat akun...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4" />
                      Daftar Gratis Sekarang
                    </>
                  )}
                </button>
              </form>

              <p className="text-xs text-slate-400 text-center mt-4">
                Dengan mendaftar, akun demo aktif 14 hari tanpa perlu kartu kredit.
              </p>
            </>
          ) : (
            /* Success view */
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Akun demo berhasil dibuat!</h2>
              <p className="text-sm text-slate-500 mb-6">Simpan informasi login Anda di bawah ini.</p>

              <div className="space-y-3 text-left mb-6">
                {/* Username */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-0.5">Username</p>
                    <p className="text-sm font-mono font-semibold text-slate-900">{result.username}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(result.username, 'username')}
                    className="text-slate-400 hover:text-emerald-600 transition-colors"
                    title="Salin"
                  >
                    {copied.username ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-0.5">Password</p>
                    <p className="text-sm font-mono font-semibold text-slate-900">{result.password}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(result.password, 'password')}
                    className="text-slate-400 hover:text-emerald-600 transition-colors"
                    title="Salin"
                  >
                    {copied.password ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* License key */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-700 font-medium mb-0.5">License Key</p>
                    <p className="text-sm font-mono font-semibold text-emerald-900">{result.license_key}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(result.license_key, 'license')}
                    className="text-emerald-500 hover:text-emerald-700 transition-colors"
                    title="Salin"
                  >
                    {copied.license ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Expiry */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-center">
                  <p className="text-xs text-amber-700">
                    Aktif 14 hari hingga <strong>{result.expires_at}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => onAutoLogin(result.username, result.password)}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
              >
                <ArrowRight className="w-4 h-4" />
                Masuk Sekarang
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main LoginPage ────────────────────────────────────────────────────────
const LoginPage = () => {
  const { login, branding } = useApp();
  const siteName = branding?.siteName || 'adminpintar.id';
  const logoDataUrl = branding?.logoDataUrl || '';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [trialCtaText, setTrialCtaText] = useState('Coba Gratis 14 Hari');

  // Fetch LP content to check if trial is enabled
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/lp-content`)
      .then(r => r.json())
      .then(d => {
        const trial = d?.trial;
        if (trial) {
          setTrialEnabled(trial.enabled !== false);
          if (trial.cta_text) setTrialCtaText(trial.cta_text);
        }
      })
      .catch(() => {/* default: show trial */});
  }, []);

  // Auto-fill credentials from URL hash (#demo_login=user:pass) — sent by LP demo flow
  useEffect(() => {
    const hash = window.location.hash || '';
    const m = hash.match(/^#demo_login=([^:]+):(.+)$/);
    if (m) {
      try {
        const u = decodeURIComponent(m[1]);
        const p = decodeURIComponent(m[2]);
        setUsername(u);
        setPassword(p);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (_) {}
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (result.success) {
      toast.success(`Login berhasil! Selamat datang, ${result.user?.fullName || result.user?.username || 'Admin'}.`);
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  const handleAutoLogin = useCallback(async (user, pass) => {
    setShowDemoModal(false);
    setUsername(user);
    setPassword(pass);
    setError('');
    setLoading(true);
    const result = await login(user, pass);
    setLoading(false);
    if (result.success) {
      toast.success(`Selamat datang, ${result.user?.fullName || result.user?.username}!`);
    } else {
      setError(result.message);
    }
  }, [login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
      />

      {/* Decorative circles */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md animate-scale-in">
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-8 border border-slate-200/50">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden ${logoDataUrl ? '' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25'}`}>
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="logo" className="w-16 h-16 object-contain" />
              ) : (
                <Bot className="w-8 h-8 text-white" />
              )}
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Masuk ke Dashboard</h1>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed">
              {siteName} — masukkan kredensial akun Anda.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className="space-y-4">
              {/* Username */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    className="pl-10 h-11 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="pl-10 pr-10 h-11 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg animate-fade-in">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-all duration-200 shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memverifikasi...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Masuk Dashboard
                  </span>
                )}
              </Button>
            </div>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Hubungi admin jika tidak bisa login atau akun dinonaktifkan.
            </p>

            {trialEnabled && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowDemoModal(true)}
                  className="w-full h-10 border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4" />
                  {trialCtaText}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom branding */}
        <div className="text-center mt-6">
          <p className="text-slate-500 text-xs flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secured by {siteName} v1.2.0
          </p>
        </div>
      </div>

      {/* Demo Modal */}
      {showDemoModal && (
        <DemoModal
          onClose={() => setShowDemoModal(false)}
          onAutoLogin={handleAutoLogin}
        />
      )}
    </div>
  );
};

export default LoginPage;
