import React from 'react';
import { mockStats, mockChartData } from '../data/mockData';
import { useApp } from '../App';
import { 
  MessageSquare, Users, GitBranch, Brain, Zap, Clock, TrendingUp, Activity,
  Sparkles, Plus, BookOpen, Radio, RefreshCw, Play, Database
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const StatCard = ({ icon: Icon, label, value, trend, color }) => {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-violet-50 text-violet-600 border-violet-100',
    orange: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  const iconColors = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-violet-100 text-violet-600',
    orange: 'bg-amber-100 text-amber-600',
  };
  return (
    <div className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow duration-300 ${colors[color]} border-opacity-50`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const MiniChart = ({ data }) => {
  const max = Math.max(...data.map(d => d.messagesIn));
  return (
    <div className="flex items-end gap-1.5 h-32 mt-4">
      {data.map((d, i) => {
        const height = (d.messagesIn / max) * 100;
        const heightOut = (d.messagesOut / max) * 100;
        const day = new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' });
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex gap-0.5 items-end" style={{ height: '100px' }}>
              <div
                className="flex-1 bg-emerald-400 rounded-t-md transition-all duration-500 hover:bg-emerald-500"
                style={{ height: `${height}%`, animationDelay: `${i * 0.1}s` }}
                title={`Masuk: ${d.messagesIn}`}
              />
              <div
                className="flex-1 bg-teal-300 rounded-t-md transition-all duration-500 hover:bg-teal-400"
                style={{ height: `${heightOut}%` }}
                title={`Keluar: ${d.messagesOut}`}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{day}</span>
          </div>
        );
      })}
    </div>
  );
};

const Dashboard = () => {
  const { setActiveTab } = useApp();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Ringkasan aktivitas chatbot Anda</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.success('Data diperbarui!')} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="Total Pesan" value={mockStats.totalMessages.toLocaleString()} trend="+12% dari minggu lalu" color="emerald" />
        <StatCard icon={Users} label="Total Kontak" value={mockStats.totalContacts} trend="6 kontak baru" color="blue" />
        <StatCard icon={GitBranch} label="Rules Aktif" value={mockStats.activeRules} color="purple" />
        <StatCard icon={Brain} label="AI Calls" value={mockStats.aiCalls} trend={`${mockStats.tokensUsed.toLocaleString()} tokens`} color="orange" />
      </div>

      {/* Chart + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Aktivitas 7 Hari Terakhir
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Pesan masuk vs keluar</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Masuk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-300" /> Keluar</span>
            </div>
          </div>
          <MiniChart data={mockChartData} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-emerald-500" /> Status
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Bot Status</span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Aktif
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Uptime</span>
              <span className="text-sm font-medium text-slate-700">{mockStats.uptime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Avg Response</span>
              <span className="text-sm font-medium text-slate-700">{mockStats.avgResponseTime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Tokens Hari Ini</span>
              <span className="text-sm font-medium text-slate-700">3,245</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Lisensi</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium">Aktif</span>
            </div>
          </div>
        </div>
      </div>

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
            <Plus className="w-4 h-4" /> Tambah Rule Baru
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('knowledge')} className="gap-2 h-9">
            <BookOpen className="w-4 h-4" /> Knowledge Base
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('broadcast')} className="gap-2 h-9">
            <Radio className="w-4 h-4" /> Kirim Broadcast
          </Button>
          <Button variant="ghost" onClick={() => toast.success('Koneksi WAHA berhasil!')} className="gap-2 h-9">
            <Play className="w-4 h-4" /> Test Koneksi
          </Button>
          <Button variant="ghost" onClick={() => toast.success('Dashboard dihitung ulang!')} className="gap-2 h-9">
            <RefreshCw className="w-4 h-4" /> Hitung Ulang
          </Button>
          <Button variant="ghost" onClick={() => toast.success('Contoh data dimuat!')} className="gap-2 h-9">
            <Database className="w-4 h-4" /> Load Contoh Data
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Klik "Load Contoh Data" untuk mengisi rules, knowledge, dan template dengan contoh siap pakai.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
