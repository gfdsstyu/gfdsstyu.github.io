// js/state/store.js
export function initStore(){
  const listeners = new Set();
  const state = {
    scores: JSON.parse(localStorage.getItem('auditQuizScores')||'{}'),
    settings: {
      aiModel: localStorage.getItem('aiModel')||'gemini-2.5-flash',
      darkMode: localStorage.getItem('darkMode')||'system',
      dailyGoal: Number(localStorage.getItem('dailyGoal')||10),
      engineMode: localStorage.getItem('engineMode')||'forgetting',
    },
    cache: { dailyActivity: {} },
  };
  function emit(){ listeners.forEach(f=>f(state)); }
  function set(path, value){
    const seg = path.split('.');
    let cur = state;
    while(seg.length>1){ cur = cur[seg.shift()]; }
    cur[seg[0]] = value;
    emit();
  }
  function subscribe(fn){ listeners.add(fn); return ()=>listeners.delete(fn);}
  // derive daily activity once
  try {
    state.cache.dailyActivity = buildDailyActivity(state.scores);
  } catch(e){ console.warn('[v4] dailyActivity fail', e); }
  return { get:()=>state, set, subscribe };
}

export function buildDailyActivity(scores){
  const out = {};
  for(const [id,rec] of Object.entries(scores||{})){
    const hist = rec.solveHistory||[];
    for(const h of hist){
      const d = toISODate(new Date(h.date||0));
      if(!out[d]) out[d] = { solvedCount:0, sum:0, n:0 };
      out[d].solvedCount++;
      if(Number.isFinite(Number(h.score))){ out[d].sum+=Number(h.score); out[d].n++; }
    }
  }
  for(const k in out){
    out[k].avgScore = out[k].n? out[k].sum/out[k].n : null;
    delete out[k].sum; delete out[k].n;
  }
  return out;
}

function toISODate(d){
  const y=d.getFullYear(), m=d.getMonth()+1, day=d.getDate();
  return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
