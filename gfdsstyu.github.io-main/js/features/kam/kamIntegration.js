// ============================================
// KAM 기능 통합 헬퍼
// 메인 앱에서 KAM 모드 진입/종료
// ============================================

import { renderKAMUI, cleanupKAMMode } from './kamUI.js';
import kamEvaluationService from './kamCore.js';
import ragSearchService from '../../services/ragSearch.js';
import * as StateManager from '../../core/stateManager.js';

/**
 * KAM 모드로 진입
 */
export async function enterKAMMode() {
  try {
    console.log('🚀 KAM 모드 진입 시작...');

    // 로딩 표시
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'kam-loading';
    loadingDiv.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    loadingDiv.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center gap-4 shadow-xl">
        <div class="loader"></div>
        <span class="text-gray-700 dark:text-gray-300">KAM 시스템 초기화 중...</span>
      </div>
    `;
    document.body.appendChild(loadingDiv);

    // 1. KAM 시스템 초기화
    await kamEvaluationService.initialize();
    await ragSearchService.initialize();

    // 2. 상태 변경
    StateManager.setIsKAMMode(true);

    // 3. UI 전환 - Quiz 관련 요소 모두 숨기기
    const quizArea = document.querySelector('#quiz-area');
    const summaryArea = document.querySelector('#summary-area');
    const resultBox = document.querySelector('#result-box');
    const modelAnswerBox = document.querySelector('#model-answer-box');

    if (quizArea) quizArea.style.display = 'none';
    if (summaryArea) summaryArea.style.display = 'none';
    if (resultBox) resultBox.style.display = 'none';
    if (modelAnswerBox) modelAnswerBox.style.display = 'none';

    // KAM 컨테이너 생성
    let kamContainer = document.querySelector('#kam-container');
    if (!kamContainer) {
      kamContainer = document.createElement('div');
      kamContainer.id = 'kam-container';
      if (quizArea && quizArea.parentNode) {
        quizArea.parentNode.insertBefore(kamContainer, quizArea);
      } else {
        document.body.appendChild(kamContainer);
      }
    }

    // 4. API 키 확인
    const apiKey = StateManager.getGeminiApiKey();
    if (!apiKey) {
      loadingDiv.remove();
      alert('Gemini API 키를 먼저 설정해주세요.\n\n설정 → API 키 메뉴에서 등록할 수 있습니다.');
      exitKAMMode();
      return;
    }

    // 5. KAM UI 렌더링
    const model = StateManager.getSelectedAiModel();
    renderKAMUI(kamContainer, apiKey, model);

    // 6. 버튼 텍스트 업데이트
    updateMainButtonText();

    // 로딩 제거
    loadingDiv.remove();

    console.log('✅ KAM 모드 진입 완료');

  } catch (error) {
    console.error('❌ KAM 모드 진입 실패:', error);
    document.getElementById('kam-loading')?.remove();
    alert(`KAM 시스템 초기화 실패:\n${error.message}\n\n콘솔을 확인해주세요.`);
    exitKAMMode();
  }
}

/**
 * KAM 모드 종료 (일반 퀴즈 모드로 복귀)
 */
export function exitKAMMode() {
  console.log('← KAM 모드 종료');

  // KAM 단축키 제거
  cleanupKAMMode();

  // 상태 변경
  StateManager.setIsKAMMode(false);
  StateManager.setKAMSelectedCase(null);

  // UI 복원
  const quizArea = document.querySelector('#quiz-area');
  const summaryArea = document.querySelector('#summary-area');
  const resultBox = document.querySelector('#result-box');
  const modelAnswerBox = document.querySelector('#model-answer-box');
  const kamContainer = document.querySelector('#kam-container');

  if (quizArea) quizArea.style.display = 'block';
  if (summaryArea) summaryArea.style.display = 'block';
  // result-box와 model-answer-box는 원래 hidden 상태이므로 display를 제거하여 원상복구
  if (resultBox) resultBox.style.display = '';
  if (modelAnswerBox) modelAnswerBox.style.display = '';
  if (kamContainer) kamContainer.remove();

  // 버튼 텍스트 업데이트
  updateMainButtonText();

  console.log('✅ 일반 모드로 복귀');
}

/**
 * 메인 버튼 텍스트 업데이트
 */
function updateMainButtonText() {
  const kamBtnText = document.querySelector('#kam-mode-btn-text');
  if (kamBtnText) {
    if (StateManager.getIsKAMMode()) {
      kamBtnText.textContent = '사례 종료';
    } else {
      kamBtnText.textContent = '사례';
    }
  }
}

/**
 * KAM 통계 정보
 */
export function getKAMStats() {
  const cases = kamEvaluationService.getAllCases();
  const industries = [...new Set(cases.map(c => c.industry))];

  return {
    totalCases: cases.length,
    industries: industries.length,
    casesByIndustry: industries.reduce((acc, industry) => {
      acc[industry] = cases.filter(c => c.industry === industry).length;
      return acc;
    }, {})
  };
}

// 전역 노출 (브라우저 콘솔 및 레거시 코드에서 사용)
if (typeof window !== 'undefined') {
  window.enterKAMMode = enterKAMMode;
  window.exitKAMMode = exitKAMMode;
  window.getKAMStats = getKAMStats;
}
