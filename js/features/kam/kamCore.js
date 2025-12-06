// ============================================
// KAM (핵심감사사항) 핵심 로직
// 사례형 실전 훈련 평가 시스템
// ============================================

import ragSearchService from '../../services/ragSearch.js';
import { sanitizeModelText } from '../../utils/helpers.js';

/**
 * KAM 평가 시스템 프롬프트 (금감원 모범사례 기준)
 * 출처: 금융감독원·한국공인회계사회 공동보도자료 (2022.12.29)
 * "핵심감사제(KAM) 모범사례 발표"
 */
const KAM_EVALUATION_CRITERIA = `
# 📘 KAM(핵심감사사항) 모범사례 기반 평가 기준

## 평가 철학 (Evaluation Philosophy)
본 평가는 **"형식적 기재 요건을 넘어, 정보이용자의 이해도를 높이고 감사의 효과성을 파악할 수 있도록 충실하게 기재되었는가?"**를 핵심으로 합니다.

**중요:** 이 평가는 단순히 "잘 썼는가?"를 묻는 것이 아니라, **"모범 답안에 제시된 핵심 요소(Entity-Specific 상황, 구체적 위험, 실질적 절차)를 얼마나 포함했는가?"**를 기준으로 합니다.

---

## 1. 핵심감사사항 선정 이유(Why) 평가 기준

### 📋 평가 원칙 (금감원 체크리스트 기준)

#### A. 기업 특유의 사항 기재 (최우선 평가 요소)
**감사기준서 701호 문단 A44:** 해당 기업만의 고유한 상황(Entity-Specific Matters)을 기재했는가?

**모범사례 기재 요건 (금감원):**
1. **기업 고유의 특성** (예: "다수의 가맹대리점과의 계약 조건", "영업시스템에 집계된 대량의 데이터")
2. **실제 발생한 사건이나 변화** (예: "당기 중 발생한 M&A", "신규 사업 진출")
3. **유의적 판단이 필요한 특정 변수** (예: "할인율", "미래 현금흐름", "손상 징후")
4. **경영진이 유의적 판단을 내린 과정** (예: "경영진은 XX를 고려하여 YY로 판단함")

**대조 예시 (금감원 PDF 4페이지):**
- **Bad (일반적·추상적 기재):** "연결재무제표 주석에 기술된 바와 같이 수익인식의 적정성을 선정함", "매출 형태별로 고유한 위험이 존재하며 기간귀속 오류 가능성이 있음"
- **Good (모범사례):** "다수의 가맹대리점과의 계약 조건, 영업시스템에 집계된 대량의 데이터 등 **복잡한 처리 과정**을 통해 매출 금액이 결정되며, 이러한 복잡성으로 인해 **특정 매출(OO 매출)의 정확성과 관련하여 유의적인 위험**이 있음"

#### B. 주요 고려사항 명시 (감사기준서 701 문단 9)
**핵심 질문:** 이 사항을 '가장 유의적인 사항' 중 하나로 결정하게 된 **주요 고려 사항(판단 근거)**을 구체적으로 언급했는가?

**평가 방법:** 모범 답안에서 언급한 위험 요소를 사용자가 포함했는지 확인하세요.
고유위험요소는 참고용 예시일 뿐이며, **모범 답안에 명시된 구체적인 위험 요소가 채점의 절대 기준**입니다.

**참고: 위험 요소의 예시 유형 (이는 예시일 뿐임)**

##### 1) 복잡성 (Complexity)
회계추정치에 대한 광범위한 가능한 측정 요건, 복잡한 절차를 수반하는 회계측정 등
- 예) "복잡한 계약 조건으로 인한 수익인식 시점 판단의 어려움"
- 예) "다단계 판매 수수료 구조로 인한 거래가격 산정의 복잡성"
- 예) "복잡한 재무모형(DCF)을 사용한 공정가치 평가"
- 예) "관측 불가능한 투입변수(Level 3)를 사용한 금융상품 평가"

##### 2) 주관성 (Subjectivity)
경영진의 유의적인 판단 개입, 새로운 회계기준서 적용의 불확실성 등
- 예) "손상 징후에 대한 경영진의 주관적 판단"
- 예) "미래 현금흐름 예측 시 경영진의 유의적인 가정 사용"
- 예) "신규 회계기준서(K-IFRS 제OO호) 최초 적용에 따른 해석의 불확실성"
- 예) "충당부채 인식의 개연성 판단에 대한 경영진의 주관적 평가"

##### 3) 변화 (Change)
당기 중 발생한 유의적인 사건, 사업구조 변화, 새로운 거래 유형 등
- 예) "당기 중 발생한 대규모 M&A로 인한 연결범위 및 영업권 변동"
- 예) "신규 사업 진출에 따른 새로운 회계처리 요건 발생"
- 예) "경영환경 변화로 인한 자산손상 징후 발생"
- 예) "조직 개편으로 인한 내부통제 구조 변경"

##### 4) 불확실성 (Uncertainty)
회계추정치의 유의적인 측정 불확실성, 미래 사건의 예측 어려움 등
- 예) "회계추정치(충당부채, 공정가치)의 유의적인 측정 불확실성"
- 예) "미래 과세소득 예측의 불확실성으로 인한 이연법인세자산 회수가능성 판단"
- 예) "경제적 불확실성으로 인한 재고자산 순실현가능가치 추정의 어려움"
- 예) "우발채무의 발생 개연성 및 금액 추정의 불확실성"

##### 5) 부정위험요소 (Fraud Risk - 해당 시)
경영진이 부정 재무보고에 개입할 기회, 특수관계자 거래, 경영진 압력 등
- 예) "목표 이익 달성을 위한 경영진의 압력으로 인한 매출 과대계상 위험"
- 예) "특수관계자와의 유의적인 거래로 인한 공정성 및 공시 적정성 위험"
- 예) "경영진 보너스와 연계된 성과지표로 인한 이익조정 유인"
- 예) "내부통제 무력화 가능성이 있는 경영진 개입 거래"

##### 6) 양적/질적 유의성 (Magnitude & Significance)
계정의 재무적 중요성, 이해관계자에 미치는 영향 등
- 예) "연결재무제표 총자산의 XX%를 차지하는 유의적인 금액"
- 예) "영업이익에 직접적인 영향을 미치는 핵심 계정"
- 예) "재무비율(부채비율, 유동비율 등)에 민감하게 영향을 미치는 항목"
- 예) "투자자 및 채권자의 의사결정에 중요한 영향을 미치는 공시사항"

**중요:**
- 위 1)~6) 유형은 **참고용 예시일 뿐**이며, 사용자에게 이 유형을 강요하지 마세요.
- **평가의 절대 기준은 모범 답안입니다.** 모범 답안에 명시된 위험 요소(복잡성, 불확실성 등)를 사용자가 **어떤 표현으로든** 포함했는지 확인하세요.
- 사용자가 모범 답안의 핵심 개념을 다른 표현으로 서술해도 인정해야 합니다.

### ❌ 감점 패턴 (금감원 PDF 4페이지 참조)
1. **단순 금액 중요성만 언급:** "계정과목의 금액이 크다"는 이유만 제시하고, 질적 위험 요소(추정의 불확실성, 복잡성, 주관성)를 누락
2. **주석 참조만 기재:** "주석 X에 기재된 바와 같이..." 식의 수동적 서술
3. **일반적 문구:** 구체적이지 않고 일반적인 문구를 그대로 사용 (예: "매출 형태별로 고유한 위험이 존재하며...")

---

## 2. 핵심감사사항 대응 감사절차(How) 평가 기준

### 📋 평가 원칙 (금감원 체크리스트 기준)

#### A. 위험에 특유한 대응 (Risk-Specific Response)
**감사기준서 701 문단 13:** "평가된 중요왜곡표시위험에 **특유한(Specific to)** 감사인의 대응 및 접근 방법"을 기재했는가?

**모범사례 기재 요건 (금감원):**
1. **기업 특유의 상황과 연관된 감사 방법** (일반적 절차 단순 나열 ✗)
2. **검토한 감사 증거 구체적 명시** (예: "입찰결과통지서", "선적서류", "외부정보원천")
3. **활용한 전문가 명시** (예: "감사인 측 내부 전문가", "외부 평가 전문가")
4. **감사절차의 개략적 개요** (어떤 절차를 어떻게 수행했는지)

**대조 예시 (금감원 PDF 4페이지):**
- **Bad (일반적 절차 나열):** "개발비 인식 회계정책 적정성 검토", "프로젝트별 배부기준 적정성 검토", "주요 지출내역 증빙 검토"
- **Good (모범사례):** "회계정책이 **기업회계기준서 제1038호와 일관성**이 있는지 평가", "**표본추출**을 통해 특정 프로젝트의 **입찰결과통지서** 등 자본화 판단 근거를 확인", "양산 진행 중인 개발비 손상징후 평가를 위해 **독립적인 외부정보원천**을 검토"

#### B. 필수 절차 유형 (체크리스트)

##### B-1. 이해 및 평가
- **내부통제:** 예) "관련 내부통제의 설계 및 운영 효과성 테스트" (단순히 "이해함"이 아님)
- **회계정책:** 예) "회계정책이 기준서(K-IFRS 제OO호)에 부합하는지 평가" (기준서 호수 명시 시 더 좋음)

##### B-2. 실증절차 (Substantive Procedures)
모범사례에서 자주 나타나는 절차 **유형**입니다. 다음 중 위험에 맞는 절차를 포함해야 합니다:
- **가정의 합리성 검토:**
  * 예) "경영진이 사용한 **주요 가정(할인율, 성장률 등)**을 외부 시장자료나 과거 실적과 비교"
  * 예) "**민감도 분석(Sensitivity Analysis)** 수행 - 주요 가정 변동 시 재무제표 영향 평가"
- **전문가 활용:**
  * 예) "복잡한 평가(공정가치, 보험계리)에 대해 **감사인 측 내부 전문가** 또는 **외부 전문가** 활용"
  * 예) "전문가의 적격성, 역량, 객관성 평가"
- **문서 검사 및 재계산:**
  * 예) "계약서, 송장, 선적서류 등 **원본 증빙** 검토" (단순히 "문서 검토"가 아님)
  * 예) "독립적으로 재계산하여 경영진 수치와 대사" (예: 진행률 재계산, 감가상각 재계산)
- **표본추출 및 테스트:**
  * 예) "통계적 표본추출" 또는 "특정 항목 선정 (예: 일정 금액 이상 거래)" 명시

##### B-3. 주요 관찰사항 및 결과 암시 (Key Observations)
- 예) "감사절차 결과 중요한 오류가 발견되지 않았음" 또는 "경영진과 협의하여 조정사항 반영"
- **주의:** 이 부분은 선택사항이나, 모범사례에는 대부분 포함됨

#### C. 관련 공시(주석) 언급 (금감원 체크리스트 항목)
- 예) "재무제표 주석 X번에 기재된 내용의 적정성을 검토함"
- 예) "공시 내용이 기준서 요구사항을 충족하는지 평가"

### ❌ 감점 패턴 (금감원 PDF 4페이지 참조)
1. **단순 나열:** "실증절차 수행", "질문함", "검토함" 식의 추상적 서술
2. **부적절한 절차:** '평가(Valuation)' 이슈인데 '실재성(Existence)' 확인 절차(단순 실사)만 제시
3. **수동적 태도:** "경영진에게 질문함"으로만 끝나고, **경영진의 답변을 검증(Challenge)**하는 절차 누락
4. **일반론:** 구체적인 대상(계정명, 거래 유형, 가정)을 명시하지 않고 "관련 절차 수행"이라고만 기재

---

## 3. 주제별 모범사례 핵심 키워드

### 수익 인식
- **Why (선정 이유):** 복잡한 계약 조건, 기간귀속 판단의 복잡성, 진행률 추정의 주관성, 대량의 거래 데이터 처리
- **How (감사 절차):** 계약서 검토 (5단계 수익인식 모델 적용), 선적서류와 판매시스템 대사, 진행률 재계산, IT 시스템 통제 테스트

### 자산 손상 (영업권, 개발비 등)
- **Why:** 미래 현금흐름 예측의 높은 불확실성, 할인율 결정의 주관성, 경영진의 유의적인 판단 개입
- **How:** 외부 전문가 활용 (가치평가 적정성), 외부 시장자료 비교, 민감도 분석, 사업계획 달성 여부(과거 실적) 검토

### 공정가치 평가
- **Why:** 관측 불가능한 투입변수(Level 3), 평가 모델의 복잡성, 추정의 불확실성
- **How:** 평가 모형의 적정성 검토 (독립적 전문가 활용), 투입변수의 합리성 검증 (외부 시장자료 대조), 기초 데이터 신뢰성 검증

### 재고자산
- **Why:** 진부화 위험, 순실현가능가치(NRV) 추정의 불확실성
- **How:** 저가법 평가 적정성 검토, 연령 분석(Aging Analysis), 판매가격 추세 분석, 재고 실사

### 금융상품
- **Why:** 복잡한 구조화 상품, 기대신용손실(ECL) 추정의 주관성
- **How:** 계약 조건 검토, 신용등급 및 담보 검증, ECL 모형의 적정성 평가, 과거 실적 분석
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
                topic: item.주제, // 새로 추가된 주제 필드
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

---

## 평가 대상 KAM 사례 (이것이 Gold Standard입니다)
### 기업 정보
- **산업:** ${kamCase.industry}
- **규모:** ${kamCase.size}
- **주제:** ${kamCase.topic || kamCase.kam}

### 기업 상황 (Context)
${kamCase.situation}

### 📌 모범 답안 - 선정 이유 (이것이 채점의 절대 기준입니다)
${kamCase.reason}

**중요:** 위 모범 답안은 **"참고용"이 아니라 "채점 기준(Golden Standard)"**입니다.
사용자의 답안이 모범 답안의 핵심 키워드와 개념을 얼마나 포함하고 있는지 1:1로 대조(Mapping)하세요.

---

## 관련 회계감사기준서 (RAG 검색 결과)
${relatedStandards.map((std, idx) => `
${idx + 1}. ${std.problemTitle || ''}
   ${std.정답 || ''}
`).join('\n')}

---

## 평가 지침 (Evaluation Instructions)

### 1단계: 모범 답안 핵심 요소 추출
모범 답안에서 다음 요소들을 먼저 식별하세요:

**A. 기업 특유의 사항 (Entity-Specific Matters) - 금감원 모범사례 기준**
- 기업 고유의 특성 (예: 구체적 계정명, 거래 유형, 계약 조건)
- 실제 발생한 사건이나 변화 (예: M&A, 신규 사업)
- 유의적 판단이 필요한 특정 변수 (예: 할인율, 손상 징후)
- 경영진이 유의적 판단을 내린 과정 (예: 어떻게 판단했는지)

**B. 주요 고려 사항 (판단 근거)**
- 모범 답안에서 언급한 구체적인 위험 요소를 식별하세요
- 이것이 복잡성인지, 불확실성인지 등의 **유형 분류는 중요하지 않습니다**
- **모범 답안에 실제로 쓰여진 표현**이 무엇인지만 파악하세요

### 2단계: 사용자 답안과 1:1 대조 (Mapping)
사용자의 답안이 모범 답안의 각 핵심 요소를 포함하고 있는지 체크하세요:
- ✅ 포함: 정확히 같은 표현이 아니어도, **동일한 개념**을 서술했으면 인정 (예: 모범답안 "복잡한 처리 과정" → 사용자 "다단계 수수료 구조" → 유사 개념으로 인정)
- ❌ 누락: 모범 답안의 핵심 요소가 사용자 답안에 전혀 언급되지 않음
- ⚠️ 부분 포함: 언급은 했으나 구체성이 떨어짐 (예: 모범답안 "운송주선 매출의 진행률 추정" → 사용자 "매출 추정" → 부분 인정)

### 3단계: Bad Pattern 감지 (금감원 PDF 4페이지 참조)
다음 패턴이 발견되면 **대폭 감점**하세요:
1. **일반적/추상적 기재 (Boilerplate):**
   - "주석에 기재된 바와 같이...", "중요해서 선정함", "매출 형태별로 고유한 위험이 존재"
   - 구체적인 계정명이나 거래 유형 없이 "수익", "자산" 같은 일반 용어만 사용
2. **단순 금액 중요성만 언급:**
   - "금액이 크다", "비중이 높다"만 쓰고, **질적 위험 요소(불확실성/복잡성/주관성)** 누락
3. **수동적 서술:**
   - "재무제표에 중요함", "감사상 유의적임" 같은 결론만 쓰고, **왜 그런지 구체적 이유** 누락

### 4단계: 점수 산정
**평가의 절대 기준: 모범 답안과의 일치도**

**핵심 질문:**
1. 모범 답안에 명시된 **기업 특유의 사항**을 사용자가 포함했는가?
2. 모범 답안에 명시된 **주요 고려 사항(위험 요소)**을 사용자가 포함했는가?
3. 금감원 Bad Pattern을 피했는가?

**점수 기준:**
- **90-100점:**
  - 모범 답안의 **Entity-Specific 요소**를 명확히 포함 (예: 구체적 계정명, 거래 조건, 특정 변수)
  - 모범 답안의 **주요 위험 요소**를 **대부분(80% 이상)** 포함
  - Bad Pattern 없음

- **80-89점:**
  - 모범 답안의 Entity-Specific 요소를 포함
  - 모범 답안의 주요 위험 요소를 **일부(50% 이상)** 포함
  - Bad Pattern이 약간 발견되거나 일부 표현이 다소 일반적

- **70-79점:**
  - 모범 답안의 Entity-Specific 요소를 포함하나 구체성 부족
  - 모범 답안의 주요 위험 요소를 **일부(30% 이상)** 포함
  - Bad Pattern이 중간 정도 발견됨

- **60-69점:**
  - Entity-Specific 요소가 모호하거나 일반적
  - 모범 답안의 위험 요소를 거의 포함하지 않음 (단순 금액 중요성만)
  - Bad Pattern이 두드러짐

- **60점 미만:**
  - Bad Pattern이 지배적 (주석 참조만, 천편일률적 문구)
  - 모범 답안의 핵심 요소를 거의 포함하지 않음 (20% 미만)

---

## 피드백 작성 템플릿

반드시 다음 구조를 따라 피드백을 작성하세요:

### 1. 총평 (Summary)
- 모범 답안과의 일치도를 먼저 언급 (예: "모범 답안의 핵심 요소 3개 중 2개를 잘 포착했습니다" 또는 "모범 답안의 Entity-Specific 요소가 누락되었습니다")
- 전반적인 완성도 평가

### 2. 모범 답안 대조 결과 (Model Answer Comparison) - 필수
모범 답안의 핵심 요소를 나열하고, 각각에 대해 사용자가 포함했는지 평가:

**2-1. Entity-Specific 상황:**
- ✅ "모범 답안의 '[구체적 계정명/거래 유형]'을 정확히 포착했습니다."
- ❌ "모범 답안의 '[구체적 계정명/거래 유형]'이 누락되었습니다. 이 부분을 명시해야 합니다."

**2-2. 주요 고려 사항 (위험 요소):**
모범 답안에 명시된 각 위험 요소를 나열하고, 사용자가 포함했는지 평가하세요.
- ✅ "모범 답안의 '[위험 요소 원문 인용]'을 잘 포착했습니다. 회원님은 '[사용자 표현]'이라고 표현하셨는데, 이는 동일한 개념입니다."
- ❌ "모범 답안의 '[위험 요소 원문 인용]'이 누락되었습니다. 이 부분은 이 사례의 핵심 위험이므로 반드시 포함되어야 합니다."
- ⚠️ "모범 답안의 '[위험 요소 원문 인용]'를 언급하셨으나, 더 구체적으로 '[개선 제안]'처럼 쓰면 좋습니다."

**중요:** 위험 요소의 유형(복잡성인지, 불확실성인지)을 판단하지 말고, **모범 답안의 원문 표현**을 그대로 인용하세요.

### 3. Bad Pattern 감지 결과 (선택적, 발견 시에만)
- "일반적/추상적 기재 패턴이 발견되었습니다: '[사용자 표현 인용]' → 이 부분은 구체성이 부족합니다."
- "단순 금액 중요성만 언급하고 질적 위험 요소가 누락되었습니다."

### 4. 개선 제안 (Actionable Suggestions)
- "다음 핵심 키워드를 추가하세요: [누락된 모범 답안 키워드]"
- "이렇게 수정하면 더 좋습니다: [구체적인 예시 문장]"

---

## JSON 응답 형식
{
  "score": 점수 (0-100),
  "feedback": "총평 - 모범 답안과의 일치도 및 전반적인 완성도",
  "modelAnswerComparison": [
    {
      "element": "모범 답안 핵심 요소 1 (예: Entity-Specific 상황)",
      "status": "included" | "missing" | "partial",
      "comment": "사용자가 어떻게 서술했는지, 또는 왜 누락되었는지 설명"
    },
    {
      "element": "모범 답안 핵심 요소 2 (예: Risk Driver - 복잡성)",
      "status": "included" | "missing" | "partial",
      "comment": "..."
    }
  ],
  "badPatterns": ["발견된 Bad Pattern 1 (예: 일반적/추상적 기재)", "발견된 Bad Pattern 2"],
  "strengths": ["잘한 점 1 (구체적 키워드 인용)", "잘한 점 2"],
  "improvements": ["개선할 점 1 (누락된 핵심 요소 명시)", "개선할 점 2"],
  "missingKeywords": ["모범 답안에는 있지만 사용자가 누락한 핵심 키워드 1", "키워드 2"]
}
`;

    const userQuery = `[사용자 답안 - KAM 선정 이유(Why)]\n${userAnswer}\n\n위 답안을 모범 답안과 1:1로 대조하여 평가해주세요. 모범 답안의 각 핵심 요소를 사용자가 포함했는지 체크하고, Bad Pattern이 있는지 감지하세요.`;

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

---

## 평가 대상 KAM 사례 (이것이 Gold Standard입니다)
### 기업 정보 및 배경
- **산업:** ${kamCase.industry}
- **규모:** ${kamCase.size}
- **주제:** ${kamCase.topic || kamCase.kam}
- **상황:** ${kamCase.situation}

### KAM 선정 이유 (Why)
${kamCase.reason}

### 📌 모범 답안 - 감사인의 절차 (이것이 채점의 절대 기준입니다)
${kamCase.procedures.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}

**중요:** 위 모범 답안은 **"참고용"이 아니라 "채점 기준(Golden Standard)"**입니다.
사용자의 답안이 모범 답안의 핵심 절차와 개념을 얼마나 포함하고 있는지 1:1로 대조(Mapping)하세요.

---

## 평가 지침 (Evaluation Instructions)

### 1단계: 모범 답안 절차 분류
모범 답안의 각 절차를 다음 유형으로 분류하세요:
- **A. 이해 및 평가 (Understanding & Evaluation):** 내부통제 테스트, 회계정책 평가, 프로세스 이해
- **B. 실증절차 (Substantive Procedures):**
  - B-1. 가정의 합리성 검토 (외부 데이터 비교, 민감도 분석)
  - B-2. 전문가 활용 (내부/외부 전문가, 적격성 평가)
  - B-3. 문서 검사 및 재계산 (계약서, 증빙, 독립적 재계산)
  - B-4. 표본추출 및 테스트
- **C. 기타 (공시 검토, 주요 관찰사항 등)**

### 2단계: 사용자 답안과 1:1 대조 (Mapping & Gap Analysis)
사용자가 작성한 각 절차를 모범 답안과 대조하세요:
- ✅ **매칭 성공 (Strong Match):** 사용자 절차가 모범 답안의 특정 절차와 **개념적으로 일치**
  - 예: 모범답안 "경영진이 사용한 할인율을 외부 시장자료와 비교" → 사용자 "할인율의 합리성을 외부 벤치마크와 검증" → ✅ 매칭 성공
- ⚠️ **부분 매칭 (Partial Match):** 비슷하지만 구체성이 떨어짐
  - 예: 모범답안 "독립적으로 진행률을 재계산" → 사용자 "진행률 검토" → ⚠️ 부분 매칭 (재계산 언급 없음)
- ❌ **매칭 실패 (No Match):** 일반론이거나 부적절한 절차
  - 예: 모범답안이 "민감도 분석" 같은 구체적 절차인데, 사용자는 "실증절차 수행"만 씀 → ❌ 매칭 실패

### 3단계: Gap Analysis (핵심 개선 사항)
**중요:** 모범 답안에는 있지만 사용자가 누락한 **결정적인 절차(Critical Missing Procedures)**를 반드시 지적하세요.
- "모범 답안에는 '[절차 X]'가 있는데, 회원님의 답안에는 이 부분이 빠져 있습니다."
- "이 절차는 [위험 Y]를 검증하기 위한 핵심 절차이므로, 다음과 같이 추가하면 좋습니다: [구체적 예시]"

### 4단계: Bad Pattern 감지 (금감원 PDF 4페이지 참조)
다음 패턴이 발견되면 **대폭 감점**하세요:
1. **단순 나열:** "실증절차 수행", "문서 검토", "질문함" 식의 추상적 서술 (구체적 대상이나 방법 누락)
2. **부적절한 절차:** '평가(Valuation)' 이슈인데 '실재성(Existence)' 확인 절차만 제시 (예: 손상평가인데 단순 실사만)
3. **수동적 태도:** "경영진에게 질문함"으로만 끝나고, **경영진의 답변을 독립적으로 검증(Challenge)**하는 절차 누락
4. **일반론:** 구체적인 대상(계정명, 가정, 문서명)을 명시하지 않고 "관련 절차 수행"만 기재

### 5단계: 체크리스트 기반 평가 (금감원 PDF 8페이지 참조)
다음 체크리스트 항목을 반드시 확인하세요:
- ✅ **위험에 특유한 대응인가?** (감사기준서 701 문단 13) - 일반적 절차가 아닌, 이 사례의 특정 위험(선정 이유)에 직접 대응하는 절차인가?
- ✅ **구체적 근거가 있는가?** - "외부 시장자료", "과거 실적", "독립적 재계산" 등 구체적 검증 방법을 명시했는가?
- ✅ **관련 공시(주석) 언급이 있는가?** - 재무제표 주석의 적정성을 검토하는 절차가 포함되어 있는가? (선택사항이나 모범사례에는 대부분 포함)

### 6단계: 점수 산정
**기본 원칙:** 문제에서 "3가지 이상"을 요구했으므로, 사용자가 3개 이상을 **정확하게** 작성했다면 높은 점수를 받아야 합니다.
하지만, **모범 답안의 핵심 절차(예: 민감도 분석, 전문가 활용)를 누락했다면**, 학습을 위해 반드시 지적해야 합니다.

- **90-100점:**
  - 3개 이상의 절차를 구체적이고 정확하게 작성 (모범 답안과 Strong Match)
  - 위험과 명확히 연계됨 (Risk-Specific Response)
  - Bad Pattern 없음
  - 모범 답안의 핵심 절차 유형(이해/실증/공시) 중 **최소 2개 이상** 포함

- **80-89점:**
  - 3개 이상의 절차를 작성했으나, 일부 절차는 Partial Match (구체성 다소 부족)
  - 모범 답안의 핵심 절차 유형 중 **1-2개** 포함
  - Bad Pattern이 약간 발견됨 (예: 1-2개 절차가 다소 일반적)

- **70-79점:**
  - 2-3개의 절차를 작성했으나, 대부분 Partial Match 또는 일반적 서술
  - 모범 답안의 핵심 절차 유형을 **일부만** 포함
  - Bad Pattern이 중간 정도 (일반론 혼재)

- **60-69점:**
  - 절차를 작성했으나 대부분 No Match (부적절하거나 일반론 위주)
  - 모범 답안의 핵심 절차 유형을 **거의 포함하지 않음**
  - Bad Pattern이 두드러짐

- **60점 미만:**
  - 절차가 1-2개뿐이거나, 대부분 No Match
  - Bad Pattern이 지배적

---

## 피드백 작성 템플릿

반드시 다음 구조를 따라 피드백을 작성하세요:

### 1. 총평 (Summary)
- 작성한 절차의 개수와 모범 답안과의 일치도를 먼저 언급
- 예: "3개의 절차를 작성하셨으며, 모범 답안의 핵심 절차 유형 중 2개를 잘 포함했습니다."
- 예: "4개의 절차를 작성하셨으나, 일부 절차가 다소 일반적이고, 모범 답안의 핵심 절차인 '민감도 분석'이 누락되었습니다."

### 2. 모범 답안 대조 결과 (Model Answer Comparison) - 필수
사용자가 작성한 각 절차를 모범 답안과 대조하여 평가:
- ✅ **매칭 성공:** "절차 1 '[사용자 표현]'은 모범 답안의 '[모범답안 절차 X]'와 일치합니다. 구체적이며 우수합니다."
- ⚠️ **부분 매칭:** "절차 2 '[사용자 표현]'은 모범 답안의 '[모범답안 절차 Y]'와 유사하나, 더 구체적으로 '[개선 제안]'처럼 쓰면 좋습니다."
- ❌ **매칭 실패:** "절차 3 '[사용자 표현]'은 다소 일반적입니다. 모범 답안의 '[모범답안 절차 Z]'처럼 구체적인 검증 방법을 명시하세요."

### 3. Gap Analysis (반드시 포함) - 핵심 개선 사항
**중요:** 모범 답안에는 있지만 사용자가 누락한 **결정적인 절차**를 반드시 명시하세요.
- "모범 답안에는 '[절차 A]'가 있는데, 회원님의 답안에는 이 부분이 빠져 있습니다."
- "이 절차는 [위험 Y]를 검증하기 위한 핵심 절차이므로, 반드시 포함되어야 합니다."
- 각 누락 절차에 대해 **왜 중요한지** 1-2문장으로 설명하세요.

**예시:**
- "모범 답안에는 '민감도 분석 수행'이 있습니다. 이는 할인율 등 주요 가정이 변동될 때 재무제표에 미치는 영향을 평가하는 핵심 절차입니다. 추정의 불확실성을 검증하기 위해 반드시 포함되어야 합니다."
- "모범 답안에는 '외부 전문가 활용'이 있습니다. 복잡한 평가 모형의 적정성과 객관성을 확보하기 위한 절차이므로, 이 부분도 추가하시면 좋습니다."

### 4. Bad Pattern 감지 결과 (선택적, 발견 시에만)
- "단순 나열 패턴이 발견되었습니다: '[사용자 표현 인용]' → 구체적인 대상이나 방법을 명시하세요."
- "부적절한 절차: '[사용자 표현 인용]' → 이 절차는 '실재성' 확인에 해당하지만, 이 KAM의 핵심 위험은 '평가'입니다."

### 5. 개선 제안 (Actionable Suggestions)
- "다음 절차를 추가하세요: [누락된 모범 답안 절차]"
- "이렇게 수정하면 더 좋습니다: [구체적인 예시 문장]"

---

## JSON 응답 형식
{
  "score": 점수 (0-100),
  "feedback": "총평 - 절차 개수, 모범 답안 일치도, 전반적 완성도",
  "procedureAnalysis": [
    {
      "userProcedure": "사용자가 쓴 절차 1 (원문 인용)",
      "matchStatus": "strong" | "partial" | "none",
      "matchedModelProcedure": "대응되는 모범 답안 절차 (있다면)",
      "evaluation": "이 절차의 강점과 개선점 상세 설명"
    }
  ],
  "gapAnalysis": [
    {
      "missingProcedure": "모범 답안에는 있지만 사용자가 누락한 절차 1",
      "importance": "왜 이 절차가 중요한지, 어떤 위험을 검증하는지 설명 (1-2문장)",
      "suggestion": "구체적으로 어떻게 작성하면 좋은지 예시 제공"
    }
  ],
  "badPatterns": ["발견된 Bad Pattern 1 (예: 단순 나열)", "발견된 Bad Pattern 2"],
  "strengths": ["잘한 점 1 (구체적 키워드 인용)", "잘한 점 2"],
  "improvements": ["개선할 점 1", "개선할 점 2"],
  "keyKeywords": ["사용자가 잘 포함한 핵심 키워드"]
}
`;

    const userQuery = `[사용자 답안 - 감사 절차(How)]\n${userAnswer}\n\n위 답안을 모범 답안과 1:1로 대조하여 평가해주세요. 각 절차의 매칭 상태(Strong/Partial/None)를 판단하고, 모범 답안에는 있지만 사용자가 누락한 결정적인 절차(Gap Analysis)를 반드시 지적하세요. Bad Pattern도 감지해주세요.`;

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
