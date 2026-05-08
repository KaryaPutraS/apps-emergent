import React, { useState, useEffect } from 'react';
import { getTemplates, saveTemplate as apiSaveTemplate, deleteTemplate as apiDeleteTemplate } from '../api/apiClient';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';

const Templates = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchData = async () => {
    try { setLoading(true); const data = await getTemplates(); setItems(data); } catch (e) { toast.error('Gagal memuat templates'); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const openNew = () => { setEditing({ id: '', name: '', category: '', content: '' }); setModalOpen(true); };
  const openEdit = (item) => { setEditing({...item}); setModalOpen(true); };

  const handleSave = async () => {
    if (!editing.name || !editing.content) { toast.error('Nama dan konten wajib diisi!'); return; }
    try { await apiSaveTemplate(editing); await fetchData(); setModalOpen(false); toast.success('Template tersimpan!'); } catch (e) { toast.error('Gagal menyimpan'); }
  };

  const handleDelete = async (id) => {
    try { await apiDeleteTemplate(id); setItems(items.filter(i => i.id !== id)); toast.success('Template dihapus!'); } catch (e) { toast.error('Gagal menghapus'); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Template Pesan</h1><p className="text-slate-500 text-sm mt-0.5">Quick reply untuk broadcast</p></div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Plus className="w-4 h-4" /> Tambah Template</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200"><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Nama</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Kategori</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Konten</th><th className="text-right py-3 px-3"></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3 font-medium text-slate-900">{item.name}</td>
                  <td className="py-3 px-3"><Badge variant="secondary" className="text-xs">{item.category}</Badge></td>
                  <td className="py-3 px-3 hidden md:table-cell"><p className="text-slate-600 max-w-sm truncate">{item.content}</p></td>
                  <td className="py-3 px-3 text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600"><Edit className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button></div></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan="4" className="py-8 text-center text-slate-400">Belum ada template.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editing?.id ? 'Edit Template' : 'Tambah Template'}</DialogTitle></DialogHeader>
          {editing && (<div className="space-y-4 mt-2">
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Nama Template</label><Input value={editing.name} onChange={(e) => setEditing({...editing, name: e.target.value})} /></div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Kategori</label><Input value={editing.category} onChange={(e) => setEditing({...editing, category: e.target.value})} placeholder="Greeting, Marketing" /></div>
            <div><label className="text-sm font-medium text-slate-700 block mb-1">Konten</label><Textarea value={editing.content} onChange={(e) => setEditing({...editing, content: e.target.value})} rows={5} placeholder="Halo {nama}, ..." /><p className="text-xs text-slate-400 mt-1">Gunakan {'{nama}'} untuk variabel.</p></div>
            <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button><Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Save className="w-4 h-4" /> Simpan</Button></div>
          </div>)}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Templates;
