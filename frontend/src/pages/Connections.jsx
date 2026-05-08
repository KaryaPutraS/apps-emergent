import React, { useState } from 'react';
import { mockConfig, aiProviders, aiModelOptions } from '../data/mockData';
import { Plug, Copy, Save, Search, Wifi, Brain, RefreshCw, Globe } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const Connections = () => {
  const [config, setConfig] = useState(mockConfig);
  const [provider, setProvider] = useState(config.aiProvider);
  const [model, setModel] = useState(config.aiModel);
  const models = aiModelOptions[provider] || [];

  const webhookUrl = 'https://script.google.com/macros/s/ABC123/exec?mode=webhook&secret=xxxx';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Koneksi & Integrasi</h1>
        <p className="text-slate-500 text-sm mt-0.5">Setup WAHA WhatsApp API & AI Provider</p>
      </div>

      {/* Webhook URL */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-emerald-500" /> Webhook URL
        </h3>
        <p className="text-sm text-slate-500 mb-3">Salin URL ini dan setel sebagai webhook di WAHA Anda.</p>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <code className="text-xs font-mono text-slate-600 flex-1 break-all">{webhookUrl}</code>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL disalin!'); }} className="flex-shrink-0 gap-1.5">
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          <strong>Setting WAHA:</strong> Masuk WAHA Dashboard &rarr; Sessions &rarr; Edit Session &rarr; tambahkan webhook URL dengan event <code className="bg-slate-100 px-1 rounded">message</code>.
        </p>
      </div>

      {/* WAHA */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Wifi className="w-4 h-4 text-emerald-500" /> WAHA WhatsApp API
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">WAHA URL</label>
            <Input defaultValue={config.wahaUrl} placeholder="https://your-waha-server.com" />
            <p className="text-xs text-slate-400 mt-1">URL server WAHA Anda (tanpa trailing slash)</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Session Name</label>
            <Input defaultValue={config.wahaSession} placeholder="default" />
            <p className="text-xs text-slate-400 mt-1">Nama session WhatsApp di WAHA</p>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700 block mb-1.5">API Key (Opsional)</label>
          <Input type="password" placeholder="X-Api-Key dari WAHA" defaultValue={config.hasWahaApiKey ? '••••••••' : ''} />
          <p className="text-xs text-slate-400 mt-1">Kosongkan jika WAHA tidak menggunakan auth</p>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => toast.success('Koneksi WAHA tersimpan!')} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Save className="w-4 h-4" /> Simpan
          </Button>
          <Button variant="outline" onClick={() => toast.success('Koneksi WAHA berhasil!')} className="gap-2">
            <Search className="w-4 h-4" /> Test Koneksi WAHA
          </Button>
        </div>
      </div>

      {/* AI Provider */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-emerald-500" /> AI Provider
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Provider</label>
            <select
              value={provider}
              onChange={(e) => { setProvider(e.target.value); setModel(aiModelOptions[e.target.value]?.[0] || ''); }}
              className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {aiProviders.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Model</label>
            <div className="flex gap-2">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="flex-1 h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {provider === 'OLLAMA' && (
                <Button variant="outline" size="sm" className="gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
              )}
            </div>
          </div>
        </div>
        {provider === 'OLLAMA' && (
          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Ollama URL</label>
            <Input placeholder="https://ai.domainanda.com atau http://IP-SERVER:11434" />
          </div>
        )}
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700 block mb-1.5">API Key</label>
          <Input type="password" placeholder="sk-..." defaultValue={config.hasAiApiKey ? '••••••••' : ''} />
          <p className="text-xs text-slate-400 mt-1">API Key dari provider AI yang Anda pilih</p>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => toast.success('Konfigurasi AI tersimpan!')} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Save className="w-4 h-4" /> Simpan
          </Button>
          <Button variant="outline" onClick={() => toast.success('AI merespon dengan benar!')} className="gap-2">
            <Search className="w-4 h-4" /> Test AI
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Connections;
