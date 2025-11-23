// ============================================
// 감린이 v4.0 - 퀴즈 네비게이션
// 이전/다음 문제, 포커스 모드, 키보드 단축키
// ============================================

import {
  getElements,
  getCurrentQuizData,
  getCurrentQuestionIndex,
  setCurrentQuestionIndex
} from '../../core/stateManager.js';
import { displayQuestion } from './quizCore.js';

// ============================================
// 네비게이션 상태
// ============================================

let lastScrollYBeforeFocus = 0;
let ctrlNavState = 'dashboard'; // 'focus' or 'dashboard'

// ============================================
// 상태 접근자 (외부 접근용)
// ============================================

export function getCtrlNavState() {
  return ctrlNavState;
}

export function setCtrlNavState(state) {
  ctrlNavState = state;
}

// ============================================
// 이전/다음 문제 네비게이션
// ============================================

/**
 * 이전 문제로 이동
 */
export function handlePrevQuestion() {
  const currentQuestionIndex = getCurrentQuestionIndex();

  if (currentQuestionIndex > 0) {
    const newIndex = currentQuestionIndex - 1;
    setCurrentQuestionIndex(newIndex);

    // index.html의 전역 변수와 동기화 (하위 호환성)
    if (typeof window !== 'undefined') {
      window.currentQuestionIndex = newIndex;
    }

    displayQuestion();
  }
}

/**
 * 다음 문제로 이동
 */
export function handleNextQuestion() {
  const currentQuizData = getCurrentQuizData();
  const currentQuestionIndex = getCurrentQuestionIndex();

  if (currentQuestionIndex < currentQuizData.length - 1) {
    const newIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(newIndex);

    // index.html의 전역 변수와 동기화 (하위 호환성)
    if (typeof window !== 'undefined') {
      window.currentQuestionIndex = newIndex;
    }

    displayQuestion();
  }
}

// ============================================
// 포커스 모드
// ============================================

/**
 * 결과 박스가 준비되도록 보장
 */
function ensureResultBoxReady() {
  const el = getElements();
  if (!el) return;

  const currentQuizData = getCurrentQuizData();
  const currentQuestionIndex = getCurrentQuestionIndex();

  if (currentQuizData.length) {
    const q = currentQuizData[currentQuestionIndex];
    if (!el.correctAnswer?.textContent?.trim()) {
      if (el.correctAnswer) {
        el.correctAnswer.textContent = String(q.정답 || '');
      }
    }
  }

  el.resultBox?.classList.remove('hidden');
}

/**
 * 포커스 모드 진입
 * - 현재 스크롤 위치 저장
 * - 답안 입력란으로 스크롤
 * - focus-mode 클래스 추가
 */
export function enterFocusMode() {
  const el = getElements();
  if (!el) return;

  // 현재 스크롤 위치 저장
  lastScrollYBeforeFocus = window.pageYOffset;

  // focus-mode 클래스 추가
  document.documentElement.classList.add('focus-mode');

  // Phase 4.0: Zen Mode 레이아웃 변경 - 사이드바 숨김 & 중앙 확장
  const leftPanel = document.getElementById('left-dashboard');
  const rightPanel = document.getElementById('right-explorer');
  const centerCore = document.getElementById('center-core');

  if (leftPanel) leftPanel.classList.add('hidden');
  if (rightPanel) rightPanel.classList.add('hidden');

  if (centerCore) {
    // 기존 col-span 클래스 제거 및 전체 너비/중앙 정렬 적용
    centerCore.classList.remove('lg:col-span-6', 'xl:col-span-6', '2xl:col-span-6');
    centerCore.classList.add('lg:col-span-12', 'max-w-4xl', 'mx-auto');
  }

  // 헤더 숨김 (완전 몰입)
  if (el.fixedHeader) el.fixedHeader.classList.add('hidden');

  // 결과 박스 준비
  ensureResultBoxReady();

  // 답안 입력란으로 스크롤
  const header = el.userAnswer;
  const margin = 12;
  const y = header.getBoundingClientRect().top +
            window.pageYOffset -
            margin;

  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });

  // 네비게이션 상태 업데이트
  ctrlNavState = 'focus';
}

/**
 * 대시보드로 나가기
 * - focus-mode 클래스 제거
 * - 요약 영역으로 스크롤
 */
export function exitToDashboard() {
  const el = getElements();
  if (!el) return;

  // focus-mode 클래스 제거
  document.documentElement.classList.remove('focus-mode');

  // Phase 4.0: Zen Mode 레이아웃 복원
  const leftPanel = document.getElementById('left-dashboard');
  const rightPanel = document.getElementById('right-explorer');
  const centerCore = document.getElementById('center-core');

  if (leftPanel) leftPanel.classList.remove('hidden');
  if (rightPanel) rightPanel.classList.remove('hidden');

  if (centerCore) {
    centerCore.classList.add('lg:col-span-6', 'xl:col-span-6', '2xl:col-span-6');
    centerCore.classList.remove('lg:col-span-12', 'max-w-4xl', 'mx-auto');
  }

  // 헤더 복원
  if (el.fixedHeader) el.fixedHeader.classList.remove('hidden');

  // 요약 영역으로 스크롤
  if (el.summaryArea) {
    window.scrollTo({
      top: el.summaryArea.getBoundingClientRect().top +
           window.pageYOffset -
           (el.fixedHeader?.getBoundingClientRect().height || 0) -
           8,
      behavior: 'smooth'
    });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 네비게이션 상태 업데이트
  ctrlNavState = 'dashboard';
}

/**
 * 포커스 모드에서 나가기
 * - focus-mode 클래스 제거
 * - 이전 스크롤 위치로 복귀
 */
export function backFromFocus() {
  // focus-mode 클래스 제거
  document.documentElement.classList.remove('focus-mode');

  // 이전 스크롤 위치로 복귀
  window.scrollTo({
    top: Math.max(0, lastScrollYBeforeFocus),
    behavior: 'smooth'
  });

  // 네비게이션 상태 업데이트
  ctrlNavState = 'dashboard';
}

// ============================================
// 키보드 단축키
// ============================================

/**
 * 요소가 편집 중인지 확인
 * @param {HTMLElement} target - 확인할 요소
 * @returns {boolean} 편집 중이면 true
 */
function isEditing(target) {
  if (!target) return false;
  return target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable;
}

/**
 * 키보드 단축키 핸들러 초기화
 */
export function initKeyboardShortcuts() {
  const el = getElements();
  if (!el) return;

  document.addEventListener('keydown', (e) => {
    // H: 힌트
    if ((e.key === 'h' || e.key === 'H') && !isEditing(e.target)) {
      e.preventDefault();
      el.hintBtn?.click();
      return;
    }

    // R: 랜덤 문제
    if ((e.key === 'r' || e.key === 'R') && !isEditing(e.target)) {
      e.preventDefault();
      el.randomQuizBtn?.click();
      return;
    }

    // L: 이전 답안 불러오기
    if ((e.key === 'l' || e.key === 'L') && !isEditing(e.target)) {
      e.preventDefault();
      el.loadPrevAnswerBtn?.click();
      return;
    }

    // X: 복습 제외 토글
    if ((e.key === 'x' || e.key === 'X') && !isEditing(e.target)) {
      e.preventDefault();
      el.reviewExcludeToggle?.click();
      return;
    }

    // S: 학습 현황판으로 스크롤
    if ((e.key === 's' || e.key === 'S') && !isEditing(e.target)) {
      e.preventDefault();
      if (el.summaryArea && !el.summaryArea.classList.contains('hidden')) {
        window.scrollTo({
          top: el.summaryArea.getBoundingClientRect().top +
               window.pageYOffset -
               (el.fixedHeader?.getBoundingClientRect().height || 0) -
               8,
          behavior: 'smooth'
        });
      }
      return;
    }

    // G: 채점하기 (textarea에 포커스 없을 때)
    if ((e.key === 'g' || e.key === 'G') && !isEditing(e.target)) {
      e.preventDefault();
      el.gradeBtn?.click();
      return;
    }

    // Ctrl 조합키
    if (e.ctrlKey && !e.altKey && !e.metaKey) {
      // Ctrl + ←: 이전 문제
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        el.prevBtn?.click();
        return;
      }

      // Ctrl + →: 다음 문제
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        el.nextBtn?.click();
        return;
      }

      // Ctrl + [: 포커스 모드에서 나가기 또는 맨 위로
      if (e.key === '[') {
        e.preventDefault();
        if (ctrlNavState === 'focus') {
          backFromFocus();
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }

      // Ctrl + ]: 포커스 모드 진입/대시보드로 나가기
      if (e.key === ']') {
        e.preventDefault();
        if (ctrlNavState !== 'focus') {
          enterFocusMode();
        } else {
          exitToDashboard();
        }
        return;
      }
    }
  });
}
