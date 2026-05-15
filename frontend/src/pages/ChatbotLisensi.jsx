import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, Plus, Search, RefreshCw, Send, Trash2, Edit2, CheckCircle,
  AlertCircle, X, ChevronLeft, ChevronRight, MessageSquare
} from 'lucide-react';
import { Button } from '../components/ui/button';
import apiClient from '../api/apiClient';

const STATUS_CONFIG = {
  active: { label: 'Aktif', color: 'bg-green-100 text-green-700' },
  trial: { label: 'Trial', color: 'bg-blue-100 text-blue-700' },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-600' },
  suspended: { label: 'Suspended', color: 'bg-yellow-100 text-yellow-700' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>;
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function LicenseForm({ initial, onSubmit, onClose, loading }) {
  const [form, setForm] = useState({
    product_code: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    plan_name: 'standard',
    max_activations: 1,
    expires_at: '',
    notes: '',
    ...initial,
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kode Produk <span className="text-red-500">*</span></label>
        <input
          required value={form.product_code}
          onChange={e => set('product_code', e.target.value)}
          placeholder="contoh: adminpintar_chatbot"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama Customer</label>
          <input value={form.customer_name} onChange={e => set('customer_name', e.target.value)}
            placeholder="Nama lengkap"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">No. WhatsApp</label>
          <input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)}
            placeholder="08123456789"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)}
            placeholder="email@domain.com"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
          <select value={form.plan_name} onChange={e => set('plan_name', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
            <option value="trial">Trial</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Maks Aktivasi</label>
          <input type="number" min="1" value={form.max_activations} onChange={e => set('max_activations', parseInt(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Expired</label>
          <input type="date" value={form.expires_at ? form.expires_at.slice(0, 10) : ''} onChange={e => set('expires_at', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-xs text-gray-400 mt-1">Kosongkan = tidak ada expired</p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
          placeholder="Catatan internal..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" onClick={onClose} variant="outline">Batal</Button>
        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
          {loading ? <RefreshCw size={14} className="animate-spin mr-1" /> : null}
          {initial?.license_key ? 'Simpan Perubahan' : 'Buat Lisensi'}
        </Button>
      </div>
    </form>
  );
}

export default function ChatbotLisensi() {
  const [licenses, setLicenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState(null);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sendingWaha, setSendingWaha] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const LIMIT = 15;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const errMsg = (e, fallback) => e.response?.data?.detail || fallback;

  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await apiClient.get('/superadmin/licenses', { params });
      setLicenses(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      showToast(errMsg(e, 'Gagal memuat lisensi'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/superadmin/license-stats');
      setStats(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchLicenses();
    fetchStats();
  }, [fetchLicenses, fetchStats]);

  const handleCreate = async (form) => {
    setFormLoading(true);
    try {
      const { data } = await apiClient.post('/superadmin/licenses', form);
      showToast(`Lisensi berhasil dibuat: ${data.license_key}`);
      setCreateModal(false);
      fetchLicenses();
      fetchStats();
    } catch (e) {
      showToast(errMsg(e, 'Gagal membuat lisensi'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (form) => {
    setFormLoading(true);
    try {
      await apiClient.put(`/superadmin/licenses/${editModal.license_key}`, form);
      showToast('Lisensi berhasil diperbarui.');
      setEditModal(null);
      fetchLicenses();
    } catch (e) {
      showToast(errMsg(e, 'Gagal menyimpan'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (key) => {
    try {
      await apiClient.delete(`/superadmin/licenses/${key}`);
      showToast('Lisensi berhasil dihapus.');
      setDeleteConfirm(null);
      fetchLicenses();
      fetchStats();
    } catch (e) {
      showToast(errMsg(e, 'Gagal menghapus'), 'error');
    }
  };

  const handleSendWaha = async (key) => {
    setSendingWaha(key);
    try {
      const { data } = await apiClient.post(`/superadmin/licenses/${key}/send-waha`);
      showToast(data.message || 'Lisensi berhasil dikirim via WhatsApp');
    } catch (e) {
      showToast(errMsg(e, 'Gagal kirim WAHA'), 'error');
    } finally {
      setSendingWaha(null);
    }
  };

  const handleStatusQuick = async (key, status) => {
    try {
      await apiClient.put(`/superadmin/licenses/${key}`, { status });
      showToast(`Status diubah ke ${status}`);
      fetchLicenses();
      fetchStats();
    } catch (e) {
      showToast(errMsg(e, 'Gagal update status'), 'error');
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-xl">
            <Key size={22} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ChatBOT Lisensi</h1>
            <p className="text-sm text-gray-500">Kelola lisensi produk ChatBot AdminPintar</p>
          </div>
        </div>
        <Button onClick={() => setCreateModal(true)} className="bg-green-600 hover:bg-green-700 text-white gap-2">
          <Plus size={14} />
          Buat Lisensi
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total', val: stats.total, color: 'bg-gray-50 text-gray-700' },
            { label: 'Aktif', val: stats.active, color: 'bg-green-50 text-green-700' },
            { label: 'Trial', val: stats.trial, color: 'bg-blue-50 text-blue-700' },
            { label: 'Expired', val: stats.expired, color: 'bg-red-50 text-red-600' },
            { label: 'Suspended', val: stats.suspended, color: 'bg-yellow-50 text-yellow-700' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-3 text-center border border-gray-200 ${s.color}`}>
              <div className="text-2xl font-bold">{s.val}</div>
              <div className="text-xs font-medium mt-0.5 opacity-70">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari lisensi, nama, nomor HP..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="trial">Trial</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
        <button onClick={fetchLicenses} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <RefreshCw size={14} className="text-gray-500" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <RefreshCw size={22} className="animate-spin text-green-500" />
          </div>
        ) : licenses.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Key size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Belum ada lisensi</p>
            <p className="text-sm mt-1">Klik "Buat Lisensi" untuk membuat lisensi pertama</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">License Key</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Produk</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Plan</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Aktivasi</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Expired</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map(lic => (
                  <tr key={lic.license_key} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded font-semibold text-gray-800">
                        {lic.license_key}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{lic.customer_name || '-'}</div>
                      {lic.customer_phone && (
                        <div className="text-xs text-gray-400 font-mono">{lic.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{lic.product_code}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-gray-600 uppercase">{lic.plan_name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-gray-800">
                        {lic.activations_used ?? 0}
                        <span className="text-gray-400 font-normal"> / {lic.max_activations ?? 1}</span>
                      </div>
                      <div className="w-16 bg-gray-100 rounded-full h-1 mt-1">
                        <div
                          className={`h-1 rounded-full ${(lic.activations_used ?? 0) >= (lic.max_activations ?? 1) ? 'bg-red-400' : 'bg-green-400'}`}
                          style={{ width: `${Math.min(100, ((lic.activations_used ?? 0) / (lic.max_activations ?? 1)) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={lic.status} />
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString('id-ID') : '∞'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleSendWaha(lic.license_key)}
                          disabled={sendingWaha === lic.license_key}
                          title="Kirim via WhatsApp"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors disabled:opacity-50"
                        >
                          {sendingWaha === lic.license_key
                            ? <RefreshCw size={14} className="animate-spin" />
                            : <MessageSquare size={14} />}
                        </button>
                        <button
                          onClick={() => setEditModal(lic)}
                          title="Edit"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        {lic.status === 'suspended' ? (
                          <button
                            onClick={() => handleStatusQuick(lic.license_key, 'active')}
                            title="Aktifkan"
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                          >
                            <CheckCircle size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusQuick(lic.license_key, 'suspended')}
                            title="Suspend"
                            className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600 transition-colors"
                          >
                            <AlertCircle size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirm(lic)}
                          title="Hapus"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">{total} lisensi total</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm text-gray-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Buat Lisensi Baru">
        <LicenseForm onSubmit={handleCreate} onClose={() => setCreateModal(false)} loading={formLoading} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Lisensi">
        {editModal && (
          <LicenseForm
            initial={editModal}
            onSubmit={handleEdit}
            onClose={() => setEditModal(null)}
            loading={formLoading}
          />
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Hapus Lisensi">
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Yakin ingin menghapus lisensi <strong className="font-mono">{deleteConfirm.license_key}</strong>?
              {deleteConfirm.customer_name && ` (${deleteConfirm.customer_name})`}
            </p>
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Batal</Button>
              <Button
                onClick={() => handleDelete(deleteConfirm.license_key)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 size={14} className="mr-1" /> Hapus
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
