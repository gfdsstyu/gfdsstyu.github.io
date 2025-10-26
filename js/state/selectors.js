// /js/state/selectors.js
import { store } from './store.js';

// dataset 확보: questions.json → 실패 시 #dataset-json
export async function ensureDataset(){
  if (store.getState().questions.length) return;
  let data = [];
  try{
    const res = await fetch('questions.json', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    data = await res.json();
  }catch{
    const node = document.getElementById('dataset-json');
    if (!node) throw new Error('데이터가 없습니다(questions.json, dataset-json 둘다 없음).');
    data = JSON.parse((node.textContent||'[]').trim()||'[]');
  }
  store.dispatch({ type: 'SET_QUESTIONS', payload: Array.isArray(data)?data:[] });
}

export function getAllQuestions(state = store.getState()){
  return state.questions || [];
}

// solveHistory 기반 1회 집계
export function buildDailyActivityCache(state = store.getState()){
  const cache = {};
  const scores = state.auditQuizScores || {};
  for (const v of Object.values(scores)){
    const hist = Array.isArray(v?.solveHistory) ? v.solveHistory : [];
    hist.forEach(h=>{
      const d = toISODate(h.date);
      if (!cache[d]) cache[d] = { solvedCount: 0, _sum:0 };
      cache[d].solvedCount += 1;
      cache[d]._sum += Number(h.score||0);
    });
  }
  Object.keys(cache).forEach(d=>{
    const { solvedCount, _sum } = cache[d];
    cache[d] = { solvedCount, avgScore: solvedCount? (_sum/solvedCount) : 0 };
  });
  return cache;
}

function toISODate(ts){
  const d = new Date(Number(ts||Date.now()));
  const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}