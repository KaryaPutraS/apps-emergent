import React, { useState } from 'react';
import { mockContacts, mockTemplates } from '../data/mockData';
import { Radio, RefreshCw, Send, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

const Broadcast = () => {
  const [target, setTarget] = useState('all');
  const [tag, setTag] = useState('');
  const [customNumbers, setCustomNumbers] = useState('');
  const [template, setTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [recipientCount, setRecipientCount] = useState(0);

  const activeContacts = mockContacts.filter(c => !c.isBlocked);

  const handleCheckRecipients = () => {
    let count = 0;
    if (target === 'all') count = activeContacts.length;
    else if (target === 'tag') count = activeContacts.filter(c => tag.split(',').some(t => c.tag.includes(t.trim()))).length;
    else if (target === 'custom') count = customNumbers.split('\n').filter(n => n.trim()).length;
    setRecipientCount(count);
    toast.success(`${count} penerima ditemukan.`);
  };

  const handleTemplateChange = (id) => {
    setTemplate(id);
    const t = mockTemplates.find(t => t.id === id);
    if (t) setMessage(t.content);
  };

  const handleSend = () => {
    if (!message.trim()) { toast.error('Pesan tidak boleh kosong!'); return; }
    toast.success('Broadcast berhasil dikirim ke ' + (recipientCount || activeContacts.length) + ' kontak!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Broadcast Pesan</h1>
        <p className="text-slate-500 text-sm mt-0.5">Kirim pesan ke banyak kontak sekaligus</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-500" /> Buat Broadcast
        </h3>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Pilih Penerima</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
            <option value="all">Semua Kontak (kecuali blocked)</option>
            <option value="tag">Berdasarkan Tag</option>
            <option value="custom">Custom (input manual)</option>
          </select>
        </div>

        {target === 'tag' && (
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Tag</label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="lead, customer, vip" />
            <p className="text-xs text-slate-400 mt-1">Hanya kontak dengan tag ini yang dikirimi</p>
          </div>
        )}

        {target === 'custom' && (
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Daftar Nomor</label>
            <Textarea value={customNumbers} onChange={(e) => setCustomNumbers(e.target.value)} rows={4} placeholder={'6281234567890\n6289876543210'} />
            <p className="text-xs text-slate-400 mt-1">Satu nomor per baris (format: 62xxx)</p>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Template Pesan (opsional)</label>
          <select value={template} onChange={(e) => handleTemplateChange(e.target.value)} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
            <option value="">-- Tulis manual --</option>
            {mockTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">Pesan</label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Halo {nama}, ada promo spesial..." />
          <p className="text-xs text-slate-400 mt-1">Anti-banned: ada delay 3-7 detik random antar pesan</p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            Penerima: <strong className="text-slate-700">{recipientCount}</strong> kontak
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCheckRecipients} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Cek Penerima
            </Button>
            <Button onClick={handleSend} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Send className="w-4 h-4" /> Kirim Broadcast
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Broadcast;
