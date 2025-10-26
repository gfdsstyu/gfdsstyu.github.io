import { recommend } from '../engine/recommend.js';

export function mountDashboard(store) {
  const left = ensure('#v4-left');
  left.innerHTML = `
    <section class="p-4 rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800">
      <h3 class="font-bold mb-2 text-gray-900 dark:text-gray-100">오늘의 복습</h3>
      <div class="flex items-center gap-2">
        <select id="v4-strategy"
          class="p-2 border rounded bg-white text-gray-900 border-gray-300
                 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
          <option value="forgetting">지능형(망각)</option>
          <option value="low-score">점수 낮은 순</option>
          <option value="recent-wrong">최근 틀린 순</option>
        </select>
        <input id="v4-N" type="range" min="5" max="20" value="10"/>
        <button id="v4-reco"
          class="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700
                 dark:bg-blue-600 dark:hover:bg-blue-500">
          추천받기
        </button>
      </div>
      <ul id="v4-reco-list" class="mt-3 space-y-1 text-sm"></ul>
    </section>

    <section class="p-4 rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800">
      <h3 class="font-bold mb-2 text-gray-900 dark:text-gray-100">학습 캘린더(요약)</h3>
      <div id="v4-cal" class="grid grid-cols-7 gap-1 text-[10px]"></div>
    </section>`;

  renderCalendarMini(store.get().cache.dailyActivity, document.querySelector('#v4-cal'));

  document.getElementById('v4-reco').addEventListener('click', () => {
    const N = Number(document.getElementById('v4-N').value) || 10;
    const strategy = document.getElementById('v4-strategy').value;
    const list = recommend(store.get().scores, N, strategy);
    const ul = document.getElementById('v4-reco-list');
    if (!list || list.length === 0) {
      ul.innerHTML = '<li class="text-xs text-gray-500 dark:text-gray-400">학습 기록이 없거나 추천 항목이 없습니다.</li>';
      return;
    }
    ul.innerHTML = list.map(it =>
      `<li>
        • <button class="v4-reco-item underline hover:no-underline"
                  data-id="${it.id}" title="추천이유: fi=${it.fi.toFixed(2)}">${it.id}</button>
        <span class="text-gray-500 dark:text-gray-400">(fi:${it.fi.toFixed(2)})</span>
       </li>`
    ).join('');

    ul.querySelectorAll('.v4-reco-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const prev = store.get().selection || {};
        store.set('selection', { ...prev, currentId: id });
      });
    });
  });
}

function renderCalendarMini(activity, el) {
  const days = Object.keys(activity || {}).sort().slice(-42);
  el.innerHTML = days.map(d => {
    const c = activity[d]?.solvedCount || 0;
    const lvl =
      c === 0 ? 'bg-gray-100 dark:bg-gray-700'
      : c < 2 ? 'bg-green-100 dark:bg-green-900'
      : c < 4 ? 'bg-green-200 dark:bg-green-800'
      : c < 6 ? 'bg-green-300 dark:bg-green-700'
      : 'bg-green-400 dark:bg-green-600';
    return `<div title="${d}: ${c}문제" class="w-4 h-4 rounded ${lvl}"></div>`;
  }).join('');
}

function ensure(sel) { const n = document.querySelector(sel); if (!n) throw new Error(`missing ${sel}`); return n; }
