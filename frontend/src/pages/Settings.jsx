import React, { useState, useEffect } from 'react';
import { getConfig, updateConfig, changePassword } from '../api/apiClient';
import { Save, Bot, Clock, Zap, Shield, KeyRound, Trash2, Database, Globe, Copy, RefreshCw, LogOut, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';

const responseModes = [
  { value: 'direct', label: 'Langsung kirim teks rule' },
  { value: 'ai_polish', label: 'Teks rule + dipoles AI' },
  { value: 'ai_context', label: 'Pakai AI sepenuhnya' },
];

const SettingsPage = () => {
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
      toast.success('Semua pengaturan tersimpan!');
    } catch (e) { toast.error('Gagal menyimpan pengaturan'); }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) { toast.error('Isi semua field password!'); return; }
    if (newPassword !== confirmPassword) { toast.error('Password baru tidak cocok!'); return; }
    if (newPassword.length < 8) { toast.error('Password minimal 8 karakter!'); return; }
    try {
      const res = await changePassword(oldPassword, newPassword, confirmPassword);
      toast.success(res.message || 'Password berhasil diganti!');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) { toast.error(e.response?.data?.detail || 'Gagal mengganti password'); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>;

  const val = (key, fallback = '') => config[key] !== undefined ? config[key] : fallback;
  const set = (key, value) => setConfig(prev => ({...prev, [key]: value}));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Setting Umum</h1><p className="text-slate-500 text-sm mt-0.5">Pengaturan operasional bot</p></div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Bot className="w-4 h-4 text-emerald-500" /> Status Bot</h3>
        <div className="flex items-center gap-3"><Switch checked={val('isBotActive', true)} onCheckedChange={(v) => set('isBotActive', v)} /><span className="text-sm text-slate-700">Bot Aktif</span></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-emerald-500" /> Zona Waktu
        </h3>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Zona Waktu Dashboard</label>
          <select value={val('timezone', 'WIB')} onChange={(e) => set('timezone', e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
            <option value="WIB">WIB – UTC+7 (Jawa, Sumatera, Kalimantan Barat/Tengah)</option>
            <option value="WITA">WITA – UTC+8 (Bali, NTB, Sulawesi, Kalimantan Timur)</option>
            <option value="WIT">WIT – UTC+9 (Papua, Maluku)</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-emerald-500" /> Jam Operasional</h3>
        <div className="flex items-center gap-3 mb-4"><Switch checked={val('workingHoursEnabled', false)} onCheckedChange={(v) => set('workingHoursEnabled', v)} /><span className="text-sm text-slate-700">Aktifkan Jam Operasional</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Jam Buka</label><Input type="time" value={val('workingHoursStart', '08:00')} onChange={(e) => set('workingHoursStart', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Jam Tutup</label><Input type="time" value={val('workingHoursEnd', '21:00')} onChange={(e) => set('workingHoursEnd', e.target.value)} /></div>
        </div>
        <div className="mt-4"><label className="text-sm font-medium text-slate-700 block mb-1.5">Pesan di Luar Jam</label><Textarea value={val('offlineMessage', '')} onChange={(e) => set('offlineMessage', e.target.value)} rows={3} /></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Zap className="w-4 h-4 text-emerald-500" /> Perilaku Reply</h3>
        <div className="flex items-center gap-3 mb-4"><Switch checked={val('typingSimulation', true)} onCheckedChange={(v) => set('typingSimulation', v)} /><span className="text-sm text-slate-700">Simulasi Typing</span></div>
        <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Delay Reply (ms)</label><Input type="number" value={val('responseDelayMs', 2000)} onChange={(e) => set('responseDelayMs', parseInt(e.target.value) || 0)} /></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Shield className="w-4 h-4 text-emerald-500" /> Keamanan & Limit</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Rate Limit / Menit</label><Input type="number" value={val('rateLimitPerMinute', 15)} onChange={(e) => set('rateLimitPerMinute', parseInt(e.target.value) || 0)} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Max Karakter Pesan</label><Input type="number" value={val('maxIncomingMessageChars', 2000)} onChange={(e) => set('maxIncomingMessageChars', parseInt(e.target.value) || 0)} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Limit Broadcast Harian</label><Input type="number" value={val('broadcastDailyLimit', 100)} onChange={(e) => set('broadcastDailyLimit', parseInt(e.target.value) || 0)} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Batch Broadcast / Menit</label><Input type="number" value={val('broadcastBatchSize', 10)} onChange={(e) => set('broadcastBatchSize', parseInt(e.target.value) || 0)} /></div>
        </div>
        <div className="mt-4"><label className="text-sm font-medium text-slate-700 block mb-1.5">Default Mode Balasan Rule</label><select value={val('defaultRuleResponseMode', 'direct')} onChange={(e) => set('defaultRuleResponseMode', e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">{responseModes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Database className="w-4 h-4 text-emerald-500" /> Retensi Data</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Simpan Logs (hari)</label><Input type="number" value={val('logRetentionDays', 30)} onChange={(e) => set('logRetentionDays', parseInt(e.target.value) || 0)} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Simpan Pesan (hari)</label><Input type="number" value={val('messageRetentionDays', 90)} onChange={(e) => set('messageRetentionDays', parseInt(e.target.value) || 0)} /></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><KeyRound className="w-4 h-4 text-emerald-500" /> Ubah Password Dashboard</h3>
        <p className="text-sm text-slate-500 mb-4">Setelah berhasil, Anda akan diminta login ulang.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Password Lama</label><div className="relative"><Input type={showOldPass ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Masukkan password lama" /><button onClick={() => setShowOldPass(!showOldPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Password Baru</label><div className="relative"><Input type={showNewPass ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 8 karakter" /><button onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Konfirmasi Password</label><Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
          <div className="flex items-end"><Button onClick={handleChangePassword} className="bg-red-600 hover:bg-red-700 text-white gap-2"><KeyRound className="w-4 h-4" /> Ganti Password</Button></div>
        </div>
      </div>

      <Button onClick={handleSaveAll} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Save className="w-4 h-4" /> Simpan Semua</Button>
    </div>
  );
};

export default SettingsPage;
