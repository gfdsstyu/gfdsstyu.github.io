export function mountQuiz(store) {
  const center = document.querySelector('#v4-center');
  if (!center) return;
  center.innerHTML =
    '<section class="p-4 rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800">'
  + '  <h3 class="font-bold mb-2 text-gray-900 dark:text-gray-100">퀴즈 영역(v4)</h3>'
  + '  <div id="v4-qpanel" class="text-sm text-gray-500 dark:text-gray-400">좌측 "오늘의 복습"에서 항목을 클릭하면 이곳에 문항이 로드됩니다.</div>'
  + '</section>';

  store.subscribe(async (state) => {
    const id = state.selection && state.selection.currentId;
    if (!id) return;
    const q = await getQuestionById(id);
    if (!q) return;
    document.getElementById('v4-qpanel').innerHTML =
      '<div class="text-base leading-relaxed text-gray-800 dark:text-gray-100">'
      + '문항 ' + escapeHtml(q["표시번호"] || q["물음번호"] || q["고유ID"])
      + ' — ' + escapeHtml(q["물음"])
      + '</div>';
  });
}

async function getQuestionById(id) {
  try {
    const r = await fetch('questions.json', { cache: 'no-store' });
    if (r.ok) {
      const arr = await r.json();
      const m = {}; arr.forEach(q => { const k = String(q['고유ID']).trim(); if (k) m[k] = q; });
      return m[id];
    }
  } catch (e) {}
  const node = document.getElementById('dataset-json');
  if (node) {
    try {
      const arr = JSON.parse((node.textContent || '').trim());
      const m = {}; arr.forEach(q => { const k = String(q['고유ID']).trim(); if (k) m[k] = q; });
      return m[id];
    } catch (e) {}
  }
  return null;
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c])); }
