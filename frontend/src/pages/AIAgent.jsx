import React, { useState, useEffect } from 'react';
import { getAIAgentConfig, updateAIAgentConfig } from '../api/apiClient';
import { Brain, Save, Send, Store, Sliders, FlaskConical } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';

const AIAgent = () => {
  const [config, setConfig] = useState({ systemPrompt: '', businessInfo: '', aiTemperature: 0.7, aiMaxTokens: 500, memoryLimit: 10, memoryTimeoutMinutes: 30, ruleAiEnabled: true });
  const [loading, setLoading] = useState(true);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    getAIAgentConfig().then(data => { setConfig(prev => ({...prev, ...data})); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try { await updateAIAgentConfig(config); toast.success('Konfigurasi AI tersimpan!'); } catch (e) { toast.error('Gagal menyimpan'); }
  };

  const handleTest = () => {
    if (!testMessage.trim()) { toast.error('Masukkan pesan test!'); return; }
    setTestResult('Halo kak! Terima kasih sudah menghubungi kami. Untuk "' + testMessage + '", silakan cek informasi lengkap kami. Ada yang bisa dibantu lagi?');
    toast.success('Test AI berhasil! (simulasi lokal)');
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">AI Agent Configuration</h1><p className="text-slate-500 text-sm mt-0.5">Atur kepribadian dan perilaku bot AI Anda</p></div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Brain className="w-4 h-4 text-emerald-500" /> Persona & Sistem Prompt</h3>
        <div><label className="text-sm font-medium text-slate-700 block mb-1.5">System Prompt</label><Textarea value={config.systemPrompt || ''} onChange={(e) => setConfig({...config, systemPrompt: e.target.value})} rows={6} className="font-mono text-sm" /><p className="text-xs text-slate-400 mt-1">Instruksi utama untuk AI. Tentukan persona, tone, gaya bahasa.</p></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><Store className="w-4 h-4 text-emerald-500" /> Informasi Bisnis</h3>
        <p className="text-sm text-slate-500 mb-4">Info ini akan disertakan otomatis ke setiap percakapan AI.</p>
        <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Detail Bisnis</label><Textarea value={config.businessInfo || ''} onChange={(e) => setConfig({...config, businessInfo: e.target.value})} rows={6} className="font-mono text-sm" /></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><Sliders className="w-4 h-4 text-emerald-500" /> Parameter AI</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Temperature</label><Input type="number" step="0.1" min="0" max="2" value={config.aiTemperature || 0.7} onChange={(e) => setConfig({...config, aiTemperature: parseFloat(e.target.value) || 0})} /><p className="text-xs text-slate-400 mt-1">0 = konsisten, 1+ = kreatif</p></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Max Tokens</label><Input type="number" value={config.aiMaxTokens || 500} onChange={(e) => setConfig({...config, aiMaxTokens: parseInt(e.target.value) || 0})} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Memory Limit</label><Input type="number" value={config.memoryLimit || 10} onChange={(e) => setConfig({...config, memoryLimit: parseInt(e.target.value) || 0})} /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Memory Timeout (menit)</label><Input type="number" value={config.memoryTimeoutMinutes || 30} onChange={(e) => setConfig({...config, memoryTimeoutMinutes: parseInt(e.target.value) || 0})} /></div>
        </div>
        <div className="mt-5 flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <Switch checked={config.ruleAiEnabled || false} onCheckedChange={(v) => setConfig({...config, ruleAiEnabled: v})} />
          <div><p className="text-sm font-medium text-slate-700">Hubungkan Rules ke AI Agent</p><p className="text-xs text-slate-500 mt-0.5">Rule yang cocok akan diproses ulang oleh AI memakai System Prompt + Informasi Bisnis.</p></div>
        </div>
        <div className="mt-4"><Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Save className="w-4 h-4" /> Simpan Konfigurasi AI</Button></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2"><FlaskConical className="w-4 h-4 text-emerald-500" /> Test AI</h3>
        <Textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={2} placeholder="Berapa harga produknya?" />
        <Button variant="outline" onClick={handleTest} className="mt-3 gap-2"><Send className="w-4 h-4" /> Kirim Test</Button>
        {testResult && <div className="mt-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-slate-700 animate-fade-in"><p className="font-medium text-emerald-700 mb-1">Balasan AI:</p>{testResult}</div>}
      </div>
    </div>
  );
};

export default AIAgent;
