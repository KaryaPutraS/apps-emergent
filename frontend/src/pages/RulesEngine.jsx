import React, { useState, useEffect, useMemo } from 'react';
import { getRules, saveRule as apiSaveRule, deleteRule as apiDeleteRule, toggleRule as apiToggleRule } from '../api/apiClient';
import { Plus, Edit, Trash2, Save, Image, Search, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';

const triggerTypes = [
  { value: 'contains', label: 'Contains (kata kunci)' },
  { value: 'exact', label: 'Exact Match' },
  { value: 'regex', label: 'Regex' },
  { value: 'startsWith', label: 'Starts With' },
];

const responseModes = [
  { value: 'direct', label: 'Langsung kirim teks rule' },
  { value: 'ai_polish', label: 'Teks rule + dipoles AI' },
  { value: 'ai_context', label: 'Pakai AI sepenuhnya' },
];

const SortIcon = ({ col, sortCol, sortDir }) => {
  if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-300 inline" />;
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1 text-emerald-500 inline" />
    : <ArrowDown className="w-3 h-3 ml-1 text-emerald-500 inline" />;
};

const RulesEngine = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState('priority');
  const [sortDir, setSortDir] = useState('asc');

  const fetchRules = async () => {
    try {
      setLoading(true);
      const data = await getRules();
      setRules(data);
    } catch (e) { toast.error('Gagal memuat rules'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchRules(); }, []);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filteredRules = useMemo(() => {
    let result = [...rules];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.triggerValue || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol === 'isActive') { av = a.isActive ? 1 : 0; bv = b.isActive ? 1 : 0; }
      if (sortCol === 'hitCount') { av = a.hitCount || 0; bv = b.hitCount || 0; }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [rules, searchQuery, sortCol, sortDir]);

  const emptyRule = { id: '', priority: rules.length + 1, name: '', triggerType: 'contains', triggerValue: '', response: '', isActive: true, hitCount: 0, responseMode: 'direct', imageUrl: '', imageCaption: '' };

  const openNew = () => { setEditingRule({...emptyRule}); setModalOpen(true); };
  const openEdit = (rule) => { setEditingRule({...rule}); setModalOpen(true); };

  const handleSave = async () => {
    if (!editingRule.name || !editingRule.triggerValue || !editingRule.response) { toast.error('Lengkapi data rule!'); return; }
    try {
      await apiSaveRule(editingRule);
      await fetchRules();
      setModalOpen(false);
      toast.success('Rule tersimpan!');
    } catch (e) { toast.error('Gagal menyimpan rule'); }
  };

  const handleDelete = async (id) => {
    try {
      await apiDeleteRule(id);
      setRules(rules.filter(r => r.id !== id));
      toast.success('Rule dihapus!');
    } catch (e) { toast.error('Gagal menghapus rule'); }
  };

  const handleToggle = async (id) => {
    try {
      const res = await apiToggleRule(id);
      setRules(rules.map(r => r.id === id ? {...r, isActive: res.isActive} : r));
    } catch (e) { toast.error('Gagal mengubah status'); }
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-slate-200 rounded-lg animate-pulse w-40" />
          <div className="h-4 bg-slate-200 rounded animate-pulse w-64" />
        </div>
        <div className="h-9 bg-slate-200 rounded-lg animate-pulse w-32" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="h-4 bg-slate-200 rounded animate-pulse w-80 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 py-2 border-b border-slate-100">
              <div className="h-4 bg-slate-200 rounded animate-pulse w-8" />
              <div className="h-4 bg-slate-200 rounded animate-pulse w-32" />
              <div className="h-4 bg-slate-200 rounded animate-pulse w-20 hidden md:block" />
              <div className="h-4 bg-slate-200 rounded animate-pulse w-40 hidden lg:block" />
              <div className="h-4 bg-slate-200 rounded animate-pulse w-10 ml-auto" />
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
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rules Engine</h1>
          <p className="text-slate-500 text-sm mt-0.5">Auto-reply otomatis tanpa konsumsi token AI</p>
        </div>
        <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Plus className="w-4 h-4" /> Tambah Rule</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-sm text-slate-500 mb-4">Rules dieksekusi <strong>sebelum AI</strong> berdasarkan prioritas (angka kecil = prioritas tinggi).</p>

        {/* Search bar */}
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau trigger value..."
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
                <th className={thClass} onClick={() => toggleSort('priority')}>
                  Prio <SortIcon col="priority" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className={thClass} onClick={() => toggleSort('name')}>
                  Nama <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className={`${thClass} hidden md:table-cell`} onClick={() => toggleSort('triggerType')}>
                  Tipe <SortIcon col="triggerType" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Trigger</th>
                <th className={thClass} onClick={() => toggleSort('hitCount')}>
                  Hits <SortIcon col="hitCount" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Media</th>
                <th className={thClass} onClick={() => toggleSort('isActive')}>
                  Status <SortIcon col="isActive" sortCol={sortCol} sortDir={sortDir} />
                </th>
                <th className="text-right py-3 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-600">{rule.priority}</td>
                  <td className="py-3 px-3 font-medium text-slate-900">{rule.name}</td>
                  <td className="py-3 px-3 hidden md:table-cell"><Badge variant="secondary" className="text-xs font-normal">{rule.triggerType}</Badge></td>
                  <td className="py-3 px-3 hidden lg:table-cell"><code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 max-w-[200px] truncate block">{rule.triggerValue}</code></td>
                  <td className="py-3 px-3 text-slate-600">{rule.hitCount || 0}</td>
                  <td className="py-3 px-3">{rule.imageUrl ? <Image className="w-4 h-4 text-blue-500" /> : <span className="text-slate-300">-</span>}</td>
                  <td className="py-3 px-3"><Switch checked={rule.isActive} onCheckedChange={() => handleToggle(rule.id)} /></td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label="Edit rule" onClick={() => openEdit(rule)} className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600"><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" aria-label="Hapus rule" onClick={() => handleDelete(rule.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRules.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    {searchQuery ? 'Tidak ada rule yang cocok.' : 'Belum ada rules. Klik "Tambah Rule" untuk memulai.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {searchQuery && filteredRules.length > 0 && (
          <p className="text-xs text-slate-400 mt-3">{filteredRules.length} dari {rules.length} rules</p>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingRule?.id ? 'Edit Rule' : 'Tambah Rule Baru'}</DialogTitle></DialogHeader>
          {editingRule && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-slate-700 block mb-1">Prioritas</label><Input type="number" value={editingRule.priority} onChange={(e) => setEditingRule({...editingRule, priority: parseInt(e.target.value)||0})} /></div>
                <div><label className="text-sm font-medium text-slate-700 block mb-1">Nama Rule</label><Input value={editingRule.name} onChange={(e) => setEditingRule({...editingRule, name: e.target.value})} placeholder="Nama rule" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-slate-700 block mb-1">Tipe Trigger</label><select value={editingRule.triggerType} onChange={(e) => setEditingRule({...editingRule, triggerType: e.target.value})} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">{triggerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                <div><label className="text-sm font-medium text-slate-700 block mb-1">Mode Balasan</label><select value={editingRule.responseMode} onChange={(e) => setEditingRule({...editingRule, responseMode: e.target.value})} className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">{responseModes.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
              </div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Trigger Value</label><Input value={editingRule.triggerValue} onChange={(e) => setEditingRule({...editingRule, triggerValue: e.target.value})} placeholder="kata1|kata2|kata3" /><p className="text-xs text-slate-400 mt-1">Pisahkan kata kunci dengan | (pipe)</p></div>
              <div><label className="text-sm font-medium text-slate-700 block mb-1">Balasan</label><Textarea value={editingRule.response} onChange={(e) => setEditingRule({...editingRule, response: e.target.value})} rows={4} placeholder="Isi balasan..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-slate-700 block mb-1">Image URL</label><Input value={editingRule.imageUrl || ''} onChange={(e) => setEditingRule({...editingRule, imageUrl: e.target.value})} /></div>
                <div><label className="text-sm font-medium text-slate-700 block mb-1">Image Caption</label><Input value={editingRule.imageCaption || ''} onChange={(e) => setEditingRule({...editingRule, imageCaption: e.target.value})} /></div>
              </div>
              <div className="flex items-center gap-3"><Switch checked={editingRule.isActive} onCheckedChange={(v) => setEditingRule({...editingRule, isActive: v})} /><span className="text-sm text-slate-700">Rule Aktif</span></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
                <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 gap-2"><Save className="w-4 h-4" /> Simpan</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RulesEngine;
