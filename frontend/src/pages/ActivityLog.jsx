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

const ActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [actData, usersData] = await Promise.all([
        getAllUserActivity(null, 200),
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

  const filtered = activities.filter(a => !filterUser || a.userId === filterUser);

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
                {filtered.map((item, i) => (
                  <ActivityRow key={i} item={item} />
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
      </div>
    </div>
  );
};

export default ActivityLog;
