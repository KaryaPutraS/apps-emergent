import React, { useState, useEffect, useCallback } from 'react';
import { getContacts, getTemplates as apiGetTemplates, sendBroadcastOne } from '../api/apiClient';
import { Send, Users, Search, CheckCircle2, XCircle, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

function parseWaNumber(chatId) {
  if (!chatId) return '-';
  if (chatId.includes('@g.us')) return 'Grup';
  if (chatId.includes('@lid')) return '-';
  const num = chatId.replace(/@[\w.]+$/, '');
  return /^\d{6,}$/.test(num) ? '+' + num : num;
}

const SEND_STATUS = { idle: 'idle', sending: 'sending', ok: 'ok', error: 'error' };

const Broadcast = () => {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [sendStatus, setSendStatus] = useState({}); // chatId → SEND_STATUS
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    getContacts('').then(setContacts).catch(() => toast.error('Gagal memuat kontak'));
    apiGetTemplates().then(setTemplates).catch(() => {});
  }, []);

  const filtered = contacts.filter(c =>
    !c.isBlocked &&
    !c.chatId?.includes('@g.us') &&
    (c.name?.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || parseWaNumber(c.chatId)).includes(search))
  );

  const toggleContact = (chatId) => {
    if (isSending) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(chatId) ? next.delete(chatId) : next.add(chatId);
      return next;
    });
  };

  const toggleAll = () => {
    if (isSending) return;
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.chatId)));
    }
  };

  const handleTemplateChange = (id) => {
    setTemplateId(id);
    const t = templates.find(t => t.id === id);
    if (t) setMessage(t.content);
  };

  const handleSendAll = useCallback(async () => {
    if (!message.trim()) { toast.error('Pesan tidak boleh kosong!'); return; }
    if (selected.size === 0) { toast.error('Pilih minimal satu kontak!'); return; }

    setIsSending(true);
    const targets = [...selected];
    // init all as idle/sending
    setSendStatus(Object.fromEntries(targets.map(id => [id, SEND_STATUS.sending])));

    let ok = 0, fail = 0;
    for (const chatId of targets) {
      try {
        await sendBroadcastOne(chatId, message);
        setSendStatus(prev => ({ ...prev, [chatId]: SEND_STATUS.ok }));
        ok++;
      } catch {
        setSendStatus(prev => ({ ...prev, [chatId]: SEND_STATUS.error }));
        fail++;
      }
      // random delay 3–7s to avoid ban
      if (chatId !== targets[targets.length - 1]) {
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));
      }
    }

    setIsSending(false);
    toast.success(`Selesai: ${ok} terkirim${fail ? `, ${fail} gagal` : ''}`);
  }, [message, selected]);

  const sentCount = Object.values(sendStatus).filter(s => s === SEND_STATUS.ok).length;
  const errCount = Object.values(sendStatus).filter(s => s === SEND_STATUS.error).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Broadcast Pesan</h1>
        <p className="text-slate-500 text-sm mt-0.5">Kirim pesan satu-per-satu ke kontak terpilih — lebih aman dari ban</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Contact picker */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" /> Pilih Kontak
            </h3>
            <span className="text-xs text-slate-500">{selected.size} dipilih</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / nomor..." className="pl-9" />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button onClick={toggleAll} disabled={isSending} className="text-emerald-600 hover:underline">
              {selected.size === filtered.length && filtered.length > 0 ? 'Batal semua' : 'Pilih semua'}
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-slate-400">{filtered.length} kontak aktif</span>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
            {filtered.length === 0 && (
              <p className="text-center text-slate-400 py-8 text-sm">Tidak ada kontak aktif.</p>
            )}
            {filtered.map(c => {
              const st = sendStatus[c.chatId];
              const isSelected = selected.has(c.chatId);
              return (
                <div
                  key={c.chatId}
                  onClick={() => toggleContact(c.chatId)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'border-transparent hover:bg-slate-50'
                  } ${isSending ? 'cursor-not-allowed' : ''}`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                  }`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{c.phone || parseWaNumber(c.chatId)}</p>
                  </div>
                  {c.tag && (
                    <div className="hidden sm:flex gap-1 flex-wrap">
                      {c.tag.split(',').slice(0, 2).map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{t.trim()}</Badge>
                      ))}
                    </div>
                  )}
                  {/* Sent status indicator */}
                  {st === SEND_STATUS.sending && <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />}
                  {st === SEND_STATUS.ok && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  {st === SEND_STATUS.error && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Message compose */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-500" /> Tulis Pesan
          </h3>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Template (opsional)</label>
            <select
              value={templateId}
              onChange={e => handleTemplateChange(e.target.value)}
              disabled={isSending}
              className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm disabled:opacity-50"
            >
              <option value="">-- Tulis manual --</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Pesan</label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={7}
              disabled={isSending}
              placeholder="Halo {{nama}}, ada info penting untuk Anda..."
              className="resize-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              Variabel: <code className="bg-slate-100 px-1 rounded">{'{{nama}}'}</code>{' '}
              <code className="bg-slate-100 px-1 rounded">{'{{no_wa}}'}</code>{' '}
              <code className="bg-slate-100 px-1 rounded">{'{{tanggal}}'}</code>
            </p>
          </div>

          {/* Progress summary */}
          {Object.keys(sendStatus).length > 0 && (
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm flex items-center gap-4">
              <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {sentCount} terkirim</span>
              {errCount > 0 && <span className="text-red-500 font-medium flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {errCount} gagal</span>}
              {isSending && <span className="text-slate-500 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengirim…</span>}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">Delay 3–7 detik antar pesan untuk hindari ban</p>
            <Button
              onClick={handleSendAll}
              disabled={isSending || selected.size === 0 || !message.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSending ? 'Mengirim…' : `Kirim ke ${selected.size} kontak`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Broadcast;
