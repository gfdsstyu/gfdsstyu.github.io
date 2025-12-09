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

  renderExamPaper(container, year, apiKey, selectedModel);
}

/**
 * 시험지 화면 (Split View)
 */
function renderExamPaper(container, year, apiKey, selectedModel) {
  const exams = examService.getExamByYear(year);
  const metadata = examService.getMetadata(year);

  container.innerHTML = `
    <div class="exam-paper-container h-screen flex flex-col">
      <!-- Sticky Header: 타이머 & 제출 -->
      <div id="exam-header" class="sticky top-0 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <h3 class="text-lg font-bold">${year}년 기출문제</h3>
            <span class="text-sm opacity-90">총 ${examService.getTotalScore(year)}점</span>
          </div>

          <!-- 타이머 -->
          <div id="timer" class="flex items-center gap-3 text-lg font-bold">
            <span>⏱️ 남은 시간:</span>
            <span id="timer-display" class="text-2xl font-mono">--:--</span>
          </div>

          <!-- 제출 버튼 -->
          <button id="btn-submit-exam" class="px-6 py-2 bg-white text-purple-700 font-bold rounded-lg hover:bg-gray-100 transition-colors">
            최종 제출 및 채점 →
          </button>
        </div>
      </div>

      <!-- Split View: 좌측 지문 | 우측 문제 -->
      <div class="flex-1 flex overflow-hidden">
        <!-- 좌측: Scenario (40%) -->
        <div class="w-2/5 bg-gray-50 dark:bg-gray-900 border-r-2 border-gray-300 dark:border-gray-700 overflow-y-auto p-6">
          <div class="sticky top-0 bg-gray-50 dark:bg-gray-900 pb-4 mb-4 border-b-2 border-gray-300 dark:border-gray-700">
            <h4 class="text-xl font-bold text-gray-800 dark:text-gray-200">📄 지문 (Scenario)</h4>
          </div>

          ${exams.map(exam => `
            <div id="scenario-${exam.id}" class="scenario-section mb-8 scroll-mt-20">
              <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-300 dark:border-gray-600">
                <h5 class="font-bold text-purple-700 dark:text-purple-400 mb-2">${exam.topic}</h5>
                <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" style="font-family: 'Iropke Batang', serif;">
                  ${exam.scenario}
                </p>
                <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  유형: ${exam.type === 'Rule' ? '기준서(Rule)' : '사례(Case)'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- 우측: Questions (60%) -->
        <div class="w-3/5 bg-white dark:bg-gray-800 overflow-y-auto p-6">
          <div class="max-w-4xl mx-auto space-y-8">
            ${exams.map(exam => `
              ${exam.questions.map((q, qIdx) => `
                <div id="question-${q.id}" class="question-card bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-6 scroll-mt-20">
                  <!-- 문제 헤더 -->
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-bold rounded-full">
                          문제 ${qIdx + 1}
                        </span>
                        <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded">
                          ${q.score}점
                        </span>
                      </div>
                    </div>
                    <button class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                            onclick="document.getElementById('scenario-${exam.id}').scrollIntoView({ behavior: 'smooth', block: 'start' })">
                      📄 지문 보기
                    </button>
                  </div>

                  <!-- 문제 -->
                  <div class="mb-4">
                    <p class="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap" style="font-family: 'Iropke Batang', serif;">
                      ${q.question}
                    </p>
                  </div>

                  <!-- 답안 입력 -->
                  <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                      ✍️ 답안 작성
                    </label>
                    <textarea
                      id="answer-${q.id}"
                      class="w-full h-40 p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-gray-200 resize-none"
                      placeholder="답안을 입력하세요..."
                      data-question-id="${q.id}"
                    >${examUIState.answers[q.id]?.answer || ''}</textarea>
                    <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                      <span>💾 자동 저장됨</span>
                      <span id="char-count-${q.id}">0자</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // 타이머 시작
  startTimer(year, metadata.timeLimit);

  // 답안 자동저장 이벤트
  setupAutoSave(year);

  // 최종 제출 버튼
  container.querySelector('#btn-submit-exam').addEventListener('click', () => {
    submitExam(container, year, apiKey, selectedModel);
  });

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
 * 최종 제출
 */
async function submitExam(container, year, apiKey, selectedModel) {
  // 확인
  if (!confirm('정말 제출하시겠습니까?\n제출 후에는 답안을 수정할 수 없습니다.')) {
    return;
  }

  // 타이머 정지
  if (examUIState.timerInterval) {
    clearInterval(examUIState.timerInterval);
  }

  // 채점 시작
  await gradeAndShowResults(container, year, apiKey, selectedModel);
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
            <p class="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
              ${q.model_answer.substring(0, 100)}...
            </p>
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
                      <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        ${highlightKeywords(userAnswer || '<em class="text-gray-500">작성하지 않음</em>', feedback?.keywordMatch || [])}
                      </p>
                    </div>

                    <!-- 모범 답안 -->
                    <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-3">
                      <h4 class="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">📚 모범 답안</h4>
                      <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        ${highlightKeywords(question.model_answer, feedback?.missingKeywords || [])}
                      </p>
                    </div>

                    <!-- AI 피드백 -->
                    <div class="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-lg p-4 border-2 border-red-200 dark:border-red-700">
                      <h4 class="text-sm font-bold text-red-700 dark:text-red-300 mb-3 flex items-center gap-2">
                        🎯 빨간펜 선생님의 총평
                      </h4>
                      <p class="text-sm text-gray-800 dark:text-gray-200 mb-4 leading-relaxed">
                        ${feedback?.feedback || '채점 정보 없음'}
                      </p>

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
