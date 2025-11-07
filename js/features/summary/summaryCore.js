/**
 * @fileoverview 요약/대시보드 - 학습 현황 요약 및 통계 표시
 */

import { getElements, getQuestionScores, getCurrentQuizData, getCurrentQuestionIndex, setCurrentQuestionIndex, getAllData } from '../../core/stateManager.js';
import { chapterLabelText, PART_INSERTIONS } from '../../config/config.js';
import { loadReadStore, computeUniqueReadsFromHistory } from '../../core/storageManager.js';
import { showToast } from '../../ui/domUtils.js';

/**
 * 요약 뷰 업데이트 (단원별 학습 현황)
 */
export function updateSummary() {
  const el = getElements();
  el.scoreSummary.innerHTML = '';

  const summaryViewMode = window.summaryViewMode || 'CURRENT';
  const questionScores = getQuestionScores();
  const currentQuizData = getCurrentQuizData();
  const allData = getAllData();

  const base = (summaryViewMode === 'CURRENT') ? (currentQuizData || []) : (allData || []);

  // 단원별 그룹화
  const groups = new Map();
  for (const q of base) {
    const ch = String(q.단원).trim();
    if (!groups.has(ch)) groups.set(ch, []);
    groups.get(ch).push(q);
  }

  // 단원 정렬
  const chapters = [...groups.keys()].sort((a, b) => {
    const na = +a, nb = +b;
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return a.localeCompare(b, 'ko');
  });

  const readStore = loadReadStore();
  const _clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  chapters.forEach(ch => {
    const n = +ch;

    // 파트 구분선 삽입
    if (Number.isFinite(n)) {
      const hit = PART_INSERTIONS.find(p => p.before === n);
      if (hit) {
        const part = document.createElement('div');
        part.className = 'w-full px-3 py-2 mb-2 rounded-lg border-2 bg-blue-50 border-blue-200 text-blue-800 font-bold';
        part.textContent = hit.label;
        el.scoreSummary.appendChild(part);
      }
    }

    // 문제 정렬
    const list = (groups.get(ch) || []).sort((a, b) => {
      const na = +(a.물음번호 || a.표시번호), nb = +(b.물음번호 || b.표시번호);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a.표시번호 || a.물음번호).localeCompare(String(b.표시번호 || b.물음번호), 'ko');
    });

    // 통계 계산
    let sum = 0, cnt = 0, sumRounds = 0, last = 0;
    list.forEach(q => {
      const id = String(q.고유ID).trim();
      const s = questionScores[id];
      if (s && Number.isFinite(+s.score)) {
        sum += +s.score;
        cnt++;
      }
      const rs = readStore[id];
      const ur = rs && Number.isFinite(+rs.uniqueReads)
        ? +rs.uniqueReads
        : computeUniqueReadsFromHistory(s?.solveHistory || []).uniqueReads;
      sumRounds += ur;
      if (s?.lastSolvedDate && s.lastSolvedDate > last) last = s.lastSolvedDate;
    });

    const avg = cnt ? (sum / cnt) : null;
    const rounds = list.length ? (sumRounds / list.length) : 0;
    const recent = last
      ? ((d => d === 0 ? '오늘' : d === 1 ? '어제' : `${d}일 전`)(Math.floor((Date.now() - last) / 86400000)))
      : '학습 기록 없음';
    const ratio = `응시 ${cnt}/${list.length}`;
    const avgTxt = avg == null ? '-' : avg.toFixed(1);
    const roundsTxt = rounds.toFixed(1);
    const barW = _clamp(avg ?? 0, 0, 100);
    const barCls = avg == null ? 'bg-gray-300' : avg < 60 ? 'bg-red-500' : avg < 80 ? 'bg-yellow-500' : 'bg-green-500';

    // 헤더 생성
    const header = document.createElement('div');
    header.className = 'px-3 py-2 rounded-md border bg-gray-50 mb-2';
    header.innerHTML = `
      <div class="font-semibold text-lg">${chapterLabelText(ch)}</div>
      <div class="text-sm text-gray-700 mt-1 space-y-1">
        <div>평균 ${avgTxt}점 · ${ratio}</div>
        <div>평균 ${roundsTxt}회독 · 최근 ${recent}</div>
      </div>
      <div class="w-28 h-2 bg-gray-200 rounded-full overflow-hidden mt-2"><div class="h-2 ${barCls}" style="width:${barW}%"></div></div>
      <div class="mt-2 flex justify-end"><button class="text-xs text-blue-700 hover:underline summary-toggle">접기</button></div>`;

    const grid = document.createElement('div');
    grid.className = 'flex flex-wrap gap-2 mt-2 mb-4';

    // 문제 버튼 생성
    list.forEach(q => {
      const btn = document.createElement('button');

      // 라벨 구성 (➖ 아이콘)
      const disp = (q.표시번호 ?? '').toString().trim();
      const fallback = (q.물음번호 ?? q.고유ID ?? '').toString().trim();
      const baseLabel = disp || fallback || '';

      const id = String(q.고유ID).trim();
      const saved = questionScores[id] || {};
      const excluded = !!saved.userReviewExclude;
      const flagged = !!saved.userReviewFlag && !excluded; // 제외 우선

      const label = excluded ? `➖ ${baseLabel}` : baseLabel;
      btn.textContent = label;
      if (baseLabel.length >= 3) btn.style.fontSize = '.72rem';
      if (baseLabel.length >= 4) {
        btn.style.fontSize = '.66rem';
        btn.style.letterSpacing = '-0.2px';
      }

      const metaFlags = [];
      if (excluded) metaFlags.push('복습제외');
      else if (flagged) metaFlags.push('복습추가');

      const fullMeta = [
        q.problemTitle && String(q.problemTitle).trim(),
        `표시번호:${disp || '-'}`,
        `물음번호:${(q.물음번호 ?? '').toString().trim() || '-'}`,
        `ID:${(q.고유ID ?? '').toString().trim() || '-'}`,
        metaFlags.join(', ')
      ].filter(Boolean).join(' | ');
      btn.title = fullMeta;
      btn.setAttribute('aria-label', fullMeta);

      btn.classList.add('summary-btn', 'font-medium', 'rounded-lg', 'border', 'text-left');

      const sc = Number.isFinite(+saved?.score) ? +saved.score : NaN;
      const cls = !Number.isFinite(sc)
        ? ['bg-gray-100', 'text-gray-600', 'border-gray-300']
        : sc < 60 ? ['bg-red-100', 'text-red-700', 'border-red-300']
        : sc < 80 ? ['bg-yellow-100', 'text-yellow-700', 'border-yellow-300']
        : sc < 90 ? ['bg-green-100', 'text-green-700', 'border-green-300']
        : ['bg-blue-100', 'text-blue-700', 'border-blue-300'];
      btn.classList.add(...cls);
      btn.dataset.qid = id;

      btn.addEventListener('click', () => {
        // Get the chapter set for the clicked problem
        const chVal = String(q.단원).trim();
        const set = base.filter(it => String(it.단원).trim() === chVal);

        if (!set.length) {
          showToast('데이터셋을 찾는 데 실패했습니다', 'error');
          return;
        }

        // Handle flashcard mode
        if (window.isFlashcardMode) {
          // Use jumpToFlashcard function from flashcard module
          if (typeof window.jumpToFlashcard === 'function') {
            window.jumpToFlashcard(set, id, baseLabel);
          }
          return;
        }

        // Handle regular quiz mode
        let idx = set.findIndex(it => String(it.고유ID).trim() === id);
        if (idx < 0) idx = 0;

        window.currentQuizData = set;
        setCurrentQuestionIndex(idx);

        el.quizArea.classList.remove('hidden');
        if (typeof window.displayQuestion === 'function') {
          window.displayQuestion();
        }
        updateSummaryHighlight();
        showToast(`'${baseLabel}'로 이동`);
      });
      grid.appendChild(btn);
    });

    header.querySelector('.summary-toggle').addEventListener('click', e => {
      const hidden = grid.classList.toggle('hidden');
      e.currentTarget.textContent = hidden ? '펼치기' : '접기';
    });

    const section = document.createElement('div');
    section.className = 'w-full space-y-2 mb-3';
    section.appendChild(header);
    section.appendChild(grid);
    el.scoreSummary.appendChild(section);
  });

  updateSummaryHighlight();
}

/**
 * 요약 뷰에서 현재 문제 하이라이트
 */
export function updateSummaryHighlight() {
  const el = getElements();
  const currentQuizData = getCurrentQuizData();
  const currentQuestionIndex = getCurrentQuestionIndex();

  // Support both quiz mode and flashcard mode
  let currentId;
  if (window.isFlashcardMode) {
    // Get flashcard info from module
    const flashcardInfo = typeof window.getCurrentFlashcardInfo === 'function'
      ? window.getCurrentFlashcardInfo()
      : null;
    if (flashcardInfo && flashcardInfo.고유ID) {
      currentId = String(flashcardInfo.고유ID).trim();
    } else {
      return;
    }
  } else if (currentQuizData && currentQuizData.length) {
    currentId = String(currentQuizData[currentQuestionIndex]?.고유ID).trim();
  } else {
    return;
  }

  el.scoreSummary.querySelectorAll('button.summary-btn').forEach(b => {
    b.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
    if (b.dataset.qid === currentId) {
      b.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
    }
  });
}

/**
 * 결과 박스가 준비되었는지 확인 및 초기화
 */
export function ensureResultBoxReady() {
  const el = getElements();
  const currentQuizData = getCurrentQuizData();
  const currentQuestionIndex = getCurrentQuestionIndex();

  if (currentQuizData.length) {
    const q = currentQuizData[currentQuestionIndex];
    if (!el.correctAnswer.textContent?.trim()) {
      el.correctAnswer.textContent = String(q.정답 || '');
    }
    el.modelAnswerBox.classList.remove('hidden');
  }
  el.resultBox.classList.remove('hidden');
}
