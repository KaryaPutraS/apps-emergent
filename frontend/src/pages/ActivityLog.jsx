import React, { useState, useEffect, useCallback } from 'react';
import { getAllUserActivity, getUsers } from '../api/apiClient';
import { toast } from 'sonner';
import {
  Activity, LogIn, LogOut, Settings, GitBranch, BookOpen, Radio,
  RotateCw, UserPlus, Pencil, Trash2, ToggleRight, Link, Clock,
  RefreshCw, Filter
} from 'lucide-react';
import { Button } from '../components/ui/button';

const ACTION_CONFIG = {
  LOGIN:              { label: 'Login',            icon: LogIn,       color: 'text-emerald-600 bg-emerald-50' },
  LOGIN_FAILED:       { label: 'Login Gagal',      icon: LogIn,       color: 'text-red-600 bg-red-50' },
  LOGOUT:             { label: 'Logout',           icon: LogOut,      color: 'text-slate-600 bg-slate-100' },
  CONFIG_UPDATE:      { label: 'Update Config',    icon: Settings,    color: 'text-blue-600 bg-blue-50' },
  AI_AGENT_UPDATE:    { label: 'Update AI Agent',  icon: Settings,    color: 'text-purple-600 bg-purple-50' },
  RULE_CREATED:       { label: 'Buat Rule',        icon: GitBranch,   color: 'text-indigo-600 bg-indigo-50' },
  RULE_UPDATED:       { label: 'Edit Rule',        icon: GitBranch,   color: 'text-indigo-600 bg-indigo-50' },
  RULE_DELETED:       { label: 'Hapus Rule',       icon: GitBranch,   color: 'text-red-600 bg-red-50' },
  KNOWLEDGE_CREATED:  { label: 'Tambah Knowledge', icon: BookOpen,    color: 'text-teal-600 bg-teal-50' },
  KNOWLEDGE_UPDATED:  { label: 'Edit Knowledge',   icon: BookOpen,    color: 'text-teal-600 bg-teal-50' },
  KNOWLEDGE_DELETED:  { label: 'Hapus Knowledge',  icon: BookOpen,    color: 'text-red-600 bg-red-50' },
  BROADCAST_SENT:     { label: 'Broadcast',        icon: Radio,       color: 'text-amber-600 bg-amber-50' },
  TOKEN_REGENERATED:  { label: 'Regenerate Token', icon: RotateCw,    color: 'text-orange-600 bg-orange-50' },
  USER_CREATED:       { label: 'Buat User',        icon: UserPlus,    color: 'text-emerald-600 bg-emerald-50' },
  USER_UPDATED:       { label: 'Edit User',        icon: Pencil,      color: 'text-blue-600 bg-blue-50' },
  USER_DELETED:       { label: 'Hapus User',       icon: Trash2,      color: 'text-red-600 bg-red-50' },
  USER_TOGGLED:       { label: 'Toggle User',      icon: ToggleRight, color: 'text-amber-600 bg-amber-50' },
  WEBHOOK_RECEIVED:   { label: 'Webhook Masuk',    icon: Link,        color: 'text-cyan-600 bg-cyan-50' },
};

const ActivityRow = ({ item }) => {
  const cfg = ACTION_CONFIG[item.action] || { label: item.action, icon: Clock, color: 'text-slate-600 bg-slate-100' };
  const Icon = cfg.icon;
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{item.timestamp}</td>
      <td className="px-4 py-2.5">
        <span className="font-medium text-slate-700 text-sm">@{item.username}</span>
      </td>
      <td className="px-4 py-2.5">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
          <Icon className="w-3 h-3" />{cfg.label}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">{item.detail}</td>
    </tr>
  );
};

const PAGE_SIZE = 10;

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [actData, usersData] = await Promise.all([
        getAllUserActivity(null, 500),
        getUsers(),
      ]);
      setActivities(actData);
      setUsers(usersData);
    } catch {
      toast.error('Gagal memuat log aktivitas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filterUser]);

  const filtered = activities.filter(a => !filterUser || a.userId === filterUser);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  // Build compact page list with ellipsis (e.g. 1 … 4 5 6 … 12)
  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…');
      result.push(sorted[i]);
    }
    return result;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Log Aktivitas</h1>
          <p className="text-sm text-slate-500 mt-1">Riwayat aktivitas seluruh user di sistem</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2 w-fit">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filter + Tabel */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <Activity className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-slate-800 text-sm">
            {filtered.length} aktivitas{filterUser ? ' (difilter)' : ''}
            {filtered.length > PAGE_SIZE && (
              <span className="ml-2 font-normal text-slate-400">
                · halaman {currentPage}/{totalPages}
              </span>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">Semua User</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>@{u.username}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Waktu</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((item, i) => (
                  <ActivityRow key={pageStart + i} item={item} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400 text-sm">
                      Belum ada aktivitas tercatat
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-500">
              Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} dari {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ Prev
              </button>
              {pageNumbers.map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} className="px-1.5 text-slate-400 text-xs">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[28px] h-7 px-2 text-xs rounded-lg border transition-colors ${
                      p === currentPage
                        ? 'bg-emerald-600 border-emerald-600 text-white font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
