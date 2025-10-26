// js/ui/dashboard.js
export function mountDashboard(store){
  const left = ensure('#v4-left');
  left.innerHTML = `
    <section class="p-4 rounded-xl border bg-white dark:bg-gray-900">
      <h3 class="font-bold mb-2">오늘의 복습</h3>
      <div class="flex items-center gap-2">
        <select id="v4-strategy" class="p-2 border rounded">
          <option value="forgetting">지능형(망각)</option>
          <option value="low-score">점수 낮은 순</option>
          <option value="recent-wrong">최근 틀린 순</option>
        </select>
        <input id="v4-N" type="range" min="5" max="20" value="10"/>
        <button id="v4-reco" class="px-3 py-1 rounded bg-blue-600 text-white">추천받기</button>
      </div>
      <ul id="v4-reco-list" class="mt-3 space-y-1 text-sm"></ul>
    </section>
    <section class="p-4 rounded-xl border bg-white dark:bg-gray-900">
      <h3 class="font-bold mb-2">학습 캘린더(요약)</h3>
      <div id="v4-cal" class="grid grid-cols-7 gap-1 text-[10px]"></div>
    </section>`;
  renderCalendarMini(store.get().cache.dailyActivity, document.querySelector('#v4-cal'));
  document.getElementById('v4-reco').addEventListener('click', ()=>{
    const N = Number(document.getElementById('v4-N').value)||10;
    const strategy = document.getElementById('v4-strategy').value;
    const list = recommendStub(store.get().scores, N, strategy);
    const ul = document.getElementById('v4-reco-list');
    ul.innerHTML = list.map(it=>`<li>• ${it.id} <span class="text-gray-500">(fi:${it.fi.toFixed(2)})</span></li>`).join('');
  });
}

function recommendStub(scores, N=10, mode='forgetting'){
  // placeholder: pick lowest score / random if empty
  const arr = Object.entries(scores).map(([id,rec])=>({id, best: Math.max(0,...(rec.solveHistory||[]).map(x=>x.score||0)), last: rec.lastSolvedDate||0}));
  arr.sort((a,b)=> (a.best-b.best) || (a.last-b.last));
  return arr.slice(0,N).map((x,i)=>({ id:x.id, fi: (100-x.best)/100 + (Date.now()-x.last)/1e10 }));
}

function renderCalendarMini(activity, el){
  const counts = Object.values(activity||{}).map(v=>v.solvedCount);
  const max = Math.max(1, ...(counts.length?counts:[1]));
  const days = Object.keys(activity||{}).sort().slice(-42);
  el.innerHTML = days.map(d=>{
    const c = activity[d]?.solvedCount||0;
    const lvl = c===0? 'bg-gray-100' : c<2? 'bg-green-100' : c<4? 'bg-green-200' : c<6? 'bg-green-300' : 'bg-green-400';
    return `<div title="${d}: ${c}문제" class="h-4 ${lvl}"></div>`;
  }).join('');
}

function ensure(sel){ const n=document.querySelector(sel); if(!n) throw new Error(`missing ${sel}`); return n; }
