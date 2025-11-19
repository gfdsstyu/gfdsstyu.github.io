/**
 * @fileoverview AI 분석 기능
 * - Gemini API를 활용한 학습 패턴 분석
 * - 마크다운 렌더링
 */

import { el, $ } from '../../ui/elements.js';
import { callGeminiTextAPI } from '../../services/geminiApi.js';
import { getReportData } from './reportCore.js';
import { showToast } from '../../ui/domUtils.js';
import { openApiModal } from '../settings/settingsCore.js';
import { calculateMovingAverage } from './charts.js';
import { getGeminiApiKey, getQuestionScores, setQuestionScores, saveQuestionScores, getMemoryTipMode } from '../../core/stateManager.js';
import { normId } from '../../utils/helpers.js';
import { createMemoryTipPrompt } from '../../config/config.js';

/**
 * 차트 해석 규칙 (축약판 - API 타임아웃 방지)
 */
const CHART_INTERPRETATION_RULES = `
**이동평균선:** 5일선(단기), 20일선(중기-핵심), 60일선(장기)
**골든크로스 🟢:** 5일선이 20일선 상향돌파 → 긍정신호, 현재 페이스 유지
**데드크로스 🔴:** 5일선이 20일선 하향이탈 → 경고신호, 학습법 점검
**정배열 🚀:** 5일>20일>60일 → 최상 상태, 현재 페이스 유지
**역배열 ⚠️:** 5일<20일<60일 → 침체, 학습법 재점검
`;

/**
 * 차트 컨텍스트 추출 (Task 4: AI 프롬프트용)
 * @param {object} reportData - getReportData() 반환값
 * @returns {object|null} 차트 분석 컨텍스트
 */
function extractChartContext(reportData) {
  const { dailyData, chapterData, chartData } = reportData;

  // 성능 최적화: 사전 계산된 차트 데이터 사용
  if (!chartData) {
    return null; // 차트 데이터 없음
  }

  const { sorted, avgScores, ma5, ma20, ma60 } = chartData;

  // 최근 7일치만 추출 (토큰 절약)
  const recentDays = 7;
  const recentMA5 = ma5.slice(-recentDays);
  const recentMA20 = ma20.slice(-recentDays);
  const recentMA60 = ma60.slice(-recentDays);

  // 골든크로스/데드크로스 감지 (최근 7일)
  let lastGoldenCross = null;
  let lastDeadCross = null;

  for (let i = Math.max(0, ma5.length - 7); i < ma5.length; i++) {
    if (i < 1) continue;
    if (ma5[i] !== null && ma20[i] !== null && ma5[i-1] !== null && ma20[i-1] !== null) {
      // Golden Cross
      if (ma5[i-1] <= ma20[i-1] && ma5[i] > ma20[i]) {
        lastGoldenCross = {
          date: sorted[i][0],
          daysAgo: sorted.length - 1 - i
        };
      }
      // Dead Cross
      if (ma5[i-1] >= ma20[i-1] && ma5[i] < ma20[i]) {
        lastDeadCross = {
          date: sorted[i][0],
          daysAgo: sorted.length - 1 - i
        };
      }
    }
  }

  // 정배열 확인
  const lastIdx = ma5.length - 1;
  const isPerfectOrder = ma5[lastIdx] && ma20[lastIdx] && ma60[lastIdx] &&
                        ma5[lastIdx] > ma20[lastIdx] && ma20[lastIdx] > ma60[lastIdx];

  // 취약 단원 Top 3
  const weakChapters = Array.from(chapterData.entries())
    .map(([chapter, data]) => ({
      chapter,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
    }))
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 3);

  return {
    recentMA5,
    recentMA20,
    recentMA60,
    lastGoldenCross,
    lastDeadCross,
    isPerfectOrder,
    weakChapters,
    currentMA5: ma5[lastIdx],
    currentMA20: ma20[lastIdx],
    currentMA60: ma60[lastIdx]
  };
}

/**
 * 마크다운을 HTML로 변환
 * @param {string} md - 마크다운 텍스트
 * @returns {string} - HTML 텍스트
 */
function markdownToHtml(md) {
  if (!md) return '';
  let html = md;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Lists
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Paragraphs
  html = html.split('\n\n').map(para => {
    if (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol')) {
      return para;
    }
    return para.trim() ? `<p>${para.trim()}</p>` : '';
  }).join('\n');

  return html;
}

/**
 * 1단계: 차트 추세 분석 (난이도: 낮음 → flash-lite)
 */
async function analyzeChartTrend(chartContext, geminiApiKey) {
  if (!chartContext) return null;

  const prompt = `당신은 CPA 2차 회계감사 학습 코치입니다.

[차트 해석 규칙]
${CHART_INTERPRETATION_RULES}

[사용자 차트 데이터]
- 현재 이동평균: 5일선 ${chartContext.currentMA5?.toFixed(1)}, 20일선 ${chartContext.currentMA20?.toFixed(1)}, 60일선 ${chartContext.currentMA60?.toFixed(1)}
- 골든크로스: ${chartContext.lastGoldenCross ? `${chartContext.lastGoldenCross.daysAgo}일 전 발생` : '최근 7일 내 없음'}
- 데드크로스: ${chartContext.lastDeadCross ? `${chartContext.lastDeadCross.daysAgo}일 전 발생` : '최근 7일 내 없음'}
- 정배열: ${chartContext.isPerfectOrder ? '예 🚀' : '아니오'}
- 취약 단원: ${chartContext.weakChapters.map((c, i) => `${i+1}. ${c.chapter} (${c.avgScore}점)`).join(', ')}

[요청]
위 차트 데이터를 분석하여 "📊 차트 추세 분석" 섹션을 마크다운으로 작성하세요 (3-5문장).`;

  // 단순 데이터 해석 → flash-lite 사용 (빠르고 저렴)
  return await callGeminiTextAPI(prompt, geminiApiKey, 'gemini-2.5-flash-lite');
}

/**
 * 2단계: 약점 문제 그룹 분석 (난이도: 높음 → flash-lite 먼저 시도)
 */
async function analyzeWeakProblemsGroup(problemsGroup, groupNumber, geminiApiKey) {
  if (!problemsGroup || problemsGroup.length === 0) return null;

  const prompt = `당신은 CPA 2차 회계감사 채점위원입니다.

[약점 문제 그룹 ${groupNumber} (${problemsGroup.length}개)]
${JSON.stringify(problemsGroup)}

[요청]
각 문제별로 오답 원인을 분석하세요:
1. 오해한 개념
2. 정답과 답안의 차이
3. 개선 조언 (1줄)

마크다운으로 간결하게 (문제당 2-3줄).`;

  // API 부하 최소화 → flash-lite 사용 (flash는 503 빈발)
  return await callGeminiTextAPI(prompt, geminiApiKey, 'gemini-2.5-flash-lite');
}

/**
 * 3단계: 종합 평가 (난이도: 중간 → flash-lite)
 */
async function synthesizeAnalysis(chartAnalysis, weaknessAnalyses, geminiApiKey) {
  const prompt = `당신은 CPA 2차 회계감사 학습 코치입니다. 따뜻하면서도 분석적인 어조로 종합 평가를 제공하세요.

[차트 분석 결과]
${chartAnalysis || '(차트 데이터 부족)'}

[약점 분석 요약]
${weaknessAnalyses.filter(a => a).join('\n\n')}

[요청]
위 분석을 바탕으로 "📋 종합 평가 및 학습 조치사항" 섹션을 작성하세요:
1. 현재 학습 상태 종합 진단 (2-3문장, 격려 + 현실적 평가)
2. 우선순위 학습 조치사항 (3-5개 bullet, 구체적이고 실행 가능한 항목)
3. 마무리 격려 (1-2문장)
마크다운 형식으로 작성하세요.`;

  // 요약 및 조언 생성 → flash-lite 충분 (빠르고 효율적)
  return await callGeminiTextAPI(prompt, geminiApiKey, 'gemini-2.5-flash-lite');
}

/**
 * AI 분석 시작 (단계별 호출)
 */
export async function startAIAnalysis() {
  const startBtn = $('ai-analysis-start-btn');
  const loading = $('ai-analysis-loading');
  const result = $('ai-analysis-result');

  // Check API key first
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    openApiModal(false);
    showToast('Gemini API 키를 입력해주세요.', 'error');
    return;
  }

  if (startBtn) startBtn.parentElement.classList.add('hidden');
  if (loading) loading.classList.remove('hidden');

  try {
    const data = getReportData();

    if (data.weakProblems.length === 0) {
      showToast('분석할 오답 데이터가 없습니다', 'warn');
      if (loading) loading.classList.add('hidden');
      if (startBtn) startBtn.parentElement.classList.remove('hidden');
      return;
    }

    // 차트 컨텍스트 추출
    const chartContext = extractChartContext(data);

    // 약점 문제 데이터 준비 (8개로 축소, 각 250자 제한)
    const weakProblemsSummary = data.weakProblems.slice(0, 8).map(wp => {
      const scoreData = window.questionScores[wp.qid];
      const solveHistory = scoreData?.solveHistory || [];
      const latestSolve = solveHistory[solveHistory.length - 1];

      const 정답원본 = wp.problem.정답 || '';
      const 답안원본 = latestSolve?.user_answer || scoreData?.user_answer || '(답변 없음)';

      return {
        문제: (wp.problem.물음 || '').slice(0, 250) + ((wp.problem.물음 || '').length > 250 ? ' …' : ''),
        정답: 정답원본.slice(0, 250) + (정답원본.length > 250 ? ' …' : ''),
        내답안: 답안원본.slice(0, 250) + (답안원본.length > 250 ? ' …' : ''),
        점수: wp.score
      };
    });

    // 🔄 단계별 분석 시작
    const results = [];
    const totalSteps = 1 + Math.ceil(weakProblemsSummary.length / 2) + 1; // 차트 + 약점그룹(2개씩) + 종합
    let currentStep = 0;

    // 진행률 표시 함수
    const updateProgress = (message) => {
      currentStep++;
      if (loading) {
        loading.innerHTML = `<div class="flex items-center gap-3">
          <div class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span class="text-sm text-gray-600 dark:text-gray-300">${message} (${currentStep}/${totalSteps})</span>
        </div>`;
      }
    };

    // 1단계: 차트 추세 분석
    updateProgress('📊 차트 추세 분석 중');
    const chartAnalysis = await analyzeChartTrend(chartContext, geminiApiKey);
    if (chartAnalysis) results.push(chartAnalysis);

    // API 과부하 방지 딜레이
    await new Promise(r => setTimeout(r, 1000));

    // 2단계: 약점 문제 그룹별 분석 (2개씩 나눔, API 부하 최소화)
    const weaknessAnalyses = [];
    for (let i = 0; i < weakProblemsSummary.length; i += 2) {
      const group = weakProblemsSummary.slice(i, i + 2);
      const groupNumber = Math.floor(i / 2) + 1;
      updateProgress(`🔍 약점 문제 분석 중 (그룹 ${groupNumber})`);

      try {
        const analysis = await analyzeWeakProblemsGroup(group, groupNumber, geminiApiKey);
        if (analysis) weaknessAnalyses.push(analysis);
      } catch (err) {
        console.warn(`⚠️ 그룹 ${groupNumber} 분석 실패 (건너뜀): ${err.message}`);
        // 실패해도 계속 진행 (부분 결과라도 표시)
      }

      // 각 그룹 호출 사이 딜레이 (API 과부하 방지)
      if (i + 2 < weakProblemsSummary.length) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // API 과부하 방지 딜레이
    await new Promise(r => setTimeout(r, 1000));

    // 3단계: 종합 평가
    updateProgress('📋 종합 평가 생성 중');
    const synthesis = await synthesizeAnalysis(chartAnalysis, weaknessAnalyses, geminiApiKey);
    if (synthesis) results.push(synthesis);

    // 최종 결과 조합
    const finalReport = `# 🎓 감린이 AI 채점위원 분석 리포트

${results.join('\n\n---\n\n')}

${weaknessAnalyses.length > 0 ? '\n\n## 🔍 약점 문제 상세 분석\n\n' + weaknessAnalyses.join('\n\n') : ''}
`;

    if (loading) loading.classList.add('hidden');
    if (result) result.classList.remove('hidden');

    // 결과 표시
    if (el.aiErrorPattern) {
      el.aiErrorPattern.innerHTML = markdownToHtml(finalReport);
    }

  } catch (err) {
    if (loading) loading.classList.add('hidden');
    if (startBtn) startBtn.parentElement.classList.remove('hidden');
    showToast('AI 분석 실패: ' + err.message, 'error');
  }
}

/**
 * AI 분석 결과 복사
 */
export function copyAIAnalysis() {
  const errorPattern = $('ai-error-pattern')?.innerText || '';
  const conceptWeakness = $('ai-concept-weakness')?.innerText || '';
  const text = `# 실수 유형 분석\n\n${errorPattern}\n\n# 주요 개념 약점\n\n${conceptWeakness}`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('분석 내용을 클립보드에 복사했습니다');
  }).catch(() => {
    showToast('복사 실패', 'error');
  });
}

/**
 * AI 암기 코치 요청 (Tab 4: 일일 학습 기록 전용)
 * @param {string} qid - 문제 고유 ID
 * @param {HTMLElement} btn - 클릭된 버튼 요소 (로딩 상태 표시용)
 * @param {boolean} forceRegenerate - true이면 저장된 팁 무시하고 새로 생성
 */
export async function handleCoachingRequest(qid, btn, forceRegenerate = false) {
  // 문제 카드 컨테이너 찾기
  const container = btn.closest('[data-daily-problem]');
  if (!container) return;

  const coachingTip = container.querySelector('.daily-coaching-tip');
  const coachingContent = container.querySelector('.coaching-content');

  if (!coachingTip || !coachingContent) return;

  // DOM에 이미 표시된 팁이 있고 forceRegenerate가 아니면 토글만
  if (coachingContent.textContent.trim() && !forceRegenerate) {
    coachingTip.classList.toggle('hidden');
    // 버튼 텍스트는 변경하지 않음
    return;
  }

  // 1순위: questionScores에 저장된 팁 불러오기 (forceRegenerate가 아닐 때만)
  if (!forceRegenerate) {
    const questionScores = getQuestionScores();
    const nid = normId(qid);
    const savedTip = questionScores[nid]?.memoryTip;

    if (savedTip) {
      coachingContent.textContent = savedTip;
      coachingTip.classList.remove('hidden');
      // 버튼 텍스트는 변경하지 않음
      showToast('저장된 암기 팁을 불러왔습니다! 💡');
      return;
    }
  }

  // 2순위: Gemini API 호출하여 새로 생성
  // API 키 확인
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    openApiModal(false);
    showToast('Gemini API 키를 입력해주세요.', 'error');
    return;
  }

  // 문제 데이터 조회
  const problem = window.allData?.find(q => {
    const normalizedId = String(q.고유ID || '').trim().toLowerCase();
    return normalizedId === qid;
  });

  if (!problem) {
    showToast('문제를 찾을 수 없습니다.', 'error');
    return;
  }

  // 버튼 로딩 상태
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 생성 중...';

  try {
    // config.js의 통합 프롬프트 템플릿 사용 (사용자 설정 모드 반영)
    const mode = getMemoryTipMode();
    const prompt = createMemoryTipPrompt(problem.물음, problem.정답, mode);
    const response = await callGeminiTextAPI(prompt, geminiApiKey);

    // questionScores에 저장
    const questionScores = getQuestionScores();
    const nid = normId(qid);
    if (!questionScores[nid]) {
      questionScores[nid] = {};
    }
    questionScores[nid].memoryTip = response;
    setQuestionScores(questionScores);
    saveQuestionScores(); // localStorage에 저장

    // 결과를 카드 내 암기 팁 영역에 표시
    coachingContent.textContent = response;
    coachingTip.classList.remove('hidden');
    // 버튼 텍스트는 원래대로 복원

    showToast(forceRegenerate ? '암기 팁을 새로 생성했습니다! 💡' : '암기 팁이 생성되었습니다! 💡');

  } catch (err) {
    console.error('암기 코치 오류:', err);
    showToast('암기 팁 생성 실패: ' + err.message, 'error');
  } finally {
    // 버튼 텍스트 복원 및 활성화
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// 전역 함수로 등록 (reportCore.js에서 호출 가능하도록)
if (typeof window !== 'undefined') {
  window.handleCoachingRequest = handleCoachingRequest;
}

/**
 * AI 분석 이벤트 리스너 초기화
 */
export function initAIAnalysisListeners() {
  el.aiAnalysisStartBtn?.addEventListener('click', startAIAnalysis);
  el.aiAnalysisCopyBtn?.addEventListener('click', copyAIAnalysis);
}
