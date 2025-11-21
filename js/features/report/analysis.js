/**
 * @fileoverview AI 분석 기능 (v4.0 - Advanced Pipeline for Exam-specific Analysis)
 * - 2-Stage Analysis: Mining (Flash) -> Synthesis (Pro)
 * - 회계감사 수험 특화 분석 (유형 오판, 키워드 누락, 주체 혼동 정밀 진단)
 * - Enhanced error handling and graceful degradation
 *
 * [v4.0 주요 변경사항]
 * 1. 회계감사 수험 특화 오답 분류:
 *    - Misjudged_Type (유형 판단 오류): 사례형인 척하는 기준서 문제에 속음
 *    - Keyword_Gap (키워드 누락): 내용은 알지만 핵심 용어 누락으로 감점
 *    - Wrong_Subject (주체 혼동): 감사인 vs 경영진 책임 혼동
 *    - Recall_Error (단순 암기 부족): 기준서 회독 수 부족
 * 2. 2-Stage Pipeline 구조:
 *    - Stage 1 (Mining): Flash 모델로 빠른 데이터 분류
 *    - Stage 2 (Synthesis): Pro 모델로 심층 분석 및 맞춤형 처방
 * 3. 채점위원 페르소나 강화:
 *    - "칼채점 위원"의 냉철한 진단
 *    - "두문자 요정"의 구체적 암기 팁 (예: 성.시.범)
 */

import { el, $ } from '../../ui/elements.js';
import { callGeminiJsonAPI, callGeminiTipAPI } from '../../services/geminiApi.js';
import { getReportData } from './reportCore.js';
import { showToast } from '../../ui/domUtils.js';
import { openApiModal } from '../settings/settingsCore.js';
import { getGeminiApiKey, getQuestionScores, setQuestionScores, saveQuestionScores, getMemoryTipMode } from '../../core/stateManager.js';
import { normId } from '../../utils/helpers.js';
import { createMemoryTipPrompt } from '../../config/config.js';
import { fetchDetailedRecords } from '../sync/syncCore.js';
import { getCurrentUser } from '../auth/authCore.js';

// ==========================================
// 1. Helper Functions
// ==========================================

/**
 * 차트 컨텍스트 추출 (간소화 버전 - v4.0)
 * @param {object} reportData - getReportData() 반환값
 * @returns {object|null} 차트 분석 컨텍스트
 */
function extractChartContext(reportData) {
  const { chartData, chapterData } = reportData;
  if (!chartData) return null;

  const { ma5, ma20, ma60, sorted } = chartData;
  const lastIdx = ma5.length - 1;

  // 골든/데드크로스 감지 (최근 5일)
  let signal = null;
  for (let i = Math.max(0, lastIdx - 4); i <= lastIdx; i++) {
    if (i < 1) continue;
    if (ma5[i] !== null && ma20[i] !== null && ma5[i-1] !== null && ma20[i-1] !== null) {
      if (ma5[i-1] <= ma20[i-1] && ma5[i] > ma20[i]) {
        signal = "📈 최근 골든크로스 발생 (실력 상승세)";
      }
      if (ma5[i-1] >= ma20[i-1] && ma5[i] < ma20[i]) {
        signal = "📉 최근 데드크로스 발생 (슬럼프 주의)";
      }
    }
  }

  // 정배열 여부
  const isPerfect = ma5[lastIdx] && ma20[lastIdx] && ma60[lastIdx] &&
                    ma5[lastIdx] > ma20[lastIdx] && ma20[lastIdx] > ma60[lastIdx];

  // 취약 단원 추출 (Top 2)
  const weakChapters = Array.from(chapterData.entries())
    .map(([ch, d]) => ({
      ch,
      score: Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length)
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  return {
    ma5: ma5[lastIdx]?.toFixed(1) || 'N/A',
    ma20: ma20[lastIdx]?.toFixed(1) || 'N/A',
    signal: signal || (isPerfect ? "🚀 정배열 상승세 (최상의 상태)" : "평이한 상태"),
    weakChapter: weakChapters[0]?.ch || "없음",
    weakChapterScore: weakChapters[0]?.score || 0
  };
}

/**
 * 마크다운을 HTML로 변환 (스타일 강화 버전)
 * @param {string} md - 마크다운 텍스트
 * @returns {string} - HTML 텍스트
 */
function markdownToHtml(md) {
  if (!md) return '';

  let html = md;

  // Headers with enhanced styling
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-6 mb-3 text-gray-800 dark:text-gray-100 border-l-4 border-blue-500 pl-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-extrabold mt-8 mb-4 text-blue-700 dark:text-blue-400 border-b border-gray-200 dark:border-gray-700 pb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-black mb-6 text-purple-800 dark:text-purple-300">$1</h1>');

  // Bold text with color
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-indigo-700 dark:text-indigo-300">$1</strong>');

  // Lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc text-gray-700 dark:text-gray-300 my-1">$1</li>');

  // Tables (simple conversion)
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^\|.+\|$/)) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table class="min-w-full border-collapse border border-gray-300 dark:border-gray-600 my-4">';
      }
      const cells = line.split('|').filter(c => c.trim());
      // Skip separator line
      if (line.match(/^\|[\s\-:]+\|$/)) continue;

      const isHeader = i === 0 || (processedLines.length > 0 && !processedLines[processedLines.length - 1].includes('<table'));
      const tag = isHeader ? 'th' : 'td';
      const cellClass = isHeader
        ? 'border border-gray-300 dark:border-gray-600 px-4 py-2 bg-blue-100 dark:bg-blue-900 font-bold text-left'
        : 'border border-gray-300 dark:border-gray-600 px-4 py-2 text-left';

      tableHtml += '<tr>' + cells.map(c => `<${tag} class="${cellClass}">${c.trim()}</${tag}>`).join('') + '</tr>';
    } else {
      if (inTable) {
        tableHtml += '</table>';
        processedLines.push(tableHtml);
        tableHtml = '';
        inTable = false;
      }
      processedLines.push(line);
    }
  }

  if (inTable) {
    tableHtml += '</table>';
    processedLines.push(tableHtml);
  }

  html = processedLines.join('\n');

  // Paragraphs
  html = html.split('\n\n').map(para => {
    if (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol') || para.startsWith('<table') || para.startsWith('<li')) {
      return para;
    }
    return para.trim() ? `<p class="my-2 text-gray-700 dark:text-gray-300">${para.trim()}</p>` : '';
  }).join('\n');

  return html;
}

// ==========================================
// 2. Stage 1: Data Mining (Flash Model)
// - 목적: 오답 데이터를 분석하여 '회계감사 특화 오류 유형'으로 분류
// ==========================================

/**
 * Stage 1: 오답 유형 분류 (Flash 모델 사용)
 * @param {Array} problems - 문제 배열
 * @param {string} geminiApiKey - API 키
 * @returns {Promise<Array>} 분류 결과 배열
 */
async function mineWeaknessData(problems, geminiApiKey) {
  console.log('🚀 [Stage 1: Mining] 오답 유형 분류 시작...');

  // Gemini JSON mode는 최상위 타입이 반드시 OBJECT여야 함 (ARRAY 직접 사용 불가)
  const schema = {
    type: "OBJECT",
    properties: {
      classifications: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            index: { type: "NUMBER", description: "문제 인덱스" },
            type: {
              type: "STRING",
              enum: ["Misjudged_Type", "Keyword_Gap", "Wrong_Subject", "Recall_Error"],
              description: "오답 원인 유형"
            },
            keyword: { type: "STRING", description: "누락된 핵심 기준서 키워드 1개" },
            diagnosis: { type: "STRING", description: "진단 요약 (30자 내외)" }
          },
          required: ["index", "type", "keyword", "diagnosis"]
        }
      }
    },
    required: ["classifications"]
  };

  const prompt = `[역할] CPA 회계감사 오답 정밀 분석기
[지침] 학생의 오답과 문제 특성을 분석하여 아래 **4가지 특화 유형** 중 하나로 태깅하세요.

[분류 기준 - 우선순위 순]
1. **Misjudged_Type (유형 판단 오류)**:
   - 문제는 '기준서 내용'을 그대로 묻는 것(발문만으로 답 가능)인데, 학생은 '상황/사례'를 분석하여 답함.
   - 힌트: 문제 주어가 일반적('감사인은')이나, 학생 답은 구체적 상황을 묘사함.
2. **Wrong_Subject (주체 혼동)**:
   - '감사인'이 할 일을 물었는데 '경영진'의 책임을 적음 (또는 반대).
3. **Keyword_Gap (결정적 키워드 누락)**:
   - 내용은 비슷하나 채점 기준이 되는 '전문 용어(예: 유의성, 적격성 등)'가 빠짐.
4. **Recall_Error (단순 암기 부족)**:
   - 아예 다른 내용을 적거나 백지를 냄.

[입력 데이터]
${JSON.stringify(problems, null, 2)}

[출력 형식]
{ "classifications": [ { "index": 0, "type": "...", "keyword": "...", "diagnosis": "..." }, ... ] } 형태로 출력하세요.`;

  try {
    // Flash 모델 사용 (빠르고 저렴)
    let result = await callGeminiJsonAPI(prompt, schema, geminiApiKey, 'gemini-2.5-flash');

    // API 응답 검증 및 추출
    if (!result) {
      console.error('❌ [Stage 1: Mining] API 응답이 null/undefined');
      throw new Error('API 응답이 비어있습니다.');
    }

    // 응답은 { classifications: [...] } 형태여야 함
    if (!result.classifications || !Array.isArray(result.classifications)) {
      console.error('❌ [Stage 1: Mining] API 응답에 classifications 배열이 없음:', result);
      throw new Error('API 응답 형식이 올바르지 않습니다.');
    }

    result = result.classifications;

    console.log('✅ [Stage 1: Mining] 완료 -', result.length, '문제 분류됨');
    return result;
  } catch (error) {
    console.error('❌ [Stage 1: Mining] 실패:', error.message);
    throw error;
  }
}

// ==========================================
// 3. Stage 2: Synthesis (Pro Model)
// - 목적: 통계와 대표 사례를 바탕으로 '수험 전략적' 리포트 생성
// ==========================================

/**
 * Stage 2: 종합 리포트 생성 (Pro 모델 사용)
 * @param {object} stats - 통계 데이터
 * @param {Array} bestExamples - 대표 오답 사례
 * @param {object} chartInfo - 차트 정보
 * @param {string} geminiApiKey - API 키
 * @returns {Promise<object>} 최종 리포트
 */
async function synthesizeReport(stats, bestExamples, chartInfo, geminiApiKey) {
  console.log('🚀 [Stage 2: Synthesis] 종합 리포트 생성 시작...');

  const schema = {
    type: "OBJECT",
    properties: {
      executive_summary: {
        type: "STRING",
        description: "1. 종합 진단 (차트 상태 + 오답률 결합, 3-4문장)"
      },
      pattern_analysis: {
        type: "STRING",
        description: "2. 행동 패턴 분석 (유형별 비율에 따른 구체적 조언, 3-5문장)"
      },
      correction_notes: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            problem_title: { type: "STRING", description: "문제 제목 (간략)" },
            diagnosis: { type: "STRING", description: "채점위원 관점의 냉철한 지적 (2-3문장)" },
            prescription: { type: "STRING", description: "실전적 처방 (두문자 제안 등, 2-3문장)" }
          },
          required: ["problem_title", "diagnosis", "prescription"]
        },
        description: "3. Top 3 집중 케어 (대표 오답 사례별)"
      },
      next_week_strategy: {
        type: "STRING",
        description: "4. 다음 주 합격 전략 (구체적 액션 아이템, 3-4문장)"
      }
    },
    required: ["executive_summary", "pattern_analysis", "correction_notes", "next_week_strategy"]
  };

  const prompt = `[역할] 20년차 CPA 감사 강사 및 출제위원
[목표] 학습 데이터를 기반으로 **'합격권 진입'을 위한 실전 리포트**를 작성하세요.

[입력 데이터]
1. **학습 추세**: ${JSON.stringify(chartInfo)}
2. **오답 통계 (총 ${stats.total}문제)**:
   - 🚫 유형 판단 오류: ${stats.percentages.Misjudged_Type}% ("사례형인 줄 알고 헛다리 짚음")
   - 🔑 키워드 누락: ${stats.percentages.Keyword_Gap}% ("알지만 점수 못 받음")
   - 👤 주체 혼동: ${stats.percentages.Wrong_Subject}% ("감사인 vs 경영진 혼동")
   - 💭 단순 암기 부족: ${stats.percentages.Recall_Error}%
3. **누락 키워드 Top 5**: ${stats.keywords.join(', ') || '없음'}
4. **대표 오답 사례 (집중 케어용)**:
${JSON.stringify(bestExamples, null, 2)}

[작성 지침 - 중요!]
1. **종합 진단 (executive_summary)**:
   - 차트 상태(골든크로스 등)와 오답률을 결합해 현재 위치를 진단하세요.
   - 학생의 강점과 약점을 명확히 파악하세요.

2. **패턴 분석 (pattern_analysis)**:
   - '유형 판단 오류'가 많다면 → "발문(물음)을 먼저 읽고 기준서 문제인지 판단하는 훈련"을 강조하세요.
   - '키워드 누락'이 많다면 → "문장 완성보다 핵심 단어(Terminology) 현출"에 집중하라고 조언하세요.
   - '주체 혼동'이 많다면 → "감사인/경영진/감사위원회 책임 구분표를 만들라"고 조언하세요.

3. **집중 케어 (correction_notes)**:
   - 각 오답 사례에 대해:
     * diagnosis: 채점위원처럼 냉철하게 지적 ("~이 빠져 0점입니다")
     * prescription: **"앞글자(두문자) 따기"**나 **"목차 구조화"** 같은 구체적 암기 팁 제공
     * 예: "이 기준서는 '성.시.범(성격,시기,범위)'으로 외우면 쉽습니다."

4. **전략 (next_week_strategy)**:
   - '기준서 문제'는 점수 밭입니다. 이를 놓치지 않도록 격려하세요.
   - 구체적 액션 아이템 제시 (예: "매일 기준서 10문제 + 키워드 체크리스트 작성")

[톤] 따뜻하면서도 현실적. 칼채점 위원의 냉철함 + 두문자 요정의 실용성

JSON으로 출력하세요.`;

  try {
    // Pro 모델 사용 (높은 추론 능력) - Flash로 폴백 가능
    const models = ['gemini-2.5-pro', 'gemini-2.5-flash'];

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      try {
        console.log(`🧠 [Stage 2: Synthesis] ${model} 모델 시도 중...`);
        const result = await callGeminiJsonAPI(prompt, schema, geminiApiKey, model);
        console.log(`✅ [Stage 2: Synthesis] ${model} 성공`);
        return result;
      } catch (err) {
        const isLastModel = i === models.length - 1;
        if (isLastModel) {
          console.error(`❌ [Stage 2: Synthesis] 모든 모델 실패: ${err.message}`);
          throw err;
        } else {
          console.warn(`⚠️ [Stage 2: Synthesis] ${model} 실패, ${models[i + 1]}로 재시도: ${err.message}`);
          await new Promise(r => setTimeout(r, 2000)); // Pro 실패 후 충분한 대기
        }
      }
    }
  } catch (error) {
    console.error('❌ [Stage 2: Synthesis] 실패:', error.message);
    throw error;
  }
}

// ==========================================
// 4. Main Orchestrator
// ==========================================

/**
 * AI 분석 시작 (v4.0 - 2-Stage Pipeline)
 */
export async function startAIAnalysis() {
  const startBtn = $('ai-analysis-start-btn');
  const loading = $('ai-analysis-loading');
  const resultUi = $('ai-analysis-result');

  // API 키 확인
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    openApiModal(false);
    showToast('Gemini API 키를 입력해주세요.', 'error');
    return;
  }

  if (startBtn) startBtn.parentElement.classList.add('hidden');
  if (loading) loading.classList.remove('hidden');

  // 진행 상황 메시지 업데이트 함수
  const updateMsg = (msg) => {
    if (loading) {
      loading.innerHTML = `<div class="flex items-center gap-3">
        <div class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span class="text-sm text-gray-600 dark:text-gray-300">${msg}</span>
      </div>`;
    }
  };

  try {
    const reportData = getReportData();
    const weakProblems = reportData.weakProblems;

    // 최소 데이터 체크
    if (weakProblems.length === 0) {
      throw new Error("분석할 오답 데이터가 없습니다.");
    }

    if (weakProblems.length < 3) {
      throw new Error(`분석에 필요한 데이터가 부족합니다. (최소 3문제 필요, 현재 ${weakProblems.length}문제)`);
    }

    // ------------------------------------------
    // Step 1: 데이터 준비 (Hybrid Loading)
    // ------------------------------------------
    updateMsg("☁️ 데이터 동기화 및 준비 중...");

    // 최근/중요 오답 최대 12개 추출
    const targetProblems = weakProblems.slice(0, 12);

    const currentUser = getCurrentUser();
    let serverData = {};

    if (currentUser) {
      try {
        console.log(`📥 상세 데이터 조회 시작: ${targetProblems.length}개 문제`);
        serverData = await fetchDetailedRecords(currentUser.uid, targetProblems.map(p => p.qid));
        console.log(`✅ 상세 데이터 로드 완료: ${Object.keys(serverData).length}개`);
      } catch (err) {
        console.warn('⚠️ 서버 데이터 로드 실패, 로컬 데이터 사용:', err.message);
      }
    } else {
      console.log('⚠️ 로그아웃 상태 - 로컬 데이터 사용');
    }

    // 로컬 데이터 가져오기 (stateManager 사용)
    const localScores = getQuestionScores();
    console.log('📦 로컬 데이터 로드:', Object.keys(localScores).length, '개 문제');

    // 분석용 데이터셋 구성 (토큰 절약을 위해 최소화)
    // + 유효한 데이터(답안 또는 피드백이 있는)만 필터링
    const allProblems = targetProblems.map((p, idx) => {
      // qid 정규화 (대소문자 통일, 공백 제거)
      const normalizedQid = String(p.qid || '').trim().toLowerCase();

      // 로컬 데이터 조회 (여러 형식 시도)
      const local = localScores[normalizedQid] ||
                    localScores[p.qid] ||
                    localScores[String(p.qid).toUpperCase()] ||
                    {};
      const server = serverData[p.qid] || {};

      const feedback = server.feedback || local.feedback || "";
      const userAnswer = server.user_answer || local.user_answer || "";

      const hasData = !!(userAnswer || feedback);

      // 디버깅 로그
      console.log(`   - 문제 ${idx+1} (${p.qid}):`,
        hasData ? '✅ 데이터 있음' : '❌ 데이터 없음',
        `(답안: ${userAnswer ? '있음' : '없음'}, 피드백: ${feedback ? '있음' : '없음'})`
      );

      return {
        index: idx,
        id: p.qid,
        q: (p.problem.problemTitle || p.problem.물음 || '').slice(0, 80),
        u_ans: userAnswer.slice(0, 120),
        m_ans: (p.problem.정답 || '').slice(0, 120),
        prev_fb: feedback.slice(0, 100),
        score: p.score || 0,
        hasData
      };
    });

    // 유효한 데이터가 있는 문제만 필터링
    const minifiedProblems = allProblems.filter(p => p.hasData);

    console.log(`📊 데이터 필터링 결과: ${minifiedProblems.length}/${allProblems.length}개 문제에 유효한 데이터 있음`);

    // 디버깅: 각 문제의 데이터 상태 출력
    allProblems.forEach((p, i) => {
      if (!p.hasData) {
        console.warn(`   ⚠️ 문제 ${i+1} (${p.id}): 답안/피드백 없음 - 분석에서 제외`);
      }
    });

    // 필터링 후 최소 데이터 체크
    if (minifiedProblems.length === 0) {
      throw new Error('분석 가능한 데이터가 없습니다.\n답안이나 피드백이 있는 문제가 필요합니다.');
    }

    if (minifiedProblems.length < 3) {
      throw new Error(`분석에 필요한 데이터가 부족합니다.\n답안/피드백이 있는 문제가 최소 3개 필요합니다. (현재 ${minifiedProblems.length}개)`);
    }

    // hasData 필드 제거 (AI에 전달하지 않음)
    const cleanedProblems = minifiedProblems.map(({ hasData, ...rest }) => rest);

    // 🔍 디버깅: AI에 전달되는 실제 데이터 확인
    console.log('🔍 [DEBUG] AI에 전달할 데이터 샘플 (첫 2개):');
    cleanedProblems.slice(0, 2).forEach((p, i) => {
      console.log(`   문제 ${i+1}:`, {
        index: p.index,
        id: p.id,
        q_length: p.q.length,
        u_ans_length: p.u_ans.length,
        m_ans_length: p.m_ans.length,
        prev_fb_length: p.prev_fb.length,
        score: p.score,
        q: p.q.slice(0, 30) + '...',
        u_ans: p.u_ans.slice(0, 30) + '...',
        prev_fb: p.prev_fb.slice(0, 30) + '...'
      });
    });

    // 빈 필드 체크
    const emptyFieldsCount = cleanedProblems.filter(p =>
      !p.q && !p.u_ans && !p.m_ans && !p.prev_fb
    ).length;

    if (emptyFieldsCount > 0) {
      console.warn(`⚠️ 경고: ${emptyFieldsCount}개 문제가 모든 필드가 비어있음`);
    }

    // ------------------------------------------
    // Step 2: Data Mining (Flash Model)
    // ------------------------------------------
    updateMsg("🔍 오답 유형 정밀 분류 중 (Flash)...");

    let miningResult = null;
    try {
      miningResult = await mineWeaknessData(cleanedProblems, apiKey);
    } catch (error) {
      console.error('❌ Mining 단계 실패:', error.message);
      throw new Error(`오답 분류 실패: ${error.message}`);
    }

    // 안전장치: miningResult 검증
    if (!miningResult || !Array.isArray(miningResult)) {
      console.error('❌ Mining 결과가 유효하지 않음:', miningResult);
      throw new Error('오답 분류 결과가 올바르지 않습니다.');
    }

    if (miningResult.length === 0) {
      console.error('❌ Mining 결과가 비어있음');
      throw new Error('오답 분류 결과가 비어있습니다. 다시 시도해주세요.');
    }

    // 통계 집계
    const counts = {
      Misjudged_Type: 0,
      Keyword_Gap: 0,
      Wrong_Subject: 0,
      Recall_Error: 0
    };
    const keywords = [];

    miningResult.forEach(m => {
      if (counts[m.type] !== undefined) counts[m.type]++;
      if (m.keyword && m.keyword.length > 1) keywords.push(m.keyword);
    });

    const totalAnalyzed = miningResult.length;
    const stats = {
      counts,
      total: totalAnalyzed,
      percentages: {
        Misjudged_Type: Math.round(counts.Misjudged_Type / totalAnalyzed * 100) || 0,
        Keyword_Gap: Math.round(counts.Keyword_Gap / totalAnalyzed * 100) || 0,
        Wrong_Subject: Math.round(counts.Wrong_Subject / totalAnalyzed * 100) || 0,
        Recall_Error: Math.round(counts.Recall_Error / totalAnalyzed * 100) || 0
      },
      keywords: [...new Set(keywords)].slice(0, 5)
    };

    // API 과부하 방지 딜레이
    await new Promise(r => setTimeout(r, 1500));

    // ------------------------------------------
    // Step 3: Report Synthesis (Pro Model)
    // ------------------------------------------
    updateMsg("📝 채점위원 심층 리포트 작성 중 (Pro)...");

    // 대표 오답 사례 선정 (우선순위: 유형판단오류 > 키워드누락 > 주체혼동 > 단순암기)
    const bestExamples = [];
    const typePriority = ['Misjudged_Type', 'Keyword_Gap', 'Wrong_Subject', 'Recall_Error'];

    typePriority.forEach(type => {
      if (bestExamples.length >= 3) return;
      const found = miningResult.find(m => m.type === type);
      if (found) {
        const original = cleanedProblems.find(p => p.index === found.index);
        if (original) {
          bestExamples.push({
            type: found.type,
            question: original.q,
            user_answer: original.u_ans,
            model_answer: original.m_ans,
            diagnosis_hint: found.diagnosis,
            score: original.score
          });
        }
      }
    });

    const chartInfo = extractChartContext(reportData);

    let finalReport = null;
    try {
      finalReport = await synthesizeReport(stats, bestExamples, chartInfo, apiKey);
    } catch (error) {
      console.error('❌ Synthesis 단계 실패:', error.message);
      throw new Error(`리포트 생성 실패: ${error.message}`);
    }

    // ------------------------------------------
    // Step 4: Rendering (Markdown Construction)
    // ------------------------------------------
    let md = `# 🎓 감린이 AI 합격 리포트 (v4.0)\n\n`;

    // 1. 차트 & 종합 진단
    if (chartInfo) {
      md += `## 📊 학습 상태 진단\n\n`;
      md += `**추세 신호**: ${chartInfo.signal}\n\n`;
      md += `**현재 이동평균**: 5일선 ${chartInfo.ma5}점, 20일선 ${chartInfo.ma20}점\n\n`;
      md += `**취약 단원**: ${chartInfo.weakChapter} (평균 ${chartInfo.weakChapterScore}점)\n\n`;
      md += `---\n\n`;
    }

    md += `## 💡 종합 진단\n\n`;
    md += `${finalReport.executive_summary}\n\n`;
    md += `---\n\n`;

    // 2. 행동 패턴 분석 (테이블)
    md += `## 🧠 오답 패턴 분석 (총 ${stats.total}문제)\n\n`;
    md += `회계감사 시험에 최적화된 4가지 유형으로 분석했습니다.\n\n`;
    md += `| 유형 | 비율 | 문제수 | 진단 |\n`;
    md += `|:---|:---:|:---:|:---|\n`;
    md += `| **유형 판단 오류** | ${stats.percentages.Misjudged_Type}% | ${stats.counts.Misjudged_Type}문제 | 🚨 사례형인 척하는 기준서 문제에 속음 |\n`;
    md += `| **키워드 누락** | ${stats.percentages.Keyword_Gap}% | ${stats.counts.Keyword_Gap}문제 | ⚠️ 내용은 알지만 점수 못 받는 답안 |\n`;
    md += `| **주체 혼동** | ${stats.percentages.Wrong_Subject}% | ${stats.counts.Wrong_Subject}문제 | 👤 감사인 vs 경영진 책임 혼동 |\n`;
    md += `| **암기 부족** | ${stats.percentages.Recall_Error}% | ${stats.counts.Recall_Error}문제 | 💭 기준서 회독 수 부족 |\n\n`;

    if (stats.keywords.length > 0) {
      md += `**자주 누락하는 키워드**: ${stats.keywords.join(', ')}\n\n`;
    }

    md += `### 🎯 패턴 분석 및 조언\n\n`;
    md += `${finalReport.pattern_analysis}\n\n`;
    md += `---\n\n`;

    // 3. 교정 노트 (Top 3)
    md += `## 📝 Top 3 집중 케어 (채점위원 첨삭)\n\n`;

    if (finalReport.correction_notes && finalReport.correction_notes.length > 0) {
      finalReport.correction_notes.forEach((note, idx) => {
        md += `### ${idx + 1}. ${note.problem_title}\n\n`;
        md += `**🚫 채점위원 지적**\n\n`;
        md += `${note.diagnosis}\n\n`;
        md += `**💊 실전 처방**\n\n`;
        md += `${note.prescription}\n\n`;
        md += `---\n\n`;
      });
    } else {
      md += `대표 사례를 찾을 수 없습니다.\n\n`;
    }

    // 4. 다음 주 전략
    md += `## 🚀 다음 주 합격 전략\n\n`;
    md += `${finalReport.next_week_strategy}\n\n`;
    md += `---\n\n`;
    md += `*이 리포트는 Gemini Pro 모델로 생성되었습니다.*\n`;

    // 결과 표시
    if (el.aiErrorPattern) {
      el.aiErrorPattern.innerHTML = markdownToHtml(md);
    }

    if (loading) loading.classList.add('hidden');
    if (resultUi) resultUi.classList.remove('hidden');

    showToast('AI 분석이 완료되었습니다! 📊', 'success');

  } catch (err) {
    console.error('❌ AI 분석 전체 실패:', err);

    if (loading) loading.classList.add('hidden');
    if (startBtn) startBtn.parentElement.classList.remove('hidden');

    showToast(`AI 분석 실패: ${err.message}`, 'error');

    // 에러 시 최소한의 안내 표시
    if (el.aiErrorPattern) {
      el.aiErrorPattern.innerHTML = `
        <div class="p-6 bg-red-50 dark:bg-red-900 rounded-lg border border-red-200 dark:border-red-700">
          <h3 class="text-lg font-bold text-red-800 dark:text-red-200 mb-3">⚠️ 분석 실패</h3>
          <p class="text-gray-700 dark:text-gray-300 mb-3">${err.message}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400">다음을 확인해주세요:</p>
          <ul class="list-disc ml-6 text-sm text-gray-600 dark:text-gray-400 mt-2">
            <li>Gemini API 키가 올바른지 확인</li>
            <li>네트워크 연결 상태 확인</li>
            <li>분석할 오답 데이터가 충분한지 확인 (최소 3문제)</li>
            <li>잠시 후 다시 시도</li>
          </ul>
        </div>
      `;
    }
  }
}

/**
 * AI 분석 결과 복사
 */
export function copyAIAnalysis() {
  const errorPattern = $('ai-error-pattern')?.innerText || '';

  if (!errorPattern) {
    showToast('복사할 내용이 없습니다.', 'warn');
    return;
  }

  navigator.clipboard.writeText(errorPattern).then(() => {
    showToast('분석 리포트를 클립보드에 복사했습니다! 📋');
  }).catch((err) => {
    console.error('복사 실패:', err);
    showToast('복사 실패', 'error');
  });
}

// ==========================================
// 5. Memory Tip (AI 암기 코치) - 기존 기능 유지
// ==========================================

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
      showToast('저장된 암기 팁을 불러왔습니다! 💡');
      return;
    }
  }

  // 2순위: Gemini API 호출하여 새로 생성
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
