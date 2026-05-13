import React, { useState, useEffect, useRef, useCallback } from 'react';

const NODES = [
  { id: 'msg',   label: 'Pesan Masuk',      icon: '💬', x: 80  },
  { id: 'rules', label: 'Rules Engine',     icon: '⚡', x: 240 },
  { id: 'kb',    label: 'Knowledge Base',   icon: '📚', x: 400 },
  { id: 'ai',    label: 'AI Processing',    icon: '🤖', x: 560 },
  { id: 'reply', label: 'Balasan Terkirim', icon: '✅', x: 720 },
];

const NY = 110;
const NHW = 56;

const SEGMENTS = [
  { id: 'msg-rules', from: 'msg',   to: 'rules' },
  { id: 'rules-kb',  from: 'rules', to: 'kb'    },
  { id: 'kb-ai',     from: 'kb',    to: 'ai'    },
  { id: 'ai-reply',  from: 'ai',    to: 'reply' },
];

const STATE_THEME = {
  idle:     { ring: '#334155', bg: '#0f172a', text: '#64748b', glowColor: null },
  scanning: { ring: '#3b82f6', bg: '#1e3a5f', text: '#93c5fd', glowColor: '#3b82f6' },
  match:    { ring: '#10b981', bg: '#052e16', text: '#6ee7b7', glowColor: '#10b981' },
  no_match: { ring: '#f59e0b', bg: '#431407', text: '#fcd34d', glowColor: '#f59e0b' },
  active:   { ring: '#8b5cf6', bg: '#2e1065', text: '#c4b5fd', glowColor: '#8b5cf6' },
  done:     { ring: '#10b981', bg: '#052e16', text: '#6ee7b7', glowColor: '#10b981' },
  error:    { ring: '#ef4444', bg: '#450a0a', text: '#fca5a5', glowColor: '#ef4444' },
};

function applyEvent(event, nodeStatesRef, setNodeStates, setActiveSegs, addParticle, setLastMsg) {
  const t = event.type;
  const upd = { ...nodeStatesRef.current };

  if (t === 'message_in') {
    Object.assign(upd, { msg: 'match', rules: 'scanning', kb: 'idle', ai: 'idle', reply: 'idle' });
    setLastMsg({ chat: event.chat || '', preview: event.preview || '' });
    setActiveSegs(new Set(['msg-rules']));
    addParticle('msg-rules');
  } else if (t === 'rules_scan') {
    upd.rules = 'scanning';
  } else if (t === 'rule_match') {
    upd.rules = 'match';
    if (event.mode === 'direct') {
      setActiveSegs(new Set(['ai-reply']));
      addParticle('ai-reply');
    } else {
      setActiveSegs(s => { const n = new Set(s); n.delete('msg-rules'); return n; });
    }
  } else if (t === 'rule_no_match') {
    upd.rules = 'no_match';
    setActiveSegs(new Set(['rules-kb']));
    addParticle('rules-kb');
  } else if (t === 'knowledge_scan') {
    upd.kb = 'scanning';
  } else if (t === 'knowledge_match') {
    upd.kb = 'match';
    setActiveSegs(new Set(['kb-ai']));
    addParticle('kb-ai');
  } else if (t === 'knowledge_no_match') {
    upd.kb = 'no_match';
    setActiveSegs(new Set(['kb-ai']));
    addParticle('kb-ai');
  } else if (t === 'ai_call') {
    upd.ai = 'active';
    setActiveSegs(new Set());
  } else if (t === 'ai_response') {
    upd.ai = 'match';
    setActiveSegs(new Set(['ai-reply']));
    addParticle('ai-reply');
  } else if (t === 'reply_sending') {
    upd.reply = 'scanning';
    setActiveSegs(new Set());
  } else if (t === 'reply_sent') {
    upd.reply = 'done';
    setActiveSegs(new Set());
  } else if (t === 'reply_error') {
    upd.reply = 'error';
    setActiveSegs(new Set());
  }

  setNodeStates(upd);
}

const WorkflowCanvas = ({ token }) => {
  const [nodeStates, setNodeStates] = useState({
    msg: 'idle', rules: 'idle', kb: 'idle', ai: 'idle', reply: 'idle',
  });
  const [activeSegs, setActiveSegs] = useState(new Set());
  const [particles, setParticles] = useState([]);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastMsg, setLastMsg] = useState(null);
  const nodeStatesRef = useRef(nodeStates);
  const eventsLogRef = useRef(null);

  nodeStatesRef.current = nodeStates;

  const addParticle = useCallback((segId) => {
    const seg = SEGMENTS.find(s => s.id === segId);
    if (!seg) return;
    const from = NODES.find(n => n.id === seg.from);
    const to   = NODES.find(n => n.id === seg.to);
    if (!from || !to) return;
    const pid = Date.now() + Math.random();
    setParticles(p => [...p, { id: pid, fromX: from.x + NHW + 4, toX: to.x - NHW - 4 }]);
    setTimeout(() => setParticles(p => p.filter(x => x.id !== pid)), 1400);
  }, []);

  const pushEvent = useCallback((event) => {
    setEvents(prev => [event, ...prev].slice(0, 30));
    requestAnimationFrame(() => {
      if (eventsLogRef.current) eventsLogRef.current.scrollTop = 0;
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const ctrl = new AbortController();

    const connect = async () => {
      try {
        const res = await fetch('/api/test/workflow-stream', {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) { setConnected(false); return; }
        setConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (active) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'heartbeat' || event.type === 'connected') continue;
              pushEvent(event);
              applyEvent(event, nodeStatesRef, setNodeStates, setActiveSegs, addParticle, setLastMsg);
            } catch { /* skip */ }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          setConnected(false);
          if (active) setTimeout(connect, 3000);
        }
      }
    };

    connect();
    return () => { active = false; ctrl.abort(); setConnected(false); };
  }, [token, addParticle, pushEvent]);

  const eventLabel = (e) => {
    switch (e.type) {
      case 'message_in':         return `📥 Pesan dari ${e.chat || '?'}: "${e.preview || ''}"`;
      case 'rules_scan':         return `⚡ Periksa ${e.count} rule aktif…`;
      case 'rule_match':         return `✅ Rule cocok: "${e.name}" (${e.mode})`;
      case 'rule_no_match':      return `↩ Tidak ada rule — lanjut Knowledge Base`;
      case 'knowledge_scan':     return `📚 Periksa ${e.count} knowledge aktif…`;
      case 'knowledge_match':    return `✅ Knowledge cocok: ${e.categories}`;
      case 'knowledge_no_match': return `↩ Tidak ada knowledge — lanjut AI`;
      case 'ai_call':            return `🤖 AI dipanggil: ${e.provider}/${e.model}`;
      case 'ai_response':        return `✨ AI menjawab (${e.tokens || 0} token, ${e.chars || 0} karakter)`;
      case 'reply_sending':      return `📤 Mengirim: "${e.preview || ''}"`;
      case 'reply_sent':         return `✅ Terkirim via WAHA`;
      case 'reply_error':        return `❌ Gagal: ${e.reason}`;
      default:                   return e.type;
    }
  };

  const dotColor = (e) => {
    if (['rule_match','knowledge_match','ai_response','reply_sent'].includes(e.type)) return '#10b981';
    if (['rule_no_match','knowledge_no_match'].includes(e.type)) return '#f59e0b';
    if (e.type === 'reply_error') return '#ef4444';
    if (['ai_call','rules_scan','knowledge_scan','message_in'].includes(e.type)) return '#3b82f6';
    return '#64748b';
  };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700" style={{ background: '#0a0f1a' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700"
           style={{ background: '#0d1424' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white tracking-wide">⚙ Workflow Monitor</span>
          <span className="text-xs text-slate-500">— Realtime</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'}`}
                style={connected ? { boxShadow: '0 0 6px #10b981', animation: 'pulse 2s infinite' } : {}} />
          <span className="text-xs text-slate-400">{connected ? 'Live' : 'Menghubungkan…'}</span>
        </div>
      </div>

      {/* SVG Diagram */}
      <div className="px-4 pt-5 pb-2">
        <svg viewBox="0 0 810 230" width="100%" height="auto" style={{ overflow: 'visible' }}>
          <defs>
            <filter id="glow-blue"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="glow-green"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <marker id="arrowIdle" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#1e293b"/>
            </marker>
            <marker id="arrowActive" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#38bdf8"/>
            </marker>
          </defs>

          {/* Connection lines */}
          {SEGMENTS.map(seg => {
            const from = NODES.find(n => n.id === seg.from);
            const to   = NODES.find(n => n.id === seg.to);
            const isActive = activeSegs.has(seg.id);
            return (
              <line
                key={seg.id}
                x1={from.x + NHW + 4} y1={NY}
                x2={to.x   - NHW - 4} y2={NY}
                stroke={isActive ? '#38bdf8' : '#1e293b'}
                strokeWidth={isActive ? 2.5 : 1.5}
                markerEnd={`url(#${isActive ? 'arrowActive' : 'arrowIdle'})`}
                style={{ transition: 'stroke 0.3s', filter: isActive ? 'url(#glow-blue)' : 'none' }}
              />
            );
          })}

          {/* Particles */}
          {particles.map(p => (
            <circle key={p.id} r={5} fill="#38bdf8" style={{ filter: 'url(#glow-blue)' }}>
              <animateMotion dur="1.3s" fill="freeze" path={`M ${p.fromX} ${NY} L ${p.toX} ${NY}`} />
            </circle>
          ))}

          {/* Nodes */}
          {NODES.map(node => {
            const state = nodeStates[node.id] || 'idle';
            const theme = STATE_THEME[state];
            return (
              <g key={node.id} transform={`translate(${node.x},${NY})`}>
                {/* Node background */}
                <rect
                  x={-NHW} y={-38} width={NHW * 2} height={76} rx={12}
                  fill={theme.bg} stroke={theme.ring}
                  strokeWidth={state === 'idle' ? 1 : 2}
                  style={{
                    transition: 'all 0.3s',
                    filter: theme.glowColor ? `drop-shadow(0 0 8px ${theme.glowColor}80)` : 'none',
                  }}
                />
                {/* Icon */}
                <text x={0} y={-12} textAnchor="middle" dominantBaseline="middle" fontSize={22}>{node.icon}</text>
                {/* Label */}
                <text x={0} y={16} textAnchor="middle" fontSize={9.5} fontWeight={600}
                      fill={theme.text} fontFamily="system-ui,sans-serif"
                      style={{ transition: 'fill 0.3s' }}>
                  {node.label}
                </text>
                {/* Scanning dots */}
                {(state === 'scanning' || state === 'active') && [0,1,2].map(i => (
                  <circle key={i} cx={-6 + i * 6} cy={32} r={2.5} fill={theme.ring}>
                    <animate attributeName="opacity" values="0.2;1;0.2" dur="1.1s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Last message */}
      {lastMsg && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: '#111827', border: '1px solid #1e293b' }}>
          <span style={{ color: '#64748b' }}>Terakhir: </span>
          <span style={{ color: '#34d399', fontFamily: 'monospace' }}>{lastMsg.chat}</span>
          <span style={{ color: '#cbd5e1', marginLeft: 8 }}>"{lastMsg.preview}"</span>
        </div>
      )}

      {/* Event log */}
      <div className="mx-4 mb-4 rounded-lg overflow-hidden" style={{ border: '1px solid #1e293b' }}>
        <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: '#0d1424', borderBottom: '1px solid #1e293b' }}>
          <span className="text-xs font-semibold" style={{ color: '#475569', letterSpacing: '0.08em' }}>LOG AKTIVITAS</span>
          <span className="text-xs" style={{ color: '#334155' }}>{events.length} event</span>
        </div>
        <div ref={eventsLogRef} style={{ maxHeight: 160, overflowY: 'auto', background: '#0a0f1a' }}>
          {events.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: '#334155' }}>Menunggu pesan masuk…</p>
          ) : (
            events.map((e, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid #0f172a' }}>
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: dotColor(e) }} />
                <span className="text-xs flex-1" style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{eventLabel(e)}</span>
                <span className="text-xs flex-shrink-0 ml-1" style={{ color: '#334155' }}>
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
