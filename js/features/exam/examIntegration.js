/**
 * Past Exam Integration
 * 메인 앱과 기출문제 모드 연동
 */

import { examService } from './examService.js';
import { renderExamMode } from './examUI.js';

let isExamMode = false;
let examContainer = null;

/**
 * 기출문제 모드 진입
 */
export async function enterExamMode() {
  if (isExamMode) {
    console.warn('이미 기출문제 모드입니다.');
    return;
  }

  console.log('📝 기출문제 모드 진입');

  // 서비스 초기화
  console.log('🔧 [examIntegration.js] examService 초기화 시작');
  await examService.initialize();
  console.log('✅ [examIntegration.js] examService 초기화 완료');

  // 기존 UI 요소 숨기기 (KAM 모드 방식 차용)
  const quizArea = document.querySelector('#quiz-area');
  const summaryArea = document.querySelector('#summary-area');
  const flashcardArea = document.querySelector('#flashcard-area');
  const resultBox = document.querySelector('#result-box');
  const modelAnswerBox = document.querySelector('#model-answer-box');

  if (quizArea) quizArea.style.display = 'none';
  if (summaryArea) summaryArea.style.display = 'none';
  if (flashcardArea) flashcardArea.style.display = 'none';
  if (resultBox) resultBox.style.display = 'none';
  if (modelAnswerBox) modelAnswerBox.style.display = 'none';

  // 기출문제 컨테이너 생성
  examContainer = document.querySelector('#exam-container');
  console.log('🔍 [examIntegration.js] 기존 exam-container:', examContainer);

  if (!examContainer) {
    console.log('🔧 [examIntegration.js] 새로운 exam-container 생성');
    examContainer = document.createElement('div');
    examContainer.id = 'exam-container';
    // The container for main content inside the center column.
    const mainContentContainer = document.querySelector('#center-core > div');
    console.log('🔍 [examIntegration.js] mainContentContainer:', mainContentContainer);

    if (mainContentContainer) {
      mainContentContainer.appendChild(examContainer);
      console.log('✅ [examIntegration.js] exam-container를 mainContentContainer에 추가');
    } else {
      console.error('Main content container not found!');
      document.body.appendChild(examContainer); // Fallback
      console.log('⚠️ [examIntegration.js] exam-container를 body에 추가 (fallback)');
    }
  }

  console.log('🔍 [examIntegration.js] 최종 examContainer:', examContainer);

  // 좌우 대시보드는 연도 선택 화면에서는 유지
  // 실제 시험 시작 시에만 숨김 (examUI.js의 startExam에서 처리)

  // UI 렌더링
  console.log('🎨 [examIntegration.js] renderExamMode 호출');
  renderExamMode(examContainer);
  console.log('✅ [examIntegration.js] renderExamMode 완료');

  isExamMode = true;
}

/**
 * 기출문제 모드 종료
 */
export function exitExamMode() {
  if (!isExamMode) {
    console.warn('기출문제 모드가 아닙니다.');
    return;
  }

  console.log('📝 기출문제 모드 종료');

  // 컨테이너 제거
  if (examContainer) {
    examContainer.remove();
    examContainer = null;
  }

  // 숨겼던 UI 요소 복원
  const quizArea = document.querySelector('#quiz-area');
  const summaryArea = document.querySelector('#summary-area');
  const flashcardArea = document.querySelector('#flashcard-area');
  const resultBox = document.querySelector('#result-box');
  const modelAnswerBox = document.querySelector('#model-answer-box');
  const mainControls = document.querySelector('#center-core .flex.flex-col.md\\:flex-row.gap-4.mb-6');

  if (quizArea) quizArea.style.display = '';
  if (summaryArea) summaryArea.style.display = '';
  if (flashcardArea) flashcardArea.style.display = 'none'; // Default is hidden
  if (resultBox) resultBox.style.display = 'none'; // Default is hidden
  if (modelAnswerBox) modelAnswerBox.style.display = 'none'; // Default is hidden
  if (mainControls) mainControls.style.display = '';


  // 좌우 대시보드와 중앙 헤더 복원 (시험 중 숨겨진 경우)
  const leftDashboard = document.getElementById('left-dashboard');
  const rightDashboard = document.getElementById('right-explorer');
  const centerCore = document.getElementById('center-core');

  if (leftDashboard && leftDashboard.dataset.hiddenByExam === 'true') {
    leftDashboard.style.display = '';
    delete leftDashboard.dataset.hiddenByExam;
  }

  if (rightDashboard && rightDashboard.dataset.hiddenByExam === 'true') {
    rightDashboard.style.display = '';
    delete rightDashboard.dataset.hiddenByExam;
  }

  if (centerCore && centerCore.dataset.hiddenByExam === 'true') {
    centerCore.style.display = '';
    delete centerCore.dataset.hiddenByExam;
  }

  isExamMode = false;
}

/**
 * 현재 기출문제 모드 여부
 */
export function getIsExamMode() {
  return isExamMode;
}

// 전역 함수로 등록 (디버깅용)
window.enterExamMode = enterExamMode;
window.exitExamMode = exitExamMode;
window.getIsExamMode = getIsExamMode;
