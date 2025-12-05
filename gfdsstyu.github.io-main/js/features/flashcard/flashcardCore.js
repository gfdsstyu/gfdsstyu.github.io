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
import { normId } from '../../utils/helpers.js';
import { recordPassiveView, saveReadStoreToLocal } from '../review/difficultyTracker.js';

// Module state
let flashcardData = [];
let flashcardIndex = 0;
let flashcardQuestionVisible = false;
let flashcardAnswerVisible = false;
let cardStartTime = 0; // 카드 표시 시작 시간
let sessionId = Date.now().toString(); // 세션 ID

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
  flashcardQuestionVisible = false;
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

  // Reset visibility (question and answer both hidden by default)
  hideFlashcardQuestion();
  hideFlashcardAnswer();

  // 카드 표시 시작 시간 기록
  cardStartTime = Date.now();

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
 * 물음 표시/숨기기 토글
 */
export function toggleFlashcardQuestion() {
  if (flashcardQuestionVisible) {
    hideFlashcardQuestion();
  } else {
    showFlashcardQuestion();
  }
}

/**
 * 물음 표시
 */
export function showFlashcardQuestion() {
  flashcardQuestionVisible = true;
  el.flashcardQuestionBox?.classList.remove('hidden');
  if (el.flashcardQuestionArrow) {
    el.flashcardQuestionArrow.textContent = '▼';
  }
}

/**
 * 물음 숨기기
 */
export function hideFlashcardQuestion() {
  flashcardQuestionVisible = false;
  el.flashcardQuestionBox?.classList.add('hidden');
  if (el.flashcardQuestionArrow) {
    el.flashcardQuestionArrow.textContent = '▶';
  }
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

  // 난이도 평가 UI 추가 (이미 있으면 제거 후 재생성)
  removeDifficultyRatingUI();
  addDifficultyRatingUI();
}

/**
 * 난이도 평가 UI 추가
 */
function addDifficultyRatingUI() {
  const answerBox = el.flashcardAnswerBox;
  if (!answerBox) return;

  // 이미 존재하면 추가하지 않음
  if (document.getElementById('flashcard-difficulty')) return;

  const difficultyHTML = `
    <div id="flashcard-difficulty" class="mt-3 p-3 md:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
      <p class="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-2 md:mb-3 font-medium text-center">이 문제를 기억하기 어려웠나요?</p>
      <div class="flex gap-1.5 md:gap-2 justify-center flex-wrap">
        <button class="diff-btn btn-difficulty-easy px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-medium transition-colors duration-200 whitespace-nowrap text-base md:text-base"
                data-difficulty="easy">
          😊<span class="hidden md:inline"> 쉬움</span>
        </button>
        <button class="diff-btn btn-difficulty-medium px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-medium transition-colors duration-200 whitespace-nowrap text-base md:text-base"
                data-difficulty="medium">
          🤔<span class="hidden md:inline"> 보통</span>
        </button>
        <button class="diff-btn btn-difficulty-hard px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-medium transition-colors duration-200 whitespace-nowrap text-base md:text-base"
                data-difficulty="hard">
          😰<span class="hidden md:inline"> 어려움</span>
        </button>
        <button class="diff-btn btn-difficulty-skip px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-medium transition-colors duration-200 whitespace-nowrap text-base md:text-base"
                data-difficulty="skip">
          ⏭️<span class="hidden md:inline"> 건너뛰기</span>
        </button>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 md:mt-3 text-center hidden md:block">
        키보드: 1(쉬움) 2(보통) 3(어려움) 0(건너뛰기)
      </p>
    </div>
  `;

  answerBox.insertAdjacentHTML('afterend', difficultyHTML);

  // 버튼 이벤트 리스너 추가
  const buttons = document.querySelectorAll('#flashcard-difficulty .diff-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const difficulty = e.currentTarget.getAttribute('data-difficulty');
      handleDifficultyRating(difficulty);
    });
  });
}

/**
 * 난이도 평가 UI 제거
 */
function removeDifficultyRatingUI() {
  const existing = document.getElementById('flashcard-difficulty');
  if (existing) {
    existing.remove();
  }
}

/**
 * 난이도 평가 처리
 * @param {string} difficulty - 'easy', 'medium', 'hard', 'skip'
 */
export function handleDifficultyRating(difficulty) {
  const currentCard = flashcardData[flashcardIndex];
  if (!currentCard) return;

  const qid = normId(currentCard.고유ID);

  // 1. FSRS 스타일 난이도 업데이트
  let newDifficulty = 5.0;
  if (window.difficultyTracker && difficulty !== 'skip') {
    newDifficulty = window.difficultyTracker.updateDifficulty(qid, difficulty);
  }

  // 2. readStore에 이벤트 기록
  recordPassiveView(qid, {
    event_type: 'passive_view_rated',
    difficulty_rating: difficulty,
    answer_viewed: flashcardAnswerVisible,
    time_spent: Date.now() - cardStartTime,
    session_id: sessionId
  });

  // 3. 저장
  saveReadStoreToLocal();

  // 4. 플래시카드 학습 카운터 증가 (업적용)
  incrementFlashcardCounter();

  // 5. UI 피드백
  const emojiMap = { easy: '😊', medium: '🤔', hard: '😰', skip: '⏭️' };
  const labelMap = { easy: '쉬움', medium: '보통', hard: '어려움', skip: '건너뛰기' };
  const emoji = emojiMap[difficulty];
  const label = labelMap[difficulty];

  if (difficulty !== 'skip') {
    showToast(`${emoji} ${label} (난이도: ${newDifficulty.toFixed(1)}/10)`, 'success');
  } else {
    showToast(`${emoji} ${label}`, 'info');
  }

  // 6. 난이도 평가 UI 제거 (중복 평가 방지)
  removeDifficultyRatingUI();

  // 7. 다음 카드 자동 진행 (skip 제외)
  if (difficulty !== 'skip' && flashcardIndex < flashcardData.length - 1) {
    setTimeout(() => {
      flashcardNext();
    }, 500);
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

  // 난이도 평가 UI 제거
  removeDifficultyRatingUI();
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
 * Increment flashcard navigation counter (for achievements)
 */
function incrementFlashcardCounter() {
  try {
    const count = parseInt(localStorage.getItem('flashcard_navigation_count_v1') || '0', 10);
    localStorage.setItem('flashcard_navigation_count_v1', String(count + 1));
  } catch {}
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
 * 현재 플래시카드 정보 가져오기 (summary highlight용)
 * @returns {{고유ID: string, index: number, data: Array} | null}
 */
export function getCurrentFlashcardInfo() {
  if (!window.isFlashcardMode || !flashcardData.length) return null;

  return {
    고유ID: flashcardData[flashcardIndex]?.고유ID,
    index: flashcardIndex,
    data: flashcardData
  };
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
  flashcardQuestionVisible = false;
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
  el.flashcardToggleQuestion?.addEventListener('click', toggleFlashcardQuestion);
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
      } else if (e.key.toLowerCase() === 'q' && !isEditing(e.target)) {
        e.preventDefault();
        toggleFlashcardQuestion();
      } else if (e.key === 'Escape') {
        exitFlashcardMode();
      } else if (e.key === '1' && !isEditing(e.target)) {
        // 키보드 단축키: 1 = 쉬움
        e.preventDefault();
        if (flashcardAnswerVisible) handleDifficultyRating('easy');
      } else if (e.key === '2' && !isEditing(e.target)) {
        // 키보드 단축키: 2 = 보통
        e.preventDefault();
        if (flashcardAnswerVisible) handleDifficultyRating('medium');
      } else if (e.key === '3' && !isEditing(e.target)) {
        // 키보드 단축키: 3 = 어려움
        e.preventDefault();
        if (flashcardAnswerVisible) handleDifficultyRating('hard');
      } else if (e.key === '0' && !isEditing(e.target)) {
        // 키보드 단축키: 0 = 건너뛰기
        e.preventDefault();
        if (flashcardAnswerVisible) handleDifficultyRating('skip');
      }
    }
  });
}
