import React from 'react';
import { mockLogs } from '../data/mockData';
import { ScrollText, RefreshCw, ExternalLink } from 'lucide-react';
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
};

const Logs = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Logs & Debugging</h1>
          <p className="text-slate-500 text-sm mt-0.5">Sistem log untuk troubleshooting</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success('Logs diperbarui!')} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toast.info('Membuka database...')} className="gap-2">
            <ExternalLink className="w-4 h-4" /> Buka Database
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase" style={{width: '160px'}}>Waktu</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase" style={{width: '140px'}}>Tipe</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Pesan</th>
              </tr>
            </thead>
            <tbody>
              {mockLogs.map((log, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3 text-xs text-slate-500 font-mono whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-3 px-3">
                    <Badge className={`text-[10px] font-mono ${logTypeColors[log.type] || 'bg-slate-100 text-slate-500'} hover:opacity-90`}>
                      {log.type}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Logs;
