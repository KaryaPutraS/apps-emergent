import React, { useState, useEffect, useRef } from 'react';
import { getBranding, updateBranding } from '../api/apiClient';
import { Palette, Save, Upload, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const applyBrandingToDocument = ({ siteName, faviconDataUrl }) => {
  if (siteName) document.title = siteName;
  if (faviconDataUrl) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconDataUrl;
  }
};

const Branding = () => {
  const [siteName, setSiteName] = useState('');
  const [faviconDataUrl, setFaviconDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    getBranding()
      .then((data) => {
        setSiteName(data.siteName || '');
        setFaviconDataUrl(data.faviconDataUrl || '');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar.');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Ukuran maksimal 1MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFaviconDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateBranding({ siteName, faviconDataUrl });
      applyBrandingToDocument(result);
      toast.success('Branding tersimpan dan diterapkan.');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFavicon = () => {
    setFaviconDataUrl('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Branding Global</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Atur favicon dan nama yang tampil di tab browser. Berlaku untuk semua user.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-emerald-500" /> Identitas Aplikasi
        </h3>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              Nama Aplikasi (judul tab browser)
            </label>
            <Input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              maxLength={60}
              placeholder="adminpintar.id"
            />
            <p className="text-xs text-slate-400 mt-1">
              Maksimal 60 karakter. Tampil di tab browser bersebelahan dengan favicon.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Favicon</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                {faviconDataUrl ? (
                  <img src={faviconDataUrl} alt="favicon" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-400">kosong</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" /> Pilih Gambar
                </Button>
                {faviconDataUrl && (
                  <Button variant="ghost" onClick={handleRemoveFavicon} className="gap-2 text-red-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" /> Hapus Favicon
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              PNG/SVG/ICO. Ukuran maksimal 1MB. Disarankan kotak 64x64 atau 128x128.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100">
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan & Terapkan
          </Button>
        </div>
      </div>
    </div>
  );
};

export { applyBrandingToDocument };
export default Branding;
