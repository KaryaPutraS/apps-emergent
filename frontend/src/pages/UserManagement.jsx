import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import {
  getUsers, getUserStats, createUser, updateUser, deleteUser, toggleUser
} from '../api/apiClient';
import { toast } from 'sonner';
import {
  UserCog, UserPlus, Pencil, Trash2, ToggleLeft, ToggleRight,
  ShieldCheck, Users, UserCheck, UserX, Eye, EyeOff, X, Save,
  RefreshCw, Search, Crown, Briefcase
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const ROLE_CONFIG = {
  admin: {
    label: 'Admin',
    icon: Crown,
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    desc: 'Akses penuh ke semua fitur termasuk kelola user',
  },
  operator: {
    label: 'Operator',
    icon: Briefcase,
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    desc: 'Akses ke fitur chatbot, kontak, pesan, dan broadcast',
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    desc: 'Hanya bisa melihat dashboard, log, dan statistik',
  },
};

const EMPTY_FORM = {
  username: '',
  fullName: '',
  email: '',
  role: 'operator',
  password: '',
  confirmPassword: '',
  isActive: true,
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  </div>
);

const UserModal = ({ user, onClose, onSaved, currentUserId }) => {
  const isEdit = !!user;
  const [form, setForm] = useState(
    isEdit
      ? { ...user, password: '', confirmPassword: '' }
      : { ...EMPTY_FORM }
  );
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = 'Username wajib diisi';
    if (!form.fullName.trim()) e.fullName = 'Nama lengkap wajib diisi';
    if (!isEdit && !form.password) e.password = 'Password wajib diisi';
    if (form.password && form.password.length < 8) e.password = 'Password minimal 8 karakter';
    if (form.password && form.password !== form.confirmPassword) e.confirmPassword = 'Konfirmasi password tidak cocok';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      if (isEdit) {
        const payload = {
          fullName: form.fullName,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
        };
        if (form.password) payload.password = form.password;
        await updateUser(user.id, payload);
        toast.success('User berhasil diperbarui');
      } else {
        await createUser({
          username: form.username.trim().toLowerCase(),
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password,
          isActive: form.isActive,
        });
        toast.success('User baru berhasil dibuat');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan user');
    } finally {
      setSaving(false);
    }
  };

  const f = (key) => ({
    value: form[key],
    onChange: (e) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }));
      setErrors(prev => ({ ...prev, [key]: undefined }));
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              {isEdit ? <Pencil className="w-4 h-4 text-emerald-600" /> : <UserPlus className="w-4 h-4 text-emerald-600" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{isEdit ? 'Edit User' : 'Tambah User Baru'}</h3>
              <p className="text-xs text-slate-500">{isEdit ? `Mengedit: ${user.username}` : 'Buat akun user baru'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Username */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Username</label>
            <Input
              {...f('username')}
              disabled={isEdit}
              placeholder="contoh: john_doe"
              className={`h-10 ${errors.username ? 'border-red-400' : ''} ${isEdit ? 'bg-slate-50 text-slate-500' : ''}`}
            />
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
            {isEdit && <p className="text-xs text-slate-400 mt-1">Username tidak bisa diubah</p>}
          </div>

          {/* Full Name */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Nama Lengkap</label>
            <Input
              {...f('fullName')}
              placeholder="contoh: John Doe"
              className={`h-10 ${errors.fullName ? 'border-red-400' : ''}`}
            />
            {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Email <span className="text-slate-400">(opsional)</span></label>
            <Input
              {...f('email')}
              type="email"
              placeholder="contoh: john@example.com"
              className="h-10"
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, role: key }))}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      form.role === key
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${form.role === key ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={`text-xs font-semibold ${form.role === key ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">{ROLE_CONFIG[form.role]?.desc}</p>
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              {isEdit ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                {...f('password')}
                placeholder={isEdit ? 'Biarkan kosong jika tidak diubah' : 'Min. 8 karakter'}
                className={`h-10 pr-10 ${errors.password ? 'border-red-400' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          {form.password && (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Konfirmasi Password</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                {...f('confirmPassword')}
                placeholder="Ulangi password"
                className={`h-10 ${errors.confirmPassword ? 'border-red-400' : ''}`}
              />
              {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-slate-700">Status Akun</p>
              <p className="text-xs text-slate-500">{form.isActive ? 'Aktif — user dapat login' : 'Nonaktif — user tidak dapat login'}</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Batal
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Menyimpan...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {isEdit ? 'Simpan Perubahan' : 'Buat User'}
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UserManagement = () => {
  const { currentUser } = useApp();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalUser, setModalUser] = useState(undefined);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([getUsers(), getUserStats()]);
      setUsers(usersData);
      setStats(statsData);
    } catch (err) {
      toast.error('Gagal memuat data user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setModalUser(null); setShowModal(true); };
  const openEdit = (u) => { setModalUser(u); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setModalUser(undefined); };
  const handleSaved = () => { closeModal(); load(); };

  const handleToggle = async (u) => {
    setTogglingId(u.id);
    try {
      const res = await toggleUser(u.id);
      toast.success(`User '${u.username}' ${res.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengubah status user');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Hapus user "${u.username}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeletingId(u.id);
    try {
      await deleteUser(u.id);
      toast.success(`User '${u.username}' berhasil dihapus`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus user');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola User</h1>
          <p className="text-sm text-slate-500 mt-1">Manajemen akun pengguna dan hak akses sistem</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={load}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={openAdd}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <UserPlus className="w-4 h-4" />
            Tambah User
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total User" value={stats.total} color="bg-slate-100 text-slate-600" />
          <StatCard icon={UserCheck} label="Aktif" value={stats.active} color="bg-emerald-100 text-emerald-600" />
          <StatCard icon={ShieldCheck} label="Admin" value={stats.admins} color="bg-purple-100 text-purple-600" />
          <StatCard icon={UserX} label="Nonaktif" value={stats.inactive} color="bg-red-100 text-red-600" />
        </div>
      )}

      {/* Role legend */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Hak Akses Per Role</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div key={key} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.badgeClass}`}>
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold">{cfg.label}</p>
                  <p className="text-xs opacity-75 mt-0.5">{cfg.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search + Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari username, nama, email..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          <span className="text-xs text-slate-500">{filtered.length} user ditemukan</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <UserCog className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Tidak ada user ditemukan</p>
            <p className="text-slate-400 text-sm mt-1">
              {search ? 'Coba ubah kata kunci pencarian' : 'Tambahkan user pertama Anda'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Login Terakhir</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => {
                  const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.viewer;
                  const RoleIcon = roleCfg.icon;
                  const isSelf = u.id === currentUser?.userId || u.username === currentUser?.username;
                  return (
                    <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${isSelf ? 'bg-emerald-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            u.role === 'admin' ? 'bg-emerald-100 text-emerald-700' :
                            u.role === 'operator' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {(u.fullName || u.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {u.fullName || u.username}
                              {isSelf && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-semibold">Anda</span>}
                            </p>
                            <p className="text-xs text-slate-400">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleCfg.badgeClass}`}>
                          <RoleIcon className="w-3 h-3" />
                          {roleCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                        {u.email || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                        {u.lastLogin || <span className="text-slate-300">Belum pernah</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-400'}`} />
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle */}
                          <button
                            onClick={() => handleToggle(u)}
                            disabled={togglingId === u.id || isSelf}
                            title={isSelf ? 'Tidak bisa menonaktifkan akun sendiri' : u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed'
                                : u.isActive
                                  ? 'text-amber-500 hover:bg-amber-50'
                                  : 'text-green-500 hover:bg-green-50'
                            }`}
                          >
                            {togglingId === u.id
                              ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin block" />
                              : u.isActive
                                ? <ToggleRight className="w-4 h-4" />
                                : <ToggleLeft className="w-4 h-4" />
                            }
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEdit(u)}
                            title="Edit user"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={deletingId === u.id || isSelf}
                            title={isSelf ? 'Tidak bisa menghapus akun sendiri' : 'Hapus user'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed text-slate-400'
                                : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                          >
                            {deletingId === u.id
                              ? <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin block" />
                              : <Trash2 className="w-4 h-4" />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <UserModal
          user={modalUser}
          onClose={closeModal}
          onSaved={handleSaved}
          currentUserId={currentUser?.userId}
        />
      )}
    </div>
  );
};

export default UserManagement;
