import React, { useState, useEffect } from 'react';
import { getContacts, updateContact as apiUpdateContact, deleteContact as apiDeleteContact } from '../api/apiClient';
import { formatWaktu } from '../utils/time';
import { Search, Edit, Trash2, Save, Ban, ShieldCheck, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';

// Strip semua suffix WhatsApp dan kembalikan nomor bersih
function parseWaNumber(chatId) {
  if (!chatId) return '-';
  if (chatId.includes('@g.us')) return 'Grup';
  // LID format (@lid) = internal WhatsApp ID, bukan nomor HP
  if (chatId.includes('@lid')) return '-';
  const num = chatId.replace(/@[\w.]+$/, '');
  if (/^\d{6,}$/.test(num)) return '+' + num;
  return num;
}

const Contacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const timezone = localStorage.getItem('userTimezone') || 'WIB';

  const fetchData = async (q = '') => {
    try { setLoading(true); const data = await getContacts(q); setContacts(data); } catch (e) { toast.error('Gagal memuat kontak'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { const t = setTimeout(() => fetchData(search), 300); return () => clearTimeout(t); }, [search]);

  const openEdit = (c) => { setEditing({...c}); setModalOpen(true); };

  const handleSave = async () => {
    try {
      await apiUpdateContact(editing.chatId, { name: editing.name, tag: editing.tag, note: editing.note });
      await fetchData(search);
      setModalOpen(false);
      toast.success('Kontak diperbarui!');
    } catch (e) { toast.error('Gagal memperbarui'); }
  };

  const handleDelete = async (chatId) => {
    try { await apiDeleteContact(chatId); setContacts(contacts.filter(c => c.chatId !== chatId)); toast.success('Kontak dihapus!'); } catch (e) { toast.error('Gagal menghapus'); }
  };

  const toggleBlock = async (chatId) => {
    const c = contacts.find(ct => ct.chatId === chatId);
    if (!c) return;
    try {
      await apiUpdateContact(chatId, { isBlocked: !c.isBlocked });
      setContacts(contacts.map(ct => ct.chatId === chatId ? {...ct, isBlocked: !ct.isBlocked} : ct));
    } catch (e) { toast.error('Gagal mengubah status'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Daftar Kontak</h1><p className="text-slate-500 text-sm mt-0.5">Manajemen kontak yang pernah berinteraksi</p></div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kontak..." className="pl-9 w-72" /></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {loading ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200"><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Nama</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">No. WA</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Terakhir Chat</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Tag</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Pesan</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Status</th><th className="text-right py-3 px-3"></th></tr></thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.chatId} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-900">{c.name}</td>
                    <td className="py-3 px-3 font-mono text-sm text-slate-600">
                      {c.phone || parseWaNumber(c.chatId)}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500 hidden lg:table-cell">{formatWaktu(c.lastSeen, timezone)}</td>
                    <td className="py-3 px-3 hidden md:table-cell"><div className="flex flex-wrap gap-1">{c.tag ? c.tag.split(',').map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">{t.trim()}</Badge>) : <span className="text-slate-300">-</span>}</div></td>
                    <td className="py-3 px-3 hidden lg:table-cell"><span className="flex items-center gap-1 text-slate-600"><MessageSquare className="w-3 h-3" /> {c.messageCount || 0}</span></td>
                    <td className="py-3 px-3">{c.isBlocked ? <Badge className="bg-red-50 text-red-600 hover:bg-red-50 text-xs">Blocked</Badge> : <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 text-xs">Aktif</Badge>}</td>
                    <td className="py-3 px-3 text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600"><Edit className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="sm" onClick={() => toggleBlock(c.chatId)} className="h-8 w-8 p-0 text-slate-400 hover:text-amber-600">{c.isBlocked ? <ShieldCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}</Button><Button variant="ghost" size="sm" onClick={() => handleDelete(c.chatId)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button></div></td>
                  </tr>
                ))}
                {contacts.length === 0 && <tr><td colSpan="7" className="py-8 text-center text-slate-400">Belum ada kontak.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Edit Kontak</DialogTitle></DialogHeader>
        {editing && (<div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium text-slate-700 block mb-1">Nama</label><Input value={editing.name} onChange={(e) => setEditing({...editing, name: e.target.value})} /></div><div><label className="text-sm font-medium text-slate-700 block mb-1">Tag</label><Input value={editing.tag || ''} onChange={(e) => setEditing({...editing, tag: e.target.value})} placeholder="customer,vip" /></div></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1">Catatan</label><Textarea value={editing.note || ''} onChange={(e) => setEditing({...editing, note: e.target.value})} rows={3} /></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Save className="w-4 h-4" /> Simpan</Button></div>
        </div>)}
      </DialogContent></Dialog>
    </div>
  );
};

export default Contacts;
