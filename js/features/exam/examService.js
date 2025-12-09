/**
 * Past Exam Service
 * 기출문제 데이터 로딩, 답안 저장, 채점 로직 관리
 */

import { EXAM_2025, EXAM_METADATA } from './examData.js';

class ExamService {
  constructor() {
    this.examData = {
      2025: EXAM_2025
    };
    this.metadata = EXAM_METADATA;
    this.initialized = false;
  }

  /**
   * 초기화
   */
  async initialize() {
    if (this.initialized) return;

    console.log('✅ Past Exam Service initialized');
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
    const isRule = examCase.type === 'Rule';

    const basePrompt = `
# 2025 공인회계사 2차 시험 채점 AI

## 문제 정보
- 주제: ${examCase.topic}
- 타입: ${examCase.type === 'Rule' ? '기준서(Rule)' : '사례(Case)'}
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

## 채점 전략 (${isRule ? 'Rule 타입' : 'Case 타입'})

${isRule ? `
### Rule 타입 채점 지침
1. **결론 정확성:** 사용자의 결론(수임 가능/불가능, 위협 발생 여부 등)이 모범 답안과 일치하는가?
   - 결론이 틀리면 50% 감점 후, 근거 부분만 부분 점수 부여
2. **핵심 키워드:** 모범 답안의 법적 근거(공인회계사법 조항, 윤리기준 번호 등)가 포함되었는가?
   - 조항 번호까지 정확할 필요는 없으나, 법적 근거의 핵심 내용이 언급되어야 함
3. **논리성:** 결론에 이르는 논리가 타당한가?
` : `
### Case 타입 채점 지침
1. **상황 이해:** 사용자가 제시된 Scenario의 핵심 상황을 근거로 들고 있는가?
2. **논리 전개:** 문맥상 의미가 통하면 키워드가 달라도 부분 점수 부여
3. **실무 적용:** 이론만이 아니라 실무적 판단이 포함되었는가?
`}

## 채점 결과 형식 (JSON)
다음 형식으로 응답하세요:
\`\`\`json
{
  "score": 획득 점수 (0~${question.score}),
  "feedback": "총평 (2-3문장)",
  "strengths": ["잘한 점 1", "잘한 점 2"],
  "improvements": ["개선할 점 1", "개선할 점 2"],
  "keywordMatch": ["포함된 핵심 키워드 1", "포함된 핵심 키워드 2"],
  "missingKeywords": ["누락된 핵심 키워드 1"]
}
\`\`\`
`;

    return basePrompt;
  }

  /**
   * Gemini API 호출 (채점)
   */
  async callGeminiForGrading(systemPrompt, userPrompt, apiKey, model) {
    const { generateTextWithGemini } = await import('../../core/geminiApi.js');

    try {
      const response = await generateTextWithGemini(
        apiKey,
        systemPrompt,
        userPrompt,
        model,
        { response_mime_type: 'application/json' }
      );

      // JSON 파싱
      const result = JSON.parse(response);
      return result;
    } catch (error) {
      console.error('채점 API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 전체 시험 채점 (병렬 처리)
   */
  async gradeExam(year, userAnswers, apiKey, model = 'gemini-2.5-flash') {
    const exams = this.getExamByYear(year);
    const results = {};

    // 각 Case별로 처리
    for (const examCase of exams) {
      for (const question of examCase.questions) {
        const userAnswer = userAnswers[question.id]?.answer;

        if (!userAnswer || userAnswer.trim() === '') {
          // 답안 없음
          results[question.id] = {
            score: 0,
            feedback: '답안이 작성되지 않았습니다.',
            strengths: [],
            improvements: ['문제를 풀어주세요.'],
            keywordMatch: [],
            missingKeywords: []
          };
          continue;
        }

        try {
          const result = await this.gradeQuestion(examCase, question, userAnswer, apiKey, model);
          results[question.id] = result;
        } catch (error) {
          console.error(`채점 실패: ${question.id}`, error);
          results[question.id] = {
            score: 0,
            feedback: '채점 중 오류가 발생했습니다.',
            error: error.message
          };
        }
      }
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
