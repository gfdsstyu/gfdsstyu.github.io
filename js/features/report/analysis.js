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
  if(!window.geminiApiKey){
    openApiModal(false);
    showToast('Gemini API 키를 입력해주세요.','error');
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
① 데이터 요약 → ② 정량 분석 → ③ 정성 분석 → ④ 첨삭 → ⑤ 총평

모든 문장은 명확성·객관성·실질성을 우선합니다.

감정적 표현은 "격려 섹션"에서만 허용됩니다.
데이터:
${JSON.stringify(weakProblemsSummary, null, 2)}

마크다운 형식으로 답변하세요.`;

    const response = await callGeminiTextAPI(prompt, window.geminiApiKey);

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
 * AI 분석 이벤트 리스너 초기화
 */
export function initAIAnalysisListeners() {
  el.aiAnalysisStartBtn?.addEventListener('click', startAIAnalysis);
  el.aiAnalysisCopyBtn?.addEventListener('click', copyAIAnalysis);
}
