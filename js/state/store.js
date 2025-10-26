// /js/state/store.js
// Minimal unidirectional store (event bus style)
const listeners = new Set();
const initial = {
  userSettings: { aiModel: 'gemini-2.5-flash', darkMode: 'system', dailyGoal: 10, engineMode: 'forgetting' },
  auditQuizScores: {},   // { [id]: {score, feedback, user_answer, hintUsed, isSolved, lastSolvedDate, solveHistory:[{date,score}] } }
  dailyActivityCache: {},// { 'YYYY-MM-DD': { solvedCount, avgScore } }
  questions: [],         // array
  recommendSet: []       // [{id, score, fi, reason}]
};

let state = structuredClone(initial);

export function getState(){ return state; }
export function subscribe(fn){ listeners.add(fn); return ()=>listeners.delete(fn); }
function emit(){ listeners.forEach(fn=>{ try{ fn(state);}catch(_){}}); }

export const store = { getState, subscribe, dispatch };

export function dispatch(action){
  switch(action.type){
    case 'SET_QUESTIONS': state = { ...state, questions: action.payload||[] }; break;
    case 'SET_SCORES': state = { ...state, auditQuizScores: action.payload||{} }; saveScores(); break;
    case 'UPSERT_SCORE': {
      const { id, entry } = action.payload || {};
      if (!id) break;
      const next = { ...state.auditQuizScores, [id]: entry };
      state = { ...state, auditQuizScores: next }; saveScores(); break;
    }
    case 'SET_SETTINGS': state = { ...state, userSettings: { ...state.userSettings, ...(action.payload||{}) } }; saveSettings(); break;
    case 'SET_DAILY_CACHE': state = { ...state, dailyActivityCache: action.payload||{} }; break;
    case 'LOAD_RECOMMEND_SET': state = { ...state, recommendSet: action.payload||[] }; break;
    default: break;
  }
  emit();
}

function saveScores(){ try{ localStorage.setItem('auditQuizScores', JSON.stringify(state.auditQuizScores)); }catch{} }
function saveSettings(){ try{ localStorage.setItem('userSettings', JSON.stringify(state.userSettings)); }catch{} }

export function initStateFromStorage(){
  try{
    const s = JSON.parse(localStorage.getItem('auditQuizScores')||'{}');
    if (s && typeof s==='object') state.auditQuizScores = s;
  }catch{}
  try{
    const u = JSON.parse(localStorage.getItem('userSettings')||'{}');
    if (u && typeof u==='object') state.userSettings = { ...state.userSettings, ...u };
  }catch{}
}