import React, { useState, useEffect, useCallback } from 'react';
import { Save, Globe, Plus, Trash2, GripVertical, ExternalLink, RefreshCw, Eye } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { getToken } from '../api/apiClient';

const API = '/api';

const fetchLP = () =>
  fetch(`${API}/lp-content`).then(r => r.json());

const saveLP = (data) =>
  fetch(`${API}/admin/lp-content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  }).then(r => { if (!r.ok) throw new Error('Gagal menyimpan'); return r.json(); });

// ─── Components ───────────────────────────────────────────────────────────
const Label = ({ children, hint }) => (
  <div className="mb-1">
    <span className="text-sm font-semibold text-slate-700">{children}</span>
    {hint && <span className="text-xs text-slate-400 ml-2">{hint}</span>}
  </div>
);

const Input = ({ value, onChange, placeholder, className = '' }) => (
  <input
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white ${className}`}
  />
);

const Textarea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white resize-none"
  />
);

const Card = ({ title, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}>
    {title && (
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      </div>
    )}
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const FeatureList = ({ items, onChange, placeholder = 'Fitur...' }) => {
  const add = () => onChange([...items, '']);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i, v) => onChange(items.map((x, idx) => idx === i ? v : x));
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
          <input
            value={item}
            onChange={e => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 mt-1">
        <Plus className="w-3.5 h-3.5" /> Tambah item
      </button>
    </div>
  );
};

// ─── Tabs ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'hero',    label: '🏠 Hero & Promo' },
  { id: 'pricing', label: '💰 Harga' },
  { id: 'faq',     label: '❓ FAQ' },
  { id: 'links',   label: '🔗 Link & CTA' },
];

// ─── Tab: Hero ─────────────────────────────────────────────────────────────
const HeroTab = ({ data, onChange }) => {
  const h = data.hero || {};
  const set = (k, v) => onChange({ ...data, hero: { ...h, [k]: v } });
  const setH = (v) => onChange({ ...data, hero: { ...h, headline: v } });

  return (
    <div className="space-y-4">
      <Card title="Promo Bar (Banner Atas)">
        <div>
          <Label hint="HTML diizinkan, gunakan <strong> untuk tebal">Teks Promo Bar</Label>
          <Textarea value={data.promo_bar} onChange={v => onChange({ ...data, promo_bar: v })} rows={2}
            placeholder="PROMO LAUNCHING — Hemat 50% · Rp 99.000 → <strong>Rp 49.000/bulan</strong>" />
        </div>
      </Card>

      <Card title="Hero — Headline Utama">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label hint="Baris 1">Baris Judul 1</Label>
            <Input value={(h.headline||[])[0]} onChange={v => setH([v, (h.headline||[])[1], (h.headline||[])[2]])} placeholder="Chatbot WhatsApp" />
          </div>
          <div>
            <Label hint="Baris 2 — bisa pakai <span class='accent italic'>...</span> untuk warna aksen">Baris Judul 2</Label>
            <Input value={(h.headline||[])[1]} onChange={v => setH([(h.headline||[])[0], v, (h.headline||[])[2]])}
              placeholder="yang <span class='accent italic'>atur diri</span>" />
          </div>
          <div>
            <Label hint="Baris 3">Baris Judul 3</Label>
            <Input value={(h.headline||[])[2]} onChange={v => setH([(h.headline||[])[0], (h.headline||[])[1], v])} placeholder="sendiri." />
          </div>
        </div>
      </Card>

      <Card title="Hero — Deskripsi & CTA">
        <div>
          <Label hint="HTML diizinkan">Teks Deskripsi</Label>
          <Textarea value={h.sub} onChange={v => set('sub', v)} rows={3}
            placeholder="Cukup ceritakan bisnis Anda..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Teks Tombol Utama</Label>
            <Input value={h.cta_primary} onChange={v => set('cta_primary', v)} placeholder="Aktifkan Rp 49rb/bln" />
          </div>
          <div>
            <Label>Teks Tombol Sekunder</Label>
            <Input value={h.cta_secondary} onChange={v => set('cta_secondary', v)} placeholder="Lihat cara kerjanya" />
          </div>
        </div>
      </Card>

      <Card title="Hero Card — Harga (Pojok Kanan)">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label hint="angka saja">Harga (Rp)</Label>
            <Input value={h.price_amount} onChange={v => set('price_amount', v)} placeholder="49" />
          </div>
          <div>
            <Label hint="mis: .000/bln">Satuan</Label>
            <Input value={h.price_period} onChange={v => set('price_period', v)} placeholder=".000/bln" />
          </div>
          <div>
            <Label hint="mis: Rp 99.000">Harga Lama</Label>
            <Input value={h.price_old} onChange={v => set('price_old', v)} placeholder="Rp 99.000" />
          </div>
        </div>
        <div>
          <Label hint="mis: Hemat 50%">Teks Diskon</Label>
          <Input value={h.price_discount} onChange={v => set('price_discount', v)} placeholder="Hemat 50%" />
        </div>
        <div>
          <Label>Fitur dalam Hero Card</Label>
          <FeatureList items={h.features || []} onChange={v => set('features', v)} placeholder="Nama fitur..." />
        </div>
      </Card>
    </div>
  );
};

// ─── Tab: Pricing ──────────────────────────────────────────────────────────
const PricingTab = ({ data, onChange }) => {
  const p = data.pricing || {};
  const set = (k, v) => onChange({ ...data, pricing: { ...p, [k]: v } });
  return (
    <div className="space-y-4">
      <Card title="Pricing Card — Harga">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label hint="mis: 49.000">Harga Promo (Rp)</Label>
            <Input value={p.amount} onChange={v => set('amount', v)} placeholder="49.000" />
          </div>
          <div>
            <Label hint="mis: 99.000">Harga Normal (Rp)</Label>
            <Input value={p.old} onChange={v => set('old', v)} placeholder="99.000" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nama Paket</Label>
            <Input value={p.name} onChange={v => set('name', v)} placeholder="Paket Lengkap" />
          </div>
          <div>
            <Label>Tagline Paket</Label>
            <Input value={p.tag} onChange={v => set('tag', v)} placeholder="Semua fitur · WAHA included" />
          </div>
        </div>
      </Card>

      <Card title="Pricing Card — Fitur List">
        <FeatureList items={p.features || []} onChange={v => set('features', v)} placeholder="Fitur yang termasuk..." />
      </Card>

      <Card title="Pricing Card — Tombol & Catatan">
        <div>
          <Label>Teks Tombol CTA</Label>
          <Input value={p.cta} onChange={v => set('cta', v)} placeholder="Aktivasi Sekarang" />
        </div>
        <div>
          <Label hint="teks kecil di bawah tombol">Catatan Bawah</Label>
          <Textarea value={p.note} onChange={v => set('note', v)} rows={2}
            placeholder="Setelah kuota promo habis..." />
        </div>
      </Card>
    </div>
  );
};

// ─── Tab: FAQ ──────────────────────────────────────────────────────────────
const FAQTab = ({ data, onChange }) => {
  const faq = data.faq || [];
  const add = () => onChange({ ...data, faq: [...faq, { q: '', a: '' }] });
  const remove = (i) => onChange({ ...data, faq: faq.filter((_, idx) => idx !== i) });
  const update = (i, field, v) => onChange({ ...data, faq: faq.map((item, idx) => idx === i ? { ...item, [field]: v } : item) });

  return (
    <div className="space-y-3">
      {faq.map((item, i) => (
        <Card key={i} title={`FAQ #${i + 1}`}>
          <div className="space-y-3">
            <div>
              <Label>Pertanyaan</Label>
              <Input value={item.q} onChange={v => update(i, 'q', v)} placeholder="Pertanyaan yang sering diajukan..." />
            </div>
            <div>
              <Label hint="HTML diizinkan">Jawaban</Label>
              <Textarea value={item.a} onChange={v => update(i, 'a', v)} rows={3}
                placeholder="Jawaban lengkap..." />
            </div>
            <div className="flex justify-end">
              <button onClick={() => remove(i)} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700">
                <Trash2 className="w-3.5 h-3.5" /> Hapus FAQ ini
              </button>
            </div>
          </div>
        </Card>
      ))}
      <button onClick={add}
        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Tambah FAQ
      </button>
    </div>
  );
};

// ─── Tab: Links & CTA ──────────────────────────────────────────────────────
const LinksTab = ({ data, onChange }) => {
  const l = data.links || {};
  const set = (k, v) => onChange({ ...data, links: { ...l, [k]: v } });
  return (
    <div className="space-y-4">
      <Card title="Link Penting">
        <div>
          <Label hint="format: https://wa.me/628xxx">Link WhatsApp (Tombol Tanya dulu)</Label>
          <Input value={l.whatsapp} onChange={v => set('whatsapp', v)} placeholder="https://wa.me/628..." />
        </div>
        <div>
          <Label hint="URL halaman aktivasi/pembelian">Link Aktivasi (Tombol Aktifkan)</Label>
          <Input value={l.activation} onChange={v => set('activation', v)} placeholder="https://..." />
        </div>
      </Card>

      <Card title="Final CTA Section (Bagian Paling Bawah)">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label hint="baris 1">Headline Baris 1</Label>
            <Input value={l.final_h1} onChange={v => set('final_h1', v)} placeholder="Saatnya bisnis Anda" />
          </div>
          <div>
            <Label hint="baris 2 — HTML diizinkan untuk styling italic">Headline Baris 2</Label>
            <Input value={l.final_h2} onChange={v => set('final_h2', v)}
              placeholder="kerja <span class='italic'>24 jam</span>." />
          </div>
          <div>
            <Label hint="HTML diizinkan">Teks Deskripsi</Label>
            <Textarea value={l.final_sub} onChange={v => set('final_sub', v)} rows={3}
              placeholder="Setiap menit chat tidak terbalas..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Teks Tombol Utama</Label>
            <Input value={l.final_cta_primary} onChange={v => set('final_cta_primary', v)}
              placeholder="Aktivasi Lisensi — Rp 49.000/bln" />
          </div>
          <div>
            <Label>Teks Tombol WhatsApp</Label>
            <Input value={l.final_cta_secondary} onChange={v => set('final_cta_secondary', v)}
              placeholder="Tanya dulu via WhatsApp" />
          </div>
        </div>
      </Card>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────
const LPEditor = () => {
  const [activeTab, setActiveTab] = useState('hero');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchLP()
      .then(d => { setData(d); setDirty(false); })
      .catch(() => toast.error('Gagal memuat konten LP'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = (d) => { setData(d); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveLP(data);
      setDirty(false);
      toast.success('Konten LP berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan konten LP');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-500" />
            Editor Landing Page
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Edit semua teks yang tampil di halaman utama <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">adminpintar.id</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <a href="/" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Preview LP
              <ExternalLink className="w-3 h-3" />
            </Button>
          </a>
          <Button onClick={handleSave} disabled={saving || !dirty}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
          </Button>
        </div>
      </div>

      {/* Dirty indicator */}
      {dirty && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Ada perubahan yang belum disimpan
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white shadow text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {data && (
        <div>
          {activeTab === 'hero'    && <HeroTab    data={data} onChange={handleChange} />}
          {activeTab === 'pricing' && <PricingTab data={data} onChange={handleChange} />}
          {activeTab === 'faq'     && <FAQTab     data={data} onChange={handleChange} />}
          {activeTab === 'links'   && <LinksTab   data={data} onChange={handleChange} />}
        </div>
      )}

      {/* Bottom save bar */}
      {dirty && (
        <div className="sticky bottom-4 flex justify-end pt-2">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-slate-600">Jangan lupa simpan perubahan Anda</span>
            <Button onClick={handleSave} disabled={saving}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LPEditor;
