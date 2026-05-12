import React, { useState, useEffect, useCallback } from 'react';
import { getLogs, resetLogs } from '../api/apiClient';
import { formatWaktu } from '../utils/time';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const logTypeColors = {
  WEBHOOK_IN: 'bg-slate-100 text-slate-600',
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
  RESET_LOGS: 'bg-red-50 text-red-600',
  BROADCAST_SENT: 'bg-emerald-50 text-emerald-600',
  PASSWORD_CHANGED: 'bg-blue-50 text-blue-600',
  MESSAGE_IN: 'bg-blue-50 text-blue-600',
  MESSAGE_OUT: 'bg-emerald-50 text-emerald-600',
  RULE_HIT: 'bg-violet-50 text-violet-600',
  WEBHOOK_SKIP: 'bg-amber-50 text-amber-600',
  AI_ERROR: 'bg-red-50 text-red-600',
  WAHA_ERROR: 'bg-red-50 text-red-600',
  WAHA_SEND_ERROR: 'bg-red-50 text-red-600',
};

function parseSumber(log) {
  if (log.type !== 'MESSAGE_OUT') return null;
  const msg = log.message || '';
  if (msg.includes('[rule]')) return { label: 'SISTEM', cls: 'bg-violet-100 text-violet-700' };
  if (msg.includes('[ai]')) return { label: 'AI', cls: 'bg-amber-100 text-amber-700' };
  if (msg.includes('[combo]')) return { label: 'GABUNGAN', cls: 'bg-blue-100 text-blue-700' };
  return null;
}

const PAGE_SIZE = 10;

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [confirmReset, setConfirmReset] = useState(false);
  const timezone = localStorage.getItem('userTimezone') || 'WIB';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLogs(500);
      setLogs(data);
      setPage(1);
    } catch (e) {
      toast.error('Gagal memuat logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleReset = async () => {
    try {
      const res = await resetLogs();
      toast.success(res.message || 'Data log berhasil direset');
      setConfirmReset(false);
      fetchData();
    } catch (e) {
      toast.error('Gagal mereset data log');
    }
  };

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = logs.slice(pageStart, pageStart + PAGE_SIZE);

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…');
      result.push(sorted[i]);
    }
    return result;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Logs & Debugging</h1>
          <p className="text-slate-500 text-sm mt-0.5">Sistem log untuk troubleshooting</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {!confirmReset ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
              <Trash2 className="w-4 h-4" /> Reset Data Log
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">Hapus semua log?</span>
              <Button size="sm" onClick={handleReset} className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs">Ya, Hapus</Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)} className="h-8 text-xs">Batal</Button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Table header info */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-800">{logs.length} entri log</span>
          {logs.length > PAGE_SIZE && (
            <span className="font-normal text-slate-400">· halaman {currentPage}/{totalPages}</span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase" style={{width:'160px'}}>Waktu</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase" style={{width:'160px'}}>Tipe</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase" style={{width:'100px'}}>Sumber</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase">Pesan</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((log, idx) => (
                  <tr key={pageStart + idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3 text-xs text-slate-500 font-mono whitespace-nowrap">{formatWaktu(log.timestamp, timezone)}</td>
                    <td className="py-3 px-3">
                      <Badge className={`text-[10px] font-mono ${logTypeColors[log.type] || 'bg-slate-100 text-slate-500'} hover:opacity-90`}>{log.type}</Badge>
                    </td>
                    <td className="py-3 px-3">
                      {(() => { const s = parseSumber(log); return s ? <Badge className={`text-[10px] ${s.cls} hover:opacity-90`}>{s.label}</Badge> : null; })()}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{log.message}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan="4" className="py-10 text-center text-slate-400">Belum ada log.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-500">
              Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, logs.length)} dari {logs.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ Prev
              </button>
              {pageNumbers.map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} className="px-1.5 text-slate-400 text-xs">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[28px] h-7 px-2 text-xs rounded-lg border transition-colors ${
                      p === currentPage
                        ? 'bg-emerald-600 border-emerald-600 text-white font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Logs;
