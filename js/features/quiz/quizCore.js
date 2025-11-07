// ============================================
// 감린이 v4.0 - 퀴즈 핵심 로직
// 문제 표시, 퀴즈 로드, 플래그 UI
// ============================================

import { normId } from '../../utils/helpers.js';
import { isPartValue } from '../../config/config.js';
import { showToast } from '../../ui/domUtils.js';
import {
  getElements,
  getCurrentQuizData,
  getCurrentQuestionIndex,
  setCurrentQuizData,
  setCurrentQuestionIndex,
  getQuestionScores,
  setSummaryViewMode,
  setActiveHintQuestionKey,
  setPrevLoaded,
  getIsFlashcardMode
} from '../../core/stateManager.js';
import { showResult } from './grading.js';

// ============================================
// 복습 플래그 UI 업데이트
// ============================================

/**
 * 복습 플래그 버튼 UI 업데이트 (★/☆, ➖)
 * @param {Object} saved - questionScores의 저장된 데이터
 */
export function updateFlagButtonsUI(saved) {
  const el = getElements();
  if (!el) return;

  const flagged = !!(saved?.userReviewFlag);
  const excluded = !!(saved?.userReviewExclude);

  // 상호배타: excluded가 true면 flagged는 false처럼 표현
  const flagVisual = flagged && !excluded;

  // ★/☆ 표시
  const starEl = el.reviewFlagToggle?.querySelector('span');
  if (starEl) {
    starEl.textContent = flagVisual ? '★' : '☆';
  }

  el.reviewFlagToggle?.setAttribute('aria-pressed', flagVisual ? 'true' : 'false');
  el.reviewExcludeToggle?.setAttribute('aria-pressed', excluded ? 'true' : 'false');
}

// ============================================
// 문제 표시
// ============================================

/**
 * 현재 문제를 화면에 표시
 */
export function displayQuestion() {
  const el = getElements();
  if (!el) return;

  const currentQuizData = getCurrentQuizData();
  const currentQuestionIndex = getCurrentQuestionIndex();

  // 문제가 없으면 숨기기
  if (!currentQuizData.length) {
    el.quizArea?.classList.add('hidden');
    return;
  }

  const q = currentQuizData[currentQuestionIndex];
  if (!q) return;

  // 퀴즈 영역 표시
  el.quizArea?.classList.remove('hidden');

  // 문제 정보 표시
  if (el.questionNumber) {
    el.questionNumber.textContent = `문항 ${q.표시번호 || q.물음번호 || q.고유ID}`;
  }
  if (el.questionText) {
    el.questionText.textContent = q.물음;
  }
  if (el.questionCounter) {
    el.questionCounter.textContent = `${currentQuestionIndex + 1} / ${currentQuizData.length}`;
  }
  if (el.dbQuestionId) {
    el.dbQuestionId.textContent = `ID: ${q.고유ID ?? '-'}`;
  }

  // 힌트 초기화
  setActiveHintQuestionKey(null);
  el.hintBox?.classList.add('hidden');
  if (el.hintBox) el.hintBox.innerHTML = '';

  // 결과 및 답안 초기화
  el.resultBox?.classList.add('hidden');
  if (el.userAnswer) el.userAnswer.value = '';

  // 이전 답안 버튼 초기화
  if (el.loadPrevAnswerBtn) {
    el.loadPrevAnswerBtn.textContent = '이전 답안 불러오기';
    el.loadPrevAnswerBtn.removeAttribute('aria-pressed');
  }
  setPrevLoaded(false);

  // 저장된 점수 표시
  const questionScores = getQuestionScores();
  const saved = questionScores[normId(q.고유ID)];

  updateFlagButtonsUI(saved);

  if (saved && saved.score !== undefined) {
    showResult(saved.score, saved.feedback, q.정답);
  }

  // 네비게이션 버튼 상태
  if (el.prevBtn) {
    el.prevBtn.disabled = (currentQuestionIndex === 0);
  }
  if (el.nextBtn) {
    el.nextBtn.disabled = (currentQuizData.length - 1 === currentQuestionIndex);
  }

  // 요약 하이라이트 업데이트
  if (typeof window.updateSummaryHighlight === 'function') {
    window.updateSummaryHighlight();
  }
}

// ============================================
// 퀴즈 새로고침
// ============================================

/**
 * 필터 조건에 따라 퀴즈 데이터를 새로고침하고 화면 업데이트
 */
export function reloadAndRefresh() {
  const el = getElements();
  if (!el) return;

  // Part 선택 시 요약 뷰 모드 변경
  if (el.chapterSelect && isPartValue(el.chapterSelect.value)) {
    setSummaryViewMode('CURRENT');
    el.summaryViewCurrentBtn?.classList.add('bg-gray-100');
    el.summaryViewAllBtn?.classList.remove('bg-gray-100');
  }

  // 필터링된 데이터 가져오기
  const filteredData = typeof window.getFilteredByUI === 'function'
    ? window.getFilteredByUI()
    : [];

  // 현재 퀴즈 데이터 설정 (StateManager 사용)
  setCurrentQuizData(filteredData);
  setCurrentQuestionIndex(0);

  // index.html의 전역 변수와 동기화 (하위 호환성)
  if (typeof window !== 'undefined') {
    window.currentQuizData = filteredData;
    window.currentQuestionIndex = 0;
  }

  // 플래시카드 모드 확인
  const isFlashcardMode = getIsFlashcardMode();

  if (isFlashcardMode) {
    // 플래시카드 모드 업데이트
    if (typeof window.refreshFlashcardData === 'function') {
      window.refreshFlashcardData();
    }
  } else {
    // 일반 퀴즈 모드
    if (filteredData.length) {
      el.quizArea?.classList.remove('hidden');
      el.summaryArea?.classList.remove('hidden');
      displayQuestion();
    } else {
      el.quizArea?.classList.add('hidden');
      el.summaryArea?.classList.remove('hidden');
      showToast('선택한 조건에 맞는 문제가 없습니다.', 'warn');
    }
  }

  // 요약 및 패널 업데이트
  if (typeof window.updateSummary === 'function') {
    window.updateSummary();
  }
  if (typeof window.refreshPanels === 'function') {
    window.refreshPanels();
  }
}

// ============================================
// 랜덤 문제 시작
// ============================================

/**
 * 필터링된 문제 중 랜덤하게 하나 선택
 */
export function startRandomQuiz() {
  const el = getElements();
  if (!el) return;

  // 필터링된 데이터 가져오기
  const list = typeof window.getFilteredByUI === 'function'
    ? window.getFilteredByUI()
    : [];

  if (!list.length) {
    showToast('선택 조건에 맞는 문제가 없습니다.', 'warn');
    return;
  }

  // 랜덤 인덱스 선택
  const randomIndex = Math.floor(Math.random() * list.length);

  // 현재 퀴즈 데이터 설정 (StateManager 사용)
  setCurrentQuizData(list);
  setCurrentQuestionIndex(randomIndex);

  // index.html의 전역 변수와 동기화 (하위 호환성)
  if (typeof window !== 'undefined') {
    window.currentQuizData = list;
    window.currentQuestionIndex = randomIndex;
  }

  // UI 업데이트
  el.quizArea?.classList.remove('hidden');
  el.summaryArea?.classList.remove('hidden');

  displayQuestion();

  if (typeof window.updateSummary === 'function') {
    window.updateSummary();
  }
  if (typeof window.refreshPanels === 'function') {
    window.refreshPanels();
  }

  showToast('랜덤 문제 시작!');
}
