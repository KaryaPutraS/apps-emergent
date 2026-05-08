import React, { useState } from 'react';
import { mockConfig, responseModes } from '../data/mockData';
import { 
  Settings, Save, Bot, Clock, Zap, Shield, KeyRound, Trash2, Database,
  Globe, Copy, RefreshCw, LogOut, Eye, EyeOff
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';

const SettingsPage = () => {
  const [config, setConfig] = useState(mockConfig);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Setting Umum</h1>
        <p className="text-slate-500 text-sm mt-0.5">Pengaturan operasional bot</p>
      </div>

      {/* Bot Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Bot className="w-4 h-4 text-emerald-500" /> Status Bot
        </h3>
        <div className="flex items-center gap-3">
          <Switch checked={config.isBotActive} onCheckedChange={(v) => setConfig({...config, isBotActive: v})} />
          <span className="text-sm text-slate-700">Bot Aktif (tidak aktif = tidak akan auto-reply)</span>
        </div>
      </div>

      {/* Working Hours */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-emerald-500" /> Jam Operasional
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <Switch checked={config.workingHoursEnabled} onCheckedChange={(v) => setConfig({...config, workingHoursEnabled: v})} />
          <span className="text-sm text-slate-700">Aktifkan Jam Operasional</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Jam Buka</label>
            <Input type="time" value={config.workingHoursStart} onChange={(e) => setConfig({...config, workingHoursStart: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Jam Tutup</label>
            <Input type="time" value={config.workingHoursEnd} onChange={(e) => setConfig({...config, workingHoursEnd: e.target.value})} />
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Pesan di Luar Jam Operasional</label>
          <Textarea value={config.offlineMessage} onChange={(e) => setConfig({...config, offlineMessage: e.target.value})} rows={3} />
        </div>
      </div>

      {/* Reply Behavior */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-emerald-500" /> Perilaku Reply
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <Switch checked={config.typingSimulation} onCheckedChange={(v) => setConfig({...config, typingSimulation: v})} />
          <span className="text-sm text-slate-700">Simulasi Typing (lebih natural)</span>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Delay Reply (ms)</label>
          <Input type="number" value={config.responseDelayMs} onChange={(e) => setConfig({...config, responseDelayMs: e.target.value})} />
          <p className="text-xs text-slate-400 mt-1">Delay sebelum mengirim balasan (1500 = 1.5 detik)</p>
        </div>
      </div>

      {/* Security & Limits */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-emerald-500" /> Keamanan & Limit
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Rate Limit per Kontak / Menit</label>
            <Input type="number" value={config.rateLimitPerMinute} onChange={(e) => setConfig({...config, rateLimitPerMinute: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Max Karakter Pesan Masuk</label>
            <Input type="number" value={config.maxIncomingMessageChars} onChange={(e) => setConfig({...config, maxIncomingMessageChars: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Limit Broadcast Harian</label>
            <Input type="number" value={config.broadcastDailyLimit} onChange={(e) => setConfig({...config, broadcastDailyLimit: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Batch Broadcast per Menit</label>
            <Input type="number" value={config.broadcastBatchSize} onChange={(e) => setConfig({...config, broadcastBatchSize: e.target.value})} />
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Default Mode Balasan Rule</label>
          <select value={config.defaultRuleResponseMode} onChange={(e) => setConfig({...config, defaultRuleResponseMode: e.target.value})} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
            {responseModes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-emerald-500" /> Security Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Database Aktif</label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <Database className="w-4 h-4 text-slate-400" />
              <code className="text-xs font-mono text-slate-600">chatbot_manager_db</code>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => toast.success('Database dikunci!')} className="gap-1.5 text-xs">
                <Shield className="w-3.5 h-3.5" /> Kunci Database
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toast.success('Status diperbarui!')} className="gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Webhook URL WAHA</label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <Globe className="w-4 h-4 text-slate-400" />
              <code className="text-xs font-mono text-slate-600 truncate">https://script.google.com/...</code>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.success('URL disalin!')}>
                <Copy className="w-3.5 h-3.5" /> Copy
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs text-red-500 hover:text-red-600" onClick={() => toast.success('Secret dirotasi!')}>
                <RefreshCw className="w-3.5 h-3.5" /> Rotate Secret
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="outline" onClick={() => toast.success('Backup berhasil!')} className="gap-2">
            <Save className="w-4 h-4" /> Backup
          </Button>
          <Button variant="outline" onClick={() => toast.success('Logs lama dibersihkan!')} className="gap-2">
            <Trash2 className="w-4 h-4" /> Bersihkan Logs Lama
          </Button>
          <Button variant="outline" onClick={() => toast.success('Semua session di-logout!')} className="gap-2 text-red-500 hover:text-red-600">
            <LogOut className="w-4 h-4" /> Logout Semua Session
          </Button>
        </div>
      </div>

      {/* Data Retention */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-emerald-500" /> Retensi Data
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Simpan Logs Selama (hari)</label>
            <Input type="number" value={config.logRetentionDays} onChange={(e) => setConfig({...config, logRetentionDays: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Simpan Pesan Selama (hari)</label>
            <Input type="number" value={config.messageRetentionDays} onChange={(e) => setConfig({...config, messageRetentionDays: e.target.value})} />
          </div>
        </div>
      </div>

      {/* Password Change */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
          <KeyRound className="w-4 h-4 text-emerald-500" /> Ubah Password Dashboard
        </h3>
        <p className="text-sm text-slate-500 mb-4">Setelah berhasil, Anda akan diminta login ulang.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Password Lama</label>
            <div className="relative">
              <Input type={showOldPass ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Masukkan password lama" />
              <button onClick={() => setShowOldPass(!showOldPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Password Baru</label>
            <div className="relative">
              <Input type={showNewPass ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 8 karakter" />
              <button onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Ulangi Password Baru</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ketik ulang password baru" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => {
              if (!oldPassword || !newPassword) { toast.error('Isi semua field password!'); return; }
              if (newPassword !== confirmPassword) { toast.error('Password baru tidak cocok!'); return; }
              if (newPassword.length < 8) { toast.error('Password minimal 8 karakter!'); return; }
              toast.success('Password berhasil diganti! Silakan login ulang.');
            }} className="bg-red-600 hover:bg-red-700 text-white gap-2">
              <KeyRound className="w-4 h-4" /> Ganti Password
            </Button>
          </div>
        </div>
      </div>

      <Button onClick={() => toast.success('Semua pengaturan tersimpan!')} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
        <Save className="w-4 h-4" /> Simpan Semua
      </Button>
    </div>
  );
};

export default SettingsPage;
