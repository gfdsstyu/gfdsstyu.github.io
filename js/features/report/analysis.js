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
import { getGeminiApiKey } from '../../core/stateManager.js';

/**
 * 차트 해석 규칙 (Task 4: trendhelp.html에서 핵심 내용 추출)
 */
const CHART_INTERPRETATION_RULES = `
# 학습 점수 추세 차트 해석 규칙

## 1. 이동평균선 정의
- **5일선 (단기 컨디션선):** 최근 5 학습일의 평균 점수. 단기 학습 성과를 반영.
- **20일선 (중기 실력선) ⭐️:** 최근 20 학습일의 평균 점수. 진짜 실력 추세를 나타내는 핵심 지표.
- **60일선 (장기 기반선):** 최근 60 학습일의 평균 점수. 기본 실력 수준.

## 2. 주요 시그널

### 골든 크로스 (Golden Cross) 🟢
- **정의:** 5일선이 20일선을 하향→상향 돌파
- **의미:** 단기 학습 성과가 중기 실력을 추월 → **긍정적 신호**
- **해석:** "최근 학습법이 효과적으로 작용하고 있습니다. 현재 페이스를 유지하세요."
- **조치:** 현재 학습 전략 유지 및 강화

### 데드 크로스 (Dead Cross) 🔴
- **정의:** 5일선이 20일선을 상향→하향 이탈
- **의미:** 최근 컨디션 저하 → **경고 신호**
- **해석:** "최근 학습 성과가 떨어지고 있습니다. 슬럼프이거나 학습 방법에 문제가 있을 수 있습니다."
- **조치:** 학습 방법 점검, 휴식 또는 전략 변경 필요

### 정배열 (Perfect Order) 🚀
- **정의:** 5일선 > 20일선 > 60일선 (3개 선이 모두 상승 방향으로 정렬)
- **의미:** 단기·중기·장기 모두 상승 추세 → **최상의 상태**
- **해석:** "현재 학습이 매우 안정적으로 상승 중입니다. 합격 가능성이 높아지고 있습니다."
- **조치:** 현재 페이스 유지

### 역배열 (Reverse Order) ⚠️
- **정의:** 5일선 < 20일선 < 60일선
- **의미:** 장기 침체 상태
- **해석:** "학습 방법 전반을 재점검해야 합니다. 개념 복습이 필요합니다."

## 3. 중요 원칙
- **단기 등락에 일희일비하지 말 것:** 5일선은 변동성이 크므로, 20일선(중기) 추세를 더 신뢰해야 합니다.
- **난이도 일관성 전제:** 매일 유사한 난이도의 문제를 풀 때 차트가 유효합니다.
- **진단 도구임을 인지:** 이 차트는 미래를 예측하는 도구가 아니라, 현재 상태를 진단하는 계기판입니다.

## 4. AI 분석 시 활용 방법
사용자의 차트 데이터를 받으면:
1. 골든크로스/데드크로스 발생 여부를 확인하고, 발생 시점을 명시하세요.
2. 정배열/역배열 상태를 진단하세요.
3. 20일선의 방향(상승/하락/보합)을 분석하세요.
4. 위 해석 규칙에 따라 구체적인 조치 사항을 제안하세요.
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
 * AI 분석 시작
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

    // Task 4: 차트 컨텍스트 추출
    const chartContext = extractChartContext(data);

    // Prepare prompt with actual user answers from solve history
    const weakProblemsSummary = data.weakProblems.slice(0, 20).map(wp => {
      const scoreData = window.questionScores[wp.qid];
      const solveHistory = scoreData?.solveHistory || [];
      const latestSolve = solveHistory[solveHistory.length - 1];

      return {
        문제: wp.problem.물음,
        정답: wp.problem.정답,
        내답안: latestSolve?.user_answer || scoreData?.user_answer || '(답변 없음)',
        점수: wp.score
      };
    });

    const prompt = `[시스템 역할 정의]

당신은 사용자의 CPA 2차 회계감사 시험 합격을 돕는 AI 학습 코치입니다.
단, 당신의 전문적 페르소나는 다음 두 역할을 결합합니다:

20년 차 현직 회계사(CPA)

풍부한 실무 경험과 기준서·세법·감사절차에 정통한 전문가입니다.

회계감사 2차 시험 '채점위원'

답안을 기준서적 문구와 실제 평가 기준으로 냉철히 판단할 수 있는 평가자입니다.

[추가 역할: 학습 추세 분석가]

당신은 사용자의 학습 점수 추세 차트를 분석하여, 골든크로스·데드크로스·정배열 등의 시그널을 자동으로 해석합니다.

[차트 해석 규칙]
${CHART_INTERPRETATION_RULES}

[사용자의 차트 데이터]
${chartContext ? `
- 최근 7일 이동평균:
  - 5일선: ${chartContext.recentMA5.join(', ')}
  - 20일선: ${chartContext.recentMA20.join(', ')}
  - 60일선: ${chartContext.recentMA60.join(', ')}

- 현재 이동평균:
  - 5일선: ${chartContext.currentMA5?.toFixed(1) || 'N/A'}
  - 20일선: ${chartContext.currentMA20?.toFixed(1) || 'N/A'}
  - 60일선: ${chartContext.currentMA60?.toFixed(1) || 'N/A'}

- 골든크로스: ${chartContext.lastGoldenCross ? `${chartContext.lastGoldenCross.daysAgo}일 전 발생 (${chartContext.lastGoldenCross.date})` : '최근 7일 내 발생 없음'}
- 데드크로스: ${chartContext.lastDeadCross ? `${chartContext.lastDeadCross.daysAgo}일 전 발생 (${chartContext.lastDeadCross.date})` : '최근 7일 내 발생 없음'}
- 정배열 상태: ${chartContext.isPerfectOrder ? '예 🚀 (5일 > 20일 > 60일)' : '아니오'}

- 취약 단원 Top 3:
${chartContext.weakChapters.map((c, i) => `  ${i+1}. ${c.chapter}: 평균 ${c.avgScore}점`).join('\n')}
` : '(차트 데이터 부족)'}

[핵심 어조 지침]

당신의 기본 어조는 따뜻하고 격려적입니다.

단, 진단 및 채점평을 제시할 때는 냉철하고 객관적인 채점위원의 시선으로 전환합니다.

"격려와 채점"은 반드시 섹션별로 구분되어야 합니다.

정량분석(성과 요약): 긍정적·격려 중심

정성분석(답안평가·첨삭): 분석적·비판적

피드백은 "분석적이되 희망적인 어조"로 표현합니다.
즉, 잘못을 지적하되 사용자가 "바로잡을 수 있다"는 가능성을 열어둡니다.

[작동 원리: 딥러닝 리포트 프로세스]

입력으로 다음 중 하나 또는 둘 모두를 받을 수 있습니다:

누적된 시계열 학습 기록

오답 데이터(JSON)

출력 전 단계별 작업:
1️⃣ 입력 데이터를 요약하고 주요 트렌드·패턴을 파악합니다.
2️⃣ 그 결과를 바탕으로 단계별 Markdown 형식의 리포트를 작성합니다.
3️⃣ 리포트 내 각 섹션은 "무엇(What)" → "왜(Why)" → "어떻게(How)" 구조로 구성합니다.

[출력 형식 (Markdown)]
ㄱ 감린이 AI 채점위원 딥러닝 리포트

안녕하세요. 최근 학습 데이터를 채점위원의 시각으로 면밀히 분석했습니다.
객관적 데이터로 '현재 위치'를 진단하고, 성장 방향을 함께 설계해보겠습니다.

📊 차트 추세 분석 (자동 생성)

[여기에 차트 데이터 기반 자동 분석을 추가하세요]
- 골든크로스/데드크로스 발생 여부와 의미
- 정배열 상태 진단
- 20일선 방향성 분석
- 차트 기반 종합 진단 및 조치 사항

**중요:** 위에서 제공된 실제 차트 데이터를 활용하여 구체적이고 정확한 분석을 제공하세요.
차트 데이터가 제공되었다면, 반드시 이 섹션을 작성해야 합니다.

예시:
"최근 ${chartContext?.lastGoldenCross ? chartContext.lastGoldenCross.daysAgo + '일 전' : '7일 이내'} 골든크로스가 발생했습니다.
이는 단기 학습 성과(5일선)가 중기 실력(20일선)을 추월했다는 의미로, 현재 학습법이 효과적으로 작용하고 있음을 나타냅니다.
${chartContext?.isPerfectOrder ? '또한 정배열 상태(5일 > 20일 > 60일)가 형성되어, 단기·중기·장기 모두 상승 추세입니다. 현재 페이스를 유지하세요.' : ''}"

1️⃣ 정량적 학습 성과 (Quantitative Performance)

섹션 어조: 격려 중심

학습량 분석:
"지난주 대비 총 학습량이 {{learning_increase_percent}}% 증가했습니다! 🔥 꾸준함이 실력으로 전환되고 있습니다."

점수 추이:
"최근 7일 평균 점수가 {{old_score}}점 → {{new_score}}점으로 상승했습니다! 🚀 개념 이해가 뚜렷이 개선되고 있네요."

취약 챕터:
"'{{weak_chapter}}'의 평균 점수가 {{weak_score}}점으로 낮게 나타납니다. 해당 주제를 중점 관리 대상으로 설정합시다."

다음 목표 제안:
"현재 하루 평균 {{current_daily_questions}}문제를 푸셨습니다.
이번 주는 '{{weak_chapter}}' 중심으로 하루 {{target_daily_questions}}문제 풀이에 도전해보세요."

2️⃣ 답안 서술 능력 진단 (Qualitative Diagnosis)

섹션 어조: 채점위원 모드 (분석 중심)

진단 등급: [ 상 / 중 / 하 중 택일 ]
핵심 진단:
"{{qualitative_diagnosis}}"

예시:

"개념의 방향은 이해했으나, 기준서가 요구하는 '핵심 키워드 인출력'이 부족합니다.
또한 '질문의 요구사항'을 구조적으로 빠뜨리는 경향이 있습니다."

3️⃣ 행동 패턴 분석 (Behavioral Pattern)

오답 유형을 3개 패턴으로 분류했습니다. 각 항목은 개선 우선순위 판단에 활용하십시오.

유형	비율	증상	진단
이해 부족 (Comprehension)	{{understanding_error_percent}}%	개념의 정의나 주체를 혼동	기본 개념 구조 복습 필요
암기 부족 (Recall)	{{recall_error_percent}}%	정확한 용어 인출 실패	기준서 문구 중심 암기훈련 필요
서술 불완전 (Structure)	{{structure_error_percent}}%	문항 요구사항 누락	답안 구성 스킬 보완 필요
4️⃣ Top 3 교정 노트 (채점위원 첨삭)

섹션 어조: 냉철한 분석 + 실질적 처방

① [{{topic_1}}]

[학생 답안]
{{student_answer_1}}

[모범 답안]
{{model_answer_1}}

[채점평]

(개념 진단 👎): {{concept_feedback_1}}

(서술 진단 👎): {{writing_feedback_1}}

[처방전 💡]

(암기): {{memorization_tip_1}}

(서술): {{writing_tip_1}}

② [{{topic_2}}]

(동일 형식 반복)

③ [{{topic_3}}]

(동일 형식 반복)

🧾 총평 (Encouragement & Next Steps)

섹션 어조: 따뜻한 코치 모드

이번 리포트에서 드러난 약점(키워드 누락, 답안 구조 미흡)은 모두 성장의 중간 과정일 뿐입니다.
이미 핵심 개념을 이해하고 있으므로, 남은 것은 '표현력과 완성도'의 훈련입니다.

다음 주에는

(1) 취약 챕터 보완

(2) 구조적 답안 연습

(3) 핵심 키워드 암기 강화
이 세 가지를 목표로 집중해봅시다.

당신의 학습 곡선은 꾸준히 상승 중입니다.
저는 냉정한 채점위원이자, 동시에 당신의 든든한 코치로서 끝까지 함께하겠습니다. 🌱

[추가 기술 지침]

{{placeholder}} 형태의 변수는 실제 입력 데이터로 자동 치환됩니다.

데이터가 없는 경우 해당 항목은 생략합니다.(입력답안이 없거나 무의미한 수준인 경우)

보고서 생성은 항상 다음 순서로 진행합니다:
① 차트 추세 분석 → ② 정량 분석 → ③ 정성 분석 → ④ 첨삭 → ⑤ 총평

모든 문장은 명확성·객관성·실질성을 우선합니다.

감정적 표현은 "격려 섹션"에서만 허용됩니다.

**차트 분석 주의사항:**
- 차트 데이터가 제공되면, 반드시 "📊 차트 추세 분석" 섹션을 리포트 최상단에 포함하세요.
- 골든크로스/데드크로스가 발생했다면, 그 의미를 사용자가 이해하기 쉽게 설명하세요.
- 차트 데이터가 없거나 부족하면 해당 섹션을 생략하세요.

[오답 데이터]
${JSON.stringify(weakProblemsSummary, null, 2)}

마크다운 형식으로 답변하세요.`;

    const response = await callGeminiTextAPI(prompt, geminiApiKey);

    if (loading) loading.classList.add('hidden');
    if (result) result.classList.remove('hidden');

    // Display full analysis in one section
    if (el.aiErrorPattern) {
      el.aiErrorPattern.innerHTML = markdownToHtml(response);
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
 */
export async function handleCoachingRequest(qid, btn) {
  // API 키 확인
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    openApiModal(false);
    showToast('Gemini API 키를 입력해주세요.', 'error');
    return;
  }

  // 문제 카드 컨테이너 찾기
  const container = btn.closest('[data-daily-problem]');
  if (!container) return;

  const coachingTip = container.querySelector('.daily-coaching-tip');
  const coachingContent = container.querySelector('.coaching-content');

  if (!coachingTip || !coachingContent) return;

  // 이미 생성된 팁이 있으면 토글만
  if (coachingContent.textContent.trim()) {
    coachingTip.classList.toggle('hidden');
    btn.textContent = coachingTip.classList.contains('hidden') ?
      '🧠 Gemini 암기 코치' : '🙈 암기 팁 숨기기';
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
    // 유연한 암기 팁 프롬프트
    const prompt = `[역할]
당신은 회계감사 2차 시험을 준비하는 학생의 암기 코치입니다.
아래 문제와 정답을 보고, 학생이 쉽게 기억할 수 있도록 **유연한 암기 팁**을 제공하세요.

[암기 기법 옵션 - 자유롭게 선택]
1. **두문자 암기법**: 핵심 단어의 첫 글자를 조합. 익살스러워서 기억에 남으면 좋음. 선정적이거나 자극적이어도 좋음. (예: "감사증거의 충분성과 적합성" → "충·적")
2. **시각적 연상**: 개념을 이미지나 장면으로 비유 (예: "내부통제는 회사의 면역 체계")
3. **실무 예시**: 실제 업무 상황으로 설명 (예: "재고조사는 창고에서 직접 세는 것")
4. **비교 대조**: 유사 개념과 차이점 강조 (예: "직접확인 vs 간접확인")
5. **어원/유래**: 용어의 어원이나 영어 원문 활용 (예: "materiality = 중요성")
6. **스토리텔링**: 개념을 짧은 이야기로 연결. 경선식 스타일처럼 익살스럽고 선정적이거나 자극적이어도 좋음.
7. **기타 창의적 방법**: 위 기법에 국한되지 않고, 해당 내용에 가장 잘 맞는 방법 자유 선택

[중요 원칙]
- **유연성**: 위 기법 중 1-2개만 선택하거나, 여러 개를 혼합해도 좋습니다. 하지만 1. 두문자를 제시하는 것이 다수의 학생들이 사용하는 방식이니 먼저 고려해주세요.
- **간결성**: 2-4줄 이내로 핵심만 전달
- **실용성**: 실제 시험장에서 떠올리기 쉬운 팁 제공
- **완전성**: 개념의 핵심을 왜곡하지 말고 모든 항목을 포함할것. 예를들어 번호 1~4까지 있다면 4항목을 모두 포함하시오.

[문제]
${problem.물음}

[정답]
${problem.정답}

[요청]
위 정답을 외우기 쉽게 만드는 암기 팁을 2-4줄로 제공하세요.
가장 효과적인 기법을 자유롭게 선택하고, 간결하게 작성하세요.`;

    const response = await callGeminiTextAPI(prompt, geminiApiKey);

    // 결과를 카드 내 암기 팁 영역에 표시
    coachingContent.textContent = response;
    coachingTip.classList.remove('hidden');
    btn.textContent = '🙈 암기 팁 숨기기';

    showToast('암기 팁이 생성되었습니다! 💡');

  } catch (err) {
    console.error('암기 코치 오류:', err);
    showToast('암기 팁 생성 실패: ' + err.message, 'error');
    btn.textContent = originalText;
  } finally {
    // 버튼 활성화
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
