/**
 * @fileoverview 문제 탐색기(Explorer) - 단원별/검색별 문제 목록
 * - 단원별 버튼 렌더링
 * - 문제 검색 및 정렬
 * - 문제 클릭 시 퀴즈/플래시카드 이동
 */

import { el } from '../../ui/elements.js';
import { showToast } from '../../ui/domUtils.js';
import { chapterLabelText } from '../../config/config.js';
import { getScopeFilteredData } from '../../features/filter/filterCore.js';
import { updateSummaryHighlight } from '../../features/summary/summaryCore.js';
import { displayQuestion } from '../../features/quiz/quizCore.js';

/**
 * Render explorer: chapter buttons and problem list
 */
export function renderExplorer() {
  if (!el.explorerChapters || !el.explorerProblems) return;

  // Access global state via window (NEVER import from stateManager)
  const questionScores = window.questionScores || {};

  const base = getScopeFilteredData();
  const group = new Map();

  // Group by chapter
  for (const q of base) {
    const ch = String(q.단원).trim();
    if (!group.has(ch)) group.set(ch, []);
    group.get(ch).push(q);
  }

  // Sort chapters
  const chapters = [...group.keys()].sort((a, b) => {
    const na = +a, nb = +b;
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return a.localeCompare(b, 'ko');
  });

  // Render chapter buttons
  el.explorerChapters.innerHTML = '';
  chapters.forEach(ch => {
    const btn = document.createElement('button');
    btn.className = 'w-full text-left px-3 py-2 rounded border hover:bg-gray-50';
    btn.textContent = chapterLabelText(ch);
    btn.addEventListener('click', () => {
      const list = group.get(ch) || [];
      if (!list.length) return;

      if (window.isFlashcardMode) {
        // Flashcard mode: use module function
        if (typeof window.jumpToFlashcard === 'function') {
          window.jumpToFlashcard(list, list[0].고유ID, chapterLabelText(ch));
        }
      } else {
        // Quiz mode: update quiz data
        window.currentQuizData = list;
        window.currentQuestionIndex = 0;
        el.quizArea.classList.remove('hidden');
        displayQuestion();
        updateSummaryHighlight();
        showToast(`${chapterLabelText(ch)} 로 이동`);
      }
    });
    el.explorerChapters.appendChild(btn);
  });

  // Filter and render problem list
  const q = (el.explorerSearch?.value || '').trim().toLowerCase();
  const filtered = base.filter(it =>
    (it.problemTitle || '').toLowerCase().includes(q) ||
    (it.물음 || '').toLowerCase().includes(q)
  );

  el.explorerProblems.innerHTML = '';

  filtered.sort((a, b) => {
    // 1순위: 단원 정렬
    const chA = +a.단원, chB = +b.단원;
    if (Number.isFinite(chA) && Number.isFinite(chB) && chA !== chB) return chA - chB;
    if (Number.isFinite(chA) && !Number.isFinite(chB)) return -1;
    if (!Number.isFinite(chA) && Number.isFinite(chB)) return 1;
    if (!Number.isFinite(chA) && !Number.isFinite(chB)) {
      const chCmp = String(a.단원).localeCompare(String(b.단원), 'ko');
      if (chCmp !== 0) return chCmp;
    }
    // 2순위: 표시번호 정렬
    const na = +(a.표시번호 || a.물음번호), nb = +(b.표시번호 || b.물음번호);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a.표시번호 || a.물음번호).localeCompare(String(b.표시번호 || b.물음번호), 'ko');
  })
    .forEach(it => {
      const rec = questionScores[String(it.고유ID).trim()] || {};
      const score = Number.isFinite(+rec?.score) ? +rec.score : null;
      const excluded = !!rec.userReviewExclude;
      const flagged = !!rec.userReviewFlag && !excluded; // 제외 우선

      const row = document.createElement('button');
      row.className = 'w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded hover:bg-gray-50 border text-left';

      const left = document.createElement('div');
      left.className = 'flex items-center gap-2 text-sm';

      if (flagged) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.className = 'text-purple-500';
        left.appendChild(star);
      }

      if (excluded) {
        const minus = document.createElement('span');
        minus.textContent = '➖';
        minus.className = 'text-gray-500';
        left.appendChild(minus);
      }

      const title = document.createElement('span');
      const label = (it.problemTitle && String(it.problemTitle).trim()) || `문항 ${it.표시번호 || it.물음번호 || it.고유ID}`;
      title.textContent = label;
      title.className = 'block max-w-[18rem] xl:max-w-[22rem] line-clamp-2 overflow-hidden';
      title.style.display = '-webkit-box';
      title.style.webkitLineClamp = '2';
      title.style.webkitBoxOrient = 'vertical';
      left.appendChild(title);

      const right = document.createElement('div');
      right.className = 'text-xs';
      const badge = document.createElement('span');
      badge.className = 'px-2 py-0.5 rounded-full border ' + (score == null ? 'text-gray-600 border-gray-300' : 'text-blue-700 border-blue-300');
      badge.textContent = score == null ? 'X' : `${score}`;
      right.appendChild(badge);

      row.appendChild(left);
      row.appendChild(right);
      row.title = `출처:${it.출처 || '-'} | ID:${it.고유ID}`;

      row.addEventListener('click', () => {
        const ch = String(it.단원).trim();
        const list = base.filter(x => String(x.단원).trim() === ch);

        if (window.isFlashcardMode) {
          // Flashcard mode - use module function
          const dataList = list.length ? list : [it];
          if (typeof window.jumpToFlashcard === 'function') {
            window.jumpToFlashcard(dataList, it.고유ID, label);
          }
        } else {
          // Quiz mode
          window.currentQuizData = list.length ? list : [it];
          window.currentQuestionIndex = list.findIndex(x => String(x.고유ID).trim() === String(it.고유ID).trim());
          if (window.currentQuestionIndex < 0) window.currentQuestionIndex = 0;
          el.quizArea.classList.remove('hidden');
          displayQuestion();
          updateSummaryHighlight();
          showToast(`'${label}' 로 이동`);
        }
      });

      el.explorerProblems.appendChild(row);
    });
}

/**
 * Move source filter UI to side panel
 */
export function moveSourceFilterToSide() {
  if (!el.sourceFilterSide || !el.sourceGroupFilter) return;
  el.sourceFilterSide.innerHTML = '';
  el.sourceGroupFilter.classList.remove('mb-6');
  el.sourceFilterSide.appendChild(el.sourceGroupFilter);
}

// ============================================
// 이벤트 리스너 초기화 (Phase 5.1)
// ============================================

/**
 * 문제 탐색기 이벤트 리스너 초기화
 */
export function initExplorerListeners() {
  // Access global state via window (NEVER import from stateManager)
  const el = window.el;
  if (!el) return;

  // Explorer search input
  el.explorerSearch?.addEventListener('input', () => {
    if (typeof window.renderExplorer === 'function') {
      window.renderExplorer();
    }
  });
}
