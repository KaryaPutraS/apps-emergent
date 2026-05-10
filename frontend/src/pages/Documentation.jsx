import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../App';
import { getAllDocs, getDoc, updateDoc, createDoc, deleteDoc, uploadDocImage } from '../api/apiClient';
import { toast } from 'sonner';
import {
  BookOpen, ChevronRight, Edit3, Save, X, Plus, Trash2,
  MoveUp, MoveDown, Image, Type, ListOrdered, Loader2,
  BookMarked, Eye, EyeOff, Video, Heading, Lightbulb,
  GripVertical, Bold, Italic, Link, List, Code,
  FilePlus, FileX, Check, AlertTriangle, Upload, Hash
} from 'lucide-react';
import { Button } from '../components/ui/button';

// ─── Constants ───────────────────────────────────────────────

const SECTION_TYPES = [
  { value: 'text',    label: 'Teks',     icon: Type },
  { value: 'heading', label: 'Judul',    icon: Hash },
  { value: 'step',    label: 'Langkah',  icon: ListOrdered },
  { value: 'tip',     label: 'Tips',     icon: Lightbulb },
  { value: 'image',   label: 'Gambar',   icon: Image },
  { value: 'video',   label: 'Video',    icon: Video },
];

const emptySection = (type = 'text') => ({
  type,
  content: '',
  stepNumber: null,
  stepTitle: '',
  imageUrl: '',
  imageCaption: '',
  videoUrl: '',
  videoCaption: '',
  level: 2,
});

// ─── Markdown renderer (simple) ──────────────────────────────
function renderMarkdown(text = '') {
  if (!text) return null;
  const lines = text.split('\n');
  const result = [];
  let listItems = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      result.push(<ul key={key++} className="list-disc list-inside space-y-1 my-2 text-slate-700">{listItems}</ul>);
      listItems = [];
    }
  };

  const formatInline = (str) => {
    const parts = [];
    const regex = /(\*\*(.+?)\*\*|_(.+?)_|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
    let last = 0, m;
    while ((m = regex.exec(str)) !== null) {
      if (m.index > last) parts.push(str.slice(last, m.index));
      if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
      else if (m[4]) parts.push(<code key={m.index} className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-rose-600">{m[4]}</code>);
      else if (m[5]) parts.push(<a key={m.index} href={m[6]} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline hover:text-emerald-700">{m[5]}</a>);
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts.length ? parts : str;
  };

  for (const line of lines) {
    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(<li key={key++}>{formatInline(line.slice(2))}</li>);
    } else {
      flushList();
      if (line.trim() === '') {
        result.push(<div key={key++} className="h-2" />);
      } else {
        result.push(<p key={key++} className="text-slate-700 leading-relaxed">{formatInline(line)}</p>);
      }
    }
  }
  flushList();
  return result;
}

// ─── YouTube embed helper ─────────────────────────────────────
function getYouTubeId(url = '') {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url = '') {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

// ─── SectionView (read mode) ──────────────────────────────────
const SectionView = ({ section, index }) => {
  switch (section.type) {
    case 'heading': {
      const Tag = section.level === 3 ? 'h3' : 'h2';
      const cls = section.level === 3
        ? 'text-base font-semibold text-slate-800 mt-6 mb-2'
        : 'text-lg font-bold text-slate-900 mt-8 mb-3 pb-2 border-b border-slate-200';
      return <Tag className={cls}>{section.content}</Tag>;
    }
    case 'tip':
      return (
        <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 my-4">
          <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 leading-relaxed">{renderMarkdown(section.content)}</div>
        </div>
      );
    case 'step':
      return (
        <div className="flex gap-4 py-3 border-b border-slate-100 last:border-0">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            {section.stepNumber || index + 1}
          </div>
          <div className="flex-1 min-w-0">
            {section.stepTitle && (
              <p className="font-semibold text-slate-800 mb-1">{section.stepTitle}</p>
            )}
            <div className="text-sm text-slate-600 leading-relaxed">{renderMarkdown(section.content)}</div>
          </div>
        </div>
      );
    case 'image':
      if (!section.imageUrl) return null;
      return (
        <figure className="my-6">
          <img
            src={section.imageUrl}
            alt={section.imageCaption || ''}
            className="rounded-xl border border-slate-200 max-w-full shadow-sm mx-auto block"
          />
          {section.imageCaption && (
            <figcaption className="text-xs text-slate-400 text-center mt-2 italic">{section.imageCaption}</figcaption>
          )}
        </figure>
      );
    case 'video': {
      const ytId = getYouTubeId(section.videoUrl || '');
      const vmId = getVimeoId(section.videoUrl || '');
      if (!ytId && !vmId) {
        return section.videoUrl ? (
          <div className="my-4 p-3 bg-slate-100 rounded-lg text-xs text-slate-500 text-center">
            URL video tidak dikenali: {section.videoUrl}
          </div>
        ) : null;
      }
      const src = ytId
        ? `https://www.youtube.com/embed/${ytId}`
        : `https://player.vimeo.com/video/${vmId}`;
      return (
        <figure className="my-6">
          <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={src}
              title={section.videoCaption || 'Video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
          {section.videoCaption && (
            <figcaption className="text-xs text-slate-400 text-center mt-2 italic">{section.videoCaption}</figcaption>
          )}
        </figure>
      );
    }
    default:
      return <div className="text-sm text-slate-700 leading-relaxed my-2">{renderMarkdown(section.content)}</div>;
  }
};

// ─── ImageDropZone ────────────────────────────────────────────
const ImageDropZone = ({ value, onChange, uploading, onUpload }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      await onUpload(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          dragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
            <span className="text-sm">Mengupload gambar…</span>
          </div>
        ) : value ? (
          <div className="space-y-2">
            <img src={value} alt="preview" className="max-h-32 mx-auto rounded-lg object-contain shadow-sm" />
            <p className="text-xs text-slate-400">Klik atau drop untuk ganti gambar</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Upload className="w-8 h-8" />
            <p className="text-sm font-medium text-slate-600">Drop gambar di sini</p>
            <p className="text-xs">atau klik untuk memilih file</p>
            <p className="text-xs text-slate-300">PNG, JPG, GIF — maks 5 MB</p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
};

// ─── Toolbar for textarea ─────────────────────────────────────
const TextToolbar = ({ textareaRef, value, onChange }) => {
  const wrap = (before, after = before, placeholder = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + sel.length);
    }, 0);
  };

  const insertLine = (prefix) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const line = value.slice(lineStart, start);
    const next = value.slice(0, lineStart) + prefix + (line.startsWith(prefix) ? line.slice(prefix.length) : line) + value.slice(start);
    onChange(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + prefix.length, start + prefix.length); }, 0);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-slate-200 bg-slate-50 rounded-t-lg">
      <button type="button" onClick={() => wrap('**', '**', 'bold')} title="Bold" className="p-1.5 rounded hover:bg-slate-200 text-slate-600">
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => wrap('_', '_', 'italic')} title="Italic" className="p-1.5 rounded hover:bg-slate-200 text-slate-600">
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => wrap('`', '`', 'kode')} title="Code" className="p-1.5 rounded hover:bg-slate-200 text-slate-600">
        <Code className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => wrap('[', '](url)', 'teks link')} title="Link" className="p-1.5 rounded hover:bg-slate-200 text-slate-600">
        <Link className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-slate-200 mx-1" />
      <button type="button" onClick={() => insertLine('- ')} title="List item" className="p-1.5 rounded hover:bg-slate-200 text-slate-600">
        <List className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ─── SectionEditor ────────────────────────────────────────────
const SectionEditor = ({ section, index, total, onChange, onDelete, onMove, onUploadImage, uploadingIdx }) => {
  const taRef = useRef();
  const uploading = uploadingIdx === index;

  const set = (key, val) => onChange({ ...section, [key]: val });

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
        <select
          value={section.type}
          onChange={(e) => onChange({ ...emptySection(e.target.value) })}
          className="text-xs font-medium text-slate-600 bg-transparent border-none outline-none cursor-pointer"
        >
          {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30"
          >
            <MoveUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30"
          >
            <MoveDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="p-1 rounded hover:bg-red-100 text-red-400 ml-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {section.type === 'heading' && (
          <>
            <div className="flex gap-2 mb-1">
              <button
                type="button"
                onClick={() => set('level', 2)}
                className={`text-xs px-2 py-1 rounded ${section.level === 2 ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'}`}
              >H2</button>
              <button
                type="button"
                onClick={() => set('level', 3)}
                className={`text-xs px-2 py-1 rounded ${section.level === 3 ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'}`}
              >H3</button>
            </div>
            <input
              type="text"
              value={section.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="Teks judul…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </>
        )}

        {(section.type === 'text' || section.type === 'tip') && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <TextToolbar textareaRef={taRef} value={section.content} onChange={(v) => set('content', v)} />
            <textarea
              ref={taRef}
              value={section.content}
              onChange={(e) => set('content', e.target.value)}
              rows={4}
              placeholder={section.type === 'tip' ? 'Isi tips / catatan penting…' : 'Isi teks. Gunakan **bold**, _italic_, `kode`, [link](url), - list item'}
              className="w-full px-3 py-2 text-sm outline-none resize-y min-h-[80px]"
            />
          </div>
        )}

        {section.type === 'step' && (
          <>
            <div className="flex gap-2">
              <input
                type="number"
                value={section.stepNumber ?? ''}
                onChange={(e) => set('stepNumber', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="No."
                className="w-16 px-2 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-300"
              />
              <input
                type="text"
                value={section.stepTitle}
                onChange={(e) => set('stepTitle', e.target.value)}
                placeholder="Judul langkah (opsional)…"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <TextToolbar textareaRef={taRef} value={section.content} onChange={(v) => set('content', v)} />
              <textarea
                ref={taRef}
                value={section.content}
                onChange={(e) => set('content', e.target.value)}
                rows={3}
                placeholder="Deskripsi langkah…"
                className="w-full px-3 py-2 text-sm outline-none resize-y min-h-[70px]"
              />
            </div>
          </>
        )}

        {section.type === 'image' && (
          <>
            <ImageDropZone
              value={section.imageUrl}
              onChange={(url) => set('imageUrl', url)}
              uploading={uploading}
              onUpload={(dataUrl) => onUploadImage(index, dataUrl)}
            />
            <input
              type="text"
              value={section.imageCaption}
              onChange={(e) => set('imageCaption', e.target.value)}
              placeholder="Caption gambar (opsional)…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </>
        )}

        {section.type === 'video' && (
          <>
            <input
              type="text"
              value={section.videoUrl}
              onChange={(e) => set('videoUrl', e.target.value)}
              placeholder="URL YouTube atau Vimeo…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-300"
            />
            {section.videoUrl && (
              <div className="text-xs text-slate-400 flex items-center gap-1">
                {getYouTubeId(section.videoUrl) ? (
                  <><Check className="w-3 h-3 text-emerald-500" /> YouTube terdeteksi</>
                ) : getVimeoId(section.videoUrl) ? (
                  <><Check className="w-3 h-3 text-emerald-500" /> Vimeo terdeteksi</>
                ) : (
                  <><AlertTriangle className="w-3 h-3 text-amber-400" /> URL tidak dikenali</>
                )}
              </div>
            )}
            <input
              type="text"
              value={section.videoCaption}
              onChange={(e) => set('videoCaption', e.target.value)}
              placeholder="Caption video (opsional)…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </>
        )}
      </div>
    </div>
  );
};

// ─── CreatePageModal ──────────────────────────────────────────
const CreatePageModal = ({ onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);

  const autoSlug = (t) => t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleTitleChange = (v) => {
    setTitle(v);
    if (!slugManual) setSlug(autoSlug(v));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) return;
    setSaving(true);
    try {
      await onCreate(slug, title);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat halaman.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <FilePlus className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Buat Halaman Baru</h3>
            <p className="text-xs text-slate-500">Halaman baru akan muncul di menu dokumentasi</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Judul Halaman</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Contoh: Panduan Penggunaan"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Slug URL</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
              placeholder="panduan-penggunaan"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-300 font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">Harus unik. Huruf kecil, angka, dan tanda - saja.</p>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving || !title.trim() || !slug.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FilePlus className="w-4 h-4 mr-1" />}
              Buat Halaman
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Documentation Page ──────────────────────────────────
const Documentation = () => {
  const { currentUser } = useApp();
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [pages, setPages] = useState([]);
  const [activeSlug, setActiveSlug] = useState(null);
  const [docData, setDocData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSections, setEditSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [preview, setPreview] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load page list
  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllDocs();
      setPages(data);
      if (!activeSlug && data.length > 0) setActiveSlug(data[0].slug);
    } catch {
      toast.error('Gagal memuat dokumentasi.');
    } finally {
      setLoading(false);
    }
  }, [activeSlug]);

  useEffect(() => { loadPages(); }, []);

  // Load selected page content
  useEffect(() => {
    if (!activeSlug) return;
    setLoadingDoc(true);
    setEditMode(false);
    getDoc(activeSlug)
      .then((d) => { setDocData(d); })
      .catch(() => toast.error('Gagal memuat halaman.'))
      .finally(() => setLoadingDoc(false));
  }, [activeSlug]);

  const enterEdit = () => {
    if (!docData) return;
    setEditTitle(docData.title);
    setEditSections(docData.sections.map(s => ({ ...s })));
    setPreview(false);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setPreview(false);
  };

  const addSection = (type = 'text') => {
    setEditSections(prev => [...prev, emptySection(type)]);
  };

  const updateSection = (idx, updated) => {
    setEditSections(prev => prev.map((s, i) => i === idx ? updated : s));
  };

  const deleteSection = (idx) => {
    setEditSections(prev => prev.filter((_, i) => i !== idx));
  };

  const moveSection = (idx, dir) => {
    const newSecs = [...editSections];
    const target = idx + dir;
    if (target < 0 || target >= newSecs.length) return;
    [newSecs[idx], newSecs[target]] = [newSecs[target], newSecs[idx]];
    setEditSections(newSecs);
  };

  const handleUploadImage = async (idx, dataUrl) => {
    setUploadingIdx(idx);
    try {
      const result = await uploadDocImage(dataUrl);
      updateSection(idx, { ...editSections[idx], imageUrl: result.dataUrl });
      toast.success('Gambar berhasil diupload.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal upload gambar.');
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleSave = async () => {
    if (!editTitle.trim()) { toast.error('Judul tidak boleh kosong.'); return; }
    setSaving(true);
    try {
      await updateDoc(activeSlug, { slug: activeSlug, title: editTitle, sections: editSections });
      setDocData({ ...docData, title: editTitle, sections: editSections });
      setPages(prev => prev.map(p => p.slug === activeSlug ? { ...p, title: editTitle } : p));
      setEditMode(false);
      setPreview(false);
      toast.success('Dokumentasi berhasil disimpan.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (slug, title) => {
    await createDoc(slug, title);
    toast.success('Halaman berhasil dibuat.');
    await loadPages();
    setActiveSlug(slug);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDoc(activeSlug);
      toast.success('Halaman berhasil dihapus.');
      const remaining = pages.filter(p => p.slug !== activeSlug);
      setPages(remaining);
      setActiveSlug(remaining.length > 0 ? remaining[0].slug : null);
      setDocData(null);
      setShowDeleteConfirm(false);
      setEditMode(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const currentPage = editMode ? null : docData;

  return (
    <div className="flex h-full min-h-0 bg-slate-50">
      {/* ── Sidebar ── */}
      <div className={`flex-shrink-0 border-r border-slate-200 bg-white flex flex-col transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-800">Dokumentasi</span>
          </div>
          {isSuperAdmin && !editMode && (
            <button
              onClick={() => setShowCreate(true)}
              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
              title="Buat halaman baru"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {pages.map((page) => (
            <button
              key={page.slug}
              onClick={() => { if (!editMode) { setActiveSlug(page.slug); } }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                page.slug === activeSlug
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              } ${editMode ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${page.slug === activeSlug ? 'text-emerald-500 rotate-90' : 'text-slate-300'}`} />
              <span className="truncate">{page.title}</span>
            </button>
          ))}
          {pages.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">Belum ada halaman dokumentasi.</p>
          )}
        </nav>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            {editMode ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-base font-semibold text-slate-900 bg-transparent border-b-2 border-emerald-400 outline-none pb-0.5"
                placeholder="Judul halaman…"
              />
            ) : (
              <h1 className="text-base font-semibold text-slate-900 truncate">{docData?.title || '—'}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isSuperAdmin && !editMode && docData && (
              <>
                <Button
                  size="sm"
                  onClick={enterEdit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-500 border-red-200 hover:bg-red-50 h-8 px-3 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            {editMode && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreview(v => !v)}
                  className={`h-8 px-3 text-xs ${preview ? 'bg-slate-100' : ''}`}
                >
                  {preview ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
                  {preview ? 'Editor' : 'Preview'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelEdit}
                  className="h-8 px-3 text-xs"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  Simpan
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 overflow-y-auto">
          {loadingDoc ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : !docData && !editMode ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <BookOpen className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Pilih halaman dari daftar kiri</p>
              {isSuperAdmin && (
                <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-emerald-600 hover:underline flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Buat halaman pertama
                </button>
              )}
            </div>
          ) : editMode ? (
            /* ── EDIT MODE ── */
            preview ? (
              /* Preview */
              <div className="max-w-2xl mx-auto px-6 py-8 space-y-1">
                <h1 className="text-2xl font-bold text-slate-900 mb-6">{editTitle}</h1>
                {editSections.map((s, i) => <SectionView key={i} section={s} index={i} />)}
                {editSections.length === 0 && (
                  <p className="text-slate-400 text-sm italic">Belum ada konten.</p>
                )}
              </div>
            ) : (
              /* Editor */
              <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
                {editSections.map((s, i) => (
                  <SectionEditor
                    key={i}
                    section={s}
                    index={i}
                    total={editSections.length}
                    onChange={(updated) => updateSection(i, updated)}
                    onDelete={deleteSection}
                    onMove={moveSection}
                    onUploadImage={handleUploadImage}
                    uploadingIdx={uploadingIdx}
                  />
                ))}

                {/* Add section buttons */}
                <div className="pt-2">
                  <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Tambah Konten</p>
                  <div className="flex flex-wrap gap-2">
                    {SECTION_TYPES.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => addSection(value)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            /* ── READ MODE ── */
            <div className="max-w-2xl mx-auto px-6 py-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-6">{docData.title}</h1>
              <div className="space-y-1">
                {(docData.sections || []).map((s, i) => <SectionView key={i} section={s} index={i} />)}
                {(docData.sections || []).length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Halaman ini belum memiliki konten.</p>
                    {isSuperAdmin && (
                      <button onClick={enterEdit} className="mt-2 text-sm text-emerald-600 hover:underline">
                        Klik Edit untuk mulai menambah konten
                      </button>
                    )}
                  </div>
                )}
              </div>
              {docData.updatedAt && (
                <p className="text-xs text-slate-300 mt-10 text-right">
                  Terakhir diperbarui: {new Date(docData.updatedAt).toLocaleString('id-ID')}
                  {docData.updatedBy && ` oleh ${docData.updatedBy}`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <CreatePageModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {/* ── Delete confirm ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <FileX className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Hapus Halaman?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Halaman <strong>"{docData?.title}"</strong> akan dihapus permanen dan tidak dapat dipulihkan.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Batal</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Hapus
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documentation;
