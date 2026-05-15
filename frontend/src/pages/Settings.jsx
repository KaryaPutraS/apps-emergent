import React, { useState, useEffect } from 'react';
import { getConfig, updateConfig, changePassword } from '../api/apiClient';
import { Save, Clock, Shield, KeyRound, Database, Globe, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { useApp } from '../App';

const SettingsPage = () => {
  const { currentUser, refreshUser } = useApp();
  const mustChange = !!currentUser?.mustChangePassword;
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    getConfig().then(data => {
      setConfig(data);
      if (data.timezone) localStorage.setItem('userTimezone', data.timezone);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSaveAll = async () => {
    try {
      await updateConfig(config);
      if (config.timezone) localStorage.setItem('userTimezone', config.timezone);
      toast.success('Pengaturan sistem tersimpan!');
    } catch (e) { toast.error('Gagal menyimpan pengaturan'); }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) { toast.error('Isi semua field password!'); return; }
    if (newPassword !== confirmPassword) { toast.error('Password baru tidak cocok!'); return; }
    if (newPassword.length < 12) { toast.error('Password minimal 12 karakter!'); return; }
    {
      const hasLetter = /[A-Za-z]/.test(newPassword);
      const hasDigit = /\d/.test(newPassword);
      const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
      const cats = [hasLetter, hasDigit, hasSpecial].filter(Boolean).length;
      if (cats < 2) { toast.error('Gunakan minimal 2 dari: huruf, angka, simbol!'); return; }
    }
    try {
      const res = await changePassword(oldPassword, newPassword, confirmPassword);
      toast.success(res.message || 'Password berhasil diganti!');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      // Refresh data user supaya flag mustChangePassword ikut bersih
      if (typeof refreshUser === 'function') {
        try { await refreshUser(); } catch (_) {}
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal mengganti password'); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>;

  const val = (key, fallback = '') => config[key] !== undefined ? config[key] : fallback;
  const set = (key, value) => setConfig(prev => ({...prev, [key]: value}));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Sistem</h1>
        <p className="text-slate-500 text-sm mt-0.5">Konfigurasi zona waktu, keamanan, dan retensi data</p>
      </div>

      {mustChange && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Anda WAJIB mengganti password sekarang.</p>
            <p className="text-amber-800/90 mt-1">
              Akun ini masih menggunakan password awal yang di-generate sistem.
              Silakan isi formulir <em>“Ganti Password”</em> di bawah dan gunakan
              password yang kuat (minimal 12 karakter, kombinasi huruf/angka/simbol).
            </p>
          </div>
        </div>
      )}

      {/* Zona Waktu */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-emerald-500" /> Zona Waktu
        </h3>
        <label className="text-sm font-medium text-slate-700 block mb-1.5">Zona Waktu Dashboard</label>
        <select value={val('timezone', 'WIB')} onChange={(e) => set('timezone', e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
          <option value="WIB">WIB – UTC+7 (Jawa, Sumatera, Kalimantan Barat/Tengah)</option>
          <option value="WITA">WITA – UTC+8 (Bali, NTB, Sulawesi, Kalimantan Timur)</option>
          <option value="WIT">WIT – UTC+9 (Papua, Maluku)</option>
        </select>
      </div>

      {/* Keamanan & Limit */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Shield className="w-4 h-4 text-emerald-500" /> Keamanan & Limit</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Rate Limit / Menit</label><Input type="number" value={val('rateLimitPerMinute', 15)} onChange={(e) => set('rateLimitPerMinute', parseInt(e.target.value) || 0)} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Max Karakter Pesan</label><Input type="number" value={val('maxIncomingMessageChars', 2000)} onChange={(e) => set('maxIncomingMessageChars', parseInt(e.target.value) || 0)} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Limit Broadcast Harian</label><Input type="number" value={val('broadcastDailyLimit', 100)} onChange={(e) => set('broadcastDailyLimit', parseInt(e.target.value) || 0)} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Batch Broadcast / Menit</label><Input type="number" value={val('broadcastBatchSize', 10)} onChange={(e) => set('broadcastBatchSize', parseInt(e.target.value) || 0)} /></div>
        </div>
      </div>

      {/* Retensi Data */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Database className="w-4 h-4 text-emerald-500" /> Retensi Data</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Simpan Logs (hari)</label><Input type="number" value={val('logRetentionDays', 30)} onChange={(e) => set('logRetentionDays', parseInt(e.target.value) || 0)} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Simpan Pesan (hari)</label><Input type="number" value={val('messageRetentionDays', 90)} onChange={(e) => set('messageRetentionDays', parseInt(e.target.value) || 0)} /></div>
        </div>
      </div>

      {/* Ubah Password */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><KeyRound className="w-4 h-4 text-emerald-500" /> Ubah Password Dashboard</h3>
        <p className="text-sm text-slate-500 mb-4">Setelah berhasil, Anda akan diminta login ulang.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Password Lama</label>
            <div className="relative">
              <Input type={showOldPass ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Masukkan password lama" />
              <button onClick={() => setShowOldPass(!showOldPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Password Baru</label>
            <div className="relative">
              <Input type={showNewPass ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 12 karakter, huruf+angka/simbol" />
              <button onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Konfirmasi Password</label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
          <div className="flex items-end"><Button onClick={handleChangePassword} className="bg-red-600 hover:bg-red-700 text-white gap-2"><KeyRound className="w-4 h-4" /> Ganti Password</Button></div>
        </div>
      </div>

      <Button onClick={handleSaveAll} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Save className="w-4 h-4" /> Simpan Pengaturan</Button>
    </div>
  );
};

export default SettingsPage;
