/**
 * Past Exam UI
 * 기출문제 실전 모의고사 UI
 */

import { examService } from './examService.js';

/**
 * UI 상태 관리
 */
const examUIState = {
  currentYear: null,
  currentCaseId: null,
  startTime: null,
  timerInterval: null,
  answers: {},

  reset() {
    this.currentYear = null;
    this.currentCaseId = null;
    this.startTime = null;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.answers = {};
  }
};

/**
 * 메인 진입점
 */
export function renderExamMode(container, apiKey, selectedModel) {
  console.log('🔑 [examUI.js] renderExamMode - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');

  if (!container) {
    console.error('Exam UI container not found');
    return;
  }

  examUIState.reset();
  renderYearSelection(container, apiKey, selectedModel);
}

/**
 * 연도 선택 화면
 */
function renderYearSelection(container, apiKey, selectedModel) {
  console.log('🔑 [examUI.js] renderYearSelection - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');

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

  const metadata = examService.metadata;
  const years = Object.keys(metadata).sort((a, b) => b - a); // 최신 순

  container.innerHTML = `
    <div class="exam-selection-container max-w-5xl mx-auto p-6">
      <div class="mb-6">
        <h2 class="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          📝 기출문제 실전연습
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          실제 시험처럼 90분 제한 시간 안에 문제를 풀어보세요.
        </p>
      </div>

      <!-- 연도 카드 그리드 -->
      <div class="year-cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${years.map(year => {
          const meta = metadata[year];
          const scores = examService.getScores(year);
          const bestScore = examService.getBestScore(year);
          const latestAttempt = scores.length;

          return `
            <div class="year-card bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl p-6 hover:border-purple-500 dark:hover:border-purple-400 transition-all cursor-pointer shadow-sm hover:shadow-lg"
                 data-year="${year}">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-2xl font-bold text-purple-700 dark:text-purple-400">${year}년</h3>
                ${bestScore !== null ? `
                  <span class="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-bold rounded-full">
                    최고 ${bestScore}점
                  </span>
                ` : ''}
              </div>

              <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div class="flex items-center gap-2">
                  <span>⏱️ 제한시간: ${meta.timeLimit}분</span>
                </div>
                <div class="flex items-center gap-2">
                  <span>📊 총 ${examService.getTotalScore(year)}점 (${examService.getTotalQuestions(year)}문제)</span>
                </div>
                <div class="flex items-center gap-2">
                  <span>✅ 합격기준: ${meta.passingScore}점</span>
                </div>
                ${latestAttempt > 0 ? `
                  <div class="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    <span>🔄 ${latestAttempt}회 응시</span>
                  </div>
                ` : ''}
              </div>

              <button class="mt-4 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
                ${latestAttempt > 0 ? '다시 풀기' : '시작하기'} →
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <!-- 안내 사항 -->
      <div class="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <h4 class="font-bold text-yellow-800 dark:text-yellow-300 mb-2">⚠️ 유의사항</h4>
        <ul class="text-sm text-yellow-700 dark:text-yellow-200 space-y-1 list-disc list-inside">
          <li>실전처럼 90분 동안 집중해서 풀어주세요.</li>
          <li>답안은 자동으로 저장되며, 중간에 나가도 이어서 풀 수 있습니다.</li>
          <li>최종 제출 후 AI가 채점하고 상세 피드백을 제공합니다.</li>
          <li>재응시는 횟수 제한 없이 가능하며, 점수 히스토리가 저장됩니다.</li>
        </ul>
      </div>
    </div>
  `;

  // 이벤트 리스너
  container.querySelectorAll('.year-card').forEach(card => {
    card.addEventListener('click', () => {
      const year = parseInt(card.dataset.year, 10);
      startExam(container, year, apiKey, selectedModel);
    });
  });
}

/**
 * 시험 시작
 */
function startExam(container, year, apiKey, selectedModel) {
  console.log('🔑 [examUI.js] startExam - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');

  examUIState.currentYear = year;

  // 기존 답안 불러오기 또는 초기화
  const existingAnswers = examService.getUserAnswers(year);
  const hasExistingAnswers = Object.keys(existingAnswers).length > 0;

  if (hasExistingAnswers) {
    // 이어서 풀기 vs 처음부터 풀기
    if (confirm('이전에 작성하던 답안이 있습니다.\n\n[확인] 이어서 풀기\n[취소] 처음부터 다시 풀기')) {
      examUIState.answers = existingAnswers;
    } else {
      examService.clearUserAnswers(year);
      examService.clearTimer(year);
      examUIState.answers = {};
    }
  }

  // 타이머 시작
  if (!examService.getTimerStart(year)) {
    examService.saveTimerStart(year);
  }

  // 전체화면 시험 모드 - 좌우 대시보드와 중앙 헤더 숨기기
  const leftDashboard = document.getElementById('left-dashboard');
  const rightDashboard = document.getElementById('right-explorer');
  const centerCore = document.getElementById('center-core');

  if (leftDashboard) {
    leftDashboard.style.display = 'none';
    leftDashboard.dataset.hiddenByExam = 'true';
  }

  if (rightDashboard) {
    rightDashboard.style.display = 'none';
    rightDashboard.dataset.hiddenByExam = 'true';
  }

  if (centerCore) {
    centerCore.style.display = 'none';
    centerCore.dataset.hiddenByExam = 'true';
  }

  renderExamPaper(container, year, apiKey, selectedModel);
}

/**
 * 시험지 화면 (Split View)
 */
function renderExamPaper(container, year, apiKey, selectedModel) {
  console.log('🔑 [examUI.js] renderExamPaper - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');

  const exams = examService.getExamByYear(year);
  const metadata = examService.getMetadata(year);
  const tempSaveData = examService.getTempSaveData(year);
  const lastTempSave = tempSaveData?.timestamp || 0;
  const now = Date.now();
  const canTempSave = (now - lastTempSave) >= 5 * 60 * 1000; // 5분

  container.innerHTML = `
    <div class="exam-paper-container min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <!-- Sticky Header -->
      <div id="exam-header" class="sticky top-0 z-40 bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-lg">
        <div class="w-full px-4 sm:px-6 lg:px-8 py-3">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <h3 class="text-lg sm:text-xl font-bold">${year}년 기출문제</h3>
              <span class="text-xs sm:text-sm opacity-90 px-2 sm:px-3 py-1 bg-white/20 rounded-full">총 ${examService.getTotalScore(year)}점</span>
            </div>
            <button
              id="btn-exit-exam-header"
              class="px-3 py-2 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm"
              title="기출문제 모드 종료"
            >
              <span>✕</span>
              <span class="hidden sm:inline">종료</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content: Centered with margins for FAB (오른쪽 여백 200px 확보) -->
      <div class="w-full px-4 sm:px-6 lg:pl-8 lg:pr-[240px] py-6">
        <div class="max-w-6xl mx-auto space-y-8">
            ${exams.map((exam, examIdx) => `
              <div id="case-${exam.id}" class="case-card bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden scroll-mt-20">
                <!-- Case 헤더 -->
                <div class="bg-gradient-to-r from-purple-700 to-indigo-700 px-6 py-3 text-white shadow-md">
                  <div class="flex items-center justify-between">
                    <h4 class="text-lg font-bold">문제 ${examIdx + 1}</h4>
                    <span class="text-sm bg-white/20 px-3 py-1 rounded-full font-semibold">
                      ${exam.questions.reduce((sum, q) => sum + q.score, 0)}점
                    </span>
                  </div>
                  <p class="text-sm opacity-90 mt-1">${exam.topic}</p>
                </div>

                <!-- Split View: 지문 (45%) | 물음들 (55%) - 강제 비율 유지 -->
                <div class="flex flex-row" style="min-height: 400px;">
                  <!-- 좌측: 지문 - flex-basis로 강제 고정 -->
                  <div style="flex: 0 0 45%; min-width: 0;" class="bg-gray-50 dark:bg-gray-900 border-r-2 border-gray-200 dark:border-gray-700 p-4 sm:p-6 overflow-y-auto max-h-screen">
                    <div class="mb-3">
                      <span class="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full mb-3">
                        📄 지문 (Scenario)
                      </span>
                    </div>
                    <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" style="font-family: 'Iropke Batang', serif;">${exam.scenario}</div>
                    ${exam.type ? `
                      <div class="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                        <span class="text-xs text-gray-500 dark:text-gray-400">유형: ${exam.type === 'Rule' ? '기준서(Rule)' : exam.type === 'Case' ? '사례(Case)' : '일반'}</span>
                      </div>
                    ` : ''}
                  </div>

                  <!-- 우측: 물음들 - flex-basis로 강제 고정 -->
                  <div style="flex: 0 0 55%; min-width: 0;" class="p-4 sm:p-6 overflow-y-auto max-h-screen">
                    <div class="space-y-6">
                      ${exam.questions.map((q, qIdx) => {
                        const tempScore = tempSaveData?.results?.[q.id];
                        return `
                        <div id="question-${q.id}" class="question-item border-2 border-gray-200 dark:border-gray-600 rounded-lg p-5 bg-white dark:bg-gray-800">
                          <!-- 물음 헤더 -->
                          <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-2">
                              <span class="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-bold rounded-full">
                                물음 ${q.id.replace('Q', '')}
                              </span>
                              <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded">
                                ${q.score}점
                              </span>
                            </div>
                            ${tempScore ? `
                              <span class="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                임시: ${tempScore.score.toFixed(1)}/${q.score}점
                              </span>
                            ` : ''}
                          </div>

                          <!-- 문제 -->
                          <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                            <p class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap" style="font-family: 'Iropke Batang', serif;">${q.question}</p>
                          </div>

                          <!-- 답안 입력 -->
                          <div>
                            <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                              ✍️ 답안 작성
                            </label>
                            <textarea
                              id="answer-${q.id}"
                              class="w-full h-40 p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 resize-y text-sm"
                              placeholder="답안을 입력하세요..."
                              data-question-id="${q.id}"
                              style="min-height: 120px;"
                            >${examUIState.answers[q.id]?.answer || ''}</textarea>
                            <div class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                              <span>💾 자동 저장됨</span>
                              <span id="char-count-${q.id}">0자</span>
                            </div>
                            ${tempScore ? `
                              <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <p class="text-xs text-blue-800 dark:text-blue-300 mb-1 font-semibold">💬 임시 피드백:</p>
                                <p class="text-xs text-blue-700 dark:text-blue-400">${tempScore.feedback || '피드백 없음'}</p>
                              </div>
                            ` : ''}
                          </div>
                        </div>
                      `}).join('')}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Floating Control Panel (Desktop - Always show for debugging) -->
      <div id="floating-controls" style="display: flex !important; position: fixed !important; top: 96px !important; right: 24px !important; z-index: 9999 !important;" class="flex-col gap-3 transition-all duration-300 w-[200px]">
        <!-- Timer Display -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-orange-500 dark:border-orange-600 p-4">
          <div class="text-center">
            <div class="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-2">⏱️ 남은 시간</div>
            <div id="timer-display" class="text-3xl font-mono font-bold text-orange-600 dark:text-orange-400">--:--</div>
          </div>
        </div>

        <!-- Quick Navigation - Collapsible -->
        <div id="nav-panel" class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-purple-500 dark:border-purple-600 overflow-hidden">
          <button id="toggle-nav" class="w-full px-3 py-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 flex items-center justify-between text-xs font-semibold text-purple-700 dark:text-purple-300 transition-colors">
            <span>📌 바로가기</span>
            <span id="nav-arrow" class="transform transition-transform">▼</span>
          </button>
          <div id="nav-grid" class="p-2 grid grid-cols-4 gap-1.5">
            ${exams.map((exam, idx) => `
              <button
                onclick="document.getElementById('case-${exam.id}').scrollIntoView({ behavior: 'smooth', block: 'start' })"
                class="aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-purple-500 hover:text-white dark:hover:bg-purple-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold transition-all hover:scale-110"
                title="문제 ${idx + 1}"
              >
                ${idx + 1}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-gray-300 dark:border-gray-600 p-3">
          <!-- Temporary Save -->
          <button
            id="btn-temp-save"
            ${!canTempSave ? 'disabled' : ''}
            class="px-3 py-2.5 ${canTempSave ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'} text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg flex flex-col items-center justify-center gap-1 text-xs"
            title="${canTempSave ? '임시 채점 & 저장' : `${Math.ceil((5 * 60 * 1000 - (now - lastTempSave)) / 1000 / 60)}분 후 사용 가능`}"
          >
            <span class="text-xl">💾</span>
            <span>${canTempSave ? '임시저장' : `쿨다운`}</span>
          </button>

          <!-- Final Submit -->
          <button
            id="btn-submit-exam"
            class="px-3 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-1 text-xs"
          >
            <span class="text-xl">📝</span>
            <span>최종 제출</span>
          </button>
        </div>
      </div>
        <button
          id="btn-mobile-nav"
          class="flex-shrink-0 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-xl flex items-center justify-center gap-2 text-sm"
        >
          <span>📌</span>
        </button>
        <button
          id="btn-temp-save-mobile"
          ${!canTempSave ? 'disabled' : ''}
          class="flex-1 px-4 py-3 ${canTempSave ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'} text-white font-bold rounded-lg shadow-xl flex items-center justify-center gap-2 text-sm"
        >
          <span>💾</span>
          <span>${canTempSave ? '임시' : '쿨다운'}</span>
        </button>
        <button
          id="btn-submit-mobile"
          class="flex-1 px-4 py-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold rounded-lg shadow-xl flex items-center justify-center gap-2 text-sm"
        >
          <span>📝</span>
          <span>제출</span>
        </button>
      </div>
    </div>
  `;

  // 타이머 시작
  startTimer(year, metadata.timeLimit);

  // 답안 자동저장 이벤트
  setupAutoSave(year);

  // 헤더 종료 버튼
  const exitHeaderBtn = container.querySelector('#btn-exit-exam-header');
  if (exitHeaderBtn) {
    exitHeaderBtn.addEventListener('click', async () => {
      if (confirm('기출문제 모드를 종료하시겠습니까?')) {
        const { exitExamMode } = await import('./examIntegration.js');
        exitExamMode();
      }
    });
  }

  // Desktop: Floating Navigation Toggle
  const toggleNavBtn = container.querySelector('#toggle-nav');
  const navGrid = container.querySelector('#nav-grid');
  const navArrow = container.querySelector('#nav-arrow');
  let navExpanded = true;

  if (toggleNavBtn && navGrid && navArrow) {
    toggleNavBtn.addEventListener('click', () => {
      navExpanded = !navExpanded;
      if (navExpanded) {
        navGrid.style.display = 'grid';
        navArrow.style.transform = 'rotate(0deg)';
      } else {
        navGrid.style.display = 'none';
        navArrow.style.transform = 'rotate(-90deg)';
      }
    });
  }

  // Desktop: 임시저장 버튼
  const tempSaveBtn = container.querySelector('#btn-temp-save');
  if (tempSaveBtn && canTempSave) {
    tempSaveBtn.addEventListener('click', async () => {
      await handleTempSave(container, year, apiKey, selectedModel);
    });
  }

  // Desktop: 최종 제출 버튼
  const submitBtn = container.querySelector('#btn-submit-exam');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      submitExam(container, year, apiKey, selectedModel);
    });
  }

  // Mobile: 네비게이션 버튼 (모달 띄우기)
  const mobileNavBtn = container.querySelector('#btn-mobile-nav');
  if (mobileNavBtn) {
    mobileNavBtn.addEventListener('click', () => {
      // 간단한 네비게이션 모달
      const navHtml = `
        <div class="grid grid-cols-5 gap-2 p-4">
          ${exams.map((exam, idx) => `
            <button
              onclick="document.getElementById('case-${exam.id}').scrollIntoView({ behavior: 'smooth', block: 'start' }); this.closest('.fixed').remove();"
              class="aspect-square flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-bold"
            >
              ${idx + 1}
            </button>
          `).join('')}
        </div>
      `;

      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4';
      modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
          <div class="flex items-center justify-between p-4 border-b dark:border-gray-700">
            <h3 class="font-bold text-gray-800 dark:text-gray-200">문제 바로가기</h3>
            <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
          </div>
          ${navHtml}
        </div>
      `;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
      document.body.appendChild(modal);
    });
  }

  // Mobile: 임시저장 버튼
  const tempSaveMobileBtn = container.querySelector('#btn-temp-save-mobile');
  if (tempSaveMobileBtn && canTempSave) {
    tempSaveMobileBtn.addEventListener('click', async () => {
      await handleTempSave(container, year, apiKey, selectedModel);
    });
  }

  // Mobile: 최종 제출 버튼
  const submitMobileBtn = container.querySelector('#btn-submit-mobile');
  if (submitMobileBtn) {
    submitMobileBtn.addEventListener('click', () => {
      submitExam(container, year, apiKey, selectedModel);
    });
  }

  // 글자 수 카운터 업데이트
  updateCharCounters();
}

/**
 * 타이머 시작
 */
function startTimer(year, timeLimit) {
  const timerDisplay = document.getElementById('timer-display');
  if (!timerDisplay) return;

  const updateTimer = () => {
    const remaining = examService.getRemainingTime(year);
    if (remaining === null) return;

    const minutes = Math.floor(remaining);
    const seconds = Math.round((remaining - minutes) * 60);

    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // 10분 남았을 때 경고
    if (remaining <= 10 && remaining > 0) {
      timerDisplay.classList.add('text-red-400', 'animate-pulse');
    }

    // 시간 종료
    if (remaining <= 0) {
      clearInterval(examUIState.timerInterval);
      timerDisplay.textContent = '00:00';
      alert('⏰ 시험 시간이 종료되었습니다.\n자동으로 제출합니다.');

      // 자동 제출
      const submitBtn = document.getElementById('btn-submit-exam');
      if (submitBtn) submitBtn.click();
    }
  };

  // 초기 업데이트
  updateTimer();

  // 1초마다 업데이트
  examUIState.timerInterval = setInterval(updateTimer, 1000);
}

/**
 * 답안 자동저장 설정
 */
function setupAutoSave(year) {
  const textareas = document.querySelectorAll('textarea[data-question-id]');

  textareas.forEach(textarea => {
    textarea.addEventListener('input', (e) => {
      const questionId = e.target.dataset.questionId;
      const answer = e.target.value;

      // 상태 저장
      examUIState.answers[questionId] = { answer };

      // LocalStorage 저장 (디바운스 없이 즉시)
      examService.saveUserAnswer(year, questionId, answer);

      // 글자 수 업데이트
      const charCount = document.getElementById(`char-count-${questionId}`);
      if (charCount) {
        charCount.textContent = `${answer.length}자`;
      }
    });
  });
}

/**
 * 글자 수 카운터 초기화
 */
function updateCharCounters() {
  const textareas = document.querySelectorAll('textarea[data-question-id]');
  textareas.forEach(textarea => {
    const questionId = textarea.dataset.questionId;
    const charCount = document.getElementById(`char-count-${questionId}`);
    if (charCount) {
      charCount.textContent = `${textarea.value.length}자`;
    }
  });
}

/**
 * 임시저장 & 채점
 */
async function handleTempSave(container, year, apiKey, selectedModel) {
  console.log('🔑 [examUI.js] handleTempSave - 파라미터 apiKey:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');
  console.log('🔑 [examUI.js] handleTempSave - localStorage geminiApiKey:', localStorage.getItem('geminiApiKey') ? '✅ 있음' : '❌ 없음');

  // API 키 확인 (조용히 처리)
  const finalApiKey = apiKey || localStorage.getItem('geminiApiKey') || '';
  const finalModel = selectedModel || localStorage.getItem('selectedAiModel') || 'gemini-2.5-flash-lite';

  console.log('🔑 [examUI.js] handleTempSave - 최종 apiKey:', finalApiKey ? `${finalApiKey.substring(0, 10)}...` : '❌ 없음');

  const userAnswers = examService.getUserAnswers(year);

  // 로딩 표시
  const tempSaveBtn = container.querySelector('#btn-temp-save');
  const originalText = tempSaveBtn.innerHTML;
  tempSaveBtn.disabled = true;
  tempSaveBtn.innerHTML = '<span class="loader-small inline-block"></span><span class="ml-2">채점 중...</span>';

  try {
    // 임시 채점
    const result = await examService.tempGradeExam(year, userAnswers, finalApiKey, finalModel);

    // 성공 알림
    alert(`✅ 임시 채점 완료!\n\n현재 점수: ${result.totalScore.toFixed(1)} / ${examService.getTotalScore(year)}점\n\n각 답안 옆에 임시 점수와 피드백이 표시됩니다.`);

    // UI 새로고침 (임시 점수 표시)
    renderExamPaper(container, year, finalApiKey, finalModel);
  } catch (error) {
    console.error('임시 채점 실패:', error);
    alert('❌ 임시 채점 중 오류가 발생했습니다.\n\n' + error.message);
    tempSaveBtn.disabled = false;
    tempSaveBtn.innerHTML = originalText;
  }
}

/**
 * 최종 제출
 */
async function submitExam(container, year, apiKey, selectedModel) {
  // 확인
  if (!confirm('정말 제출하시겠습니까?\n제출 후에는 답안을 수정할 수 없습니다.')) {
    return;
  }

  console.log('🔑 [examUI.js] submitExam - 파라미터 apiKey:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');
  console.log('🔑 [examUI.js] submitExam - localStorage geminiApiKey:', localStorage.getItem('geminiApiKey') ? '✅ 있음' : '❌ 없음');

  // API 키를 localStorage에서 다시 확인 (파라미터가 비어있을 경우 대비)
  const finalApiKey = apiKey || localStorage.getItem('geminiApiKey') || '';
  const finalModel = selectedModel || localStorage.getItem('selectedAiModel') || 'gemini-2.5-flash-lite';

  console.log('🔑 [examUI.js] submitExam - 최종 apiKey:', finalApiKey ? `${finalApiKey.substring(0, 10)}...` : '❌ 없음');

  // 타이머 정지
  if (examUIState.timerInterval) {
    clearInterval(examUIState.timerInterval);
  }

  // 채점 시작
  await gradeAndShowResults(container, year, finalApiKey, finalModel);
}

/**
 * 채점 및 결과 표시
 */
async function gradeAndShowResults(container, year, apiKey, selectedModel) {
  const userAnswers = examService.getUserAnswers(year);

  // 로딩 화면
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
      <div class="max-w-2xl mx-auto p-8 text-center space-y-6">
        <div class="loader mx-auto mb-4"></div>
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-200">
          📝 AI가 채점하고 있습니다...
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          모범 답안과 비교하여 상세한 피드백을 생성 중입니다.
        </p>

        <!-- 진행률 표시 -->
        <div class="w-full max-w-md mx-auto">
          <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span id="progress-text">준비 중...</span>
            <span id="progress-percentage">0%</span>
          </div>
          <div class="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
            <div id="progress-bar" class="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500 ease-out" style="width: 0%"></div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-500 mt-2" id="case-info">
            Case별 병렬 채점이 진행됩니다.
          </p>
        </div>

        <!-- 채점 중에도 모범답안 미리 표시 -->
        <div class="mt-8 text-left bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-300 dark:border-gray-600">
          <h3 class="font-bold text-purple-700 dark:text-purple-400 mb-4">📚 모범 답안 미리보기</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            채점이 완료되면 문항별 상세 비교가 제공됩니다.
          </p>
          ${renderModelAnswersPreview(year)}
        </div>
      </div>
    </div>
  `;

  try {
    // 진행률 업데이트 콜백
    const onProgress = ({ current, total, percentage, caseId }) => {
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      const progressPercentage = document.getElementById('progress-percentage');
      const caseInfo = document.getElementById('case-info');

      if (progressBar && progressText && progressPercentage) {
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${current}/${total} Case 완료`;
        progressPercentage.textContent = `${percentage}%`;
        caseInfo.textContent = `현재 채점 완료: ${caseId}`;
      }
    };

    // AI 채점 (병렬 처리 + 진행률 표시)
    const result = await examService.gradeExam(year, userAnswers, apiKey, selectedModel, onProgress);

    // 점수 저장
    examService.saveScore(year, result.totalScore, result.details);

    // 타이머 초기화
    examService.clearTimer(year);

    // 결과 화면 렌더링
    renderResults(container, year, result, apiKey, selectedModel);
  } catch (error) {
    console.error('채점 실패:', error);
    alert('채점 중 오류가 발생했습니다. 다시 시도해주세요.');
    renderYearSelection(container, apiKey, selectedModel);
  }
}

/**
 * 모범답안 미리보기 (채점 중)
 */
function renderModelAnswersPreview(year) {
  const exams = examService.getExamByYear(year);

  return `
    <div class="space-y-4 max-h-96 overflow-y-auto">
      ${exams.map(exam => `
        ${exam.questions.slice(0, 2).map((q, idx) => `
          <div class="bg-purple-50 dark:bg-purple-900/20 rounded p-3">
            <div class="text-xs font-bold text-purple-700 dark:text-purple-300 mb-1">문제 ${idx + 1} (${q.score}점)</div>
            <p class="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">${q.model_answer.substring(0, 100)}...</p>
          </div>
        `).join('')}
      `).join('')}
      <p class="text-xs text-gray-500 dark:text-gray-400 text-center">...외 ${examService.getTotalQuestions(year) - 2}문제</p>
    </div>
  `;
}

/**
 * 키워드 하이라이팅 헬퍼
 */
function highlightKeywords(text, keywords) {
  if (!keywords || keywords.length === 0) return text;

  let highlighted = text;
  keywords.forEach(keyword => {
    if (!keyword || keyword.trim() === '') return;

    // 정규식 특수문자 이스케이프
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');

    highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-700 px-1 rounded">$1</mark>');
  });

  return highlighted;
}

/**
 * 점수 마킹 이모지
 */
function getScoreEmoji(score, maxScore) {
  const percentage = (score / maxScore) * 100;

  if (percentage >= 90) return '⭕'; // 만점 (90% 이상)
  if (percentage >= 50) return '🔺'; // 부분 점수
  return '❌'; // 낮은 점수
}

/**
 * 결과 화면 (빨간펜 선생님 스타일)
 */
function renderResults(container, year, result, apiKey, selectedModel) {
  const exams = examService.getExamByYear(year);
  const metadata = examService.getMetadata(year);
  const totalPossibleScore = examService.getTotalScore(year);
  const percentage = Math.round((result.totalScore / totalPossibleScore) * 100);
  const isPassing = result.totalScore >= metadata.passingScore;

  // 점수 히스토리 가져오기
  const scoreHistory = examService.getScores(year);
  const bestScore = examService.getBestScore(year);

  // 사용자 답안 미리 가져오기
  const userAnswers = examService.getUserAnswers(year);

  container.innerHTML = `
    <div class="results-container max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <!-- 헤더: 총점 -->
      <div class="bg-gradient-to-r ${isPassing ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600'} rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="text-center md:text-left">
            <h1 class="text-2xl md:text-3xl font-bold mb-2">📝 ${year}년 기출문제 채점 완료!</h1>
            <p class="text-lg opacity-90">
              ${isPassing ? '🎉 합격 기준 충족!' : '💪 조금만 더 노력하면 합격!'}
            </p>
          </div>
          <div class="text-center">
            <div class="text-6xl md:text-7xl font-extrabold mb-2">
              ${result.totalScore}
            </div>
            <div class="text-xl md:text-2xl font-semibold">
              / ${totalPossibleScore}점 (${percentage}%)
            </div>
          </div>
        </div>
      </div>

      <!-- 점수 히스토리 -->
      ${scoreHistory.length > 0 ? `
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-md">
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            📊 점수 히스토리 <span class="text-sm font-normal text-gray-600 dark:text-gray-400">(${scoreHistory.length}번째 응시)</span>
          </h3>
          <div class="flex items-center gap-4 overflow-x-auto pb-2">
            ${scoreHistory.map((s, idx) => `
              <div class="flex flex-col items-center min-w-[80px]">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">${idx + 1}회</div>
                <div class="w-12 h-12 rounded-full ${s.score >= metadata.passingScore ? 'bg-green-100 text-green-700 border-2 border-green-500' : 'bg-gray-100 text-gray-700 border-2 border-gray-300'} flex items-center justify-center font-bold text-sm">
                  ${s.score}
                </div>
                ${s.score === bestScore ? '<div class="text-xs text-yellow-600 dark:text-yellow-400 mt-1">🏆 최고</div>' : ''}
              </div>
            `).join('')}
          </div>
          ${bestScore && result.totalScore === bestScore && scoreHistory.length > 1 ? `
            <p class="mt-4 text-sm text-green-600 dark:text-green-400 font-semibold">
              ✨ 최고 점수 경신! 이전 최고: ${scoreHistory[scoreHistory.length - 2].score}점
            </p>
          ` : ''}
        </div>
      ` : ''}

      <!-- 문제별 상세 피드백 -->
      <div class="space-y-8">
        ${exams.map((examCase, caseIdx) => `
          <div class="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
            <!-- Case 헤더 -->
            <div class="bg-purple-50 dark:bg-purple-900/20 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-bold text-purple-900 dark:text-purple-200">
                📄 Case ${caseIdx + 1}: ${examCase.topic}
                <span class="text-sm font-normal text-gray-600 dark:text-gray-400 ml-2">(${examCase.type || '일반'})</span>
              </h2>
              <p class="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">${examCase.scenario.substring(0, 150)}...</p>
            </div>

            <!-- 문제별 카드 -->
            <div class="p-6 space-y-6">
              ${examCase.questions.map((question, qIdx) => {
                const feedback = result.details[question.id];
                const scoreEmoji = getScoreEmoji(feedback?.score || 0, question.score);
                const userAnswer = userAnswers[question.id]?.answer || '';

                return `
                  <div class="border-l-4 ${feedback?.score >= question.score * 0.9 ? 'border-green-500' : feedback?.score >= question.score * 0.5 ? 'border-yellow-500' : 'border-red-500'} pl-4 pb-4">
                    <!-- 문제 헤더 -->
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
                        문항 ${qIdx + 1} <span class="text-2xl ml-2">${scoreEmoji}</span>
                      </h3>
                      <div class="text-xl font-bold ${feedback?.score >= question.score * 0.9 ? 'text-green-600' : feedback?.score >= question.score * 0.5 ? 'text-yellow-600' : 'text-red-600'}">
                        ${feedback?.score || 0} / ${question.score}점
                      </div>
                    </div>

                    <!-- 문제 -->
                    <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-3">
                      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📝 문제</h4>
                      <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">${question.question}</p>
                    </div>

                    <!-- 사용자 답안 -->
                    <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-3">
                      <h4 class="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">✍️ 내 답안</h4>
                      <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">${highlightKeywords(userAnswer || '<em class="text-gray-500">작성하지 않음</em>', feedback?.keywordMatch || [])}</p>
                    </div>

                    <!-- 모범 답안 -->
                    <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-3">
                      <h4 class="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">📚 모범 답안</h4>
                      <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">${highlightKeywords(question.model_answer, feedback?.missingKeywords || [])}</p>
                    </div>

                    <!-- AI 피드백 -->
                    <div class="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-lg p-4 border-2 border-red-200 dark:border-red-700">
                      <h4 class="text-sm font-bold text-red-700 dark:text-red-300 mb-3 flex items-center gap-2">
                        🎯 빨간펜 선생님의 총평
                      </h4>
                      <p class="text-sm text-gray-800 dark:text-gray-200 mb-4 leading-relaxed">${feedback?.feedback || '채점 정보 없음'}</p>

                      ${feedback?.strengths && feedback.strengths.length > 0 ? `
                        <div class="mb-3">
                          <h5 class="text-xs font-bold text-green-700 dark:text-green-400 mb-2">✅ 잘한 점</h5>
                          <ul class="list-disc list-inside space-y-1">
                            ${feedback.strengths.map(s => `<li class="text-xs text-gray-700 dark:text-gray-300">${s}</li>`).join('')}
                          </ul>
                        </div>
                      ` : ''}

                      ${feedback?.improvements && feedback.improvements.length > 0 ? `
                        <div class="mb-3">
                          <h5 class="text-xs font-bold text-orange-700 dark:text-orange-400 mb-2">💡 개선할 점</h5>
                          <ul class="list-disc list-inside space-y-1">
                            ${feedback.improvements.map(i => `<li class="text-xs text-gray-700 dark:text-gray-300">${i}</li>`).join('')}
                          </ul>
                        </div>
                      ` : ''}

                      ${feedback?.keywordMatch && feedback.keywordMatch.length > 0 ? `
                        <div class="mb-2">
                          <h5 class="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">🔑 포함된 키워드</h5>
                          <div class="flex flex-wrap gap-1">
                            ${feedback.keywordMatch.map(k => `<span class="text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">${k}</span>`).join('')}
                          </div>
                        </div>
                      ` : ''}

                      ${feedback?.missingKeywords && feedback.missingKeywords.length > 0 ? `
                        <div>
                          <h5 class="text-xs font-bold text-red-700 dark:text-red-400 mb-1">❗ 누락된 키워드</h5>
                          <div class="flex flex-wrap gap-1">
                            ${feedback.missingKeywords.map(k => `<span class="text-xs bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded">${k}</span>`).join('')}
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- 하단 버튼 -->
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button id="retry-exam-btn" class="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold text-lg rounded-xl shadow-lg transition transform hover:scale-105">
          🔄 다시 풀기
        </button>
        <button id="exit-exam-results-btn" class="px-8 py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold text-lg rounded-xl shadow-lg transition transform hover:scale-105">
          ✕ 종료하기
        </button>
      </div>
    </div>
  `;

  // 이벤트 리스너
  container.querySelector('#retry-exam-btn').addEventListener('click', () => {
    // 답안 초기화
    examService.clearUserAnswers(year);
    examService.clearTimer(year);

    // 다시 문제 화면으로
    renderExamPaper(container, year, apiKey, selectedModel);
  });

  container.querySelector('#exit-exam-results-btn').addEventListener('click', () => {
    renderYearSelection(container, apiKey, selectedModel);
  });
}
