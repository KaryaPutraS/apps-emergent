import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Constants ─────────────────────────────────────────────────────────────
const NODES = [
  { id: 'msg',   label: 'Pesan Masuk',      sub: 'Incoming',   icon: '💬', x: 90,  step: 1 },
  { id: 'rules', label: 'Rules Engine',     sub: 'Matching',   icon: '⚡', x: 270, step: 2 },
  { id: 'kb',    label: 'Knowledge Base',   sub: 'Retrieval',  icon: '📚', x: 450, step: 3 },
  { id: 'ai',    label: 'AI Processing',    sub: 'Generation', icon: '🤖', x: 630, step: 4 },
  { id: 'reply', label: 'Balasan Terkirim', sub: 'Delivered',  icon: '✅', x: 810, step: 5 },
];
const NY = 110; const NHW = 70; const NHH = 52;

const SEGMENTS = [
  { id: 'msg-rules', from: 'msg',   to: 'rules' },
  { id: 'rules-kb',  from: 'rules', to: 'kb'    },
  { id: 'kb-ai',     from: 'kb',    to: 'ai'    },
  { id: 'ai-reply',  from: 'ai',    to: 'reply' },
];

const PHASE_COLOR = {
  incoming:   '#22d3ee',
  processing: '#a78bfa',
  sending:    '#fb923c',
  match:      '#34d399',
  no_match:   '#fbbf24',
  error:      '#f87171',
};

const NODE_THEME = {
  idle:       { ring: '#1e3050', bg1: '#0c1828', bg2: '#080e18', text: '#3d5570', sub: '#243040', status: '',          statusColor: '#3d5570', glow: null,      pulse: false, dots: false },
  incoming:   { ring: '#22d3ee', bg1: '#0e3545', bg2: '#082030', text: '#67e8f9', sub: '#22d3ee80', status: 'MASUK',   statusColor: '#22d3ee', glow: '#22d3ee', pulse: true,  dots: false },
  processing: { ring: '#a78bfa', bg1: '#1e1245', bg2: '#120b30', text: '#c4b5fd', sub: '#a78bfa80', status: 'SCANNING',statusColor: '#a78bfa', glow: '#a78bfa', pulse: true,  dots: true  },
  active:     { ring: '#818cf8', bg1: '#181550', bg2: '#101040', text: '#a5b4fc', sub: '#818cf880', status: 'THINKING',statusColor: '#818cf8', glow: '#818cf8', pulse: true,  dots: true  },
  match:      { ring: '#34d399', bg1: '#053d22', bg2: '#031c12', text: '#6ee7b7', sub: '#34d39980', status: 'COCOK ✓', statusColor: '#34d399', glow: '#34d399', pulse: false, dots: false },
  no_match:   { ring: '#fbbf24', bg1: '#2d1800', bg2: '#1c0e00', text: '#fde68a', sub: '#fbbf2480', status: 'SKIP →',  statusColor: '#fbbf24', glow: '#fbbf24', pulse: false, dots: false },
  sending:    { ring: '#fb923c', bg1: '#2d1500', bg2: '#1c0c00', text: '#fed7aa', sub: '#fb923c80', status: 'MENGIRIM',statusColor: '#fb923c', glow: '#fb923c', pulse: true,  dots: true  },
  done:       { ring: '#34d399', bg1: '#053d22', bg2: '#031c12', text: '#6ee7b7', sub: '#34d39980', status: 'TERKIRIM ✓',statusColor:'#34d399',glow: '#34d399', pulse: false, dots: false },
  error:      { ring: '#f87171', bg1: '#3a0a0a', bg2: '#280606', text: '#fca5a5', sub: '#f8717180', status: 'ERROR ✗', statusColor: '#f87171', glow: '#f87171', pulse: false, dots: false },
};
const SEG_THEME = {
  idle:       { color: '#162030', width: 1.5, animated: false, marker: 'arr-idle'   },
  incoming:   { color: '#22d3ee', width: 3,   animated: true,  marker: 'arr-cyan'   },
  processing: { color: '#a78bfa', width: 3,   animated: true,  marker: 'arr-violet' },
  sending:    { color: '#fb923c', width: 3,   animated: true,  marker: 'arr-orange' },
  done:       { color: '#34d399', width: 2,   animated: false, marker: 'arr-green'  },
  error:      { color: '#f87171', width: 2,   animated: false, marker: 'arr-red'    },
};

const STATUS_LABELS = { incoming:'MASUK', processing:'SCANNING', active:'THINKING', match:'COCOK ✓', no_match:'SKIP', sending:'MENGIRIM', done:'TERKIRIM', error:'ERROR' };

const INIT_NODES = { msg:'idle', rules:'idle', kb:'idle', ai:'idle', reply:'idle' };
const INIT_SEGS  = { 'msg-rules':'idle', 'rules-kb':'idle', 'kb-ai':'idle', 'ai-reply':'idle' };
const INIT_RULES = { status:'idle', count:0, checking:-1, matched:null };
const INIT_KB    = { status:'idle', count:0, checking:-1, categories:'' };
const INIT_AI    = { status:'idle', provider:'', model:'', tokens:0, chars:0 };

// ─── Detail Panel helpers ──────────────────────────────────────────────────
const IdleMsg = () => (
  <p style={{ color:'#1e2e40', fontSize:10, textAlign:'center', padding:'14px 0' }}>Menunggu aktivitas…</p>
);
const PanelShell = ({ icon, label, badge, badgeColor, bg, border, children }) => (
  <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:10, overflow:'hidden', height:'100%' }}>
    <div style={{ padding:'8px 12px', borderBottom:`1px solid ${border}`, display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:12 }}>{icon}</span>
      <span style={{ color:'#7a9ab8', fontSize:10, fontWeight:700, letterSpacing:'0.07em', flex:1 }}>{label}</span>
      {badge && <span style={{ fontSize:9, padding:'2px 8px', borderRadius:20, background:`${badgeColor}18`, color:badgeColor, border:`1px solid ${badgeColor}40`, fontWeight:700 }}>{badge}</span>}
    </div>
    <div style={{ padding:'10px 12px' }}>{children}</div>
  </div>
);

const ScanList = ({ count, checking, status }) => {
  const items = Math.min(count, 7);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      {Array.from({ length: items }, (_, i) => {
        const done = i < checking, cur = i === checking, nm = status === 'no_match';
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 8px', borderRadius:6,
            background: cur ? '#a78bfa10' : 'transparent', border: cur ? '1px solid #a78bfa30' : '1px solid transparent',
            transition:'all 0.25s' }}>
            <span style={{ fontSize:11, width:12, textAlign:'center', color: nm?'#5a2a10':done?'#34d39960':cur?'#a78bfa':'#1e3050' }}>
              {nm?'✗':done?'✓':cur?'◉':'○'}
            </span>
            <span style={{ fontSize:10, fontFamily:'monospace', flex:1, color: nm?'#3a1e0a':done?'#34d39940':cur?'#c4b5fd':'#253545' }}>
              {label => label}#{String(i+1).padStart(2,'0')}
            </span>
            {cur && <span style={{ fontSize:8, color:'#a78bfa70', fontStyle:'italic' }}>checking…</span>}
            {done && !nm && <span style={{ fontSize:8, color:'#34d39940' }}>skip</span>}
          </div>
        );
      })}
      {count > 7 && <p style={{ color:'#253545', fontSize:9, textAlign:'center', marginTop:2 }}>+{count-7} lainnya</p>}
    </div>
  );
};

const RulesPanel = ({ d }) => {
  const st=d.status, bg=st==='match'?'#031c12':st==='no_match'?'#1c0e00':st==='scanning'?'#120a28':'#070d18';
  const bdr=st==='match'?'#34d39928':st==='no_match'?'#fbbf2428':st==='scanning'?'#a78bfa28':'#162030';
  const badge=st==='scanning'?`${d.count} rules`:st==='match'?'COCOK ✓':st==='no_match'?'TIDAK ADA':null;
  const bc=st==='match'?'#34d399':st==='no_match'?'#fbbf24':'#a78bfa';
  return (
    <PanelShell icon="⚡" label="RULES ENGINE" badge={badge} badgeColor={bc} bg={bg} border={bdr}>
      {st==='idle'?<IdleMsg/>:st==='match'?(
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px', borderRadius:8, background:'#052e1c', border:'1px solid #34d39925' }}>
          <span style={{ fontSize:20 }}>✅</span>
          <div><p style={{ color:'#6ee7b7', fontSize:11, fontWeight:700, marginBottom:2 }}>{d.matched||'Rule cocok'}</p>
            <p style={{ color:'#34d39950', fontSize:9 }}>Rule berhasil dicocokkan</p></div>
        </div>
      ):st==='no_match'?(
        <div>
          <ScanList count={d.count} checking={-1} status="no_match"/>
          <div style={{ marginTop:6, padding:'5px 8px', borderRadius:6, background:'#fbbf2408', border:'1px solid #fbbf2420', textAlign:'center' }}>
            <p style={{ color:'#fbbf2460', fontSize:9 }}>Tidak ada rule cocok → lanjut Knowledge Base</p>
          </div>
        </div>
      ):<ScanList count={d.count} checking={d.checking} status={st}/>}
    </PanelShell>
  );
};

const KBPanel = ({ d }) => {
  const st=d.status, bg=st==='match'?'#031c12':st==='no_match'?'#1c0e00':st==='scanning'?'#120a28':'#070d18';
  const bdr=st==='match'?'#34d39928':st==='no_match'?'#fbbf2428':st==='scanning'?'#a78bfa28':'#162030';
  const badge=st==='scanning'?`${d.count} KB`:st==='match'?'COCOK ✓':st==='no_match'?'TIDAK ADA':null;
  const bc=st==='match'?'#34d399':st==='no_match'?'#fbbf24':'#a78bfa';
  return (
    <PanelShell icon="📚" label="KNOWLEDGE BASE" badge={badge} badgeColor={bc} bg={bg} border={bdr}>
      {st==='idle'?<IdleMsg/>:st==='match'?(
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px', borderRadius:8, background:'#052e1c', border:'1px solid #34d39925' }}>
          <span style={{ fontSize:20 }}>📖</span>
          <div><p style={{ color:'#6ee7b7', fontSize:11, fontWeight:700, marginBottom:2 }}>Knowledge ditemukan</p>
            <p style={{ color:'#34d39950', fontSize:9, lineHeight:1.5 }}>{d.categories||'Kategori digunakan'}</p></div>
        </div>
      ):st==='no_match'?(
        <div>
          <ScanList count={d.count} checking={-1} status="no_match"/>
          <div style={{ marginTop:6, padding:'5px 8px', borderRadius:6, background:'#fbbf2408', border:'1px solid #fbbf2420', textAlign:'center' }}>
            <p style={{ color:'#fbbf2460', fontSize:9 }}>Tidak ada KB cocok → lanjut AI</p>
          </div>
        </div>
      ):<ScanList count={d.count} checking={d.checking} status={st}/>}
    </PanelShell>
  );
};

const AIPanel = ({ d }) => {
  const st=d.status;
  const bg=st==='done'?'#031c12':st==='thinking'?'#0e0d30':'#070d18';
  const bdr=st==='done'?'#34d39928':st==='thinking'?'#818cf828':'#162030';
  const badge=st==='thinking'?'THINKING…':st==='done'?'SELESAI ✓':null;
  const bc=st==='done'?'#34d399':'#818cf8';
  return (
    <PanelShell icon="🤖" label="AI PROCESSING" badge={badge} badgeColor={bc} bg={bg} border={bdr}>
      {st==='idle'?<IdleMsg/>:(
        <div>
          {d.provider&&(
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
              <span style={{ fontSize:9, padding:'3px 10px', borderRadius:20, background:'#1a1a40', color:'#a5b4fc',
                border:'1px solid #818cf835', fontFamily:'monospace', letterSpacing:'0.04em' }}>
                {d.provider}/{d.model}
              </span>
            </div>
          )}
          {st==='thinking'?(
            <div>
              <div style={{ height:5, borderRadius:4, overflow:'hidden', background:'#1a1a40', marginBottom:10 }}>
                <div style={{ height:'100%', borderRadius:4,
                  background:'linear-gradient(90deg,#818cf808 0%,#818cf8 40%,#c4b5fd 60%,#818cf808 100%)',
                  backgroundSize:'250% 100%', animation:'aiShimmer 1.3s ease-in-out infinite' }}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:10, color:'#a5b4fc60' }}>Memproses jawaban</span>
                <div style={{ display:'flex', gap:3 }}>
                  {[0,1,2].map(i=>(
                    <span key={i} style={{ display:'inline-block', width:4, height:14, borderRadius:2,
                      background:'#818cf8', animation:`dotPop 0.9s ${i*0.2}s ease-in-out infinite` }}/>
                  ))}
                </div>
              </div>
            </div>
          ):st==='done'?(
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
                {[{l:'Token',v:d.tokens.toLocaleString()},{l:'Karakter',v:d.chars.toLocaleString()}].map(s=>(
                  <div key={s.l} style={{ padding:'8px', borderRadius:8, background:'#052e1c', border:'1px solid #34d39920', textAlign:'center' }}>
                    <p style={{ color:'#6ee7b7', fontSize:16, fontWeight:700, lineHeight:1.1 }}>{s.v}</p>
                    <p style={{ color:'#34d39950', fontSize:9, marginTop:2 }}>{s.l}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding:'5px', borderRadius:6, background:'#052e1c', border:'1px solid #34d39920', textAlign:'center' }}>
                <span style={{ fontSize:9, color:'#34d39960' }}>✨ Respons berhasil dibuat</span>
              </div>
            </div>
          ):null}
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
      setNodeStates(INIT_NODES); setSegStates(INIT_SEGS);
      setRulesD(INIT_RULES); setKbD(INIT_KB); setAiD(INIT_AI);
    }, 4000);
  }, []);

  const addParticles = useCallback((segId, color) => {
    const seg=SEGMENTS.find(s=>s.id===segId); if(!seg) return;
    const from=NODES.find(n=>n.id===seg.from), to=NODES.find(n=>n.id===seg.to); if(!from||!to) return;
    const fromX=from.x+NHW+4, toX=to.x-NHW-4;
    [0,320,640].forEach((delay,i)=>{
      setTimeout(()=>{
        const pid=`${Date.now()}-${i}-${Math.random()}`;
        setParticles(p=>[...p.slice(-30),{id:pid,fromX,toX,color}]);
        setTimeout(()=>setParticles(p=>p.filter(x=>x.id!==pid)),1300);
      },delay);
    });
  },[]);

  const startScan = useCallback((setFn, count, timerRef)=>{
    clearInterval(timerRef.current);
    const speed=Math.max(220, Math.min(700, 2200/Math.max(count,1)));
    let idx=0;
    setFn(prev=>({...prev,checking:0}));
    timerRef.current=setInterval(()=>{
      idx++; if(idx>=count){clearInterval(timerRef.current);return;}
      setFn(prev=>({...prev,checking:idx}));
    },speed);
  },[]);

  const handleEvent = useCallback((event)=>{
    const t=event.type;
    setNodeStates(prev=>{
      const n={...prev};
      if(t==='message_in'){Object.assign(n,INIT_NODES);n.msg='incoming';}
      else if(t==='rules_scan')n.rules='processing';
      else if(t==='rule_match'){n.msg='match';n.rules='match';}
      else if(t==='rule_no_match')n.rules='no_match';
      else if(t==='knowledge_scan')n.kb='processing';
      else if(t==='knowledge_match')n.kb='match';
      else if(t==='knowledge_no_match')n.kb='no_match';
      else if(t==='ai_call')n.ai='active';
      else if(t==='ai_response')n.ai='match';
      else if(t==='reply_sending')n.reply='sending';
      else if(t==='reply_sent')n.reply='done';
      else if(t==='reply_error')n.reply='error';
      return n;
    });
    setSegStates(prev=>{
      const s={...prev};
      if(t==='message_in'){Object.assign(s,INIT_SEGS);s['msg-rules']='incoming';}
      else if(t==='rule_match'){s['msg-rules']='done';if(event.mode==='direct')s['ai-reply']='sending';}
      else if(t==='rule_no_match'){s['msg-rules']='idle';s['rules-kb']='processing';}
      else if(t==='knowledge_match'||t==='knowledge_no_match'){s['rules-kb']='idle';s['kb-ai']='processing';}
      else if(t==='ai_response'){s['kb-ai']='done';s['ai-reply']='sending';}
      else if(t==='reply_sent')s['ai-reply']='done';
      else if(t==='reply_error')s['ai-reply']='error';
      return s;
    });
    if(t==='message_in')addParticles('msg-rules','#22d3ee');
    else if(t==='rule_no_match')addParticles('rules-kb','#a78bfa');
    else if(t==='knowledge_match'||t==='knowledge_no_match')addParticles('kb-ai','#a78bfa');
    else if(t==='ai_response')addParticles('ai-reply','#fb923c');
    else if(t==='rule_match'&&event.mode==='direct')addParticles('ai-reply','#fb923c');

    if(t==='message_in'){setLastMsg({chat:event.chat||'',preview:event.preview||''});setRulesD(INIT_RULES);setKbD(INIT_KB);setAiD(INIT_AI);}
    else if(t==='rules_scan'){const c=event.count||1;setRulesD({status:'scanning',count:c,checking:0,matched:null});startScan(setRulesD,c,ruleScanTimer);}
    else if(t==='rule_match'){clearInterval(ruleScanTimer.current);setRulesD(prev=>({...prev,status:'match',matched:event.name||'Rule cocok',checking:-1}));}
    else if(t==='rule_no_match'){clearInterval(ruleScanTimer.current);setRulesD(prev=>({...prev,status:'no_match',checking:-1}));}
    else if(t==='knowledge_scan'){const c=event.count||1;setKbD({status:'scanning',count:c,checking:0,categories:''});startScan(setKbD,c,kbScanTimer);}
    else if(t==='knowledge_match'){clearInterval(kbScanTimer.current);setKbD(prev=>({...prev,status:'match',categories:event.categories||'',checking:-1}));}
    else if(t==='knowledge_no_match'){clearInterval(kbScanTimer.current);setKbD(prev=>({...prev,status:'no_match',checking:-1}));}
    else if(t==='ai_call')setAiD({status:'thinking',provider:event.provider||'',model:event.model||'',tokens:0,chars:0});
    else if(t==='ai_response')setAiD(prev=>({...prev,status:'done',tokens:event.tokens||0,chars:event.chars||0}));
    if(t==='reply_sent'||t==='reply_error')scheduleReset();
  },[addParticles,scheduleReset,startScan]);

  const pushLog=useCallback((ev)=>{
    setEvents(prev=>[ev,...prev].slice(0,40));
  },[]);

  useEffect(()=>{
    if(!token) return;
    let active=true, ws=null, retryTimer=null;
    const connect=()=>{
      if(!active) return;
      const proto=window.location.protocol==='https:'?'wss':'ws';
      const url=`${proto}://${window.location.host}/ws/workflow?token=${encodeURIComponent(token)}`;
      try{ws=new WebSocket(url);}catch{if(active)retryTimer=setTimeout(connect,4000);return;}
      ws.onopen=()=>setConnected(true);
      ws.onmessage=(e)=>{
        try{const ev=JSON.parse(e.data);if(ev.type==='heartbeat'||ev.type==='connected')return;pushLog(ev);handleEvent(ev);}catch{}
      };
      ws.onclose=()=>{setConnected(false);if(active)retryTimer=setTimeout(connect,3000);};
      ws.onerror=()=>{setConnected(false);ws.close();};
    };
    connect();
    return()=>{
      active=false;clearTimeout(retryTimer);clearTimeout(resetTimer.current);
      clearInterval(ruleScanTimer.current);clearInterval(kbScanTimer.current);
      if(ws)ws.close();setConnected(false);
    };
  },[token,handleEvent,pushLog]);

  const eventLabel=(e)=>{
    switch(e.type){
      case 'message_in':         return `📥 Dari ${e.chat||'?'}: "${e.preview||''}"`;
      case 'rules_scan':         return `⚡ Memeriksa ${e.count||0} rule…`;
      case 'rule_match':         return `✅ Rule: "${e.name}" [${e.mode}]`;
      case 'rule_no_match':      return `↩ Tidak ada rule → lanjut KB`;
      case 'knowledge_scan':     return `📚 Memeriksa ${e.count||0} KB…`;
      case 'knowledge_match':    return `✅ KB: ${e.categories}`;
      case 'knowledge_no_match': return `↩ Tidak ada KB → lanjut AI`;
      case 'ai_call':            return `🤖 AI: ${e.provider}/${e.model}`;
      case 'ai_response':        return `✨ AI selesai (${e.tokens||0} token, ${e.chars||0} kar)`;
      case 'reply_sending':      return `📤 Mengirim…`;
      case 'reply_sent':         return `✅ Terkirim via WAHA`;
      case 'reply_error':        return `❌ Gagal: ${e.reason||'?'}`;
      default:                   return e.type;
    }
  };
  const logDot=(e)=>{
    if(['rule_match','knowledge_match','ai_response','reply_sent'].includes(e.type))return'#34d399';
    if(['rule_no_match','knowledge_no_match'].includes(e.type))return'#fbbf24';
    if(e.type==='reply_error')return'#f87171';
    if(e.type==='reply_sending')return'#fb923c';
    if(['ai_call','rules_scan','knowledge_scan'].includes(e.type))return'#a78bfa';
    if(e.type==='message_in')return'#22d3ee';
    return'#3d5570';
  };

  const anyDetail = rulesD.status!=='idle'||kbD.status!=='idle'||aiD.status!=='idle';

  return (
    <div className="rounded-xl overflow-hidden" style={{ background:'#05090f', border:'1px solid #1a2a40' }}>
      <style>{`
        @keyframes flowDash  { from{stroke-dashoffset:14}to{stroke-dashoffset:0} }
        @keyframes ringPulse { 0%,100%{opacity:0.5}50%{opacity:0.08} }
        @keyframes aiShimmer { 0%{background-position:250% 0}100%{background-position:-250% 0} }
        @keyframes dotPop    { 0%,100%{transform:scaleY(0.3);opacity:0.25}50%{transform:scaleY(1);opacity:1} }
        @keyframes fadeIn    { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        .line-flow  { animation:flowDash 0.42s linear infinite; }
        .pulse-ring { animation:ringPulse 1.6s ease-in-out infinite; }
        .panel-in   { animation:fadeIn 0.35s ease forwards; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background:'linear-gradient(90deg,#07101e,#090f1c)', borderBottom:'1px solid #1a2a40',
        padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ width:3, height:18, borderRadius:2,
              background:'linear-gradient(180deg,#22d3ee,#a78bfa,#fb923c)' }}/>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ color:'#e2e8f0', fontSize:13, fontWeight:700, letterSpacing:'0.03em' }}>Workflow Monitor</span>
              <span style={{ fontSize:9, padding:'2px 8px', borderRadius:12,
                background:'#0f1e30', color:'#3d6080', border:'1px solid #1e3a50',
                fontFamily:'monospace' }}>REALTIME</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:3 }}>
              {[['#22d3ee','Menerima'],['#a78bfa','Memproses'],['#fb923c','Mengirim'],['#34d399','Selesai']].map(([c,l])=>(
                <span key={l} style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:'#3d5570' }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:c, display:'inline-block' }}/>
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ position:'relative', width:8, height:8 }}>
            <span style={{ position:'absolute', inset:0, borderRadius:'50%',
              background: connected?'#34d399':'#f87171',
              boxShadow: connected?'0 0 8px #34d399':'none',
              animation: connected?'pulse 2s infinite':'none' }}/>
          </div>
          <span style={{ fontSize:11, color:connected?'#34d399':'#f87171', fontWeight:600 }}>
            {connected?'Live':'Menghubungkan…'}
          </span>
        </div>
      </div>

      {/* ── SVG Flow Diagram ── */}
      <div style={{ padding:'20px 16px 8px', position:'relative' }}>
        {/* Background dot grid */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:0.4 }}>
          <defs>
            <pattern id="dot-grid" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="11" cy="11" r="0.7" fill="#1e3050"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)"/>
        </svg>

        <svg viewBox="0 0 900 228" width="100%" height="auto" style={{ overflow:'visible', position:'relative' }}>
          <defs>
            <style>{`.line-flow{animation:flowDash .42s linear infinite}`}</style>
            {/* Glow filters */}
            {[['fc','#22d3ee'],['fv','#a78bfa'],['fo','#fb923c'],['fg','#34d399'],['fr','#f87171']].map(([id,c])=>(
              <filter key={id} id={id} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            ))}
            {/* Node gradient defs */}
            {Object.entries(NODE_THEME).map(([k,th])=>(
              <linearGradient key={k} id={`ng-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={th.bg1}/>
                <stop offset="100%" stopColor={th.bg2}/>
              </linearGradient>
            ))}
            {/* Arrowhead markers */}
            {[['arr-idle','#162030'],['arr-cyan','#22d3ee'],['arr-violet','#a78bfa'],
              ['arr-orange','#fb923c'],['arr-green','#34d399'],['arr-red','#f87171']].map(([id,c])=>(
              <marker key={id} id={id} markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L9,3.5 z" fill={c}/>
              </marker>
            ))}
          </defs>

          {/* Track lines (background) */}
          {SEGMENTS.map(seg=>{
            const from=NODES.find(n=>n.id===seg.from), to=NODES.find(n=>n.id===seg.to);
            return <line key={`t-${seg.id}`}
              x1={from.x+NHW+4} y1={NY} x2={to.x-NHW-4} y2={NY}
              stroke="#0f1e30" strokeWidth={3} markerEnd="url(#arr-idle)"/>;
          })}

          {/* Active flow lines */}
          {SEGMENTS.map(seg=>{
            const st=segStates[seg.id]||'idle'; if(st==='idle') return null;
            const th=SEG_THEME[st]||SEG_THEME.idle;
            const from=NODES.find(n=>n.id===seg.from), to=NODES.find(n=>n.id===seg.to);
            const x1=from.x+NHW+4, x2=to.x-NHW-4;
            const fid=st==='incoming'?'fc':st==='processing'?'fv':st==='sending'?'fo':st==='done'?'fg':'fr';
            return (
              <g key={`fl-${seg.id}`}>
                {/* Glow shadow line */}
                <line x1={x1} y1={NY} x2={x2} y2={NY}
                  stroke={th.color} strokeWidth={8} opacity={0.15}
                  style={{filter:`url(#${fid})`}}/>
                {/* Main active line */}
                <line x1={x1} y1={NY} x2={x2} y2={NY}
                  stroke={th.color} strokeWidth={th.width}
                  strokeDasharray={th.animated?'8 6':undefined}
                  className={th.animated?'line-flow':undefined}
                  style={{filter:`url(#${fid})`}}
                  markerEnd={`url(#${th.marker})`}/>
              </g>
            );
          })}

          {/* Particles */}
          {particles.map(p=>(
            <g key={p.id}>
              <circle r={8} fill={p.color} opacity={0.15} style={{filter:`drop-shadow(0 0 6px ${p.color})`}}>
                <animateMotion dur="1.05s" fill="freeze" path={`M ${p.fromX} ${NY} L ${p.toX} ${NY}`}/>
              </circle>
              <circle r={4.5} fill={p.color} style={{filter:`drop-shadow(0 0 4px ${p.color})`}}>
                <animateMotion dur="1.05s" fill="freeze" path={`M ${p.fromX} ${NY} L ${p.toX} ${NY}`}/>
              </circle>
            </g>
          ))}

          {/* Connection port circles */}
          {SEGMENTS.map(seg=>{
            const from=NODES.find(n=>n.id===seg.from), to=NODES.find(n=>n.id===seg.to);
            const st=segStates[seg.id]||'idle';
            const col=st!=='idle'?(SEG_THEME[st]||SEG_THEME.idle).color:'#162030';
            return (
              <g key={`port-${seg.id}`}>
                <circle cx={from.x+NHW} cy={NY} r={4} fill={col} stroke="#05090f" strokeWidth={1.5}
                  style={{transition:'fill 0.4s'}}/>
                <circle cx={to.x-NHW}   cy={NY} r={4} fill={col} stroke="#05090f" strokeWidth={1.5}
                  style={{transition:'fill 0.4s'}}/>
              </g>
            );
          })}

          {/* Nodes */}
          {NODES.map(node=>{
            const state=nodeStates[node.id]||'idle', th=NODE_THEME[state]||NODE_THEME.idle;
            return (
              <g key={node.id} transform={`translate(${node.x},${NY})`}>
                {/* Outer pulse ring */}
                {th.pulse&&(
                  <rect x={-NHW-7} y={-NHH-7} width={(NHW+7)*2} height={(NHH+7)*2} rx={20}
                    fill="none" stroke={th.ring} strokeWidth={1.5} className="pulse-ring"/>
                )}
                {/* Shadow glow layer */}
                {th.glow&&(
                  <rect x={-NHW} y={-NHH} width={NHW*2} height={NHH*2} rx={14}
                    fill={th.bg2} style={{filter:`drop-shadow(0 0 18px ${th.glow}45)`}}/>
                )}
                {/* Gradient body */}
                <rect x={-NHW} y={-NHH} width={NHW*2} height={NHH*2} rx={14}
                  fill={`url(#ng-${state})`} stroke={th.ring}
                  strokeWidth={state==='idle'?1:2.5}
                  style={{transition:'stroke 0.4s'}}/>
                {/* Top highlight line */}
                <line x1={-NHW+16} y1={-NHH+1} x2={NHW-16} y2={-NHH+1}
                  stroke={th.ring} strokeWidth={1} opacity={state==='idle'?0.15:0.4}
                  style={{transition:'opacity 0.4s'}}/>
                {/* Step badge */}
                <circle cx={-NHW+14} cy={-NHH+14} r={9}
                  fill={state==='idle'?'#0f1e30':th.bg2} stroke={th.ring} strokeWidth={1}/>
                <text x={-NHW+14} y={-NHH+14} textAnchor="middle" dominantBaseline="middle"
                  fontSize={8} fontWeight={700} fill={th.ring} fontFamily="system-ui,sans-serif">
                  {node.step}
                </text>
                {/* Icon */}
                <text x={0} y={-12} textAnchor="middle" dominantBaseline="middle" fontSize={26}>
                  {node.icon}
                </text>
                {/* Label */}
                <text x={0} y={14} textAnchor="middle" fontSize={10} fontWeight={700}
                  fill={th.text} fontFamily="system-ui,sans-serif" style={{transition:'fill 0.4s'}}>
                  {node.label}
                </text>
                {/* Status badge */}
                {state!=='idle'&&th.status&&(
                  <g>
                    <rect x={-32} y={26} width={64} height={14} rx={7}
                      fill={`${th.statusColor}18`} stroke={`${th.statusColor}40`} strokeWidth={1}/>
                    <text x={0} y={33} textAnchor="middle" dominantBaseline="middle"
                      fontSize={7.5} fontWeight={700} fill={th.statusColor}
                      fontFamily="system-ui,sans-serif" letterSpacing="0.08em">
                      {th.status}
                    </text>
                  </g>
                )}
                {/* Scanning dots */}
                {th.dots&&[0,1,2].map(i=>(
                  <circle key={i} cx={-6+i*6} cy={state!=='idle'&&th.status?46:38} r={2.5} fill={th.ring}>
                    <animate attributeName="opacity" values="0.12;1;0.12"
                      dur="1s" begin={`${i*0.32}s`} repeatCount="indefinite"/>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Detail Panels ── */}
      {anyDetail&&(
        <div className="panel-in" style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, padding:'0 16px 12px' }}>
          <RulesPanel d={rulesD}/>
          <KBPanel    d={kbD}/>
          <AIPanel    d={aiD}/>
        </div>
      )}

      {/* ── Last message ── */}
      {lastMsg&&(
        <div style={{ margin:'0 16px 10px', padding:'8px 14px', borderRadius:10,
          background:'#091525', border:'1px solid #1a3050',
          display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#22d3ee',
            boxShadow:'0 0 8px #22d3ee', flexShrink:0 }}/>
          <span style={{ color:'#3d5570', fontSize:11 }}>Terakhir:</span>
          <span style={{ color:'#67e8f9', fontSize:11, fontFamily:'monospace' }}>{lastMsg.chat}</span>
          <span style={{ color:'#7a9ab8', fontSize:11 }}>"{lastMsg.preview}"</span>
        </div>
      )}

      {/* ── Event Log ── */}
      <div style={{ margin:'0 16px 16px', borderRadius:10, overflow:'hidden', border:'1px solid #1a2a40' }}>
        <div style={{ padding:'8px 12px', background:'#070f1c', borderBottom:'1px solid #1a2a40',
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'#2d4560' }}>LOG AKTIVITAS</span>
          <span style={{ fontSize:9, padding:'2px 8px', borderRadius:12, background:'#0f1e30',
            color:'#2d4560', border:'1px solid #1a2a40', fontFamily:'monospace' }}>
            {events.length} event
          </span>
        </div>
        <div ref={eventsLogRef} style={{ maxHeight:156, overflowY:'auto', background:'#05090f' }}>
          {events.length===0?(
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'28px 0', gap:8 }}>
              <span style={{ fontSize:26, opacity:0.12 }}>📡</span>
              <p style={{ color:'#1a2a40', fontSize:10 }}>Menunggu pesan masuk…</p>
            </div>
          ):events.map((e,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px',
              borderBottom:'1px solid #0a1220' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0,
                background:logDot(e), boxShadow:`0 0 5px ${logDot(e)}` }}/>
              <span style={{ fontSize:10, flex:1, color:'#5a7a98', fontFamily:'monospace',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {eventLabel(e)}
              </span>
              <span style={{ fontSize:9, flexShrink:0, color:'#1e3050', fontFamily:'monospace' }}>
                {e.ts?new Date(e.ts).toLocaleTimeString('id-ID',{hour12:false}):''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowCanvas;
