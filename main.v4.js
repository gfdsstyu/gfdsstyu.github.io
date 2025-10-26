// v4 shell: state, engine, and main entrypoint
export const state = {
  data: [],
  scores: {},
  settings: { model: 'gemini-2.5-flash', darkMode: 'system' }
};

export const engine = {
  clamp(n, lo=0, hi=100){ const x = Number(n); return Number.isFinite(x)?Math.max(lo, Math.min(hi, x)):lo; },
  parseJsonLike(t){ let s=(t||'').trim(); if(s.startsWith('```')) s=s.replace(/^```[\s\S]*?\n/,'').replace(/```$/,'').trim(); const a=s.indexOf('{'),b=s.lastIndexOf('}'); if(a!==-1&&b!==-1&&b>a) s=s.slice(a,b+1); try{ return JSON.parse(s);}catch{return null;} },
};

export default function main(){
  console.log('[gamlini v4] shell ready');
}
