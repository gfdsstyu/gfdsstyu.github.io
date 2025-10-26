// js/ui/quiz.js
let questionsIndex = null; // { id -> question }

export function mountQuiz(store){
  const center = ensure('#v4-center');
  center.innerHTML = ''
    + '<section class="p-4 rounded-xl border bg-white dark:bg-gray-900">'
    + '  <h3 class="font-bold mb-2">퀴즈 영역(v4)</h3>'
    + '  <div id="v4-qpanel" class="space-y-3">'
    + '    <div class="text-sm text-gray-500">좌측 "오늘의 복습"에서 항목을 클릭하면 이곳에 문항이 로드됩니다.</div>'
    + '  </div>'
    + '  <textarea id="v4-answer" class="w-full border rounded p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" rows="3" placeholder="자동 임시저장 데모"></textarea>'
    + '  <div class="mt-2 text-xs text-gray-500">Ctrl+Enter 채점, ←/→ 이동 예정</div>'
    + '</section>';

  const ta = document.getElementById('v4-answer');
  let t;
  ta.addEventListener('input', ()=>{
export function mountQuiz(store){
  const center = ensure('#v4-center');
  center.innerHTML = `
    <section class="p-4 rounded-xl border bg-white dark:bg-gray-900">
      <h3 class="font-bold mb-2">퀴즈 영역(v4 Shell)</h3>
      <p class="text-sm text-gray-500">v3.2 로직을 이 영역으로 모듈화 이전 예정</p>
      <textarea id="v4-answer" class="w-full border rounded p-2" rows="3" placeholder="자동 임시저장 데모"></textarea>
      <div class="mt-2 text-xs text-gray-500">Ctrl+Enter 채점, ←/→ 이동 예정</div>
    </section>`;
  const ta = document.getElementById('v4-answer');
  let t;
  ta.addEventListener('input', (e)=>{
    clearTimeout(t); t=setTimeout(()=>{ sessionStorage.setItem('v4-autosave', ta.value); }, 500);
    autoGrow(ta);
  });
  // restore
  ta.value = sessionStorage.getItem('v4-autosave')||'';
  autoGrow(ta);
  // shortcuts (stub)
  document.addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && e.key==='Enter'){ e.preventDefault(); console.log('[v4] grade shortcut'); }
    if(e.key==='ArrowLeft'){ /* prev */ }
    if(e.key==='ArrowRight'){ /* next */ }
  });

  // subscribe selection
  let lastId = null;
  store.subscribe(async (state)=>{
    const id = state.selection?.currentId;
    if(!id || id===lastId) return;
    lastId = id;
    const q = await getQuestionById(id);
    renderQuestion(q);
  });
}

function renderQuestion(q){
  const panel = document.getElementById('v4-qpanel');
  if(!q){
    panel.innerHTML = '<div class="text-red-600 text-sm">문항을 찾을 수 없습니다.</div>';
    return;
  }
  panel.innerHTML = ''
    + '<div class="flex items-center justify-between">'
    + '  <div class="text-lg font-bold text-blue-700 dark:text-blue-400">문항 ' + escapeHtml(q["표시번호"]||q["물음번호"]||q["고유ID"]) + '</div>'
    + '  <div class="text-xs text-gray-500">ID: ' + escapeHtml(q["고유ID"]) + '</div>'
    + '</div>'
    + '<div class="text-base leading-relaxed text-gray-800 dark:text-gray-100">' + escapeHtml(q["물음"]) + '</div>';
}

async function getQuestionById(id){
  if(!questionsIndex){
    questionsIndex = await loadQuestionsIndex();
  }
  return questionsIndex[id];
}

async function loadQuestionsIndex(){
  // 1) try questions.json
  try{
    const res = await fetch('questions.json', { cache:'no-store' });
    if(res.ok){
      const arr = await res.json();
      return indexById(arr);
    }
  }catch(e){ /* ignore */ }
  // 2) fallback dataset-json
  const node = document.getElementById('dataset-json');
  if(node){
    try {
      const arr = JSON.parse((node.textContent||'').trim());
      return indexById(arr);
    } catch(e){ /* ignore */ }
  }
  return {};
}

function indexById(arr){
  const map = {};
  (arr||[]).forEach(q=>{ const id=String(q['고유ID']).trim(); if(id) map[id]=q; });
  return map;
}

function autoGrow(el){ el.style.height='auto'; el.style.height=el.scrollHeight+'px'; }
function ensure(sel){ const n=document.querySelector(sel); if(!n) throw new Error(`missing ${sel}`); return n; }
function escapeHtml(s){
  return String(s||'').replace(/[&<>\"']/g, c=>({"&":"&amp;","<":"&lt;",
    ">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
