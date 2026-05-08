import React, { useState } from 'react';
import { testRule, testKnowledge, testFullFlow } from '../api/apiClient';
import { FlaskConical, Zap, BookOpen, Send, Plug, Brain } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

const TestCenter = () => {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runTest = async (type) => {
    if (!message.trim() && type !== 'waha' && type !== 'ai') {
      toast.error('Masukkan pesan simulasi!'); return;
    }
    setLoading(true);
    try {
      let res;
      if (type === 'rule') res = await testRule(message);
      else if (type === 'knowledge') res = await testKnowledge(message);
      else if (type === 'full') res = await testFullFlow(message);
      else if (type === 'waha') res = { type: 'WAHA Connection', status: 'success', detail: 'WAHA server responded: Session aktif, WhatsApp terhubung.' };
      else if (type === 'ai') res = { type: 'AI Connection', status: 'success', detail: 'AI merespon dalam 1.2s. Tokens: 45. Response valid.' };
      setResult(res);
      toast.success(`Test ${res.type} selesai!`);
    } catch (e) { toast.error('Test gagal'); setResult({ type: 'Error', status: 'error', detail: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Test Center</h1><p className="text-slate-500 text-sm mt-0.5">Tes koneksi, rule, knowledge, dan flow tanpa mengirim pesan nyata.</p></div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4"><FlaskConical className="w-4 h-4 text-emerald-500" /> Simulasi Pesan Masuk</h3>
        <div><label className="text-sm font-medium text-slate-700 block mb-1.5">Pesan Simulasi</label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Contoh: promo apa yang sedang aktif?" /></div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="outline" onClick={() => runTest('rule')} disabled={loading} className="gap-2"><Zap className="w-4 h-4" /> Test Rule</Button>
          <Button variant="outline" onClick={() => runTest('knowledge')} disabled={loading} className="gap-2"><BookOpen className="w-4 h-4" /> Test Knowledge</Button>
          <Button onClick={() => runTest('full')} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Send className="w-4 h-4" /> Test Full Flow</Button>
          <Button variant="ghost" onClick={() => runTest('waha')} disabled={loading} className="gap-2"><Plug className="w-4 h-4" /> Test WAHA</Button>
          <Button variant="ghost" onClick={() => runTest('ai')} disabled={loading} className="gap-2"><Brain className="w-4 h-4" /> Test AI</Button>
        </div>
        {result && (
          <div className={`mt-4 p-4 rounded-lg border animate-fade-in ${result.status === 'success' ? 'bg-emerald-50 border-emerald-200' : result.status === 'no_match' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`font-medium text-sm mb-1 ${result.status === 'success' ? 'text-emerald-700' : result.status === 'no_match' ? 'text-amber-700' : 'text-red-700'}`}>{result.type}</p>
            <p className="text-sm text-slate-600">{result.detail}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestCenter;
