// /js/engine/recommend.js
import { store } from '../state/store.js';

function daysSince(d){ const t = Date.now() - Number(d||0); return t/86400000; }
function streak(hist){
  if (!Array.isArray(hist)||!hist.length) return 0;
  let s=0; for(let i=hist.length-1;i>=0;i--){ if((hist[i]?.score??0)>=80) s++; else break; } return s;
}

export function computeFI({ solveHistory=[], lastSolvedDate=0 }){
  const t = Math.max(0, daysSince(lastSolvedDate));
  const attempts = solveHistory.length || 0;
  const best = solveHistory.length ? Math.max(...solveHistory.map(s=>Number(s.score||0))) : 0;
  const H = 2.0 * (1 + 0.01*best + 0.2*attempts + 0.15*streak(solveHistory));
  const R = Math.exp(-t / Math.max(0.1, H));
  const recentWrong = Number(((solveHistory.at(-1)?.score) ?? 100) < 60);
  return 0.6*(1 - R) + 0.3*(1 - best/100) + 0.1*recentWrong;
}

export function recommendToday(allQuestions, N=10, mode='forgetting'){
  const { auditQuizScores } = store.getState();
  const list = allQuestions.map(q=>{
    const rec = auditQuizScores?.[String(q.고유ID).trim()] || {};
    const fi = computeFI({ solveHistory: rec.solveHistory, lastSolvedDate: rec.lastSolvedDate });
    const last = rec.solveHistory?.at(-1)?.score ?? null;
    return {
      id: String(q.고유ID).trim(),
      score: Number(rec.score ?? (last ?? -1)),
      fi,
      reason: { fi_tuned: fi.toFixed(3), best: Math.max(0, ...(rec.solveHistory||[]).map(s=>Number(s.score||0))), attempts: (rec.solveHistory||[]).length }
    };
  });

  let ranked = list;
  if (mode === 'low-score') ranked = list.sort((a,b)=>(a.score??101)-(b.score??101));
  else if (mode === 'recent-wrong') ranked = list.sort((a,b)=>{
    const aFlag = Number((store.getState().auditQuizScores[a.id]?.solveHistory?.at(-1)?.score ?? 100) < 60);
    const bFlag = Number((store.getState().auditQuizScores[b.id]?.solveHistory?.at(-1)?.score ?? 100) < 60);
    return bFlag - aFlag;
  });
  else ranked = list.sort((a,b)=> b.fi - a.fi); // forgetting (default)

  return ranked.slice(0, N);
}
