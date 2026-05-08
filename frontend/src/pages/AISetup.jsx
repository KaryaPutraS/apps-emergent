import React, { useState } from 'react';
import { mockAiSetupMessages, aiSetupChips } from '../data/mockData';
import { Sparkles, Send, Check, Trash2, Eraser, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const AISetup = () => {
  const [messages, setMessages] = useState(mockAiSetupMessages);
  const [input, setInput] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Simulate AI response
    await new Promise(r => setTimeout(r, 1500));
    
    const aiMsg = {
      role: 'assistant',
      content: 'Baik, saya sudah membuatkan draft berdasarkan permintaan Anda. Silakan cek Preview Draft di samping, lalu klik "Simpan Semua Draft" jika sudah sesuai.'
    };
    setMessages(prev => [...prev, aiMsg]);
    setDrafts([
      { type: 'rule', summary: 'Rule Greeting', data: { name: 'Greeting', trigger: 'halo|hai|hello' } },
      { type: 'knowledge', summary: 'Knowledge Harga', data: { category: 'Harga', keyword: 'harga|biaya' } },
    ]);
    setLoading(false);
    toast.success('AI telah menyiapkan draft!');
  };

  const handleChip = (chip) => {
    setInput(`Buatkan setup untuk bisnis ${chip}`);
  };

  const handleClearChat = () => {
    setMessages(mockAiSetupMessages);
    toast.success('Chat dibersihkan!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Setup Assistant</h1>
          <p className="text-slate-500 text-sm mt-0.5">Isi Rules, Knowledge, Template, dan Setting lewat chat AI.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleClearChat} className="gap-2">
          <Eraser className="w-4 h-4" /> Bersihkan Chat
        </Button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Alur aman: ngobrol dengan AI &rarr; AI membuat draft &rarr; cek preview &rarr; klik Simpan Semua Draft. AI Setup boleh mengatur Template, Rules, Knowledge, Kontak, dan AI Agent.</span>
        </p>
      </div>

      {/* Scope info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <h4 className="font-semibold text-slate-800 text-sm mb-2">Yang Bisa Diatur AI Setup</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div><strong>Template Pesan</strong> — Nama template, kategori, dan isi pesan broadcast/follow-up.</div>
          <div><strong>AI Agent</strong> — System Prompt, Informasi Bisnis, jam operasional, memory, temperature, max tokens.</div>
        </div>
        <p className="text-xs text-slate-400 mt-2">Tetap aman: semua hasil AI masuk ke Preview Draft dulu.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chat */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-3">Chat dengan AI Setup</h3>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {aiSetupChips.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChip(chip)}
                className="px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full hover:bg-emerald-100 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="h-64 overflow-y-auto border border-slate-100 rounded-lg p-3 space-y-3 mb-3 bg-slate-50/50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-md'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder="Contoh: Buatkan rule jika user tanya harga, jawab Paket Basic 99rb..."
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
          />
          <div className="flex gap-2 mt-3">
            <Button onClick={handleSend} disabled={loading || !input.trim()} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Sparkles className="w-4 h-4" /> Kirim ke AI
            </Button>
            <Button variant="outline" onClick={() => toast.info('Memfinalkan draft...')} className="gap-2">
              <Check className="w-4 h-4" /> Finalkan Draft
            </Button>
          </div>
        </div>

        {/* Draft Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-2">Preview Draft</h3>
          <p className="text-xs text-slate-500 mb-3">Data di bawah belum masuk database sampai Anda klik simpan.</p>
          
          {drafts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Belum ada draft.</div>
          ) : (
            <div className="space-y-2">
              {drafts.map((draft, i) => (
                <div key={i} className="p-3 border border-slate-200 rounded-lg bg-slate-50 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] uppercase">{draft.type}</Badge>
                      <span className="text-sm font-medium text-slate-700">{draft.summary}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))} className="h-7 w-7 p-0 text-slate-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{JSON.stringify(draft.data)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button onClick={() => { toast.success('Semua draft tersimpan!'); setDrafts([]); }} disabled={drafts.length === 0} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Check className="w-4 h-4" /> Simpan Semua Draft
            </Button>
            <Button variant="outline" onClick={() => setDrafts([])} disabled={drafts.length === 0} className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" /> Hapus Draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISetup;
