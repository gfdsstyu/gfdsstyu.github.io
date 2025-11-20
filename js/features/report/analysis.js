/**
 * @fileoverview AI 분석 기능 (Advanced Pipeline for v4.0)
 * - 2-Stage Analysis: Mining (Flash) -> Synthesis (Pro)
 * - 토큰 효율성을 위해 기존 채점 데이터 활용 극대화 및 유형별 정밀 분석 복원
 */

import { el, $ } from '../../ui/elements.js';
import { callGeminiJsonAPI } from '../../services/geminiApi.js';
import { getReportData } from './reportCore.js';
import { showToast } from '../../ui/domUtils.js';
import { openApiModal } from '../settings/settingsCore.js';
import { getGeminiApiKey } from '../../core/stateManager.js';
import { fetchDetailedRecords } from '../sync/syncCore.js';
import { getCurrentUser } from '../auth/authCore.js';

// ==========================================
// 1. Helper Functions
// ==========================================

function extractChartContext(reportData) {
  const { chartData, chapterData } = reportData;
  if (!chartData) return null;

  const { ma5, ma20, ma60, sorted } = chartData;
  const lastIdx = ma5.length - 1;

  // 골든/데드크로스 감지 (최근 5일)
  let signal = null;
  for (let i = Math.max(0, lastIdx - 4); i <= lastIdx; i++) {
    if (ma5[i-1] <= ma20[i-1] && ma5[i] > ma20[i]) signal = "최근 골든크로스 발생 (긍정)";
    if (ma5[i-1] >= ma20[i-1] && ma5[i] < ma20[i]) signal = "최근 데드크로스 발생 (주의)";
  }

  // 정배열 여부
  const isPerfect = ma5[lastIdx] > ma20[lastIdx] && ma20[lastIdx] > ma60[lastIdx];

  // 취약 단원 추출
  const weakChapters = Array.from(chapterData.entries())
    .map(([ch, d]) => ({ ch, score: Math.round(d.scores.reduce((a,b)=>a+b,0)/d.scores.length) }))
    .sort((a,b) => a.score - b.score)
    .slice(0, 2); // Top 2만 추출 (토큰 절약)

  return {
    ma5: ma5[lastIdx]?.toFixed(1),
    ma20: ma20[lastIdx]?.toFixed(1),
    signal: signal || (isPerfect ? "정배열 상승세" : "특이사항 없음"),
    weakChapter: weakChapters[0]?.ch || "없음"
  };
}

function markdownToHtml(md) {
  if (!md) return '';
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-5 mb-2 text-gray-800 dark:text-gray-100">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-4 text-blue-700 dark:text-blue-400 border-b border-gray-200 dark:border-gray-700 pb-2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-blue-900 dark:text-blue-200">$1</strong>')
    .replace(/^\- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700 dark:text-gray-300">$1</li>')
    .replace(/\n/g, '<br>');
}

// ==========================================
// 2. Stage 1: Data Mining (Flash Model)
// - 목적: 대량의 오답 데이터를 빠르게 분류하고 태깅
// - 전략: 기존 AI 피드백을 읽고 유형만 분류하라고 지시 (토큰/시간 절약)
// ==========================================

async function mineWeaknessData(problems, geminiApiKey) {
  const schema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        index: { type: "NUMBER" },
        type: { 
          type: "STRING", 
          enum: ["Comprehension", "Recall", "Structure"], 
          description: "오답 원인 유형 (이해/암기/서술)" 
        },
        keyword: { type: "STRING", description: "누락된 핵심 기준서 키워드 1개" },
        cause_summary: { type: "STRING", description: "기존 피드백 요약 (15자 내외)" }
      },
      required: ["index", "type", "keyword", "cause_summary"]
    }
  };

  const prompt = `
[역할] 회계감사 오답 분류기
[지침] 학생의 오답과 '기존 AI 피드백'을 분석하여 아래 기준에 따라 **오답 유형을 태깅**하세요.

[분류 기준 - 엄격 적용]
1. **Comprehension (이해 부족)**: 
   - 묻는 말에 동문서답함
   - 개념 자체를 잘못 알고 있음
2. **Recall (암기 부족)**: 
   - 내용은 대충 맞으나 '기준서 문구'를 정확히 못 씀
   - 핵심 키워드가 누락됨
3. **Structure (서술 미흡)**: 
   - 키워드는 있으나 인과관계가 불분명함
   - "~때문이다" 등의 서술 종결이 어색함

[입력 데이터]
${JSON.stringify(problems)}

분석 결과를 JSON 배열로 출력하세요.`;

  // Flash 모델 사용 (토큰 효율성 최적화)
  return await callGeminiJsonAPI(prompt, schema, geminiApiKey, 'gemini-2.5-flash');
}

// ==========================================
// 3. Stage 2: Synthesis (Pro Model)
// - 목적: 통계 데이터를 바탕으로 통찰력 있는 리포트 작성
// - 전략: 계산된 통계와 대표 사례만 넘겨서 깊이 있는 조언 유도
// ==========================================

async function synthesizeReport(stats, bestExamples, chartInfo, geminiApiKey) {
  const schema = {
    type: "OBJECT",
    properties: {
      qualitative_diagnosis: { type: "STRING", description: "1. 답안 서술 능력 진단 (종합 평가)" },
      pattern_analysis: { type: "STRING", description: "2. 행동 패턴 분석 (유형별 비율에 따른 구체적 조언)" },
      correction_notes: { 
        type: "ARRAY", 
        items: {
            type: "OBJECT",
            properties: {
                problem_title: { type: "STRING" },
                diagnosis: { type: "STRING", description: "채점위원 관점의 지적" },
                prescription: { type: "STRING", description: "구체적인 교정 처방" }
            }
        },
        description: "3. Top 3 교정 노트 (대표 오답 사례별)" 
      },
      total_review: { type: "STRING", description: "4. 총평 및 다음 주 목표" }
    },
    required: ["qualitative_diagnosis", "pattern_analysis", "correction_notes", "total_review"]
  };

  const prompt = `
[역할] 20년차 현직 회계사(CPA) 및 채점위원
[목표] 학습 데이터를 기반으로 **합격을 위한 심층 진단 리포트**를 작성하세요.

[입력 데이터]
1. **학습 추세 (차트)**: ${JSON.stringify(chartInfo)}
2. **오답 통계 (총 ${stats.total}문제 중 비율)**:
   - 🧠 이해 부족 (Comprehension): ${stats.percentages.Comprehension}%
   - 📖 암기 부족 (Recall): ${stats.percentages.Recall}% 
   - 📝 서술 미흡 (Structure): ${stats.percentages.Structure}%
   - 🔑 자주 누락된 키워드: ${stats.keywords.join(', ')}
3. **대표 오답 사례 (심층 첨삭용)**:
${JSON.stringify(bestExamples)}

[작성 지침]
1. **답안 서술 능력**: 통계를 바탕으로 학생의 현재 수준을 냉철하게 진단하세요. (예: 암기 부족이 50%라면 기준서 회독수 부족을 지적)
2. **행동 패턴**: 가장 비율이 높은 오답 유형에 집중하여, 이를 해결하기 위한 구체적 학습법(백지복습, 목차암기 등)을 제안하세요.
3. **교정 노트**: 제공된 오답 사례를 분석하여, 어떻게 고쳐야 부분점수가 아닌 만점을 받을 수 있는지 '채점위원 관점'에서 첨삭하세요.
4. **총평**: 차트의 추세(골든크로스 등)와 오답 패턴을 종합하여, 다음 주에 집중해야 할 구체적 목표를 제시하세요. 어조는 따뜻하고 격려적이어야 합니다.

JSON으로 출력하세요.`;

  // Pro 모델 사용 (높은 추론 능력 필요)
  return await callGeminiJsonAPI(prompt, schema, geminiApiKey, 'gemini-2.5-pro');
}

// ==========================================
// 4. Main Orchestrator
// ==========================================

export async function startAIAnalysis() {
  const startBtn = $('ai-analysis-start-btn');
  const loading = $('ai-analysis-loading');
  const resultUi = $('ai-analysis-result');
  
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    openApiModal(false);
    showToast('Gemini API 키가 필요합니다.', 'error');
    return;
  }

  if (startBtn) startBtn.parentElement.classList.add('hidden');
  if (loading) loading.classList.remove('hidden');

  const updateMsg = (msg) => { 
    const p = loading.querySelector('p');
    if(p) p.textContent = msg; 
  };

  try {
    const reportData = getReportData();
    const weakProblems = reportData.weakProblems;

    if (weakProblems.length === 0) {
      throw new Error("분석할 오답 데이터가 없습니다.");
    }

    // ------------------------------------------
    // Step 1: 데이터 준비 (Hybrid Loading)
    // ------------------------------------------
    updateMsg("☁️ 데이터 동기화 및 준비 중...");
    
    // 최근/중요 오답 최대 15개 추출 (Mining용)
    const targetProblems = weakProblems.slice(0, 15); 
    
    const currentUser = getCurrentUser();
    let serverData = {};
    if (currentUser) {
      try {
        // 상세 데이터(답안, 피드백)는 Firestore에서 가져옴
        serverData = await fetchDetailedRecords(currentUser.uid, targetProblems.map(p => p.qid));
      } catch(e) { console.warn('Server fetch failed:', e); }
    }

    // 분석용 데이터셋 경량화 (Token Diet)
    const minifiedProblems = targetProblems.map((p, idx) => {
      const local = window.questionScores[p.qid] || {};
      const server = serverData[p.qid] || {};
      const feedback = server.feedback || local.feedback || "";
      const userAnswer = server.user_answer || local.user_answer || "";
      
      return {
        index: idx,
        q_id: p.qid,
        q_txt: (p.problem.problemTitle || p.problem.물음).slice(0, 40), // 제목 위주
        u_ans: userAnswer.slice(0, 80),
        m_ans: p.problem.정답.slice(0, 80),
        ai_fb: feedback.slice(0, 100) // 기존 AI 분석 활용
      };
    });

    // ------------------------------------------
    // Step 2: Data Mining (Flash Model)
    // ------------------------------------------
    updateMsg("🔍 오답 유형 분류 및 키워드 추출 (Flash)...");
    const miningResult = await mineWeaknessData(minifiedProblems, apiKey);

    // JS에서 통계 집계 (Token 절약)
    const counts = { Comprehension: 0, Recall: 0, Structure: 0 };
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
        Comprehension: Math.round(counts.Comprehension / totalAnalyzed * 100) || 0,
        Recall: Math.round(counts.Recall / totalAnalyzed * 100) || 0,
        Structure: Math.round(counts.Structure / totalAnalyzed * 100) || 0
      },
      keywords: [...new Set(keywords)].slice(0, 5) // 중복제거 Top 5
    };

    // ------------------------------------------
    // Step 3: Report Synthesis (Pro Model)
    // ------------------------------------------
    updateMsg("📝 채점위원 심층 리포트 작성 중 (Pro)...");
    
    // Top 3 대표 오답 사례 선정 (각 유형별 우선순위)
    const bestExamples = [];
    const types = ['Comprehension', 'Recall', 'Structure'];
    
    // 각 유형별로 하나씩 예제 추출 시도
    types.forEach(type => {
        const found = miningResult.find(m => m.type === type);
        if (found) {
            const original = minifiedProblems.find(p => p.index === found.index);
            bestExamples.push({
                type: found.type,
                question: original.q_txt,
                user_answer: original.u_ans,
                model_answer: original.m_ans,
                diagnosis_hint: found.cause_summary
            });
        }
    });
    // 부족하면 아무거나 채워서 3개 맞춤
    while (bestExamples.length < 3 && bestExamples.length < miningResult.length) {
        const next = miningResult[bestExamples.length];
        const original = minifiedProblems.find(p => p.index === next.index);
        if (!bestExamples.some(e => e.question === original.q_txt)) {
            bestExamples.push({
                type: next.type,
                question: original.q_txt,
                user_answer: original.u_ans,
                model_answer: original.m_ans,
                diagnosis_hint: next.cause_summary
            });
        }
    }

    const chartInfo = extractChartContext(reportData);
    const finalReport = await synthesizeReport(stats, bestExamples, chartInfo, apiKey);

    // ------------------------------------------
    // Step 4: Rendering (Markdown Construction)
    // ------------------------------------------
    let md = `# 🤖 AI 채점위원 딥러닝 리포트\n\n`;
    
    // 1. 차트 & 요약
    if (chartInfo) {
      md += `### 📊 학습 추세 진단\n`;
      md += `- **현재 상태**: ${chartInfo.signal}\n`;
      md += `- **취약 단원**: ${chartInfo.weakChapter}\n\n`;
    }

    // 2. 정성 진단
    md += `### 🩺 답안 서술 능력 진단\n${finalReport.qualitative_diagnosis}\n\n`;

    // 3. 행동 패턴 분석 (테이블)
    md += `### 🧠 행동 패턴 분석 (오답 유형 통계)\n`;
    md += `이번 분석 대상 **${stats.total}문제**의 오답 원인을 분석한 결과입니다.\n\n`;
    md += `| 유형 | 비율 | 진단 |\n|---|---|---|\n`;
    md += `| **이해 부족** | ${stats.percentages.Comprehension}% | 개념 오해 및 동문서답 |\n`;
    md += `| **암기 부족** | ${stats.percentages.Recall}% | 기준서 키워드(${stats.keywords.slice(0,2).join(', ')} 등) 누락 |\n`;
    md += `| **서술 미흡** | ${stats.percentages.Structure}% | 논리 구조 및 인과관계 부족 |\n\n`;
    md += `💡 **분석**: ${finalReport.pattern_analysis}\n\n`;

    // 4. 교정 노트
    md += `### 📝 Top 3 교정 노트 (채점위원 첨삭)\n`;
    finalReport.correction_notes.forEach((note, idx) => {
        md += `**${idx + 1}. ${note.problem_title}**\n`;
        md += `- **🚫 지적**: ${note.diagnosis}\n`;
        md += `- **✅ 처방**: ${note.prescription}\n\n`;
    });

    // 5. 총평
    md += `### 🧾 총평 & Next Step\n${finalReport.total_review}`;

    if (el.aiErrorPattern) el.aiErrorPattern.innerHTML = markdownToHtml(md);

    if (loading) loading.classList.add('hidden');
    if (resultUi) resultUi.classList.remove('hidden');

  } catch (e) {
    console.error(e);
    showToast(`분석 실패: ${e.message}`, 'error');
    if (loading) loading.classList.add('hidden');
    if (startBtn) startBtn.parentElement.classList.remove('hidden');
  }
}

export function copyAIAnalysis() {
  const content = document.getElementById('ai-error-pattern')?.innerText;
  if (content) {
    navigator.clipboard.writeText(content).then(() => showToast('분석 리포트가 복사되었습니다.'));
  }
}

export function initAIAnalysisListeners() {
  el.aiAnalysisStartBtn?.addEventListener('click', startAIAnalysis);
  el.aiAnalysisCopyBtn?.addEventListener('click', copyAIAnalysis);
}
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
