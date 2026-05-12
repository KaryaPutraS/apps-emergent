import React, { useState, useEffect, useMemo } from 'react';
import { getTemplates, saveTemplate as apiSaveTemplate, deleteTemplate as apiDeleteTemplate } from '../api/apiClient';
import { Plus, Edit, Trash2, Save, Search, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';

const SortIcon = ({ col, sortCol, sortDir }) => {
  if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-300 inline" />;
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1 text-emerald-500 inline" />
    : <ArrowDown className="w-3 h-3 ml-1 text-emerald-500 inline" />;
};

const Templates = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const fetchData = async () => {
    try { setLoading(true); const data = await getTemplates(); setItems(data); } catch (e) { toast.error('Gagal memuat templates'); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q) ||
        (i.content || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let av = (a[sortCol] ?? '').toLowerCase();
      let bv = (b[sortCol] ?? '').toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [items, searchQuery, sortCol, sortDir]);

  const openNew = () => { setEditing({ id: '', name: '', category: '', content: '' }); setModalOpen(true); };
  const openEdit = (item) => { setEditing({...item}); setModalOpen(true); };

  const handleSave = async () => {
    if (!editing.name || !editing.content) { toast.error('Nama dan konten wajib diisi!'); return; }
    try { await apiSaveTemplate(editing); await fetchData(); setModalOpen(false); toast.success('Template tersimpan!'); } catch (e) { toast.error('Gagal menyimpan'); }
  };

  const handleDelete = async (id) => {
    try { await apiDeleteTemplate(id); setItems(items.filter(i => i.id !== id)); toast.success('Template dihapus!'); } catch (e) { toast.error('Gagal menghapus'); }
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-slate-200 rounded-lg animate-pulse w-40" />
          <div className="h-4 bg-slate-200 rounded animate-pulse w-48" />
        </div>
        <div className="h-9 bg-slate-200 rounded-lg animate-pulse w-40" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 py-2 border-b border-slate-100">
              <div className="h-4 bg-slate-200 rounded animate-pulse w-32" />
              <div className="h-5 bg-slate-200 rounded-full animate-pulse w-20" />
              <div className="h-4 bg-slate-200 rounded animate-pulse w-56 hidden md:block" />
              <div className="h-6 bg-slate-200 rounded animate-pulse w-16 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const thClass = "text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none whitespace-nowrap";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Template Pesan</h1><p className="text-slate-500 text-sm mt-0.5">Quick reply untuk broadcast</p></div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Plus className="w-4 h-4" /> Tambah Template</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* Search bar */}
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, kategori, atau konten..."
            className="w-full h-9 pl-9 pr-8 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className={thClass} onClick={() => toggleSort('name')}>
                  Nama <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('category')}>
                  Kategori <SortIcon col="category" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Konten</th>
                <th className="text-right py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3 font-medium text-slate-900">{item.name}</td>
                  <td className="py-3 px-3"><Badge variant="secondary" className="text-xs">{item.category}</Badge></td>
                  <td className="py-3 px-3 hidden md:table-cell"><p className="text-slate-600 max-w-sm truncate">{item.content}</p></td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label="Edit template" onClick={() => openEdit(item)} className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600"><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" aria-label="Hapus template" onClick={() => handleDelete(item.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr><td colSpan="4" className="py-8 text-center text-slate-400">
                  {searchQuery ? 'Tidak ada template yang cocok.' : 'Belum ada template.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {searchQuery && filteredItems.length > 0 && (
          <p className="text-xs text-slate-400 mt-3">{filteredItems.length} dari {items.length} template</p>
        )}
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
