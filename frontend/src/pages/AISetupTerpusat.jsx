import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Save, RefreshCw, TrendingUp, Zap, AlertCircle, CheckCircle, ChevronDown, BarChart2 } from 'lucide-react';
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

function StatCard({ label, value, sub, icon: Icon, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon size={16} />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function ProviderConfig({ prefix, values, onChange, showBaseUrl }) {
  const provider = values[`${prefix}provider`] || 'GEMINI';
  const models = PROVIDER_MODELS[provider] || [];
  const needsBaseUrl = ['OLLAMA', 'OPENROUTER'].includes(provider) || showBaseUrl;

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
      {(needsBaseUrl || provider === 'OLLAMA') && (
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

export default function AISetupTerpusat() {
  const [settings, setSettings] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
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
    try {
      const { data } = await apiClient.get(`/superadmin/ai-usage?days=${usageDays}`);
      setUsage(data);
    } catch (e) {
      showToast(e.response?.data?.detail || 'Gagal memuat statistik', 'error');
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

      {activeTab === 'config' && settings && (
        <div className="space-y-4">
          {/* Primary AI */}
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

          {/* Fallback AI */}
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
            {settings.fallback_enabled && (
              <ProviderConfig prefix="fallback_" values={settings} onChange={handleChange} />
            )}
            {!settings.fallback_enabled && (
              <p className="text-sm text-gray-400">Aktifkan API cadangan agar AI tetap berjalan saat API utama mengalami masalah.</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <strong>Cara kerja:</strong> Sistem akan memakai API utama. Jika gagal/limit, otomatis beralih ke API cadangan.
            API key tersimpan aman di server dan tidak pernah dikirim ke browser user.
          </div>
        </div>
      )}

      {activeTab === 'usage' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Periode:</span>
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => { setUsageDays(d); fetchUsage(); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${usageDays === d ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}
              >
                {d} hari
              </button>
            ))}
            <button onClick={fetchUsage} className="ml-auto p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
              <RefreshCw size={14} className="text-gray-500" />
            </button>
          </div>

          {usage && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Token Hari Ini" value={fmt(usage.today?.tokens)} icon={TrendingUp} color="blue" />
                <StatCard label="Request Hari Ini" value={fmt(usage.today?.requests)} icon={BarChart2} color="green" />
                <StatCard label={`Token ${usageDays}d`} value={fmt(usage.summary?.total_tokens)} icon={Zap} color="purple" />
                <StatCard label={`Request ${usageDays}d`} value={fmt(usage.summary?.total_requests)} icon={Bot} color="orange" />
              </div>

              {/* By provider */}
              {usage.by_provider?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Penggunaan per Provider</h3>
                  <div className="space-y-2">
                    {usage.by_provider.map(p => {
                      const pct = usage.summary?.total_tokens ? Math.round((p.tokens / usage.summary.total_tokens) * 100) : 0;
                      return (
                        <div key={p.provider} className="flex items-center gap-3">
                          <span className="w-28 text-sm font-medium text-gray-700">{p.provider}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm text-gray-500 w-20 text-right">{fmt(p.tokens)} token</span>
                          <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Per license */}
              {usage.per_license?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Top Pemakai Token per Lisensi</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-gray-500 font-medium">License Key</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Tokens</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Requests</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.per_license.map((item, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 font-mono text-xs text-gray-700">{item.license_key}</td>
                            <td className="py-2 text-right font-medium">{fmt(item.tokens)}</td>
                            <td className="py-2 text-right text-gray-500">{item.requests}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Per user */}
              {usage.per_user?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Pemakaian per User</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-gray-500 font-medium">Username</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Tokens</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Requests</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Porsi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.per_user.map((item, i) => {
                          const pct = usage.summary?.total_tokens ? Math.round((item.tokens / usage.summary.total_tokens) * 100) : 0;
                          return (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 font-medium text-gray-800">{item.username || item.user_id || '-'}</td>
                              <td className="py-2 text-right font-medium">{fmt(item.tokens)}</td>
                              <td className="py-2 text-right text-gray-500">{item.requests}</td>
                              <td className="py-2 text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <div className="w-20 bg-gray-100 rounded-full h-1.5">
                                    <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-400 w-8">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent logs */}
              {usage.recent?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Log Penggunaan Terbaru</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-gray-500 font-medium">Waktu</th>
                          <th className="text-left py-2 text-gray-500 font-medium">User</th>
                          <th className="text-left py-2 text-gray-500 font-medium">Lisensi</th>
                          <th className="text-left py-2 text-gray-500 font-medium">Provider</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Token</th>
                          <th className="text-center py-2 text-gray-500 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.recent.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-1.5 text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleString('id-ID') : '-'}</td>
                            <td className="py-1.5 text-gray-700">{r.user_id ? String(r.user_id).slice(-6) : '-'}</td>
                            <td className="py-1.5 font-mono text-gray-700">{r.license_key || '-'}</td>
                            <td className="py-1.5 text-gray-600">{r.provider || '-'} / {r.model || '-'}</td>
                            <td className="py-1.5 text-right font-medium">{r.total_tokens || 0}</td>
                            <td className="py-1.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {r.success ? 'OK' : 'Error'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
