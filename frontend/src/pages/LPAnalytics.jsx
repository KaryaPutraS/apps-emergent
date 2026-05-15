import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, Users, Eye, MousePointerClick, Clock, TrendingUp, Globe,
  Monitor, Smartphone, RefreshCw, ArrowDownToLine,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { getToken } from '../api/apiClient';

const API = '/api';

const fetchAnalytics = (days) =>
  fetch(`${API}/admin/lp-analytics?days=${days}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  }).then(r => { if (!r.ok) throw new Error('failed'); return r.json(); });

const fmtDuration = (ms) => {
  if (!ms || ms < 1000) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
};

const fmtRelTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return Math.round(diff) + 's lalu';
  if (diff < 3600) return Math.round(diff / 60) + 'm lalu';
  if (diff < 86400) return Math.round(diff / 3600) + 'j lalu';
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
};

const StatCard = ({ icon: Icon, label, value, sublabel, accent = 'emerald' }) => {
  const accents = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50 text-blue-600',
    purple:  'bg-purple-50 text-purple-600',
    amber:   'bg-amber-50 text-amber-600',
    rose:    'bg-rose-50 text-rose-600',
    slate:   'bg-slate-100 text-slate-700',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
      <div className={`p-2.5 rounded-lg ${accents[accent]} flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-900 mt-0.5 truncate">{value}</div>
        {sublabel && <div className="text-xs text-slate-400 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
};

const Card = ({ title, children, action }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
      <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const BarRow = ({ label, value, max, color = 'bg-emerald-500' }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="text-sm text-slate-700 w-32 truncate flex-shrink-0">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden relative">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
        <div className="absolute inset-0 px-2 flex items-center text-xs font-medium text-slate-700">
          {value.toLocaleString('id-ID')}
        </div>
      </div>
    </div>
  );
};

const TopList = ({ items, color = 'bg-emerald-500', labelMap }) => {
  if (!items?.length) return <div className="text-sm text-slate-400 text-center py-4">Belum ada data</div>;
  const max = Math.max(...items.map(i => i.count));
  return (
    <div className="space-y-0.5">
      {items.map((it, i) => (
        <BarRow key={i} label={labelMap ? labelMap(it.key) : (it.key || '(direct)')} value={it.count} max={max} color={color} />
      ))}
    </div>
  );
};

const Timeline = ({ data }) => {
  if (!data?.length) return <div className="text-sm text-slate-400 text-center py-8">Belum ada data</div>;
  const max = Math.max(...data.map(d => d.views), 1);
  return (
    <div className="flex items-end gap-1 h-40">
      {data.map((d, i) => {
        const h = (d.views / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{d.views}</div>
            <div className="w-full bg-emerald-500 rounded-t hover:bg-emerald-600 relative" style={{ height: `${Math.max(h, 2)}%` }}>
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {d.date}<br/>{d.views} views · {d.unique} unique
              </div>
            </div>
            <div className="text-[9px] text-slate-400 truncate w-full text-center">{d.date.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
};

const EVENT_BADGE = {
  pageview:  { label: 'View',     cls: 'bg-emerald-50 text-emerald-700' },
  click:     { label: 'Click',    cls: 'bg-blue-50 text-blue-700' },
  scroll:    { label: 'Scroll',   cls: 'bg-purple-50 text-purple-700' },
  heartbeat: { label: 'Active',   cls: 'bg-amber-50 text-amber-700' },
  unload:    { label: 'Leave',    cls: 'bg-slate-100 text-slate-600' },
};

const TARGET_LABEL = {
  activation: '💎 Aktivasi',
  whatsapp:   '💬 WhatsApp',
  sticky:     '📌 Sticky CTA',
  'nav-cta':  '🔝 Nav CTA',
  'faq-open': '❓ FAQ',
  logo:       '🏷️ Logo',
};
const targetLabel = (t) => TARGET_LABEL[t] || (t?.startsWith('nav:') ? '🔗 ' + t.slice(4) : (t || '—'));

const SCROLL_LABELS = { 0: '< 25%', 25: '25–50%', 50: '50–75%', 75: '75–100%', 100: '100% (selesai)', other: 'lainnya' };

const LPAnalytics = () => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchAnalytics(days)
      .then(setData)
      .catch(() => toast.error('Gagal memuat analytics'))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary;

  const downloadCSV = () => {
    if (!data?.recent_events?.length) return;
    const headers = ['ts','session_id','event_type','target','template','country','browser','os','device','scroll_pct','referrer'];
    const rows = data.recent_events.map(e => headers.map(h => JSON.stringify(e[h] ?? '')).join(','));
    const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `lp-events-${days}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-500" />
            Analytics Landing Page
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Pantau jumlah pengunjung, durasi, klik CTA, dan performa template LP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {[1, 7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${days === d ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                {d}h
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5" disabled={!data?.recent_events?.length}>
            <ArrowDownToLine className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Eye} label="Total Pageviews" value={summary.total_views.toLocaleString('id-ID')}
              sublabel={`${summary.total_events.toLocaleString('id-ID')} total events`} accent="emerald" />
            <StatCard icon={Users} label="Unique Visitors" value={summary.unique_visitors.toLocaleString('id-ID')}
              sublabel={`Bounce rate ${summary.bounce_rate}%`} accent="blue" />
            <StatCard icon={MousePointerClick} label="Conversions" value={summary.conversions.toLocaleString('id-ID')}
              sublabel={`Conv rate ${summary.conv_rate}%`} accent="purple" />
            <StatCard icon={Clock} label="Avg. Duration" value={fmtDuration(summary.avg_duration_ms)}
              sublabel={`Median ${fmtDuration(summary.median_duration_ms)}`} accent="amber" />
          </div>

          {/* Timeline */}
          <Card title={`Pageviews per Hari (${days} hari terakhir)`}>
            <Timeline data={data.timeline} />
          </Card>

          {/* Template performance + Conversion targets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="🎭 Performa Template (A/B Test)">
              {data.template_performance?.length ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="pb-2 font-medium">Template</th>
                      <th className="pb-2 font-medium text-right">Sessions</th>
                      <th className="pb-2 font-medium text-right">Klik CTA</th>
                      <th className="pb-2 font-medium text-right">Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.template_performance.map(t => (
                      <tr key={t.template} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 font-medium text-slate-800 capitalize">{t.template}</td>
                        <td className="py-2.5 text-right">{t.sessions.toLocaleString('id-ID')}</td>
                        <td className="py-2.5 text-right">{t.converted.toLocaleString('id-ID')}</td>
                        <td className="py-2.5 text-right">
                          <span className={`font-bold ${t.conv_rate >= 5 ? 'text-emerald-600' : t.conv_rate >= 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                            {t.conv_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="text-sm text-slate-400 text-center py-4">Belum ada data</div>}
            </Card>

            <Card title="🎯 Klik CTA / Target">
              <TopList items={data.top_targets} color="bg-blue-500" labelMap={targetLabel} />
            </Card>
          </div>

          {/* Scroll depth + Referrers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="📜 Scroll Depth (kedalaman gulir)">
              <TopList items={data.scroll_distribution?.map(s => ({ key: s.bucket, count: s.count }))}
                color="bg-purple-500" labelMap={(k) => SCROLL_LABELS[k] || k} />
            </Card>

            <Card title="🌐 Top Referrers (sumber traffic)">
              <TopList items={data.top_referrers} color="bg-emerald-500"
                labelMap={(k) => { try { return new URL(k).hostname; } catch { return k || '(direct)'; } }} />
            </Card>
          </div>

          {/* Geo + Browser + OS + Device */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title={<><Globe className="w-3.5 h-3.5 inline mr-1" /> Negara</>}>
              <TopList items={data.top_countries} color="bg-rose-500" />
            </Card>
            <Card title={<><Monitor className="w-3.5 h-3.5 inline mr-1" /> Browser</>}>
              <TopList items={data.top_browsers} color="bg-amber-500" />
            </Card>
            <Card title="🖥️ Sistem Operasi">
              <TopList items={data.top_os} color="bg-slate-500" />
            </Card>
            <Card title={<><Smartphone className="w-3.5 h-3.5 inline mr-1" /> Device</>}>
              <TopList items={data.top_devices} color="bg-blue-500" />
            </Card>
          </div>

          {/* Recent events */}
          <Card title={`Event Terbaru (${data.recent_events?.length || 0})`}>
            {data.recent_events?.length ? (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50">
                      <th className="px-5 py-2 font-medium">Waktu</th>
                      <th className="py-2 font-medium">Event</th>
                      <th className="py-2 font-medium">Target</th>
                      <th className="py-2 font-medium">Template</th>
                      <th className="py-2 font-medium">Device</th>
                      <th className="py-2 font-medium">Browser</th>
                      <th className="py-2 font-medium">OS</th>
                      <th className="py-2 font-medium">Negara</th>
                      <th className="px-5 py-2 font-medium">Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_events.map((e, i) => {
                      const b = EVENT_BADGE[e.event_type] || { label: e.event_type, cls: 'bg-slate-100' };
                      return (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-2 text-slate-500 whitespace-nowrap">{fmtRelTime(e.ts)}</td>
                          <td className="py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${b.cls}`}>{b.label}</span></td>
                          <td className="py-2 text-slate-700">{e.event_type === 'scroll' ? `${e.scroll_pct}%` : targetLabel(e.target)}</td>
                          <td className="py-2 text-slate-600 capitalize">{e.template || '—'}</td>
                          <td className="py-2 text-slate-600 capitalize">{e.device || '—'}</td>
                          <td className="py-2 text-slate-600">{e.browser || '—'}</td>
                          <td className="py-2 text-slate-600">{e.os || '—'}</td>
                          <td className="py-2 text-slate-600">{e.country || '—'}</td>
                          <td className="px-5 py-2 text-slate-400 font-mono">{e.session_id?.slice(0, 8)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-sm text-slate-400 text-center py-4">Belum ada event</div>}
          </Card>
        </>
      )}
    </div>
  );
};

export default LPAnalytics;
