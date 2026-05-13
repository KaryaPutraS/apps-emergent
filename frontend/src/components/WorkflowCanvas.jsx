import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── SVG Flow constants ────────────────────────────────────────────────────
const NODES = [
  { id: 'msg',   label: 'Pesan Masuk',      icon: '💬', x: 88  },
  { id: 'rules', label: 'Rules Engine',     icon: '⚡', x: 266 },
  { id: 'kb',    label: 'Knowledge Base',   icon: '📚', x: 444 },
  { id: 'ai',    label: 'AI Processing',    icon: '🤖', x: 622 },
  { id: 'reply', label: 'Balasan Terkirim', icon: '✅', x: 800 },
];
const NY = 80; const NHW = 62;
const SEGMENTS = [
  { id: 'msg-rules', from: 'msg',   to: 'rules' },
  { id: 'rules-kb',  from: 'rules', to: 'kb'    },
  { id: 'kb-ai',     from: 'kb',    to: 'ai'    },
  { id: 'ai-reply',  from: 'ai',    to: 'reply' },
];

const NODE_THEME = {
  idle:       { ring: '#1e293b', bg: '#090e1a', text: '#475569', shadow: null,      pulse: false, dots: false },
  incoming:   { ring: '#22d3ee', bg: '#082030', text: '#67e8f9', shadow: '#22d3ee', pulse: true,  dots: false },
  processing: { ring: '#a78bfa', bg: '#150e35', text: '#c4b5fd', shadow: '#a78bfa', pulse: true,  dots: true  },
  active:     { ring: '#818cf8', bg: '#141247', text: '#a5b4fc', shadow: '#818cf8', pulse: true,  dots: true  },
  match:      { ring: '#34d399', bg: '#03231a', text: '#6ee7b7', shadow: '#34d399', pulse: false, dots: false },
  no_match:   { ring: '#fbbf24', bg: '#221200', text: '#fde68a', shadow: '#fbbf24', pulse: false, dots: false },
  sending:    { ring: '#fb923c', bg: '#221000', text: '#fed7aa', shadow: '#fb923c', pulse: true,  dots: true  },
  done:       { ring: '#34d399', bg: '#03231a', text: '#6ee7b7', shadow: '#34d399', pulse: false, dots: false },
  error:      { ring: '#f87171', bg: '#280808', text: '#fca5a5', shadow: '#f87171', pulse: false, dots: false },
};
const SEG_THEME = {
  idle:       { color: '#162030', width: 1.5, animated: false },
  incoming:   { color: '#22d3ee', width: 3,   animated: true  },
  processing: { color: '#a78bfa', width: 3,   animated: true  },
  sending:    { color: '#fb923c', width: 3,   animated: true  },
  done:       { color: '#34d399', width: 2,   animated: false },
  error:      { color: '#f87171', width: 2,   animated: false },
};

// ─── Initial states ────────────────────────────────────────────────────────
const INIT_NODES = { msg: 'idle', rules: 'idle', kb: 'idle', ai: 'idle', reply: 'idle' };
const INIT_SEGS  = { 'msg-rules': 'idle', 'rules-kb': 'idle', 'kb-ai': 'idle', 'ai-reply': 'idle' };
const INIT_RULES = { status: 'idle', count: 0, checking: -1, matched: null };
const INIT_KB    = { status: 'idle', count: 0, checking: -1, categories: '' };
const INIT_AI    = { status: 'idle', provider: '', model: '', tokens: 0, chars: 0 };

// ─── Sub-component: detail panel shell ────────────────────────────────────
const PanelShell = ({ icon, label, badge, badgeColor, bg, border, children }) => (
  <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden', height: '100%' }}>
    <div style={{ padding: '8px 12px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', flex: 1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}40`, fontWeight: 700, letterSpacing: '0.05em' }}>
          {badge}
        </span>
      )}
    </div>
    <div style={{ padding: '10px 12px' }}>{children}</div>
  </div>
);

const IdleMsg = () => (
  <p style={{ color: '#243040', fontSize: 10, textAlign: 'center', paddingTop: 12, paddingBottom: 12 }}>Menunggu…</p>
);

// ─── Rules Detail Panel ────────────────────────────────────────────────────
const RulesPanel = ({ detail }) => {
  const st = detail.status;
  const bg     = st === 'match' ? '#031c12' : st === 'no_match' ? '#1c0e00' : st === 'scanning' ? '#120b28' : '#080d18';
  const border = st === 'match' ? '#34d39930' : st === 'no_match' ? '#fbbf2430' : st === 'scanning' ? '#a78bfa30' : '#1a2540';
  const badge  = st === 'scanning' ? `${detail.count} rules` : st === 'match' ? 'COCOK ✓' : st === 'no_match' ? 'TIDAK ADA' : null;
  const bColor = st === 'match' ? '#34d399' : st === 'no_match' ? '#fbbf24' : '#a78bfa';
  const count  = Math.min(detail.count, 7);

  return (
    <PanelShell icon="⚡" label="RULES ENGINE" badge={badge} badgeColor={bColor} bg={bg} border={border}>
      {st === 'idle' ? <IdleMsg /> : st === 'match' ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 8px', borderRadius: 8, background: '#052e1c', border: '1px solid #34d39930' }}>
          <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>✅</span>
          <div>
            <p style={{ color: '#6ee7b7', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{detail.matched || 'Rule cocok'}</p>
            <p style={{ color: '#34d39960', fontSize: 9 }}>Rule berhasil dicocokkan</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {Array.from({ length: count }, (_, i) => {
            const done    = i < detail.checking;
            const current = i === detail.checking;
            const noMatch = st === 'no_match';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', borderRadius: 6,
                background: current ? '#a78bfa12' : 'transparent',
                border: current ? '1px solid #a78bfa35' : '1px solid transparent',
                transition: 'all 0.25s',
              }}>
                <span style={{ fontSize: 10, width: 12, textAlign: 'center',
                  color: noMatch ? '#c0622020' : done ? '#34d39970' : current ? '#a78bfa' : '#243040' }}>
                  {noMatch ? '✗' : done ? '✓' : current ? '◉' : '○'}
                </span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', flex: 1,
                  color: noMatch ? '#3a2010' : done ? '#34d39950' : current ? '#c4b5fd' : '#2a3a50' }}>
                  Rule #{String(i + 1).padStart(2, '0')}
                </span>
                {current && (
                  <span style={{ fontSize: 8, color: '#a78bfa80', fontStyle: 'italic' }}>checking…</span>
                )}
                {done && !noMatch && (
                  <span style={{ fontSize: 8, color: '#34d39940' }}>skip</span>
                )}
              </div>
            );
          })}
          {detail.count > 7 && (
            <p style={{ color: '#2a3a50', fontSize: 9, textAlign: 'center', marginTop: 2 }}>+{detail.count - 7} rules lainnya</p>
          )}
          {st === 'no_match' && (
            <div style={{ marginTop: 4, padding: '5px 8px', borderRadius: 6, background: '#2a140010', border: '1px solid #fbbf2420' }}>
              <p style={{ color: '#fbbf2470', fontSize: 9, textAlign: 'center' }}>Tidak ada rule yang cocok → lanjut KB</p>
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
};

// ─── Knowledge Detail Panel ────────────────────────────────────────────────
const KBPanel = ({ detail }) => {
  const st = detail.status;
  const bg     = st === 'match' ? '#031c12' : st === 'no_match' ? '#1c0e00' : st === 'scanning' ? '#120b28' : '#080d18';
  const border = st === 'match' ? '#34d39930' : st === 'no_match' ? '#fbbf2430' : st === 'scanning' ? '#a78bfa30' : '#1a2540';
  const badge  = st === 'scanning' ? `${detail.count} KB` : st === 'match' ? 'COCOK ✓' : st === 'no_match' ? 'TIDAK ADA' : null;
  const bColor = st === 'match' ? '#34d399' : st === 'no_match' ? '#fbbf24' : '#a78bfa';
  const count  = Math.min(detail.count, 7);

  return (
    <PanelShell icon="📚" label="KNOWLEDGE BASE" badge={badge} badgeColor={bColor} bg={bg} border={border}>
      {st === 'idle' ? <IdleMsg /> : st === 'match' ? (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 8px', borderRadius: 8, background: '#052e1c', border: '1px solid #34d39930', marginBottom: 6 }}>
            <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>📖</span>
            <div>
              <p style={{ color: '#6ee7b7', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Knowledge ditemukan</p>
              <p style={{ color: '#34d39960', fontSize: 9, lineHeight: 1.4 }}>{detail.categories || 'Kategori digunakan'}</p>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {Array.from({ length: count }, (_, i) => {
            const done    = i < detail.checking;
            const current = i === detail.checking;
            const noMatch = st === 'no_match';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', borderRadius: 6,
                background: current ? '#a78bfa12' : 'transparent',
                border: current ? '1px solid #a78bfa35' : '1px solid transparent',
                transition: 'all 0.25s',
              }}>
                <span style={{ fontSize: 10, width: 12, textAlign: 'center',
                  color: noMatch ? '#c0622020' : done ? '#34d39970' : current ? '#a78bfa' : '#243040' }}>
                  {noMatch ? '✗' : done ? '✓' : current ? '◉' : '○'}
                </span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', flex: 1,
                  color: noMatch ? '#3a2010' : done ? '#34d39950' : current ? '#c4b5fd' : '#2a3a50' }}>
                  KB #{String(i + 1).padStart(2, '0')}
                </span>
                {current && <span style={{ fontSize: 8, color: '#a78bfa80', fontStyle: 'italic' }}>scanning…</span>}
                {done && !noMatch && <span style={{ fontSize: 8, color: '#34d39940' }}>skip</span>}
              </div>
            );
          })}
          {detail.count > 7 && (
            <p style={{ color: '#2a3a50', fontSize: 9, textAlign: 'center', marginTop: 2 }}>+{detail.count - 7} KB lainnya</p>
          )}
          {st === 'no_match' && (
            <div style={{ marginTop: 4, padding: '5px 8px', borderRadius: 6, background: '#2a140010', border: '1px solid #fbbf2420' }}>
              <p style={{ color: '#fbbf2470', fontSize: 9, textAlign: 'center' }}>Tidak ada KB cocok → lanjut AI</p>
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
};

// ─── AI Detail Panel ───────────────────────────────────────────────────────
const AIPanel = ({ detail }) => {
  const st = detail.status;
  const bg     = st === 'done' ? '#031c12' : st === 'thinking' ? '#0e0e30' : '#080d18';
  const border = st === 'done' ? '#34d39930' : st === 'thinking' ? '#818cf830' : '#1a2540';
  const badge  = st === 'thinking' ? 'THINKING…' : st === 'done' ? 'SELESAI ✓' : null;
  const bColor = st === 'done' ? '#34d399' : '#818cf8';

  return (
    <PanelShell icon="🤖" label="AI PROCESSING" badge={badge} badgeColor={bColor} bg={bg} border={border}>
      {st === 'idle' ? <IdleMsg /> : (
        <div>
          {/* Provider badge */}
          {detail.provider && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20,
                background: '#1e1b4b', color: '#a5b4fc', border: '1px solid #818cf840',
                fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                {detail.provider}/{detail.model}
              </span>
            </div>
          )}

          {st === 'thinking' ? (
            <div>
              {/* Shimmer bar */}
              <div style={{ height: 6, borderRadius: 4, overflow: 'hidden', background: '#1e1b4b', marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg, #818cf820 0%, #818cf8 40%, #c4b5fd 60%, #818cf820 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'aiShimmer 1.4s ease-in-out infinite',
                }} />
              </div>
              {/* Thinking dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#a5b4fc80' }}>Sedang memproses</span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%',
                      background: '#818cf8', animation: `dotPop 1.0s ${i*0.25}s ease-in-out infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          ) : st === 'done' ? (
            <div>
              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'Token', value: detail.tokens.toLocaleString(), color: '#6ee7b7' },
                  { label: 'Karakter', value: detail.chars.toLocaleString(), color: '#6ee7b7' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '6px 10px', borderRadius: 8, background: '#052e1c', border: '1px solid #34d39925', textAlign: 'center' }}>
                    <p style={{ color: s.color, fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{s.value}</p>
                    <p style={{ color: '#34d39950', fontSize: 9, marginTop: 1 }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: '#052e1c', border: '1px solid #34d39925', textAlign: 'center' }}>
                <span style={{ fontSize: 9, color: '#34d39970' }}>✨ Jawaban berhasil dibuat</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </PanelShell>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
const WorkflowCanvas = ({ token }) => {
  const [nodeStates, setNodeStates] = useState(INIT_NODES);
  const [segStates,  setSegStates ] = useState(INIT_SEGS);
  const [particles,  setParticles ] = useState([]);
  const [events,     setEvents    ] = useState([]);
  const [connected,  setConnected ] = useState(false);
  const [lastMsg,    setLastMsg   ] = useState(null);
  const [rulesD,     setRulesD   ] = useState(INIT_RULES);
  const [kbD,        setKbD      ] = useState(INIT_KB);
  const [aiD,        setAiD      ] = useState(INIT_AI);

  const eventsLogRef  = useRef(null);
  const resetTimer    = useRef(null);
  const ruleScanTimer = useRef(null);
  const kbScanTimer   = useRef(null);

  const scheduleReset = useCallback(() => {
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setNodeStates(INIT_NODES);
      setSegStates(INIT_SEGS);
      setRulesD(INIT_RULES);
      setKbD(INIT_KB);
      setAiD(INIT_AI);
    }, 4000);
  }, []);

  const addParticles = useCallback((segId, color) => {
    const seg  = SEGMENTS.find(s => s.id === segId); if (!seg) return;
    const from = NODES.find(n => n.id === seg.from);
    const to   = NODES.find(n => n.id === seg.to);   if (!from || !to) return;
    const fromX = from.x + NHW + 4, toX = to.x - NHW - 4;
    [0, 320, 640].forEach((delay, i) => {
      setTimeout(() => {
        const pid = `${Date.now()}-${i}-${Math.random()}`;
        setParticles(p => [...p.slice(-30), { id: pid, fromX, toX, color }]);
        setTimeout(() => setParticles(p => p.filter(x => x.id !== pid)), 1300);
      }, delay);
    });
  }, []);

  const startScanAnim = useCallback((setDetail, count, timerRef) => {
    clearInterval(timerRef.current);
    const speed = Math.max(220, Math.min(700, 2200 / Math.max(count, 1)));
    let idx = 0;
    setDetail(prev => ({ ...prev, checking: 0 }));
    timerRef.current = setInterval(() => {
      idx++;
      if (idx >= count) { clearInterval(timerRef.current); return; }
      setDetail(prev => ({ ...prev, checking: idx }));
    }, speed);
  }, []);

  const handleEvent = useCallback((event) => {
    const t = event.type;

    // ── Node states ──
    setNodeStates(prev => {
      const n = { ...prev };
      if      (t === 'message_in')          { Object.assign(n, INIT_NODES); n.msg = 'incoming'; }
      else if (t === 'rules_scan')          { n.rules = 'processing'; }
      else if (t === 'rule_match')          { n.msg = 'match'; n.rules = 'match'; }
      else if (t === 'rule_no_match')       { n.rules = 'no_match'; }
      else if (t === 'knowledge_scan')      { n.kb = 'processing'; }
      else if (t === 'knowledge_match')     { n.kb = 'match'; }
      else if (t === 'knowledge_no_match')  { n.kb = 'no_match'; }
      else if (t === 'ai_call')             { n.ai = 'active'; }
      else if (t === 'ai_response')         { n.ai = 'match'; }
      else if (t === 'reply_sending')       { n.reply = 'sending'; }
      else if (t === 'reply_sent')          { n.reply = 'done'; }
      else if (t === 'reply_error')         { n.reply = 'error'; }
      return n;
    });

    // ── Segment states ──
    setSegStates(prev => {
      const s = { ...prev };
      if (t === 'message_in') { Object.assign(s, INIT_SEGS); s['msg-rules'] = 'incoming'; }
      else if (t === 'rule_match') { s['msg-rules'] = 'done'; if (event.mode === 'direct') s['ai-reply'] = 'sending'; }
      else if (t === 'rule_no_match') { s['msg-rules'] = 'idle'; s['rules-kb'] = 'processing'; }
      else if (t === 'knowledge_match' || t === 'knowledge_no_match') { s['rules-kb'] = 'idle'; s['kb-ai'] = 'processing'; }
      else if (t === 'ai_response') { s['kb-ai'] = 'done'; s['ai-reply'] = 'sending'; }
      else if (t === 'reply_sent')  { s['ai-reply'] = 'done'; }
      else if (t === 'reply_error') { s['ai-reply'] = 'error'; }
      return s;
    });

    // ── Particles ──
    if (t === 'message_in')                                         addParticles('msg-rules', '#22d3ee');
    else if (t === 'rule_no_match')                                 addParticles('rules-kb',  '#a78bfa');
    else if (t === 'knowledge_match' || t === 'knowledge_no_match') addParticles('kb-ai',     '#a78bfa');
    else if (t === 'ai_response')                                   addParticles('ai-reply',  '#fb923c');
    else if (t === 'rule_match' && event.mode === 'direct')         addParticles('ai-reply',  '#fb923c');

    // ── Detail panels ──
    if (t === 'message_in') {
      setLastMsg({ chat: event.chat || '', preview: event.preview || '' });
      setRulesD(INIT_RULES); setKbD(INIT_KB); setAiD(INIT_AI);
    } else if (t === 'rules_scan') {
      const cnt = event.count || 1;
      setRulesD({ status: 'scanning', count: cnt, checking: 0, matched: null });
      startScanAnim(setRulesD, cnt, ruleScanTimer);
    } else if (t === 'rule_match') {
      clearInterval(ruleScanTimer.current);
      setRulesD(prev => ({ ...prev, status: 'match', matched: event.name || 'Rule cocok', checking: -1 }));
    } else if (t === 'rule_no_match') {
      clearInterval(ruleScanTimer.current);
      setRulesD(prev => ({ ...prev, status: 'no_match', checking: -1 }));
    } else if (t === 'knowledge_scan') {
      const cnt = event.count || 1;
      setKbD({ status: 'scanning', count: cnt, checking: 0, categories: '' });
      startScanAnim(setKbD, cnt, kbScanTimer);
    } else if (t === 'knowledge_match') {
      clearInterval(kbScanTimer.current);
      setKbD(prev => ({ ...prev, status: 'match', categories: event.categories || '', checking: -1 }));
    } else if (t === 'knowledge_no_match') {
      clearInterval(kbScanTimer.current);
      setKbD(prev => ({ ...prev, status: 'no_match', checking: -1 }));
    } else if (t === 'ai_call') {
      setAiD({ status: 'thinking', provider: event.provider || '', model: event.model || '', tokens: 0, chars: 0 });
    } else if (t === 'ai_response') {
      setAiD(prev => ({ ...prev, status: 'done', tokens: event.tokens || 0, chars: event.chars || 0 }));
    }

    if (t === 'reply_sent' || t === 'reply_error') scheduleReset();
  }, [addParticles, scheduleReset, startScanAnim]);

  const pushLog = useCallback((event) => {
    setEvents(prev => [event, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true, ws = null, retryTimer = null;
    const connect = () => {
      if (!active) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${window.location.host}/ws/workflow?token=${encodeURIComponent(token)}`;
      try { ws = new WebSocket(url); } catch { if (active) retryTimer = setTimeout(connect, 4000); return; }
      ws.onopen    = () => setConnected(true);
      ws.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === 'heartbeat' || ev.type === 'connected') return;
          pushLog(ev); handleEvent(ev);
        } catch { /* skip */ }
      };
      ws.onclose = () => { setConnected(false); if (active) retryTimer = setTimeout(connect, 3000); };
      ws.onerror = () => { setConnected(false); ws.close(); };
    };
    connect();
    return () => {
      active = false;
      clearTimeout(retryTimer); clearTimeout(resetTimer.current);
      clearInterval(ruleScanTimer.current); clearInterval(kbScanTimer.current);
      if (ws) ws.close(); setConnected(false);
    };
  }, [token, handleEvent, pushLog]);

  const eventLabel = (e) => {
    switch (e.type) {
      case 'message_in':         return `📥 Dari ${e.chat || '?'}: "${e.preview || ''}"`;
      case 'rules_scan':         return `⚡ Memeriksa ${e.count || 0} rule aktif…`;
      case 'rule_match':         return `✅ Rule: "${e.name}" [${e.mode}]`;
      case 'rule_no_match':      return `↩ Tidak ada rule → lanjut KB`;
      case 'knowledge_scan':     return `📚 Memeriksa ${e.count || 0} KB aktif…`;
      case 'knowledge_match':    return `✅ KB: ${e.categories}`;
      case 'knowledge_no_match': return `↩ Tidak ada KB → lanjut AI`;
      case 'ai_call':            return `🤖 AI: ${e.provider}/${e.model}`;
      case 'ai_response':        return `✨ AI selesai (${e.tokens || 0} token, ${e.chars || 0} kar)`;
      case 'reply_sending':      return `📤 Mengirim balasan…`;
      case 'reply_sent':         return `✅ Terkirim via WAHA`;
      case 'reply_error':        return `❌ Gagal: ${e.reason || '?'}`;
      default:                   return e.type;
    }
  };

  const logDotColor = (e) => {
    if (['rule_match','knowledge_match','ai_response','reply_sent'].includes(e.type)) return '#34d399';
    if (['rule_no_match','knowledge_no_match'].includes(e.type)) return '#fbbf24';
    if (e.type === 'reply_error')   return '#f87171';
    if (e.type === 'reply_sending') return '#fb923c';
    if (['ai_call','rules_scan','knowledge_scan'].includes(e.type)) return '#a78bfa';
    if (e.type === 'message_in')    return '#22d3ee';
    return '#475569';
  };

  const anyDetailActive = rulesD.status !== 'idle' || kbD.status !== 'idle' || aiD.status !== 'idle';

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#060c18', border: '1px solid #1a2540' }}>
      <style>{`
        @keyframes flowDash  { from { stroke-dashoffset: 14; } to { stroke-dashoffset: 0; } }
        @keyframes nodePulse { 0%,100% { opacity: 0.5; } 50% { opacity: 0.1; } }
        @keyframes aiShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes dotPop    { 0%,100% { transform: scaleY(0.4); opacity: 0.3; } 50% { transform: scaleY(1); opacity: 1; } }
        .line-flow  { animation: flowDash 0.42s linear infinite; }
        .pulse-ring { animation: nodePulse 1.6s ease-in-out infinite; }
      `}</style>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3"
           style={{ background: '#09101f', borderBottom: '1px solid #1a2540' }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {['#22d3ee','#a78bfa','#fb923c'].map(c => (
              <span key={c} className="inline-block w-2 h-2 rounded-full" style={{ background: c, boxShadow: `0 0 5px ${c}` }} />
            ))}
          </div>
          <span className="text-sm font-bold text-white tracking-wide">Workflow Monitor</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                style={{ background: '#1e293b', color: '#64748b' }}>Realtime</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            {[['#22d3ee','Menerima'],['#a78bfa','Memproses'],['#fb923c','Mengirim'],['#34d399','Selesai']].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1 text-[10px]" style={{ color: '#4a6080' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{l}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{
              background: connected ? '#34d399' : '#f87171',
              boxShadow: connected ? '0 0 6px #34d399' : 'none',
              animation: connected ? 'pulse 2s infinite' : 'none',
            }} />
            <span className="text-xs" style={{ color: connected ? '#34d399' : '#f87171' }}>
              {connected ? 'Live' : 'Menghubungkan…'}
            </span>
          </div>
        </div>
      </div>

      {/* ── SVG Flow ── */}
      <div className="px-4 pt-5 pb-2">
        <svg viewBox="0 0 900 168" width="100%" height="auto" style={{ overflow: 'visible' }}>
          <defs>
            <filter id="f-c" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="f-v" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="f-o" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="f-g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#162030"/>
            </marker>
          </defs>

          {/* Tracks */}
          {SEGMENTS.map(seg => {
            const from = NODES.find(n => n.id === seg.from), to = NODES.find(n => n.id === seg.to);
            return <line key={`t-${seg.id}`} x1={from.x+NHW+4} y1={NY} x2={to.x-NHW-4} y2={NY}
              stroke="#162030" strokeWidth={2} markerEnd="url(#arr)" />;
          })}
          {/* Flow lines */}
          {SEGMENTS.map(seg => {
            const state = segStates[seg.id] || 'idle'; if (state === 'idle') return null;
            const th = SEG_THEME[state] || SEG_THEME.idle;
            const from = NODES.find(n => n.id === seg.from), to = NODES.find(n => n.id === seg.to);
            const fid = state==='incoming'?'f-c':state==='processing'?'f-v':state==='sending'?'f-o':'f-g';
            return <line key={`f-${seg.id}`}
              x1={from.x+NHW+4} y1={NY} x2={to.x-NHW-4} y2={NY}
              stroke={th.color} strokeWidth={th.width}
              strokeDasharray={th.animated ? '8 6' : undefined}
              className={th.animated ? 'line-flow' : undefined}
              style={{ filter: `url(#${fid})` }} />;
          })}
          {/* Particles */}
          {particles.map(p => (
            <g key={p.id}>
              <circle r={7} fill={p.color} opacity={0.2} style={{ filter: `drop-shadow(0 0 5px ${p.color})` }}>
                <animateMotion dur="1.1s" fill="freeze" path={`M ${p.fromX} ${NY} L ${p.toX} ${NY}`} />
              </circle>
              <circle r={4} fill={p.color}>
                <animateMotion dur="1.1s" fill="freeze" path={`M ${p.fromX} ${NY} L ${p.toX} ${NY}`} />
              </circle>
            </g>
          ))}
          {/* Nodes */}
          {NODES.map(node => {
            const state = nodeStates[node.id] || 'idle', th = NODE_THEME[state] || NODE_THEME.idle;
            return (
              <g key={node.id} transform={`translate(${node.x},${NY})`}>
                {th.pulse && <rect x={-NHW-5} y={-41} width={(NHW+5)*2} height={82} rx={17}
                  fill="none" stroke={th.ring} strokeWidth={1.5} className="pulse-ring" />}
                {th.shadow && <rect x={-NHW} y={-36} width={NHW*2} height={72} rx={14}
                  fill={th.bg} style={{ filter: `drop-shadow(0 0 12px ${th.shadow}50)` }} />}
                <rect x={-NHW} y={-36} width={NHW*2} height={72} rx={14}
                  fill={th.bg} stroke={th.ring} strokeWidth={state==='idle'?1:2.5}
                  style={{ transition: 'all 0.4s ease' }} />
                <text x={0} y={-14} textAnchor="middle" dominantBaseline="middle" fontSize={22}>{node.icon}</text>
                <text x={0} y={15} textAnchor="middle" fontSize={9.5} fontWeight={700}
                  fill={th.text} fontFamily="system-ui,sans-serif" style={{ transition: 'fill 0.4s' }}>
                  {node.label}
                </text>
                {th.dots && [0,1,2].map(i => (
                  <circle key={i} cx={-6+i*6} cy={30} r={2.5} fill={th.ring}>
                    <animate attributeName="opacity" values="0.15;1;0.15" dur="1s" begin={`${i*0.32}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Detail Panels ── */}
      {anyDetailActive && (
        <div className="px-4 pb-3 grid grid-cols-3 gap-3" style={{ minHeight: 148 }}>
          <RulesPanel detail={rulesD} />
          <KBPanel    detail={kbD} />
          <AIPanel    detail={aiD} />
        </div>
      )}

      {/* ── Last message ── */}
      {lastMsg && (
        <div className="mx-4 mb-3 px-4 py-2 rounded-lg flex items-center gap-2.5 text-xs"
             style={{ background: '#0b1a2e', border: '1px solid #1a3050' }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }} />
          <span style={{ color: '#475569' }}>Terakhir:</span>
          <span style={{ color: '#67e8f9', fontFamily: 'monospace' }}>{lastMsg.chat}</span>
          <span style={{ color: '#94a3b8' }}>"{lastMsg.preview}"</span>
        </div>
      )}

      {/* ── Event log ── */}
      <div className="mx-4 mb-4 rounded-lg overflow-hidden" style={{ border: '1px solid #1a2540' }}>
        <div className="px-3 py-2 flex items-center justify-between"
             style={{ background: '#09101f', borderBottom: '1px solid #1a2540' }}>
          <span className="text-[10px] font-bold tracking-widest" style={{ color: '#3d526e' }}>LOG AKTIVITAS</span>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono"
                style={{ background: '#1a2540', color: '#4a6080' }}>{events.length} event</span>
        </div>
        <div ref={eventsLogRef} style={{ maxHeight: 160, overflowY: 'auto', background: '#060c18' }}>
          {events.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <span style={{ fontSize: 28, opacity: 0.15 }}>📡</span>
              <p className="text-xs" style={{ color: '#1e2e40' }}>Menunggu pesan masuk…</p>
            </div>
          ) : events.map((e, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2"
                 style={{ borderBottom: '1px solid #0d1424' }}>
              <span className="flex-shrink-0 w-2 h-2 rounded-full"
                    style={{ background: logDotColor(e), boxShadow: `0 0 4px ${logDotColor(e)}`, minWidth: 8 }} />
              <span className="text-xs flex-1 truncate" style={{ color: '#6a8aaa', fontFamily: 'monospace' }}>
                {eventLabel(e)}
              </span>
              <span className="text-[10px] flex-shrink-0 font-mono" style={{ color: '#2d4060' }}>
                {e.ts ? new Date(e.ts).toLocaleTimeString('id-ID', { hour12: false }) : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowCanvas;
