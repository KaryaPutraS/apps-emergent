import React, { useState, useEffect } from 'react';
import { getConfig, updateConfig, changePassword } from '../api/apiClient';
import { Save, Bot, Clock, Zap, Shield, KeyRound, Trash2, Database, Globe, Copy, RefreshCw, LogOut, Eye, EyeOff, BellRing, Tag, Plus, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

function parseSchedule(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed) && parsed.length === 7) return parsed;
  } catch {}
  return DAYS.map((name, day) => ({ day, name, enabled: true, start: '08:00', end: '21:00' }));
}

function parseAutoLabels(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

const responseModes = [
  { value: 'direct', label: 'Langsung kirim teks rule' },
  { value: 'ai_polish', label: 'Teks rule + dipoles AI' },
  { value: 'ai_context', label: 'Pakai AI sepenuhnya' },
];

const SettingsPage = () => {
  const [config, setConfig] = useState({});
  const [schedule, setSchedule] = useState(parseSchedule(''));
  const [autoLabels, setAutoLabels] = useState([]);
  const [newLabel, setNewLabel] = useState({ keyword: '', tag: '' });
  const [loading, setLoading] = useState(true);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    getConfig().then(data => {
      setConfig(data);
      setSchedule(parseSchedule(data.workingHoursSchedule));
      setAutoLabels(parseAutoLabels(data.autoLabels));
      if (data.timezone) localStorage.setItem('userTimezone', data.timezone);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSaveAll = async () => {
    try {
      const updates = {
        ...config,
        workingHoursSchedule: JSON.stringify(schedule),
        autoLabels: JSON.stringify(autoLabels),
      };
      await updateConfig(updates);
      if (config.timezone) localStorage.setItem('userTimezone', config.timezone);
      toast.success('Semua pengaturan tersimpan!');
    } catch (e) { toast.error('Gagal menyimpan pengaturan'); }
  };

  const updateScheduleDay = (idx, field, value) => {
    setSchedule(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const addAutoLabel = () => {
    if (!newLabel.keyword.trim() || !newLabel.tag.trim()) { toast.error('Keyword dan tag harus diisi'); return; }
    setAutoLabels(prev => [...prev, { keyword: newLabel.keyword.trim().toLowerCase(), tag: newLabel.tag.trim() }]);
    setNewLabel({ keyword: '', tag: '' });
  };

  const removeAutoLabel = (idx) => setAutoLabels(prev => prev.filter((_, i) => i !== idx));

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

        {val('workingHoursEnabled', false) && (
          <div className="mb-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Jadwal Per Hari</p>
            <div className="space-y-2">
              {schedule.map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <Switch checked={d.enabled} onCheckedChange={(v) => updateScheduleDay(i, 'enabled', v)} />
                  <span className={`text-sm w-16 font-medium ${d.enabled ? 'text-slate-700' : 'text-slate-400'}`}>{d.name}</span>
                  {d.enabled ? (
                    <>
                      <Input type="time" value={d.start} onChange={(e) => updateScheduleDay(i, 'start', e.target.value)} className="h-8 w-28 text-xs" />
                      <span className="text-slate-400 text-xs">–</span>
                      <Input type="time" value={d.end} onChange={(e) => updateScheduleDay(i, 'end', e.target.value)} className="h-8 w-28 text-xs" />
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Libur / Tutup</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Jam Buka (default)</label><Input type="time" value={val('workingHoursStart', '08:00')} onChange={(e) => set('workingHoursStart', e.target.value)} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Jam Tutup (default)</label><Input type="time" value={val('workingHoursEnd', '21:00')} onChange={(e) => set('workingHoursEnd', e.target.value)} /></div>
        </div>
        <div className="mt-4"><label className="text-sm font-medium text-slate-700 block mb-1.5">Pesan di Luar Jam</label><Textarea value={val('offlineMessage', '')} onChange={(e) => set('offlineMessage', e.target.value)} rows={3} /></div>
      </div>

      {/* WA Owner Notifications */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><BellRing className="w-4 h-4 text-emerald-500" /> Notifikasi ke Owner WhatsApp</h3>
        <p className="text-sm text-slate-500 mb-4">Kirim notifikasi ke nomor WhatsApp owner ketika ada pesan yang tidak bisa dijawab oleh bot.</p>
        <div className="flex items-center gap-3 mb-4">
          <Switch checked={val('ownerNotifyEnabled', false)} onCheckedChange={(v) => set('ownerNotifyEnabled', v)} />
          <span className="text-sm text-slate-700">Aktifkan Notifikasi ke Owner</span>
        </div>
        <div className={val('ownerNotifyEnabled', false) ? '' : 'opacity-50 pointer-events-none'}>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Nomor WhatsApp Owner</label>
          <div className="flex items-center gap-2 max-w-sm">
            <span className="text-sm text-slate-500 shrink-0">+</span>
            <Input
              value={val('ownerWhatsappNumber', '')}
              onChange={(e) => set('ownerWhatsappNumber', e.target.value.replace(/\D/g, ''))}
              placeholder="628123456789"
              className="font-mono"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">Masukkan nomor lengkap dengan kode negara tanpa tanda <span className="font-mono">+</span>, contoh: <span className="font-mono">628123456789</span>. Notifikasi dikirim melalui sesi WAHA yang aktif.</p>
        </div>
      </div>

      {/* Auto-Labels */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><Tag className="w-4 h-4 text-emerald-500" /> Label Otomatis Kontak</h3>
        <p className="text-sm text-slate-500 mb-4">Jika pesan masuk mengandung keyword tertentu, kontak otomatis diberi tag.</p>
        <div className="space-y-2 mb-4">
          {autoLabels.length === 0 && <p className="text-sm text-slate-400 italic">Belum ada aturan label otomatis.</p>}
          {autoLabels.map((lbl, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
              <span className="text-xs text-slate-500 w-20">Jika ada:</span>
              <Badge variant="secondary" className="font-mono text-xs">{lbl.keyword}</Badge>
              <span className="text-xs text-slate-500">→ beri tag:</span>
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">{lbl.tag}</Badge>
              <button onClick={() => removeAutoLabel(i)} className="ml-auto text-slate-400 hover:text-red-500 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1"><label className="text-xs font-medium text-slate-600 block mb-1">Keyword</label><Input value={newLabel.keyword} onChange={(e) => setNewLabel(p => ({...p, keyword: e.target.value}))} placeholder="harga, order, beli..." className="h-9 text-sm" /></div>
          <div className="flex-1"><label className="text-xs font-medium text-slate-600 block mb-1">Tag yang diberikan</label><Input value={newLabel.tag} onChange={(e) => setNewLabel(p => ({...p, tag: e.target.value}))} placeholder="calon-pembeli, vip..." className="h-9 text-sm" /></div>
          <Button onClick={addAutoLabel} size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 h-9"><Plus className="w-3.5 h-3.5" /> Tambah</Button>
        </div>
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
