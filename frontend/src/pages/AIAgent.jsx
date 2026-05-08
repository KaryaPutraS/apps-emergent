import React, { useState } from 'react';
import { mockConfig } from '../data/mockData';
import { Brain, Save, Send, Store, Sliders, Link, FlaskConical } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';

const AIAgent = () => {
  const [config, setConfig] = useState(mockConfig);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState('');

  const handleTest = () => {
    if (!testMessage.trim()) { toast.error('Masukkan pesan test!'); return; }
    setTestResult('Halo kak! Terima kasih sudah menghubungi Toko Kopi Nusantara. Untuk "' + testMessage + '", kami sarankan cek menu lengkap kami ya. Ada yang bisa dibantu lagi?');
    toast.success('Test AI berhasil!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Agent Configuration</h1>
        <p className="text-slate-500 text-sm mt-0.5">Atur kepribadian dan perilaku bot AI Anda</p>
      </div>

      {/* Persona */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-emerald-500" /> Persona & Sistem Prompt
        </h3>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">System Prompt</label>
          <Textarea
            value={config.systemPrompt}
            onChange={(e) => setConfig({...config, systemPrompt: e.target.value})}
            rows={6}
            placeholder="Anda adalah asisten customer service..."
            className="font-mono text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">Instruksi utama untuk AI. Tentukan persona, tone, gaya bahasa.</p>
        </div>
      </div>

      {/* Business Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
          <Store className="w-4 h-4 text-emerald-500" /> Informasi Bisnis
        </h3>
        <p className="text-sm text-slate-500 mb-4">Info ini akan disertakan otomatis ke setiap percakapan AI sebagai konteks.</p>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Detail Bisnis</label>
          <Textarea
            value={config.businessInfo}
            onChange={(e) => setConfig({...config, businessInfo: e.target.value})}
            rows={6}
            placeholder={'Nama Toko: ...\nAlamat: ...\nJam Buka: ...'}
            className="font-mono text-sm"
          />
        </div>
      </div>

      {/* AI Parameters */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-emerald-500" /> Parameter AI
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Temperature</label>
            <Input type="number" step="0.1" min="0" max="2" value={config.aiTemperature} onChange={(e) => setConfig({...config, aiTemperature: e.target.value})} />
            <p className="text-xs text-slate-400 mt-1">0 = konsisten, 1+ = kreatif</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Max Tokens</label>
            <Input type="number" value={config.aiMaxTokens} onChange={(e) => setConfig({...config, aiMaxTokens: e.target.value})} />
            <p className="text-xs text-slate-400 mt-1">Panjang max balasan</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Memory Limit</label>
            <Input type="number" value={config.memoryLimit} onChange={(e) => setConfig({...config, memoryLimit: e.target.value})} />
            <p className="text-xs text-slate-400 mt-1">Jumlah pesan history per kontak</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Memory Timeout (menit)</label>
            <Input type="number" value={config.memoryTimeoutMinutes} onChange={(e) => setConfig({...config, memoryTimeoutMinutes: e.target.value})} />
            <p className="text-xs text-slate-400 mt-1">Reset memory jika idle X menit</p>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <Switch checked={config.ruleAiEnabled} onCheckedChange={(v) => setConfig({...config, ruleAiEnabled: v})} />
          <div>
            <p className="text-sm font-medium text-slate-700">Hubungkan Rules ke AI Agent Config</p>
            <p className="text-xs text-slate-500 mt-0.5">Jika aktif, rule yang cocok akan diproses ulang oleh AI memakai System Prompt + Informasi Bisnis.</p>
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={() => toast.success('Konfigurasi AI tersimpan!')} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Save className="w-4 h-4" /> Simpan Konfigurasi AI
          </Button>
        </div>
      </div>

      {/* Test AI */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
          <FlaskConical className="w-4 h-4 text-emerald-500" /> Test AI
        </h3>
        <p className="text-sm text-slate-500 mb-4">Coba AI dengan pesan simulasi.</p>
        <Textarea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          rows={2}
          placeholder="Berapa harga produknya?"
        />
        <Button variant="outline" onClick={handleTest} className="mt-3 gap-2">
          <Send className="w-4 h-4" /> Kirim Test
        </Button>
        {testResult && (
          <div className="mt-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-slate-700 animate-fade-in">
            <p className="font-medium text-emerald-700 mb-1">Balasan AI:</p>
            {testResult}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAgent;
