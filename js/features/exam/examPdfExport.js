/**
 * Exam Results PDF Export
 * 채점 결과를 PDF로 내보내는 기능
 */

import { examService } from './examService.js';

/**
 * 채점 결과를 PDF로 내보내기
 * @param {number} year - 연도
 * @param {Object} result - 채점 결과 { totalScore, details, timestamp }
 * @param {Array} exams - 시험 데이터 배열
 * @param {Object} metadata - 메타데이터 { totalScore, passingScore, timeLimit }
 * @param {Object} userAnswers - 사용자 답안 객체
 */
/**
 * 텍스트를 안전하게 처리 (null, undefined, 특수문자 처리)
 */
function safeText(text) {
  if (text === null || text === undefined) return '';
  try {
    const str = String(text);
    // null 문자 및 제어 문자 제거
    return str.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '');
  } catch (error) {
    console.error('safeText 오류:', error, text);
    return '';
  }
}

export async function exportExamResultsToPdf(year, result, exams, metadata, userAnswers, questionScores = null, options = { includeScenario: true, includeQuestion: true, includeFeedback: true }) {
  try {
    // window.print() 방식 사용 (reportCore.js 참고)

    // questionScores 가져오기 (전달되지 않은 경우 window에서 가져오기)
    let qScores = questionScores;
    if (!qScores || Object.keys(qScores).length === 0) {
      if (typeof window !== 'undefined' && window.questionScores) {
        qScores = window.questionScores;
      } else {
        qScores = {};
      }
    }

    // HTML 생성
    const pdfHtml = generatePdfHtml(year, result, exams, metadata, userAnswers, qScores, options);

    // HTML이 비어있으면 에러
    if (!pdfHtml || pdfHtml.length < 100) {
      console.error('❌ [PDF Export] HTML이 비어있습니다! 길이:', pdfHtml?.length);
      throw new Error('PDF 내용이 비어있습니다. 채점 결과를 다시 확인해주세요.');
    }

    // 새 창 열기
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      throw new Error('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examPdfExport.js:50',message:'Print window opened',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // 새 창에 HTML 작성
    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${year}년 기출문제 채점결과</title>
        <link rel="preconnect" href="https://cdn.jsdelivr.net">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css" />
        <script>
          // 폰트 로드 대기 후 인쇄
          window.addEventListener('load', function() {
            // 폰트가 로드될 때까지 추가 대기
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(function() {
                setTimeout(function() {
                  try {
                    window.print();
                  } catch (error) {
                    console.error('인쇄 오류:', error);
                    alert('인쇄 중 오류가 발생했습니다. 브라우저의 인쇄 기능을 직접 사용해주세요.');
                  }
                }, 500);
              });
            } else {
              setTimeout(function() {
                try {
                  window.print();
                } catch (error) {
                  console.error('인쇄 오류:', error);
                  alert('인쇄 중 오류가 발생했습니다. 브라우저의 인쇄 기능을 직접 사용해주세요.');
                }
              }, 1000);
            }
          });
          
          // afterprint 이벤트 처리
          window.addEventListener('afterprint', function() {
            setTimeout(function() {
              window.close();
            }, 100);
          });
        </script>
        <style>
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', '맑은 고딕', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 0;
            margin: 0;
          }
          @page {
            margin: 1.5cm;
            size: A4;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${pdfHtml}
      </body>
      </html>
    `);
    printWindow.document.close();
    
    // 인쇄는 새 창 내부의 스크립트에서 처리됨 (window.load 이벤트에서)
    // 폰트 로드 및 렌더링 완료 후 자동으로 print() 호출
    printWindow.focus();

  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examPdfExport.js:305',message:'PDF export error',data:{errorMessage:error.message,errorStack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('PDF 내보내기 실패:', error);
    alert('PDF 내보내기 중 오류가 발생했습니다: ' + error.message);
  }
}

/**
 * 텍스트를 여러 줄로 나누어 추가 (자동 줄바꿈)
 */
function addWrappedText(doc, text, x, y, maxWidth, lineHeight) {
  const safeTextValue = safeText(text);
  if (!safeTextValue) return y;
  
  try {
    // jsPDF의 splitTextToSize는 문자열을 받아야 함
    const textStr = String(safeTextValue);
    const lines = doc.splitTextToSize(textStr, maxWidth);
    
    if (!Array.isArray(lines)) {
      // splitTextToSize가 배열이 아닌 경우 (단일 문자열)
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(lines), x, y);
      return y + lineHeight;
    }
    
    lines.forEach((line, idx) => {
      if (y > 280) { // 페이지 끝 체크
        doc.addPage();
        y = 15;
      }
      // 각 줄을 안전하게 처리
      const safeLine = safeText(line);
      if (safeLine) {
        doc.text(safeLine, x, y);
      }
      y += lineHeight;
    });
  } catch (error) {
    console.error('텍스트 추가 오류:', error, text);
    // 오류 발생 시 빈 줄만 추가
    y += lineHeight;
  }
  return y;
}

/**
 * 텍스트를 지정된 너비에 맞게 자르기
 */
function truncateText(doc, text, maxWidth) {
  const safeTextValue = safeText(text);
  if (!safeTextValue) return '';
  try {
    const lines = doc.splitTextToSize(safeTextValue, maxWidth);
    return lines[0] + (lines.length > 1 ? '...' : '');
  } catch (error) {
    console.error('텍스트 자르기 오류:', error, text);
    return safeTextValue.substring(0, 50) + '...';
  }
}

/**
 * Question ID에서 표시용 번호 추출
 */
function extractQuestionNumber(questionId) {
  return questionId.replace(/^Q/i, '');
}

/**
 * PDF용 HTML 생성
 */
function generatePdfHtml(year, result, exams, metadata, userAnswers, questionScores = {}, options = { includeScenario: true, includeQuestion: true, includeFeedback: true }) {
  // 안전하게 options 처리
  const safeOptions = {
    includeScenario: true,
    includeQuestion: true,
    includeFeedback: true,
    ...options
  };

  const totalPossibleScoreRaw = metadata.totalScore || 100;
  const totalPossibleScore = Math.round(totalPossibleScoreRaw * 10) / 10; // 소수점 첫째자리로 반올림
  const roundedScore = Math.round(result.totalScore * 10) / 10; // 소수점 첫째자리로 반올림
  const percentage = Math.round((roundedScore / totalPossibleScore) * 100 * 10) / 10; // 소수점 첫째자리로 반올림
  const isPassing = roundedScore >= (metadata.passingScore || 60);
  const scoreHistory = result.scoreHistory || [];

  // HTML body 내용만 생성 (DOCTYPE과 html 태그 제거, LINK 태그 제거하고 스타일 인라인으로)
  let html = `
    <div style="font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11pt; line-height: 1.6; color: #333; padding: 0; margin: 0; background: white; width: 794px; box-sizing: border-box;">
      <style>
        * {
          box-sizing: border-box;
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', '맑은 고딕', sans-serif;
        }
        .cover-page {
          page-break-after: always;
          text-align: center;
          padding: 40mm 20mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          min-height: 250mm;
          background: white;
        }
        .cover-title {
          font-size: 28pt;
          font-weight: bold;
          margin-bottom: 20mm;
          color: #6D28D9;
        }
        .cover-subtitle {
          font-size: 18pt;
          margin-bottom: 30mm;
          color: #555;
        }
        .cover-score {
          font-size: 36pt;
          font-weight: bold;
          margin: 20mm 0;
          color: ${isPassing ? '#16A34A' : '#DC2626'};
        }
        .cover-status {
          font-size: 16pt;
          color: ${isPassing ? '#16A34A' : '#DC2626'};
          margin-top: 10mm;
        }
        .section {
          page-break-inside: avoid;
          margin-bottom: 5mm;
        }
        .section-title {
          font-size: 16pt;
          font-weight: bold;
          color: #6D28D9;
          margin-bottom: 8mm;
          padding-bottom: 4mm;
          border-bottom: 2px solid #6D28D9;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4mm;
          margin-bottom: 5mm;
        }
        .summary-card {
          background: #F9FAFB;
          padding: 8mm;
          border-radius: 4mm;
          border: 1px solid #E5E7EB;
        }
        .summary-label {
          font-size: 10pt;
          color: #6B7280;
          margin-bottom: 2mm;
        }
        .summary-value {
          font-size: 18pt;
          font-weight: bold;
          color: #111827;
        }
        .case-section {
          margin-bottom: 10mm;
        }
        .case-section {
          margin-bottom: 5mm;
          page-break-before: auto;
        }
        .case-section:first-of-type {
          margin-top: 3mm;
        }
        .case-header {
          background: #6D28D9;
          color: #111827;
          padding: 4mm;
          border-radius: 4mm 4mm 0 0;
          font-size: 14pt;
          font-weight: bold;
          page-break-after: avoid;
          margin-bottom: 0;
          padding-bottom: 3mm;
        }
        .question-card {
          border: 1px solid #E5E7EB;
          border-top: none;
          padding: 3mm;
          page-break-inside: avoid;
          margin-top: 0;
        }
        .question-card:first-of-type {
          border-top: 1px solid #E5E7EB;
          border-radius: 0;
          margin-top: 0;
        }
        .question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2mm;
          padding-bottom: 1mm;
          border-bottom: 1px solid #E5E7EB;
        }
        .question-title {
          font-size: 13pt;
          font-weight: bold;
          color: #111827;
        }
        .question-score {
          font-size: 16pt;
          font-weight: bold;
          color: #6D28D9;
        }
        .content-box {
          margin-bottom: 2mm;
          padding: 3mm;
          border-radius: 3mm;
          border-left: 4px solid;
        }
        .content-box.scenario {
          background: #FFF7ED;
          border-left-color: #F97316;
        }
        .content-box.question {
          background: #F9FAFB;
          border-left-color: #6B7280;
        }
        .content-box.user-answer {
          background: #EFF6FF;
          border-left-color: #3B82F6;
        }
        .content-box.model-answer {
          background: #F0FDF4;
          border-left-color: #22C55E;
        }
        .content-box.feedback {
          background: #FAF5FF;
          border-left-color: #A855F7;
        }
        .content-label {
          font-size: 10pt;
          font-weight: bold;
          margin-bottom: 1mm;
          color: #374151;
        }
        .content-text {
          font-size: 10pt;
          line-height: 1.5;
          color: #111827;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .content-text table {
          width: 100%;
          border-collapse: collapse;
          margin: 2mm 0;
          font-size: 9pt;
        }
        .content-text table th,
        .content-text table td {
          border: 1px solid #D1D5DB;
          padding: 2mm;
        }
        .content-text table th {
          background: #F3F4F6;
          font-weight: bold;
        }
        .question-history {
          margin-top: 3mm;
          padding: 3mm;
          background: #F9FAFB;
          border-radius: 3mm;
          border: 1px solid #E5E7EB;
        }
        .question-history-title {
          font-size: 9pt;
          font-weight: bold;
          color: #6B7280;
          margin-bottom: 2mm;
        }
        .question-history-items {
          display: flex;
          gap: 3mm;
          flex-wrap: wrap;
        }
        .question-history-item {
          font-size: 9pt;
          color: #374151;
        }
        .score-badge {
          display: inline-block;
          padding: 2mm 6mm;
          border-radius: 3mm;
          font-size: 10pt;
          font-weight: bold;
          margin-left: 4mm;
        }
        .score-badge.excellent {
          background: #D1FAE5;
          color: #065F46;
        }
        .score-badge.good {
          background: #FEF3C7;
          color: #92400E;
        }
        .score-badge.poor {
          background: #FEE2E2;
          color: #991B1B;
        }
        .history-chart {
          display: flex;
          gap: 6mm;
          margin-top: 6mm;
          flex-wrap: wrap;
          justify-content: flex-start;
        }
        .history-item {
          text-align: center;
          min-width: 25mm;
        }
        .history-circle {
          width: 25mm;
          height: 25mm;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12pt;
          margin: 0 auto 3mm;
          border: 2px solid;
        }
        .history-circle.pass {
          background: #D1FAE5;
          color: #065F46;
        }
        .history-circle.fail {
          background: #FEE2E2;
          color: #991B1B;
        }
        .history-label {
          font-size: 9pt;
          color: #6B7280;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 4mm 0;
        }
        th, td {
          padding: 3mm;
          text-align: left;
          border: 1px solid #E5E7EB;
        }
        th {
          background: #F9FAFB;
          font-weight: bold;
          font-size: 10pt;
        }
        td {
          font-size: 10pt;
        }
        .footer {
          margin-top: 20mm;
          padding-top: 8mm;
          border-top: 1px solid #E5E7EB;
          text-align: center;
          font-size: 9pt;
          color: #6B7280;
        }
      </style>
    </head>
    <body>
      <!-- 표지 -->
      <div class="cover-page">
        <div class="cover-title">${year}년 기출문제</div>
        <div class="cover-subtitle">채점 결과 리포트</div>
        <div class="cover-score">${roundedScore.toFixed(1)} / ${totalPossibleScore.toFixed(1)}점</div>
        <div class="cover-status">${isPassing ? '✅ 합격 기준 충족' : '💪 조금만 더 노력하면 합격!'}</div>
        <div style="margin-top: 15mm; font-size: 11pt; color: #6B7280;">
          생성일: ${new Date(result.timestamp || Date.now()).toLocaleString('ko-KR')}
        </div>
      </div>

      <!-- 요약 섹션 -->
      <div class="section">
        <div class="section-title">📊 채점 요약</div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">총점</div>
            <div class="summary-value">${roundedScore.toFixed(1)}점</div>
            <div style="font-size: 11pt; color: #6B7280; margin-top: 2mm;">
              만점 대비 ${percentage.toFixed(1)}%
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-label">합격 기준</div>
            <div class="summary-value">${metadata.passingScore || 60}점</div>
          </div>
        </div>
      </div>

      ${scoreHistory.length > 0 ? `
      <div class="section">
        <div class="section-title">📈 점수 히스토리</div>
        <div class="history-chart">
          ${scoreHistory.slice(-10).map((s, idx) => {
            const isPass = s.score >= (metadata.passingScore || 60);
            return `
              <div class="history-item">
                <div class="history-circle ${isPass ? 'pass' : 'fail'}">
                  ${(Math.round(s.score * 10) / 10).toFixed(1)}
                </div>
                <div class="history-label">${scoreHistory.length - 10 + idx + 1}회</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <!-- 문제별 상세 결과 -->
      ${exams.map((examCase, caseIdx) => {
        return generateCaseSection(examCase, caseIdx, result, userAnswers, questionScores, year, safeOptions);
      }).join('')}

      <!-- 푸터 -->
      <div class="footer">
        <div>본 리포트는 감린이 앱에서 자동 생성되었습니다.</div>
        <div style="margin-top: 2mm;">© ${new Date().getFullYear()} 감린이 - 회계감사 학습 도우미</div>
      </div>
    </div>
  `;

  return html;
}

/**
 * Case별 섹션 생성
 */
function generateCaseSection(examCase, caseIdx, result, userAnswers, questionScores = {}, year, options = { includeScenario: true, includeQuestion: true, includeFeedback: true }) {
  // options를 안전하게 처리
  const safeOptions = {
    includeScenario: true,
    includeQuestion: true,
    includeFeedback: true,
    ...options
  };
  return `
    <div class="case-section">
      <div class="case-header">
        문제 ${caseIdx + 1}: ${escapeHtml(examCase.topic || examCase.id)}
      </div>
      ${examCase.questions.map((question, qIdx) => {
        const feedback = result.details[question.id];
        const userAnswer = userAnswers[question.id]?.answer || '';
        const score = feedback?.score || 0;
        const scorePercent = question.score > 0 ? ((score / question.score) * 100) : 0;
        
        // 점수 배지 결정
        let scoreBadgeClass = 'poor';
        let scoreBadgeText = '오답';
        if (scorePercent >= 90) {
          scoreBadgeClass = 'excellent';
          scoreBadgeText = '정답';
        } else if (scorePercent >= 50) {
          scoreBadgeClass = 'good';
          scoreBadgeText = '부분정답';
        }

        // 이전 문제와 scenario 비교
        const previousQ = qIdx > 0 ? examCase.questions[qIdx - 1] : null;
        const currentScenario = question.scenario || examCase.scenario || '';
        const previousScenario = previousQ ? (previousQ.scenario || examCase.scenario || '') : null;
        const isSameScenario = previousScenario && currentScenario === previousScenario;

        // 물음별 점수 히스토리 가져오기
        const qKey = question.id;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examPdfExport.js:595',message:'Looking for question history',data:{qKey,year,questionScoresKeys:Object.keys(questionScores).slice(0, 5),questionScoresCount:Object.keys(questionScores).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        
        // examService에서 exam_${year}_scores를 가져와서 해당 question.id의 히스토리를 추출
        const examScores = examService.getScores(year);
        const questionHistory = [];
        
        // 각 시도에서 해당 question.id의 점수를 추출
        examScores.forEach((attempt, attemptIdx) => {
          if (attempt.details && attempt.details[qKey]) {
            questionHistory.push({
              date: attempt.timestamp,
              score: attempt.details[qKey].score || 0
            });
          }
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'examPdfExport.js:612',message:'After exam scores extraction',data:{examScoresLength:examScores.length,questionHistoryLength:questionHistory.length,qKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        
        // 날짜순 정렬 (최신순)
        questionHistory.sort((a, b) => {
          const dateA = a.date instanceof Date ? a.date.getTime() : (typeof a.date === 'number' ? a.date : new Date(a.date).getTime());
          const dateB = b.date instanceof Date ? b.date.getTime() : (typeof b.date === 'number' ? b.date : new Date(b.date).getTime());
          return dateB - dateA;
        });
        
        const recentHistory = questionHistory.slice(0, 5); // 최근 5개만 표시
        const historyHtml = recentHistory.length > 0 ? `
          <div style="margin-top: 2mm; font-size: 9pt; color: #6B7280;">
            📊 히스토리: ${recentHistory.map((h, idx) => {
              const date = typeof h.date === 'number' ? new Date(h.date) : new Date(h.date);
              const dateStr = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
              const score = (Math.round((h.score || 0) * 10) / 10).toFixed(1);
              return `${dateStr} ${score}점`;
            }).join(' | ')}
          </div>
        ` : '';

        return `
          <div class="question-card">
            <div class="question-header">
              <div>
                <span class="question-title">물음 ${extractQuestionNumber(question.id)}</span>
                <span class="score-badge ${scoreBadgeClass}">${scoreBadgeText}</span>
              </div>
              <div class="question-score">${(Math.round(score * 10) / 10).toFixed(1)} / ${question.score}점</div>
            </div>
            ${historyHtml}

            ${safeOptions.includeScenario && currentScenario && !isSameScenario ? `
              <div class="content-box scenario">
                <div class="content-label">📄 지문</div>
                <div class="content-text">${convertMarkdownTablesToHtml(currentScenario)}</div>
              </div>
            ` : ''}

            ${safeOptions.includeQuestion ? `
            <div class="content-box question">
              <div class="content-label">📝 문제</div>
              <div class="content-text">${convertMarkdownTablesToHtml(question.question)}</div>
            </div>
            ` : ''}

            <div class="content-box user-answer">
              <div class="content-label">✍️ 내 답안</div>
              <div class="content-text">${userAnswer ? escapeHtml(userAnswer) : '<em style="color: #9CA3AF;">작성하지 않음</em>'}</div>
            </div>

            <div class="content-box model-answer">
              <div class="content-label">📚 모범 답안</div>
              <div class="content-text">${convertMarkdownTablesToHtml(question.model_answer)}</div>
            </div>

            ${safeOptions.includeFeedback !== false && feedback?.feedback ? `
              <div class="content-box feedback">
                <div class="content-label">🎯 AI 선생님의 총평</div>
                <div class="content-text">${convertMarkdownTablesToHtml(feedback.feedback)}</div>
              </div>
            ` : ''}

            ${safeOptions.includeFeedback !== false && feedback?.strengths && feedback.strengths.length > 0 ? `
              <div style="margin-top: 2mm;">
                <div class="content-label">✅ 잘한 점</div>
                <ul style="margin: 2mm 0; padding-left: 6mm; font-size: 10pt;">
                  ${feedback.strengths.map(s => `<li style="margin-bottom: 1mm;">${escapeHtml(s)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${safeOptions.includeFeedback !== false && feedback?.improvements && feedback.improvements.length > 0 ? `
              <div style="margin-top: 2mm;">
                <div class="content-label">💡 개선할 점</div>
                <ul style="margin: 2mm 0; padding-left: 6mm; font-size: 10pt;">
                  ${feedback.improvements.map(i => `<li style="margin-bottom: 1mm;">${escapeHtml(i)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${(() => {
              // 메모 가져오기
              const memo = examService.getQuestionMemo(question.id);
              if (memo && memo.memo && memo.memo.trim()) {
                return `
                  <div class="content-box" style="background: #FFFBEB; border-left-color: #F59E0B; margin-top: 2mm;">
                    <div class="content-label">📝 나의 메모</div>
                    <div class="content-text">${escapeHtml(memo.memo)}</div>
                  </div>
                `;
              }
              return '';
            })()}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 텍스트 정규화: 과도한 줄바꿈 완화
 */
function normalizeText(text) {
  if (!text) return text;
  return text.replace(/\n{3,}/g, '\n\n');
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
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // 테이블 행인지 확인
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      const row = parseTableRow(trimmedLine);
      if (row.length === headers.length) {
        tableRows.push(row);
        i++;
        continue;
      }
    }
    
    // 빈 줄이면 테이블 종료 (빈 줄은 포함하지 않음)
    if (trimmedLine === '') {
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
 * HTML 테이블 렌더링 (PDF용)
 */
function renderTableForPdf(headers, alignments, rows) {
  let html = '<table style="width: 100%; border-collapse: collapse; margin: 2mm 0; font-size: 9pt;">';
  
  // 헤더
  html += '<thead><tr style="background: #F3F4F6;">';
  headers.forEach((header, idx) => {
    const align = alignments[idx] || 'left';
    const textAlign = align === 'center' ? 'center' : (align === 'right' ? 'right' : 'left');
    html += `<th style="border: 1px solid #D1D5DB; padding: 2mm; text-align: ${textAlign}; font-weight: bold;">${escapeHtml(header)}</th>`;
  });
  html += '</tr></thead>';

  // 바디
  html += '<tbody>';
  rows.forEach(row => {
    html += '<tr>';
    row.forEach((cell, idx) => {
      const align = alignments[idx] || 'left';
      const textAlign = align === 'center' ? 'center' : (align === 'right' ? 'right' : 'left');
      html += `<td style="border: 1px solid #D1D5DB; padding: 2mm; text-align: ${textAlign};">${escapeHtml(cell)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  return html;
}

/**
 * 마크다운 표를 HTML 테이블로 변환 (PDF용)
 */
function convertMarkdownTablesToHtml(text) {
  if (!text) return text;

  // 줄 단위로 분리 (정규화 전에 분리하여 테이블 구조 보존)
  const lines = text.split(/\r?\n/);
  let result = '';
  let i = 0;
  let lastWasTable = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // 테이블 시작 감지: | 로 시작하고 끝나는 줄
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      const tableData = parseTable(lines, i);
      if (tableData) {
        // 테이블 전에 줄바꿈 추가 (이전 내용이 있으면)
        if (result && !result.endsWith('<br>') && !result.endsWith('</table>')) {
          result += '<br>';
        }
        result += renderTableForPdf(tableData.headers, tableData.alignments, tableData.rows);
        i = tableData.nextIndex;
        lastWasTable = true;
        continue;
      }
    }
    
    // 테이블이 아니면 원본 텍스트 유지 (HTML 이스케이프 적용)
    // 줄바꿈을 <br>로 변환
    if (i > 0) {
      if (lastWasTable) {
        result += '<br>';
        lastWasTable = false;
      } else if (result && !result.endsWith('<br>')) {
        result += '<br>';
      }
    }
    result += escapeHtml(line);
    i++;
  }

  return result;
}

// ============================================
// 단원별 PDF 내보내기 기능
// ============================================

/**
 * 단원별 채점 결과 PDF 내보내기 모달 표시
 * @param {string} chapterName - 단원명
 * @param {Array} chapterData - 단원별 문제 데이터 배열
 * @param {Object} userAnswers - 사용자 답안 객체
 * @param {Object} result - 채점 결과 { totalScore, details }
 */
export async function showChapterPdfExportModal(chapterName, chapterData, userAnswers, result) {
  // 기존 모달 제거
  const existingModal = document.getElementById('chapter-pdf-export-modal');
  if (existingModal) existingModal.remove();

  const totalPossibleScore = chapterData.reduce((sum, c) => sum + c.questions.reduce((s, q) => s + q.score, 0), 0);
  const percentage = totalPossibleScore > 0 ? ((result.totalScore / totalPossibleScore) * 100).toFixed(1) : 0;

  const modal = document.createElement('div');
  modal.id = 'chapter-pdf-export-modal';
  modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/50';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-800 dark:text-white">📄 PDF 내보내기</h3>
        <button id="close-chapter-pdf-modal" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl">&times;</button>
      </div>

      <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
        <p class="text-sm text-blue-800 dark:text-blue-200">
          <strong>${chapterName}</strong> 채점 결과<br>
          ${result.totalScore.toFixed(1)}점 / ${totalPossibleScore}점 (${percentage}%)
        </p>
      </div>

      <div class="space-y-3 mb-6">
        <label class="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" id="chapter-pdf-option-scenario" class="w-5 h-5 text-blue-500 rounded" checked />
          <span class="text-sm text-gray-700 dark:text-gray-300">📄 지문 포함</span>
        </label>
        <label class="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" id="chapter-pdf-option-question" class="w-5 h-5 text-blue-500 rounded" checked />
          <span class="text-sm text-gray-700 dark:text-gray-300">❓ 문제 포함</span>
        </label>
        <label class="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" id="chapter-pdf-option-feedback" class="w-5 h-5 text-blue-500 rounded" checked />
          <span class="text-sm text-gray-700 dark:text-gray-300">🤖 AI 피드백 포함</span>
        </label>
        <label class="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" id="chapter-pdf-option-memo" class="w-5 h-5 text-yellow-500 rounded" checked />
          <span class="text-sm text-gray-700 dark:text-gray-300">📝 나의 메모 포함</span>
        </label>
      </div>

      <div class="flex gap-3">
        <button id="export-chapter-pdf-confirm" class="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors">
          📄 PDF 다운로드
        </button>
        <button id="cancel-chapter-pdf-modal" class="flex-1 py-3 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-white font-bold rounded-lg transition-colors">
          취소
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 모달 닫기 이벤트
  const closeModal = () => modal.remove();
  modal.querySelector('#close-chapter-pdf-modal').addEventListener('click', closeModal);
  modal.querySelector('#cancel-chapter-pdf-modal').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // PDF 내보내기 실행
  modal.querySelector('#export-chapter-pdf-confirm').addEventListener('click', async () => {
    const options = {
      includeScenario: modal.querySelector('#chapter-pdf-option-scenario').checked,
      includeQuestion: modal.querySelector('#chapter-pdf-option-question').checked,
      includeFeedback: modal.querySelector('#chapter-pdf-option-feedback').checked,
      includeMemo: modal.querySelector('#chapter-pdf-option-memo').checked
    };

    closeModal();
    await exportChapterResultsToPdf(chapterName, chapterData, userAnswers, result, options);
  });
}

/**
 * 단원별 채점 결과 PDF 생성 및 다운로드
 */
async function exportChapterResultsToPdf(chapterName, chapterData, userAnswers, result, options = {}) {
  try {
    const safeOptions = {
      includeScenario: options.includeScenario !== false,
      includeQuestion: options.includeQuestion !== false,
      includeFeedback: options.includeFeedback !== false,
      includeMemo: options.includeMemo !== false
    };

    const totalPossibleScore = chapterData.reduce((sum, c) => sum + c.questions.reduce((s, q) => s + q.score, 0), 0);
    const percentage = totalPossibleScore > 0 ? ((result.totalScore / totalPossibleScore) * 100).toFixed(1) : 0;
    const isPassing = parseFloat(percentage) >= 60;

    // HTML 생성
    const pdfHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${chapterName} 채점 결과</title>
        <style>
          @page { margin: 15mm; size: A4; }
          body { font-family: 'Malgun Gothic', sans-serif; font-size: 11pt; line-height: 1.6; color: #333; }
          .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #2563eb; }
          .header h1 { font-size: 18pt; color: #2563eb; margin-bottom: 10px; }
          .score-box { display: inline-block; padding: 10px 20px; background: ${isPassing ? '#16a34a' : '#dc2626'}; color: white; border-radius: 8px; font-size: 14pt; font-weight: bold; }
          .case-section { margin-bottom: 15px; page-break-inside: avoid; }
          .case-header { background: #2563eb; color: white; padding: 8px 12px; font-weight: bold; font-size: 12pt; border-radius: 6px 6px 0 0; }
          .question-card { border: 1px solid #e5e7eb; border-top: none; padding: 12px; margin-bottom: 8px; }
          .question-title { font-weight: bold; color: #4338ca; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
          .score-badge { padding: 2px 8px; border-radius: 4px; font-size: 10pt; }
          .score-high { background: #dcfce7; color: #16a34a; }
          .score-mid { background: #fef3c7; color: #d97706; }
          .score-low { background: #fee2e2; color: #dc2626; }
          .content-box { background: #f9fafb; padding: 10px; border-radius: 6px; margin: 8px 0; border-left: 4px solid #6366f1; }
          .content-label { font-weight: bold; font-size: 10pt; color: #4b5563; margin-bottom: 4px; }
          .content-text { font-size: 10pt; white-space: pre-wrap; }
          .feedback-box { background: #f3e8ff; border-left-color: #8b5cf6; }
          .memo-box { background: #FFFBEB; border-left-color: #F59E0B; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9pt; }
          th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
          th { background: #f3f4f6; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📚 ${escapeHtml(chapterName)}</h1>
          <p>채점 결과 보고서</p>
          <div class="score-box">${result.totalScore.toFixed(1)}점 / ${totalPossibleScore}점 (${percentage}%)</div>
          <p style="margin-top: 10px; font-size: 10pt; color: #666;">생성일: ${new Date().toLocaleDateString('ko-KR')}</p>
        </div>

        ${chapterData.map(caseItem => `
          <div class="case-section">
            <div class="case-header">${caseItem.year}년 - ${escapeHtml(caseItem.topic)}</div>
            ${caseItem.questions.map(question => {
              const feedback = result.details[question.id];
              const userAnswer = userAnswers[question.id]?.answer || '';
              const score = feedback?.score || 0;
              const scorePercent = question.score > 0 ? ((score / question.score) * 100) : 0;
              const scoreClass = scorePercent >= 90 ? 'score-high' : scorePercent >= 50 ? 'score-mid' : 'score-low';

              return `
                <div class="question-card">
                  <div class="question-title">
                    <span>물음 ${extractQuestionNumber(question.id)} (${question.score}점)</span>
                    <span class="score-badge ${scoreClass}">${score.toFixed(2)}점</span>
                  </div>

                  ${safeOptions.includeScenario && question.scenario ? `
                    <div class="content-box">
                      <div class="content-label">📄 지문</div>
                      <div class="content-text">${convertMarkdownTablesToHtmlForPdf(question.scenario)}</div>
                    </div>
                  ` : ''}

                  ${safeOptions.includeQuestion ? `
                    <div class="content-box">
                      <div class="content-label">❓ 문제</div>
                      <div class="content-text">${convertMarkdownTablesToHtmlForPdf(question.question)}</div>
                    </div>
                  ` : ''}

                  <div class="content-box">
                    <div class="content-label">✍️ 내 답안</div>
                    <div class="content-text">${userAnswer ? escapeHtml(userAnswer) : '<em style="color: #9ca3af;">작성하지 않음</em>'}</div>
                  </div>

                  <div class="content-box">
                    <div class="content-label">📚 모범 답안</div>
                    <div class="content-text">${escapeHtml(question.model_answer || question.answer || '')}</div>
                  </div>

                  ${safeOptions.includeFeedback && feedback?.feedback ? `
                    <div class="content-box feedback-box">
                      <div class="content-label">🤖 AI 피드백</div>
                      <div class="content-text">${escapeHtml(feedback.feedback)}</div>
                    </div>
                  ` : ''}

                  ${safeOptions.includeMemo ? (() => {
                    const memo = examService.getQuestionMemo(question.id);
                    if (memo && memo.memo && memo.memo.trim()) {
                      return `
                        <div class="content-box memo-box">
                          <div class="content-label">📝 나의 메모</div>
                          <div class="content-text">${escapeHtml(memo.memo)}</div>
                        </div>
                      `;
                    }
                    return '';
                  })() : ''}
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 9pt;">
          Generated by 감린이 (Gamlini) - 회계감사 학습 플랫폼
        </div>
      </body>
      </html>
    `;

    // window.print() 방식으로 PDF 생성
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('팝업이 차단되었습니다. 팝업 차단을 해제하고 다시 시도해주세요.');
      return;
    }

    printWindow.document.write(pdfHtml);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };

  } catch (error) {
    console.error('PDF 내보내기 오류:', error);
    alert('PDF 내보내기 중 오류가 발생했습니다.');
  }
}

/**
 * 문제 ID에서 번호 추출 (단원별용 - 여기서 재정의)
 */
function extractQuestionNumber(id) {
  if (!id) return '';
  const match = id.match(/Q(\d+)(?:_(\d+))?/);
  if (match) {
    return match[2] ? `${match[1]}-${match[2]}` : match[1];
  }
  return id;
}

/**
 * 마크다운 표를 HTML 테이블로 변환 (PDF용)
 */
function convertMarkdownTablesToHtmlForPdf(text) {
  if (!text) return '';

  // 3개 이상의 연속된 줄바꿈을 2개로 축소
  text = text.replace(/\n{3,}/g, '\n\n');

  const lines = text.split(/\r?\n/);
  let result = '';
  let i = 0;
  let lastWasTable = false;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith('|') && line.endsWith('|')) {
      const tableData = parseTableForChapterPdf(lines, i);
      if (tableData) {
        if (result && !result.endsWith('<br>') && !result.endsWith('</table>')) {
          result += '<br>';
        }
        result += renderTableForChapterPdf(tableData.headers, tableData.alignments, tableData.rows);
        i = tableData.nextIndex;
        lastWasTable = true;
        continue;
      }
    }

    if (i > 0) {
      if (lastWasTable) {
        result += '<br>';
        lastWasTable = false;
      } else if (result && !result.endsWith('<br>')) {
        result += '<br>';
      }
    }
    result += escapeHtml(lines[i]);
    i++;
  }

  return result;
}

function parseTableForChapterPdf(lines, startIndex) {
  let i = startIndex;
  const headerLine = lines[i].trim();
  if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null;

  const headers = headerLine.split('|').slice(1, -1).map(cell => cell.trim());
  if (headers.length < 2) return null;

  i++;
  if (i >= lines.length) return null;

  const separatorLine = lines[i].trim();
  if (!separatorLine.startsWith('|') || !separatorLine.endsWith('|')) return null;

  const alignments = separatorLine.split('|').slice(1, -1).map(cell => {
    const trimmed = cell.trim();
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
    if (trimmed.endsWith(':')) return 'right';
    return 'left';
  });

  i++;
  const rows = [];
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    rows.push(cells);
    i++;
  }

  return { headers, alignments, rows, nextIndex: i };
}

function renderTableForChapterPdf(headers, alignments, rows) {
  let html = '<table><thead><tr>';
  headers.forEach((h, idx) => {
    const align = alignments[idx] || 'left';
    html += `<th style="text-align: ${align};">${escapeHtml(h)}</th>`;
  });
  html += '</tr></thead><tbody>';
  rows.forEach(row => {
    html += '<tr>';
    row.forEach((cell, idx) => {
      const align = alignments[idx] || 'left';
      html += `<td style="text-align: ${align};">${escapeHtml(cell)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

