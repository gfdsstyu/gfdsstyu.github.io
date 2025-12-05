// ============================================
// KAM UI/UX 구현
// 2단계 학습 흐름: Why → How
// ============================================

import kamEvaluationService from './kamCore.js';
import ragSearchService from '../../services/ragSearch.js';
import { exitKAMMode } from './kamIntegration.js';

/**
 * KAM 학습 UI 상태 관리
 */
class KAMUIState {
  constructor() {
    this.currentCase = null;
    this.currentStep = null; // 'why' | 'how' | 'result'
    this.whyAnswer = '';
    this.howAnswer = '';
    this.whyResult = null;
    this.howResult = null;
  }

  reset() {
    this.currentCase = null;
    this.currentStep = null;
    this.whyAnswer = '';
    this.howAnswer = '';
    this.whyResult = null;
    this.howResult = null;
  }

  /**
   * 사용자 답변 로컬 저장
   * 기존 답변이 있으면 병합 (덮어쓰지 않음)
   */
  saveAnswersToLocal(caseNum) {
    // 기존 저장된 답변 불러오기
    const existing = this.loadAnswersFromLocal(caseNum) || {};

    // 현재 답변과 병합 (빈 문자열이 아닌 경우만 업데이트)
    const data = {
      whyAnswer: this.whyAnswer || existing.whyAnswer || '',
      howAnswer: this.howAnswer || existing.howAnswer || '',
      timestamp: Date.now()
    };
    localStorage.setItem(`kam_answer_${caseNum}`, JSON.stringify(data));
  }

  /**
   * 사용자 답변 불러오기
   */
  loadAnswersFromLocal(caseNum) {
    const saved = localStorage.getItem(`kam_answer_${caseNum}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        return {
          whyAnswer: data.whyAnswer || '',
          howAnswer: data.howAnswer || '',
          timestamp: data.timestamp
        };
      } catch (e) {
        console.error('Failed to parse saved answers:', e);
      }
    }
    return null;
  }

  /**
   * 점수 저장
   */
  saveScoreToLocal(caseNum, finalScore, whyScore, howScore) {
    const scores = this.getAllScores();
    scores[caseNum] = {
      finalScore,
      whyScore,
      howScore,
      timestamp: Date.now()
    };
    localStorage.setItem('kam_scores', JSON.stringify(scores));
  }

  /**
   * 모든 점수 가져오기
   */
  getAllScores() {
    const saved = localStorage.getItem('kam_scores');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved scores:', e);
      }
    }
    return {};
  }

  /**
   * 특정 사례 점수 가져오기
   */
  getScoreForCase(caseNum) {
    const scores = this.getAllScores();
    return scores[caseNum] || null;
  }
}

const kamUIState = new KAMUIState();

/**
 * KAM 단축키 이벤트 리스너
 */
let kamKeyboardHandler = null;

function setupKAMKeyboardShortcuts() {
  // 기존 핸들러 제거
  if (kamKeyboardHandler) {
    document.removeEventListener('keydown', kamKeyboardHandler);
  }

  // KAM 전용 키보드 핸들러
  kamKeyboardHandler = (e) => {
    // KAM 모드가 아니면 무시
    if (!window.getIsKAMMode || !window.getIsKAMMode()) {
      return;
    }

    // Ctrl+Enter 또는 Cmd+Enter: 제출 버튼 클릭
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();

      // Step 1 (Why) 제출 버튼 찾기
      const whySubmitBtn = document.querySelector('#btn-submit-why');
      if (whySubmitBtn && !whySubmitBtn.disabled) {
        whySubmitBtn.click();
        return;
      }

      // Step 2 (How) 제출 버튼 찾기
      const howSubmitBtn = document.querySelector('#btn-submit-how');
      if (howSubmitBtn && !howSubmitBtn.disabled) {
        howSubmitBtn.click();
        return;
      }
    }

    // Ctrl+Shift+L 또는 Cmd+Shift+L: 이전 답변 불러오기
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
      e.preventDefault();

      // Step 1 불러오기 버튼
      const loadBtn = document.querySelector('#btn-load-saved');
      if (loadBtn && loadBtn.style.display !== 'none') {
        loadBtn.click();
        return;
      }

      // Step 2 불러오기 버튼
      const loadBtnHow = document.querySelector('#btn-load-saved-how');
      if (loadBtnHow && loadBtnHow.style.display !== 'none') {
        loadBtnHow.click();
        return;
      }
    }
  };

  document.addEventListener('keydown', kamKeyboardHandler);
}

function removeKAMKeyboardShortcuts() {
  if (kamKeyboardHandler) {
    document.removeEventListener('keydown', kamKeyboardHandler);
    kamKeyboardHandler = null;
  }
}

/**
 * KAM UI 렌더링
 */
export function renderKAMUI(container, apiKey, selectedModel) {
  if (!container) {
    console.error('KAM UI container not found');
    return;
  }

  // 초기 화면: KAM 사례 목록
  container.innerHTML = `
    <div class="kam-container max-w-6xl mx-auto p-6">
      <div class="kam-header mb-8">
        <h1 class="text-3xl font-bold text-purple-700 dark:text-purple-400 mb-2">
          📝 KAM 사례형 실전 훈련
        </h1>
        <p class="text-gray-600 dark:text-gray-400 no-kr-break">
          금융감독원 모범사례 기준으로 핵심감사사항 작성 능력을 향상시키세요
        </p>
      </div>

      <div id="kam-content" class="kam-content">
        <div class="flex justify-center items-center py-12">
          <div class="loader"></div>
        </div>
      </div>
    </div>
  `;

  const contentDiv = container.querySelector('#kam-content');

  // KAM 데이터 로드 후 사례 목록 표시
  kamEvaluationService.initialize().then(() => {
    // 단축키 활성화
    setupKAMKeyboardShortcuts();
    renderCaseList(contentDiv, apiKey, selectedModel);
  }).catch(error => {
    contentDiv.innerHTML = `
      <div class="alert alert-error bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-red-700 dark:text-red-300">❌ KAM 데이터 로드 실패: ${error.message}</p>
      </div>
    `;
  });
}

/**
 * KAM 모드 종료 시 단축키 제거
 */
export function cleanupKAMMode() {
  removeKAMKeyboardShortcuts();
}

/**
 * KAM 사례 목록 렌더링
 */
function renderCaseList(container, apiKey, selectedModel) {
  const cases = kamEvaluationService.getAllCases();

  // 주제별 그룹화 (topic 필드 기준)
  const groupedByTopic = {};
  cases.forEach(c => {
    const topic = c.topic || '기타';
    if (!groupedByTopic[topic]) {
      groupedByTopic[topic] = [];
    }
    groupedByTopic[topic].push(c);
  });

  let html = `
    <div class="cases-grid space-y-6">
      <div class="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p class="text-sm text-blue-700 dark:text-blue-300">
          💡 총 <strong>${cases.length}개</strong> KAM 사례가 <strong>${Object.keys(groupedByTopic).length}개</strong> 주제로 분류되어 있습니다.
        </p>
      </div>
  `;

  Object.keys(groupedByTopic).forEach(topic => {
    const topicCases = groupedByTopic[topic];
    html += `
      <div class="topic-group">
        <h3 class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
          <span class="inline-block w-1 h-6 bg-purple-600 rounded"></span>
          ${topic}
          <span class="ml-2 text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">${topicCases.length}개</span>
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

    topicCases.forEach(kamCase => {
      const savedScore = kamUIState.getScoreForCase(kamCase.num);
      const savedAnswer = kamUIState.loadAnswersFromLocal(kamCase.num);

      html += `
        <div class="case-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
             data-case-num="${kamCase.num}">
          <div class="flex items-start justify-between mb-2">
            <span class="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded font-bold">
              사례 ${kamCase.num}
            </span>
            <span class="text-xs text-gray-500 dark:text-gray-400">${kamCase.size}</span>
          </div>
          <h4 class="font-bold text-gray-800 dark:text-gray-200 mb-2 text-sm leading-tight">
            ${kamCase.kam}
          </h4>
          <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
            ${kamCase.situation.substring(0, 100)}...
          </p>
          <div class="mt-3 flex flex-wrap gap-2 items-center">
            <span class="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
              ${kamCase.industry}
            </span>
            ${savedScore ? `
              <span class="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded font-bold">
                ✓ ${savedScore.finalScore}점
              </span>
            ` : ''}
            ${savedAnswer ? `
              <span class="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                📝 저장됨
              </span>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  // 사례 카드 클릭 이벤트
  container.querySelectorAll('.case-card').forEach(card => {
    card.addEventListener('click', () => {
      const caseNum = parseInt(card.dataset.caseNum);
      const kamCase = kamEvaluationService.getCaseByNum(caseNum);
      if (kamCase) {
        kamUIState.reset();
        kamUIState.currentCase = kamCase;
        kamUIState.currentStep = 'why';
        renderStepWhy(container, apiKey, selectedModel);
      }
    });
  });
}

/**
 * Step 1: Why (선정 이유) 화면
 */
function renderStepWhy(container, apiKey, selectedModel) {
  const kamCase = kamUIState.currentCase;

  container.innerHTML = `
    <div class="kam-step-container space-y-6">
      <!-- 헤더 -->
      <div class="flex items-center justify-between mb-4">
        <button id="btn-back" class="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400">
          ← 목록으로
        </button>
        <div class="text-sm text-gray-500">Step 1/2</div>
      </div>

      <!-- 진행 바 -->
      <div class="progress-bar w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div class="progress-fill h-full bg-purple-600 transition-all" style="width: 50%"></div>
      </div>

      <!-- 사례 정보 -->
      <div class="case-info bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-5">
        <div class="flex items-start gap-3 mb-3">
          <span class="text-xs px-2 py-1 bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 rounded font-bold">
            사례 ${kamCase.num}
          </span>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
            ${kamCase.industry}
          </span>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
            ${kamCase.size}
          </span>
        </div>
        <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200 mb-3">${kamCase.kam}</h3>
        <div class="situation-text bg-white dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed" style="font-family: 'Iropke Batang', serif;">
          ${kamCase.situation}
        </div>
      </div>

      <!-- 질문 -->
      <div class="question-box bg-white dark:bg-gray-800 border-2 border-purple-300 dark:border-purple-700 rounded-lg p-5">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
            <span class="text-2xl">💭</span>
            Step 1: 핵심감사사항 선정 이유 (Why)
          </h4>
          <button id="btn-load-saved" class="text-xs px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded transition-colors" style="display: none;">
            📂 이전 답변 불러오기
          </button>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          위 상황에서 <strong>핵심감사사항(KAM)은 무엇이며, 왜 선정하였는지</strong> 서술하시오.
          <br>
          <span class="text-xs text-purple-600 dark:text-purple-400">
            💡 Tip: 기업 고유의 상황, 위험의 원천(불확실성/복잡성/주관성), 재무적 중요성을 구체적으로 명시하세요.
          </span>
          <br>
          <span class="text-xs text-gray-500 dark:text-gray-400 mt-2 inline-block">
            ⌨️ 단축키: <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Enter</kbd> 제출 | <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Shift+L</kbd> 이전 답변 불러오기
          </span>
        </p>
        <textarea id="why-answer"
                  class="w-full h-48 p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-200"
                  placeholder="예시: 본 회사는 운송주선용역 매출 337,756백만원을 인식하고 있으며, 이는 연결재무제표 매출의 35%를 차지합니다. 운송주선용역의 수익인식 시점은 계약 조건에 따라 다양하며, 경영진의 유의적인 판단이 개입됩니다. 특히, 특수관계자와의 거래가 포함되어 있어 거래의 실재성 및 기간귀속에 대한 왜곡표시 위험이 존재합니다. 따라서..."></textarea>
      </div>

      <!-- 버튼 -->
      <div class="flex justify-between gap-3">
        <button id="btn-exit-kam" class="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors">
          ← 사례 종료
        </button>
        <div class="flex gap-3">
          <button id="btn-skip-to-how" class="px-6 py-3 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors">
            채점 건너뛰고 다음 단계 →
          </button>
          <button id="btn-submit-why" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
            제출하고 피드백 받기 →
          </button>
        </div>
      </div>

      <div id="feedback-area"></div>
    </div>
  `;

  // 저장된 답변 확인 및 불러오기 버튼 표시
  const savedAnswers = kamUIState.loadAnswersFromLocal(kamCase.num);
  const loadBtn = container.querySelector('#btn-load-saved');
  const whyTextarea = container.querySelector('#why-answer');

  if (savedAnswers && savedAnswers.whyAnswer && savedAnswers.whyAnswer.trim()) {
    loadBtn.style.display = 'block';
    loadBtn.addEventListener('click', () => {
      whyTextarea.value = savedAnswers.whyAnswer;
      const timestamp = new Date(savedAnswers.timestamp).toLocaleString('ko-KR');
      alert(`이전 답변을 불러왔습니다.\n저장 시간: ${timestamp}`);
    });
  }

  // 이벤트 리스너
  container.querySelector('#btn-back').addEventListener('click', () => {
    kamUIState.reset();
    renderCaseList(container, apiKey, selectedModel);
  });

  // 사례 종료 버튼
  container.querySelector('#btn-exit-kam').addEventListener('click', () => {
    if (confirm('사례 풀이를 종료하고 퀴즈 모드로 돌아가시겠습니까?')) {
      exitKAMMode();
    }
  });

  // 채점 건너뛰고 다음 단계 버튼
  container.querySelector('#btn-skip-to-how').addEventListener('click', () => {
    const answer = whyTextarea.value.trim();
    if (!answer) {
      alert('답안을 작성해주세요.');
      return;
    }
    kamUIState.whyAnswer = answer;
    kamUIState.saveAnswersToLocal(kamCase.num);
    kamUIState.currentStep = 'how';
    renderStepHow(container, apiKey, selectedModel);
  });

  container.querySelector('#btn-submit-why').addEventListener('click', async () => {
    const answer = whyTextarea.value.trim();
    if (!answer) {
      alert('답안을 작성해주세요.');
      return;
    }

    kamUIState.whyAnswer = answer;
    kamUIState.saveAnswersToLocal(kamCase.num);
    await evaluateWhy(container, apiKey, selectedModel);
  });
}

/**
 * Why 평가 수행
 */
async function evaluateWhy(container, apiKey, selectedModel) {
  const feedbackArea = container.querySelector('#feedback-area');
  const submitBtn = container.querySelector('#btn-submit-why');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<div class="loader inline-block mr-2"></div> AI 평가 중...';

  feedbackArea.innerHTML = `
    <div id="loading-spinner" class="flex justify-center items-center py-8">
      <div class="loader"></div>
      <span class="ml-3 text-gray-600 dark:text-gray-400">AI가 답안을 평가하고 있습니다...</span>
    </div>
  `;

  try {
    const result = await kamEvaluationService.evaluateWhy(
      kamUIState.whyAnswer,
      kamUIState.currentCase,
      apiKey,
      selectedModel
    );

    kamUIState.whyResult = result;

    // 로딩 스피너 제거
    const loadingSpinner = feedbackArea.querySelector('#loading-spinner');
    if (loadingSpinner) {
      loadingSpinner.remove();
    }

    // 피드백 표시
    feedbackArea.innerHTML = `
      <div class="feedback-result bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-6 space-y-4">
        <div class="score-header flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <h4 class="text-xl font-bold text-gray-800 dark:text-gray-200">Step 1 평가 결과</h4>
          <div class="score-badge text-3xl font-bold ${result.score >= 80 ? 'text-green-600' : result.score >= 60 ? 'text-yellow-600' : 'text-red-600'}">
            ${result.score}점
          </div>
        </div>

        <div class="feedback-text text-gray-700 dark:text-gray-300 leading-relaxed" style="font-family: 'Iropke Batang', serif; white-space: pre-wrap;">
          ${result.feedback}
        </div>

        ${result.strengths && result.strengths.length > 0 ? `
          <div class="strengths bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h5 class="font-bold text-green-700 dark:text-green-400 mb-2">✅ 잘한 점</h5>
            <ul class="list-disc list-inside space-y-1 text-sm text-green-600 dark:text-green-300">
              ${result.strengths.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${result.improvements && result.improvements.length > 0 ? `
          <div class="improvements bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h5 class="font-bold text-yellow-700 dark:text-yellow-400 mb-2">💡 개선할 점</h5>
            <ul class="list-disc list-inside space-y-1 text-sm text-yellow-600 dark:text-yellow-300">
              ${result.improvements.map(i => `<li>${i}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="model-answer bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <h5 class="font-bold text-purple-700 dark:text-purple-400 mb-2">📚 모범 답안</h5>
          <p class="text-sm text-purple-600 dark:text-purple-300 leading-relaxed" style="font-family: 'Iropke Batang', serif;">
            ${kamUIState.currentCase.reason}
          </p>
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <button id="btn-next-step" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
            다음 단계로 (감사 절차 작성) →
          </button>
        </div>
      </div>
    `;

    // 제출 버튼 복구
    submitBtn.disabled = false;
    submitBtn.innerHTML = '제출하고 피드백 받기 →';

    // 다음 단계 버튼
    feedbackArea.querySelector('#btn-next-step').addEventListener('click', () => {
      kamUIState.currentStep = 'how';
      renderStepHow(container, apiKey, selectedModel);
    });

  } catch (error) {
    feedbackArea.innerHTML = `
      <div class="alert alert-error bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-red-700 dark:text-red-300">❌ 평가 실패: ${error.message}</p>
      </div>
    `;
    submitBtn.disabled = false;
    submitBtn.innerHTML = '제출하고 피드백 받기 →';
  }
}

/**
 * Step 2: How (감사 절차) 화면
 */
function renderStepHow(container, apiKey, selectedModel) {
  const kamCase = kamUIState.currentCase;

  container.innerHTML = `
    <div class="kam-step-container space-y-6">
      <!-- 헤더 -->
      <div class="flex items-center justify-between mb-4">
        <button id="btn-back" class="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400">
          ← 이전 단계
        </button>
        <div class="text-sm text-gray-500">Step 2/2</div>
      </div>

      <!-- 진행 바 -->
      <div class="progress-bar w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div class="progress-fill h-full bg-purple-600 transition-all" style="width: 100%"></div>
      </div>

      <!-- 사례 정보 및 상황 -->
      <div class="case-info bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-5">
        <div class="flex items-start gap-3 mb-3">
          <span class="text-xs px-2 py-1 bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 rounded font-bold">
            사례 ${kamCase.num}
          </span>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
            ${kamCase.industry}
          </span>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
            ${kamCase.size}
          </span>
        </div>
        <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200 mb-3">${kamCase.kam}</h3>
        <div class="situation-text bg-white dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4" style="font-family: 'Iropke Batang', serif;">
          ${kamCase.situation}
        </div>
        <div class="hint-area border-t border-purple-200 dark:border-purple-700 pt-4">
          <h5 class="font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
            <span>💡</span> 참고: 선정 이유 (모범 답안)
          </h5>
          <p class="text-sm text-purple-600 dark:text-purple-300 leading-relaxed" style="font-family: 'Iropke Batang', serif;">
            ${kamCase.reason}
          </p>
        </div>
      </div>

      <!-- 질문 -->
      <div class="question-box bg-white dark:bg-gray-800 border-2 border-purple-300 dark:border-purple-700 rounded-lg p-5">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
            <span class="text-2xl">🔍</span>
            Step 2: 핵심 감사절차 (How)
          </h4>
          <button id="btn-load-saved-how" class="text-xs px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded transition-colors" style="display: none;">
            📂 이전 답변 불러오기
          </button>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          위 위험에 대응하기 위한 <strong>핵심 감사절차 3가지 이상</strong>을 서술하시오.
          <br>
          <span class="text-xs text-purple-600 dark:text-purple-400">
            💡 Tip: 내부통제 평가, 가정의 합리성 검토(민감도 분석), 전문가 활용, 문서 검사 및 재계산 등을 포함하세요.
          </span>
          <br>
          <span class="text-xs text-gray-500 dark:text-gray-400 mt-2 inline-block">
            ⌨️ 단축키: <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Enter</kbd> 제출 | <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Shift+L</kbd> 이전 답변 불러오기
          </span>
        </p>
        <textarea id="how-answer"
                  class="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-200"
                  placeholder="예시:
1. 운송주선용역에 대한 수익 인식 회계정책의 적정성을 평가하고, 관련 내부통제의 설계 및 운영 효과성을 테스트함
2. 당기 중 발생한 매출 거래에 대하여 표본추출방식을 이용하여 발생증빙(계약서, 선적서류)과 수익인식시점을 비교 대사함
3. 보고기간말 전후에 발생한 수출 매출거래의 기간귀속 적정성을 확인하기 위해 추출된 표본에 대해 문서검사를 수행함
..."></textarea>
      </div>

      <!-- 버튼 -->
      <div class="flex justify-between gap-3">
        <button id="btn-exit-kam-step2" class="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors">
          ← 사례 종료
        </button>
        <button id="btn-submit-how" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
          최종 제출 및 종합 평가 →
        </button>
      </div>

      <div id="feedback-area"></div>
    </div>
  `;

  // 저장된 답변 확인 및 불러오기 버튼 표시
  const savedAnswers = kamUIState.loadAnswersFromLocal(kamCase.num);
  const loadBtnHow = container.querySelector('#btn-load-saved-how');
  const howTextarea = container.querySelector('#how-answer');

  console.log('[KAM Step 2] 저장된 답변 확인:', {
    caseNum: kamCase.num,
    savedAnswers,
    hasHowAnswer: !!(savedAnswers && savedAnswers.howAnswer),
    howAnswerLength: savedAnswers?.howAnswer?.length || 0,
    howAnswerValue: savedAnswers?.howAnswer
  });

  if (savedAnswers && savedAnswers.howAnswer && savedAnswers.howAnswer.trim()) {
    loadBtnHow.style.display = 'block';
    loadBtnHow.addEventListener('click', () => {
      howTextarea.value = savedAnswers.howAnswer;
      const timestamp = new Date(savedAnswers.timestamp).toLocaleString('ko-KR');
      alert(`이전 답변을 불러왔습니다.\n저장 시간: ${timestamp}`);
    });
  }

  // 이벤트 리스너
  container.querySelector('#btn-back').addEventListener('click', () => {
    kamUIState.currentStep = 'why';
    renderStepWhy(container, apiKey, selectedModel);
  });

  // 사례 종료 버튼
  container.querySelector('#btn-exit-kam-step2').addEventListener('click', () => {
    if (confirm('사례 풀이를 종료하고 퀴즈 모드로 돌아가시겠습니까?')) {
      exitKAMMode();
    }
  });

  container.querySelector('#btn-submit-how').addEventListener('click', async () => {
    const answer = howTextarea.value.trim();
    if (!answer) {
      alert('감사 절차를 작성해주세요.');
      return;
    }

    kamUIState.howAnswer = answer;
    console.log('[KAM Step 2] 답변 저장 전:', {
      caseNum: kamCase.num,
      whyAnswer: kamUIState.whyAnswer,
      howAnswer: kamUIState.howAnswer
    });
    kamUIState.saveAnswersToLocal(kamCase.num);
    console.log('[KAM Step 2] 답변 저장 완료');
    await evaluateHow(container, apiKey, selectedModel);
  });
}

/**
 * How 평가 수행 및 최종 결과 표시
 */
async function evaluateHow(container, apiKey, selectedModel) {
  const feedbackArea = container.querySelector('#feedback-area');
  const submitBtn = container.querySelector('#btn-submit-how');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<div class="loader inline-block mr-2"></div> AI 평가 중...';

  feedbackArea.innerHTML = `
    <div class="flex justify-center items-center py-8">
      <div class="loader"></div>
      <span class="ml-3 text-gray-600 dark:text-gray-400">AI가 최종 평가를 진행하고 있습니다...</span>
    </div>
  `;

  try {
    const result = await kamEvaluationService.evaluateHow(
      kamUIState.howAnswer,
      kamUIState.currentCase,
      apiKey,
      selectedModel
    );

    kamUIState.howResult = result;

    // 종합 평가
    const finalScore = kamEvaluationService.calculateFinalScore(
      kamUIState.whyResult,
      kamUIState.howResult
    );

    // 최종 결과 화면으로 전환
    renderFinalResult(container, finalScore, apiKey, selectedModel);

  } catch (error) {
    console.error('[KAM Step 2] 평가 실패:', error);
    feedbackArea.innerHTML = `
      <div class="alert alert-error bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-red-700 dark:text-red-300 font-bold mb-2">❌ 평가 실패</p>
        <p class="text-red-600 dark:text-red-400 text-sm mb-2">${error.message}</p>
        <details class="text-xs text-gray-600 dark:text-gray-400">
          <summary class="cursor-pointer">상세 정보</summary>
          <pre class="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto">${error.stack || 'Stack trace 없음'}</pre>
        </details>
      </div>
    `;
    submitBtn.disabled = false;
    submitBtn.innerHTML = '최종 제출 및 종합 평가 →';
  }
}

/**
 * 최종 결과 화면
 */
async function renderFinalResult(container, finalScore, apiKey, selectedModel) {
  const kamCase = kamUIState.currentCase;
  const whyResult = kamUIState.whyResult;
  const howResult = kamUIState.howResult;

  // 점수 저장
  const whyScore = whyResult ? whyResult.score : 0;
  const howScore = howResult ? howResult.score : 0;
  kamUIState.saveScoreToLocal(kamCase.num, finalScore.finalScore, whyScore, howScore);

  // 초기 화면 렌더링 (관련 기준서 없이)
  container.innerHTML = `
    <div class="final-result-container space-y-6">
      <!-- 헤더 -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200">
          🎯 종합 평가 결과
        </h2>
        <div class="flex gap-3">
          <button id="btn-exit-kam-final" class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors">
            사례 모드 종료
          </button>
          <button id="btn-restart" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
            다른 사례 풀기
          </button>
        </div>
      </div>

      <!-- 종합 점수 -->
      <div class="final-score-card bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl p-8 text-center shadow-xl">
        <div class="text-6xl font-bold mb-2">${finalScore.finalScore}점</div>
        <div class="text-xl opacity-90">
          ${finalScore.finalScore >= 90 ? 'A (우수)' :
            finalScore.finalScore >= 80 ? 'B (양호)' :
            finalScore.finalScore >= 70 ? 'C (보통)' :
            finalScore.finalScore >= 60 ? 'D (미흡)' : 'F (매우 미흡)'}
        </div>
        <div class="mt-4 text-sm opacity-75">
          Why ${whyScore}점 (40%) + How ${howScore}점 (60%)
        </div>
      </div>

      <!-- 상세 피드백 -->
      <div class="feedback-details grid grid-cols-1 ${whyResult ? 'md:grid-cols-2' : ''} gap-6">
        ${whyResult ? `
        <!-- Why 결과 -->
        <div class="why-feedback bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-5">
          <h4 class="font-bold text-purple-700 dark:text-purple-400 mb-3 flex items-center gap-2">
            <span>💭</span> Step 1: 선정 이유 (${whyScore}점)
          </h4>
          <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-2" style="font-family: 'Iropke Batang', serif; white-space: pre-wrap;">
            ${whyResult.feedback}
          </div>
        </div>
        ` : `
        <!-- Why 건너뜀 안내 -->
        <div class="why-feedback bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-5">
          <h4 class="font-bold text-yellow-700 dark:text-yellow-400 mb-3 flex items-center gap-2">
            <span>⚠️</span> Step 1: 선정 이유 (채점 건너뜀)
          </h4>
          <div class="text-sm text-yellow-700 dark:text-yellow-300 leading-relaxed">
            Step 1을 채점하지 않고 건너뛰었습니다. 종합 점수는 Step 2만으로 계산되었습니다.
          </div>
        </div>
        `}

        <!-- How 결과 -->
        <div class="how-feedback bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-5">
          <h4 class="font-bold text-purple-700 dark:text-purple-400 mb-3 flex items-center gap-2">
            <span>🔍</span> Step 2: 감사 절차 (${howScore}점)
          </h4>
          <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-2" style="font-family: 'Iropke Batang', serif; white-space: pre-wrap;">
            ${howResult.feedback}
          </div>
        </div>
      </div>

      <!-- 모범 답안 -->
      <div class="model-answers bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 space-y-4">
        <h4 class="font-bold text-purple-700 dark:text-purple-400 text-lg mb-4">📚 모범 답안</h4>

        <div class="model-why">
          <h5 class="font-bold text-sm text-purple-600 dark:text-purple-300 mb-2">선정 이유 (Why)</h5>
          <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" style="font-family: 'Iropke Batang', serif;">
            ${kamCase.reason}
          </p>
        </div>

        <div class="model-how">
          <h5 class="font-bold text-sm text-purple-600 dark:text-purple-300 mb-2">감사 절차 (How)</h5>
          <ol class="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300" style="font-family: 'Iropke Batang', serif;">
            ${kamCase.procedures.map(p => `<li>${p}</li>`).join('')}
          </ol>
        </div>
      </div>

      <!-- 관련 기준서 카드 (비동기 로딩) -->
      <div id="related-standards-container" class="related-standards-placeholder bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-6">
        <h4 class="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <span>📖</span> 관련 회계감사기준서
        </h4>
        <div class="flex justify-center items-center py-8">
          <div class="loader"></div>
          <span class="ml-3 text-gray-600 dark:text-gray-400">관련 기준서를 검색하고 있습니다...</span>
        </div>
      </div>

      <!-- 액션 버튼 -->
      <div class="flex justify-center gap-4 pt-4">
        <button id="btn-retry" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
          이 사례 다시 풀기
        </button>
        <button id="btn-list" class="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-lg transition-colors">
          사례 목록으로
        </button>
      </div>
    </div>
  `;

  // 이벤트 리스너
  container.querySelector('#btn-exit-kam-final').addEventListener('click', () => {
    if (confirm('사례 모드를 종료하고 퀴즈 모드로 돌아가시겠습니까?')) {
      exitKAMMode();
    }
  });

  container.querySelector('#btn-restart').addEventListener('click', () => {
    kamUIState.reset();
    renderCaseList(container, apiKey, selectedModel);
  });

  container.querySelector('#btn-retry').addEventListener('click', () => {
    kamUIState.reset();
    kamUIState.currentCase = kamCase;
    kamUIState.currentStep = 'why';
    renderStepWhy(container, apiKey, selectedModel);
  });

  container.querySelector('#btn-list').addEventListener('click', () => {
    kamUIState.reset();
    renderCaseList(container, apiKey, selectedModel);
  });

  // 비동기로 관련 기준서 검색 및 렌더링
  setTimeout(async () => {
    try {
      // RAG: 관련 기준서 검색 (사용자 답안 기반)
      const combinedText = `${kamUIState.whyAnswer} ${kamUIState.howAnswer}`;
      const relatedStandards = ragSearchService.searchByText(combinedText, 5);

      const standardsContainer = container.querySelector('#related-standards-container');
      if (standardsContainer) {
        if (relatedStandards.length > 0) {
          standardsContainer.innerHTML = `
            <h4 class="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <span>📖</span> 관련 회계감사기준서
            </h4>
            <div class="standards-grid grid grid-cols-1 gap-3">
              ${relatedStandards.map(std => `
                <div class="standard-card bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <h5 class="font-bold text-sm text-gray-800 dark:text-gray-200 mb-2">${std.problemTitle}</h5>
                  <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">${std.정답?.substring(0, 150)}...</p>
                </div>
              `).join('')}
            </div>
          `;
        } else {
          standardsContainer.innerHTML = `
            <h4 class="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <span>📖</span> 관련 회계감사기준서
            </h4>
            <p class="text-sm text-gray-600 dark:text-gray-400">관련 기준서를 찾을 수 없습니다.</p>
          `;
        }
      }
    } catch (error) {
      console.error('관련 기준서 검색 실패:', error);
      const standardsContainer = container.querySelector('#related-standards-container');
      if (standardsContainer) {
        standardsContainer.innerHTML = `
          <h4 class="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <span>📖</span> 관련 회계감사기준서
          </h4>
          <p class="text-sm text-red-600 dark:text-red-400">기준서 검색 중 오류가 발생했습니다.</p>
        `;
      }
    }
  }, 100); // 약간의 딜레이 후 검색 시작
}

export default {
  renderKAMUI,
  kamUIState,
  cleanupKAMMode
};
