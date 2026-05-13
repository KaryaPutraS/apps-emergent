import React, { useState, useEffect, useRef, useCallback } from 'react';

const NODES = [
  { id: 'msg',   label: 'Pesan Masuk',      icon: '💬', x: 88  },
  { id: 'rules', label: 'Rules Engine',     icon: '⚡', x: 266 },
  { id: 'kb',    label: 'Knowledge Base',   icon: '📚', x: 444 },
  { id: 'ai',    label: 'AI Processing',    icon: '🤖', x: 622 },
  { id: 'reply', label: 'Balasan Terkirim', icon: '✅', x: 800 },
];
const NY   = 118;
const NHW  = 66;

const SEGMENTS = [
  { id: 'msg-rules', from: 'msg',   to: 'rules' },
  { id: 'rules-kb',  from: 'rules', to: 'kb'    },
  { id: 'kb-ai',     from: 'kb',    to: 'ai'    },
  { id: 'ai-reply',  from: 'ai',    to: 'reply' },
];

// Phase-based color palettes
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
  idle:       { color: '#1e293b', width: 1.5, animated: false },
  incoming:   { color: '#22d3ee', width: 3,   animated: true  },
  processing: { color: '#a78bfa', width: 3,   animated: true  },
  sending:    { color: '#fb923c', width: 3,   animated: true  },
  done:       { color: '#34d399', width: 2,   animated: false },
  error:      { color: '#f87171', width: 2,   animated: false },
};

const INIT_NODES = { msg: 'idle', rules: 'idle', kb: 'idle', ai: 'idle', reply: 'idle' };
const INIT_SEGS  = { 'msg-rules': 'idle', 'rules-kb': 'idle', 'kb-ai': 'idle', 'ai-reply': 'idle' };

const WorkflowCanvas = ({ token }) => {
  const [nodeStates, setNodeStates] = useState(INIT_NODES);
  const [segStates,  setSegStates ] = useState(INIT_SEGS);
  const [particles,  setParticles ] = useState([]);
  const [events,     setEvents    ] = useState([]);
  const [connected,  setConnected ] = useState(false);
  const [lastMsg,    setLastMsg   ] = useState(null);
  const eventsLogRef = useRef(null);
  const resetTimer   = useRef(null);

  const scheduleReset = useCallback(() => {
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setNodeStates(INIT_NODES);
      setSegStates(INIT_SEGS);
    }, 3500);
  }, []);

  const addParticles = useCallback((segId, color) => {
    const seg  = SEGMENTS.find(s => s.id === segId);
    if (!seg) return;
    const from = NODES.find(n => n.id === seg.from);
    const to   = NODES.find(n => n.id === seg.to);
    if (!from || !to) return;
    const fromX = from.x + NHW + 4;
    const toX   = to.x   - NHW - 4;
    [0, 300, 600].forEach((delay, i) => {
      setTimeout(() => {
        const pid = `${Date.now()}-${i}-${Math.random()}`;
        setParticles(p => [...p.slice(-30), { id: pid, fromX, toX, color }]);
        setTimeout(() => setParticles(p => p.filter(x => x.id !== pid)), 1300);
      }, delay);
    });
  }, []);

  const handleEvent = useCallback((event) => {
    const t = event.type;

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

    setSegStates(prev => {
      const s = { ...prev };
      if (t === 'message_in') {
        Object.assign(s, INIT_SEGS);
        s['msg-rules'] = 'incoming';
      } else if (t === 'rule_match') {
        s['msg-rules'] = 'done';
        if (event.mode === 'direct') { s['kb-ai'] = 'idle'; s['ai-reply'] = 'sending'; }
      } else if (t === 'rule_no_match') {
        s['msg-rules'] = 'idle';
        s['rules-kb']  = 'processing';
      } else if (t === 'knowledge_match' || t === 'knowledge_no_match') {
        s['rules-kb'] = 'idle';
        s['kb-ai']    = 'processing';
      } else if (t === 'ai_response') {
        s['kb-ai']    = 'done';
        s['ai-reply'] = 'sending';
      } else if (t === 'reply_sent') {
        s['ai-reply'] = 'done';
      } else if (t === 'reply_error') {
        s['ai-reply'] = 'error';
      }
      return s;
    });

    if (t === 'message_in')                                              addParticles('msg-rules', '#22d3ee');
    else if (t === 'rule_no_match')                                      addParticles('rules-kb',  '#a78bfa');
    else if (t === 'knowledge_match' || t === 'knowledge_no_match')      addParticles('kb-ai',     '#a78bfa');
    else if (t === 'ai_response')                                        addParticles('ai-reply',  '#fb923c');
    else if (t === 'rule_match' && event.mode === 'direct')              addParticles('ai-reply',  '#fb923c');

    if (t === 'message_in') setLastMsg({ chat: event.chat || '', preview: event.preview || '' });
    if (t === 'reply_sent' || t === 'reply_error') scheduleReset();
  }, [addParticles, scheduleReset]);

  const pushLog = useCallback((event) => {
    setEvents(prev => [event, ...prev].slice(0, 40));
    requestAnimationFrame(() => { if (eventsLogRef.current) eventsLogRef.current.scrollTop = 0; });
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
          pushLog(ev);
          handleEvent(ev);
        } catch { /* skip */ }
      };
      ws.onclose = () => { setConnected(false); if (active) retryTimer = setTimeout(connect, 3000); };
      ws.onerror = () => { setConnected(false); ws.close(); };
    };

    connect();
    return () => {
      active = false;
      clearTimeout(retryTimer);
      clearTimeout(resetTimer.current);
      if (ws) ws.close();
      setConnected(false);
    };
  }, [token, handleEvent, pushLog]);

  const eventLabel = (e) => {
    switch (e.type) {
      case 'message_in':         return `📥 Dari ${e.chat || '?'}: "${e.preview || ''}"`;
      case 'rules_scan':         return `⚡ Memeriksa ${e.count || 0} rule aktif…`;
      case 'rule_match':         return `✅ Rule cocok: "${e.name}" [${e.mode}]`;
      case 'rule_no_match':      return `↩ Tidak ada rule — lanjut Knowledge Base`;
      case 'knowledge_scan':     return `📚 Memeriksa ${e.count || 0} knowledge aktif…`;
      case 'knowledge_match':    return `✅ Knowledge cocok: ${e.categories}`;
      case 'knowledge_no_match': return `↩ Tidak ada knowledge — lanjut AI`;
      case 'ai_call':            return `🤖 AI dipanggil: ${e.provider}/${e.model}`;
      case 'ai_response':        return `✨ AI menjawab (${e.tokens || 0} token, ${e.chars || 0} karakter)`;
      case 'reply_sending':      return `📤 Mengirim balasan…`;
      case 'reply_sent':         return `✅ Terkirim via WAHA`;
      case 'reply_error':        return `❌ Gagal kirim: ${e.reason || '?'}`;
      default:                   return e.type;
    }
  };

  const logDotColor = (e) => {
    if (['rule_match','knowledge_match','ai_response','reply_sent'].includes(e.type)) return '#34d399';
    if (['rule_no_match','knowledge_no_match'].includes(e.type)) return '#fbbf24';
    if (e.type === 'reply_error')   return '#f87171';
    if (e.type === 'reply_sending') return '#fb923c';
    if (['ai_call','active'].includes(e.type))  return '#818cf8';
    if (['rules_scan','knowledge_scan'].includes(e.type)) return '#a78bfa';
    if (e.type === 'message_in')    return '#22d3ee';
    return '#475569';
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#060c18', border: '1px solid #1a2540' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3"
           style={{ background: '#09101f', borderBottom: '1px solid #1a2540' }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }} />
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#a78bfa', boxShadow: '0 0 6px #a78bfa' }} />
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#fb923c', boxShadow: '0 0 6px #fb923c' }} />
          </div>
          <span className="text-sm font-bold text-white tracking-wide">Workflow Monitor</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                style={{ background: '#1e293b', color: '#64748b' }}>Realtime</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Phase legend */}
          <div className="hidden sm:flex items-center gap-3 text-[10px]">
            {[['#22d3ee','Menerima'],['#a78bfa','Memproses'],['#fb923c','Mengirim'],['#34d399','Selesai']].map(([c,l]) => (
              <span key={l} className="flex items-center gap-1" style={{ color: '#64748b' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                {l}
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

      {/* ── SVG Diagram ── */}
      <div className="px-4 pt-6 pb-3">
        <svg viewBox="0 0 900 240" width="100%" height="auto" style={{ overflow: 'visible' }}>
          <defs>
            <style>{`
              @keyframes flowDash { from { stroke-dashoffset: 14; } to { stroke-dashoffset: 0; } }
              @keyframes nodePulse { 0%,100% { opacity: 0.55; } 50% { opacity: 0.12; } }
              @keyframes dotBlink { 0%,100% { opacity: 0.15; } 50% { opacity: 1; } }
              .line-flow { animation: flowDash 0.42s linear infinite; }
              .pulse-ring { animation: nodePulse 1.6s ease-in-out infinite; }
            `}</style>
            <filter id="f-cyan"  x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="f-violet" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="f-orange" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="f-green"  x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <marker id="arr-idle" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#1e293b"/>
            </marker>
          </defs>

          {/* ── Background track lines ── */}
          {SEGMENTS.map(seg => {
            const from = NODES.find(n => n.id === seg.from);
            const to   = NODES.find(n => n.id === seg.to);
            return (
              <line key={`track-${seg.id}`}
                x1={from.x + NHW + 4} y1={NY}
                x2={to.x   - NHW - 4} y2={NY}
                stroke="#162030" strokeWidth={2}
                markerEnd="url(#arr-idle)"
              />
            );
          })}

          {/* ── Active flow lines ── */}
          {SEGMENTS.map(seg => {
            const state = segStates[seg.id] || 'idle';
            if (state === 'idle') return null;
            const theme  = SEG_THEME[state] || SEG_THEME.idle;
            const from   = NODES.find(n => n.id === seg.from);
            const to     = NODES.find(n => n.id === seg.to);
            const x1 = from.x + NHW + 4, x2 = to.x - NHW - 4;
            const glowId =
              state === 'incoming'   ? 'f-cyan' :
              state === 'processing' ? 'f-violet' :
              state === 'sending'    ? 'f-orange' : 'f-green';
            return (
              <line key={`flow-${seg.id}`}
                x1={x1} y1={NY} x2={x2} y2={NY}
                stroke={theme.color}
                strokeWidth={theme.width}
                strokeDasharray={theme.animated ? '8 6' : undefined}
                className={theme.animated ? 'line-flow' : undefined}
                style={{ filter: `url(#${glowId})` }}
              />
            );
          })}

          {/* ── Particles ── */}
          {particles.map(p => (
            <g key={p.id}>
              {/* glow trail */}
              <circle r={7} fill={p.color} opacity={0.25}
                style={{ filter: `drop-shadow(0 0 6px ${p.color})` }}>
                <animateMotion dur="1.1s" fill="freeze"
                  path={`M ${p.fromX} ${NY} L ${p.toX} ${NY}`} />
              </circle>
              {/* core dot */}
              <circle r={4.5} fill={p.color}>
                <animateMotion dur="1.1s" fill="freeze"
                  path={`M ${p.fromX} ${NY} L ${p.toX} ${NY}`} />
              </circle>
            </g>
          ))}

          {/* ── Nodes ── */}
          {NODES.map(node => {
            const state = nodeStates[node.id] || 'idle';
            const theme = NODE_THEME[state] || NODE_THEME.idle;
            return (
              <g key={node.id} transform={`translate(${node.x},${NY})`}>

                {/* Outer pulse ring */}
                {theme.pulse && (
                  <rect
                    x={-NHW - 6} y={-44} width={(NHW + 6) * 2} height={88} rx={18}
                    fill="none" stroke={theme.ring} strokeWidth={1.5}
                    className="pulse-ring"
                  />
                )}

                {/* Shadow glow layer */}
                {theme.shadow && (
                  <rect
                    x={-NHW} y={-38} width={NHW * 2} height={76} rx={14}
                    fill={theme.bg}
                    style={{ filter: `drop-shadow(0 0 14px ${theme.shadow}55)` }}
                  />
                )}

                {/* Main body */}
                <rect
                  x={-NHW} y={-38} width={NHW * 2} height={76} rx={14}
                  fill={theme.bg} stroke={theme.ring}
                  strokeWidth={state === 'idle' ? 1 : 2.5}
                  style={{ transition: 'fill 0.4s ease, stroke 0.4s ease' }}
                />

                {/* Icon */}
                <text x={0} y={-12} textAnchor="middle" dominantBaseline="middle" fontSize={24}>
                  {node.icon}
                </text>

                {/* Label */}
                <text x={0} y={17} textAnchor="middle" fontSize={9.5} fontWeight={700}
                  fill={theme.text} fontFamily="system-ui,sans-serif"
                  style={{ transition: 'fill 0.4s ease' }}>
                  {node.label}
                </text>

                {/* Activity dots */}
                {theme.dots && [0, 1, 2].map(i => (
                  <circle key={i} cx={-6 + i * 6} cy={33} r={2.8} fill={theme.ring}>
                    <animate attributeName="opacity"
                      values="0.15;1;0.15" dur="1.0s"
                      begin={`${i * 0.33}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Last message banner ── */}
      {lastMsg && (
        <div className="mx-4 mb-3 px-4 py-2 rounded-lg flex items-center gap-2.5 text-xs"
             style={{ background: '#0b1a2e', border: '1px solid #1a3050' }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: '#22d3ee', boxShadow: '0 0 6px #22d3ee' }} />
          <span style={{ color: '#475569' }}>Terakhir:</span>
          <span style={{ color: '#67e8f9', fontFamily: 'monospace' }}>{lastMsg.chat}</span>
          <span style={{ color: '#94a3b8' }}>"{lastMsg.preview}"</span>
        </div>
      )}

      {/* ── Event log ── */}
      <div className="mx-4 mb-4 rounded-lg overflow-hidden" style={{ border: '1px solid #1a2540' }}>
        <div className="px-3 py-2 flex items-center justify-between"
             style={{ background: '#09101f', borderBottom: '1px solid #1a2540' }}>
          <span className="text-[10px] font-bold tracking-widest" style={{ color: '#3d526e' }}>
            LOG AKTIVITAS
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono"
                style={{ background: '#1a2540', color: '#4a6080' }}>
            {events.length} event
          </span>
        </div>
        <div ref={eventsLogRef} style={{ maxHeight: 168, overflowY: 'auto', background: '#060c18' }}>
          {events.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <span style={{ fontSize: 28, opacity: 0.2 }}>📡</span>
              <p className="text-xs" style={{ color: '#2a3a50' }}>Menunggu pesan masuk…</p>
            </div>
          ) : (
            events.map((e, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2"
                   style={{ borderBottom: '1px solid #0d1424' }}>
                <span className="flex-shrink-0 w-2 h-2 rounded-full"
                      style={{
                        background: logDotColor(e),
                        boxShadow: `0 0 5px ${logDotColor(e)}`,
                        minWidth: 8,
                      }} />
                <span className="text-xs flex-1 leading-tight truncate"
                      style={{ color: '#7a9ab8', fontFamily: 'monospace' }}>
                  {eventLabel(e)}
                </span>
                <span className="text-[10px] flex-shrink-0 ml-1 font-mono" style={{ color: '#2d4060' }}>
                  {e.ts ? new Date(e.ts).toLocaleTimeString('id-ID', { hour12: false }) : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowCanvas;
