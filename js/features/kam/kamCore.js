// ============================================
// KAM (핵심감사사항) 핵심 로직
// 사례형 실전 훈련 평가 시스템
// ============================================

import ragSearchService from '../../services/ragSearch.js';
import { sanitizeModelText } from '../../utils/helpers.js';

/**
 * KAM 평가 시스템 프롬프트 (금감원 모범사례 기준)
 */
const KAM_EVALUATION_CRITERIA = `
# 📘 KAM(핵심감사사항) 모범사례 기반 평가 기준

## 1. 평가 대원칙 (General Principles)
1. **구체성 (Specificity):** 교과서적인 일반론이나 표준 문구(Boilerplate)가 아닌, **해당 기업의 고유한 상황(Entity-Specific)**이 반영되었는가?
2. **연계성 (Linkage):** 식별된 위험(Why)과 수행한 절차(How)가 논리적으로 직접 연결되어 있는가?
3. **명확성 (Clarity):** 정보이용자가 이해할 수 있도록 구체적인 근거와 절차를 명시하였는가?

## 2. '선정 이유(Why)' 평가 기준

### ✅ 필수 포함 요소 (Checklist)
- **구체적인 대상:** 단순히 "수익"이나 "자산"이 아닌, **"운송주선 매출"**, **"비한정 내용연수 무형자산"** 등 구체적인 계정이나 거래를 명시했는가?
- **위험의 원천 (Risk Driver):** 왜 이것이 위험한지 구체적인 이유를 서술했는가?
  * **불확실성:** "경영진의 유의적인 추정", "미래 현금흐름 예측의 불확실성"
  * **복잡성:** "복잡한 계약 조건", "관측 불가능한 투입변수(Level 3)"
  * **주관성:** "손상 징후에 대한 경영진의 주관적 판단"
- **재무적 유의성:** "연결재무제표에서 차지하는 비중이 중요함", "손익에 미치는 영향이 큼" 등의 중요성 언급

### ❌ 감점 요인 (Bad Patterns)
- 기업 특유의 상황 없이 단순히 "중요해서 선정함"이라고만 서술
- "계정과목의 금액이 크다"는 이유만 제시하고, 질적인 위험 요소(추정의 불확실성 등)를 누락

## 3. '감사 절차(How)' 평가 기준

### ✅ 필수 포함 요소 (Checklist)
모범사례에서 공통적으로 나타나는 절차 유형입니다. 답안에 다음 키워드나 맥락이 포함되어야 합니다.

#### A. 이해 및 평가 (Understanding & Evaluation)
- **내부통제:** "관련 내부통제의 설계 및 운영 효과성 테스트", "프로세스 이해"
- **회계정책:** "회계정책이 기준서(K-IFRS)에 부합하는지 평가"

#### B. 검증 및 입증 (Verification & Substantive Procedures)
- **가정의 합리성 검토:**
  * 경영진이 사용한 가정(할인율, 성장률 등)을 **"외부 데이터(시장 자료)"**나 **"과거 실적"**과 비교
  * **"민감도 분석(Sensitivity Analysis)"** 수행 여부
- **전문가 활용:** 복잡한 추정(공정가치, 보험계리 등)의 경우 **"감사인 측 내부 전문가"** 또는 **"외부 전문가"**를 활용하여 적격성과 객관성을 평가했는지
- **문서 검사 및 재계산:**
  * "계약서 검토", "송장 및 선적서류 확인" (실재성/기간귀속)
  * "독립적으로 재계산하여 경영진 수치와 비교" (정확성)

### ❌ 감점 요인 (Bad Patterns)
- **단순 나열:** 구체적인 대상 없이 "실증절차를 수행함", "질문함" 이라고만 쓴 경우
- **부적절한 절차:** '평가(Valuation)' 이슈인데 '실재성(Existence)' 확인 절차(단순 실사 등)만 쓴 경우
- **수동적 태도:** 경영진의 주장을 검증(Challenge)하지 않고 "경영진에게 질문함"으로만 끝나는 경우

## 4. 주제별 핵심 키워드 (Topic-Specific Keywords)

### 수익 인식
- **Why:** 기간귀속, 진행률 추정, 복잡한 계약, 인도 기준
- **How:** 계약서 검토, 선적서류 대사, 진행률 재계산, IT 시스템 통제 테스트

### 자산 손상 (영업권 등)
- **Why:** 미래 현금흐름 예측, 할인율 결정, 경영진의 유의적 판단
- **How:** 전문가 활용, 외부 시장자료 비교, 민감도 분석, 사업계획 달성 여부(과거) 검토

### 공정가치 평가
- **Why:** 관측 불가능한 변수(Level 3), 평가 모델의 복잡성
- **How:** 평가 모형의 적정성 검토, 독립적 가치 재산정, 기초 데이터 신뢰성 검증

### 재고자산
- **Why:** 진부화 위험, 순실현가능가치(NRV) 추정
- **How:** 저가법 평가 적정성 검토, 연령 분석, 판매가격 추세 분석
`;

/**
 * KAM 평가 시스템
 */
export class KAMEvaluationService {
  constructor() {
    this.kamData = null;
    this.initialized = false;
  }

  /**
   * KAM 데이터 초기화
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // KAM.json 로드 (새로운 형식)
      const response = await fetch('/js/data/KAM.json');
      if (!response.ok) {
        throw new Error('Failed to load KAM.json');
      }
      const rawData = await response.json();

      // 필드명 매핑 (한글 → 영문)
      this.kamData = rawData.map(item => ({
        num: item.사례번호,
        management_assertion: item.관련경영진주장,
        industry: item.업종,
        size: item.규모,
        topic: item.주제,  // 새로 추가된 주제 필드
        situation: item.상황,
        reason: item.선정이유,
        kam: item.핵심감사사항,
        procedures: item.감사인의절차.split('\n').map(p => p.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]/, '').trim()).filter(p => p)
      }));

      // RAG 검색 시스템 초기화
      await ragSearchService.initialize();

      this.initialized = true;
      console.log('✅ KAM Evaluation System initialized with', this.kamData.length, 'cases');
    } catch (error) {
      console.error('❌ Failed to initialize KAM Evaluation System:', error);
      throw error;
    }
  }

  /**
   * 전체 KAM 사례 가져오기
   */
  getAllCases() {
    return this.kamData || [];
  }

  /**
   * 특정 KAM 사례 가져오기
   * @param {number} num - KAM 사례 번호
   */
  getCaseByNum(num) {
    if (!this.kamData) return null;
    return this.kamData.find(c => c.num === num);
  }

  /**
   * 산업별 KAM 사례 필터링
   */
  getCasesByIndustry(industry) {
    if (!this.kamData) return [];
    return this.kamData.filter(c => c.industry === industry);
  }

  /**
   * Step 1: Why 평가 (선정 이유)
   * @param {string} userAnswer - 사용자 답안
   * @param {Object} kamCase - KAM 사례 객체
   * @param {string} apiKey - Gemini API 키
   * @param {string} model - AI 모델
   * @returns {Promise<Object>} 평가 결과
   */
  async evaluateWhy(userAnswer, kamCase, apiKey, model = 'gemini-2.5-flash') {
    // RAG: 상황에서 관련 기준서 검색
    const relatedStandards = ragSearchService.searchBySituation(
      kamCase.situation,
      kamCase.keywords || [],
      5
    );

    // 시스템 프롬프트 구성
    const systemPrompt = `${KAM_EVALUATION_CRITERIA}

## 평가 대상 KAM 사례
【산업】${kamCase.industry}
【기업 규모】${kamCase.size}
【상황】${kamCase.situation}
【모범 답안 - 선정 이유】${kamCase.reason}

## 관련 회계감사기준서 (RAG 검색 결과)
${relatedStandards.map((std, idx) => `
${idx + 1}. ${std.problemTitle || ''}
   ${std.정답 || ''}
`).join('\n')}

## 평가 지침
사용자의 "KAM 선정 이유(Why)" 답안을 다음 기준으로 평가하세요:
1. **구체성:** 기업 고유의 상황을 반영했는가?
2. **위험 요소:** 불확실성, 복잡성, 주관성 등을 명시했는가?
3. **재무적 중요성:** 중요성을 언급했는가?

## 피드백 작성 템플릿
반드시 다음 구조를 따라 피드백을 작성하세요:

1. **총평 (Summary):**
   - "작성하신 내용은 핵심 위험인 [키워드]를 잘 포착했습니다." 또는
   - "구체성이 다소 부족합니다. 어떤 점이 위험한지 더 명확히 해야 합니다."

2. **잘한 점 (Strengths):**
   - "기업 고유의 상황(예: 진행률 추정)을 잘 언급했습니다."
   - 구체적으로 어떤 부분이 좋았는지 키워드를 인용하여 설명

3. **개선할 점 (Improvements):**
   - "단순히 금액이 크다는 것 외에, **'추정의 불확실성'**이나 **'경영진의 판단 개입'** 같은 질적 위험 요소를 추가해야 합니다."
   - 모범 답안과 비교하여 누락된 핵심 키워드 지적

## JSON 응답 형식
{
  "score": 점수 (0-100),
  "feedback": "총평 - 핵심 위험을 어떻게 포착했는지 또는 무엇이 부족한지",
  "strengths": ["잘한 점 1 (구체적 키워드 인용)", "잘한 점 2"],
  "improvements": ["개선할 점 1 (누락된 키워드 명시)", "개선할 점 2"],
  "missingKeywords": ["모범 답안에는 있지만 사용자가 누락한 핵심 키워드"]
}
`;

    const userQuery = `[사용자 답안 - KAM 선정 이유(Why)]\n${userAnswer}\n\n위 답안을 평가해주세요.`;

    return await this.callGeminiForKAM(systemPrompt, userQuery, apiKey, model);
  }

  /**
   * Step 2: How 평가 (감사 절차)
   * @param {string} userAnswer - 사용자 답안 (감사 절차)
   * @param {Object} kamCase - KAM 사례 객체
   * @param {string} apiKey - Gemini API 키
   * @param {string} model - AI 모델
   * @returns {Promise<Object>} 평가 결과
   */
  async evaluateHow(userAnswer, kamCase, apiKey, model = 'gemini-2.5-flash') {
    const systemPrompt = `${KAM_EVALUATION_CRITERIA}

## 평가 대상 KAM 사례
【KAM 주제】${kamCase.kam}
【선정 이유】${kamCase.reason}

## 모범 답안 (감사인의 절차)
이 사례의 모범 답안은 다음과 같습니다. 반드시 이 모범 답안을 기준으로 사용자 답안을 평가하세요:
${kamCase.procedures.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}

## 평가 지침
**중요:** 문제에서 "3가지 이상"이라고 요구했으므로, 사용자가 3개를 완벽하게 작성했다면 높은 점수를 받아야 합니다.
모범 답안이 5-6개라도, 사용자가 그 중 3개를 정확하게 작성했다면 **작성한 3개의 완성도를 기준으로 평가**하세요.

### 1차 평가: 작성한 절차의 완성도 (최우선)
- 사용자가 작성한 각 절차가 **구체적이고 위험과 연계**되어 있는가?
- 모범 답안의 핵심 요소(내부통제/전문가/문서검사/재계산 등)를 포함하는가?
- 일반론("실증절차 수행")이 아닌 **구체적 행위**를 묘사했는가?

### 2차 평가: 모범 답안과의 비교 (참고용)
- 작성한 절차가 모범 답안의 어떤 절차와 대응되는가?
- 모범 답안에 있는 추가적인 좋은 절차가 있다면 피드백에서 제안
- **단, 사용자가 3개 이상을 정확하게 작성했다면 누락된 절차는 감점 요인이 아님**

## 점수 기준
- **90-100점:** 3개 이상의 절차를 구체적이고 정확하게 작성. 위험과 명확히 연계됨
- **80-89점:** 3개 이상의 절차를 작성했으나 일부 절차가 다소 일반적
- **70-79점:** 2-3개의 절차를 작성했으나 구체성이 부족
- **60-69점:** 절차를 작성했으나 대부분 일반적이거나 부적절
- **60점 미만:** 절차가 1-2개뿐이거나 대부분 부적절

## 감점 요인 체크
- 단순 나열 ("실증절차 수행"만 기재)
- 부적절한 절차 (평가 이슈인데 실재성 확인만)
- 수동적 태도 ("질문함"으로만 끝남)
- **단, 작성한 절차의 개수는 3개 이상이면 감점 없음**

## 피드백 작성 템플릿
반드시 다음 구조를 따라 피드백을 작성하세요:

1. **총평 (Summary):**
   - 작성한 절차의 개수와 전반적인 완성도 평가
   - 예: "3개의 절차를 구체적이고 명확하게 작성하셨습니다. 위험과의 연계성이 우수합니다."
   - 예: "4개의 절차를 작성하셨으나, 일부 절차가 다소 일반적입니다."

2. **절차별 분석 (Procedure Analysis):**
   - 사용자가 작성한 각 절차의 강점과 개선점
   - 예: "절차 1 '내부통제 평가'는 구체적이며 좋습니다."
   - 예: "절차 2 '문서 검사'는 있으나, '선적서류와 대사'처럼 더 구체적으로 쓰면 더 좋습니다."

3. **추가 제안 (선택사항):**
   - 사용자가 3개 이상을 잘 작성했다면, 모범 답안의 추가 절차를 **참고용**으로 제안
   - 예: "추가로, 모범 답안에는 '민감도 분석' 절차도 포함되어 있습니다. 참고하세요."
   - **중요:** 이것은 감점 요인이 아니라 학습을 위한 추가 정보입니다.

## JSON 응답 형식
{
  "score": 점수 (0-100),
  "feedback": "총평 - 작성한 절차의 개수, 완성도, 구체성 평가",
  "procedureAnalysis": [
    {
      "procedure": "사용자가 쓴 절차 1 (원문 인용)",
      "evaluation": "이 절차의 강점과 개선점 (예: '구체적이며 좋습니다' 또는 '더 구체적으로 쓰면 좋습니다')"
    }
  ],
  "additionalSuggestions": [
    "모범 답안에는 이런 절차도 있습니다 (참고용, 감점 요인 아님): [추가 절차 설명]"
  ],
  "keyKeywords": ["사용자가 작성한 절차에서 잘 포함한 핵심 키워드"]
}
`;

    const userQuery = `[사용자 답안 - 감사 절차(How)]\n${userAnswer}\n\n위 답안을 평가해주세요. 사용자가 작성한 각 절차의 완성도를 분석하고, 구체성과 위험과의 연계성을 중심으로 피드백해주세요. 만약 사용자가 3개 이상의 절차를 잘 작성했다면 높은 점수를 주고, 모범 답안의 추가 절차는 학습을 위한 참고용으로만 제안하세요 (감점 요인 아님).`;

    return await this.callGeminiForKAM(systemPrompt, userQuery, apiKey, model);
  }

  /**
   * Gemini API 호출 (KAM 전용)
   * @private
   */
  async callGeminiForKAM(systemPrompt, userQuery, apiKey, model = 'gemini-2.5-flash') {
    const MODEL_MAP = {
      'gemini-2.5-flash': 'gemini-2.5-flash',
      'gemini-2.0-flash': 'gemini-2.0-flash',
      'gemini-2.5-pro': 'gemini-2.5-pro'
    };

    const modelName = MODEL_MAP[model] || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3, // 일관성을 위해 낮은 temperature
        topP: 0.8,
        topK: 40
      }
    };

    const MAX_RETRIES = 3;
    const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
    const RETRYABLE_MESSAGE_REGEX = /(model is overloaded|rate limit|please try again later|backend error)/i;
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = body?.error?.message || res.statusText || 'Unknown error';
          const shouldRetry = RETRYABLE_STATUS.has(res.status) || RETRYABLE_MESSAGE_REGEX.test(msg);

          if (shouldRetry && attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.warn(`[KAM] Gemini API transient error (status: ${res.status}). Retrying in ${delay}ms.`, {
              attempt,
              message: msg
            });
            await wait(delay);
            continue;
          }

          throw new Error(`Gemini API Error (${res.status}): ${msg}`);
        }

        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const cleaned = sanitizeModelText(raw);

        try {
          return JSON.parse(cleaned);
        } catch (parseError) {
          console.error('[KAM] Failed to parse Gemini response:', {
            raw,
            cleaned,
            parseError: parseError.message
          });

          if (attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            console.warn(`[KAM] Retrying due to JSON parse failure. Next attempt in ${delay}ms.`, {
              attempt,
              parseError: parseError.message
            });
            await wait(delay);
            continue;
          }

          throw new Error(`Invalid JSON response from Gemini API: ${parseError.message}`);
        }
      } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          throw new Error('API 요청 시간 초과 (60초)');
        }

        const shouldRetry = attempt < MAX_RETRIES && (
          RETRYABLE_MESSAGE_REGEX.test(error.message || '') ||
          /fetch failed/i.test(error.message || '')
        );

        if (shouldRetry) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.warn(`[KAM] Gemini API call failed (attempt ${attempt}). Retrying in ${delay}ms.`, {
            error: error.message
          });
          await wait(delay);
          continue;
        }

        console.error('[KAM] Gemini API call failed:', {
          error: error.message,
          stack: error.stack,
          model: modelName,
          attempt
        });
        throw error;
      }
    }

    throw new Error('Gemini API 호출에 반복적으로 실패했습니다. 잠시 후 다시 시도해주세요.');
  }

  /**
   * 종합 평가 (Why + How)
   * @param {Object} whyResult - Why 평가 결과
   * @param {Object} howResult - How 평가 결과
   * @returns {Object} 종합 평가 결과
   */
  calculateFinalScore(whyResult, howResult) {
    // Why: 40%, How: 60% 가중치
    // whyResult가 null이면 (채점 건너뛴 경우) Why 점수를 0으로 처리
    const whyScore = whyResult ? whyResult.score : 0;
    const howScore = howResult ? howResult.score : 0;
    const finalScore = Math.round(whyScore * 0.4 + howScore * 0.6);

    return {
      finalScore,
      whyScore,
      howScore,
      overallFeedback: this.generateOverallFeedback(finalScore, whyResult, howResult)
    };
  }

  /**
   * 종합 피드백 생성
   * @private
   */
  generateOverallFeedback(finalScore, whyResult, howResult) {
    let grade = '';
    if (finalScore >= 90) grade = 'A (우수)';
    else if (finalScore >= 80) grade = 'B (양호)';
    else if (finalScore >= 70) grade = 'C (보통)';
    else if (finalScore >= 60) grade = 'D (미흡)';
    else grade = 'F (매우 미흡)';

    const whyScoreText = whyResult ? `${whyResult.score}점` : '채점 건너뜀 (0점)';
    const whyFeedbackText = whyResult?.feedback || 'Step 1을 채점하지 않았습니다. Step 2 결과만 반영되었습니다.';
    const howScoreText = howResult ? `${howResult.score}점` : '채점 미실시';
    const howFeedbackText = howResult?.feedback || 'Step 2 평가가 완료되지 않았습니다. 다시 시도해주세요.';

    const overallMessage = finalScore >= 80
      ? '전반적으로 우수한 답안입니다. 금감원 모범사례 기준을 잘 충족하고 있습니다.'
      : finalScore >= 60
        ? '기본적인 이해는 있으나, 구체성과 실무적 접근이 보완되면 좋겠습니다.'
        : 'KAM 작성의 핵심 원칙을 다시 학습하시기 바랍니다. 구체성, 연계성, 명확성을 고려해주세요.';

    return `
## 종합 평가: ${finalScore}점 (${grade})

### Why (선정 이유): ${whyScoreText}
${whyFeedbackText}

### How (감사 절차): ${howScoreText}
${howFeedbackText}

### 종합 의견
${overallMessage}
`;
  }
}

// 싱글톤 인스턴스
const kamEvaluationService = new KAMEvaluationService();
export default kamEvaluationService;
