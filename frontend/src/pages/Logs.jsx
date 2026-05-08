import React, { useState, useEffect } from 'react';
import { getLogs } from '../api/apiClient';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const logTypeColors = {
  WEBHOOK_IN: 'bg-blue-50 text-blue-600',
  RULE_MATCH: 'bg-violet-50 text-violet-600',
  KNOWLEDGE_MATCH: 'bg-indigo-50 text-indigo-600',
  AI_CALL: 'bg-amber-50 text-amber-600',
  WAHA_SEND: 'bg-emerald-50 text-emerald-600',
  SYSTEM: 'bg-slate-100 text-slate-600',
  CLEANUP: 'bg-slate-100 text-slate-500',
  LOGIN_SUCCESS: 'bg-emerald-50 text-emerald-600',
  LOGIN_FAILED: 'bg-red-50 text-red-600',
  CONFIG_UPDATE: 'bg-blue-50 text-blue-600',
  RULE_SAVED: 'bg-violet-50 text-violet-600',
  RULE_DELETED: 'bg-red-50 text-red-600',
  RESET_CONFIG: 'bg-amber-50 text-amber-600',
  RESET_MESSAGES: 'bg-amber-50 text-amber-600',
  RESET_CONTACTS: 'bg-amber-50 text-amber-600',
  BROADCAST_SENT: 'bg-emerald-50 text-emerald-600',
  PASSWORD_CHANGED: 'bg-blue-50 text-blue-600',
};

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try { setLoading(true); const data = await getLogs(100); setLogs(data); } catch (e) { toast.error('Gagal memuat logs'); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Logs & Debugging</h1><p className="text-slate-500 text-sm mt-0.5">Sistem log untuk troubleshooting</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchData(); toast.success('Logs diperbarui!'); }} className="gap-2"><RefreshCw className="w-4 h-4" /> Refresh</Button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {loading ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200"><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase" style={{width:'160px'}}>Waktu</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase" style={{width:'160px'}}>Tipe</th><th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Pesan</th></tr></thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3 text-xs text-slate-500 font-mono whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-3 px-3"><Badge className={`text-[10px] font-mono ${logTypeColors[log.type] || 'bg-slate-100 text-slate-500'} hover:opacity-90`}>{log.type}</Badge></td>
                    <td className="py-3 px-3 text-slate-600">{log.message}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan="3" className="py-8 text-center text-slate-400">Belum ada log.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Logs;
