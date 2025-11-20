/**
 * @fileoverview AI 분석 기능 (v2.0 - 유형별 정밀 분석 + API 최적화)
 * - Gemini API를 활용한 학습 패턴 분석
 * - 마크다운 렌더링
 *
 * [v2.0 주요 변경사항]
 * 1. 유형별 정밀 분석 부활: 이해부족/암기부족/서술불완전 3가지 유형으로 오답 분류 및 통계
 * 2. API 효율성 최적화:
 *    - 기존: 문제별 반복 호출(Pro) → 신규: 일괄 배치 분석(Flash)
 *    - Pro 모델은 최종 종합 단계에만 1회 호출 (RPM 제한 준수)
 *    - 토큰 절약 + 속도 향상
 * 3. 기존 AI 채점평 활용: 재분석 없이 기존 피드백을 핵심 근거로 사용
 * 4. 새로운 4단계 플로우:
 *    - 1단계: 피드백 일괄 분류 (Flash - 배치)
 *    - 2단계: 차트 추세 분석 (Flash-lite)
 *    - 3단계: 유형별 패턴 분석 (Flash)
 *    - 4단계: 최종 종합 처방 (Pro - 1회)
 */

import { el, $ } from '../../ui/elements.js';
import { callGeminiJsonAPI, callGeminiTipAPI } from '../../services/geminiApi.js';
import { getReportData } from './reportCore.js';
import { showToast } from '../../ui/domUtils.js';
import { openApiModal } from '../settings/settingsCore.js';
import { calculateMovingAverage } from './charts.js';
import { getGeminiApiKey, getQuestionScores, setQuestionScores, saveQuestionScores, getMemoryTipMode } from '../../core/stateManager.js';
import { normId } from '../../utils/helpers.js';
import { createMemoryTipPrompt } from '../../config/config.js';
import { fetchDetailedRecords } from '../sync/syncCore.js';
import { getCurrentUser } from '../auth/authCore.js';

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
 * 1단계: 피드백 일괄 분류 및 키워드 추출 (JSON 모드, Flash 사용 - 배치 분석)
 * @param {Array} weakProblemsSummary - 약점 문제 요약 배열
 * @param {string} geminiApiKey - API 키
 * @returns {Promise<object>} 분류 결과
 */
async function classifyFeedbackBatch(weakProblemsSummary, geminiApiKey) {
  if (!weakProblemsSummary || weakProblemsSummary.length === 0) return null;

  const schema = {
    type: "OBJECT",
    properties: {
      classifications: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            problem_index: { type: "NUMBER", description: "문제 인덱스 (0부터 시작)" },
            error_type: {
              type: "STRING",
              description: "오답 주 원인 (이해부족/암기부족/서술불완전 중 택1)",
              enum: ["이해부족", "암기부족", "서술불완전"]
            },
            missing_keywords: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "빠뜨린 핵심 키워드 리스트 (최대 5개)"
            },
            misunderstood_concept: { type: "STRING", description: "오해한 개념 (이해부족인 경우만, 50자 이내)" }
          },
          required: ["problem_index", "error_type", "missing_keywords"]
        }
      },
      type_summary: {
        type: "OBJECT",
        properties: {
          이해부족: { type: "NUMBER", description: "이해부족 문제 개수" },
          암기부족: { type: "NUMBER", description: "암기부족 문제 개수" },
          서술불완전: { type: "NUMBER", description: "서술불완전 문제 개수" }
        },
        required: ["이해부족", "암기부족", "서술불완전"]
      }
    },
    required: ["classifications", "type_summary"]
  };

  // 문제 요약을 간결하게 변환 (토큰 절약)
  const problemsSummary = weakProblemsSummary.map((p, idx) => ({
    idx,
    문제: p.문제.slice(0, 150),
    정답: p.정답.slice(0, 200),
    내답안: p.내답안.slice(0, 200),
    AI채점평: p.기존피드백.slice(0, 150),
    점수: p.점수
  }));

  const prompt = `당신은 CPA 2차 회계감사 채점위원입니다. 20년 경력의 회계사입니다.

[역할]
아래 오답 문제들의 AI 채점평을 분석하여, 각 문제의 주된 오답 원인을 분류하고 핵심 키워드를 추출하세요.

[오답 유형 정의]
1. **이해부족**: 기준서 개념/원리를 잘못 이해하거나 적용했음. 답안 방향 자체가 틀림.
2. **암기부족**: 개념은 이해했으나 핵심 키워드/절차/조건을 누락. 방향은 맞지만 불완전.
3. **서술불완전**: 키워드는 대부분 포함했으나 문장 구조/논리 전개가 미흡하여 감점.

[분류 기준]
- AI채점평에서 "개념 오해", "잘못 적용", "방향 틀림" → **이해부족**
- AI채점평에서 "누락", "빠뜨림", "키워드 부족" → **암기부족**
- AI채점평에서 "불명확", "서술 미흡", "논리 부족" → **서술불완전**
- 점수 50점 미만은 대부분 이해부족, 50-75점은 암기부족, 75-85점은 서술불완전일 가능성 높음

[오답 문제 목록]
${JSON.stringify(problemsSummary, null, 2)}

[요청]
각 문제를 분석하여 JSON으로 출력하세요:
1. classifications 배열: 각 문제의 인덱스, 오답 유형, 빠뜨린 키워드, 오해한 개념
2. type_summary 객체: 각 유형별 문제 개수 합계`;

  // 일괄 배치 분석 → Flash (lite보다 정확, Pro보다 빠름)
  return await callGeminiJsonAPI(prompt, schema, geminiApiKey, 'gemini-2.5-flash');
}

/**
 * 2단계: 차트 추세 분석 (JSON 모드, lite 사용)
 */
async function analyzeChartTrend(chartContext, geminiApiKey) {
  if (!chartContext) return null;

  const schema = {
    type: "OBJECT",
    properties: {
      trend_status: { type: "STRING", description: "현재 추세 상태 (정배열/역배열/중립)" },
      golden_cross: { type: "STRING", description: "골든크로스 발생 여부 및 의미" },
      dead_cross: { type: "STRING", description: "데드크로스 발생 여부 및 의미" },
      weak_chapters: { type: "STRING", description: "취약 단원 요약" },
      recommendation: { type: "STRING", description: "학습 전략 조언 (1-2문장)" }
    },
    required: ["trend_status", "recommendation"]
  };

  const prompt = `당신은 CPA 2차 회계감사 학습 코치입니다.

[차트 해석 규칙]
${CHART_INTERPRETATION_RULES}

[사용자 차트 데이터]
- 현재 이동평균: 5일선 ${chartContext.currentMA5?.toFixed(1)}, 20일선 ${chartContext.currentMA20?.toFixed(1)}, 60일선 ${chartContext.currentMA60?.toFixed(1)}
- 골든크로스: ${chartContext.lastGoldenCross ? `${chartContext.lastGoldenCross.daysAgo}일 전 발생` : '최근 7일 내 없음'}
- 데드크로스: ${chartContext.lastDeadCross ? `${chartContext.lastDeadCross.daysAgo}일 전 발생` : '최근 7일 내 없음'}
- 정배열: ${chartContext.isPerfectOrder ? '예' : '아니오'}
- 취약 단원: ${chartContext.weakChapters.map((c, i) => `${i+1}. ${c.chapter} (${c.avgScore}점)`).join(', ')}

[요청]
위 데이터를 분석하여 JSON으로 출력하세요.`;

  // 단순 해석 → lite (빠르고 저렴)
  return await callGeminiJsonAPI(prompt, schema, geminiApiKey, 'gemini-2.5-flash-lite');
}

/**
 * 3단계: 유형별 패턴 분석 (JSON 모드, Flash 사용)
 * @param {object} classification - 1단계 분류 결과
 * @param {Array} weakProblemsSummary - 약점 문제 요약 배열
 * @param {object} chartContext - 차트 컨텍스트
 * @param {string} geminiApiKey - API 키
 * @returns {Promise<object>} 유형별 패턴 분석
 */
async function analyzeErrorTypePatterns(classification, weakProblemsSummary, chartContext, geminiApiKey) {
  if (!classification) return null;

  const schema = {
    type: "OBJECT",
    properties: {
      이해부족_패턴: {
        type: "OBJECT",
        properties: {
          주요개념: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "자주 오해하는 기준서 개념 (최대 3개)"
          },
          개선방법: { type: "STRING", description: "개념 이해 개선 방법 (1-2문장)" }
        }
      },
      암기부족_패턴: {
        type: "OBJECT",
        properties: {
          누락키워드: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "자주 빠뜨리는 키워드 Top 5"
          },
          단원별분포: { type: "STRING", description: "암기 부족 문제가 많은 단원 (최대 3개)" },
          개선방법: { type: "STRING", description: "암기 강화 방법 (1-2문장)" }
        }
      },
      서술불완전_패턴: {
        type: "OBJECT",
        properties: {
          주요문제: { type: "STRING", description: "서술의 주요 약점 (논리/구조/표현 등)" },
          개선방법: { type: "STRING", description: "서술 개선 방법 (1-2문장)" }
        }
      }
    }
  };

  // 유형별 문제 그룹화
  const 이해부족문제 = classification.classifications.filter(c => c.error_type === '이해부족');
  const 암기부족문제 = classification.classifications.filter(c => c.error_type === '암기부족');
  const 서술불완전문제 = classification.classifications.filter(c => c.error_type === '서술불완전');

  // 누락 키워드 집계
  const 모든누락키워드 = classification.classifications.flatMap(c => c.missing_keywords || []);
  const 키워드빈도 = {};
  모든누락키워드.forEach(kw => {
    키워드빈도[kw] = (키워드빈도[kw] || 0) + 1;
  });
  const 상위키워드 = Object.entries(키워드빈도)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kw, cnt]) => `${kw} (${cnt}회)`);

  const prompt = `당신은 CPA 2차 회계감사 학습 코치입니다.

[오답 유형별 통계]
- 이해부족: ${classification.type_summary.이해부족}문제
- 암기부족: ${classification.type_summary.암기부족}문제
- 서술불완전: ${classification.type_summary.서술불완전}문제

[이해부족 문제 상세]
${이해부족문제.map(c => `문제${c.problem_index}: ${c.misunderstood_concept || '개념 오해'}, 누락: ${(c.missing_keywords || []).join(', ')}`).join('\n')}

[암기부족 문제 상세]
${암기부족문제.map(c => `문제${c.problem_index}: 누락 키워드 ${(c.missing_keywords || []).join(', ')}`).join('\n')}

[서술불완전 문제 상세]
${서술불완전문제.map(c => `문제${c.problem_index}: 누락 키워드 ${(c.missing_keywords || []).join(', ')}`).join('\n')}

[자주 누락하는 키워드 Top 5]
${상위키워드.join(', ')}

[취약 단원]
${chartContext?.weakChapters.map((c, i) => `${i+1}. ${c.chapter} (${c.avgScore}점)`).join(', ') || '없음'}

[요청]
위 데이터를 분석하여 각 유형별 패턴과 개선 방법을 JSON으로 출력하세요:
1. 이해부족_패턴: 주요 오해 개념, 개선 방법
2. 암기부족_패턴: 자주 누락하는 키워드, 단원별 분포, 개선 방법
3. 서술불완전_패턴: 서술 약점, 개선 방법`;

  // 패턴 분석 → Flash (정확도 중요)
  return await callGeminiJsonAPI(prompt, schema, geminiApiKey, 'gemini-2.5-flash');
}

/**
 * 4단계: 최종 종합 처방 (JSON 모드, Pro 사용 - 1회만 호출)
 * @param {object} chartAnalysis - 차트 분석 결과
 * @param {object} classification - 유형 분류 결과
 * @param {object} patternAnalysis - 패턴 분석 결과
 * @param {string} geminiApiKey - API 키
 * @returns {Promise<object>} 최종 종합 처방
 */
async function synthesizeWithPro(chartAnalysis, classification, patternAnalysis, geminiApiKey) {
  const schema = {
    type: "OBJECT",
    properties: {
      current_diagnosis: {
        type: "STRING",
        description: "현재 학습 상태 종합 진단 (3-5문장, 따뜻하면서도 현실적)"
      },
      priority_actions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", description: "조치사항 (구체적)" },
            rationale: { type: "STRING", description: "이유/근거 (1문장)" },
            expected_effect: { type: "STRING", description: "기대 효과 (1문장)" }
          },
          required: ["action", "rationale", "expected_effect"]
        },
        description: "우선순위 학습 조치사항 (3-5개, 중요도 순)"
      },
      study_strategy: {
        type: "STRING",
        description: "향후 2주간 학습 전략 (2-3문장)"
      },
      encouragement: {
        type: "STRING",
        description: "격려 및 동기부여 메시지 (2-3문장)"
      }
    },
    required: ["current_diagnosis", "priority_actions", "study_strategy", "encouragement"]
  };

  const prompt = `당신은 CPA 2차 회계감사 전문 튜터입니다. 20년 경력의 회계사이자 교육자입니다.

[차트 추세 분석]
${JSON.stringify(chartAnalysis, null, 2)}

[오답 유형별 통계]
- 이해부족: ${classification?.type_summary?.이해부족 || 0}문제
- 암기부족: ${classification?.type_summary?.암기부족 || 0}문제
- 서술불완전: ${classification?.type_summary?.서술불완전 || 0}문제

[유형별 패턴 분석]
${JSON.stringify(patternAnalysis, null, 2)}

[임무]
위 모든 분석 결과를 **깊이 있게 종합**하여, 학생에게 실질적 도움이 되는 맞춤형 학습 처방을 제시하세요.

[출력 요구사항]
1. **current_diagnosis**:
   - 차트 추세, 유형별 비율, 패턴을 모두 고려한 종합 진단
   - 학생의 현재 강점과 약점을 명확히 파악
   - 따뜻하면서도 현실적인 톤 유지 (3-5문장)

2. **priority_actions**:
   - 가장 시급한 것부터 순서대로 3-5개 제시
   - 각 조치마다 "왜 필요한지(rationale)", "어떤 효과가 있는지(expected_effect)" 명시
   - 막연한 조언 금지, 구체적 실행 가능한 액션만

3. **study_strategy**:
   - 향후 2주간 집중해야 할 학습 방향
   - 유형별 비율을 고려한 시간 배분 제안 (2-3문장)

4. **encouragement**:
   - 학생의 노력을 인정하고 동기부여
   - 구체적 성장 가능성 제시 (2-3문장)

[중요]
- 단순 나열 금지. 분석 결과 간 인과관계를 파악하여 통찰력 있는 처방 제시
- 학생의 데이터에 맞춤형 조언 (일반론 금지)`;

  // 최종 종합 → Pro (깊이 있는 추론)
  // Pro RPM 제한(2회/분)으로 실패 시 Flash로 폴백
  const models = ['gemini-2.5-pro', 'gemini-2.5-flash'];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      console.log(`🧠 [최종 종합] ${model} 모델 시도 중...`);
      const result = await callGeminiJsonAPI(prompt, schema, geminiApiKey, model);
      console.log(`✅ [최종 종합] ${model} 성공`);
      return result;
    } catch (err) {
      const isLastModel = i === models.length - 1;
      if (isLastModel) {
        console.error(`❌ [최종 종합] 모든 모델 실패: ${err.message}`);
        throw err;
      } else {
        console.warn(`⚠️ [최종 종합] ${model} 실패, ${models[i + 1]}로 재시도: ${err.message}`);
        await new Promise(r => setTimeout(r, 1500)); // Pro 실패 후 충분한 대기
      }
    }
  }
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

    // 약점 문제 선별 (최대 8개)
    const targetProblems = data.weakProblems.slice(0, 8);

    // 🆕 상세 데이터(답안/피드백)를 Firestore에서 가져오기
    const currentUser = getCurrentUser();
    let detailedMap = {};

    if (currentUser) {
      // 로그인 상태면 서버에서 상세 데이터 가져오기
      const targetIds = targetProblems.map(wp => wp.qid);
      console.log(`📥 [AI Analysis] 상세 데이터 조회 시작: ${targetIds.length}개 문제`);
      try {
        detailedMap = await fetchDetailedRecords(currentUser.uid, targetIds);
        console.log(`✅ [AI Analysis] 상세 데이터 로드 완료: ${Object.keys(detailedMap).length}개`);
      } catch (err) {
        console.error('❌ [AI Analysis] 상세 데이터 로드 중 오류:', err);
        showToast('상세 데이터 로드 실패, 로컬 데이터로 진행합니다.', 'warn');
      }
    } else {
      console.log('⚠️ [AI Analysis] 로그아웃 상태 - 로컬 데이터 사용');
    }

    // 약점 문제 데이터 준비 (서버 데이터 우선, 로컬 데이터 백업)
    const weakProblemsSummary = targetProblems.map(wp => {
      const scoreData = window.questionScores[wp.qid]; // 로컬 데이터
      const serverData = detailedMap[wp.qid];          // 서버 데이터

      // 서버 데이터가 있으면 우선 사용, 없으면 로컬 데이터 사용
      const 답안원본 = serverData?.user_answer || scoreData?.user_answer || '(답변 없음)';
      const 피드백원본 = serverData?.feedback || scoreData?.feedback || '';
      const 정답원본 = wp.problem.정답 || '';

      return {
        문제: (wp.problem.물음 || '').slice(0, 250) + ((wp.problem.물음 || '').length > 250 ? ' …' : ''),
        정답: 정답원본.slice(0, 250) + (정답원본.length > 250 ? ' …' : ''),
        내답안: 답안원본.slice(0, 250) + (답안원본.length > 250 ? ' …' : ''),
        기존피드백: 피드백원본.slice(0, 200) + (피드백원본.length > 200 ? ' …' : ''),
        점수: wp.score
      };
    });

    // 🔄 새로운 4단계 분석 플로우 시작
    const totalSteps = 4; // 피드백 분류 + 차트 분석 + 패턴 분석 + 최종 종합
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

    // 1단계: 피드백 일괄 분류 (Flash - 배치 분석, 토큰 효율적)
    updateProgress('🔍 오답 유형 분류 및 키워드 추출 중');
    const classification = await classifyFeedbackBatch(weakProblemsSummary, geminiApiKey);

    // API 과부하 방지 딜레이
    await new Promise(r => setTimeout(r, 1000));

    // 2단계: 차트 추세 분석 (Flash-lite - 빠르고 저렴)
    updateProgress('📊 차트 추세 분석 중');
    const chartAnalysis = await analyzeChartTrend(chartContext, geminiApiKey);

    // API 과부하 방지 딜레이
    await new Promise(r => setTimeout(r, 1000));

    // 3단계: 유형별 패턴 분석 (Flash - 정확도 중요)
    updateProgress('📈 유형별 패턴 및 약점 분석 중');
    const patternAnalysis = await analyzeErrorTypePatterns(classification, weakProblemsSummary, chartContext, geminiApiKey);

    // API 과부하 방지 딜레이 (Pro 호출 전 충분한 대기)
    await new Promise(r => setTimeout(r, 2000));

    // 4단계: 최종 종합 처방 (Pro - 깊이 있는 추론, 1회만 호출)
    updateProgress('🧠 최종 종합 처방 생성 중 (Pro 모델)');
    const synthesis = await synthesizeWithPro(chartAnalysis, classification, patternAnalysis, geminiApiKey);

    // JSON → 마크다운 변환
    let finalReport = `# 🎓 감린이 AI 채점위원 분석 리포트\n\n`;

    // 0. 오답 유형별 통계 (신규 추가)
    if (classification && classification.type_summary) {
      const total = classification.type_summary.이해부족 + classification.type_summary.암기부족 + classification.type_summary.서술불완전;
      finalReport += `## 📊 오답 유형별 통계\n\n`;
      finalReport += `**분석 문제 수:** ${total}문제\n\n`;
      finalReport += `- 🧠 **이해부족:** ${classification.type_summary.이해부족}문제 (${Math.round(classification.type_summary.이해부족 / total * 100)}%)\n`;
      finalReport += `- 📝 **암기부족:** ${classification.type_summary.암기부족}문제 (${Math.round(classification.type_summary.암기부족 / total * 100)}%)\n`;
      finalReport += `- ✍️ **서술불완전:** ${classification.type_summary.서술불완전}문제 (${Math.round(classification.type_summary.서술불완전 / total * 100)}%)\n\n`;
      finalReport += `---\n\n`;
    }

    // 1. 차트 분석
    if (chartAnalysis) {
      finalReport += `## 📈 차트 추세 분석\n\n`;
      finalReport += `**현재 추세:** ${chartAnalysis.trend_status}\n\n`;
      if (chartAnalysis.golden_cross) finalReport += `**골든크로스:** ${chartAnalysis.golden_cross}\n\n`;
      if (chartAnalysis.dead_cross) finalReport += `**데드크로스:** ${chartAnalysis.dead_cross}\n\n`;
      if (chartAnalysis.weak_chapters) finalReport += `**취약 단원:** ${chartAnalysis.weak_chapters}\n\n`;
      finalReport += `**전략 조언:** ${chartAnalysis.recommendation}\n\n`;
      finalReport += `---\n\n`;
    }

    // 2. 유형별 패턴 분석 (신규 추가)
    if (patternAnalysis) {
      finalReport += `## 🔍 유형별 약점 패턴 분석\n\n`;

      // 이해부족 패턴
      if (patternAnalysis.이해부족_패턴 && classification.type_summary.이해부족 > 0) {
        finalReport += `### 🧠 이해부족 패턴 (${classification.type_summary.이해부족}문제)\n\n`;
        if (patternAnalysis.이해부족_패턴.주요개념 && patternAnalysis.이해부족_패턴.주요개념.length > 0) {
          finalReport += `**자주 오해하는 개념:**\n`;
          patternAnalysis.이해부족_패턴.주요개념.forEach(concept => {
            finalReport += `- ${concept}\n`;
          });
          finalReport += `\n`;
        }
        if (patternAnalysis.이해부족_패턴.개선방법) {
          finalReport += `**개선 방법:** ${patternAnalysis.이해부족_패턴.개선방법}\n\n`;
        }
      }

      // 암기부족 패턴
      if (patternAnalysis.암기부족_패턴 && classification.type_summary.암기부족 > 0) {
        finalReport += `### 📝 암기부족 패턴 (${classification.type_summary.암기부족}문제)\n\n`;
        if (patternAnalysis.암기부족_패턴.누락키워드 && patternAnalysis.암기부족_패턴.누락키워드.length > 0) {
          finalReport += `**자주 누락하는 키워드 Top 5:**\n`;
          patternAnalysis.암기부족_패턴.누락키워드.forEach(kw => {
            finalReport += `- ${kw}\n`;
          });
          finalReport += `\n`;
        }
        if (patternAnalysis.암기부족_패턴.단원별분포) {
          finalReport += `**단원별 분포:** ${patternAnalysis.암기부족_패턴.단원별분포}\n\n`;
        }
        if (patternAnalysis.암기부족_패턴.개선방법) {
          finalReport += `**개선 방법:** ${patternAnalysis.암기부족_패턴.개선방법}\n\n`;
        }
      }

      // 서술불완전 패턴
      if (patternAnalysis.서술불완전_패턴 && classification.type_summary.서술불완전 > 0) {
        finalReport += `### ✍️ 서술불완전 패턴 (${classification.type_summary.서술불완전}문제)\n\n`;
        if (patternAnalysis.서술불완전_패턴.주요문제) {
          finalReport += `**주요 약점:** ${patternAnalysis.서술불완전_패턴.주요문제}\n\n`;
        }
        if (patternAnalysis.서술불완전_패턴.개선방법) {
          finalReport += `**개선 방법:** ${patternAnalysis.서술불완전_패턴.개선방법}\n\n`;
        }
      }

      finalReport += `---\n\n`;
    }

    // 3. 최종 종합 처방 (신규 개선)
    if (synthesis) {
      finalReport += `## 💡 최종 종합 처방 (Pro 분석)\n\n`;

      // 현재 진단
      finalReport += `### 📋 현재 학습 상태 진단\n\n`;
      finalReport += `${synthesis.current_diagnosis}\n\n`;

      // 우선순위 조치사항
      finalReport += `### 🎯 우선순위 학습 조치사항\n\n`;
      if (synthesis.priority_actions && synthesis.priority_actions.length > 0) {
        synthesis.priority_actions.forEach((item, idx) => {
          finalReport += `**${idx + 1}. ${item.action}**\n`;
          finalReport += `- 이유: ${item.rationale}\n`;
          finalReport += `- 기대 효과: ${item.expected_effect}\n\n`;
        });
      }

      // 향후 학습 전략
      finalReport += `### 📅 향후 2주간 학습 전략\n\n`;
      finalReport += `${synthesis.study_strategy}\n\n`;

      // 격려 메시지
      finalReport += `### 💪 격려의 말\n\n`;
      finalReport += `${synthesis.encouragement}\n`;
    }

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
    const response = await callGeminiTipAPI(prompt, geminiApiKey);

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
