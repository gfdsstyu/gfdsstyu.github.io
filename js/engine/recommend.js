// js/engine/recommend.js
// v4 엔진 v1: 망각지수(FI) 기반 추천
export function daysSince(ts){
  if(!ts) return Infinity;
  const d = (Date.now() - Number(ts)) / 86400000;
  return Math.max(0, d);
}

function streak(hist=[]) {
  // 최근 연속 성공(>=80) 길이 간단 근사
  let s=0;
  for(let i=hist.length-1;i>=0;i--){
    if((hist[i]?.score||0) >= 80) s++; else break;
  }
  return s;
}

export function computeFI(rec){
  const hist = rec?.solveHistory||[];
  const t = daysSince(rec?.lastSolvedDate||0);
  const attempts = hist.length;
  const best = Math.max(0, ...hist.map(h=>Number(h.score)||0));
  const recentWrong = Number(((hist.at(-1)?.score)||100) < 60);
  const H0=2.0, a=0.01, b=0.2, c=0.15;
  const H = H0 * (1 + a*best + b*attempts + c*streak(hist));
  const R = Math.exp(- t / Math.max(0.1, H));
  const fi_t = (1 - R);
  const fi_s = (1 - best/100);
  const fi_m = recentWrong;
  const fi = 0.6*fi_t + 0.3*fi_s + 0.1*fi_m;
  return { fi, reason: { time: fi_t, score: fi_s, wrong: fi_m, t, best, attempts } };
}

export function recommend(scores={}, N=10, mode='forgetting'){
  const items = Object.entries(scores).map(([id,rec])=>({ id, rec }));
  let ranked = [];
  if(mode==='low-score') {
    ranked = items.map(x=>({ id:x.id, rec:x.rec, key: (Number(x.rec?.score)||0) }))
                  .sort((a,b)=>a.key-b.key)
                  .map(x=>({ id:x.id, fi: 1-(Number(x.rec?.score)||0)/100, reason: {lowScore:true} }));
  } else if(mode==='recent-wrong'){
    ranked = items.map(x=>({ id:x.id, rec:x.rec, key: Number(((x.rec?.solveHistory||[]).at(-1)?.score)||100) }))
                  .sort((a,b)=>a.key-b.key)
                  .map(x=>({ id:x.id, fi: 1-x.key/100, reason: {recentWrong:true} }));
  } else {
    ranked = items.map(x=>{ const r = computeFI(x.rec); return { id:x.id, fi:r.fi, reason:r.reason }; })
                  .sort((a,b)=>b.fi-a.fi);
  }
  return ranked.slice(0, Math.max(1, N));
}
