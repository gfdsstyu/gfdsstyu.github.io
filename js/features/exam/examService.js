/**
 * Past Exam Service
 * 기출문제 데이터 로딩, 답안 저장, 채점 로직 관리
 */

import { getExam2025, getExamMetadata } from './examData.js';

class ExamService {
  constructor() {
    this.examData = {};
    this.metadata = {};
    this.initialized = false;
  }

  /**
   * 초기화
   */
  async initialize() {
    if (this.initialized) return;

    // KAM 데이터 비동기 로드
    const exam2025 = await getExam2025();
    const metadata = await getExamMetadata();

    this.examData = {
      2025: exam2025
    };
    this.metadata = metadata;

    console.log('✅ Past Exam Service initialized with KAM data');
    console.log(`   - ${exam2025.length}개 사례`);
    console.log(`   - 총 ${this.getTotalQuestions(2025)}개 문제`);
    console.log(`   - 만점: ${this.getTotalScore(2025)}점`);

    this.initialized = true;
  }

  /**
   * 연도별 시험 데이터 가져오기
   */
  getExamByYear(year) {
    return this.examData[year] || [];
  }

  /**
   * 특정 케이스 가져오기
   */
  getCaseById(year, caseId) {
    const exams = this.getExamByYear(year);
    return exams.find(exam => exam.id === caseId);
  }

  /**
   * 연도별 메타데이터 가져오기
   */
  getMetadata(year) {
    return this.metadata[year] || {
      totalScore: 100,
      timeLimit: 90,
      passingScore: 60
    };
  }

  /**
   * 전체 문제 수 계산
   */
  getTotalQuestions(year) {
    const exams = this.getExamByYear(year);
    return exams.reduce((sum, exam) => sum + exam.questions.length, 0);
  }

  /**
   * 총점 계산
   */
  getTotalScore(year) {
    const exams = this.getExamByYear(year);
    return exams.reduce((sum, exam) => {
      return sum + exam.questions.reduce((qSum, q) => qSum + q.score, 0);
    }, 0);
  }

  // ============================================
  // 답안 저장/불러오기 (LocalStorage)
  // ============================================

  /**
   * 사용자 답안 저장
   */
  saveUserAnswer(year, questionId, answer) {
    const key = `exam_${year}_answers`;
    const existing = this.getUserAnswers(year);

    existing[questionId] = {
      answer,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem(key, JSON.stringify(existing));
      console.log(`💾 답안 저장: ${questionId}`);
    } catch (error) {
      console.error('답안 저장 실패:', error);
    }
  }

  /**
   * 사용자 답안 불러오기
   */
  getUserAnswers(year) {
    const key = `exam_${year}_answers`;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('답안 불러오기 실패:', error);
      return {};
    }
  }

  /**
   * 사용자 답안 초기화 (재응시)
   */
  clearUserAnswers(year) {
    const key = `exam_${year}_answers`;
    localStorage.removeItem(key);
    console.log(`🗑️ 답안 초기화: ${year}년`);
  }

  // ============================================
  // 타이머 상태 관리
  // ============================================

  /**
   * 타이머 시작 시간 저장
   */
  saveTimerStart(year) {
    const key = `exam_${year}_timer_start`;
    localStorage.setItem(key, Date.now().toString());
  }

  /**
   * 타이머 시작 시간 가져오기
   */
  getTimerStart(year) {
    const key = `exam_${year}_timer_start`;
    const start = localStorage.getItem(key);
    return start ? parseInt(start, 10) : null;
  }

  /**
   * 남은 시간 계산 (분)
   */
  getRemainingTime(year) {
    const start = this.getTimerStart(year);
    if (!start) return null;

    const metadata = this.getMetadata(year);
    const elapsed = (Date.now() - start) / 1000 / 60; // 분 단위
    const remaining = metadata.timeLimit - elapsed;

    return Math.max(0, Math.round(remaining));
  }

  /**
   * 타이머 초기화
   */
  clearTimer(year) {
    const key = `exam_${year}_timer_start`;
    localStorage.removeItem(key);
  }

  // ============================================
  // 점수 저장/불러오기 (히스토리)
  // ============================================

  /**
   * 점수 저장
   */
  saveScore(year, score, details) {
    const key = `exam_${year}_scores`;
    const existing = this.getScores(year);

    existing.push({
      score,
      details, // { questionId: { score, feedback } }
      timestamp: Date.now(),
      attempt: existing.length + 1
    });

    try {
      localStorage.setItem(key, JSON.stringify(existing));
      console.log(`📊 점수 저장: ${year}년 - ${score}점 (${existing.length}차 응시)`);
    } catch (error) {
      console.error('점수 저장 실패:', error);
    }
  }

  /**
   * 점수 불러오기 (배열)
   */
  getScores(year) {
    const key = `exam_${year}_scores`;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('점수 불러오기 실패:', error);
      return [];
    }
  }

  /**
   * 최고 점수 가져오기
   */
  getBestScore(year) {
    const scores = this.getScores(year);
    if (scores.length === 0) return null;

    return Math.max(...scores.map(s => s.score));
  }

  /**
   * 최근 점수 가져오기
   */
  getLatestScore(year) {
    const scores = this.getScores(year);
    if (scores.length === 0) return null;

    return scores[scores.length - 1];
  }

  // ============================================
  // 임시저장 (Temp Save)
  // ============================================

  /**
   * 임시저장 데이터 저장
   */
  saveTempData(year, results) {
    const key = `exam_${year}_temp_save`;
    const data = {
      timestamp: Date.now(),
      results: results,
      totalScore: Object.values(results).reduce((sum, r) => sum + (r.score || 0), 0)
    };

    try {
      localStorage.setItem(key, JSON.stringify(data));
      console.log('💾 임시저장 완료:', data.totalScore.toFixed(1) + '점');
    } catch (error) {
      console.error('임시저장 실패:', error);
    }
  }

  /**
   * 임시저장 데이터 불러오기
   */
  getTempSaveData(year) {
    const key = `exam_${year}_temp_save`;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('임시저장 데이터 로드 실패:', error);
      return null;
    }
  }

  /**
   * 임시 채점 실행 (5분 쿨다운)
   */
  async tempGradeExam(year, userAnswers, apiKey, model = 'gemini-2.5-flash') {
    const exams = this.getExamByYear(year);
    const results = {};

    // 모든 문제 채점 (간소화 버전 - 병렬 처리)
    const allPromises = [];

    for (const examCase of exams) {
      for (const question of examCase.questions) {
        const userAnswer = userAnswers[question.id]?.answer;

        if (userAnswer && userAnswer.trim() !== '') {
          allPromises.push(
            this.gradeQuestion(examCase, question, userAnswer, apiKey, model)
              .then(result => ({ questionId: question.id, result }))
              .catch(error => {
                console.error(`문제 ${question.id} 채점 실패:`, error);
                return {
                  questionId: question.id,
                  result: {
                    score: 0,
                    feedback: '채점 중 오류 발생'
                  }
                };
              })
          );
        } else {
          results[question.id] = {
            score: 0,
            feedback: '답안 미작성'
          };
        }
      }
    }

    // 병렬 채점
    const gradedResults = await Promise.all(allPromises);

    // 결과 병합
    gradedResults.forEach(({ questionId, result }) => {
      results[questionId] = result;
    });

    // 총점 계산
    const totalScore = Object.values(results).reduce((sum, r) => sum + (r.score || 0), 0);

    // 임시저장
    this.saveTempData(year, results);

    return {
      results,
      totalScore
    };
  }

  // ============================================
  // 채점 로직 (AI 호출)
  // ============================================

  /**
   * 단일 문제 채점
   */
  async gradeQuestion(examCase, question, userAnswer, apiKey, model = 'gemini-2.5-flash') {
    // Rule vs Case 타입별 프롬프트 전략 분기
    const systemPrompt = this.buildGradingPrompt(examCase, question);

    const userPrompt = `[사용자 답안]\n${userAnswer}\n\n위 답안을 모범 답안과 비교하여 채점해주세요.`;

    // Gemini API 호출 (기존 geminiApi.js 사용)
    return await this.callGeminiForGrading(systemPrompt, userPrompt, apiKey, model);
  }

  /**
   * 채점 프롬프트 생성 (Rule/Case 타입별)
   */
  buildGradingPrompt(examCase, question) {
    // Type이 없는 경우 대비 (null, undefined, 빈 문자열 처리)
    const hasType = examCase.type && examCase.type.trim() !== '';
    const isRule = hasType && examCase.type === 'Rule';
    const isCase = hasType && examCase.type === 'Case';

    // Type 표시 (없으면 "일반" 표시)
    const typeDisplay = hasType
      ? (examCase.type === 'Rule' ? '기준서(Rule)' : '사례(Case)')
      : '일반';

    const basePrompt = `
# 2025 공인회계사 2차 시험 채점 AI

## 문제 정보
- 주제: ${examCase.topic}
- 타입: ${typeDisplay}
- 배점: ${question.score}점

## 지문 (Scenario)
${examCase.scenario}

## 문제
${question.question}

## 모범 답안 (채점 기준)
${question.model_answer}

## 평가 기준 (Check Point)
${question.evaluation_criteria}

---

## 🚨 절대적 평가 원칙 (Absolute Evaluation Principle)

**당신의 역할:** 제공된 [모범 답안]과 [사용자 답안]을 비교하는 채점자입니다.

**금지 사항:**
1. **모범 답안에 없는 내용을 당신의 일반적인 회계감사/윤리 지식을 근거로 요구하거나 제안하지 마세요.**
2. **"일반적으로", "통상적으로", "실무에서는" 같은 표현으로 모범 답안 외 내용을 언급하지 마세요.**
3. **모범 답안의 범위를 벗어난 법조항이나 키워드를 사용자에게 요구하지 마세요.**

---

## 채점 전략 (${hasType ? (isRule ? 'Rule 타입' : 'Case 타입') : '일반'})

${!hasType ? `
### 일반 채점 지침 (모범 답안 기준 평가)

**Type이 명시되지 않았으므로, 모범 답안에 충실한 일반적 채점 기준을 적용합니다.**

**1. 내용 정확성 (40-50%)**
- 사용자의 답변이 모범 답안의 **핵심 내용**과 일치하는가?
- 모범 답안의 결론 또는 주요 판단이 포함되어 있는가?

**2. 핵심 키워드 포함 (30-40%)**
- 모범 답안의 **주요 개념 및 용어**가 언급되었는가?
- 키워드가 정확히 일치하지 않아도, **문맥상 동일한 의미**를 전달하면 인정

**3. 논리 및 구조 (10-20%)**
- 답변의 논리 전개가 명확하고 타당한가?
- 모범 답안의 구조를 유사하게 따르고 있는가?

**4. 구체성 (10-20%)**
- 추상적이지 않고 구체적인 내용을 포함하는가?
- 실무적/실전적 관점이 반영되어 있는가?

**점수 배분 예시 (10점 문제):**
- 핵심 내용 정확 + 키워드 포함 + 논리 명확 → 9-10점
- 핵심 내용 이해 + 키워드 일부 + 논리 타당 → 7-8점
- 부분적 이해 + 일부 키워드 → 5-6점
- 내용 부족 + 키워드 부족 → 3-4점
- 문제 의도 오해 → 0-2점
` : (isRule ? `
### Rule 타입 채점 지침 (법적 근거 기반 평가)

**1. 결론 정확성 (40-50%)**
- 사용자의 최종 결론(수임 가능/불가능, 위협 발생/미발생 등)이 모범 답안과 **정확히 일치**하는가?
- **결론 불일치 시:** 최대 50% 감점 (예: 10점 문제 → 최고 5점)
- **결론 일치 시:** 근거 부분 평가로 진행

**2. 법적 근거 명시 (30-40%)**
- 모범 답안의 법적 근거(공인회계사법 제○조, 윤리기준 ○○○ 등)를 **명시적으로 언급**했는가?
- **평가 기준:**
  - 조항 번호까지 정확: 만점
  - 조항 내용의 핵심만 언급: 80% 인정
  - 법적 근거 언급 없음: 해당 부분 0점
- **예시:**
  - ✅ "공인회계사법 제21조에 따라..." → 만점
  - ✅ "감사인의 독립성 위협 규정에 따라..." → 80% 인정
  - ❌ "독립성 문제가 있으므로..." → 근거 불충분, 낮은 점수

**3. 논리 전개 (10-20%)**
- 결론에 이르는 논리가 모범 답안의 **구조와 유사**한가?
- Scenario → 법적 근거 → 결론의 흐름이 명확한가?

**4. 키워드 매칭 (필수)**
- 모범 답안의 **핵심 법률 용어**(예: "자기검토 위협", "중요한 이해관계", "직접적 재무적 이해관계")가 포함되었는가?
- 키워드 누락 시 해당 부분 감점

**점수 배분 예시 (10점 문제):**
- 결론 정확 + 법조항 명시 + 논리 명확 + 키워드 포함 → 9-10점
- 결론 정확 + 법적 근거 언급 + 키워드 일부 누락 → 7-8점
- 결론 정확 + 법적 근거 불충분 → 5-6점
- 결론 틀림 + 법적 근거 일부 언급 → 3-5점
- 결론 틀림 + 근거 없음 → 0-2점
` : `
### Case 타입 채점 지침 (상황 분석 기반 평가)

**1. Scenario 이해 및 적용 (40-50%)**
- 사용자가 제시된 **Scenario의 핵심 상황**을 정확히 파악했는가?
- 모범 답안의 상황 판단 논리와 **맥락상 유사**한 분석을 했는가?
- **평가 기준:**
  - Scenario 핵심 요소 명시적 언급 → 만점
  - 암묵적 이해 (문맥상 파악) → 80% 인정
  - Scenario 무관한 일반론 전개 → 낮은 점수

**2. 논리 전개 및 실무 판단 (30-40%)**
- 사용자의 논리가 **실무적으로 타당**한가?
- 모범 답안과 **문맥상 의미가 일치**하면, 표현이 달라도 인정
- **예시:**
  - 모범 답안: "재고자산 감액 위험이 높아 실사 절차 강화 필요"
  - 사용자 답안: "재고 평가손실 가능성이 크므로 현장 확인 필수" → ✅ 인정 (의미 동일)
  - 사용자 답안: "재고가 많으므로 표본 추출 확대" → ⚠️ 부분 인정 (방향성은 맞으나 핵심 누락)

**3. 구체성 및 실무 적용 (10-20%)**
- **구체적인 절차/방법**을 제시했는가? (추상적 답변 감점)
- 이론만이 아니라 **실무 적용 가능성**이 보이는가?
- **예시:**
  - ✅ "재고 실사 시 ABC 품목별 표본 크기 조정" → 구체적
  - ❌ "재고 관련 절차 수행" → 추상적, 낮은 점수

**4. 키워드 유연성 (필수)**
- Case 타입은 **키워드 변형 허용** (문맥상 의미 일치 시 인정)
- 모범 답안의 **핵심 개념**이 다른 표현으로라도 언급되었는가?

**점수 배분 예시 (10점 문제):**
- Scenario 정확 분석 + 논리 명확 + 구체적 절차 제시 → 9-10점
- Scenario 이해 + 논리 타당 + 일부 추상적 → 7-8점
- Scenario 부분 이해 + 논리 약함 → 5-6점
- Scenario 오해 + 일반론만 서술 → 3-4점
- 문제 의도 완전 오해 → 0-2점
`)}

## 채점 결과 형식 (JSON)
다음 형식으로 응답하세요:
\`\`\`json
{
  "score": 획득 점수 (0~${question.score}),
  "feedback": "총평 (2-3문장, 사용자의 답변 수준을 정확히 평가)",
  "strengths": ["잘한 점 1 (구체적으로)", "잘한 점 2"],
  "improvements": ["개선할 점 1 (모범 답안 기준)", "개선할 점 2"],
  "keywordMatch": ["포함된 핵심 키워드/개념 1", "포함된 핵심 키워드/개념 2"],
  "missingKeywords": ["누락된 핵심 키워드/개념 1 (모범 답안에서)"]
}
\`\`\`
`;

    return basePrompt;
  }

  /**
   * Gemini API 호출 (채점)
   */
  async callGeminiForGrading(systemPrompt, userPrompt, apiKey, model) {
    const { callGeminiJsonAPI } = await import('../../services/geminiApi.js');

    // systemPrompt와 userPrompt를 합쳐서 하나의 prompt로 만들기
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // JSON 응답 스키마 정의
    const responseSchema = {
      type: 'OBJECT',
      properties: {
        score: { type: 'NUMBER' },
        feedback: { type: 'STRING' },
        strengths: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        },
        improvements: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        },
        keywordMatch: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        },
        missingKeywords: {
          type: 'ARRAY',
          items: { type: 'STRING' }
        }
      },
      required: ['score', 'feedback', 'strengths', 'improvements', 'keywordMatch', 'missingKeywords']
    };

    try {
      const result = await callGeminiJsonAPI(fullPrompt, responseSchema, apiKey, model);
      return result;
    } catch (error) {
      console.error('채점 API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 전체 시험 채점 (Case별 병렬 처리)
   * @param {number} year - 시험 연도
   * @param {object} userAnswers - 사용자 답안 객체
   * @param {string} apiKey - API 키
   * @param {string} model - 모델명
   * @param {function} onProgress - 진행률 콜백 (선택) ({ current, total, percentage, caseId })
   */
  async gradeExam(year, userAnswers, apiKey, model = 'gemini-2.5-flash', onProgress = null) {
    console.log('✅ 채점 시작');

    const exams = this.getExamByYear(year);
    const results = {};

    const totalCases = exams.length;
    let completedCases = 0;

    // 각 Case별로 병렬 처리
    for (const examCase of exams) {
      // Case 내 모든 문제를 병렬로 채점
      const questionPromises = examCase.questions.map(async (question) => {
        const userAnswer = userAnswers[question.id]?.answer;

        if (!userAnswer || userAnswer.trim() === '') {
          // 답안 없음
          return {
            questionId: question.id,
            result: {
              score: 0,
              feedback: '답안이 작성되지 않았습니다.',
              strengths: [],
              improvements: ['문제를 풀어주세요.'],
              keywordMatch: [],
              missingKeywords: []
            }
          };
        }

        try {
          const result = await this.gradeQuestion(examCase, question, userAnswer, apiKey, model);
          return {
            questionId: question.id,
            result
          };
        } catch (error) {
          console.error(`채점 실패: ${question.id}`, error);
          return {
            questionId: question.id,
            result: {
              score: 0,
              feedback: '채점 중 오류가 발생했습니다.',
              error: error.message
            }
          };
        }
      });

      // 현재 Case의 모든 문제 채점 완료 대기
      const caseResults = await Promise.all(questionPromises);

      // 결과 저장
      caseResults.forEach(({ questionId, result }) => {
        results[questionId] = result;
      });

      // 진행률 업데이트
      completedCases++;
      if (onProgress) {
        onProgress({
          current: completedCases,
          total: totalCases,
          percentage: Math.round((completedCases / totalCases) * 100),
          caseId: examCase.id
        });
      }

      console.log(`✅ Case ${examCase.id} 채점 완료 (${completedCases}/${totalCases})`);
    }

    // 총점 계산
    const totalScore = Object.values(results).reduce((sum, r) => sum + (r.score || 0), 0);

    return {
      totalScore,
      details: results,
      timestamp: Date.now()
    };
  }
}

// 싱글톤 인스턴스
export const examService = new ExamService();
