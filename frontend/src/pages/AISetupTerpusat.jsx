import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, Save, RefreshCw, TrendingUp, Zap, AlertCircle, CheckCircle,
  BarChart2, Users, Activity, ShieldAlert
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Button } from '../components/ui/button';
import apiClient from '../api/apiClient';

const PROVIDERS = ['GEMINI', 'OPENAI', 'DEEPSEEK', 'GROQ', 'OPENROUTER', 'OLLAMA'];

const PROVIDER_MODELS = {
  GEMINI: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'],
  OPENAI: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  DEEPSEEK: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
  GROQ: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  OPENROUTER: ['openai/gpt-4o-mini', 'anthropic/claude-3-haiku', 'meta-llama/llama-3.1-8b-instruct:free'],
  OLLAMA: ['llama3.2', 'llama3.1', 'mistral', 'phi3', 'qwen2.5'],
};

const PROVIDER_COLORS = {
  GEMINI: '#4285F4', OPENAI: '#10B981', DEEPSEEK: '#8B5CF6',
  GROQ: '#F59E0B', OPENROUTER: '#EF4444', OLLAMA: '#6B7280',
};

function StatCard({ label, value, sub, icon: Icon, color = 'blue', warning }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <div className={`bg-white border rounded-xl p-4 ${warning ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon size={16} />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
        {warning && <ShieldAlert size={14} className="text-red-500 ml-auto" />}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-300">
      <Icon size={32} className="mb-2 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function SectionCard({ title, icon: Icon, iconColor = 'text-blue-500', children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Icon size={15} className={iconColor} />
        {title}
      </h3>
      {children}
    </div>
  );
}

function ProviderConfig({ prefix, values, onChange }) {
  const provider = values[`${prefix}provider`] || 'GEMINI';
  const models = PROVIDER_MODELS[provider] || [];
  const needsBaseUrl = ['OLLAMA', 'OPENROUTER'].includes(provider);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
          <select
            value={provider}
            onChange={e => {
              const p = e.target.value;
              onChange(`${prefix}provider`, p);
              onChange(`${prefix}model`, PROVIDER_MODELS[p]?.[0] || '');
            }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
          <input
            list={`${prefix}models`}
            value={values[`${prefix}model`] || ''}
            onChange={e => onChange(`${prefix}model`, e.target.value)}
            placeholder="Ketik atau pilih model..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id={`${prefix}models`}>
            {models.map(m => <option key={m} value={m} />)}
          </datalist>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
        <input
          type="password"
          value={values[`${prefix}api_key`] || ''}
          onChange={e => onChange(`${prefix}api_key`, e.target.value)}
          placeholder="sk-... atau API key lainnya"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {needsBaseUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Base URL {provider === 'OLLAMA' ? '(wajib)' : '(opsional)'}
          </label>
          <input
            type="text"
            value={values[`${prefix}base_url`] || ''}
            onChange={e => onChange(`${prefix}base_url`, e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
};

export default function AISetupTerpusat() {
  const [settings, setSettings] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [usageDays, setUsageDays] = useState(30);
  const [activeTab, setActiveTab] = useState('config');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/superadmin/ai-setup');
      setSettings(data);
    } catch (e) {
      showToast(e.response?.data?.detail || 'Gagal memuat pengaturan AI', 'error');
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const { data } = await apiClient.get(`/superadmin/ai-usage?days=${usageDays}`);
      setUsage(data);
    } catch (e) {
      showToast(e.response?.data?.detail || 'Gagal memuat statistik', 'error');
    } finally {
      setUsageLoading(false);
    }
  }, [usageDays]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSettings(), fetchUsage()]).finally(() => setLoading(false));
  }, [fetchSettings, fetchUsage]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/superadmin/ai-setup', settings);
      showToast('Pengaturan AI terpusat berhasil disimpan.');
    } catch (e) {
      showToast(e.response?.data?.detail || 'Gagal menyimpan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fmt = n => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  // Build user_id → username map for recent logs lookup
  const userMap = {};
  (usage?.per_user || []).forEach(u => {
    if (u.user_id && u.username) userMap[u.user_id] = u.username;
  });

  const todayTokens = usage?.today?.tokens || 0;
  const dailyLimit = settings?.daily_token_limit || 50000;
  const limitPct = Math.min(100, Math.round((todayTokens / dailyLimit) * 100));
  const isNearLimit = limitPct >= 80;

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Bot size={22} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI Setup Terpusat</h1>
            <p className="text-sm text-gray-500">Kelola konfigurasi AI untuk semua akun</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          Simpan
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[{ id: 'config', label: 'Konfigurasi' }, { id: 'usage', label: 'Monitoring Token' }].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── KONFIGURASI TAB ─── */}
      {activeTab === 'config' && settings && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap size={16} className="text-blue-500" />
              API Utama
            </h2>
            <ProviderConfig prefix="" values={settings} onChange={handleChange} />
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                <input
                  type="number" step="0.1" min="0" max="2"
                  value={settings.temperature ?? 0.2}
                  onChange={e => handleChange('temperature', parseFloat(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                <input
                  type="number" min="100" max="32000"
                  value={settings.max_tokens ?? 1200}
                  onChange={e => handleChange('max_tokens', parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limit Token Harian</label>
                <input
                  type="number" min="1000"
                  value={settings.daily_token_limit ?? 50000}
                  onChange={e => handleChange('daily_token_limit', parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <RefreshCw size={16} className="text-orange-500" />
                API Cadangan (Fallback)
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => handleChange('fallback_enabled', !settings.fallback_enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${settings.fallback_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.fallback_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-600">{settings.fallback_enabled ? 'Aktif' : 'Nonaktif'}</span>
              </label>
            </div>
            {settings.fallback_enabled
              ? <ProviderConfig prefix="fallback_" values={settings} onChange={handleChange} />
              : <p className="text-sm text-gray-400">Aktifkan API cadangan agar AI tetap berjalan saat API utama mengalami masalah.</p>
            }
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <strong>Cara kerja:</strong> Sistem akan memakai API utama. Jika gagal/limit, otomatis beralih ke API cadangan.
            API key tersimpan aman di server dan tidak pernah dikirim ke browser user.
          </div>
        </div>
      )}

      {/* ─── MONITORING TOKEN TAB ─── */}
      {activeTab === 'usage' && (
        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Periode:</span>
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setUsageDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${usageDays === d ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}
              >
                {d} hari
              </button>
            ))}
            <button
              onClick={fetchUsage}
              disabled={usageLoading}
              className="ml-auto p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={`text-gray-500 ${usageLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {usage && (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Token Hari Ini"
                  value={fmt(todayTokens)}
                  sub={`${limitPct}% dari limit ${fmt(dailyLimit)}`}
                  icon={TrendingUp}
                  color={isNearLimit ? 'red' : 'blue'}
                  warning={isNearLimit}
                />
                <StatCard label="Request Hari Ini" value={fmt(usage.today?.requests)} icon={BarChart2} color="green" />
                <StatCard label={`Total Token ${usageDays}d`} value={fmt(usage.summary?.total_tokens)} icon={Zap} color="purple" />
                <StatCard label={`Total Request ${usageDays}d`} value={fmt(usage.summary?.total_requests)} icon={Bot} color="orange" />
              </div>

              {/* Daily limit progress bar */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Penggunaan Token Hari Ini</span>
                  <span className={`text-sm font-semibold ${isNearLimit ? 'text-red-600' : 'text-gray-700'}`}>
                    {fmt(todayTokens)} / {fmt(dailyLimit)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${limitPct >= 100 ? 'bg-red-500' : limitPct >= 80 ? 'bg-orange-400' : 'bg-blue-500'}`}
                    style={{ width: `${limitPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">0</span>
                  <span className={`text-xs font-medium ${isNearLimit ? 'text-red-500' : 'text-gray-400'}`}>{limitPct}% terpakai</span>
                  <span className="text-xs text-gray-400">{fmt(dailyLimit)}</span>
                </div>
              </div>

              {/* Timeline chart */}
              <SectionCard title={`Grafik Penggunaan ${usageDays} Hari Terakhir`} icon={Activity} iconColor="text-blue-500">
                {usage.timeline?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={usage.timeline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                        tickFormatter={d => {
                          const parts = d.split('-');
                          return `${parts[2]}/${parts[1]}`;
                        }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickFormatter={v => fmt(v)} width={45} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="tokens"
                        name="Token"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        fill="url(#tokenGrad)"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={Activity} text="Belum ada data penggunaan" />
                )}
              </SectionCard>

              {/* Provider breakdown */}
              <SectionCard title="Penggunaan per Provider" icon={Zap} iconColor="text-purple-500">
                {usage.by_provider?.length > 0 ? (
                  <div className="space-y-3">
                    {usage.by_provider.map(p => {
                      const pct = usage.summary?.total_tokens ? Math.round((p.tokens / usage.summary.total_tokens) * 100) : 0;
                      const color = PROVIDER_COLORS[p.provider] || '#6B7280';
                      return (
                        <div key={p.provider} className="flex items-center gap-3">
                          <span className="w-28 text-sm font-semibold" style={{ color }}>{p.provider}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                            <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                          <span className="text-sm text-gray-600 w-24 text-right font-medium">{fmt(p.tokens)} token</span>
                          <span className="text-xs text-gray-400 w-10 text-right">{p.requests}x</span>
                          <span className="text-xs font-semibold w-10 text-right" style={{ color }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon={Zap} text="Belum ada data provider" />
                )}
              </SectionCard>

              {/* Per user */}
              <SectionCard title="Pemakaian per User" icon={Users} iconColor="text-orange-500">
                {usage.per_user?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 pr-3 text-gray-500 font-medium w-8">#</th>
                          <th className="text-left py-2 text-gray-500 font-medium">Username</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Token</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Request</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Porsi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.per_user.map((item, i) => {
                          const pct = usage.summary?.total_tokens ? Math.round((item.tokens / usage.summary.total_tokens) * 100) : 0;
                          const isTop = i === 0 && item.tokens > 0;
                          return (
                            <tr key={i} className={`border-b border-gray-50 ${isTop ? 'bg-orange-50/50' : 'hover:bg-gray-50'}`}>
                              <td className="py-2 pr-3 text-xs text-gray-400 font-mono">{i + 1}</td>
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                    {(item.username || item.user_id || '?')[0].toUpperCase()}
                                  </div>
                                  <span className={`font-medium ${isTop ? 'text-orange-700' : 'text-gray-800'}`}>
                                    {item.username || item.user_id || '-'}
                                  </span>
                                  {isTop && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-semibold">Tertinggi</span>}
                                </div>
                              </td>
                              <td className="py-2 text-right font-semibold text-gray-800">{fmt(item.tokens)}</td>
                              <td className="py-2 text-right text-gray-500">{item.requests}</td>
                              <td className="py-2 text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <div className="w-20 bg-gray-100 rounded-full h-2">
                                    <div className="bg-orange-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-500 w-9 text-right font-medium">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Users} text="Belum ada data pemakaian user" />
                )}
              </SectionCard>

              {/* Per license */}
              <SectionCard title="Top Pemakai Token per Lisensi" icon={BarChart2} iconColor="text-purple-500">
                {usage.per_license?.length > 0 ? (
                  <>
                    <div className="mb-4">
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={usage.per_license.slice(0, 10)} margin={{ top: 4, right: 4, left: 0, bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                          <XAxis
                            dataKey="license_key"
                            tick={{ fontSize: 10, fill: '#9CA3AF' }}
                            angle={-30}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => fmt(v)} width={40} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="tokens" name="Token" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-2 pr-3 text-gray-500 font-medium w-8">#</th>
                            <th className="text-left py-2 text-gray-500 font-medium">License Key</th>
                            <th className="text-right py-2 text-gray-500 font-medium">Token</th>
                            <th className="text-right py-2 text-gray-500 font-medium">Request</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usage.per_license.map((item, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 pr-3 text-xs text-gray-400">{i + 1}</td>
                              <td className="py-2 font-mono text-xs text-gray-700">{item.license_key}</td>
                              <td className="py-2 text-right font-semibold">{fmt(item.tokens)}</td>
                              <td className="py-2 text-right text-gray-500">{item.requests}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <EmptyState icon={BarChart2} text="Belum ada data lisensi" />
                )}
              </SectionCard>

              {/* Recent logs */}
              <SectionCard title="Log Penggunaan Terbaru" icon={Activity} iconColor="text-green-500">
                {usage.recent?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-gray-500 font-medium">Waktu</th>
                          <th className="text-left py-2 text-gray-500 font-medium">User</th>
                          <th className="text-left py-2 text-gray-500 font-medium">Lisensi</th>
                          <th className="text-left py-2 text-gray-500 font-medium">Provider / Model</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Token</th>
                          <th className="text-center py-2 text-gray-500 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.recent.map((r, i) => {
                          const uname = r.user_id ? (userMap[r.user_id] || String(r.user_id).slice(-8)) : '-';
                          return (
                            <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${!r.success ? 'bg-red-50/30' : ''}`}>
                              <td className="py-1.5 text-gray-400 whitespace-nowrap">
                                {r.created_at ? new Date(r.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                              </td>
                              <td className="py-1.5 text-gray-700 font-medium">{uname}</td>
                              <td className="py-1.5 font-mono text-gray-600">{r.license_key || '-'}</td>
                              <td className="py-1.5 text-gray-600">
                                <span style={{ color: PROVIDER_COLORS[r.provider] || '#6B7280' }} className="font-semibold">{r.provider || '-'}</span>
                                <span className="text-gray-400"> / {r.model || '-'}</span>
                              </td>
                              <td className="py-1.5 text-right font-semibold text-gray-800">{(r.total_tokens || 0).toLocaleString()}</td>
                              <td className="py-1.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full font-semibold ${r.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {r.success ? 'OK' : 'Error'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Activity} text="Belum ada log penggunaan" />
                )}
              </SectionCard>
            </>
          )}
        </div>
      )}
    </div>
  );
}
