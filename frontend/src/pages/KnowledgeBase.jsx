import React, { useState, useEffect } from 'react';
import { getKnowledge, saveKnowledge as apiSaveKnowledge, deleteKnowledge as apiDeleteKnowledge } from '../api/apiClient';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';

const KnowledgeBase = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchData = async () => {
    try { setLoading(true); const data = await getKnowledge(); setItems(data); } catch (e) { toast.error('Gagal memuat knowledge'); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const openNew = () => { setEditing({ id: '', category: '', keyword: '', content: '', isActive: true }); setModalOpen(true); };
  const openEdit = (item) => { setEditing({...item}); setModalOpen(true); };

  const handleSave = async () => {
    if (!editing.category || !editing.keyword || !editing.content) { toast.error('Lengkapi semua field!'); return; }
    try { await apiSaveKnowledge(editing); await fetchData(); setModalOpen(false); toast.success('Knowledge tersimpan!'); } catch (e) { toast.error('Gagal menyimpan'); }
  };

  const handleDelete = async (id) => {
    try { await apiDeleteKnowledge(id); setItems(items.filter(i => i.id !== id)); toast.success('Knowledge dihapus!'); } catch (e) { toast.error('Gagal menghapus'); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1><p className="text-slate-500 text-sm mt-0.5">Database pengetahuan bisnis yang akan digunakan AI</p></div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Plus className="w-4 h-4" /> Tambah Entry</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200"><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Kategori</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Keyword</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Konten</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Status</th><th className="text-right py-3 px-3"></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3"><Badge variant="secondary" className="text-xs">{item.category}</Badge></td>
                  <td className="py-3 px-3"><code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{item.keyword}</code></td>
                  <td className="py-3 px-3 hidden md:table-cell"><p className="text-slate-600 max-w-xs truncate">{item.content}</p></td>
                  <td className="py-3 px-3"><Badge className={`text-xs ${item.isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-50' : 'bg-slate-100 text-slate-400 hover:bg-slate-100'}`}>{item.isActive ? 'Aktif' : 'Nonaktif'}</Badge></td>
                  <td className="py-3 px-3 text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600"><Edit className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button></div></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan="5" className="py-8 text-center text-slate-400">Belum ada knowledge.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editing?.id ? 'Edit Knowledge' : 'Tambah Knowledge'}</DialogTitle></DialogHeader>
          {editing && (<div className="space-y-4 mt-2">
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Kategori</label><Input value={editing.category} onChange={(e) => setEditing({...editing, category: e.target.value})} placeholder="Harga, FAQ, Layanan" /></div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Keyword</label><Input value={editing.keyword} onChange={(e) => setEditing({...editing, keyword: e.target.value})} placeholder="harga|biaya|tarif" /></div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Konten</label><Textarea value={editing.content} onChange={(e) => setEditing({...editing, content: e.target.value})} rows={5} /></div>
            <div className="flex items-center gap-3"><Switch checked={editing.isActive} onCheckedChange={(v) => setEditing({...editing, isActive: v})} /><span className="text-sm text-slate-700">Aktif</span></div>
            <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Save className="w-4 h-4" /> Simpan</Button></div>
          </div>)}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeBase;
