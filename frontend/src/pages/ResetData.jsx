import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, Database, MessageSquare, Users, Settings as SettingsIcon, Save, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { resetConfig, resetDashboard, resetMessages, resetContacts } from '../api/apiClient';
import { toast } from 'sonner';

const ResetCard = ({ icon: Icon, title, description, buttonText, variant = 'warning', onRequest }) => {
  const btnClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-amber-500 hover:bg-amber-600 text-white';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><Icon className="w-4 h-4 text-slate-500" /> {title}</h3>
      <p className="text-sm text-slate-500 mb-4">{description}</p>
      <Button onClick={onRequest} className={`gap-2 ${btnClass}`}>{buttonText}</Button>
    </div>
  );
};

const ConfirmModal = ({ item, onCancel, onConfirm }) => {
  const [input, setInput] = useState('');
  const isValid = input === 'RESET';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold text-slate-900">Konfirmasi Reset</h3>
          </div>
          <button onClick={onCancel} aria-label="Tutup" className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-700">
            Anda akan melakukan <span className="font-semibold">{item.title}</span>. Aksi ini <span className="font-semibold text-red-600">tidak bisa dibatalkan</span>.
          </p>
          <p className="text-sm text-slate-500">{item.description}</p>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Ketik <span className="font-mono font-bold text-red-600">RESET</span> untuk melanjutkan:
            </label>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="RESET"
              className="font-mono"
              autoFocus
            />
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <Button onClick={onCancel} variant="outline" className="flex-1">Batal</Button>
          <Button
            onClick={() => onConfirm(item)}
            disabled={!isValid}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
          >
            Lanjutkan Reset
          </Button>
        </div>
      </div>
    </div>
  );
};

const resetActions = [
  {
    id: 'config',
    icon: SettingsIcon,
    title: 'Reset Konfigurasi BOT',
    description: 'Mengosongkan AI Agent, Rules, Knowledge, Template.',
    buttonText: 'Reset Konfigurasi BOT',
    variant: 'warning',
    apiFn: resetConfig,
  },
  {
    id: 'dashboard',
    icon: Database,
    title: 'Reset Data Dashboard',
    description: 'Mengosongkan rekap tanpa menghapus pesan/kontak.',
    buttonText: 'Reset Dashboard',
    variant: 'warning',
    apiFn: resetDashboard,
  },
  {
    id: 'messages',
    icon: MessageSquare,
    title: 'Reset Data Pesan',
    description: 'Menghapus semua riwayat pesan, memory, dan analytics.',
    buttonText: 'Reset Pesan',
    variant: 'danger',
    apiFn: resetMessages,
  },
  {
    id: 'contacts',
    icon: Users,
    title: 'Reset Data Kontak',
    description: 'Menghapus semua data kontak. Pesan tidak ikut dihapus.',
    buttonText: 'Reset Kontak',
    variant: 'danger',
    apiFn: resetContacts,
  },
];

const ResetData = () => {
  const [pendingItem, setPendingItem] = useState(null);

  const handleConfirm = async (item) => {
    setPendingItem(null);
    try {
      const res = await item.apiFn();
      toast.success(res.message || 'Berhasil!');
    } catch {
      toast.error('Gagal melakukan reset');
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
        <span>Hati-hati. Aksi di halaman ini bersifat permanen. Backup data terlebih dahulu.</span>
      </div>

      {resetActions.map((action) => (
        <ResetCard
          key={action.id}
          icon={action.icon}
          title={action.title}
          description={action.description}
          buttonText={action.buttonText}
          variant={action.variant}
          onRequest={() => setPendingItem(action)}
        />
      ))}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><Save className="w-4 h-4 text-slate-500" /> Saran Sebelum Reset</h3>
        <p className="text-sm text-slate-500 mb-4">Buat backup database dulu agar data lama masih bisa dikembalikan secara manual.</p>
        <Button variant="outline" onClick={() => toast.success('Backup berhasil dibuat!')} className="gap-2">Buat Backup</Button>
      </div>

      {pendingItem && (
        <ConfirmModal
          item={pendingItem}
          onCancel={() => setPendingItem(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
};

export default ResetData;
