import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLogs, resetLogs } from '../api/apiClient';
import { formatWaktu } from '../utils/time';
import { RefreshCw, Trash2, Search, X, Filter } from 'lucide-react';
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

const TYPE_GROUPS = [
  { label: 'Pesan', types: ['MESSAGE_IN', 'MESSAGE_OUT', 'WEBHOOK_IN', 'WEBHOOK_SKIP', 'WAHA_SEND'] },
  { label: 'Bot/AI', types: ['RULE_MATCH', 'RULE_HIT', 'AI_CALL', 'KNOWLEDGE_MATCH'] },
  { label: 'Konfigurasi', types: ['CONFIG_UPDATE', 'RULE_SAVED', 'RULE_DELETED'] },
  { label: 'Reset', types: ['RESET_CONFIG', 'RESET_MESSAGES', 'RESET_CONTACTS', 'RESET_LOGS'] },
  { label: 'Error', types: ['AI_ERROR', 'WAHA_ERROR', 'WAHA_SEND_ERROR', 'LOGIN_FAILED'] },
  { label: 'Auth', types: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'PASSWORD_CHANGED'] },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
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

  // Unique types present in current logs data
  const availableTypes = useMemo(() => {
    const s = new Set(logs.map(l => l.type));
    return [...s].sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let result = logs;
    if (filterType) result = result.filter(l => l.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => (l.message || '').toLowerCase().includes(q) || (l.type || '').toLowerCase().includes(q));
    }
    return result;
  }, [logs, filterType, searchQuery]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterType, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredLogs.slice(pageStart, pageStart + PAGE_SIZE);

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

  const hasFilters = filterType || searchQuery.trim();

  return (
    <div className="space-y-4">
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

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari pesan log..."
            className="w-full h-9 pl-9 pr-8 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 pl-8 pr-8 text-sm border border-slate-200 rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-[160px]"
          >
            <option value="">Semua Tipe</option>
            {TYPE_GROUPS.map(g => (
              <optgroup key={g.label} label={`── ${g.label} ──`}>
                {g.types.filter(t => availableTypes.includes(t)).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </optgroup>
            ))}
            {/* Types not in any group */}
            {availableTypes
              .filter(t => !TYPE_GROUPS.flatMap(g => g.types).includes(t))
              .map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <button
            onClick={() => { setSearchQuery(''); setFilterType(''); }}
            className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 hover:border-red-200 hover:bg-red-50 transition-colors"
          >
            <X className="w-3 h-3" /> Hapus Filter
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Table header info */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm text-slate-500 flex-wrap">
          <span className="font-semibold text-slate-800">
            {hasFilters
              ? <>{filteredLogs.length} hasil <span className="font-normal text-slate-400">dari {logs.length} total entri</span></>
              : <>{logs.length} entri log</>
            }
          </span>
          {filteredLogs.length > PAGE_SIZE && (
            <span className="text-slate-400">· halaman {currentPage}/{totalPages}</span>
          )}
          {filterType && (
            <Badge className={`text-[10px] font-mono ${logTypeColors[filterType] || 'bg-slate-100 text-slate-500'}`}>{filterType}</Badge>
          )}
        </div>

        {loading ? (
          <div className="space-y-0">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3 border-b border-slate-100">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-32 shrink-0" />
                <div className="h-4 bg-slate-200 rounded animate-pulse w-28 shrink-0" />
                <div className="h-4 bg-slate-200 rounded animate-pulse w-16 shrink-0 hidden sm:block" />
                <div className="h-4 bg-slate-200 rounded animate-pulse flex-1" />
              </div>
            ))}
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
                    <td className="py-3 px-3 text-slate-600">
                      {searchQuery ? (
                        <HighlightText text={log.message || ''} query={searchQuery} />
                      ) : (
                        log.message
                      )}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-10 text-center text-slate-400">
                      {hasFilters ? 'Tidak ada log yang cocok dengan filter.' : 'Belum ada log.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-500">
              Menampilkan {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredLogs.length)} dari {filteredLogs.length}
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

// Highlight matching text in search results
const HighlightText = ({ text, query }) => {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
};

export default Logs;
