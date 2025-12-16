/**
 * Past Exam Service
 * 기출문제 데이터 로딩, 답안 저장, 채점 로직 관리
 */

import { getExamByYear, getExamMetadata } from './examData.js';

class ExamService {
  constructor() {
    this.examData = {};
    this.metadata = {};
    this.initialized = false;
  }

  /**
   * 초기화
   * 2014-2025년 범위의 모든 연도 데이터를 로드
   */
  async initialize() {
    if (this.initialized) return;

    // 메타데이터 먼저 로드하여 사용 가능한 연도 확인
    const metadata = await getExamMetadata();
    const availableYears = Object.keys(metadata).map(y => parseInt(y)).sort((a, b) => b - a);

    // 사용 가능한 모든 연도 데이터 로드
    this.examData = {};
    const loadPromises = availableYears.map(async (year) => {
      const examData = await getExamByYear(year);
      this.examData[year] = examData;
      return { year, count: examData.length };
    });

    const results = await Promise.all(loadPromises);
    this.metadata = metadata;

    console.log('✅ Past Exam Service initialized');
    console.log(`   - 사용 가능한 연도: ${availableYears.join(', ')}`);
    results.forEach(({ year, count }) => {
      if (count > 0) {
        console.log(`   - ${year}년: ${count}개 사례, ${this.getTotalQuestions(year)}개 문제, 만점 ${this.getTotalScore(year)}점`);
      }
    });

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
   * 일시정지 시간을 고려하여 계산
   */
  getRemainingTime(year) {
    const start = this.getTimerStart(year);
    if (!start) return null;

    const metadata = this.getMetadata(year);
    const now = Date.now();
    
    // 일시정지 시간 계산 (누적된 일시정지 기간)
    const pauseData = this.getTimerPause(year);
    let totalPauseTime = 0; // 분 단위
    
    if (pauseData && Array.isArray(pauseData)) {
      // 일시정지 데이터는 [시작시간, 종료시간, 시작시간, 종료시간, ...] 형식
      for (let i = 0; i < pauseData.length; i += 2) {
        const pauseStart = pauseData[i];
        const pauseEnd = pauseData[i + 1] || now; // 종료 시간이 없으면 현재 시간
        totalPauseTime += (pauseEnd - pauseStart) / 1000 / 60; // 분 단위
      }
    }
    
    // 실제 경과 시간 = 현재 시간 - 시작 시간 - 일시정지 시간
    const elapsed = ((now - start) / 1000 / 60) - totalPauseTime; // 분 단위
    const remaining = metadata.timeLimit - elapsed;

    return Math.max(0, remaining);
  }

  /**
   * 타이머 초기화
   */
  clearTimer(year) {
    const key = `exam_${year}_timer_start`;
    localStorage.removeItem(key);
    this.clearTimerPause(year);
  }

  /**
   * 타이머 일시정지 시간 저장
   */
  saveTimerPause(year, pauseTime) {
    const key = `exam_${year}_timer_pause`;
    const existing = this.getTimerPause(year) || [];
    existing.push(pauseTime);
    localStorage.setItem(key, JSON.stringify(existing));
  }

  /**
   * 타이머 일시정지 시간 가져오기
   */
  getTimerPause(year) {
    const key = `exam_${year}_timer_pause`;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('일시정지 시간 불러오기 실패:', error);
      return null;
    }
  }

  /**
   * 타이머 일시정지 시간 제거
   */
  clearTimerPause(year) {
    const key = `exam_${year}_timer_pause`;
    localStorage.removeItem(key);
  }

  // ============================================
  // 점수 저장/불러오기 (히스토리)
  // ============================================

  /**
   * 점수 저장 (localStorage + Firestore)
   */
  async saveScore(year, score, details) {
    const key = `exam_${year}_scores`;
    const existing = this.getScores(year);
    const attemptNumber = existing.length + 1;

    const scoreData = {
      score,
      details, // { questionId: { score, feedback } }
      timestamp: Date.now(),
      attempt: attemptNumber
    };

    existing.push(scoreData);

    // localStorage 저장 (기존 로직 유지)
    try {
      localStorage.setItem(key, JSON.stringify(existing));
      console.log(`📊 점수 저장: ${year}년 - ${score}점 (${attemptNumber}차 응시)`);
    } catch (error) {
      console.error('점수 저장 실패:', error);
    }

    // Firestore 저장 (인증된 사용자만)
    try {
      const { getCurrentUser } = await import('../auth/authCore.js');
      const { db } = await import('../../app.js');
      const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js');
      
      const currentUser = getCurrentUser();
      if (currentUser) {
        const attemptId = `attempt_${attemptNumber}_${Date.now()}`;
        const examScoreRef = doc(db, 'users', currentUser.uid, 'examScores', year, 'attempts', attemptId);

        await setDoc(examScoreRef, {
          totalScore: score,
          details: details,
          timestamp: scoreData.timestamp,
          attempt: attemptNumber,
          year: year,
          updatedAt: serverTimestamp()
        }, { merge: true });

        console.log(`✅ [Exam] Firestore 저장 완료: ${year}년 ${attemptNumber}차 응시`);
      } else {
        console.log('⚠️ [Exam] 로그인되지 않음 - Firestore 저장 스킵');
      }
    } catch (error) {
      // Firestore 저장 실패해도 localStorage 저장은 성공했으므로 조용히 처리
      console.error('❌ [Exam] Firestore 저장 실패:', error);
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
   * 특정 연도의 점수 히스토리 초기화
   */
  clearScores(year) {
    const key = `exam_${year}_scores`;
    localStorage.removeItem(key);
    console.log(`🗑️ ${year}년 점수 히스토리 초기화 완료`);
  }

  /**
   * 모든 연도의 점수 히스토리 초기화
   */
  clearAllScores() {
    const keys = Object.keys(localStorage);
    const examScoreKeys = keys.filter(key => key.startsWith('exam_') && key.endsWith('_scores'));
    examScoreKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    console.log(`🗑️ 모든 연도 점수 히스토리 초기화 완료 (${examScoreKeys.length}개)`);
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
    console.log('🔑 [examService.js] tempGradeExam - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');
    console.log('🔑 [examService.js] tempGradeExam - 모델:', model);

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
    console.log('🔑 [examService.js] gradeQuestion - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');

    // Rule vs Case 타입별 프롬프트 전략 분기
    const systemPrompt = this.buildGradingPrompt(examCase, question);

    const userPrompt = `[사용자 답안]\n${userAnswer}\n\n위 답안을 모범 답안과 비교하여 채점해주세요.`;

    // Gemini API 호출 (기존 geminiApi.js 사용)
    return await this.callGeminiForGrading(systemPrompt, userPrompt, apiKey, model);
  }

  /**
   * 채점 프롬프트 생성 (KICPA 실전 채점 경향 반영)
   *
   * 실전 채점 트렌드:
   * - 기준서 문제: 후하게 채점 (키워드 중심, 의미 통하면 만점)
   * - 사례/OX 문제: 엄격하게 채점 (논리적 근거 필수)
   */
  buildGradingPrompt(examCase, question) {
    // Type 결정: question 레벨 우선, 없으면 examCase 레벨
    const questionType = question.type || examCase.type;
    const hasType = questionType && questionType.trim() !== '';
    const isRule = hasType && questionType === 'Rule';
    const isCase = hasType && questionType === 'Case';

    // Type 표시
    const typeDisplay = hasType
      ? (questionType === 'Rule' ? '기준서형' : '사례/OX형')
      : '일반';

    // Scenario 결정: question 레벨 우선 (새 구조), 없으면 examCase 레벨 (호환성)
    const scenario = question.scenario || examCase.scenario || '지문 없음';

    // Keywords 처리: question.keywords 배열 사용 (새 구조)
    const keywords = question.keywords && question.keywords.length > 0
      ? question.keywords
      : [];

    const basePrompt = `
# Role
당신은 대한민국 공인회계사(KICPA) 2차 시험 '회계감사' 과목의 전문 채점관입니다.
제공된 [문제 정보]와 [학생 답안]을 비교하여, 실제 수험생들의 합격/불합격을 가르는 **실전 채점 기조(Trend)**에 맞춰 채점하십시오.

# 문제 정보
- 주제: ${examCase.topic}
- 문제 유형: ${typeDisplay}
- 배점: ${question.score}점

## 지문 (Scenario)
${scenario}

## 문제
${question.question}

## 모범 답안
${question.model_answer}

## 핵심 키워드
${keywords.length > 0 ? keywords.map(k => `• ${k}`).join('\n') : '(키워드 정보 없음)'}

---

# 🚨 데이터 처리 지침
제공되는 [모범 답안]에는 **'정답(결론)'**과 **'해설(부연 설명)'**이 섞여 있을 수 있습니다.
- 채점 시 [모범 답안]에서 **핵심 결론**과 **필수 키워드**만 추출하여 채점 기준으로 삼으십시오.
- 해설에만 있는 TMI(배경지식, 상세 계산 과정)를 학생이 적지 않았다고 해서 감점하지 마십시오.
- **절대적 원칙**: 모범 답안에 없는 내용을 당신의 일반 지식으로 요구하지 마십시오.

---

# 📝 채점 원칙 (KICPA 실전 채점 트렌드)

문제 유형에 따라 **이원화된 채점 기준**을 적용하십시오:

## 1️⃣ 기준서형 문제 (Rule): "후하게 채점 (Generous Grading)"
**이 유형은 기준서 원문을 암기해 쓰는 문제입니다. 실제 시험에서는 의미가 통하면 점수를 줍니다.**

### 채점 기준:
- **키워드 중심 (60%)**: 문장의 조사가 틀리거나 어순이 바뀌어도, 핵심 **키워드**가 포함되어 있고 문맥이 기준서의 의도와 일치하면 **만점** 부여
  - ✅ "고려한다" vs "반영한다" 같은 동사의 미세한 차이는 감점 사유 아님
  - ✅ 문장이 완벽하지 않아도 의미가 통하면 정답 처리
  - ✅ 개조식(bullet points)으로 핵심만 요약해도 정답 인정

- **유연성 (40%)**: 표현의 다양성 인정
  - 모범 답안과 단어가 달라도 **의미가 같으면** 만점
  - **법조항/기준서 번호는 불필요**: "700-12", "윤리기준 600.12", "공인회계사법 33조" 같은 조문 번호를 정확히 외우지 못해도 **조문의 취지**를 설명하면 만점 인정
  - 기준서 번호를 쓰지 않았다고 감점하지 말 것!

### 점수 배분 (배점 ${question.score}점):
- 핵심 키워드 포함 + 의미 일치 → ${question.score}점 (만점)
- 키워드 일부 + 문맥상 이해 → ${(question.score * 0.7).toFixed(1)}점
- 키워드 부족 but 방향성 맞음 → ${(question.score * 0.5).toFixed(1)}점
- 관련 없는 내용 서술 → 0점

## 2️⃣ 사례/OX형 문제 (Case): "엄격하게 채점 (Strict Grading)"
**이 유형은 상황 판단 능력과 논리를 평가합니다. 키워드 나열만으로는 부족합니다.**

### 채점 기준:
- **논리적 근거 필수 (70%)**:
  - OX 문제에서 결론(O/X, 예/아니오)만 맞고 **근거가 틀리거나 없으면** → 배점의 30%부여
  - 근거가 핵심입니다!

- **정확한 적용 (30%)**:
  - 단순 기준서 나열 아닌, **주어진 상황/사례**에 맞게 기준서를 적용해야 함
  - 기출 변형 문제의 경우, 미세한 발문 차이(예: 표본 개수 vs 테스트 항목 개수)를 구분하지 못하면 → 0점

### 점수 배분 (배점 ${question.score}점):
- 결론 정확 + 논리적 근거 명확 + 상황 적용 정확 → ${question.score}점 (만점)
- 결론 정확 + 근거 약함/미약 → ${(question.score * 0.5).toFixed(1)}점 이상 (50%는 하한선, 근거의 타당도에 따라 50%~90% 사이 부여)
- 결론 정확 but 근거 없음/틀림 → ${(question.score * 0.3).toFixed(1)}점
- 결론 틀림 but 근거 타당/논리적 → ${(question.score * 0.15).toFixed(1)}점 (부분점수)
- 결론 틀림 + 근거 없음/틀림 → 0점

## 🚫 공통 감점 사유:
- **관련 없는 서술**: 문제에서 묻는 것과 전혀 다른 기준서/내용을 서술 → **0점**
- **일반론만 나열**: 구체적인 상황 분석 없이 교과서적 내용만 나열 → 배점의 30% 미만
  - ✅ "재고 실사 시 ABC 품목별 표본 크기 조정" → 구체적
  - ❌ "재고 관련 절차 수행" → 추상적, 낮은 점수

---

# 📤 출력 형식 (JSON Only)
반드시 아래 JSON 형식으로만 응답하십시오:

\`\`\`json
{
  "score": 획득 점수 (0~${question.score}, 0.5점 단위 가능),
  "question_type": "${typeDisplay}",
  "feedback": "총평 (2-3문장, 학생 답변의 강점과 약점을 명확히 평가)",
  "strengths": ["잘한 점 1 (구체적으로)", "잘한 점 2"],
  "improvements": ["개선할 점 1 (모범 답안 기준)", "개선할 점 2"],
  "keywordMatch": ["학생이 작성한 핵심 키워드 1", "학생이 작성한 핵심 키워드 2"],
  "missingKeywords": ["모범 답안에 있으나 학생이 누락한 키워드 1", "누락한 키워드 2"]
}
\`\`\`

## ⚠️ 중요: 채점관의 책무
- **기준서형(Rule)**: 너무 칼같이 채점하지 말 것. 의미가 통하면 점수를 주는 것이 실전 채점의 정석입니다.
- **사례/OX형(Case)**: 키워드만 나열하면 높은 점수를 주지 말 것. 논리적 근거가 핵심입니다.
- **데이터 처리**: 모범 답안의 해설 부분을 학생에게 요구하지 말 것. 핵심 결론만 추출하여 채점하십시오.
`;

    return basePrompt;
  }

  /**
   * Gemini API 호출 (채점)
   */
  async callGeminiForGrading(systemPrompt, userPrompt, apiKey, model) {
    console.log('🔑 [examService.js] callGeminiForGrading - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');
    console.log('🔑 [examService.js] callGeminiForGrading - 모델:', model);

    const { callGeminiJsonAPI } = await import('../../services/geminiApi.js');

    // systemPrompt와 userPrompt를 합쳐서 하나의 prompt로 만들기
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // JSON 응답 스키마 정의
    const responseSchema = {
      type: 'OBJECT',
      properties: {
        score: { type: 'NUMBER' },
        question_type: { type: 'STRING' },
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
      required: ['score', 'question_type', 'feedback', 'strengths', 'improvements', 'keywordMatch', 'missingKeywords']
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
   * 제한된 동시성으로 Promise 실행 (503 에러 방지)
   * @param {Array} tasks - 실행할 작업 배열
   * @param {number} limit - 동시 실행 제한 (기본값: 3)
   */
  async limitConcurrency(tasks, limit = 3) {
    const results = [];
    const executing = [];

    for (const task of tasks) {
      const promise = task().then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      results.push(promise);
      executing.push(promise);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }

  /**
   * 전체 시험 채점 (동시 요청 수 제한으로 503 에러 방지)
   * @param {number} year - 시험 연도
   * @param {object} userAnswers - 사용자 답안 객체
   * @param {string} apiKey - API 키
   * @param {string} model - 모델명
   * @param {function} onProgress - 진행률 콜백 (선택) ({ current, total, percentage, caseId })
   */
  async gradeExam(year, userAnswers, apiKey, model = 'gemini-2.5-flash', onProgress = null) {
    console.log('✅ 채점 시작');
    console.log('🔑 [examService.js] gradeExam - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');
    console.log('🔑 [examService.js] gradeExam - 모델:', model);

    const exams = this.getExamByYear(year);
    const results = {};

    const totalCases = exams.length;
    let completedCases = 0;

    // 각 Case별로 순차 처리
    for (const examCase of exams) {
      // Case 내 문제를 동시 3개씩만 처리 (503 에러 방지)
      const questionTasks = examCase.questions.map((question) => async () => {
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

      // 동시 3개씩만 처리 (무료 API 한도 고려)
      const caseResults = await this.limitConcurrency(questionTasks, 3);

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
