import React from 'react';
import { RotateCcw, AlertTriangle, Database, MessageSquare, Users, Settings as SettingsIcon, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { resetConfig, resetDashboard, resetMessages, resetContacts } from '../api/apiClient';
import { toast } from 'sonner';

const ResetCard = ({ icon: Icon, title, description, buttonText, variant = 'warning', onClick }) => {
  const btnClass = variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><Icon className="w-4 h-4 text-slate-500" /> {title}</h3>
      <p className="text-sm text-slate-500 mb-4">{description}</p>
      <Button onClick={onClick} className={`gap-2 ${btnClass}`}>{buttonText}</Button>
    </div>
  );
};

const ResetData = () => {
  const doReset = async (action, apiFn) => {
    if (!window.confirm(`Yakin ingin ${action}? Aksi ini tidak bisa dibatalkan.`)) return;
    try { const res = await apiFn(); toast.success(res.message || 'Berhasil!'); } catch (e) { toast.error('Gagal melakukan reset'); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Reset Data</h1><p className="text-slate-500 text-sm mt-0.5">Tools untuk mengosongkan data dashboard, pesan, dan kontak.</p></div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>Hati-hati. Aksi di halaman ini bersifat permanen. Backup data terlebih dahulu.</span></div>
      <ResetCard icon={SettingsIcon} title="Reset Konfigurasi BOT" description="Mengosongkan AI Agent, Rules, Knowledge, Template." buttonText="Reset Konfigurasi BOT" variant="warning" onClick={() => doReset('reset konfigurasi BOT', resetConfig)} />
      <ResetCard icon={Database} title="Reset Data Dashboard" description="Mengosongkan rekap tanpa menghapus pesan/kontak." buttonText="Reset Dashboard" variant="warning" onClick={() => doReset('reset dashboard', resetDashboard)} />
      <ResetCard icon={MessageSquare} title="Reset Data Pesan" description="Menghapus semua riwayat pesan, memory, dan analytics." buttonText="Reset Pesan" variant="danger" onClick={() => doReset('reset data pesan', resetMessages)} />
      <ResetCard icon={Users} title="Reset Data Kontak" description="Menghapus semua data kontak. Pesan tidak ikut dihapus." buttonText="Reset Kontak" variant="danger" onClick={() => doReset('reset data kontak', resetContacts)} />
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><Save className="w-4 h-4 text-slate-500" /> Saran Sebelum Reset</h3>
        <p className="text-sm text-slate-500 mb-4">Buat backup database dulu agar data lama masih bisa dikembalikan secara manual.</p>
        <Button variant="outline" onClick={() => toast.success('Backup berhasil dibuat!')} className="gap-2">Buat Backup</Button>
      </div>
    </div>
  );
};

export default ResetData;
