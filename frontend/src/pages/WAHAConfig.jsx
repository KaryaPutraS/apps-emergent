import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, Save, RefreshCw, CheckCircle, AlertCircle,
  Phone, Wifi, WifiOff, Eye, EyeOff, Plus, Trash2, Edit3,
  X, Shield, Server, Users, ChevronRight, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import apiClient from '../api/apiClient';
import { getWahaPool, createWahaPoolEntry, updateWahaPoolEntry, deleteWahaPoolEntry } from '../api/apiClient';

const TEMPLATE_VARS = [
  { var: '{customer_name}', desc: 'Nama customer' },
  { var: '{username}', desc: 'Username login (dari Kelola User)' },
  { var: '{password}', desc: 'Password (hanya terisi saat baru dibuat / di-reset)' },
  { var: '{license_key}', desc: 'License key' },
  { var: '{product_code}', desc: 'Kode produk' },
  { var: '{plan_name}', desc: 'Nama plan' },
  { var: '{expires_at}', desc: 'Tanggal expired' },
  { var: '{customer_phone}', desc: 'Nomor HP customer' },
  { var: '{customer_email}', desc: 'Email customer' },
];

// ── Pool WAHA Tab ─────────────────────────────────────────────

function PoolEntryModal({ entry, onClose, onSave }) {
  const [form, setForm] = useState(entry || {
    label: '', url: '', api_key: '', max_sessions: 10, active: true, notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.label.trim()) { alert('Label wajib diisi'); return; }
    if (!form.url.trim()) { alert('URL wajib diisi'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{entry ? 'Edit WAHA Server' : 'Tambah WAHA Server'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label <span className="text-red-500">*</span></label>
            <input value={form.label} onChange={e => set('label', e.target.value)}
              placeholder="cth: WAHA Server 1 (Grup A)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WAHA URL <span className="text-red-500">*</span></label>
            <input value={form.url} onChange={e => set('url', e.target.value)}
              placeholder="https://waha1.adminpintar.id"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key <span className="text-xs text-gray-400">(opsional)</span></label>
              <div className="relative">
                <input type={showKey ? 'text' : 'password'} value={form.api_key} onChange={e => set('api_key', e.target.value)}
                  placeholder="Kosongkan jika tidak ada"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button type="button" onClick={() => setShowKey(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maks. Sesi</label>
              <input type="number" min={1} max={50} value={form.max_sessions} onChange={e => set('max_sessions', parseInt(e.target.value) || 10)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <p className="text-xs text-gray-400 mt-1">Rekomendasikan: maks 10 per server</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan <span className="text-xs text-gray-400">(opsional)</span></label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Cth: Server lokasi Jakarta, digunakan untuk user A-Z"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => set('active', !form.active)} className="flex items-center gap-2 text-sm text-gray-700">
              {form.active
                ? <ToggleRight size={22} className="text-green-500" />
                : <ToggleLeft size={22} className="text-gray-400" />}
              <span>{form.active ? 'Aktif (menerima user baru)' : 'Nonaktif (tidak menerima user baru)'}</span>
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

function PoolTab({ showToast }) {
  const [pool, setPool] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { entry: null|obj }

  const fetchPool = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWahaPool();
      setPool(data);
    } catch (e) {
      showToast(e.response?.data?.detail || 'Gagal memuat pool WAHA', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchPool(); }, [fetchPool]);

  const handleSave = async (form) => {
    try {
      if (modal.entry) {
        await updateWahaPoolEntry(modal.entry.id, form);
        showToast('WAHA server berhasil diperbarui.');
      } else {
        await createWahaPoolEntry(form);
        showToast('WAHA server berhasil ditambahkan.');
      }
      fetchPool();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Gagal menyimpan', 'error');
      throw e;
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Hapus "${entry.label}"? Pastikan tidak ada user yang masih terhubung.`)) return;
    try {
      await deleteWahaPoolEntry(entry.id);
      showToast('WAHA server dihapus.');
      fetchPool();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Gagal menghapus', 'error');
    }
  };

  const totalCapacity = pool.reduce((s, p) => s + (p.active ? p.max_sessions : 0), 0);
  const totalUsed = pool.reduce((s, p) => s + p.current_sessions, 0);
  const nearCapacity = pool.filter(p => p.active && p.current_sessions >= p.max_sessions - 1);

  return (
    <div className="space-y-5">
      {modal && (
        <PoolEntryModal
          entry={modal.entry}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Server WAHA</p>
          <p className="text-2xl font-bold text-gray-900">{pool.length}</p>
          <p className="text-xs text-gray-400 mt-1">{pool.filter(p => p.active).length} aktif</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Sesi Terpakai</p>
          <p className="text-2xl font-bold text-gray-900">{totalUsed}</p>
          <p className="text-xs text-gray-400 mt-1">dari {totalCapacity} kapasitas</p>
        </div>
        <div className={`border rounded-xl p-4 ${nearCapacity.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-xs text-gray-500 mb-1">Status Kapasitas</p>
          <p className={`text-2xl font-bold ${nearCapacity.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {nearCapacity.length > 0 ? `${nearCapacity.length} Penuh` : 'Aman'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {nearCapacity.length > 0 ? 'Tambah server baru segera' : 'Masih ada kapasitas tersedia'}
          </p>
        </div>
      </div>

      {/* Alert kapasitas penuh */}
      {nearCapacity.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Perhatian: {nearCapacity.length} server WAHA hampir/sudah penuh</p>
            <p className="text-xs text-amber-600 mt-1">
              Server berikut perlu perhatian: <strong>{nearCapacity.map(p => p.label).join(', ')}</strong>.
              Tambahkan server WAHA baru agar user berikutnya bisa menggunakan fitur managed WAHA.
            </p>
          </div>
        </div>
      )}

      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Daftar Server WAHA</h2>
          <p className="text-xs text-gray-400 mt-0.5">Maks. 10 sesi per server (dapat diubah per entry). User demo & managed auto-assign ke server yang tersedia.</p>
        </div>
        <Button onClick={() => setModal({ entry: null })} className="bg-green-600 hover:bg-green-700 text-white gap-2">
          <Plus size={14} /> Tambah Server
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw size={22} className="animate-spin text-green-500" />
        </div>
      ) : pool.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Server size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Belum ada server WAHA di pool</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Tambahkan minimal satu server agar user dapat menggunakan WAHA Kami</p>
          <Button onClick={() => setModal({ entry: null })} variant="outline" className="gap-2">
            <Plus size={14} /> Tambah Server Pertama
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {pool.map(entry => {
            const pct = Math.min(100, (entry.current_sessions / entry.max_sessions) * 100);
            const isFull = entry.current_sessions >= entry.max_sessions;
            const isNear = !isFull && entry.current_sessions >= entry.max_sessions - 1;
            return (
              <div key={entry.id} className={`bg-white border rounded-xl p-4 ${!entry.active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${entry.active ? (isFull ? 'bg-red-500' : isNear ? 'bg-amber-400' : 'bg-green-500') : 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{entry.label}</span>
                        {!entry.active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Nonaktif</span>}
                        {isFull && entry.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Penuh</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">{entry.url}</p>
                      {entry.notes && <p className="text-xs text-gray-400 mt-1 italic">{entry.notes}</p>}
                      {/* Capacity bar */}
                      <div className="mt-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Users size={10} /> {entry.current_sessions} / {entry.max_sessions} sesi
                          </span>
                          <span className={`text-xs font-medium ${isFull ? 'text-red-500' : isNear ? 'text-amber-500' : 'text-green-600'}`}>
                            {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-red-400' : isNear ? 'bg-amber-400' : 'bg-green-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setModal({ entry })}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => handleDelete(entry)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 space-y-1">
        <p className="font-semibold">Cara kerja Pool WAHA:</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600 text-xs">
          <li>User demo (14 hari) dan user yang memilih "Gunakan WAHA Kami" akan auto-assign ke server dengan kapasitas tersedia</li>
          <li>Sistem memilih server berdasarkan urutan dibuat, dengan slot kosong pertama</li>
          <li>Jika semua server penuh, user baru tidak dapat menggunakan managed WAHA — tambahkan server segera</li>
          <li>Session name user format: <code className="bg-blue-100 px-1 rounded">ap_[8 karakter user ID]</code></li>
          <li>Backend URL otomatis: <code className="bg-blue-100 px-1 rounded">https://apps.adminpintar.id</code></li>
        </ul>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function WAHAConfig() {
  const [activeTab, setActiveTab] = useState('config');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/superadmin/waha-config');
      setConfig(data);
    } catch (e) {
      showToast(e.response?.data?.detail || 'Gagal memuat konfigurasi WAHA', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const set = (k, v) => setConfig(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/superadmin/waha-config', config);
      showToast('Konfigurasi WAHA berhasil disimpan.');
    } catch (e) {
      showToast(e.response?.data?.detail || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await apiClient.post('/superadmin/waha-test', {
        waha_url: config.waha_url,
        waha_api_key: config.waha_api_key,
        waha_session: config.waha_session,
      });
      setTestResult(data);
    } catch (e) {
      setTestResult({ success: false, message: e.response?.data?.detail || 'Koneksi gagal' });
    } finally {
      setTesting(false);
    }
  };

  const insertVar = (varName) => {
    const el = document.getElementById('template-textarea');
    if (!el) {
      set('license_message_template', (config.license_message_template || '') + varName);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = config.license_message_template || '';
    const newText = text.slice(0, start) + varName + text.slice(end);
    set('license_message_template', newText);
    setTimeout(() => {
      el.focus();
      el.selectionStart = start + varName.length;
      el.selectionEnd = start + varName.length;
    }, 0);
  };

  const TABS = [
    { id: 'config', label: 'Konfigurasi WAHA' },
    { id: 'pool', label: 'Pool WAHA' },
  ];

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-100 rounded-xl">
          <MessageSquare size={22} className="text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Konfigurasi WAHA</h1>
          <p className="text-sm text-gray-500">Pengaturan WhatsApp API & manajemen pool server WAHA</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Konfigurasi */}
      {activeTab === 'config' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw size={24} className="animate-spin text-green-500" />
            </div>
          ) : config && (
            <>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Simpan
                </Button>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Wifi size={16} className="text-green-500" />
                  Koneksi WAHA (untuk pengiriman lisensi)
                </h2>
                <p className="text-xs text-gray-400">WAHA ini digunakan superadmin untuk mengirim pesan lisensi ke customer. Berbeda dengan Pool WAHA user.</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WAHA URL <span className="text-red-500">*</span></label>
                  <input type="url" value={config.waha_url || ''} onChange={e => set('waha_url', e.target.value)}
                    placeholder="http://localhost:3000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Session</label>
                    <input value={config.waha_session || 'default'} onChange={e => set('waha_session', e.target.value)}
                      placeholder="default"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key (opsional)</label>
                    <div className="relative">
                      <input type={showApiKey ? 'text' : 'password'} value={config.waha_api_key || ''}
                        onChange={e => set('waha_api_key', e.target.value)}
                        placeholder="Kosongkan jika tidak ada"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Phone size={14} />Tes Koneksi</h3>
                  <div className="flex gap-3">
                    <Button onClick={handleTest} disabled={testing || !config.waha_url} variant="outline" className="gap-2">
                      {testing ? <RefreshCw size={13} className="animate-spin" /> : <Wifi size={13} />}
                      Cek Status Session
                    </Button>
                  </div>
                  {testResult && (
                    <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {testResult.success ? <CheckCircle size={15} className="mt-0.5 flex-shrink-0" /> : <WifiOff size={15} className="mt-0.5 flex-shrink-0" />}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Pesan */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare size={16} className="text-green-500" />
                  Template Pesan Lisensi
                </h2>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARS.map(v => (
                    <button key={v.var} type="button" onClick={() => insertVar(v.var)} title={v.desc}
                      className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-mono rounded-lg border border-green-200 transition-colors">
                      {v.var}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Klik variabel di atas untuk menyisipkan ke template</p>
                <textarea id="template-textarea" value={config.license_message_template || ''}
                  onChange={e => set('license_message_template', e.target.value)}
                  rows={10}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y font-mono"
                  placeholder="Tulis template pesan..." />
                {config.license_message_template && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">Preview Pesan</div>
                    <div className="p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white">
                      {config.license_message_template
                        .replace('{customer_name}', 'Budi Santoso')
                        .replace('{username}', 'budi_santoso')
                        .replace('{password}', 'Rahasia#2025')
                        .replace('{license_key}', 'ADMP-AB12-CD34-EF56')
                        .replace('{product_code}', 'adminpintar_chatbot')
                        .replace('{plan_name}', 'Pro')
                        .replace('{expires_at}', '31 Desember 2025')
                        .replace('{customer_phone}', '08123456789')
                        .replace('{customer_email}', 'budi@email.com')}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Tab: Pool WAHA */}
      {activeTab === 'pool' && (
        <PoolTab showToast={showToast} />
      )}
    </div>
  );
}
