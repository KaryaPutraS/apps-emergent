import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import {
  getUsers, getUserStats, createUser, updateUser, deleteUser, toggleUser,
  regenerateWebhookToken,
  createChatbotLicense, getUserLatestLicense, sendLicenseWaha,
} from '../api/apiClient';
import { toast } from 'sonner';
import {
  UserCog, UserPlus, Pencil, Trash2,
  ShieldCheck, Users, UserCheck, UserX, Eye, EyeOff, X, Save,
  RefreshCw, Search, Crown, Briefcase, Link, Copy, RotateCw, Send, Key,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const ROLE_CONFIG = {
  superadmin: {
    label: 'Super Admin',
    icon: Crown,
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    desc: 'Hanya mengelola user — tidak punya akses ke fitur adminpintar.id',
  },
  user: {
    label: 'User',
    icon: Briefcase,
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    desc: 'Akses penuh ke semua fitur adminpintar.id',
  },
};

const EMPTY_FORM = {
  username: '',
  fullName: '',
  email: '',
  role: 'user',
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
      ? { ...user, isActive: user.isActive ?? user.is_active ?? true, password: '', confirmPassword: '' }
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
    if (form.password && form.password.length < 12) e.password = 'Password minimal 12 karakter';
    if (form.password && form.password.length >= 12) {
      const hasLetter = /[A-Za-z]/.test(form.password);
      const hasDigit = /\d/.test(form.password);
      const hasSpecial = /[^A-Za-z0-9]/.test(form.password);
      const categories = [hasLetter, hasDigit, hasSpecial].filter(Boolean).length;
      if (categories < 2) e.password = 'Gunakan minimal 2 dari: huruf, angka, simbol';
    }
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
        onSaved({ created: false });
      } else {
        const res = await createUser({
          username: form.username.trim().toLowerCase(),
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password,
          isActive: form.isActive,
        });
        toast.success('User baru berhasil dibuat');
        onSaved({ created: true, user: res?.user, password: form.password });
      }
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
                placeholder={isEdit ? 'Biarkan kosong jika tidak diubah' : 'Min. 12 karakter, huruf+angka/simbol'}
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
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
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

// ──────────────────────────────────────────────────────────────────────────
// LICENSE POPUP — appears right after user is created
// ──────────────────────────────────────────────────────────────────────────
const LicenseAfterUserModal = ({ user, password, onClose, onDone }) => {
  const [form, setForm] = useState({
    product_code: 'adminpintar_chatbot',
    customer_name: user?.fullName || user?.username || '',
    customer_phone: '',
    customer_email: user?.email || '',
    plan_name: 'standard',
    max_activations: 1,
    expires_at: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState(null); // { license_key, ... }
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.product_code.trim()) { toast.error('Kode produk wajib diisi'); return; }
    setSaving(true);
    try {
      const res = await createChatbotLicense({ ...form, user_id: user.id });
      toast.success(`Lisensi dibuat: ${res.license_key}`);
      setCreated(res);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat lisensi');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!form.customer_phone.trim()) { toast.error('Nomor HP customer kosong, tidak bisa kirim'); return; }
    setSending(true);
    try {
      await sendLicenseWaha(created.license_key, {
        username: user.username,
        password,
        template_key: 'account_message_template',
      });
      toast.success('Pesan akun & lisensi terkirim via WhatsApp');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengirim WhatsApp');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Key className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{created ? 'Lisensi Berhasil Dibuat' : 'Buat Lisensi untuk User Baru'}</h3>
              <p className="text-xs text-slate-500">User: @{user.username}</p>
            </div>
          </div>
          <button onClick={onDone} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {!created ? (
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Kode Produk <span className="text-red-500">*</span></label>
              <Input value={form.product_code} onChange={e => set('product_code', e.target.value)} className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Nama Customer</label>
                <Input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} className="h-10" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">No. WhatsApp <span className="text-red-500">*</span></label>
                <Input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} placeholder="08123456789" className="h-10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Plan</label>
                <select value={form.plan_name} onChange={e => set('plan_name', e.target.value)}
                  className="w-full border border-slate-200 rounded-md h-10 px-3 text-sm">
                  <option value="standard">Standard</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="trial">Trial</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Tanggal Expired</label>
                <Input type="date" value={form.expires_at ? form.expires_at.slice(0, 10) : ''}
                  onChange={e => set('expires_at', e.target.value)} className="h-10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Maks. Aktivasi</label>
                <Input type="number" min={1} value={form.max_activations}
                  onChange={e => set('max_activations', parseInt(e.target.value) || 1)} className="h-10" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Email Customer</label>
                <Input value={form.customer_email} onChange={e => set('customer_email', e.target.value)} className="h-10" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Catatan</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onDone} className="flex-1">Lewati</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                {saving ? 'Menyimpan...' : 'Buat Lisensi'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs text-emerald-700 mb-1">License Key</p>
              <p className="font-mono font-bold text-emerald-900">{created.license_key}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1 text-sm">
              <p><span className="text-slate-500">Username:</span> <span className="font-mono">{user.username}</span></p>
              <p><span className="text-slate-500">Password:</span> <span className="font-mono">{password || '(tidak diketahui)'}</span></p>
              <p><span className="text-slate-500">No. WA:</span> <span className="font-mono">{form.customer_phone || '-'}</span></p>
            </div>
            <p className="text-xs text-slate-500">
              Pesan akun (username + password) & lisensi akan dikirim ke nomor WA customer menggunakan WAHA yang dikonfigurasi di menu Konfigurasi WAHA. Template pesan dapat diatur di sana.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onDone} className="flex-1">Tutup</Button>
              <Button onClick={handleSend} disabled={sending || !form.customer_phone}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                {sending ? 'Mengirim...' : 'Kirim ke User via WhatsApp'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// SEND-TO-USER MODAL — per-row "Kirim ke User" action
// ──────────────────────────────────────────────────────────────────────────
const SendToUserModal = ({ user, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [license, setLicense] = useState(null);
  const [password, setPassword] = useState('');
  const [resetPassword, setResetPassword] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getUserLatestLicense(user.id);
        if (!alive) return;
        if (data.found) setLicense(data.data);
        else setLicense(null);
      } catch (err) {
        toast.error('Gagal memuat lisensi user');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user.id]);

  const handleSend = async () => {
    if (!license) return;
    if (!license.customer_phone) { toast.error('Lisensi belum ada nomor HP customer'); return; }
    setSending(true);
    try {
      if (resetPassword && password) {
        await updateUser(user.id, { password });
      }
      await sendLicenseWaha(license.license_key, {
        username: user.username,
        password: resetPassword && password ? password : '',
        template_key: 'account_message_template',
      });
      toast.success('Pesan terkirim ke user');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Send className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Kirim ke User</h3>
              <p className="text-xs text-slate-500">@{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-emerald-500" /></div>
          ) : !license ? (
            <div className="text-center py-6">
              <Key className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">User belum punya lisensi</p>
              <p className="text-xs text-slate-500 mt-1">Buat lisensi terlebih dulu di menu ChatBot Lisensi atau saat membuat user baru.</p>
            </div>
          ) : (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm space-y-1">
                <p className="text-xs text-emerald-700">License Key</p>
                <p className="font-mono font-bold text-emerald-900">{license.license_key}</p>
                <p className="text-xs text-emerald-700 mt-2">
                  Plan: <strong>{license.plan_name}</strong> · Tujuan WA: <strong className="font-mono">{license.customer_phone || '(belum diisi)'}</strong>
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                Password user tersimpan ter-hash & tidak bisa dibaca. Centang opsi di bawah untuk reset password dan menyertakannya ke pesan.
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={resetPassword} onChange={e => setResetPassword(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600" />
                <span className="text-sm text-slate-700">Reset password user & sertakan dalam pesan</span>
              </label>

              {resetPassword && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Password Baru</label>
                  <div className="relative">
                    <Input type={showPwd ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 12 karakter" className="h-10 pr-10" />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={onClose} className="flex-1">Batal</Button>
                <Button onClick={handleSend}
                  disabled={sending || !license.customer_phone || (resetPassword && password.length < 12)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  {sending ? 'Mengirim...' : 'Kirim Sekarang'}
                </Button>
              </div>
            </>
          )}
        </div>
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
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [pendingLicense, setPendingLicense] = useState(null); // { user, password }
  const [sendUser, setSendUser] = useState(null); // user object

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
  const handleSaved = (meta) => {
    closeModal();
    load();
    if (meta?.created && meta.user) {
      setPendingLicense({ user: meta.user, password: meta.password });
    }
  };

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

  const handleRegenerateToken = async (u) => {
    if (!window.confirm(`Regenerate webhook token untuk "${u.username}"? Token lama akan tidak berlaku.`)) return;
    setRegeneratingId(u.id);
    try {
      const res = await regenerateWebhookToken(u.id);
      toast.success('Webhook token berhasil diperbarui');
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, webhookToken: res.webhookToken } : x));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal regenerate token');
    } finally {
      setRegeneratingId(null);
    }
  };

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const webhookBase = `${window.location.protocol}//${window.location.host}/webhook/`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola User</h1>
          <p className="text-sm text-slate-500 mt-1">Manajemen akun pengguna dan hak akses sistem</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openAdd} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
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
          <StatCard icon={ShieldCheck} label="Super Admin" value={stats.superadmins || stats.admins || 0} color="bg-purple-100 text-purple-600" />
          <StatCard icon={UserX} label="Nonaktif" value={stats.inactive} color="bg-red-100 text-red-600" />
        </div>
      )}

      {/* Role legend */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Hak Akses Per Role</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* User Table */}
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Webhook URL</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Login Terakhir</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => {
                  const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.user;
                  const RoleIcon = roleCfg.icon;
                  const isSelf = u.id === currentUser?.userId || u.username === currentUser?.username;
                  return (
                    <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${isSelf ? 'bg-emerald-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            u.role === 'superadmin' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-blue-100 text-blue-700'
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
                      <td className="px-4 py-3 hidden md:table-cell">
                        {u.webhookToken ? (
                          <div className="flex items-center gap-1.5">
                            <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 max-w-[140px] truncate block">
                              {webhookBase}{u.webhookToken}
                            </code>
                            <button onClick={() => { navigator.clipboard.writeText(`${webhookBase}${u.webhookToken}`); toast.success('URL disalin'); }}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0" title="Salin URL">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                        {u.lastLogin || <span className="text-slate-300">Belum pernah</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          (u.isActive ?? u.is_active)
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${(u.isActive ?? u.is_active) ? 'bg-green-500' : 'bg-red-400'}`} />
                          {(u.isActive ?? u.is_active) ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle aktif/nonaktif */}
                          <button
                            onClick={() => handleToggle(u)}
                            disabled={togglingId === u.id || isSelf}
                            title={isSelf ? 'Tidak bisa menonaktifkan akun sendiri' : (u.isActive ?? u.is_active) ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                              isSelf
                                ? 'opacity-30 cursor-not-allowed bg-slate-300'
                                : (u.isActive ?? u.is_active)
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-300'
                            }`}
                          >
                            {togglingId === u.id ? (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin block" />
                              </span>
                            ) : (
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(u.isActive ?? u.is_active) ? 'translate-x-5' : 'translate-x-0'}`} />
                            )}
                          </button>

                          {/* Regenerate Token */}
                          <button
                            onClick={() => handleRegenerateToken(u)}
                            disabled={regeneratingId === u.id}
                            title="Regenerate webhook token"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                          >
                            {regeneratingId === u.id
                              ? <span className="w-4 h-4 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin block" />
                              : <RotateCw className="w-4 h-4" />
                            }
                          </button>

                          {/* Kirim ke User (akun + lisensi via WAHA) */}
                          <button
                            onClick={() => setSendUser(u)}
                            title="Kirim akun & lisensi ke user via WhatsApp"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <Send className="w-4 h-4" />
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

      {/* Popup buat lisensi setelah user dibuat */}
      {pendingLicense && (
        <LicenseAfterUserModal
          user={pendingLicense.user}
          password={pendingLicense.password}
          onClose={() => setPendingLicense(null)}
          onDone={() => setPendingLicense(null)}
        />
      )}

      {/* Modal kirim akun + lisensi ke user via WAHA */}
      {sendUser && (
        <SendToUserModal user={sendUser} onClose={() => setSendUser(null)} />
      )}
    </div>
  );
};

export default UserManagement;
