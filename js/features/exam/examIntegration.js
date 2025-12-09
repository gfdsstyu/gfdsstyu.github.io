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
export async function enterExamMode(apiKey, selectedModel) {
  if (isExamMode) {
    console.warn('이미 기출문제 모드입니다.');
    return;
  }

  console.log('📝 기출문제 모드 진입');

  // 서비스 초기화
  await examService.initialize();

  // 기존 컨테이너 숨기기
  const mainContainer = document.getElementById('message-container');
  if (mainContainer) {
    mainContainer.style.display = 'none';
  }

  // 좌우 대시보드는 연도 선택 화면에서는 유지
  // 실제 시험 시작 시에만 숨김 (examUI.js의 startExam에서 처리)

  // 기출문제 컨테이너 생성
  examContainer = document.createElement('div');
  examContainer.id = 'exam-container';
  examContainer.className = 'exam-mode-container';
  document.body.appendChild(examContainer);

  // UI 렌더링
  renderExamMode(examContainer, apiKey, selectedModel);

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

  // 기존 컨테이너 복원
  const mainContainer = document.getElementById('message-container');
  if (mainContainer) {
    mainContainer.style.display = 'block';
  }

  // 좌우 대시보드 복원 (시험 중 숨겨진 경우)
  const leftDashboard = document.getElementById('left-dashboard');
  const rightDashboard = document.getElementById('right-explorer');

  if (leftDashboard && leftDashboard.dataset.hiddenByExam === 'true') {
    leftDashboard.style.display = '';
    delete leftDashboard.dataset.hiddenByExam;
  }

  if (rightDashboard && rightDashboard.dataset.hiddenByExam === 'true') {
    rightDashboard.style.display = '';
    delete rightDashboard.dataset.hiddenByExam;
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
