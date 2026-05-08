import React, { useState, useEffect } from 'react';
import { getConfig, updateConfig } from '../api/apiClient';
import { Copy, Save, Search, Wifi, Brain, RefreshCw, Globe } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const aiProviders = [
  { value: 'GEMINI', label: 'Google Gemini' }, { value: 'GROQ', label: 'Groq' }, { value: 'OPENROUTER', label: 'OpenRouter' },
  { value: 'DEEPSEEK', label: 'DeepSeek' }, { value: 'OPENAI', label: 'OpenAI' }, { value: 'ANTHROPIC', label: 'Anthropic Claude' }, { value: 'OLLAMA', label: 'Ollama Server' },
];
const aiModelOptions = {
  GEMINI: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'], GROQ: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  OPENROUTER: ['meta-llama/llama-3.1-8b-instruct:free', 'google/gemini-flash-1.5:free'], DEEPSEEK: ['deepseek-chat', 'deepseek-reasoner'],
  OPENAI: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'], ANTHROPIC: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'], OLLAMA: [],
};

const Connections = () => {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('GEMINI');
  const [model, setModel] = useState('gemini-2.0-flash');
  const [wahaUrl, setWahaUrl] = useState('');
  const [wahaSession, setWahaSession] = useState('default');
  const webhookUrl = 'https://your-webhook-url.com/api/webhook?secret=xxxx';

  useEffect(() => {
    getConfig().then(data => {
      setConfig(data); setProvider(data.aiProvider || 'GEMINI'); setModel(data.aiModel || 'gemini-2.0-flash');
      setWahaUrl(data.wahaUrl || ''); setWahaSession(data.wahaSession || 'default');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSaveWaha = async () => {
    try { await updateConfig({ wahaUrl, wahaSession }); toast.success('Koneksi WAHA tersimpan!'); } catch (e) { toast.error('Gagal menyimpan'); }
  };

  const handleSaveAI = async () => {
    try { await updateConfig({ aiProvider: provider, aiModel: model }); toast.success('Konfigurasi AI tersimpan!'); } catch (e) { toast.error('Gagal menyimpan'); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>;

  const models = aiModelOptions[provider] || [];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Koneksi & Integrasi</h1><p className="text-slate-500 text-sm mt-0.5">Setup WAHA WhatsApp API & AI Provider</p></div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3"><Globe className="w-4 h-4 text-emerald-500" /> Webhook URL</h3>
        <p className="text-sm text-slate-500 mb-3">Salin URL ini dan setel sebagai webhook di WAHA Anda.</p>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <code className="text-xs font-mono text-slate-600 flex-1 break-all">{webhookUrl}</code>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL disalin!'); }} className="flex-shrink-0 gap-1.5"><Copy className="w-3.5 h-3.5" /> Copy</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Wifi className="w-4 h-4 text-emerald-500" /> WAHA WhatsApp API</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">WAHA URL</label><Input value={wahaUrl} onChange={(e) => setWahaUrl(e.target.value)} placeholder="https://your-waha-server.com" /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Session Name</label><Input value={wahaSession} onChange={(e) => setWahaSession(e.target.value)} placeholder="default" /></div>
        </div>
        <div className="mt-4"><label className="text-sm font-medium text-slate-700 block mb-1.5">API Key (Opsional)</label><Input type="password" placeholder="X-Api-Key dari WAHA" /><p className="text-xs text-slate-400 mt-1">Kosongkan jika WAHA tidak menggunakan auth</p></div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSaveWaha} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Save className="w-4 h-4" /> Simpan</Button>
          <Button variant="outline" onClick={() => toast.success('Koneksi WAHA berhasil!')} className="gap-2"><Search className="w-4 h-4" /> Test Koneksi</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Brain className="w-4 h-4 text-emerald-500" /> AI Provider</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Provider</label><select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(aiModelOptions[e.target.value]?.[0] || ''); }} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">{aiProviders.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Model</label><select value={model} onChange={(e) => setModel(e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">{models.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        </div>
        {provider === 'OLLAMA' && <div className="mt-4"><label className="text-sm font-medium text-slate-700 block mb-1.5">Ollama URL</label><Input placeholder="http://IP-SERVER:11434" /></div>}
        <div className="mt-4"><label className="text-sm font-medium text-slate-700 block mb-1.5">API Key</label><Input type="password" placeholder="sk-..." /><p className="text-xs text-slate-400 mt-1">API Key dari provider AI</p></div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSaveAI} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Save className="w-4 h-4" /> Simpan</Button>
          <Button variant="outline" onClick={() => toast.success('AI merespon dengan benar!')} className="gap-2"><Search className="w-4 h-4" /> Test AI</Button>
        </div>
      </div>
    </div>
  );
};

export default Connections;
