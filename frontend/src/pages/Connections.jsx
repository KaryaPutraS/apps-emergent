import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../App';
import { getConfig, updateConfig, getWahaStatus, getWahaQr, startWahaSession, stopWahaSession, getWahaWebhook, setWahaWebhook, debugWaha } from '../api/apiClient';
import {
  Copy, Save, Search, Wifi, Brain, Globe, QrCode,
  Smartphone, RefreshCw, Play, Square, CheckCircle2,
  AlertCircle, Loader2, Eye, EyeOff, Unplug, Webhook, Zap, Link2, Power
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';

const aiProviders = [
  { value: 'GEMINI', label: 'Google Gemini' },
  { value: 'GROQ', label: 'Groq' },
  { value: 'OPENROUTER', label: 'OpenRouter' },
  { value: 'DEEPSEEK', label: 'DeepSeek' },
  { value: 'OPENAI', label: 'OpenAI' },
  { value: 'ANTHROPIC', label: 'Anthropic Claude' },
  { value: 'OLLAMA', label: 'Ollama Server' },
];

const aiModelOptions = {
  GEMINI: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  GROQ: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  OPENROUTER: ['meta-llama/llama-3.1-8b-instruct:free', 'google/gemini-flash-1.5:free'],
  DEEPSEEK: ['deepseek-chat', 'deepseek-reasoner'],
  OPENAI: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  ANTHROPIC: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
  OLLAMA: [],
};

// ─── Status badge helper ──────────────────────────────────────
const STATUS_MAP = {
  WORKING:       { label: 'Terhubung',      color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle2 },
  SCAN_QR_CODE:  { label: 'Scan QR Code',   color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-400 animate-pulse', icon: QrCode },
  STARTING:      { label: 'Memulai...',      color: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-400 animate-pulse', icon: Loader2 },
  STOPPED:       { label: 'Tidak Aktif',     color: 'bg-slate-100 text-slate-500',    dot: 'bg-slate-400', icon: Unplug },
  FAILED:        { label: 'Gagal',           color: 'bg-red-100 text-red-600',        dot: 'bg-red-500', icon: AlertCircle },
  UNKNOWN:       { label: 'Tidak Diketahui', color: 'bg-slate-100 text-slate-500',    dot: 'bg-slate-400', icon: AlertCircle },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

// ─── QR Code Panel ────────────────────────────────────────────
const QrPanel = ({ wahaConfigured, onStartSession }) => {
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    if (!wahaConfigured) return;
    try {
      const d = await getWahaStatus();
      setStatus(d);
      return d.status;
    } catch (err) {
      setStatus({ status: 'FAILED', error: err.response?.data?.detail || 'Koneksi gagal' });
      return 'FAILED';
    }
  }, [wahaConfigured]);

  const fetchQr = useCallback(async () => {
    if (!wahaConfigured) return;
    setLoadingQr(true);
    try {
      const d = await getWahaQr();
      setQr(d.qr || null);
    } catch {
      setQr(null);
    } finally {
      setLoadingQr(false);
    }
  }, [wahaConfigured]);

  const startPolling = useCallback((currentStatus) => {
    if (pollRef.current) clearInterval(pollRef.current);
    // Poll aggressively when waiting for QR or connecting
    const interval = currentStatus === 'WORKING' ? 30000 : 4000;
    pollRef.current = setInterval(async () => {
      const s = await fetchStatus();
      if (s === 'SCAN_QR_CODE') fetchQr();
      if (s === 'WORKING') {
        setQr(null);
        clearInterval(pollRef.current);
        pollRef.current = setInterval(fetchStatus, 30000);
      }
    }, interval);
  }, [fetchStatus, fetchQr]);

  useEffect(() => {
    if (!wahaConfigured) return;
    setLoadingStatus(true);
    fetchStatus().then((s) => {
      setLoadingStatus(false);
      if (s === 'SCAN_QR_CODE') fetchQr();
      startPolling(s);
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [wahaConfigured, fetchStatus, fetchQr, startPolling]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startWahaSession();
      toast.success('Session dimulai, menunggu QR code…');
      await fetchStatus();
      setTimeout(async () => {
        const s = await fetchStatus();
        if (s === 'SCAN_QR_CODE') fetchQr();
        startPolling(s);
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memulai session.');
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await stopWahaSession();
      toast.success('Session dihentikan.');
      setQr(null);
      setStatus({ status: 'STOPPED' });
      if (pollRef.current) clearInterval(pollRef.current);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghentikan session.');
    } finally {
      setStopping(false);
    }
  };

  const handleRefreshQr = async () => {
    await fetchQr();
    toast.success('QR code diperbarui.');
  };

  if (!wahaConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Wifi className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Isi WAHA URL terlebih dahulu</p>
        <p className="text-xs mt-1">Simpan konfigurasi WAHA di bawah untuk memulai</p>
      </div>
    );
  }

  const currentStatus = status?.status || 'UNKNOWN';
  const isWorking = currentStatus === 'WORKING';
  const needsQr = currentStatus === 'SCAN_QR_CODE';
  const isStopped = currentStatus === 'STOPPED' || currentStatus === 'FAILED';

  return (
    <div className="space-y-4">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {loadingStatus ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <StatusBadge status={currentStatus} />
          )}
          {isWorking && status?.me && (
            <span className="text-sm text-slate-600 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
              {status.me.pushName || status.me.id || 'Terhubung'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {needsQr && (
            <Button size="sm" variant="outline" onClick={handleRefreshQr} disabled={loadingQr} className="h-8 px-3 text-xs gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingQr ? 'animate-spin' : ''}`} />
              Refresh QR
            </Button>
          )}
          {isStopped && (
            <Button size="sm" onClick={handleStart} disabled={starting} className="h-8 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Mulai Session
            </Button>
          )}
          {!isStopped && (
            <Button size="sm" variant="outline" onClick={handleStop} disabled={stopping} className="h-8 px-3 text-xs gap-1.5 text-red-500 border-red-200 hover:bg-red-50">
              {stopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
              Stop
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => fetchStatus()} className="h-8 px-2 text-slate-400 hover:text-slate-600">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* QR Code display */}
      {needsQr && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="p-1 rounded-2xl border-2 border-emerald-400 shadow-lg bg-white">
            {loadingQr ? (
              <div className="w-52 h-52 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : qr ? (
              <img
                src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                alt="WhatsApp QR Code"
                className="w-52 h-52 rounded-xl"
              />
            ) : (
              <div className="w-52 h-52 flex flex-col items-center justify-center gap-2 text-slate-400">
                <QrCode className="w-10 h-10 opacity-30" />
                <p className="text-xs text-center">QR belum tersedia.<br />Klik Refresh QR.</p>
              </div>
            )}
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-800">Scan QR Code dengan WhatsApp</p>
            <p className="text-xs text-slate-500">Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat</p>
            <p className="text-xs text-slate-400">QR code berlaku ~60 detik · auto refresh setiap 4 detik</p>
          </div>
        </div>
      )}

      {/* Connected state */}
      {isWorking && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">WhatsApp Terhubung</p>
            {status?.me && (
              <p className="text-xs text-slate-500 mt-1">
                {status.me.pushName && <span className="font-medium">{status.me.pushName}</span>}
                {status.me.id && <span className="ml-1 text-slate-400">({status.me.id.replace('@c.us', '')})</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stopped / error state */}
      {isStopped && currentStatus !== 'FAILED' && (
        <div className="flex flex-col items-center gap-3 py-8 text-slate-400">
          <Unplug className="w-10 h-10 opacity-30" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Session tidak aktif</p>
            <p className="text-xs mt-1">Klik "Mulai Session" untuk menghubungkan WhatsApp</p>
          </div>
        </div>
      )}

      {currentStatus === 'FAILED' && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Gagal terhubung ke WAHA</p>
            <p className="text-xs text-red-500 mt-0.5">{status?.error || 'Periksa URL dan API Key WAHA Anda.'}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Connections Page ────────────────────────────────────
const Connections = () => {
  const { currentUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('GEMINI');
  const [model, setModel] = useState('gemini-2.0-flash');
  const [wahaUrl, setWahaUrl] = useState('');
  const [wahaSession, setWahaSession] = useState('default');
  const [wahaApiKey, setWahaApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiApiKey, setAiApiKey] = useState('');
  const [showAiKey, setShowAiKey] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [wahaConfigured, setWahaConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [backendUrl, setBackendUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState(null); // null | 'loading' | 'set' | 'none'
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [debugging, setDebugging] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);

  // Compute webhook URL from backendUrl + currentUser token
  const myWebhookUrl = React.useMemo(() => {
    const base = (backendUrl || '').replace(/\/$/, '');
    const tok = currentUser?.webhookToken;
    if (!base || !tok) return null;
    return `${base}/webhook/${tok}`;
  }, [backendUrl, currentUser]);

  const maskedWebhookUrl = React.useMemo(() => {
    if (!myWebhookUrl) return null;
    const lastSlash = myWebhookUrl.lastIndexOf('/');
    const base = myWebhookUrl.slice(0, lastSlash + 1);
    const token = myWebhookUrl.slice(lastSlash + 1);
    return showWebhookToken ? myWebhookUrl : `${base}${'•'.repeat(Math.min(token.length, 20))}`;
  }, [myWebhookUrl, showWebhookToken]);

  useEffect(() => {
    getConfig().then(data => {
      setProvider(data.aiProvider || 'GEMINI');
      setModel(data.aiModel || 'gemini-2.0-flash');
      setWahaUrl(data.wahaUrl || '');
      setWahaSession(data.wahaSession || 'default');
      setWahaApiKey(data.wahaApiKey || '');
      setAiApiKey(data.aiApiKey || '');
      setOllamaUrl(data.ollamaUrl || '');
      setAiEnabled(data.aiEnabled !== false);
      setBackendUrl(data.backendUrl || '');
      setWahaConfigured(!!data.wahaUrl);
      setLoading(false);
    }).catch((err) => {
      toast.error('Gagal memuat konfigurasi. Coba refresh halaman.');
      setLoading(false);
    });
  }, []);

  const handleSaveWaha = async () => {
    try {
      await updateConfig({ wahaUrl, wahaSession, wahaApiKey, backendUrl });
      setWahaConfigured(!!wahaUrl);
      toast.success('Konfigurasi WAHA tersimpan!');
    } catch {
      toast.error('Gagal menyimpan konfigurasi.');
    }
  };

  const handleCheckWebhook = async () => {
    setWebhookStatus('loading');
    try {
      const d = await getWahaWebhook();
      setWebhookStatus(d.webhooks?.length > 0 ? 'set' : 'none');
    } catch {
      setWebhookStatus('none');
    }
  };

  const handleDebug = async () => {
    setDebugging(true);
    try {
      const d = await debugWaha();
      setDebugInfo(d);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menjalankan debug.');
    } finally {
      setDebugging(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!backendUrl) { toast.error('Isi Backend URL terlebih dahulu, lalu Simpan.'); return; }
    setSettingWebhook(true);
    try {
      const d = await setWahaWebhook();
      toast.success('Webhook berhasil dipasang di WAHA!');
      setWebhookStatus('set');
      setWebhookUrl(d.webhookUrl || webhookUrl);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memasang webhook.');
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleTestWaha = async () => {
    if (!wahaUrl) { toast.error('Isi WAHA URL terlebih dahulu dan simpan terlebih dahulu.'); return; }
    try {
      toast.info('Mengecek koneksi WAHA…');
      const d = await getWahaStatus();
      toast.success(`WAHA terhubung! Status session: ${d.status}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal terhubung ke WAHA. Pastikan URL sudah disimpan.');
    }
  };

  const handleSaveAI = async () => {
    const updates = { aiProvider: provider, aiModel: model, aiApiKey, ollamaUrl, aiEnabled };
    try {
      await updateConfig(updates);
      toast.success(aiEnabled ? 'Konfigurasi AI tersimpan & aktif!' : 'Konfigurasi AI tersimpan (AI dinonaktifkan).');
    } catch {
      toast.error('Gagal menyimpan konfigurasi AI.');
    }
  };

  const handleToggleAI = async (val) => {
    setAiEnabled(val);
    try {
      await updateConfig({ aiEnabled: val });
      toast.success(val ? 'AI diaktifkan' : 'AI dinonaktifkan — API key tetap tersimpan');
    } catch {
      toast.error('Gagal mengubah status AI.');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  );

  const models = aiModelOptions[provider] || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Koneksi & Integrasi</h1>
        <p className="text-slate-500 text-sm mt-0.5">Setup WAHA WhatsApp API & AI Provider</p>
      </div>

      {/* ── WhatsApp Connection (QR Panel) ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Status WhatsApp</h3>
            <p className="text-xs text-slate-500">Scan QR code untuk menghubungkan akun WhatsApp</p>
          </div>
        </div>
        <div className="px-6 py-5">
          <QrPanel wahaConfigured={wahaConfigured} />
        </div>
      </div>

      {/* ── Webhook Setup ── */}
      {wahaConfigured && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Webhook Otomatis</h3>
              <p className="text-xs text-slate-500">Pasang webhook ke WAHA tanpa membuka dashboard WAHA</p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            {/* Webhook URL preview */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">URL webhook yang akan dipasang:</p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <Link2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <code className="text-xs font-mono text-slate-600 flex-1 break-all">
                  {maskedWebhookUrl
                    ? maskedWebhookUrl
                    : <span className="text-slate-400 italic">
                        {!backendUrl ? 'Isi Backend URL terlebih dahulu' : 'Token tidak tersedia — coba logout lalu login ulang'}
                      </span>
                  }
                </code>
                {myWebhookUrl && (
                  <button onClick={() => setShowWebhookToken(v => !v)} aria-label={showWebhookToken ? 'Sembunyikan token' : 'Tampilkan token'} className="flex-shrink-0 text-slate-400 hover:text-slate-600">
                    {showWebhookToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
                {myWebhookUrl && (
                  <button onClick={() => { navigator.clipboard.writeText(myWebhookUrl); toast.success('URL disalin!'); }} className="flex-shrink-0 text-slate-400 hover:text-slate-600">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Webhook status */}
            {webhookStatus === 'set' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <p className="text-sm text-emerald-700 font-medium">Webhook sudah terpasang di WAHA</p>
              </div>
            )}
            {webhookStatus === 'none' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700">Webhook belum terpasang di WAHA</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSetWebhook}
                disabled={settingWebhook || !backendUrl}
                className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
              >
                {settingWebhook
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Zap className="w-4 h-4" />
                }
                Pasang Webhook Otomatis
              </Button>
              <Button
                variant="outline"
                onClick={handleCheckWebhook}
                disabled={webhookStatus === 'loading'}
                className="gap-2"
              >
                {webhookStatus === 'loading'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Search className="w-4 h-4" />
                }
                Cek Status Webhook
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Pastikan session WhatsApp sudah aktif sebelum memasang webhook.
              Webhook akan menerima semua pesan masuk dan mengirimkannya ke adminpintar.id.
            </p>

            {/* Debug section */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-400">Debug WAHA API</p>
                <Button size="sm" variant="ghost" onClick={handleDebug} disabled={debugging} className="h-7 px-2 text-xs text-slate-400 hover:text-slate-600 gap-1">
                  {debugging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  Jalankan Debug
                </Button>
              </div>
              {debugInfo && (
                <div className="bg-slate-900 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <pre className="text-xs text-emerald-400 whitespace-pre-wrap break-all">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Webhook URL (manual) ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-emerald-500" /> Webhook URL (Manual)
        </h3>
        <p className="text-sm text-slate-500 mb-3">
          URL webhook Anda — gunakan ini jika ingin set manual di WAHA.
        </p>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <code className="text-xs font-mono text-slate-600 flex-1 break-all">
            {maskedWebhookUrl || (
              <span className="text-slate-400 italic">Isi Backend URL di Konfigurasi WAHA dan simpan terlebih dahulu</span>
            )}
          </code>
          {myWebhookUrl && (
            <button onClick={() => setShowWebhookToken(v => !v)} aria-label={showWebhookToken ? 'Sembunyikan token' : 'Tampilkan token'} className="flex-shrink-0 text-slate-400 hover:text-slate-600">
              {showWebhookToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
          {myWebhookUrl && (
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(myWebhookUrl); toast.success('URL disalin!'); }} className="flex-shrink-0 gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Copy
            </Button>
          )}
        </div>
      </div>

      {/* ── WAHA Config ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Wifi className="w-4 h-4 text-emerald-500" /> Konfigurasi WAHA
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">WAHA URL</label>
            <Input value={wahaUrl} onChange={(e) => setWahaUrl(e.target.value)} placeholder="https://your-waha-server.com" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Session Name</label>
            <Input value={wahaSession} onChange={(e) => setWahaSession(e.target.value)} placeholder="default" />
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700 block mb-1.5">API Key <span className="text-xs font-normal text-slate-400">(opsional)</span></label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={wahaApiKey}
              onChange={(e) => setWahaApiKey(e.target.value)}
              placeholder="X-Api-Key dari WAHA"
              className="pr-10"
            />
            <button type="button" onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Kosongkan jika WAHA tidak menggunakan autentikasi
            {wahaApiKey && <span className="ml-1 text-emerald-500 font-medium">· tersimpan</span>}
          </p>
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            Backend URL Publik
            <span className="ml-1.5 text-xs font-normal text-slate-400">(untuk webhook)</span>
          </label>
          <Input
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="https://yourdomain.com"
          />
          <p className="text-xs text-slate-400 mt-1">URL publik server ini — digunakan WAHA untuk mengirim pesan masuk ke dashboard</p>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSaveWaha} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Save className="w-4 h-4" /> Simpan
          </Button>
          <Button variant="outline" onClick={handleTestWaha} className="gap-2">
            <Search className="w-4 h-4" /> Test Koneksi
          </Button>
        </div>
      </div>

      {/* ── AI Provider ── */}
      <div className={`bg-white rounded-xl border overflow-hidden transition-colors ${aiEnabled ? 'border-slate-200' : 'border-slate-200'}`}>
        {/* Header dengan toggle */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${aiEnabled ? 'bg-emerald-100' : 'bg-slate-100'}`}>
              <Brain className={`w-4 h-4 ${aiEnabled ? 'text-emerald-600' : 'text-slate-400'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">AI Provider</h3>
              <p className="text-xs text-slate-500">Konfigurasi model AI untuk menjawab pesan</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`text-xs font-medium ${aiEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
              {aiEnabled ? 'Aktif' : 'Nonaktif'}
            </span>
            <Switch checked={aiEnabled} onCheckedChange={handleToggleAI} />
          </div>
        </div>

        {/* Banner saat AI off */}
        {!aiEnabled && (
          <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-b border-amber-100">
            <Power className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              AI sedang <strong>dinonaktifkan</strong> — bot akan menjawab dari Rules & Knowledge Base saja. API key tetap tersimpan.
            </p>
          </div>
        )}

        {/* Form — selalu tampil tapi dim saat off */}
        <div className={`px-6 py-5 space-y-4 ${!aiEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Provider</label>
              <select
                value={provider}
                onChange={(e) => { setProvider(e.target.value); setModel(aiModelOptions[e.target.value]?.[0] || ''); }}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                {aiProviders.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {provider === 'OLLAMA' && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Ollama URL</label>
              <Input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://IP-SERVER:11434" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">API Key</label>
            <div className="relative">
              <Input
                type={showAiKey ? 'text' : 'password'}
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAiKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              API Key dari provider AI Anda
              {aiApiKey && <span className="ml-1 text-emerald-500 font-medium">· tersimpan</span>}
            </p>
          </div>
          <Button onClick={handleSaveAI} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Save className="w-4 h-4" /> Simpan
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Connections;
