// /js/ui/explorer.js
import { store } from '../state/store.js';

export function mountExplorer({ treeEl }){
  const render = ()=>{
    const s = store.getState();
    const byCh = new Map();
    s.questions.forEach(q=>{
      const ch = String(q.단원).trim();
      if (!byCh.has(ch)) byCh.set(ch, []);
      byCh.get(ch).push(q);
    });
    const chapters = [...byCh.keys()].sort((a,b)=>Number(a)-Number(b));
    treeEl.innerHTML = '';
    chapters.forEach(ch=>{
      const wrap = document.createElement('div');
      wrap.className = 'group';
      const h = document.createElement('h4'); h.textContent = `단원 ${ch}`; wrap.appendChild(h);
      byCh.get(ch).forEach(q=>{
        const row = document.createElement('div');
        row.className = 'item';
        const title = q.problemTitle || `문항 ${q.표시번호||q.물음번호||q.고유ID}`;
        const score = s.auditQuizScores?.[String(q.고유ID).trim()]?.score;
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = !Number.isFinite(Number(score))? '미응시' : (score<60?'60-':score<80?'80-':'80+');
        row.innerHTML = `<span>${title}</span>`;
        row.appendChild(badge);
        row.addEventListener('click', ()=>{
          const id = String(q.고유ID).trim();
          const set = store.getState().recommendSet?.length ? store.getState().recommendSet : [{ id, score: score??-1, fi: 0, reason:{} }];
          store.dispatch({ type:'LOAD_RECOMMEND_SET', payload: set });
        });
        wrap.appendChild(row);
      });
      treeEl.appendChild(wrap);
    });
  };
  store.subscribe(render);
  render();
}