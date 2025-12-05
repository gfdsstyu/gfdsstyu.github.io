// ============================================
// KAM 기능 통합 예제 코드
// 감린이 앱에 KAM 모드를 추가하는 방법
// ============================================

// ========================================
// 1. app.js에 추가할 import 문
// ========================================

// KAM 관련 모듈 import (app.js의 모듈 임포트 섹션에 추가)
import * as KAM from './features/kam/kamUI.js';
import ragSearchService from './services/ragSearch.js';
import kamEvaluationService from './features/kam/kamCore.js';

// 전역 노출 (필요시)
window.KAM = KAM;
window.ragSearchService = ragSearchService;
window.kamEvaluationService = kamEvaluationService;

// ========================================
// 2. 상태 관리 확장 (stateManager.js)
// ========================================

// stateManager.js의 state 객체에 추가
const state = {
  // ... 기존 상태들

  // KAM 모드 관련 상태
  isKAMMode: false,
  kamSelectedCase: null,
  kamCurrentStep: null, // 'why' | 'how' | 'result'
};

// Getter 함수 추가
export const getIsKAMMode = () => state.isKAMMode;
export const getKAMSelectedCase = () => state.kamSelectedCase;
export const getKAMCurrentStep = () => state.kamCurrentStep;

// Setter 함수 추가
export const setIsKAMMode = (mode) => {
  state.isKAMMode = mode;
  // UI 전환
  if (mode) {
    showKAMMode();
  } else {
    showQuizMode();
  }
};
export const setKAMSelectedCase = (caseData) => { state.kamSelectedCase = caseData; };
export const setKAMCurrentStep = (step) => { state.kamCurrentStep = step; };

// ========================================
// 3. Dashboard 확장 (dashboard.js 또는 main UI)
// ========================================

export function mountDashboard(store) {
  const left = ensure('#v4-left');
  left.innerHTML = `
    <!-- 기존 섹션들 -->
    <section class="p-4 rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800">
      <h3 class="font-bold mb-2 text-gray-900 dark:text-gray-100">오늘의 복습</h3>
      <!-- ... 기존 코드 ... -->
    </section>

    <!-- 🆕 KAM 실전 훈련 섹션 -->
    <section class="p-4 rounded-xl border bg-gradient-to-r from-purple-50 to-indigo-50
                    dark:from-purple-900/20 dark:to-indigo-900/20
                    border-purple-200 dark:border-purple-800">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-2xl">📝</span>
        <h3 class="font-bold text-purple-700 dark:text-purple-400">KAM 사례형 실전 훈련</h3>
      </div>
      <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
        금융감독원 모범사례 기준으로 핵심감사사항 작성 능력을 향상시키세요
      </p>
      <button id="btn-start-kam"
        class="w-full px-4 py-3 rounded-lg bg-purple-600 text-white
               hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500
               font-bold transition-colors shadow-md hover:shadow-lg">
        KAM 실전 연습 시작 →
      </button>

      <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div class="text-center p-2 bg-white dark:bg-gray-800 rounded border border-purple-200 dark:border-purple-700">
          <div class="font-bold text-purple-600 dark:text-purple-400">26개</div>
          <div class="text-gray-500 dark:text-gray-400">사례</div>
        </div>
        <div class="text-center p-2 bg-white dark:bg-gray-800 rounded border border-purple-200 dark:border-purple-700">
          <div class="font-bold text-purple-600 dark:text-purple-400">2단계</div>
          <div class="text-gray-500 dark:text-gray-400">학습</div>
        </div>
        <div class="text-center p-2 bg-white dark:bg-gray-800 rounded border border-purple-200 dark:border-purple-700">
          <div class="font-bold text-purple-600 dark:text-purple-400">AI</div>
          <div class="text-gray-500 dark:text-gray-400">평가</div>
        </div>
      </div>
    </section>
  `;

  // KAM 시작 버튼 이벤트
  document.getElementById('btn-start-kam')?.addEventListener('click', enterKAMMode);
}

// ========================================
// 4. KAM 모드 진입/종료 함수
// ========================================

/**
 * KAM 모드로 진입
 */
async function enterKAMMode() {
  try {
    // 로딩 표시
    showLoadingOverlay('KAM 시스템 초기화 중...');

    // 1. KAM 시스템 초기화
    await kamEvaluationService.initialize();
    await ragSearchService.initialize();

    // 2. 상태 변경
    StateManager.setIsKAMMode(true);

    // 3. UI 전환: 퀴즈 영역 숨기고 KAM 컨테이너 생성
    const quizArea = document.querySelector('#quiz-area');
    const summaryArea = document.querySelector('#summary-area');
    const explorerArea = document.querySelector('#explorer-area');

    quizArea.style.display = 'none';
    summaryArea.style.display = 'none';

    // KAM 컨테이너 생성
    let kamContainer = document.querySelector('#kam-container');
    if (!kamContainer) {
      kamContainer = document.createElement('div');
      kamContainer.id = 'kam-container';
      kamContainer.className = 'kam-container';
      quizArea.parentNode.insertBefore(kamContainer, quizArea);
    }

    // 4. KAM UI 렌더링
    const apiKey = StateManager.getGeminiApiKey();
    const model = StateManager.getSelectedAiModel();

    if (!apiKey) {
      hideLoadingOverlay();
      alert('Gemini API 키를 먼저 설정해주세요. (설정 → API 키)');
      exitKAMMode();
      return;
    }

    KAM.renderKAMUI(kamContainer, apiKey, model);

    // 5. 헤더 업데이트 (선택적)
    updateHeaderForKAMMode();

    hideLoadingOverlay();
    console.log('✅ KAM 모드 진입 완료');

  } catch (error) {
    hideLoadingOverlay();
    console.error('❌ KAM 모드 진입 실패:', error);
    alert(`KAM 시스템 초기화 실패: ${error.message}`);
    exitKAMMode();
  }
}

/**
 * KAM 모드 종료 (일반 퀴즈 모드로 복귀)
 */
function exitKAMMode() {
  // 상태 변경
  StateManager.setIsKAMMode(false);
  StateManager.setKAMSelectedCase(null);
  StateManager.setKAMCurrentStep(null);

  // UI 전환
  const quizArea = document.querySelector('#quiz-area');
  const summaryArea = document.querySelector('#summary-area');
  const kamContainer = document.querySelector('#kam-container');

  if (quizArea) quizArea.style.display = 'block';
  if (summaryArea) summaryArea.style.display = 'block';
  if (kamContainer) kamContainer.remove();

  // 헤더 복원 (선택적)
  restoreHeaderFromKAMMode();

  console.log('✅ 일반 모드로 복귀');
}

/**
 * 모드 전환 함수 (퀴즈 ↔ KAM)
 */
function showKAMMode() {
  document.querySelector('#quiz-area')?.style.setProperty('display', 'none');
  document.querySelector('#kam-container')?.style.setProperty('display', 'block');
}

function showQuizMode() {
  document.querySelector('#quiz-area')?.style.setProperty('display', 'block');
  document.querySelector('#kam-container')?.style.setProperty('display', 'none');
}

// ========================================
// 5. 헤더 업데이트 (선택적)
// ========================================

function updateHeaderForKAMMode() {
  const header = document.querySelector('header h1');
  if (header) {
    header.innerHTML = `
      <span class="text-purple-600 dark:text-purple-400">📝</span>
      감린이 - KAM 사례형 실전 훈련
      <button id="btn-exit-kam" class="text-sm px-3 py-1 ml-3 bg-gray-200 dark:bg-gray-700
                                        hover:bg-gray-300 dark:hover:bg-gray-600 rounded">
        ← 일반 모드로
      </button>
    `;

    document.getElementById('btn-exit-kam')?.addEventListener('click', exitKAMMode);
  }
}

function restoreHeaderFromKAMMode() {
  const header = document.querySelector('header h1');
  if (header) {
    header.textContent = '감린이 - 회계감사 학습 도우미';
  }
}

// ========================================
// 6. 로딩 오버레이 (선택적)
// ========================================

function showLoadingOverlay(message = '로딩 중...') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    overlay.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center gap-4 shadow-xl">
        <div class="loader"></div>
        <span class="text-gray-700 dark:text-gray-300">${message}</span>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// ========================================
// 7. Explorer에 KAM 모드 추가 (Phase 2, 선택적)
// ========================================

/**
 * Explorer에 KAM 트리 추가
 */
export function renderKAMExplorer(container) {
  const cases = kamEvaluationService.getAllCases();

  // 산업별 그룹화
  const groupedByIndustry = {};
  cases.forEach(c => {
    if (!groupedByIndustry[c.industry]) {
      groupedByIndustry[c.industry] = [];
    }
    groupedByIndustry[c.industry].push(c);
  });

  let html = '<div class="kam-tree">';

  Object.keys(groupedByIndustry).forEach(industry => {
    html += `
      <div class="tree-node">
        <div class="tree-header font-bold text-purple-600 dark:text-purple-400">
          📁 ${industry}
        </div>
        <div class="tree-children pl-4">
    `;

    groupedByIndustry[industry].forEach(kamCase => {
      html += `
        <div class="tree-leaf cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 p-2 rounded"
             data-case-num="${kamCase.num}">
          📄 ${kamCase.num}. ${kamCase.kam}
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;

  // 사례 클릭 이벤트
  container.querySelectorAll('.tree-leaf').forEach(leaf => {
    leaf.addEventListener('click', () => {
      const caseNum = parseInt(leaf.dataset.caseNum);
      const kamCase = kamEvaluationService.getCaseByNum(caseNum);
      StateManager.setKAMSelectedCase(kamCase);
      // KAM UI로 직접 이동
      enterKAMMode();
    });
  });
}

// ========================================
// 8. 초기화 코드 (app.js의 main 함수에 추가)
// ========================================

async function initializeApp() {
  console.log('🚀 감린이 초기화 시작...');

  // ... 기존 초기화 코드 ...

  // KAM 시스템 초기화 (지연 로딩 - 선택적)
  // 앱 시작 시 초기화하지 않고, enterKAMMode에서 초기화할 수도 있음
  try {
    console.log('⏳ KAM 시스템 초기화 중...');
    await kamEvaluationService.initialize();
    await ragSearchService.initialize();
    console.log('✅ KAM 시스템 초기화 완료');
  } catch (error) {
    console.warn('⚠️ KAM 시스템 초기화 지연:', error.message);
    console.log('→ KAM 모드 진입 시 다시 초기화됩니다.');
  }

  console.log('✅ 감린이 초기화 완료');
}

// ========================================
// 9. 유틸리티 함수
// ========================================

/**
 * DOM 요소 확인 유틸리티
 */
function ensure(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

/**
 * 사례 통계 정보
 */
function getKAMStats() {
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

// ========================================
// 10. Export
// ========================================

export {
  enterKAMMode,
  exitKAMMode,
  showKAMMode,
  showQuizMode,
  renderKAMExplorer,
  getKAMStats
};

// ========================================
// 사용 예제
// ========================================

/*
// HTML에서 직접 호출
<button onclick="enterKAMMode()">KAM 시작</button>

// JavaScript에서 호출
import { enterKAMMode, exitKAMMode } from './kamIntegration.js';

document.getElementById('btn-kam').addEventListener('click', enterKAMMode);
document.getElementById('btn-exit').addEventListener('click', exitKAMMode);

// 통계 확인
import { getKAMStats } from './kamIntegration.js';
console.log(getKAMStats());
// { totalCases: 26, industries: 8, casesByIndustry: {...} }
*/
