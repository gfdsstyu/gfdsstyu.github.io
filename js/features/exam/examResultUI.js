/**
 * Past Exam Result UI - Vertical View
 * 채점 결과 화면 (버티컬 뷰 전용)
 */

import { examService } from './examService.js';

/**
 * 텍스트 정규화: 과도한 줄바꿈 완화
 */
function normalizeText(text) {
  if (!text) return text;
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
  // 컨테이너 초기화 (스크롤 문제 해결: body 스크롤 방지)
  container.className = 'fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden';
  
  // body 스크롤 방지
  document.body.style.overflow = 'hidden';
  
  // 데이터 준비
  let exams = examService.getExamByYear(year);
  const metadata = examService.getMetadata(year);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:173',message:'Before sort - exam questions IDs',data:{exam0Questions:exams[0]?.questions?.map(q=>q.id)||[],exam0Count:exams[0]?.questions?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  // questions 정렬 보장 (Q1, Q2, ..., Q10 순서)
  exams = exams.map((exam, examIdx) => {
    const sortedQuestions = [...exam.questions].sort((a, b) => {
      const numsA = extractQuestionNumbers(a.id);
      const numsB = extractQuestionNumbers(b.id);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:180',message:'Sort comparison',data:{aId:a.id,bId:b.id,numsA,numsB},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      const maxLen = Math.max(numsA.length, numsB.length);
      for (let i = 0; i < maxLen; i++) {
        const numA = numsA[i] || 0;
        const numB = numsB[i] || 0;
        if (numA !== numB) return numA - numB;
      }
      return 0;
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:195',message:'After sort - exam questions IDs',data:{examIdx,sortedIds:sortedQuestions.map(q=>q.id),originalIds:exam.questions.map(q=>q.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    return {
      ...exam,
      questions: sortedQuestions
    };
  });
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:202',message:'Final exams questions IDs',data:{exam0Questions:exams[0]?.questions?.map(q=>q.id)||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
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
            ${bestScore && bestScore.score !== result.totalScore ? `
              <p class="text-sm text-gray-600 dark:text-gray-300 mt-3">
                최고 점수: ${bestScore.score.toFixed(1)}점
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
            <div class="bg-purple-700 dark:bg-purple-800 text-white px-4 sm:px-6 py-3 sm:py-4">
              <h3 class="text-lg sm:text-xl font-bold">문제 ${caseIdx + 1}: ${examCase.topic}</h3>
            </div>

            <!-- 문제별 결과 -->
            <div class="p-4 sm:p-6 space-y-4 sm:space-y-6">
              ${examCase.questions.map((question, qIdx) => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:270',message:'Rendering question',data:{caseIdx,questionId:question.id,qIdx,allIds:examCase.questions.map(q=>q.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
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

                      <!-- 문제 내용 -->
                      <div class="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded">
                        <h6 class="font-bold mb-2 text-sm sm:text-base text-gray-800 dark:text-white">📝 문제</h6>
                        <p class="text-sm sm:text-base break-words text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">${escapeHtml(question.question)}</p>
                      </div>

                    <!-- 내 답안 -->
                    <div class="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <h6 class="font-bold mb-2 text-sm sm:text-base text-blue-700 dark:text-blue-400">✍️ 내 답안</h6>
                      <p class="text-sm sm:text-base break-words text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        ${userAnswer ? escapeHtml(userAnswer) : '<em class="text-gray-500 dark:text-gray-400">작성하지 않음</em>'}
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
                        ${feedback?.feedback ? escapeHtml(feedback.feedback) : '<span class="text-gray-500 dark:text-gray-400">채점 정보 없음</span>'}
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
          <button id="retry-exam-btn" class="flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 bg-purple-700 hover:bg-purple-800 text-white font-bold text-base sm:text-lg rounded-xl shadow-lg transition-colors">
            🔄 다시 풀기
          </button>
          <button id="exit-exam-btn" class="flex-1 sm:flex-none px-6 sm:px-8 py-3 sm:py-4 bg-gray-700 hover:bg-gray-800 text-white font-bold text-base sm:text-lg rounded-xl shadow-lg transition-colors">
            ✕ 종료하기
          </button>
        </div>

      </div>
    </main>

  `;

  // 이벤트 리스너 등록
  setupEventListeners(container, year, apiKey, selectedModel);

  // 플로팅 리모콘을 container 밖에 추가 (body에 직접)
  setupFloatingControlsResult(exams, year, result);
}

/**
 * 플로팅 리모콘 설정 (채점결과 화면용)
 */
function setupFloatingControlsResult(exams, year, result) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:413',message:'setupFloatingControlsResult called',data:{examsCount:exams?.length||0,year},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // 기존 플로팅 리모콘 제거
  const existingControls = document.getElementById('floating-controls-result');
  if (existingControls) {
    existingControls.remove();
  }

  // 새 플로팅 리모콘 생성
  const floatingControls = document.createElement('div');
  floatingControls.id = 'floating-controls-result';
  floatingControls.className = 'hidden md:flex fixed top-24 right-4 lg:right-6 z-[60] flex-col gap-3 transition-all duration-300 w-[180px] lg:w-[200px]';
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:421',message:'Creating floating controls HTML',data:{examsCount:exams?.length||0,hasExams:!!exams&&exams.length>0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
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
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:470',message:'Floating controls added to body',data:{elementId:floatingControls.id,className:floatingControls.className,examsCount:exams?.length||0,windowWidth:window.innerWidth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

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
function setupEventListeners(container, year, apiKey, selectedModel) {
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

  // 플로팅 리모콘은 setupFloatingControlsResult에서 처리됨
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
  const result = parts.map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examResultUI.js:575',message:'extractQuestionNumbers',data:{questionId,parts,result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  return result;
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
