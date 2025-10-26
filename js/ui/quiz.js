// /js/ui/quiz.js
import { store, dispatch } from '../state/store.js';

export function mountQuiz(refs){
  let idx = 0;
  let list = []; // recommendSet or single

  store.subscribe(()=>{
    const s = store.getState();
    if (s.recommendSet !== list) {
      list = s.recommendSet;
      idx = 0;
      render();
    }
  });

  refs.prevBtn?.addEventListener('click', ()=>{ if (idx>0){ idx--; render(); } });
  refs.nextBtn?.addEventListener('click', ()=>{ if (idx<list.length-1){ idx++; render(); } });
  refs.gradeBtn?.addEventListener('click', ()=> fakeGrade());
  refs.answerEl?.addEventListener('input', ()=> refs.errorMsgEl?.classList.add('hidden'));

  function render(){
    if (!list.length) return;
    const s = store.getState();
    const qid = list[idx].id;
    const q = s.questions.find(x=> String(x.고유ID).trim()===qid);
    if (!q) return;
    refs.metaEl && (refs.metaEl.querySelector('#q-chapter').textContent = q.단원 ?? '-');
    refs.metaEl && (refs.metaEl.querySelector('#q-no').textContent = q.표시번호 ?? q.물음번호 ?? '-');
    refs.titleEl.textContent = q.problemTitle || '';
    refs.bodyEl.textContent = q.물음 || '';
    refs.answerEl.value = '';
    refs.resultBoxEl.classList.add('hidden');
    refs.prevBtn.disabled = (idx===0);
    refs.nextBtn.disabled = (idx===list.length-1);
  }

  function fakeGrade(){
    if (!refs.answerEl.value.trim()){
      refs.errorMsgEl.textContent = '답안을 입력해주세요.'; refs.errorMsgEl.classList.remove('hidden'); return;
    }
    const sc = Math.max(0, Math.min(100, Math.round(refs.answerEl.value.length/3)));
    refs.scoreEl.textContent = String(sc);
    refs.progressEl.style.width = `${sc}%`;
    refs.progressEl.className = 'h-3 rounded-full transition-all duration-500 ease-out ' + (sc<60?'bg-red-500':sc<80?'bg-yellow-500':'bg-blue-600');
    refs.correctEl.textContent = (store.getState().questions.find(x=> String(x.고유ID).trim()===list[idx].id)?.정답) || '';
    refs.resultBoxEl.classList.remove('hidden');

    const id = list[idx].id;
    const prev = store.getState().auditQuizScores?.[id] || {};
    const hist = Array.isArray(prev.solveHistory)? [...prev.solveHistory] : [];
    hist.push({ date: Date.now(), score: sc });
    dispatch({
      type:'UPSERT_SCORE',
      payload: { id, entry: {
        score: sc, feedback: '', user_answer: refs.answerEl.value.trim(),
        hintUsed: false, isSolved: true, lastSolvedDate: Date.now(), solveHistory: hist
      } }
    });
  }
}
