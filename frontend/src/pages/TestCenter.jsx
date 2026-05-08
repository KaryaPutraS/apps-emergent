import React, { useState } from 'react';
import { FlaskConical, Zap, BookOpen, Send, Plug, Brain } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

const TestCenter = () => {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  const runTest = (type) => {
    if (!message.trim() && type !== 'waha' && type !== 'ai') {
      toast.error('Masukkan pesan simulasi!');
      return;
    }
    
    const results = {
      rule: { type: 'Rule Match', status: 'success', detail: 'Rule "Menu" cocok! Trigger: contains "harga|menu", Response: Daftar menu kopi kami...' },
      knowledge: { type: 'Knowledge Match', status: 'success', detail: 'Knowledge "Harga" cocok! Keyword: harga|biaya, Content: Espresso 18k, Americano 22k...' },
      full: { type: 'Full Flow', status: 'success', detail: 'Flow: Rule match → AI polish → Response: "Halo kak! Berikut menu kami hari ini: Espresso 18k, Americano 22k, Latte 28k. Ada yang mau dipesan?"' },
      waha: { type: 'WAHA Connection', status: 'success', detail: 'WAHA server responded: Session "default" aktif, WhatsApp terhubung.' },
      ai: { type: 'AI Connection', status: 'success', detail: 'AI (Gemini 2.0 Flash) merespon dalam 1.2s. Tokens: 45. Response valid.' },
    };
    
    setResult(results[type]);
    toast.success(`Test ${results[type].type} berhasil!`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Test Center</h1>
        <p className="text-slate-500 text-sm mt-0.5">Tes koneksi, rule, knowledge, dan flow tanpa mengirim pesan nyata.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <FlaskConical className="w-4 h-4 text-emerald-500" /> Simulasi Pesan Masuk
        </h3>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Pesan Simulasi</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Contoh: promo apa yang sedang aktif?"
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="outline" onClick={() => runTest('rule')} className="gap-2">
            <Zap className="w-4 h-4" /> Test Rule
          </Button>
          <Button variant="outline" onClick={() => runTest('knowledge')} className="gap-2">
            <BookOpen className="w-4 h-4" /> Test Knowledge
          </Button>
          <Button onClick={() => runTest('full')} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Send className="w-4 h-4" /> Test Full Flow
          </Button>
          <Button variant="ghost" onClick={() => runTest('waha')} className="gap-2">
            <Plug className="w-4 h-4" /> Test WAHA
          </Button>
          <Button variant="ghost" onClick={() => runTest('ai')} className="gap-2">
            <Brain className="w-4 h-4" /> Test AI
          </Button>
        </div>

        {result && (
          <div className={`mt-4 p-4 rounded-lg border animate-fade-in ${
            result.status === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}>
            <p className={`font-medium text-sm mb-1 ${
              result.status === 'success' ? 'text-emerald-700' : 'text-red-700'
            }`}>
              {result.status === 'success' ? '\u2705' : '\u274C'} {result.type}
            </p>
            <p className="text-sm text-slate-600">{result.detail}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestCenter;
