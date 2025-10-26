// js/ui/quiz.js
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
}

function autoGrow(el){ el.style.height='auto'; el.style.height=el.scrollHeight+'px'; }
function ensure(sel){ const n=document.querySelector(sel); if(!n) throw new Error(`missing ${sel}`); return n; }
