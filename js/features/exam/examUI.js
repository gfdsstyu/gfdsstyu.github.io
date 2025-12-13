/**
 * Past Exam UI
 * 기출문제 실전 모의고사 UI
 */

import { examService } from './examService.js';
import { getGeminiApiKey, getSelectedAiModel } from '../../core/stateManager.js';
import { renderResultMode } from './examResultUI.js';

/**
 * 텍스트 정규화: 과도한 줄바꿈 완화
 * @param {string} text - 원본 텍스트
 * @returns {string} - 정규화된 텍스트
 */
function normalizeText(text) {
  if (!text) return text;

  // 3개 이상의 연속된 줄바꿈을 2개로 축소
  return text.replace(/\n{3,}/g, '\n\n');
}

/**
 * 마크다운 표를 HTML 테이블로 변환
 * @param {string} text - 마크다운 텍스트
 * @returns {string} - HTML로 변환된 텍스트
 */
function convertMarkdownTablesToHtml(text) {
  if (!text) return text;

  // 텍스트 정규화 먼저 적용
  text = normalizeText(text);

  // 줄 단위로 분리
  const lines = text.split(/\r?\n/);
  let result = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    // 테이블 시작 감지: | 로 시작하고 끝나는 줄
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableData = parseTable(lines, i);
      if (tableData) {
        result += renderTable(tableData.headers, tableData.alignments, tableData.rows);
        i = tableData.nextIndex;
        continue;
      }
    }
    
    // 테이블이 아니면 원본 텍스트 유지 (HTML 이스케이프 적용)
    result += (i > 0 ? '\n' : '') + escapeHtml(lines[i]);
    i++;
  }

  return result;
}

/**
 * 테이블 파싱 (시작 인덱스부터 테이블 끝까지)
 */
function parseTable(lines, startIndex) {
  const tableRows = [];
  let i = startIndex;
  let alignments = [];

  // 헤더 행
  const headerLine = lines[i].trim();
  if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) {
    return null;
  }
  const headers = parseTableRow(headerLine);
  if (headers.length < 2) return null; // 최소 2개 컬럼 필요
  
  i++;

  // 구분선 (정렬 정보)
  if (i >= lines.length) return null;
  const separatorLine = lines[i].trim();
  if (!separatorLine.startsWith('|') || !separatorLine.endsWith('|')) {
    return null;
  }
  
  // 정렬 정보 파싱
  alignments = parseTableRow(separatorLine).map(cell => {
    const trimmed = cell.trim();
    // :---: (center), ---: (right), :--- (left), --- (left)
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
    if (trimmed.endsWith(':')) return 'right';
    if (trimmed.startsWith(':')) return 'left';
    return 'left';
  });
  
  i++;

  // 바디 행들
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // 테이블 행인지 확인
    if (line.startsWith('|') && line.endsWith('|')) {
      const row = parseTableRow(line);
      if (row.length === headers.length) {
        tableRows.push(row);
        i++;
        continue;
      }
    }
    
    // 빈 줄이면 테이블 종료
    if (line === '') {
      i++;
      break;
    }
    
    // 테이블이 아닌 줄이면 종료
    break;
  }

  if (tableRows.length === 0) return null;

  return {
    headers,
    alignments,
    rows: tableRows,
    nextIndex: i
  };
}

/**
 * 테이블 행 파싱 (|로 구분된 셀들)
 */
function parseTableRow(line) {
  // 앞뒤 | 제거 후 분리
  const cells = line.slice(1, -1).split('|');
  return cells.map(cell => cell.trim());
}

/**
 * HTML 테이블 렌더링
 */
function renderTable(headers, alignments, rows) {
  let html = '<div class="markdown-table-wrapper overflow-x-auto my-4"><table class="markdown-table min-w-full border-collapse border border-gray-300 dark:border-gray-600">';
  
  // 헤더
  html += '<thead class="bg-gray-100 dark:bg-gray-700"><tr>';
  headers.forEach((header, idx) => {
    const align = alignments[idx] || 'left';
    html += `<th class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-${align} font-bold text-gray-900 dark:text-gray-100">${escapeHtml(header)}</th>`;
  });
  html += '</tr></thead>';

  // 바디
  html += '<tbody>';
  rows.forEach(row => {
    html += '<tr class="hover:bg-gray-50 dark:hover:bg-gray-800">';
    row.forEach((cell, idx) => {
      const align = alignments[idx] || 'left';
      html += `<td class="border border-gray-300 dark:border-gray-600 px-4 py-2 text-${align} text-gray-800 dark:text-gray-200">${escapeHtml(cell)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  return html;
}

/**
 * HTML 이스케이프 유틸리티
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Question ID에서 숫자 배열 추출 (정렬용)
 * 예: "Q10-1-2" -> [10, 1, 2]
 *     "Q1-2-3" -> [1, 2, 3]
 */
function extractQuestionNumbers(questionId) {
  // "Q" 제거 후 "-"로 분리하여 숫자 추출
  const parts = questionId.replace(/^Q/i, '').split('-');
  return parts.map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/**
 * Question ID에서 표시용 번호 추출
 * 예: "Q10-1-2" -> "10-1-2"
 *     "Q1-2-3" -> "1-2-3"
 */
function extractQuestionNumber(questionId) {
  // "Q" 제거 (대소문자 무시)
  return questionId.replace(/^Q/i, '');
}

/**
 * UI 상태 관리
 */
const examUIState = {
  currentYear: null,
  currentCaseId: null,
  startTime: null,
  timerInterval: null,
  answers: {},
  viewMode: 'auto', // 'split', 'vertical', 'auto'
  isPaused: false, // 타이머 일시정지 상태
  pauseStartTime: null, // 일시정지 시작 시간

  reset() {
    this.currentYear = null;
    this.currentCaseId = null;
    this.startTime = null;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.timerCleanup) {
      this.timerCleanup();
      this.timerCleanup = null;
    }
    this.answers = {};
    this.isPaused = false;
    this.pauseStartTime = null;
    // viewMode는 초기화하지 않음 (사용자 선택 유지)
  },

  /**
   * 현재 화면 크기에 따라 적절한 뷰 모드 반환
   */
  getActiveViewMode() {
    if (this.viewMode === 'auto') {
      // 1024px 기준으로 자동 감지
      return window.innerWidth >= 1024 ? 'split' : 'vertical';
    }
    return this.viewMode;
  }
};

/**
 * 메인 진입점
 */
export function renderExamMode(container) {
  const apiKey = getGeminiApiKey();
  const selectedModel = getSelectedAiModel();

  console.log('🔑 [examUI.js] renderExamMode - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');

  if (!container) {
    console.error('Exam UI container not found');
    return;
  }

  examUIState.reset();
  renderYearSelection(container);
}

/**
 * 연도 선택 화면
 */
function renderYearSelection(container) {
  const apiKey = getGeminiApiKey();
  const selectedModel = getSelectedAiModel();

  console.log('🔑 [examUI.js] renderYearSelection - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');

  // 타이머 정지
  if (examUIState.timerInterval) {
    clearInterval(examUIState.timerInterval);
    examUIState.timerInterval = null;
  }
  if (examUIState.timerCleanup) {
    examUIState.timerCleanup();
    examUIState.timerCleanup = null;
  }
  console.log('✅ [examUI.js] renderYearSelection - 타이머 정지');

  // 전체 화면 모드 해제 (연도 선택 화면은 기존 레이아웃 사용)
  container.className = '';

  // 좌우 대시보드와 헤더 복원
  const leftDashboard = document.getElementById('left-dashboard');
  const rightDashboard = document.getElementById('right-explorer');
  const fixedHeader = document.getElementById('fixed-header');

  if (leftDashboard && leftDashboard.dataset.hiddenByExam === 'true') {
    leftDashboard.style.display = '';
    delete leftDashboard.dataset.hiddenByExam;
  }

  if (rightDashboard && rightDashboard.dataset.hiddenByExam === 'true') {
    rightDashboard.style.display = '';
    delete rightDashboard.dataset.hiddenByExam;
  }

  if (fixedHeader && fixedHeader.dataset.hiddenByExam === 'true') {
    fixedHeader.style.display = '';
    delete fixedHeader.dataset.hiddenByExam;
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
                    최고 ${bestScore.toFixed(1)}점
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

              <div class="mt-4 flex gap-2">
                <button class="start-exam-btn flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors">
                  ${latestAttempt > 0 ? '다시 풀기' : '시작하기'} →
                </button>
                ${latestAttempt > 0 ? `
                  <button class="view-result-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors" data-year="${year}">
                    📊 결과보기
                  </button>
                ` : ''}
              </div>
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
  // 시작하기/다시 풀기 버튼
  container.querySelectorAll('.start-exam-btn').forEach((btn, idx) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const year = parseInt(years[idx], 10);
      startExam(container, year);
    });
  });

  // 결과보기 버튼
  container.querySelectorAll('.view-result-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const year = parseInt(btn.dataset.year, 10);

      // 가장 최근 채점 결과 가져오기
      const scores = examService.getScores(year);
      if (scores.length === 0) {
        alert('채점 이력이 없습니다.');
        return;
      }

      const latestScore = scores[scores.length - 1];

      // result 객체 재구성
      const result = {
        totalScore: latestScore.score,
        details: latestScore.details || {}
      };

      // 결과 화면 렌더링
      try {
        renderResultMode(container, year, result, apiKey, selectedModel, examUIState.viewMode);
      } catch (error) {
        console.error('❌ [examUI.js] 채점 결과 렌더링 에러:', error);
        alert(`채점 결과를 불러오는 중 오류가 발생했습니다.\n${error.message}`);
      }
    });
  });
}

/**
 * 시험 시작
 */
function startExam(container, year) {
  const apiKey = getGeminiApiKey();
  const selectedModel = getSelectedAiModel();

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

  // 전체 화면 모드로 전환 (Flex Column 구조)
  container.className = 'fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col h-screen';

  // 좌우 대시보드와 헤더 숨기기
  const leftDashboard = document.getElementById('left-dashboard');
  const rightDashboard = document.getElementById('right-explorer');
  const fixedHeader = document.getElementById('fixed-header');

  if (leftDashboard) {
    leftDashboard.style.display = 'none';
    leftDashboard.dataset.hiddenByExam = 'true';
  }

  if (rightDashboard) {
    rightDashboard.style.display = 'none';
    rightDashboard.dataset.hiddenByExam = 'true';
  }

  if (fixedHeader) {
    fixedHeader.style.display = 'none';
    fixedHeader.dataset.hiddenByExam = 'true';
  }

  // 시험지 렌더링
  renderExamPaper(container, year, apiKey, selectedModel);
}

/**
 * 시험지 화면 (Split View)
 */
function renderExamPaper(container, year, apiKey, selectedModel) {
  // API 키가 전달되지 않았을 경우 StateManager에서 가져오기
  if (!apiKey) {
    apiKey = getGeminiApiKey();
  }
  if (!selectedModel) {
    selectedModel = getSelectedAiModel();
  }

  console.log('🔑 [examUI.js] renderExamPaper - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');
  console.log('🔍 [examUI.js] renderExamPaper - container:', container);
  console.log('🔍 [examUI.js] renderExamPaper - year:', year);

  let exams = examService.getExamByYear(year);
  const metadata = examService.getMetadata(year);

  // questions 정렬 보장 (Q1, Q2, ..., Q10 순서)
  exams = exams.map(exam => ({
    ...exam,
    questions: [...exam.questions].sort((a, b) => {
      const numsA = extractQuestionNumbers(a.id);
      const numsB = extractQuestionNumbers(b.id);
      const maxLen = Math.max(numsA.length, numsB.length);
      for (let i = 0; i < maxLen; i++) {
        const numA = numsA[i] || 0;
        const numB = numsB[i] || 0;
        if (numA !== numB) return numA - numB;
      }
      return 0;
    })
  }));

  console.log('🔍 [examUI.js] renderExamPaper - exams:', exams);
  console.log('🔍 [examUI.js] renderExamPaper - metadata:', metadata);

  const tempSaveData = examService.getTempSaveData(year);
  const lastTempSave = tempSaveData?.timestamp || 0;
  const now = Date.now();
  const canTempSave = (now - lastTempSave) >= 5 * 60 * 1000; // 5분

  console.log('🔍 [examUI.js] renderExamPaper - container.innerHTML 설정 시작');

  const activeViewMode = examUIState.getActiveViewMode();

  container.innerHTML = `
    <!-- Fixed Header -->
    <div id="exam-header" class="flex-none bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-700 dark:to-indigo-700 text-gray-800 dark:text-white shadow-lg z-50">
        <div class="w-full px-4 sm:px-6 lg:px-8 py-3">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <h3 class="text-lg sm:text-xl font-bold">${year}년 기출문제</h3>
              <span class="text-xs sm:text-sm px-2 sm:px-3 py-1 bg-purple-200 dark:bg-white/30 rounded-full font-semibold">총 ${examService.getTotalScore(year)}점</span>
            </div>

            <!-- Timer and Actions -->
            <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
              <!-- Timer Display -->
              <div class="flex items-center gap-2 bg-orange-100 dark:bg-orange-900/50 px-3 py-1.5 rounded-lg border-2 border-orange-400 dark:border-orange-600">
                <span class="text-xs font-semibold text-orange-700 dark:text-orange-300">⏱️</span>
                <div id="timer-display" class="text-lg font-mono font-bold text-orange-600 dark:text-orange-400">--:--</div>
              </div>

              <!-- Temp Save Button -->
              <button
                id="btn-temp-save"
                ${!canTempSave ? 'disabled' : ''}
                class="px-3 py-2 ${canTempSave ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'} font-bold rounded-lg transition-all text-xs sm:text-sm flex items-center gap-1"
                title="${canTempSave ? '임시 채점 & 저장' : `${Math.ceil((5 * 60 * 1000 - (now - lastTempSave)) / 1000 / 60)}분 후 사용 가능`}"
              >
                <span>💾</span>
                <span class="hidden sm:inline">임시저장</span>
              </button>

              <!-- Final Submit Button -->
              <button
                id="btn-submit-exam"
                class="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold rounded-lg transition-all text-xs sm:text-sm flex items-center gap-1"
              >
                <span>📝</span>
                <span class="hidden sm:inline">최종 제출</span>
              </button>

              <!-- View Mode Toggle -->
              <div class="flex bg-white/50 dark:bg-gray-800/50 rounded-lg p-1 gap-1">
                <button
                  id="btn-view-split"
                  class="px-2 py-1.5 rounded text-xs font-semibold transition-all ${activeViewMode === 'split' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-gray-700/50'}"
                  title="시험장 모드 (좌측 지문 고정)"
                >
                  🖥️ <span class="hidden md:inline">시험장</span>
                </button>
                <button
                  id="btn-view-vertical"
                  class="px-2 py-1.5 rounded text-xs font-semibold transition-all ${activeViewMode === 'vertical' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-gray-700/50'}"
                  title="모바일 모드 (카드형)"
                >
                  📱 <span class="hidden md:inline">모바일</span>
                </button>
              </div>

              <!-- Exit Button -->
              <button
                id="btn-exit-exam-header"
                class="px-3 py-2 bg-purple-200 hover:bg-purple-300 dark:bg-white/30 dark:hover:bg-white/40 font-semibold rounded-lg transition-colors flex items-center gap-1 text-xs sm:text-sm"
                title="기출문제 모드 종료"
              >
                <span>✕</span>
                <span class="hidden sm:inline">종료</span>
              </button>
            </div>
          </div>
        </div>
      </div>

    <!-- Scrollable Content Area -->
    <div id="exam-scroll-area" class="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 scroll-smooth relative" data-view-mode="${activeViewMode}">
      ${activeViewMode === 'split' ? `
        <!-- Split View: 좌측 지문 + 우측 문제 (고정 비율 4.5:5.5) -->
        <div class="flex h-full px-6 lg:px-8 gap-4 lg:gap-6">
          <!-- Left Panel: Scenario (고정 45% 너비) -->
          <div class="flex-none border-r-2 border-gray-300 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-800 p-6" style="width: 45%;">
            <div class="sticky top-0 bg-white dark:bg-gray-800 pb-4 border-b-2 border-gray-200 dark:border-gray-700 mb-4">
              <h4 class="text-lg font-bold text-purple-700 dark:text-purple-300">📄 지문</h4>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">현재 보고 있는 문제의 지문이 표시됩니다</p>
            </div>
            <div id="split-scenario-display" class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" style="font-family: 'Iropke Batang', serif;">
              ${convertMarkdownTablesToHtml(exams[0]?.questions[0]?.scenario || exams[0]?.scenario || '지문을 불러오는 중...')}
            </div>
          </div>

          <!-- Right Panel: Questions (고정 55% 너비) -->
          <div class="flex-none overflow-y-auto p-6" style="width: 55%;">
            <div class="space-y-8">
      ` : `
        <!-- Vertical View: 기존 카드형 레이아웃 -->
        <div class="w-full px-4 sm:px-6 lg:pl-8 lg:pr-[240px] py-6 pb-32">
          <div class="max-w-6xl mx-auto space-y-12">
      `}
            ${exams.map((exam, examIdx) => `
              <div id="case-${exam.id}" class="case-card bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-visible scroll-mt-4">
                <!-- Case 헤더 -->
                <div class="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-700 dark:to-indigo-700 px-6 py-3 shadow-md rounded-t-xl">
                  <div class="flex items-center justify-between">
                    <h4 class="text-lg font-bold text-gray-800 dark:text-white">문제 ${examIdx + 1}</h4>
                    <span class="text-sm bg-purple-200 dark:bg-white/30 px-3 py-1 rounded-full font-semibold text-gray-800 dark:text-white">
                      ${exam.questions.reduce((sum, q) => sum + q.score, 0)}점
                    </span>
                  </div>
                  <p class="text-sm mt-1 text-gray-700 dark:text-gray-200">${exam.topic}</p>
                </div>

                <!-- New Structure: Per-Question Scenario Card -->
                <div class="p-4 sm:p-6">
                  <div class="space-y-6">
                    ${exam.questions.map((q, qIdx) => {
                      // 이전 question의 scenario와 비교
                      const previousQ = qIdx > 0 ? exam.questions[qIdx - 1] : null;
                      const currentScenario = q.scenario || exam.scenario || '';
                      const previousScenario = previousQ ? (previousQ.scenario || exam.scenario || '') : null;
                      const isSameScenario = previousScenario && currentScenario === previousScenario;
                      const isFirstQuestion = qIdx === 0;

                      return `
                      <div id="question-${q.id}" class="question-item ${isSameScenario ? '' : 'scenario-changed'} border-2 ${isSameScenario ? 'border-gray-200 dark:border-gray-600' : 'border-orange-400 dark:border-orange-600'} rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-lg transition-all duration-300" data-scenario="${currentScenario.replace(/"/g, '&quot;')}">

                        <!-- Scenario Section (Vertical View only) -->
                        <div class="scenario-section ${activeViewMode === 'split' ? 'hidden' : ''} ${isSameScenario ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20'} border-b-2 ${isSameScenario ? 'border-green-200 dark:border-green-700' : 'border-orange-200 dark:border-orange-700'}">
                          <button
                            class="scenario-toggle w-full px-4 py-3 text-left flex items-center justify-between hover:bg-opacity-80 transition-colors"
                            data-question-id="${q.id}"
                            data-expanded="${!isSameScenario}"
                          >
                            <div class="flex items-center gap-2 flex-wrap">
                              <span class="px-3 py-1 ${isSameScenario ? 'bg-green-200 dark:bg-green-700' : 'bg-orange-200 dark:bg-orange-700'} ${isSameScenario ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'} text-xs font-bold rounded-full">
                                📄 지문
                              </span>
                              ${!isFirstQuestion && !isSameScenario ? '<span class="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded animate-pulse">⚠️ 상황 변경</span>' : ''}
                              ${isSameScenario ? '<span class="text-xs text-green-700 dark:text-green-300 font-semibold">(이전과 동일)</span>' : ''}
                            </div>
                            <span class="text-gray-600 dark:text-gray-400 text-sm scenario-arrow" data-question-id="${q.id}">
                              ${isSameScenario ? '▶' : '▼'}
                            </span>
                          </button>
                          <div
                            class="scenario-content px-4 pb-4 ${isSameScenario ? 'hidden' : ''}"
                            data-question-id="${q.id}"
                          >
                            <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" style="font-family: 'Iropke Batang', serif;">${convertMarkdownTablesToHtml(currentScenario)}</div>
                          </div>
                        </div>

                        <!-- Question Card -->
                        <div class="p-5">
                          <!-- 물음 헤더 -->
                          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <div class="flex items-center gap-2">
                              <span class="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-bold rounded-full">
                                물음 ${extractQuestionNumber(q.id)}
                              </span>
                              <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded">
                                ${q.score}점
                              </span>
                              ${q.type ? `<span class="px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-xs font-bold rounded">${q.type === 'Rule' ? '기준서' : '사례'}</span>` : ''}
                            </div>
                          </div>

                          <!-- 문제 -->
                          <div class="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                            <div class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap" style="font-family: 'Iropke Batang', serif;">${convertMarkdownTablesToHtml(q.question)}</div>
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
                          </div>
                        </div>
                      </div>
                    `}).join('')}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ${activeViewMode === 'split' ? `
            </div>
          </div>
        </div>
      ` : `
        </div>
      `}
    </div>

    </div>
  `;

  // 페이지 로드 시 이전 일시정지 상태 확인 및 종료 처리
  const pauseData = examService.getTimerPause(year);
  if (pauseData && Array.isArray(pauseData) && pauseData.length % 2 === 1) {
    // 마지막 일시정지 시작 시간만 있고 종료 시간이 없으면 종료 시간 추가
    const pauseEndTime = Date.now();
    examService.saveTimerPause(year, pauseEndTime);
  }

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

  // Desktop: Navigation buttons - 스크롤 이동
  const navButtons = container.querySelectorAll('#nav-grid button');
  const scrollContainer = document.getElementById('exam-scroll-area'); // 스크롤 컨테이너 명시

  navButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const targetId = exams[idx].id;
      const targetElement = container.querySelector(`#case-${targetId}`);
      if (targetElement && scrollContainer) {
        // scrollIntoView를 사용하여 간단하고 정확하게 이동
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Scenario Toggle 이벤트 리스너
  const scenarioToggles = container.querySelectorAll('.scenario-toggle');
  scenarioToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const questionId = toggle.dataset.questionId;
      const scenarioContent = container.querySelector(`.scenario-content[data-question-id="${questionId}"]`);
      const arrow = container.querySelector(`.scenario-arrow[data-question-id="${questionId}"]`);

      if (scenarioContent && arrow) {
        const isExpanded = toggle.dataset.expanded === 'true';

        if (isExpanded) {
          // 접기
          scenarioContent.classList.add('hidden');
          arrow.textContent = '▶';
          toggle.dataset.expanded = 'false';
        } else {
          // 펼치기
          scenarioContent.classList.remove('hidden');
          arrow.textContent = '▼';
          toggle.dataset.expanded = 'true';
        }
      }
    });
  });

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

  // View Mode Toggle 버튼
  const btnViewSplit = container.querySelector('#btn-view-split');
  const btnViewVertical = container.querySelector('#btn-view-vertical');

  if (btnViewSplit) {
    btnViewSplit.addEventListener('click', () => {
      examUIState.viewMode = 'split';
      renderExamPaper(container, year, apiKey, selectedModel);
    });
  }

  if (btnViewVertical) {
    btnViewVertical.addEventListener('click', () => {
      examUIState.viewMode = 'vertical';
      renderExamPaper(container, year, apiKey, selectedModel);
    });
  }

  // Split View: Question 카드 클릭 시 좌측 지문 업데이트
  if (activeViewMode === 'split') {
    const questionCards = container.querySelectorAll('.question-item');
    const scenarioDisplay = container.querySelector('#split-scenario-display');

    questionCards.forEach(card => {
      // textarea focus 시 지문 업데이트
      const textarea = card.querySelector('textarea');
      if (textarea && scenarioDisplay) {
        textarea.addEventListener('focus', () => {
          const scenario = card.dataset.scenario;
          if (scenario) {
            const decodedScenario = scenario.replace(/&quot;/g, '"');
            scenarioDisplay.innerHTML = convertMarkdownTablesToHtml(decodedScenario);
          }
        });
      }

      // 카드 클릭 시에도 업데이트
      card.addEventListener('click', (e) => {
        // textarea 클릭은 이미 위에서 처리되므로 제외
        if (e.target.tagName !== 'TEXTAREA' && scenarioDisplay) {
          const scenario = card.dataset.scenario;
          if (scenario) {
            const decodedScenario = scenario.replace(/&quot;/g, '"');
            scenarioDisplay.innerHTML = convertMarkdownTablesToHtml(decodedScenario);
          }
        }
      });
      
      // 답안 입력 시 실시간 반영 (노랑/녹색)
      if (textarea) {
        textarea.addEventListener('input', () => {
          updateQuickNavigation(year);
        });
      }
    });
  }

  // Responsive: Window resize 감지 (auto 모드일 때만)
  const handleResize = () => {
    if (examUIState.viewMode === 'auto') {
      const newViewMode = examUIState.getActiveViewMode();
      if (newViewMode !== activeViewMode) {
        // 뷰 모드가 변경되었으므로 다시 렌더링
        renderExamPaper(container, year, apiKey, selectedModel);
      }
    }
  };

  // 기존 리스너 제거 후 새로 등록 (중복 방지)
  window.removeEventListener('resize', handleResize);
  window.addEventListener('resize', handleResize);

  // 글자 수 카운터 업데이트
  updateCharCounters();

  // 플로팅 리모콘을 container 밖에 추가 (body에 직접)
  setupFloatingControls(exams, year);

  console.log('✅ [examUI.js] renderExamPaper - 렌더링 완료, viewMode:', activeViewMode);
}

/**
 * 플로팅 리모콘 설정 (container 밖에 별도로 추가)
 */
function setupFloatingControls(exams, year) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examUI.js:898',message:'setupFloatingControls called',data:{examsCount:exams?.length||0,year},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // 기존 플로팅 리모콘 제거
  const existingControls = document.getElementById('floating-controls-exam');
  if (existingControls) {
    existingControls.remove();
  }

  // 새 플로팅 리모콘 생성
  const floatingControls = document.createElement('div');
  floatingControls.id = 'floating-controls-exam';
  floatingControls.className = 'hidden md:flex fixed top-24 right-4 lg:right-6 z-[60] flex-col gap-3 transition-all duration-300 w-[180px] lg:w-[200px]';
  floatingControls.innerHTML = `
    <!-- Quick Navigation - Collapsible -->
    <div id="nav-panel" class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-purple-500 dark:border-purple-600 overflow-hidden">
      <button id="toggle-nav" class="w-full px-3 py-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 flex items-center justify-between text-xs font-semibold text-purple-700 dark:text-purple-300 transition-colors">
        <span>📌 바로가기</span>
        <span id="nav-arrow" class="transform transition-transform">▼</span>
      </button>
      <div id="nav-grid" class="p-2 grid grid-cols-4 gap-1.5">
        ${exams.map((exam, idx) => {
          // 이 케이스의 답안 상태 확인
          const answeredCount = exam.questions.filter(q => {
            const answer = examUIState.answers[q.id]?.answer;
            return answer && answer.trim() !== '';
          }).length;
          const totalCount = exam.questions.length;

          // 모두 채움(녹색), 일부만 채움(노랑), 하나도 안 채움(회색)
          let bgClass, textClass, ringClass, statusText;
          if (answeredCount === totalCount) {
            bgClass = 'bg-green-100 dark:bg-green-900/50';
            textClass = 'text-green-700 dark:text-green-300';
            ringClass = 'ring-2 ring-green-500';
            statusText = '완료';
          } else if (answeredCount > 0) {
            bgClass = 'bg-yellow-100 dark:bg-yellow-900/50';
            textClass = 'text-yellow-700 dark:text-yellow-300';
            ringClass = 'ring-2 ring-yellow-500';
            statusText = `${answeredCount}/${totalCount}`;
          } else {
            bgClass = 'bg-gray-100 dark:bg-gray-700';
            textClass = 'text-gray-700 dark:text-gray-300';
            ringClass = '';
            statusText = '';
          }

          return `
            <button
              class="aspect-square flex items-center justify-center ${bgClass} ${textClass} ${ringClass} hover:bg-purple-500 hover:text-white dark:hover:bg-purple-600 rounded-lg text-xs font-bold transition-all hover:scale-110"
              title="문제 ${idx + 1} ${statusText ? `(${statusText})` : ''}"
              data-case-idx="${idx}"
            >
              ${idx + 1}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // body에 추가
  document.body.appendChild(floatingControls);
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examUI.js:960',message:'Floating controls added to body',data:{elementId:floatingControls.id,className:floatingControls.className,examsCount:exams?.length||0,windowWidth:window.innerWidth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  // 이벤트 리스너 설정
  const toggleNavBtn = floatingControls.querySelector('#toggle-nav');
  const navGrid = floatingControls.querySelector('#nav-grid');
  const navArrow = floatingControls.querySelector('#nav-arrow');
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

  // Navigation buttons - 스크롤 이동
  const navButtons = floatingControls.querySelectorAll('#nav-grid button');
  navButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const caseCard = document.getElementById(`case-${exams[idx].id}`);
      if (caseCard) {
        const scrollArea = document.getElementById('exam-scroll-area');
        if (scrollArea) {
          scrollArea.scrollTo({
            top: caseCard.offsetTop - 20,
            behavior: 'smooth'
          });
        }
      }
    });
  });
}

/**
 * 타이머 시작
 */
function startTimer(year, timeLimit) {
  const timerDisplay = document.getElementById('timer-display');
  if (!timerDisplay) return;

  // 타이머 시작 시간이 없으면 저장 (처음 시작하는 경우)
  if (!examService.getTimerStart(year)) {
    examService.saveTimerStart(year);
  }

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
      examUIState.timerInterval = null;
      if (examUIState.timerCleanup) {
        examUIState.timerCleanup();
        examUIState.timerCleanup = null;
      }
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

  // 페이지가 보이지 않을 때 일시정지 처리
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // 탭이 숨겨지면 일시정지 시작
      if (!examUIState.isPaused) {
        examUIState.isPaused = true;
        examUIState.pauseStartTime = Date.now();
        examService.saveTimerPause(year, examUIState.pauseStartTime);
      }
    } else {
      // 탭이 다시 보이면 일시정지 종료
      if (examUIState.isPaused && examUIState.pauseStartTime) {
        examUIState.isPaused = false;
        const pauseEndTime = Date.now();
        examService.saveTimerPause(year, pauseEndTime);
        examUIState.pauseStartTime = null;
      }
    }
  };

  // 페이지를 떠날 때 일시정지 처리
  const handleBeforeUnload = () => {
    if (!examUIState.isPaused) {
      examUIState.isPaused = true;
      examUIState.pauseStartTime = Date.now();
      examService.saveTimerPause(year, examUIState.pauseStartTime);
    }
  };

  // 페이지가 다시 로드될 때 일시정지 종료 처리
  const handlePageShow = (e) => {
    // 페이지가 다시 로드되었을 때 이전 일시정지 종료 시간 저장
    const pauseData = examService.getTimerPause(year);
    if (pauseData && Array.isArray(pauseData) && pauseData.length % 2 === 1) {
      // 마지막 일시정지 시작 시간만 있고 종료 시간이 없으면 종료 시간 추가
      const pauseEndTime = Date.now();
      examService.saveTimerPause(year, pauseEndTime);
    }
    // examUIState도 업데이트
    if (examUIState.isPaused && examUIState.pauseStartTime) {
      examUIState.isPaused = false;
      examUIState.pauseStartTime = null;
    }
  };

  // 이벤트 리스너 등록
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pageshow', handlePageShow);

  // 타이머가 정리될 때 이벤트 리스너도 제거하도록 저장
  examUIState.timerCleanup = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pageshow', handlePageShow);
  };
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

      // Quick Navigation 실시간 업데이트
      updateQuickNavigation(year);
    });
  });
}

/**
 * Quick Navigation 답안 상태 실시간 업데이트
 */
function updateQuickNavigation(year) {
  const exams = examService.getExamByYear(year);
  const navGrid = document.getElementById('nav-grid');
  if (!navGrid) return;

  // 각 케이스 버튼의 상태를 업데이트
  exams.forEach((exam, idx) => {
    const answeredCount = exam.questions.filter(q => {
      const answer = examUIState.answers[q.id]?.answer;
      return answer && answer.trim() !== '';
    }).length;
    const totalCount = exam.questions.length;

    // 버튼 찾기 (idx로)
    const btn = navGrid.children[idx];
    if (!btn) return;

    // 기존 클래스 제거
    btn.className = btn.className.replace(/bg-\w+-\d+/g, '').replace(/text-\w+-\d+/g, '').replace(/ring-\d+/g, '').replace(/ring-\w+-\d+/g, '');

    // 새 상태에 따라 클래스 추가
    let bgClass, textClass, ringClass;
    if (answeredCount === totalCount) {
      bgClass = 'bg-green-100 dark:bg-green-900/50';
      textClass = 'text-green-700 dark:text-green-300';
      ringClass = 'ring-2 ring-green-500';
    } else if (answeredCount > 0) {
      bgClass = 'bg-yellow-100 dark:bg-yellow-900/50';
      textClass = 'text-yellow-700 dark:text-yellow-300';
      ringClass = 'ring-2 ring-yellow-500';
    } else {
      bgClass = 'bg-gray-100 dark:bg-gray-700';
      textClass = 'text-gray-700 dark:text-gray-300';
      ringClass = '';
    }

    btn.className = `aspect-square flex items-center justify-center ${bgClass} ${textClass} ${ringClass} hover:bg-purple-500 hover:text-white dark:hover:bg-purple-600 rounded-lg text-xs font-bold transition-all hover:scale-110`;
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

    // 버튼에 완료 피드백 표시
    tempSaveBtn.innerHTML = '<span class="text-xl">✅</span><span>저장완료</span>';
    tempSaveBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
    tempSaveBtn.classList.add('bg-green-500');

    // 1초 후 UI 새로고침
    setTimeout(() => {
      renderExamPaper(container, year, finalApiKey, finalModel);
    }, 1000);
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
    examUIState.timerInterval = null;
  }
  if (examUIState.timerCleanup) {
    examUIState.timerCleanup();
    examUIState.timerCleanup = null;
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

    // 결과 화면 렌더링 (examResultUI.js 사용)
    renderResultMode(container, year, result, apiKey, selectedModel, examUIState.viewMode);
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
 * renderExamPaper와 renderYearSelection을 export하여 examResultUI.js에서 사용 가능하도록
 */
export { renderExamPaper, renderYearSelection };
