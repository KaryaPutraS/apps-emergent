import React, { useState, useEffect } from 'react';
import { getDashboardStats, getDashboardChart } from '../api/apiClient';
import { useApp } from '../App';
import {
  MessageSquare, Users, GitBranch, Brain, Zap, Clock, TrendingUp, Activity,
  Sparkles, Plus, BookOpen, Radio, RefreshCw, Play, Database,
  UserCheck, UserCog, Crown, Briefcase, Eye as EyeIcon, Trophy, ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const ROLE_LABEL = {
  superadmin: { label: 'Super Admin', icon: Crown, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  user: { label: 'User', icon: Briefcase, color: 'text-blue-600 bg-blue-50 border-blue-200' },
};

const StatCard = ({ icon: Icon, label, value, trend, color }) => {
  const iconColors = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-violet-100 text-violet-600',
    orange: 'bg-amber-100 text-amber-600',
    teal: 'bg-teal-100 text-teal-600',
    rose: 'bg-rose-100 text-rose-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColors[color] || iconColors.emerald}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const MiniChart = ({ data }) => {
  if (!data || data.length === 0) return <div className="text-center py-8 text-slate-400 text-sm">Belum ada data</div>;
  const max = Math.max(...data.map(d => Math.max(d.messagesIn || 0, d.messagesOut || 0)), 1);
  return (
    <div className="flex items-end gap-1.5 h-32 mt-4">
      {data.map((d, i) => {
        const height = ((d.messagesIn || 0) / max) * 100;
        const heightOut = ((d.messagesOut || 0) / max) * 100;
        const day = new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' });
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex gap-0.5 items-end" style={{ height: '100px' }}>
              <div className="flex-1 bg-emerald-400 rounded-t-md transition-all duration-500 hover:bg-emerald-500" style={{ height: `${height}%` }} title={`Masuk: ${d.messagesIn}`} />
              <div className="flex-1 bg-teal-300 rounded-t-md transition-all duration-500 hover:bg-teal-400" style={{ height: `${heightOut}%` }} title={`Keluar: ${d.messagesOut}`} />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{day}</span>
          </div>
        );
      })}
    </div>
  );
};

const Dashboard = () => {
  const { setActiveTab, currentUser } = useApp();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  const role = currentUser?.role || 'user';
  const isSuperAdmin = role === 'superadmin';
  const roleCfg = ROLE_LABEL[role] || ROLE_LABEL.user;
  const RoleIcon = roleCfg.icon;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [s, c] = await Promise.all([getDashboardStats(), getDashboardChart()]);
      setStats(s);
      setChartData(c);
    } catch (e) {
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading || !stats) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with user greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Halo, {currentUser?.fullName || currentUser?.username || 'Admin'} 👋
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 text-sm">Ringkasan aktivitas adminpintar.id Anda</p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${roleCfg.color}`}>
              <RoleIcon className="w-3 h-3" />
              {roleCfg.label}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchData(); toast.success('Data diperbarui!'); }} className="gap-2 self-start sm:self-auto">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="Total Pesan" value={(stats.totalMessages || 0).toLocaleString()} color="emerald" />
        <StatCard icon={Users} label="Total Kontak" value={stats.totalContacts || 0} color="blue" />
        <StatCard icon={GitBranch} label="Rules Aktif" value={stats.activeRules || 0} color="purple" />
        <StatCard icon={Brain} label="AI Calls" value={stats.aiCalls || 0} trend={`${(stats.tokensUsed || 0).toLocaleString()} tokens`} color="orange" />
      </div>

      {/* Response breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ArrowDownLeft} label="Pesan Masuk" value={(stats.incomingCount || 0).toLocaleString()} color="teal" />
        <StatCard icon={ArrowUpRight} label="Pesan Keluar" value={(stats.outgoingCount || 0).toLocaleString()} color="blue" />
        <StatCard icon={GitBranch} label="Jawab via Rule" value={(stats.ruleCalls || 0).toLocaleString()} color="purple" />
        <StatCard icon={Sparkles} label="Jawab AI+Rule" value={(stats.comboCalls || 0).toLocaleString()} trend={`${stats.aiCalls || 0} murni AI`} color="rose" />
      </div>

      {/* User stats — hanya tampil untuk admin */}
      {isSuperAdmin && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-emerald-200" />
              <h3 className="font-semibold">Statistik User</h3>
            </div>
            <button
              onClick={() => setActiveTab('user-management')}
              className="text-xs font-medium text-emerald-200 hover:text-white transition-colors underline underline-offset-2"
            >
              Kelola User →
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold">{stats.totalUsers || 0}</p>
              <p className="text-xs text-emerald-200 mt-1">Total User</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-300">{stats.activeUsers || 0}</p>
              <p className="text-xs text-emerald-200 mt-1">User Aktif</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-amber-300">{(stats.totalUsers || 0) - (stats.activeUsers || 0)}</p>
              <p className="text-xs text-emerald-200 mt-1">Nonaktif</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Aktivitas 7 Hari Terakhir
            </h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Masuk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-300" /> Keluar</span>
            </div>
          </div>
          <MiniChart data={chartData} />
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-emerald-500" /> Status Sistem
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Bot Status</span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {stats.botActive ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Uptime</span>
              <span className="text-sm font-medium text-slate-700">{stats.uptime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Avg Response</span>
              <span className="text-sm font-medium text-slate-700">{stats.avgResponseTime}</span>
            </div>
            {isSuperAdmin && (
              <>
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Total User</span>
                    <span className="text-sm font-medium text-slate-700">{stats.totalUsers || 0} akun</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">User Aktif</span>
                  <span className="text-sm font-medium text-emerald-600">{stats.activeUsers || 0} aktif</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top Rules */}
      {stats.topRules && stats.topRules.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" /> Top 5 Rules Terpopuler
          </h3>
          <div className="space-y-3">
            {stats.topRules.map((r, i) => {
              const max = stats.topRules[0]?.hitCount || 1;
              const pct = Math.round(((r.hitCount || 0) / max) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate">{r.name || r.keyword || '—'}</span>
                      <span className="text-xs text-slate-500 ml-2 shrink-0">{(r.hitCount || 0).toLocaleString()}×</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-emerald-500" /> Quick Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setActiveTab('ai-setup')} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-9">
            <Sparkles className="w-4 h-4" /> Setup Data dengan AI
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('rules')} className="gap-2 h-9">
            <Plus className="w-4 h-4" /> Tambah Rule
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('knowledge')} className="gap-2 h-9">
            <BookOpen className="w-4 h-4" /> Knowledge Base
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('broadcast')} className="gap-2 h-9">
            <Radio className="w-4 h-4" /> Broadcast
          </Button>
          <Button variant="ghost" onClick={() => setActiveTab('test-center')} className="gap-2 h-9">
            <Play className="w-4 h-4" /> Test Koneksi
          </Button>
          {isSuperAdmin && (
            <Button variant="ghost" onClick={() => setActiveTab('user-management')} className="gap-2 h-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
              <UserCog className="w-4 h-4" /> Kelola User
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
