import React, { useState, useEffect } from 'react';
import { getMessages } from '../api/apiClient';
import { formatWaktu } from '../utils/time';
import { RefreshCw, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const responseLabels = { rule: 'SISTEM', ai: 'AI', combo: 'GABUNGAN', incoming: 'Masuk', broadcast: 'Broadcast' };

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const timezone = localStorage.getItem('userTimezone') || 'WIB';

  const fetchData = async () => {
    try { setLoading(true); const data = await getMessages(100); setMessages(data); } catch (e) { toast.error('Gagal memuat pesan'); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Riwayat Pesan</h1><p className="text-slate-500 text-sm mt-0.5">Log percakapan masuk dan keluar</p></div>
        <Button variant="outline" size="sm" onClick={() => { fetchData(); toast.success('Data diperbarui!'); }} className="gap-2"><RefreshCw className="w-4 h-4" /> Refresh</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {loading ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200"><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Waktu</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Chat ID</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Arah</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Pesan</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Tipe</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Token</th></tr></thead>
              <tbody>
                {messages.map((msg, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">{formatWaktu(msg.timestamp, localStorage.getItem('userTimezone') || 'WIB')}</td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-600">{(msg.chatId || '').replace('@c.us', '').replace(/(\d{4})\d+(\d{3})/, '$1****$2')}</td>
                    <td className="py-3 px-3">{msg.direction === 'incoming' ? <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-50 text-xs gap-1"><ArrowDownLeft className="w-3 h-3" /> Masuk</Badge> : <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 text-xs gap-1"><ArrowUpRight className="w-3 h-3" /> Keluar</Badge>}</td>
                    <td className="py-3 px-3"><p className="text-slate-700 max-w-xs truncate">{msg.message}</p></td>
                    <td className="py-3 px-3 hidden md:table-cell"><Badge variant="secondary" className={`text-[10px] ${msg.responseType === 'rule' ? 'bg-violet-50 text-violet-600' : msg.responseType === 'ai' ? 'bg-amber-50 text-amber-600' : ''}`}>{responseLabels[msg.responseType] || msg.responseType}</Badge></td>
                    <td className="py-3 px-3 hidden md:table-cell text-slate-500">{msg.tokensUsed || '-'}</td>
                  </tr>
                ))}
                {messages.length === 0 && <tr><td colSpan="6" className="py-8 text-center text-slate-400">Belum ada pesan.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
