/**
 * Past Exam Result UI - Vertical View
 * 채점 결과 화면 (버티컬 뷰 전용)
 */

import { examService } from './examService.js';

/**
 * 텍스트 정규화: 과도한 줄바꿈 완화 및 불필요한 들여쓰기 제거
 */
function normalizeText(text) {
  if (!text) return text;
  // 각 줄의 앞뒤 공백 제거
  const lines = text.split('\n').map(line => line.trim());
  // 빈 줄 제거 후 다시 결합
  const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  // 전체 텍스트의 앞뒤 공백 제거
  return cleaned.trim();
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
    
    // 테이블이 아니면 원본 텍스트 유지
    result += (i > 0 ? '\n' : '') + lines[i];
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
 * 채점 결과 화면 렌더링 (버티컬 뷰)
 */
export function renderResultMode(container, year, result, apiKey, selectedModel, inheritedViewMode = 'auto') {
  try {
    // 컨테이너 초기화 (스크롤 문제 해결: body 스크롤 방지)
    container.className = 'fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden';
    
    // body 스크롤 방지
    document.body.style.overflow = 'hidden';
    
    // 데이터 준비
    let exams = examService.getExamByYear(year);
    const metadata = examService.getMetadata(year);

    // ⚠️ 중요: exams 배열 자체를 정렬 (Q1, Q2, ..., Q10 순서)
    // "2025_Q1", "2025_Q10" 형식을 올바르게 처리하기 위해 extractQuestionNumbers 사용 필수
    // 이 정렬을 생략하면 문제가 1, 10, 2, 3, 4... 순서로 표시됨
    exams = [...exams].sort((a, b) => {
      const numsA = extractQuestionNumbers(a.id);
      const numsB = extractQuestionNumbers(b.id);
      const maxLen = Math.max(numsA.length, numsB.length);
      for (let i = 0; i < maxLen; i++) {
        const numA = numsA[i] || 0;
        const numB = numsB[i] || 0;
        if (numA !== numB) return numA - numB;
      }
      return 0;
    });

    // ⚠️ 중요: questions 정렬 보장 (Q1, Q2, ..., Q10 순서)
    // extractQuestionNumbers가 "2025_Q1" 형식을 올바르게 처리하는지 확인 필수
    exams = exams.map((exam, examIdx) => {
    const sortedQuestions = [...exam.questions].sort((a, b) => {
      const numsA = extractQuestionNumbers(a.id);
      const numsB = extractQuestionNumbers(b.id);
      
      const maxLen = Math.max(numsA.length, numsB.length);
      for (let i = 0; i < maxLen; i++) {
        const numA = numsA[i] || 0;
        const numB = numsB[i] || 0;
        if (numA !== numB) return numA - numB;
      }
      return 0;
    });
    
    return {
      ...exam,
      questions: sortedQuestions
    };
  });
  
const totalPossibleScore = examService.getTotalScore(year);
  const percentage = ((result.totalScore / totalPossibleScore) * 100).toFixed(1);
  const isPassing = result.totalScore >= metadata.passingScore;
  const scoreHistory = examService.getScores(year);
  const bestScore = examService.getBestScore(year);
  const userAnswers = examService.getUserAnswers(year);

  // 버티컬 뷰 HTML 생성
  container.innerHTML = `
    <!-- 고정 헤더 -->
    <header class="flex-none bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-700 dark:to-indigo-700 px-4 sm:px-6 py-4 shadow-lg">
      <div class="flex items-center justify-between">
        <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
          ${year}년 기출문제 채점 결과
        </h2>
        <div class="flex items-center gap-2 sm:gap-3">
          <span class="px-3 sm:px-4 py-1.5 sm:py-2 bg-white dark:bg-gray-800 rounded-lg font-bold text-sm sm:text-base">
            ${result.totalScore.toFixed(1)} / ${totalPossibleScore}점
          </span>
          <div class="relative inline-block">
            <button id="btn-export-pdf" class="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors flex items-center gap-1.5">
              📄 PDF <span class="text-xs">▼</span>
            </button>
            <div id="pdf-export-menu" class="hidden absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700" style="z-index: 99999;">
              <button class="pdf-export-option w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" data-options='{"includeScenario":true,"includeQuestion":true}'>
                📄 전체 내보내기
              </button>
              <button class="pdf-export-option w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" data-options='{"includeScenario":false,"includeQuestion":false}'>
                📄 지문, 물음 제외 (해설만)
              </button>
            </div>
          </div>
          <button id="btn-exit-results" class="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors">
            ✕ 종료
          </button>
        </div>
      </div>
    </header>

    <!-- 스크롤 가능한 메인 콘텐츠 -->
    <main class="flex-1 overflow-y-auto">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <!-- 총점 요약 카드 -->
        <section class="bg-gradient-to-r ${isPassing ? 'from-green-100 to-emerald-100 dark:from-green-800 dark:to-emerald-800' : 'from-red-100 to-rose-100 dark:from-red-800 dark:to-rose-800'} rounded-xl p-6 sm:p-8">
          <div class="text-center">
            <h3 class="text-xl sm:text-2xl font-bold mb-3 text-gray-800 dark:text-white">
              ${isPassing ? '🎉 합격 기준 충족!' : '💪 조금만 더 노력하면 합격!'}
            </h3>
            <p class="text-lg sm:text-xl text-gray-700 dark:text-gray-200 mb-2">
              총점: <span class="font-bold">${result.totalScore.toFixed(1)}점</span> / ${totalPossibleScore}점
            </p>
            <p class="text-base sm:text-lg text-gray-600 dark:text-gray-300">
              (${percentage}%)
            </p>
            ${bestScore !== null && bestScore !== result.totalScore ? `
              <p class="text-sm text-gray-600 dark:text-gray-300 mt-3">
                최고 점수: ${bestScore.toFixed(1)}점
              </p>
            ` : ''}
          </div>
        </section>

        <!-- 점수 히스토리 -->
        ${scoreHistory.length > 0 ? `
          <section class="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow">
            <h4 class="text-base sm:text-lg font-bold mb-4 text-gray-800 dark:text-white">
              📊 점수 히스토리 (${scoreHistory.length}번째 응시)
            </h4>
            <div class="flex gap-3 sm:gap-4 overflow-x-auto pb-2">
              ${scoreHistory.map((s, idx) => `
                <div class="flex flex-col items-center min-w-[70px] sm:min-w-[80px]">
                  <div class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">${idx + 1}회</div>
                  <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full ${s.score >= metadata.passingScore ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200'} flex items-center justify-center font-bold text-sm sm:text-base">
                    ${s.score.toFixed(1)}
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <!-- 문제별 상세 결과 -->
        ${exams.map((examCase, caseIdx) => `
          <section class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <!-- Case 헤더 -->
            <div class="bg-purple-700 dark:bg-purple-800 text-gray-900 dark:text-white px-4 sm:px-6 py-3 sm:py-4">
              <h3 class="text-lg sm:text-xl font-bold">문제 ${caseIdx + 1}: ${examCase.topic}</h3>
            </div>

            <!-- 문제별 결과 -->
            <div class="p-4 sm:p-6 space-y-4 sm:space-y-6">
              ${examCase.questions.map((question, qIdx) => {
                const feedback = result.details[question.id];
                const userAnswer = userAnswers[question.id]?.answer || '';
                const score = feedback?.score || 0;
                const scorePercent = question.score > 0 ? ((score / question.score) * 100) : 0;
                
                // 점수에 따른 색상 결정
                const borderColor = scorePercent >= 90 ? 'border-green-500' : scorePercent >= 50 ? 'border-yellow-500' : 'border-red-500';
                const scoreColor = scorePercent >= 90 ? 'text-green-600 dark:text-green-400' : scorePercent >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

                // 이전 question의 scenario와 비교
                const previousQ = qIdx > 0 ? examCase.questions[qIdx - 1] : null;
                const currentScenario = question.scenario || examCase.scenario || '';
                const previousScenario = previousQ ? (previousQ.scenario || examCase.scenario || '') : null;
                const isSameScenario = previousScenario && currentScenario === previousScenario;
                const isFirstQuestion = qIdx === 0;

                return `
                  <div class="border-2 ${borderColor} rounded-lg overflow-hidden">
                    <!-- Scenario Section (지문 토글) -->
                    ${currentScenario ? `
                      <div class="scenario-section ${isSameScenario ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20'} border-b-2 ${isSameScenario ? 'border-green-200 dark:border-green-700' : 'border-orange-200 dark:border-orange-700'}">
                        <button
                          class="scenario-toggle w-full px-4 py-3 text-left flex items-center justify-between hover:bg-opacity-80 transition-colors"
                          data-question-id="${question.id}"
                          data-expanded="${!isSameScenario}"
                        >
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-3 py-1 ${isSameScenario ? 'bg-green-200 dark:bg-green-700' : 'bg-orange-200 dark:bg-orange-700'} ${isSameScenario ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'} text-xs font-bold rounded-full">
                              📄 지문
                            </span>
                            ${!isFirstQuestion && !isSameScenario ? '<span class="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded animate-pulse">⚠️ 상황 변경</span>' : ''}
                            ${isSameScenario ? '<span class="text-xs text-green-700 dark:text-green-300 font-semibold">(이전과 동일)</span>' : ''}
                          </div>
                          <span class="text-gray-600 dark:text-gray-400 text-sm scenario-arrow" data-question-id="${question.id}">
                            ${isSameScenario ? '▶' : '▼'}
                          </span>
                        </button>
                        <div
                          class="scenario-content px-4 pb-4 ${isSameScenario ? 'hidden' : ''}"
                          data-question-id="${question.id}"
                        >
                          <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" style="font-family: 'Iropke Batang', serif;">${convertMarkdownTablesToHtml(currentScenario)}</div>
                        </div>
                      </div>
                    ` : ''}

                    <!-- 문제 카드 -->
                    <div class="p-4 sm:p-5 space-y-4">
                      <!-- 문제 헤더 -->
                      <div class="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                        <h5 class="font-bold text-base sm:text-lg text-gray-800 dark:text-white">
                          물음 ${extractQuestionNumber(question.id)} (${question.score}점)
                        </h5>
                        <span class="text-lg sm:text-xl font-bold ${scoreColor}">
                          ${score.toFixed(1)}점
                        </span>
                      </div>

                      <!-- 정답여부 및 점수히스토리 -->
                      <div class="mb-4 space-y-3">
                        <!-- 정답여부 -->
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">정답여부:</span>
                          ${scorePercent >= 90 ? 
                            '<span class="text-green-600 dark:text-green-400 font-bold">✅ 정답</span>' : 
                            scorePercent >= 50 ? 
                            '<span class="text-yellow-600 dark:text-yellow-400 font-bold">⚠️ 부분정답</span>' : 
                            '<span class="text-red-600 dark:text-red-400 font-bold">❌ 오답</span>'
                          }
                        </div>
                        
                        <!-- 점수 히스토리 -->
                        ${scoreHistory && Array.isArray(scoreHistory) && scoreHistory.length > 0 ? `
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">점수 히스토리:</span>
                            <div class="flex gap-2">
                              ${scoreHistory.slice(-5).map((s, idx) => {
                                try {
                                  const historyFeedback = s.details?.[question.id];
                                  const historyScore = historyFeedback?.score || 0;
                                  const historyPercent = question.score > 0 ? ((historyScore / question.score) * 100) : 0;
                                  const historyIdx = scoreHistory.length - 5 + idx;
                                  const isCurrent = historyIdx === scoreHistory.length - 1;
                                  const historyColor = historyPercent >= 90 ? 'bg-green-500' : historyPercent >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                  const ringClass = isCurrent ? 'ring-2 ring-purple-500' : '';
                                  
                                  return `
                                    <div class="relative group">
                                      <div class="w-10 h-10 ${historyColor} ${ringClass} rounded-full flex items-center justify-center text-white font-bold text-xs cursor-pointer transition-all hover:scale-110" 
                                           title="${historyIdx + 1}회전: ${historyScore.toFixed(1)}/${question.score}점">
                                        ${historyScore.toFixed(1)}
                                      </div>
                                    </div>
                                  `;
                                } catch (error) {
                                  console.error('점수 히스토리 렌더링 에러:', error);
                                  return '';
                                }
                              }).join('')}
                            </div>
                          </div>
                        ` : ''}
                      </div>

                      <!-- 문제 내용 -->
                      <div class="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded">
                        <h6 class="font-bold mb-2 text-sm sm:text-base text-gray-800 dark:text-white">📝 문제</h6>
                        <p class="text-sm sm:text-base break-words text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">${escapeHtml(question.question)}</p>
                      </div>

                    <!-- 내 답안 -->
                    <div class="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <h6 class="font-bold mb-2 text-sm sm:text-base text-blue-700 dark:text-blue-400">✍️ 내 답안</h6>
                      <p class="text-sm sm:text-base break-words text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
${userAnswer ? escapeHtml(normalizeText(userAnswer)) : '<em class="text-gray-500 dark:text-gray-400">작성하지 않음</em>'}
                      </p>
                    </div>

                    <!-- 모범 답안 -->
                    <div class="p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded">
                      <h6 class="font-bold mb-2 text-sm sm:text-base text-green-700 dark:text-green-400">📚 모범 답안</h6>
                      <p class="text-sm sm:text-base break-words text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">${escapeHtml(question.model_answer)}</p>
                    </div>

                    <!-- AI 피드백 -->
                    <div class="p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <h6 class="font-bold mb-2 text-sm sm:text-base text-purple-700 dark:text-purple-400">🎯 AI 선생님의 총평</h6>
                      <p class="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
${feedback?.feedback ? escapeHtml(normalizeText(feedback.feedback)) : '<span class="text-gray-500 dark:text-gray-400">채점 정보 없음</span>'}
                      </p>
                    </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>
        `).join('')}

        <!-- 하단 액션 버튼 -->
        <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pb-6 sm:pb-8 pt-4">
          <button id="retry-exam-btn" class="flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 bg-purple-700 hover:bg-purple-800 text-gray-900 dark:text-white font-bold text-base sm:text-lg rounded-xl shadow-lg transition-colors">
            🔄 다시 풀기
          </button>
          <button id="exit-exam-btn" class="flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 bg-gray-700 hover:bg-gray-800 text-gray-900 dark:text-white font-bold text-base sm:text-lg rounded-xl shadow-lg transition-colors">
            ✕ 종료하기
          </button>
        </div>

      </div>
    </main>

  `;

    // 이벤트 리스너 등록
    setupEventListeners(container, year, result, exams, metadata, userAnswers, apiKey, selectedModel);

    // 플로팅 리모콘을 container 밖에 추가 (body에 직접)
    setupFloatingControlsResult(exams, year, result, container);
  } catch (error) {
    console.error('❌ [examResultUI.js] renderResultMode 에러:', error);
    // 에러 발생 시 기본 화면 표시
    container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
        <header class="flex-none bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-700 dark:to-indigo-700 px-4 sm:px-6 py-4 shadow-lg">
          <div class="flex items-center justify-between">
            <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
              ${year}년 기출문제 채점 결과
            </h2>
            <button id="btn-exit-results" class="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm sm:text-base transition-colors">
              ✕ 종료
            </button>
          </div>
        </header>
        <main class="flex-1 overflow-y-auto flex items-center justify-center">
          <div class="text-center p-8">
            <p class="text-red-600 dark:text-red-400 text-lg mb-4">채점 결과를 불러오는 중 오류가 발생했습니다.</p>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">${error.message}</p>
            <button onclick="location.reload()" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
              페이지 새로고침
            </button>
          </div>
        </main>
      </div>
    `;
    // 종료 버튼 이벤트 리스너
    container.querySelector('#btn-exit-results')?.addEventListener('click', async () => {
      document.body.style.overflow = '';
      const { renderYearSelection } = await import('./examUI.js');
      renderYearSelection(container);
    });
  }
}

/**
 * 플로팅 리모콘 설정 (채점결과 화면용)
 */
function setupFloatingControlsResult(exams, year, result, container) {
  // 기존 플로팅 리모콘 제거
  const existingControls = document.getElementById('floating-controls-result');
  if (existingControls) {
    existingControls.remove();
  }

  // scoreHistory 가져오기 (문제 바로가기에서 사용)
  const scoreHistory = examService.getScores(year);

  // 새 플로팅 리모콘 생성
  const floatingControls = document.createElement('div');
  floatingControls.id = 'floating-controls-result';
  // 데스크톱에서만 표시 (JavaScript로 직접 제어)
  const isDesktop = window.innerWidth >= 768; // md breakpoint
  // 헤더 높이 계산 (헤더는 약 80-100px, 여유 공간 포함하여 120px로 설정)
  const header = container.querySelector('header');
  const headerHeight = header ? header.offsetHeight : 100;
  floatingControls.className = `${isDesktop ? 'flex' : 'hidden'} fixed right-4 lg:right-6 flex-col gap-3 transition-all duration-300 w-[180px] lg:w-[200px]`;
  floatingControls.style.top = `${headerHeight + 20}px`; // 헤더 아래 20px 여유 공간
  floatingControls.style.zIndex = '9999'; // 명시적으로 높은 z-index 설정
  
  floatingControls.innerHTML = `
    <!-- Quick Navigation - Collapsible -->
    <div id="nav-panel" class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-purple-500 dark:border-purple-600 overflow-hidden">
      <button id="toggle-nav" class="w-full px-3 py-2 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 flex items-center justify-between text-xs font-semibold text-purple-700 dark:text-purple-300 transition-colors">
        <span>📌 문제 바로가기</span>
        <span id="nav-arrow" class="transform transition-transform">▼</span>
      </button>
      <div id="nav-grid" class="p-2 grid grid-cols-4 gap-1.5">
        ${exams.map((exam, idx) => {
          // 각 케이스의 평균 점수 계산
          const caseQuestions = exam.questions;
          let totalScore = 0;
          let totalPossible = 0;
          
          caseQuestions.forEach(q => {
            const feedback = result.details[q.id];
            const score = feedback?.score || 0;
            totalScore += score;
            totalPossible += q.score;
          });
          
          const avgPercent = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
          
          // 점수에 따른 색상 결정 (90점 이상: 녹색, 50점 이상: 노랑, 미만: 빨강)
          let bgClass, textClass, ringClass;
          if (avgPercent >= 90) {
            bgClass = 'bg-green-100 dark:bg-green-900/50';
            textClass = 'text-green-700 dark:text-green-300';
            ringClass = 'ring-2 ring-green-500';
          } else if (avgPercent >= 50) {
            bgClass = 'bg-yellow-100 dark:bg-yellow-900/50';
            textClass = 'text-yellow-700 dark:text-yellow-300';
            ringClass = 'ring-2 ring-yellow-500';
          } else {
            bgClass = 'bg-red-100 dark:bg-red-900/50';
            textClass = 'text-red-700 dark:text-red-300';
            ringClass = 'ring-2 ring-red-500';
          }

          return `
            <button
              class="result-nav-btn aspect-square flex items-center justify-center ${bgClass} ${textClass} ${ringClass} hover:bg-purple-500 hover:text-white dark:hover:bg-purple-600 rounded-lg text-xs font-bold transition-all hover:scale-110"
              data-case-idx="${idx}"
              title="문제 ${idx + 1} (${avgPercent.toFixed(0)}점)"
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
  
  // 이벤트 리스너 설정
  const toggleNavBtn = floatingControls.querySelector('#toggle-nav');
  const navGrid = floatingControls.querySelector('#nav-grid');
  const navArrow = floatingControls.querySelector('#nav-arrow');

  if (toggleNavBtn && navGrid && navArrow) {
    toggleNavBtn.addEventListener('click', () => {
      const isExpanded = navGrid.style.display !== 'none';
      if (isExpanded) {
        navGrid.style.display = 'none';
        navArrow.textContent = '▶';
      } else {
        navGrid.style.display = 'grid';
        navArrow.textContent = '▼';
      }
    });
  }

  // 문제 바로가기 버튼 클릭
  floatingControls.querySelectorAll('.result-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const caseIdx = parseInt(btn.dataset.caseIdx, 10);
      const targetSection = container.querySelector(`section:nth-of-type(${caseIdx + 3})`); // 총점, 히스토리 다음부터
      if (targetSection) {
        const main = container.querySelector('main');
        if (main) {
          main.scrollTo({
            top: targetSection.offsetTop - 20,
            behavior: 'smooth'
          });
        }
      }
    });
  });
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners(container, year, result, exams, metadata, userAnswers, apiKey, selectedModel) {
  // 종료 버튼
  const exitResultsBtn = container.querySelector('#btn-exit-results');
  if (exitResultsBtn) {
    exitResultsBtn.replaceWith(exitResultsBtn.cloneNode(true)); // 기존 리스너 제거
    container.querySelector('#btn-exit-results')?.addEventListener('click', async () => {
      document.body.style.overflow = ''; // body 스크롤 복원
      const { exitExamMode } = await import('./examIntegration.js');
      exitExamMode();
    });
  }

  // 다시 풀기 버튼
  const retryBtn = container.querySelector('#retry-exam-btn');
  if (retryBtn) {
    retryBtn.replaceWith(retryBtn.cloneNode(true)); // 기존 리스너 제거
    container.querySelector('#retry-exam-btn')?.addEventListener('click', async () => {
      examService.clearUserAnswers(year);
      examService.clearTimer(year);
      const { renderExamPaper } = await import('./examUI.js');
      renderExamPaper(container, year, apiKey, selectedModel);
    });
  }

  // 종료하기 버튼
  const exitBtn = container.querySelector('#exit-exam-btn');
  if (exitBtn) {
    exitBtn.replaceWith(exitBtn.cloneNode(true)); // 기존 리스너 제거
    container.querySelector('#exit-exam-btn')?.addEventListener('click', async () => {
      document.body.style.overflow = ''; // body 스크롤 복원
      const { renderYearSelection } = await import('./examUI.js');
      renderYearSelection(container);
    });
  }

  // Scenario Toggle 이벤트 리스너 (지문 토글)
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

  // PDF 내보내기 버튼 (헤더) - 드롭다운 메뉴
  const pdfExportBtn = container.querySelector('#btn-export-pdf');
  const pdfExportMenu = container.querySelector('#pdf-export-menu');
  
  if (pdfExportBtn && pdfExportMenu) {
    // 기존 이벤트 리스너 제거를 위해 부모 요소에서 교체
    const pdfExportContainer = pdfExportBtn.parentElement;
    if (pdfExportContainer) {
      pdfExportContainer.replaceWith(pdfExportContainer.cloneNode(true));
    }
    
    const newPdfExportBtn = container.querySelector('#btn-export-pdf');
    const newPdfExportMenu = container.querySelector('#pdf-export-menu');
    
    if (newPdfExportBtn && newPdfExportMenu) {
      // 드롭다운 메뉴를 body에 직접 추가하고 fixed positioning 사용
      const menuClone = newPdfExportMenu.cloneNode(true);
      menuClone.id = 'pdf-export-menu-floating';
      menuClone.style.position = 'fixed';
      menuClone.style.zIndex = '99999';
      document.body.appendChild(menuClone);
      
      // 원본 메뉴는 숨김
      newPdfExportMenu.style.display = 'none';
      
      // 버튼 클릭 시 메뉴 토글 및 위치 계산
      newPdfExportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menuClone.classList.contains('hidden');
        menuClone.classList.toggle('hidden');
        
        if (!isHidden) {
          // 메뉴 표시 시 버튼 위치에 맞춰 배치
          const btnRect = newPdfExportBtn.getBoundingClientRect();
          menuClone.style.right = `${window.innerWidth - btnRect.right}px`;
          menuClone.style.top = `${btnRect.bottom + 4}px`;
        }
      });
      
      // 메뉴 외부 클릭 시 닫기
      const handleOutsideClick = (e) => {
        if (newPdfExportBtn && menuClone && 
            !newPdfExportBtn.contains(e.target) && !menuClone.contains(e.target)) {
          menuClone.classList.add('hidden');
        }
      };
      document.addEventListener('click', handleOutsideClick);
      
      // 옵션 선택 시 PDF 내보내기
      const options = menuClone.querySelectorAll('.pdf-export-option');
      options.forEach(option => {
        option.addEventListener('click', async (e) => {
          e.stopPropagation();
          menuClone.classList.add('hidden');
          const optionsData = JSON.parse(option.dataset.options);
          await handlePdfExport(year, result, exams, metadata, userAnswers, optionsData);
        });
      });
    }
  }


  // 플로팅 리모콘은 setupFloatingControlsResult에서 처리됨
}

/**
 * PDF 내보내기 처리
 */
async function handlePdfExport(year, result, exams, metadata, userAnswers, options = { includeScenario: true, includeQuestion: true }) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:700',message:'handlePdfExport called',data:{year,yearType:typeof year,resultKeys:Object.keys(result),examsLength:exams?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  try {
    // 점수 히스토리 추가
    const scoreHistory = examService.getScores(year);
    const resultWithHistory = {
      ...result,
      scoreHistory: scoreHistory
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:707',message:'Before import',data:{scoreHistoryLength:scoreHistory?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // PDF 내보내기 함수 호출
    const { exportExamResultsToPdf } = await import('./examPdfExport.js');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:711',message:'Before exportExamResultsToPdf call',data:{hasExportFunction:typeof exportExamResultsToPdf === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // questionScores 가져오기
    const { getQuestionScores } = await import('../../core/stateManager.js');
    const questionScores = getQuestionScores();
    
    await exportExamResultsToPdf(year, resultWithHistory, exams, metadata, userAnswers, questionScores, options);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:713',message:'exportExamResultsToPdf completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:715',message:'PDF export error caught',data:{errorMessage:error.message,errorStack:error.stack,errorName:error.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.error('PDF 내보내기 실패:', error);
    alert('PDF 내보내기 중 오류가 발생했습니다: ' + error.message);
  }
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
 * ⚠️ 중요: "2025_Q1", "2025_Q10" 형식을 올바르게 처리해야 함
 * 이 함수를 수정할 때는 examData.js의 extractQuestionNumbers와 동일한 로직 유지 필수
 * 
 * 예: "Q10-1-2" -> [10, 1, 2]
 *     "Q1-2-3" -> [1, 2, 3]
 *     "2025_Q1" -> [1]
 *     "2025_Q10" -> [10]
 * 
 * 만약 이 함수가 "2025_Q1" 형식을 처리하지 못하면:
 * - 모든 exam이 [0]으로 파싱되어 정렬이 작동하지 않음
 * - 문제가 1, 10, 2, 3, 4... 순서로 표시됨
 */
function extractQuestionNumbers(questionId) {
  // "Q" 또는 "_Q" 이후 부분만 추출
  // ⚠️ 단순히 replace(/^Q/i, '')만 사용하면 "2025_Q1" 형식을 처리하지 못함
  let qPart = questionId;
  const qMatch = questionId.match(/[_-]?Q(.+)$/i);
  if (qMatch) {
    qPart = qMatch[1]; // "Q" 이후 부분만
  } else if (questionId.startsWith('Q') || questionId.startsWith('q')) {
    qPart = questionId.replace(/^Q/i, '');
  }
  
  // "-"로 분리하여 숫자 추출
  const parts = qPart.split('-');
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
