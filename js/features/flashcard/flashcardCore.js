/**
 * @fileoverview 플래시카드 모드 핵심 기능
 * - 플래시카드 표시 및 네비게이션
 * - 답변 표시/숨기기
 * - 플래시카드 <-> 퀴즈 모드 전환
 */

import { el } from '../../ui/elements.js';
import { showToast } from '../../ui/domUtils.js';
import { getFilteredByUI } from '../../features/filter/filterCore.js';
import { updateSummary, updateSummaryHighlight } from '../../features/summary/summaryCore.js';
import { displayQuestion } from '../../features/quiz/quizCore.js';

// Module state
let flashcardData = [];
let flashcardIndex = 0;
let flashcardAnswerVisible = false;

/**
 * Helper: Check if target is an editable element
 * @param {HTMLElement} target - DOM element
 * @returns {boolean}
 */
function isEditing(target) {
  return target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
}

/**
 * 플래시카드 모드 시작
 */
export function startFlashcardMode() {
  // Use current quiz data if already loaded, otherwise get filtered data
  let dataToUse = window.currentQuizData && window.currentQuizData.length > 0
    ? window.currentQuizData
    : getFilteredByUI();

  if (!dataToUse || dataToUse.length === 0) {
    showToast('선택한 조건에 해당하는 문제가 없습니다', 'warn');
    return;
  }

  flashcardData = dataToUse;
  // Start from current problem if viewing quiz, otherwise start from beginning
  flashcardIndex = (window.currentQuizData && window.currentQuizData.length > 0 && window.currentQuestionIndex >= 0)
    ? window.currentQuestionIndex
    : 0;
  flashcardAnswerVisible = false;
  window.isFlashcardMode = true;

  // Hide quiz area, show flashcard area and summary
  el.quizArea?.classList.add('hidden');
  el.flashcardArea?.classList.remove('hidden');
  el.resultBox?.classList.add('hidden');
  el.summaryArea?.classList.remove('hidden');  // Keep summary visible for problem list navigation

  displayFlashcard();
  updateSummaryHighlight();  // Highlight current flashcard in problem list
  showToast(`플래시카드 모드 시작 (${flashcardData.length}개 문제)`);
}

/**
 * 플래시카드 데이터 새로고침 (필터 변경 시)
 */
export function refreshFlashcardData() {
  if (!window.isFlashcardMode) return;

  // Get updated data based on current filter settings
  const newData = getFilteredByUI();

  if (!newData || newData.length === 0) {
    showToast('선택한 조건에 맞는 문제가 없습니다', 'warn');
    return;
  }

  // Try to maintain current position if possible
  const currentId = flashcardData[flashcardIndex]?.고유ID;
  flashcardData = newData;

  // Find current card in new data
  if (currentId) {
    const newIndex = flashcardData.findIndex(q => q.고유ID === currentId);
    flashcardIndex = newIndex >= 0 ? newIndex : 0;
  } else {
    flashcardIndex = 0;
  }

  displayFlashcard();
  showToast(`플래시카드 업데이트 (${flashcardData.length}개 문제)`);
}

/**
 * 플래시카드 표시
 */
export function displayFlashcard() {
  if (!flashcardData.length) return;

  const card = flashcardData[flashcardIndex];

  if (el.flashcardTitle) {
    el.flashcardTitle.textContent = card.problemTitle || `문항 ${card.표시번호 || card.물음번호}`;
  }

  if (el.flashcardQuestion) {
    el.flashcardQuestion.textContent = card.물음 || '(물음 없음)';
  }

  if (el.flashcardAnswer) {
    el.flashcardAnswer.textContent = card.정답 || '(정답 없음)';
  }

  if (el.flashcardCounter) {
    el.flashcardCounter.textContent = `${flashcardIndex + 1} / ${flashcardData.length}`;
  }

  // Reset answer visibility
  hideFlashcardAnswer();

  // Update button states
  if (el.flashcardPrevBtn) {
    el.flashcardPrevBtn.disabled = flashcardIndex === 0;
    el.flashcardPrevBtn.style.opacity = flashcardIndex === 0 ? '0.5' : '1';
  }

  if (el.flashcardNextBtn) {
    el.flashcardNextBtn.disabled = flashcardIndex === flashcardData.length - 1;
    el.flashcardNextBtn.style.opacity = flashcardIndex === flashcardData.length - 1 ? '0.5' : '1';
  }

  // Update problem list highlight
  updateSummaryHighlight();
}

/**
 * 답변 표시/숨기기 토글
 */
export function toggleFlashcardAnswer() {
  if (flashcardAnswerVisible) {
    hideFlashcardAnswer();
  } else {
    showFlashcardAnswer();
  }
}

/**
 * 답변 표시
 */
export function showFlashcardAnswer() {
  flashcardAnswerVisible = true;
  el.flashcardAnswerBox?.classList.remove('hidden');
  el.flashcardAnswerHidden?.classList.add('hidden');
  if (el.flashcardToggleAnswer) {
    el.flashcardToggleAnswer.textContent = '답변 숨기기 🙈';
  }
}

/**
 * 답변 숨기기
 */
export function hideFlashcardAnswer() {
  flashcardAnswerVisible = false;
  el.flashcardAnswerBox?.classList.add('hidden');
  el.flashcardAnswerHidden?.classList.remove('hidden');
  if (el.flashcardToggleAnswer) {
    el.flashcardToggleAnswer.textContent = '답변 보기 👁️';
  }
}

/**
 * 이전 카드로 이동
 */
export function flashcardPrev() {
  if (flashcardIndex > 0) {
    flashcardIndex--;
    displayFlashcard();
  }
}

/**
 * 다음 카드로 이동
 */
export function flashcardNext() {
  if (flashcardIndex < flashcardData.length - 1) {
    flashcardIndex++;
    displayFlashcard();
  }
}

/**
 * 랜덤 카드로 이동
 */
export function flashcardRandom() {
  if (flashcardData.length > 0) {
    flashcardIndex = Math.floor(Math.random() * flashcardData.length);
    displayFlashcard();
    showToast('랜덤 문제로 이동');
  }
}

/**
 * 특정 문제로 플래시카드 점프 (요약 영역에서 클릭 시 사용)
 * @param {Array} list - 문제 목록
 * @param {string} questionId - 이동할 문제의 고유ID
 * @param {string} label - 문제 라벨 (토스트 메시지용)
 */
export function jumpToFlashcard(list, questionId, label) {
  if (!window.isFlashcardMode || !list || list.length === 0) return;

  flashcardData = list;
  flashcardIndex = list.findIndex(x => String(x.고유ID).trim() === String(questionId).trim());
  if (flashcardIndex < 0) flashcardIndex = 0;

  displayFlashcard();
  updateSummaryHighlight();
  showToast(`'${label}' 플래시카드로 이동`);
}

/**
 * 플래시카드 모드 종료
 */
export function exitFlashcardMode() {
  el.flashcardArea?.classList.add('hidden');
  el.quizArea?.classList.remove('hidden');
  el.summaryArea?.classList.remove('hidden');
  flashcardData = [];
  flashcardIndex = 0;
  flashcardAnswerVisible = false;
  window.isFlashcardMode = false;

  // Refresh quiz area and panels
  if (window.currentQuizData && window.currentQuizData.length > 0) {
    displayQuestion();
  } else {
    el.quizArea?.classList.add('hidden');
  }

  updateSummary();
  if (window.refreshPanels) window.refreshPanels();

  showToast('플래시카드 모드 종료');
}

/**
 * 플래시카드 이벤트 리스너 초기화
 */
export function initFlashcardListeners() {
  // Button event listeners
  el.flashcardModeBtn?.addEventListener('click', startFlashcardMode);
  el.flashcardToggleAnswer?.addEventListener('click', toggleFlashcardAnswer);
  el.flashcardPrevBtn?.addEventListener('click', flashcardPrev);
  el.flashcardNextBtn?.addEventListener('click', flashcardNext);
  el.flashcardRandomBtn?.addEventListener('click', flashcardRandom);
  el.flashcardExitBtn?.addEventListener('click', exitFlashcardMode);

  // Keyboard shortcuts for flashcard mode
  document.addEventListener('keydown', (e) => {
    // Only in flashcard mode
    if (!el.flashcardArea?.classList.contains('hidden')) {
      if (e.key === 'ArrowLeft' && !isEditing(e.target)) {
        e.preventDefault();
        flashcardPrev();
      } else if (e.key === 'ArrowRight' && !isEditing(e.target)) {
        e.preventDefault();
        flashcardNext();
      } else if (e.key === ' ' && !isEditing(e.target)) {
        e.preventDefault();
        toggleFlashcardAnswer();
      } else if (e.key === 'Escape') {
        exitFlashcardMode();
      }
    }
  });
}
