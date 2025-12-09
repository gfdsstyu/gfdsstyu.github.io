// ============================================
// KAM UI/UX 구현
// 2단계 학습 흐름: Why → How
// ============================================

import kamEvaluationService from './kamCore.js';
import ragSearchService from '../../services/ragSearch.js';
import { exitKAMMode } from './kamIntegration.js';
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { db, auth } from '../../app.js';
import { updateUserStats, updateGroupStats } from '../ranking/rankingCore.js';
import { getMyGroups } from '../group/groupCore.js';
import { updateUniversityStats } from '../university/universityCore.js';

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
   * 점수 저장 (로컬 + Firestore)
   */
  async saveScoreToLocal(caseNum, finalScore, whyScore, howScore) {
    const scores = this.getAllScores();
    const scoreData = {
      finalScore,
      whyScore,
      howScore,
      timestamp: Date.now()
    };
    scores[caseNum] = scoreData;
    localStorage.setItem('kam_scores', JSON.stringify(scores));

    // Firestore에도 저장
    await this.syncScoreToFirestore(caseNum, scoreData);
  }

  /**
   * KAM 점수를 Firestore에 동기화
   */
  async syncScoreToFirestore(caseNum, scoreData) {
    const user = auth.currentUser;
    if (!user) {
      console.log('⚠️ [KAM] 로그인되지 않음 - Firestore 동기화 스킵');
      return { success: false, message: '로그인되지 않음' };
    }

    try {
      console.log(`📤 [KAM] 사례 ${caseNum} 점수를 Firestore에 저장 중...`);

      const kamScoreRef = doc(db, 'users', user.uid, 'kamScores', `case_${caseNum}`);

      await setDoc(kamScoreRef, {
        caseNum,
        finalScore: scoreData.finalScore,
        whyScore: scoreData.whyScore,
        howScore: scoreData.howScore,
        timestamp: scoreData.timestamp,
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log(`✅ [KAM] 사례 ${caseNum} 점수 Firestore 저장 완료`);
      return { success: true, message: '점수 저장 완료' };
    } catch (error) {
      console.error('❌ [KAM] Firestore 저장 실패:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 평가 피드백 저장 (AI 응답)
   */
  saveFeedbackToLocal(caseNum, feedback = {}) {
    const existing = this.loadFeedbackFromLocal(caseNum) || {};
    const data = {
      ...existing,
      ...feedback,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(`kam_feedback_${caseNum}`, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save feedback to localStorage:', error);
    }
  }

  /**
   * 평가 피드백 불러오기
   */
  loadFeedbackFromLocal(caseNum) {
    const saved = localStorage.getItem(`kam_feedback_${caseNum}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved feedback:', e);
      }
    }
    return null;
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
 * 우선순위 기반 기준서 검색
 * @param {Object} ragService - RAG 검색 서비스
 * @param {string} proceduresText - 모범답안 감사절차 (최우선)
 * @param {string} reasonText - 모범답안 선정이유 및 KAM 제목
 * @param {string} userAnswersText - 사용자 답안 (부가적)
 * @param {string} situationText - 상황 설명 (부가적)
 * @param {number} limit - 반환할 최대 결과 수
 * @returns {Array} 관련 기준서 배열
 */
function searchWithPriority(ragService, proceduresText, reasonText, userAnswersText, situationText, limit = 5) {
  if (!ragService.initialized || !ragService.questionsData) {
    console.warn('RAG Search System not initialized');
    return [];
  }

  // 각 텍스트에서 키워드 추출
  const proceduresKeywords = ragService.extractKeywords(proceduresText);
  const reasonKeywords = ragService.extractKeywords(reasonText);
  const userKeywords = ragService.extractKeywords(userAnswersText);
  const situationKeywords = ragService.extractKeywords(situationText);

  console.log('[KAM Search] 추출된 키워드:', {
    procedures: proceduresKeywords.slice(0, 10),
    reason: reasonKeywords.slice(0, 10),
    user: userKeywords.slice(0, 5),
    situation: situationKeywords.slice(0, 5)
  });

  // 각 질문에 대해 우선순위 기반 점수 계산
  const scoredQuestions = ragService.questionsData.map(question => {
    let score = 0;
    const searchableAnswer = (question.정답 || '').toLowerCase();
    const searchableTitle = (question.problemTitle || '').toLowerCase();
    const searchableQuestion = (question.물음 || '').toLowerCase();

    // 제목과 물음의 중복 체크를 위한 Set
    const matchedInTitle = new Set();
    const matchedInQuestion = new Set();

    // 1. 모범답안 감사절차 키워드 (최고 가중치)
    proceduresKeywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();

      // 정답에서 매칭: +20점 (최우선 - 가중치 2배 증가)
      if (searchableAnswer.includes(lowerKeyword)) {
        score += 20;
      }

      // 제목에서 매칭: +3점 (중복 방지)
      if (searchableTitle.includes(lowerKeyword) && !matchedInTitle.has(lowerKeyword)) {
        score += 3;
        matchedInTitle.add(lowerKeyword);
      }

      // 물음에서 매칭: +2점 (중복 방지)
      if (searchableQuestion.includes(lowerKeyword) && !matchedInQuestion.has(lowerKeyword)) {
        score += 2;
        matchedInQuestion.add(lowerKeyword);
      }
    });

    // 2. 모범답안 선정이유 및 KAM 키워드 (높은 가중치)
    reasonKeywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();

      // 정답에서 매칭: +10점 (가중치 2배 증가)
      if (searchableAnswer.includes(lowerKeyword)) {
        score += 10;
      }

      // 제목에서 매칭: +2점 (중복 방지)
      if (searchableTitle.includes(lowerKeyword) && !matchedInTitle.has(lowerKeyword)) {
        score += 2;
        matchedInTitle.add(lowerKeyword);
      }

      // 물음에서 매칭: +1점 (중복 방지)
      if (searchableQuestion.includes(lowerKeyword) && !matchedInQuestion.has(lowerKeyword)) {
        score += 1;
        matchedInQuestion.add(lowerKeyword);
      }
    });

    // 3. 사용자 답안 키워드 (보조 가중치)
    userKeywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();

      // 정답에서 매칭: +4점 (가중치 2배 증가)
      if (searchableAnswer.includes(lowerKeyword)) {
        score += 4;
      }

      // 제목/물음에서는 중복 방지 위해 점수 주지 않음
    });

    // 4. 상황 설명 키워드 (최소 가중치)
    situationKeywords.forEach(keyword => {
      const lowerKeyword = keyword.toLowerCase();

      // 정답에서 매칭: +2점 (가중치 2배 증가)
      if (searchableAnswer.includes(lowerKeyword)) {
        score += 2;
      }
    });

    return {
      ...question,
      relevanceScore: score
    };
  });

  // 점수 기준으로 정렬하고 상위 결과만 반환
  const results = scoredQuestions
    .filter(q => q.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  console.log('[KAM Search] 상위 결과:', results.map(r => ({
    title: r.problemTitle?.substring(0, 50),
    score: r.relevanceScore
  })));

  return results;
}

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

    // Ctrl+ArrowRight 또는 Cmd+ArrowRight: 다음 단계
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
      e.preventDefault();

      // Step 1에서 다음 단계 버튼
      const skipToHowBtn = document.querySelector('#btn-skip-to-how-nav');
      if (skipToHowBtn) {
        skipToHowBtn.click();
        return;
      }

      // Step 1 피드백 화면에서 다음 단계 버튼
      const nextStepBtn = document.querySelector('#btn-next-step');
      if (nextStepBtn) {
        nextStepBtn.click();
        return;
      }

      // Step 1 피드백 화면에서 종합 평가 보기 버튼
      const viewFinalBtn = document.querySelector('#btn-view-final');
      if (viewFinalBtn && viewFinalBtn.style.display !== 'none') {
        viewFinalBtn.click();
        return;
      }

      // Step 2 피드백 화면에서 종합 평가 보기 버튼
      const viewFinalHowBtn = document.querySelector('#btn-view-final-how');
      if (viewFinalHowBtn && viewFinalHowBtn.style.display !== 'none') {
        viewFinalHowBtn.click();
        return;
      }
    }

    // Ctrl+ArrowLeft 또는 Cmd+ArrowLeft: 이전 단계
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
      e.preventDefault();

      // Step 2에서 이전 단계 버튼
      const backBtn = document.querySelector('#btn-back');
      if (backBtn) {
        backBtn.click();
        return;
      }

      // 최종 결과 화면에서 이전 단계 버튼
      const backToStep2Btn = document.querySelector('#btn-back-to-step2');
      if (backToStep2Btn) {
        backToStep2Btn.click();
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
            <span class="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-700 text-purple-700 dark:text-purple-100 rounded font-bold">
              사례 ${kamCase.num}
            </span>
            <span class="text-xs text-gray-500 dark:text-gray-300">${kamCase.size}</span>
          </div>
          <h4 class="font-bold text-gray-900 dark:text-gray-100 mb-2 text-sm leading-tight">
            ${kamCase.kam}
          </h4>
          <p class="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
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
        <button id="btn-back" class="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 font-medium">
          ← 목록으로
        </button>
        <div class="flex items-center gap-4">
          <div class="text-sm text-gray-500 dark:text-gray-400">Step 1/2</div>
          <button id="btn-skip-to-how-nav" class="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">
            다음 단계 →
          </button>
        </div>
      </div>

      <!-- 진행 바 -->
      <div class="progress-bar w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div class="progress-fill h-full bg-purple-600 transition-all" style="width: 50%"></div>
      </div>

      <!-- 사례 정보 -->
      <div class="case-info bg-purple-50 dark:bg-gray-800 border border-purple-200 dark:border-gray-600 rounded-lg p-5">
        <div class="flex items-start gap-3 mb-3">
          <span class="text-xs px-2 py-1 bg-purple-200 dark:bg-purple-600 text-purple-800 dark:text-white rounded font-bold">
            사례 ${kamCase.num}
          </span>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded">
            ${kamCase.industry}
          </span>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded">
            ${kamCase.size}
          </span>
        </div>
        <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-3 bg-white dark:bg-gray-900 p-3 rounded-lg">${kamCase.kam}</h3>
        <div class="situation-text bg-white dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-200 leading-relaxed" style="font-family: 'Iropke Batang', serif;">
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
          <div class="flex gap-2">
            <button id="btn-load-saved" class="text-xs px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded transition-colors" style="display: none;">
              📂 이전 답변 불러오기
            </button>
            <button id="btn-view-feedback" class="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded transition-colors" style="display: none;">
              📋 이전 피드백 보기
            </button>
          </div>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          위 상황에서 <strong>핵심감사사항(KAM)은 무엇이며, 왜 선정하였는지</strong> 서술하시오.
          <br>
          <span class="text-xs text-purple-600 dark:text-purple-400">
            💡 Tip: 기업 고유의 상황, 위험의 원천(불확실성/복잡성/주관성), 재무적 중요성을 구체적으로 명시하세요.
          </span>
          <br>
          <span class="text-xs text-gray-500 dark:text-gray-400 mt-2 inline-block">
            ⌨️ 단축키: <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Enter</kbd> 제출 | <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+→</kbd> 다음 단계 | <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Shift+L</kbd> 이전 답변
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
        <button id="btn-submit-why" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
          제출하고 피드백 받기 →
        </button>
      </div>

      <div id="feedback-area"></div>
    </div>
  `;

  // 저장된 답변 및 피드백 확인
  const savedAnswers = kamUIState.loadAnswersFromLocal(kamCase.num);
  const savedFeedback = kamUIState.loadFeedbackFromLocal(kamCase.num);
  const loadBtn = container.querySelector('#btn-load-saved');
  const viewFeedbackBtn = container.querySelector('#btn-view-feedback');
  const whyTextarea = container.querySelector('#why-answer');
  const feedbackArea = container.querySelector('#feedback-area');

  console.log('[KAM Step 1] 저장된 피드백 확인:', {
    caseNum: kamCase.num,
    savedFeedback,
    hasWhyResult: !!(savedFeedback && savedFeedback.whyResult),
    whyResultScore: savedFeedback?.whyResult?.score
  });

  // 이전 답변 불러오기
  if (savedAnswers && savedAnswers.whyAnswer && savedAnswers.whyAnswer.trim()) {
    loadBtn.style.display = 'block';
    loadBtn.addEventListener('click', () => {
      whyTextarea.value = savedAnswers.whyAnswer;
      const timestamp = new Date(savedAnswers.timestamp).toLocaleString('ko-KR');
      alert(`이전 답변을 불러왔습니다.\n저장 시간: ${timestamp}`);
    });
  }

  // 이전 피드백 보기
  if (savedFeedback && savedFeedback.whyResult) {
    viewFeedbackBtn.style.display = 'block';
    viewFeedbackBtn.addEventListener('click', () => {
      const result = savedFeedback.whyResult;
      feedbackArea.innerHTML = `
        <div class="feedback-result bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-6 space-y-4 mt-4">
          <div class="score-header flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 class="text-xl font-bold text-gray-800 dark:text-gray-200">저장된 피드백 (Step 1)</h4>
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
            <h5 class="font-bold text-purple-700 dark:text-purple-300 mb-2">📚 모범 답안</h5>
            <p class="text-sm text-purple-700 dark:text-purple-200 leading-relaxed bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg" style="font-family: 'Iropke Batang', serif;">
              ${kamUIState.currentCase.reason}
            </p>
          </div>

          <div class="flex justify-between gap-3 pt-4">
            <button onclick="this.closest('.feedback-result').remove()" class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors">
              닫기
            </button>
            <button id="btn-next-step-saved" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
              다음 단계로 (감사 절차 작성) →
            </button>
          </div>
        </div>
      `;

      // 다음 단계 버튼 이벤트
      const nextStepBtn = feedbackArea.querySelector('#btn-next-step-saved');
      if (nextStepBtn) {
        nextStepBtn.addEventListener('click', () => {
          kamUIState.currentStep = 'how';
          renderStepHow(container, apiKey, selectedModel);
        });
      }
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

  // 네비게이션에서 다음 단계 버튼 (채점 건너뛰기)
  container.querySelector('#btn-skip-to-how-nav').addEventListener('click', () => {
    const answer = whyTextarea.value.trim();
    // 답안이 비어있어도 다음 단계로 진행 가능 (요구사항에 따라)
    kamUIState.whyAnswer = answer;
    if (answer) {
      kamUIState.saveAnswersToLocal(kamCase.num);
    }
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

  // 자동으로 저장된 피드백 표시 (이전 단계로 돌아왔을 때)
  const whyResult = kamUIState.whyResult || savedFeedback?.whyResult;
  if (whyResult) {
    feedbackArea.innerHTML = `
      <div class="feedback-result bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-6 space-y-4">
        <div class="score-header flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <h4 class="text-xl font-bold text-gray-800 dark:text-gray-200">Step 1 평가 결과</h4>
          <div class="score-badge text-3xl font-bold ${whyResult.score >= 80 ? 'text-green-600' : whyResult.score >= 60 ? 'text-yellow-600' : 'text-red-600'}">
            ${whyResult.score}점
          </div>
        </div>

        <div class="feedback-text text-gray-700 dark:text-gray-300 leading-relaxed" style="font-family: 'Iropke Batang', serif; white-space: pre-wrap;">
          ${whyResult.feedback}
        </div>

        ${whyResult.strengths && whyResult.strengths.length > 0 ? `
          <div class="strengths bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h5 class="font-bold text-green-700 dark:text-green-400 mb-2">✅ 잘한 점</h5>
            <ul class="list-disc list-inside space-y-1 text-sm text-green-600 dark:text-green-300">
              ${whyResult.strengths.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${whyResult.improvements && whyResult.improvements.length > 0 ? `
          <div class="improvements bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h5 class="font-bold text-yellow-700 dark:text-yellow-400 mb-2">💡 개선할 점</h5>
            <ul class="list-disc list-inside space-y-1 text-sm text-yellow-600 dark:text-yellow-300">
              ${whyResult.improvements.map(i => `<li>${i}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="model-answer bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <h5 class="font-bold text-purple-700 dark:text-purple-300 mb-2">📚 모범 답안</h5>
          <p class="text-sm text-purple-700 dark:text-purple-200 leading-relaxed bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg" style="font-family: 'Iropke Batang', serif;">
            ${kamUIState.currentCase.reason}
          </p>
        </div>

        <div class="flex flex-col items-end gap-2 pt-4">
          <span class="text-xs text-gray-500 dark:text-gray-400">
            ⌨️ 단축키: <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+→</kbd> 다음 단계
          </span>
          <button id="btn-next-step" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
            다음 단계로 (감사 절차 작성) →
          </button>
        </div>
      </div>
    `;

    // 다음 단계 버튼 이벤트
    const nextStepBtn = feedbackArea.querySelector('#btn-next-step');
    if (nextStepBtn) {
      nextStepBtn.addEventListener('click', () => {
        kamUIState.currentStep = 'how';
        renderStepHow(container, apiKey, selectedModel);
      });
    }
  }
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
    <div class="space-y-4">
      <div id="loading-spinner" class="flex justify-center items-center py-8">
        <div class="loader"></div>
        <span class="ml-3 text-gray-600 dark:text-gray-400">AI가 답안을 평가하고 있습니다...</span>
      </div>

      <!-- 모범 답안 미리 표시 -->
      <div class="model-answer bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <h5 class="font-bold text-purple-700 dark:text-purple-300 mb-2">📚 모범 답안 - 선정 이유</h5>
        <p class="text-sm text-gray-800 dark:text-gray-100 leading-relaxed bg-white dark:bg-gray-700 p-4 rounded-lg" style="font-family: 'Iropke Batang', serif;">
          ${kamUIState.currentCase.reason}
        </p>
      </div>
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

    const caseNum = kamUIState.currentCase?.num;
    if (caseNum) {
      kamUIState.saveFeedbackToLocal(caseNum, { whyResult: result });
    }

    // 랭킹 시스템 업데이트 (Step 1 - Why 채점 완료)
    const user = auth.currentUser;
    if (user) {
      console.log('📊 [KAM Step 1] 랭킹 통계 업데이트 시작...');

      // 개인 랭킹 업데이트 (문제 수, 점수, AP)
      updateUserStats(user.uid, result.score)
        .then(apResult => {
          if (apResult.success) {
            console.log('   - ✅ KAM Step 1 개인 랭킹 업데이트 성공');
          } else {
            console.warn('   - ⚠️ KAM Step 1 개인 랭킹 업데이트 실패:', apResult.message);
          }
        })
        .catch(err => {
          console.error('   - ❌ KAM Step 1 개인 랭킹 업데이트 에러:', err);
        });

      // 그룹 랭킹 업데이트
      console.log('📊 [KAM Step 1] 그룹 랭킹 통계 업데이트 시작...');
      getMyGroups()
        .then(groups => {
          if (groups && groups.length > 0) {
            console.log(`   - 📋 ${groups.length}개 그룹 발견`);
            groups.forEach(group => {
              updateGroupStats(group.groupId, user.uid, result.score)
                .then(result => {
                  if (result.success) {
                    console.log(`   - ✅ 그룹 "${group.name}" 통계 업데이트 성공`);
                  } else {
                    console.warn(`   - ⚠️ 그룹 "${group.name}" 통계 업데이트 실패:`, result.message);
                  }
                })
                .catch(err => {
                  console.error(`   - ❌ 그룹 "${group.name}" 통계 업데이트 에러:`, err);
                });
            });
          } else {
            console.log('   - ℹ️ 가입한 그룹이 없습니다.');
          }
        })
        .catch(err => {
          console.error('   - ❌ 그룹 목록 조회 에러:', err);
        });

      // 대학교 랭킹 업데이트
      console.log('🎓 [KAM Step 1] 대학교 랭킹 통계 업데이트 시작...');
      updateUniversityStats(user.uid, result.score)
        .then(result => {
          if (result.success) {
            console.log('   - ✅ 대학교 통계 업데이트 성공');
          } else {
            console.log(`   - ℹ️ 대학교 통계 업데이트: ${result.message}`);
          }
        })
        .catch(err => {
          console.error('   - ❌ 대학교 통계 업데이트 에러:', err);
        });
    }

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
          <h5 class="font-bold text-purple-700 dark:text-purple-300 mb-2">📚 모범 답안</h5>
          <p class="text-sm text-purple-700 dark:text-purple-200 leading-relaxed bg-purple-50 dark:bg-purple-900/30 p-3 rounded-lg" style="font-family: 'Iropke Batang', serif;">
            ${kamUIState.currentCase.reason}
          </p>
        </div>

        <div class="flex flex-col items-end gap-2 pt-4">
          <span class="text-xs text-gray-500 dark:text-gray-400">
            ⌨️ 단축키: <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+→</kbd> 다음 단계
          </span>
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
      <div class="case-info bg-purple-50 dark:bg-gray-800 border border-purple-200 dark:border-gray-600 rounded-lg p-5">
        <div class="flex items-start gap-3 mb-3">
          <span class="text-xs px-2 py-1 bg-purple-200 dark:bg-purple-600 text-purple-800 dark:text-white rounded font-bold">
            사례 ${kamCase.num}
          </span>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded">
            ${kamCase.industry}
          </span>
          <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded">
            ${kamCase.size}
          </span>
        </div>
        <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-3 bg-white dark:bg-gray-900 p-3 rounded-lg">${kamCase.kam}</h3>
        <div class="situation-text bg-white dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-4" style="font-family: 'Iropke Batang', serif;">
          ${kamCase.situation}
        </div>
        <div class="hint-area border-t border-purple-200 dark:border-gray-600 pt-4">
          <h5 class="font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
            <span>💡</span> 참고: 선정 이유 (모범 답안)
          </h5>
          <p class="text-sm text-purple-700 dark:text-gray-200 leading-relaxed bg-purple-50 dark:bg-gray-900 p-3 rounded-lg" style="font-family: 'Iropke Batang', serif;">
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
          <div class="flex gap-2">
            <button id="btn-load-saved-how" class="text-xs px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded transition-colors" style="display: none;">
              📂 이전 답변 불러오기
            </button>
            <button id="btn-view-feedback-how" class="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded transition-colors" style="display: none;">
              📋 이전 피드백 보기
            </button>
          </div>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          위 위험에 대응하기 위한 <strong>핵심 감사절차 3가지 이상</strong>을 서술하시오.
          <br>
          <span class="text-xs text-purple-600 dark:text-purple-400">
            💡 Tip: 내부통제 평가, 가정의 합리성 검토(민감도 분석), 전문가 활용, 문서 검사 및 재계산 등을 포함하세요.
          </span>
          <br>
          <span class="text-xs text-gray-500 dark:text-gray-400 mt-2 inline-block">
            ⌨️ 단축키: <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Enter</kbd> 제출 | <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+←</kbd> 이전 단계 | <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Shift+L</kbd> 이전 답변
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

  // 저장된 답변 및 피드백 확인
  const savedAnswers = kamUIState.loadAnswersFromLocal(kamCase.num);
  const savedFeedback = kamUIState.loadFeedbackFromLocal(kamCase.num);
  const loadBtnHow = container.querySelector('#btn-load-saved-how');
  const viewFeedbackBtnHow = container.querySelector('#btn-view-feedback-how');
  const howTextarea = container.querySelector('#how-answer');
  const feedbackArea = container.querySelector('#feedback-area');

  console.log('[KAM Step 2] 저장된 답변 확인:', {
    caseNum: kamCase.num,
    savedAnswers,
    hasHowAnswer: !!(savedAnswers && savedAnswers.howAnswer),
    howAnswerLength: savedAnswers?.howAnswer?.length || 0,
    howAnswerValue: savedAnswers?.howAnswer
  });

  // 이전 답변 불러오기
  if (savedAnswers && savedAnswers.howAnswer && savedAnswers.howAnswer.trim()) {
    loadBtnHow.style.display = 'block';
    loadBtnHow.addEventListener('click', () => {
      howTextarea.value = savedAnswers.howAnswer;
      const timestamp = new Date(savedAnswers.timestamp).toLocaleString('ko-KR');
      alert(`이전 답변을 불러왔습니다.\n저장 시간: ${timestamp}`);
    });
  }

  // 이전 피드백 보기
  if (savedFeedback && savedFeedback.howResult) {
    viewFeedbackBtnHow.style.display = 'block';
    viewFeedbackBtnHow.addEventListener('click', () => {
      const result = savedFeedback.howResult;
      feedbackArea.innerHTML = `
        <div class="feedback-result bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-6 space-y-4 mt-4">
          <div class="score-header flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 class="text-xl font-bold text-gray-800 dark:text-gray-200">저장된 피드백 (Step 2)</h4>
            <div class="score-badge text-3xl font-bold ${result.score >= 80 ? 'text-green-600' : result.score >= 60 ? 'text-yellow-600' : 'text-red-600'}">
              ${result.score}점
            </div>
          </div>

          <div class="feedback-text text-gray-700 dark:text-gray-300 leading-relaxed" style="font-family: 'Iropke Batang', serif; white-space: pre-wrap;">
            ${result.feedback}
          </div>

          ${result.gapAnalysis && result.gapAnalysis.length > 0 ? `
            <div class="gap-analysis bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h5 class="font-bold text-red-700 dark:text-red-400 mb-2">⚠️ Gap Analysis (누락된 핵심 절차)</h5>
              <div class="space-y-3">
                ${result.gapAnalysis.map(gap => `
                  <div class="text-sm">
                    <p class="font-semibold text-red-600 dark:text-red-300 mb-1">❌ ${gap.missingProcedure}</p>
                    <p class="text-red-700 dark:text-red-200 mb-1"><strong>중요성:</strong> ${gap.importance}</p>
                    <p class="text-red-600 dark:text-red-300"><strong>제안:</strong> ${gap.suggestion}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

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

          ${result.badPatterns && result.badPatterns.length > 0 ? `
            <div class="bad-patterns bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h5 class="font-bold text-orange-700 dark:text-orange-400 mb-2">🚫 감지된 오답 패턴</h5>
              <ul class="list-disc list-inside space-y-1 text-sm text-orange-600 dark:text-orange-300">
                ${result.badPatterns.map(bp => `<li>${bp}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="model-answer bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h5 class="font-bold text-purple-700 dark:text-purple-300 mb-2">📚 모범 답안 - 감사 절차</h5>
            <ol class="list-decimal list-inside space-y-1 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 p-4 rounded-lg" style="font-family: 'Iropke Batang', serif;">
              ${kamCase.procedures.map(p => `<li>${p}</li>`).join('')}
            </ol>
          </div>

          <div class="flex justify-between items-end gap-3 pt-4">
            <button onclick="this.closest('.feedback-result').remove()" class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors">
              닫기
            </button>
            <div class="flex flex-col items-end gap-2">
              <span class="text-xs text-gray-500 dark:text-gray-400">
                ⌨️ 단축키: <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+→</kbd> 종합 평가
              </span>
              <button id="btn-view-final-saved" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
                종합 평가 보기 →
              </button>
            </div>
          </div>
        </div>
      `;

      // 종합 평가 보기 버튼 이벤트
      const viewFinalBtn = feedbackArea.querySelector('#btn-view-final-saved');
      if (viewFinalBtn) {
        viewFinalBtn.addEventListener('click', () => {
          const finalScore = kamEvaluationService.calculateFinalScore(
            kamUIState.whyResult,
            kamUIState.howResult
          );
          renderFinalResult(container, finalScore, apiKey, selectedModel);
        });
      }
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

  // 자동으로 저장된 피드백 표시 (최종 결과에서 돌아왔을 때)
  const howResult = kamUIState.howResult || savedFeedback?.howResult;
  if (howResult) {
    feedbackArea.innerHTML = `
      <div class="feedback-result bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-6 space-y-4">
        <div class="score-header flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <h4 class="text-xl font-bold text-gray-800 dark:text-gray-200">Step 2 평가 결과</h4>
          <div class="score-badge text-3xl font-bold ${howResult.score >= 80 ? 'text-green-600' : howResult.score >= 60 ? 'text-yellow-600' : 'text-red-600'}">
            ${howResult.score}점
          </div>
        </div>

        <div class="feedback-text text-gray-700 dark:text-gray-300 leading-relaxed" style="font-family: 'Iropke Batang', serif; white-space: pre-wrap;">
          ${howResult.feedback}
        </div>

        ${howResult.gapAnalysis && howResult.gapAnalysis.length > 0 ? `
          <div class="gap-analysis bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h5 class="font-bold text-red-700 dark:text-red-400 mb-2">⚠️ Gap Analysis (누락된 핵심 절차)</h5>
            <div class="space-y-3">
              ${howResult.gapAnalysis.map(gap => `
                <div class="text-sm">
                  <p class="font-semibold text-red-600 dark:text-red-300 mb-1">❌ ${gap.missingProcedure}</p>
                  <p class="text-red-700 dark:text-red-200 mb-1"><strong>중요성:</strong> ${gap.importance}</p>
                  <p class="text-red-600 dark:text-red-300"><strong>제안:</strong> ${gap.suggestion}</p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${howResult.strengths && howResult.strengths.length > 0 ? `
          <div class="strengths bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h5 class="font-bold text-green-700 dark:text-green-400 mb-2">✅ 잘한 점</h5>
            <ul class="list-disc list-inside space-y-1 text-sm text-green-600 dark:text-green-300">
              ${howResult.strengths.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${howResult.improvements && howResult.improvements.length > 0 ? `
          <div class="improvements bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h5 class="font-bold text-yellow-700 dark:text-yellow-400 mb-2">💡 개선할 점</h5>
            <ul class="list-disc list-inside space-y-1 text-sm text-yellow-600 dark:text-yellow-300">
              ${howResult.improvements.map(i => `<li>${i}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${howResult.badPatterns && howResult.badPatterns.length > 0 ? `
          <div class="bad-patterns bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <h5 class="font-bold text-orange-700 dark:text-orange-400 mb-2">🚫 감지된 오답 패턴</h5>
            <ul class="list-disc list-inside space-y-1 text-sm text-orange-600 dark:text-orange-300">
              ${howResult.badPatterns.map(bp => `<li>${bp}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="model-answer bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <h5 class="font-bold text-purple-700 dark:text-purple-300 mb-2">📚 모범 답안 - 감사 절차</h5>
          <ol class="list-decimal list-inside space-y-1 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 p-4 rounded-lg" style="font-family: 'Iropke Batang', serif;">
            ${kamCase.procedures.map(p => `<li>${p}</li>`).join('')}
          </ol>
        </div>

        <div class="flex flex-col items-end gap-2 pt-4">
          <span class="text-xs text-gray-500 dark:text-gray-400">
            ⌨️ 단축키: <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+→</kbd> 종합 평가
          </span>
          <button id="btn-view-final" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
            종합 평가 보기 →
          </button>
        </div>
      </div>
    `;

    // 종합 평가 보기 버튼 이벤트
    const viewFinalBtn = feedbackArea.querySelector('#btn-view-final');
    if (viewFinalBtn) {
      viewFinalBtn.addEventListener('click', () => {
        const finalScore = kamEvaluationService.calculateFinalScore(
          kamUIState.whyResult,
          kamUIState.howResult
        );
        renderFinalResult(container, finalScore, apiKey, selectedModel);
      });
    }
  }
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
    <div class="space-y-4">
      <div class="flex justify-center items-center py-8">
        <div class="loader"></div>
        <span class="ml-3 text-gray-600 dark:text-gray-400">AI가 최종 평가를 진행하고 있습니다...</span>
      </div>

      <!-- 모범 답안 미리 표시 -->
      <div class="model-answer bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <h5 class="font-bold text-purple-700 dark:text-purple-300 mb-2">📚 모범 답안 - 감사 절차</h5>
        <ol class="list-decimal list-inside space-y-1 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 p-4 rounded-lg" style="font-family: 'Iropke Batang', serif;">
          ${kamUIState.currentCase.procedures.map(p => `<li>${p}</li>`).join('')}
        </ol>
      </div>
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

    const caseNum = kamUIState.currentCase?.num;
    if (caseNum) {
      kamUIState.saveFeedbackToLocal(caseNum, { howResult: result });
    }

    // 랭킹 시스템 업데이트 (Step 2 - How 채점 완료)
    const user = auth.currentUser;
    if (user) {
      console.log('📊 [KAM Step 2] 랭킹 통계 업데이트 시작...');

      // 개인 랭킹 업데이트 (문제 수, 점수, AP)
      updateUserStats(user.uid, result.score)
        .then(apResult => {
          if (apResult.success) {
            console.log('   - ✅ KAM Step 2 개인 랭킹 업데이트 성공');
          } else {
            console.warn('   - ⚠️ KAM Step 2 개인 랭킹 업데이트 실패:', apResult.message);
          }
        })
        .catch(err => {
          console.error('   - ❌ KAM Step 2 개인 랭킹 업데이트 에러:', err);
        });

      // 그룹 랭킹 업데이트
      console.log('📊 [KAM Step 2] 그룹 랭킹 통계 업데이트 시작...');
      getMyGroups()
        .then(groups => {
          if (groups && groups.length > 0) {
            console.log(`   - 📋 ${groups.length}개 그룹 발견`);
            groups.forEach(group => {
              updateGroupStats(group.groupId, user.uid, result.score)
                .then(result => {
                  if (result.success) {
                    console.log(`   - ✅ 그룹 "${group.name}" 통계 업데이트 성공`);
                  } else {
                    console.warn(`   - ⚠️ 그룹 "${group.name}" 통계 업데이트 실패:`, result.message);
                  }
                })
                .catch(err => {
                  console.error(`   - ❌ 그룹 "${group.name}" 통계 업데이트 에러:`, err);
                });
            });
          } else {
            console.log('   - ℹ️ 가입한 그룹이 없습니다.');
          }
        })
        .catch(err => {
          console.error('   - ❌ 그룹 목록 조회 에러:', err);
        });

      // 대학교 랭킹 업데이트
      console.log('🎓 [KAM Step 2] 대학교 랭킹 통계 업데이트 시작...');
      updateUniversityStats(user.uid, result.score)
        .then(result => {
          if (result.success) {
            console.log('   - ✅ 대학교 통계 업데이트 성공');
          } else {
            console.log(`   - ℹ️ 대학교 통계 업데이트: ${result.message}`);
          }
        })
        .catch(err => {
          console.error('   - ❌ 대학교 통계 업데이트 에러:', err);
        });
    }

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

  // 점수 저장 (로컬 + Firestore)
  const whyScore = whyResult ? whyResult.score : 0;
  const howScore = howResult ? howResult.score : 0;
  await kamUIState.saveScoreToLocal(kamCase.num, finalScore.finalScore, whyScore, howScore);
  kamUIState.saveFeedbackToLocal(kamCase.num, {
    whyResult: whyResult || null,
    howResult: howResult || null,
    finalSummary: finalScore
  });

  // 초기 화면 렌더링 (관련 기준서 없이)
  container.innerHTML = `
    <div class="final-result-container space-y-6">
      <!-- 헤더 -->
      <div class="flex items-center justify-between mb-4">
        <button id="btn-back-to-step2" class="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 font-medium">
          ← 이전 단계
        </button>
        <div class="text-sm text-gray-500 dark:text-gray-400">Step 2/2</div>
      </div>

      <div class="mb-4">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200">
          🎯 종합 평가 결과
        </h2>
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
        <div class="why-feedback bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 space-y-4">
          <h4 class="font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
            <span>💭</span> Step 1: 선정 이유 (${whyScore}점)
          </h4>
          <div class="text-sm text-gray-700 dark:text-gray-200 leading-relaxed" style="font-family: 'Iropke Batang', serif; white-space: pre-wrap;">
            ${whyResult.feedback}
          </div>

          ${whyResult.strengths && whyResult.strengths.length > 0 ? `
            <div class="strengths bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h5 class="font-bold text-green-700 dark:text-green-400 mb-2">✅ 잘한 점</h5>
              <ul class="list-disc list-inside space-y-1 text-sm text-green-600 dark:text-green-300">
                ${whyResult.strengths.map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${whyResult.improvements && whyResult.improvements.length > 0 ? `
            <div class="improvements bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h5 class="font-bold text-yellow-700 dark:text-yellow-400 mb-2">💡 개선할 점</h5>
              <ul class="list-disc list-inside space-y-1 text-sm text-yellow-600 dark:text-yellow-300">
                ${whyResult.improvements.map(i => `<li>${i}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${whyResult.badPatterns && whyResult.badPatterns.length > 0 ? `
            <div class="bad-patterns bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h5 class="font-bold text-orange-700 dark:text-orange-400 mb-2">🚫 감지된 오답 패턴</h5>
              <ul class="list-disc list-inside space-y-1 text-sm text-orange-600 dark:text-orange-300">
                ${whyResult.badPatterns.map(bp => `<li>${bp}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        ` : `
        <!-- Why 건너뜀 안내 -->
        <div class="why-feedback bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h4 class="font-bold text-yellow-700 dark:text-yellow-400 mb-2 flex items-center gap-2">
            <span>⚠️</span> Step 1: 선정 이유 (채점 건너뜀)
          </h4>
          <div class="text-sm text-yellow-700 dark:text-yellow-300 leading-relaxed">
            Step 1을 채점하지 않고 건너뛰었습니다. 종합 점수는 Step 2만으로 계산되었습니다.
          </div>
        </div>
        `}

        <!-- How 결과 -->
        <div class="how-feedback bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 space-y-4">
          <h4 class="font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
            <span>🔍</span> Step 2: 감사 절차 (${howScore}점)
          </h4>
          <div class="text-sm text-gray-700 dark:text-gray-200 leading-relaxed" style="font-family: 'Iropke Batang', serif; white-space: pre-wrap;">
            ${howResult.feedback}
          </div>

          ${howResult.gapAnalysis && howResult.gapAnalysis.length > 0 ? `
            <div class="gap-analysis bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h5 class="font-bold text-red-700 dark:text-red-400 mb-2">⚠️ Gap Analysis (누락된 핵심 절차)</h5>
              <div class="space-y-3">
                ${howResult.gapAnalysis.map(gap => `
                  <div class="text-sm">
                    <p class="font-semibold text-red-600 dark:text-red-300 mb-1">❌ ${gap.missingProcedure}</p>
                    <p class="text-red-700 dark:text-red-200 mb-1"><strong>중요성:</strong> ${gap.importance}</p>
                    <p class="text-red-600 dark:text-red-300"><strong>제안:</strong> ${gap.suggestion}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${howResult.strengths && howResult.strengths.length > 0 ? `
            <div class="strengths bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h5 class="font-bold text-green-700 dark:text-green-400 mb-2">✅ 잘한 점</h5>
              <ul class="list-disc list-inside space-y-1 text-sm text-green-600 dark:text-green-300">
                ${howResult.strengths.map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${howResult.improvements && howResult.improvements.length > 0 ? `
            <div class="improvements bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h5 class="font-bold text-yellow-700 dark:text-yellow-400 mb-2">💡 개선할 점</h5>
              <ul class="list-disc list-inside space-y-1 text-sm text-yellow-600 dark:text-yellow-300">
                ${howResult.improvements.map(i => `<li>${i}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${howResult.badPatterns && howResult.badPatterns.length > 0 ? `
            <div class="bad-patterns bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h5 class="font-bold text-orange-700 dark:text-orange-400 mb-2">🚫 감지된 오답 패턴</h5>
              <ul class="list-disc list-inside space-y-1 text-sm text-orange-600 dark:text-orange-300">
                ${howResult.badPatterns.map(bp => `<li>${bp}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- 모범 답안 -->
      <div class="model-answers bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 space-y-4">
        <h4 class="font-bold text-purple-700 dark:text-purple-300 text-lg mb-4">📚 모범 답안</h4>

        <div class="model-why">
          <h5 class="font-bold text-sm text-purple-700 dark:text-purple-200 mb-2">선정 이유 (Why)</h5>
          <p class="text-sm text-gray-800 dark:text-gray-100 leading-relaxed bg-white dark:bg-gray-700 p-4 rounded-lg" style="font-family: 'Iropke Batang', serif;">
            ${kamCase.reason}
          </p>
        </div>

        <div class="model-how">
          <h5 class="font-bold text-sm text-purple-700 dark:text-purple-200 mb-2">감사 절차 (How)</h5>
          <ol class="list-decimal list-inside space-y-1 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 p-4 rounded-lg" style="font-family: 'Iropke Batang', serif;">
            ${kamCase.procedures.map(p => `<li>${p}</li>`).join('')}
          </ol>
        </div>
      </div>

      <!-- 관련 기준서 카드 (수동 로딩) -->
      <div id="related-standards-container" class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h4 class="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <span>📖</span> 관련 회계감사기준서
          </h4>
          <button id="btn-load-standards" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors">
            관련 기준서 불러오기
          </button>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          버튼을 눌러 관련 기준서를 수동으로 불러오세요. 기준서 전문과 단원/표시번호가 함께 제공됩니다.
        </p>
        <div id="related-standards-results" class="mt-4" style="display: none;"></div>
      </div>

      <!-- 액션 버튼 -->
      <div class="flex flex-col sm:flex-row justify-between gap-4 pt-4">
        <button id="btn-exit-kam-final" class="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors">
          ← 사례 종료
        </button>
        <div class="flex flex-wrap gap-3">
          <button id="btn-next-case" class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors">
            다음 사례 풀기 →
          </button>
          <button id="btn-retry" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
            이 사례 다시 풀기
          </button>
          <button id="btn-list" class="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-lg transition-colors">
            사례 목록으로
          </button>
        </div>
      </div>
    </div>
  `;

  // 이벤트 리스너
  container.querySelector('#btn-back-to-step2').addEventListener('click', () => {
    kamUIState.currentStep = 'how';
    renderStepHow(container, apiKey, selectedModel);
  });

  container.querySelector('#btn-exit-kam-final').addEventListener('click', () => {
    if (confirm('사례 모드를 종료하고 퀴즈 모드로 돌아가시겠습니까?')) {
      exitKAMMode();
    }
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

  container.querySelector('#btn-next-case').addEventListener('click', () => {
    // 다음 사례 찾기
    const allCases = kamEvaluationService.getAllCases();
    const currentCaseNum = kamCase.num;
    const nextCase = allCases.find(c => c.num === currentCaseNum + 1);

    if (nextCase) {
      // 다음 사례로 이동
      kamUIState.reset();
      kamUIState.currentCase = nextCase;
      kamUIState.currentStep = 'why';
      renderStepWhy(container, apiKey, selectedModel);
    } else {
      // 마지막 사례
      alert(`축하합니다! 사례 ${currentCaseNum}이(가) 마지막 사례입니다.\n사례 목록으로 돌아가서 다른 사례를 선택하세요.`);
    }
  });

  const loadStandardsBtn = container.querySelector('#btn-load-standards');
  const standardsResultContainer = container.querySelector('#related-standards-results');

  if (loadStandardsBtn && standardsResultContainer) {
    loadStandardsBtn.addEventListener('click', async () => {
      loadStandardsBtn.disabled = true;
      loadStandardsBtn.innerHTML = '<div class="loader inline-block mr-2"></div> 불러오는 중...';

      standardsResultContainer.style.display = 'block';
      standardsResultContainer.innerHTML = `
        <div class="flex justify-center items-center py-6">
          <div class="loader"></div>
          <span class="ml-3 text-gray-600 dark:text-gray-400">관련 기준서를 불러오는 중입니다...</span>
        </div>
      `;

      try {
        // 우선순위에 따른 검색 텍스트 구성
        // 1. 모범답안의 감사절차 (최우선)
        const proceduresText = kamCase.procedures.join(' ');
        // 2. 모범답안의 선정 이유 및 KAM 제목
        const reasonText = `${kamCase.reason} ${kamCase.kam}`;
        // 3. 사용자 답안 (부가적)
        const userAnswersText = [kamUIState.whyAnswer, kamUIState.howAnswer].filter(Boolean).join(' ');
        // 4. 상황 설명 (부가적)
        const situationText = kamCase.situation;

        // 가중치를 적용한 검색을 위해 우선순위별로 검색 수행
        const relatedStandards = searchWithPriority(
          ragSearchService,
          proceduresText,
          reasonText,
          userAnswersText,
          situationText,
          5
        );

        if (!relatedStandards || relatedStandards.length === 0) {
          standardsResultContainer.innerHTML = `
            <p class="text-sm text-gray-600 dark:text-gray-400">
              관련 기준서를 찾을 수 없습니다. 필요시 다른 키워드로 다시 시도해보세요.
            </p>
          `;
        } else {
          const cardsHtml = relatedStandards.map((std, idx) => {
            const chapter = std?.['단원'] ?? '-';
            const displayNo = std?.['표시번호'] ?? '-';
            const question = std?.물음
              ? `<p class="mt-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">${std.물음}</p>`
              : '';
            const answer = std?.정답 ?? '정답 정보가 없습니다.';
            const title = std?.problemTitle || '제목 없음';
            return `
              <article class="standard-card bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 font-semibold">단원 ${chapter} · 표시번호 ${displayNo}</p>
                    <h5 class="mt-1 font-bold text-sm text-gray-800 dark:text-gray-200">${title}</h5>
                  </div>
                  <span class="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded font-bold flex-shrink-0">${idx + 1}</span>
                </div>
                ${question}
                <div class="mt-2 text-sm text-gray-800 dark:text-gray-100 leading-relaxed bg-white dark:bg-gray-800 p-3 rounded" style="font-family: 'Iropke Batang', serif; word-break: keep-all;">
                  ${answer}
                </div>
              </article>
            `;
          }).join('');

          standardsResultContainer.innerHTML = `
            <div class="space-y-4">
              ${cardsHtml}
            </div>
          `;
        }
      } catch (error) {
        console.error('관련 기준서 검색 실패:', error);
        standardsResultContainer.innerHTML = `
          <p class="text-sm text-red-600 dark:text-red-400">
            기준서 검색 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}
          </p>
        `;
      } finally {
        loadStandardsBtn.disabled = false;
        loadStandardsBtn.innerHTML = '관련 기준서 다시 불러오기';
      }
    });
  }
}

export default {
  renderKAMUI,
  kamUIState,
  cleanupKAMMode
};
