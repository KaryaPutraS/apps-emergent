import React from 'react';
import { RotateCcw, AlertTriangle, Database, MessageSquare, Users, Settings, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const ResetCard = ({ icon: Icon, title, description, buttonText, variant = 'warning', onClick }) => {
  const btnClass = variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-500" /> {title}
      </h3>
      <p className="text-sm text-slate-500 mb-4">{description}</p>
      <Button onClick={onClick} className={`gap-2 ${btnClass}`}>
        {buttonText}
      </Button>
    </div>
  );
};

const ResetData = () => {
  const confirm = (action, msg) => {
    if (window.confirm(`Yakin ingin ${action}? Aksi ini tidak bisa dibatalkan.`)) {
      toast.success(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reset Data</h1>
        <p className="text-slate-500 text-sm mt-0.5">Tools untuk mengosongkan data dashboard, pesan, dan kontak.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Hati-hati. Aksi di halaman ini bersifat permanen. Backup data terlebih dahulu jika masih dibutuhkan.</span>
      </div>

      {/* Quick stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Settings, label: 'Reset Konfigurasi', desc: 'Kosongkan AI Agent, Rules, Knowledge, Template.', color: 'blue' },
          { icon: Database, label: 'Reset Dashboard', desc: 'Mengosongkan rekap tanpa menghapus pesan/kontak.', color: 'amber' },
          { icon: MessageSquare, label: 'Reset Pesan', desc: 'Menghapus riwayat pesan, memory, dan analytics.', color: 'blue' },
          { icon: Users, label: 'Reset Kontak', desc: 'Menghapus daftar kontak saja.', color: 'emerald' },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase">{item.label}</p>
            <div className="my-2"><item.icon className="w-8 h-8 text-slate-300" /></div>
            <p className="text-xs text-slate-400">{item.desc}</p>
          </div>
        ))}
      </div>

      <ResetCard
        icon={Settings}
        title="Reset Konfigurasi BOT"
        description="Mengosongkan total AI Agent, Rules Engine, Knowledge Base, dan Template. Data contoh tidak akan muncul lagi setelah refresh."
        buttonText="Reset Konfigurasi BOT"
        variant="warning"
        onClick={() => confirm('reset konfigurasi BOT', 'Konfigurasi BOT berhasil direset!')}
      />

      <ResetCard
        icon={Database}
        title="Reset Data Dashboard"
        description="Gunakan ini jika ingin mengulang tampilan statistik/grafik dashboard dari nol. Data pesan dan kontak tidak dihapus."
        buttonText="Reset Dashboard"
        variant="warning"
        onClick={() => confirm('reset dashboard', 'Data dashboard berhasil direset!')}
      />

      <ResetCard
        icon={MessageSquare}
        title="Reset Data Pesan"
        description="Menghapus semua data di menu Pesan, memory chat, dan rekap analytics. Kontak tetap aman."
        buttonText="Reset Pesan"
        variant="danger"
        onClick={() => confirm('reset data pesan', 'Data pesan berhasil direset!')}
      />

      <ResetCard
        icon={Users}
        title="Reset Data Kontak"
        description="Menghapus semua data kontak. Riwayat pesan tidak ikut dihapus."
        buttonText="Reset Kontak"
        variant="danger"
        onClick={() => confirm('reset data kontak', 'Data kontak berhasil direset!')}
      />

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
          <Save className="w-4 h-4 text-slate-500" /> Saran Sebelum Reset
        </h3>
        <p className="text-sm text-slate-500 mb-4">Buat backup database dulu agar data lama masih bisa dikembalikan secara manual.</p>
        <Button variant="outline" onClick={() => toast.success('Backup berhasil dibuat!')} className="gap-2">
          Buat Backup
        </Button>
      </div>
    </div>
  );
};

export default ResetData;
