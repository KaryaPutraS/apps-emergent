import React, { useState } from 'react';
import { mockLicense } from '../data/mockData';
import { Key, RefreshCw, Check, AlertCircle, Trash2, Shield, Calendar, User, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const License = () => {
  const [license, setLicense] = useState(mockLicense);
  const [licenseKey, setLicenseKey] = useState('');

  const handleActivate = () => {
    if (!licenseKey.trim()) { toast.error('License key wajib diisi.'); return; }
    toast.success('Lisensi berhasil diaktifkan!');
    setLicense({ ...mockLicense, licenseKey: licenseKey });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lisensi</h1>
          <p className="text-slate-500 text-sm mt-0.5">Aktivasi dan status lisensi aplikasi</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.success('Status lisensi diperbarui!')} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-emerald-500" /> Status Lisensi
        </h3>
        <div className={`rounded-xl p-5 border ${
          license.valid ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              license.valid ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
            }`}>
              {license.valid ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{license.valid ? 'Lisensi Aktif' : 'Lisensi Tidak Aktif'}</p>
              <Badge variant={license.valid ? 'default' : 'destructive'} className={`text-xs mt-0.5 ${license.valid ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}`}>
                {license.status}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Key className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Key:</span>
              <span className="font-mono text-slate-700">{license.licenseKey}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Customer:</span>
              <span className="text-slate-700">{license.customerName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Plan:</span>
              <span className="text-slate-700">{license.planName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Expires:</span>
              <span className="text-slate-700">{license.expiresAt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activation */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Aktivasi License Key</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">License Key</label>
            <Input
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="Masukkan license key, contoh: SATRO-CHATBOT-XXXXXX"
              className="font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleActivate} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Check className="w-4 h-4" /> Aktifkan Lisensi
            </Button>
            <Button variant="outline" onClick={() => toast.success('Status dicek ulang!')} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Cek Ulang
            </Button>
            <Button variant="outline" onClick={() => { setLicense({...license, valid: false, status: 'missing'}); toast.success('Lisensi dihapus.'); }} className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
              <Trash2 className="w-4 h-4" /> Hapus Lisensi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default License;
