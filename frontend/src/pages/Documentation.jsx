import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../App';
import { getAllDocs, getDoc, updateDoc, uploadDocImage } from '../api/apiClient';
import { toast } from 'sonner';
import {
  BookOpen, ChevronRight, Edit3, Save, X, Plus, Trash2,
  MoveUp, MoveDown, Image, Type, ListOrdered, Loader2,
  BookMarked, AlertCircle, Upload, Eye
} from 'lucide-react';
import { Button } from '../components/ui/button';

// ─── helpers ────────────────────────────────────────────────
const MENU_LABELS = {
  dashboard: 'Dashboard', license: 'Lisensi', connections: 'Koneksi',
  'ai-agent': 'AI Agent', rules: 'Rules Engine', knowledge: 'Knowledge Base',
  templates: 'Template', contacts: 'Kontak', messages: 'Pesan',
  broadcast: 'Broadcast', 'ai-setup': 'AI Setup', 'test-center': 'Test Center',
  logs: 'Logs', settings: 'Setting',
};

const SECTION_TYPES = [
  { value: 'text',  label: 'Teks',  icon: Type },
  { value: 'step',  label: 'Langkah', icon: ListOrdered },
  { value: 'image', label: 'Gambar', icon: Image },
];

const emptySection = (type = 'text') => ({
  type, content: '', stepNumber: null, stepTitle: '', imageUrl: '', imageCaption: '',
});

// ─── SectionView ────────────────────────────────────────────
const SectionView = ({ section, index }) => {
  if (section.type === 'image') {
    if (!section.imageUrl) return null;
    return (
      <figure className="my-4">
        <img src={section.imageUrl} alt={section.imageCaption || ''} className="rounded-xl border border-slate-200 max-w-full shadow-sm" />
        {section.imageCaption && (
          <figcaption className="text-xs text-slate-400 text-center mt-2">{section.imageCaption}</figcaption>
        )}
      </figure>
    );
  }
  if (section.type === 'step') {
    return (
      <div className="flex gap-4 py-3 border-b border-slate-100 last:border-0">
        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
          {section.stepNumber || index + 1}
        </div>
        <div className="flex-1 min-w-0">
          {section.stepTitle && <p className="font-semibold text-slate-800 mb-0.5">{section.stepTitle}</p>}
          {section.content && <p className="text-sm text-slate-600 leading-relaxed">{section.content}</p>}
        </div>
      </div>
    );
  }
  return <p className="text-slate-700 leading-relaxed mb-3 text-sm">{section.content}</p>;
};

// ─── SectionEditor ───────────────────────────────────────────
const SectionEditor = ({ section, index, total, onChange, onDelete, onMove, onImageUpload }) => {
  const fileInputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('File harus berupa gambar'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Ukuran gambar maksimal 5MB'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const result = await onImageUpload(ev.target.result);
        onChange({ ...section, imageUrl: result.dataUrl });
      } catch {
        toast.error('Gagal upload gambar');
      } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
      {/* header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          {SECTION_TYPES.map(t => (
            <button key={t.value}
              onClick={() => onChange({ ...emptySection(t.value), stepNumber: section.stepNumber })}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                section.type === t.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              <t.icon className="w-3 h-3" />{t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => onMove(index, -1)} disabled={index === 0}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition-colors">
            <MoveUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-500 transition-colors">
            <MoveDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(index)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* fields */}
      {section.type === 'text' && (
        <textarea value={section.content} onChange={e => onChange({ ...section, content: e.target.value })}
          placeholder="Tulis teks penjelasan..."
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[80px]" />
      )}

      {section.type === 'step' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input type="number" value={section.stepNumber || ''} onChange={e => onChange({ ...section, stepNumber: parseInt(e.target.value) || null })}
              placeholder="No." min={1}
              className="w-16 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <input type="text" value={section.stepTitle} onChange={e => onChange({ ...section, stepTitle: e.target.value })}
              placeholder="Judul langkah..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <textarea value={section.content} onChange={e => onChange({ ...section, content: e.target.value })}
            placeholder="Penjelasan langkah ini..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[60px]" />
        </div>
      )}

      {section.type === 'image' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input type="text" value={section.imageUrl} onChange={e => onChange({ ...section, imageUrl: e.target.value })}
              placeholder="URL gambar atau upload..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Upload
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
          </div>
          <input type="text" value={section.imageCaption} onChange={e => onChange({ ...section, imageCaption: e.target.value })}
            placeholder="Keterangan gambar (opsional)"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          {section.imageUrl && (
            <img src={section.imageUrl} alt="preview" className="max-h-40 rounded-lg border border-slate-200 object-contain" />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────
const Documentation = () => {
  const { currentUser } = useApp();
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [docList, setDocList] = useState([]);
  const [activeSlug, setActiveSlug] = useState('dashboard');
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSections, setEditSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    getAllDocs()
      .then(list => {
        setDocList(list);
        if (list.length && !list.find(d => d.slug === activeSlug)) {
          setActiveSlug(list[0].slug);
        }
      })
      .catch(() => toast.error('Gagal memuat daftar dokumentasi'));
  }, []);

  useEffect(() => {
    if (!activeSlug) return;
    setLoading(true);
    setEditMode(false);
    getDoc(activeSlug)
      .then(d => { setDoc(d); setLoading(false); })
      .catch(() => { setLoading(false); toast.error('Gagal memuat dokumentasi'); });
  }, [activeSlug]);

  const startEdit = () => {
    setEditTitle(doc.title);
    setEditSections(doc.sections ? doc.sections.map(s => ({ ...s })) : []);
    setEditMode(true);
    setPreview(false);
  };

  const cancelEdit = () => { setEditMode(false); setPreview(false); };

  const handleSave = async () => {
    if (!editTitle.trim()) { toast.error('Judul tidak boleh kosong'); return; }
    setSaving(true);
    try {
      await updateDoc(activeSlug, { slug: activeSlug, title: editTitle, sections: editSections });
      const updated = await getDoc(activeSlug);
      setDoc(updated);
      setDocList(prev => prev.map(d => d.slug === activeSlug ? { ...d, title: updated.title } : d));
      setEditMode(false);
      toast.success('Dokumentasi berhasil disimpan');
    } catch {
      toast.error('Gagal menyimpan dokumentasi');
    } finally { setSaving(false); }
  };

  const addSection = (type) => {
    const s = emptySection(type);
    if (type === 'step') {
      const lastStep = [...editSections].reverse().find(x => x.type === 'step');
      s.stepNumber = lastStep ? (lastStep.stepNumber || 0) + 1 : 1;
    }
    setEditSections(prev => [...prev, s]);
  };

  const updateSection = useCallback((index, updated) => {
    setEditSections(prev => prev.map((s, i) => i === index ? updated : s));
  }, []);

  const deleteSection = useCallback((index) => {
    setEditSections(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveSection = useCallback((index, dir) => {
    setEditSections(prev => {
      const arr = [...prev];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }, []);

  const handleImageUpload = useCallback(async (dataUrl) => {
    return await uploadDocImage(dataUrl);
  }, []);

  const displayedSections = editMode && preview ? editSections : (doc?.sections || []);

  return (
    <div className="flex h-full gap-0 -m-4 lg:-m-6">
      {/* Sidebar daftar menu */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-sm text-slate-800">Menu Panduan</h3>
          </div>
        </div>
        <nav className="p-2 space-y-0.5">
          {docList.length === 0 && (
            <p className="text-xs text-slate-400 px-3 py-2">Memuat...</p>
          )}
          {docList.map(d => (
            <button key={d.slug} onClick={() => setActiveSlug(d.slug)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSlug === d.slug
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}>
              <span>{MENU_LABELS[d.slug] || d.title}</span>
              {activeSlug === d.slug && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ))}
        </nav>
      </aside>

      {/* Konten utama */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-2xl mx-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : !doc ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <AlertCircle className="w-10 h-10 mb-3" />
              <p>Dokumentasi tidak ditemukan</p>
            </div>
          ) : editMode ? (
            /* ── EDIT MODE ── */
            <div className="space-y-4">
              {/* toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-slate-800 flex-1 min-w-0">Edit Dokumentasi</h2>
                <button onClick={() => setPreview(p => !p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    preview ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  <Eye className="w-3.5 h-3.5" />{preview ? 'Edit' : 'Preview'}
                </button>
                <button onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                  <X className="w-3.5 h-3.5" />Batal
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Simpan
                </button>
              </div>

              {!preview && (
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  placeholder="Judul halaman..."
                  className="w-full text-xl font-bold border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
              )}

              {preview ? (
                /* preview mode */
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                  <h1 className="text-2xl font-bold text-slate-900 mb-6">{editTitle}</h1>
                  {editSections.map((s, i) => <SectionView key={i} section={s} index={i} />)}
                  {editSections.length === 0 && <p className="text-slate-400 text-sm">Belum ada konten.</p>}
                </div>
              ) : (
                /* edit sections */
                <>
                  <div className="space-y-3">
                    {editSections.map((s, i) => (
                      <SectionEditor key={i} section={s} index={i} total={editSections.length}
                        onChange={u => updateSection(i, u)}
                        onDelete={deleteSection}
                        onMove={moveSection}
                        onImageUpload={handleImageUpload} />
                    ))}
                  </div>

                  {/* add section buttons */}
                  <div className="flex gap-2 flex-wrap pt-2">
                    {SECTION_TYPES.map(t => (
                      <button key={t.value} onClick={() => addSection(t.value)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded-xl text-sm transition-colors">
                        <Plus className="w-3.5 h-3.5" />Tambah {t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ── READ MODE ── */
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-emerald-600 font-medium uppercase tracking-wider">Panduan</span>
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
                  {doc.updatedAt && (
                    <p className="text-xs text-slate-400 mt-1">
                      Diperbarui: {new Date(doc.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {doc.updatedBy && ` oleh ${doc.updatedBy}`}
                    </p>
                  )}
                </div>
                {isSuperAdmin && (
                  <Button onClick={startEdit} variant="outline" size="sm"
                    className="flex items-center gap-1.5 text-slate-600 flex-shrink-0">
                    <Edit3 className="w-3.5 h-3.5" />Edit
                  </Button>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                {doc.sections && doc.sections.length > 0 ? (
                  doc.sections.map((s, i) => <SectionView key={i} section={s} index={i} />)
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Belum ada konten dokumentasi.</p>
                    {isSuperAdmin && (
                      <button onClick={startEdit} className="mt-3 text-sm text-emerald-600 hover:underline">
                        Klik untuk menambahkan
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Documentation;
