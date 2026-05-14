import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import {
  MessageSquare, Save, RefreshCw, CheckCircle, AlertCircle,
  Phone, Wifi, WifiOff, Eye, EyeOff
} from 'lucide-react';
import { Button } from '../components/ui/button';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';

const TEMPLATE_VARS = [
  { var: '{customer_name}', desc: 'Nama customer' },
  { var: '{license_key}', desc: 'License key' },
  { var: '{product_code}', desc: 'Kode produk' },
  { var: '{plan_name}', desc: 'Nama plan' },
  { var: '{expires_at}', desc: 'Tanggal expired' },
  { var: '{customer_phone}', desc: 'Nomor HP customer' },
  { var: '{customer_email}', desc: 'Email customer' },
];

export default function WAHAConfig() {
  const { token } = useApp();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testPhone, setTestPhone] = useState('');
  const [toast, setToast] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/superadmin/waha-config`, { headers });
      if (!res.ok) throw new Error('Gagal memuat konfigurasi WAHA');
      setConfig(await res.json());
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const set = (k, v) => setConfig(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/superadmin/waha-config`, {
        method: 'PUT', headers,
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Gagal menyimpan');
      showToast('Konfigurasi WAHA berhasil disimpan.');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/superadmin/waha-test`, {
        method: 'POST', headers,
        body: JSON.stringify({
          waha_url: config.waha_url,
          waha_api_key: config.waha_api_key,
          waha_session: config.waha_session,
          test_phone: testPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ success: false, message: data.detail || 'Koneksi gagal' });
      } else {
        setTestResult(data);
      }
    } catch (e) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  const insertVar = (varName) => {
    const el = document.getElementById('template-textarea');
    if (!el) {
      set('license_message_template', (config.license_message_template || '') + varName);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = config.license_message_template || '';
    const newText = text.slice(0, start) + varName + text.slice(end);
    set('license_message_template', newText);
    setTimeout(() => {
      el.focus();
      el.selectionStart = start + varName.length;
      el.selectionEnd = start + varName.length;
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-5">
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
            <MessageSquare size={22} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Konfigurasi WAHA</h1>
            <p className="text-sm text-gray-500">Pengaturan WhatsApp API untuk pengiriman lisensi</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white gap-2">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          Simpan
        </Button>
      </div>

      {/* Connection Settings */}
      {config && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Wifi size={16} className="text-green-500" />
              Koneksi WAHA
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WAHA URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={config.waha_url || ''}
                onChange={e => set('waha_url', e.target.value)}
                placeholder="http://localhost:3000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">URL server WAHA (tanpa trailing slash)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Session</label>
                <input
                  value={config.waha_session || 'default'}
                  onChange={e => set('waha_session', e.target.value)}
                  placeholder="default"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key (opsional)</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={config.waha_api_key || ''}
                    onChange={e => set('waha_api_key', e.target.value)}
                    placeholder="Kosongkan jika tidak ada"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Test Connection */}
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Phone size={14} />
                Tes Koneksi
              </h3>
              <div className="flex gap-3">
                <Button
                  onClick={handleTest}
                  disabled={testing || !config.waha_url}
                  variant="outline"
                  className="gap-2"
                >
                  {testing ? <RefreshCw size={13} className="animate-spin" /> : <Wifi size={13} />}
                  Cek Status Session
                </Button>
              </div>
              {testResult && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {testResult.success
                    ? <CheckCircle size={15} className="mt-0.5 flex-shrink-0" />
                    : <WifiOff size={15} className="mt-0.5 flex-shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Message Template */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare size={16} className="text-green-500" />
              Template Pesan Lisensi
            </h2>

            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARS.map(v => (
                <button
                  key={v.var}
                  type="button"
                  onClick={() => insertVar(v.var)}
                  title={v.desc}
                  className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-mono rounded-lg border border-green-200 transition-colors"
                >
                  {v.var}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">Klik variabel di atas untuk menyisipkan ke template</p>

            <textarea
              id="template-textarea"
              value={config.license_message_template || ''}
              onChange={e => set('license_message_template', e.target.value)}
              rows={10}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y font-mono"
              placeholder="Tulis template pesan..."
            />

            {/* Preview */}
            {config.license_message_template && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
                  Preview Pesan
                </div>
                <div className="p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white">
                  {config.license_message_template
                    .replace('{customer_name}', 'Budi Santoso')
                    .replace('{license_key}', 'ADMP-AB12-CD34-EF56')
                    .replace('{product_code}', 'adminpintar_chatbot')
                    .replace('{plan_name}', 'Pro')
                    .replace('{expires_at}', '31 Desember 2025')
                    .replace('{customer_phone}', '08123456789')
                    .replace('{customer_email}', 'budi@email.com')}
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 space-y-1">
            <p><strong>Cara menggunakan:</strong></p>
            <ol className="list-decimal list-inside space-y-1 text-blue-600">
              <li>Pastikan WAHA sudah berjalan dan session sudah aktif (terhubung ke WhatsApp)</li>
              <li>Isi WAHA URL, nama session, dan API key jika dibutuhkan</li>
              <li>Buat template pesan dengan variabel yang tersedia</li>
              <li>Klik tombol kirim (ikon WhatsApp) di halaman ChatBOT Lisensi</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
