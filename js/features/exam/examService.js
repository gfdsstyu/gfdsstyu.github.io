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
    this.currentMode = 'normal'; // 'normal' | 'retry'
    this.retryQuestionIds = []; // 오답 풀이 대상 문제 ID 목록
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
  async saveScore(year, score, details, type = 'normal') {
    const key = `exam_${year}_scores`;
    const existing = this.getScores(year);
    const attemptNumber = existing.length + 1;

    const scoreData = {
      score,
      details, // { questionId: { score, feedback } }
      timestamp: Date.now(),
      attempt: attemptNumber,
      type, // 'normal' | 'retry'
      retryQuestions: type === 'retry' ? this.retryQuestionIds.length : undefined
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
        const yearStr = String(year); // Firestore 경로는 문자열이어야 함
        const examScoreRef = doc(db, 'users', currentUser.uid, 'examScores', yearStr, 'attempts', attemptId);

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
    console.log('🔑 [examService.js] gradeQuestion - 받은 model:', model, '| typeof:', typeof model);

    // RAG 검색: 관련 기출문제 검색 (비동기, 실패해도 채점은 진행)
    let relatedQuestions = [];
    try {
      const ragSearchService = (await import('../../services/ragSearch.js')).default;
      await ragSearchService.initializeRAG();
      
      // 문제 내용과 모범 답안을 기반으로 검색 쿼리 생성
      const searchQuery = `${question.question || ''} ${question.model_answer || question.answer || ''}`.trim();
      if (searchQuery.length > 0) {
        relatedQuestions = ragSearchService.retrieveDocuments(searchQuery, 3);
        console.log('📚 [RAG] 관련 기출문제 검색 결과:', relatedQuestions.length, '개');
      }
    } catch (error) {
      console.warn('⚠️ [RAG] 검색 실패, RAG 없이 채점 진행:', error);
    }

    // Rule vs Case 타입별 프롬프트 전략 분기 (RAG 결과 포함)
    const systemPrompt = this.buildGradingPrompt(examCase, question, relatedQuestions);

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
   * 
   * @param {Object} examCase - 시험 케이스
   * @param {Object} question - 문제 객체
   * @param {Array} relatedQuestions - RAG로 검색된 관련 기출문제 배열 (옵셔널)
   */
  buildGradingPrompt(examCase, question, relatedQuestions = []) {
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
    
    // Explanation 처리: 문제별 채점 가이드 (참고용)
    const explanation = question.explanation || '';

    const basePrompt = `
# Role
KICPA 2차 회계감사 전문 채점관. 실전 채점 기조에 맞춰 채점하십시오.

# 문제 정보
- 주제: ${examCase.topic} | 유형: ${typeDisplay} | 배점: ${question.score}점

## 지문
${scenario}

## 문제
${question.question}

## 모범 답안
${question.model_answer}

⚠️ **모범 답안의 괄호 안 영문 키워드 및 부연 설명은 평가 대상이 아닙니다.** 
학생 답안에서 이러한 부연 설명을 쓰지 않아도 감점하지 마십시오.

${relatedQuestions && relatedQuestions.length > 0 ? `## 📚 참고 자료 (RAG)
${relatedQuestions.slice(0, 2).map((doc, index) => `[${index + 1}] ${doc.problemTitle || doc.question || ''} | ${(doc.answer || '').substring(0, 100)}`).join('\n')}
⚠️ 현재 문제 지시사항이 명확하면 참고 자료보다 우선시하십시오.

---` : ''}

${explanation ? `## 📌 채점 가이드
${explanation}
⚠️ 참고용. 기계적 매칭 금지.

---` : ''}

# 핵심 원칙
1. **예/아니오 문제 채점 절차 (필수 순서)**:
   a) **1단계: 정답 일치 확인**: 모범 답안의 정답("예" 또는 "아니오")을 먼저 확인하고, 학생 답안이 모범 답안의 정답과 일치하는지 확인
   b) **2단계: 불일치 시 오답 처리**: 학생 답안이 모범 답안의 정답과 일치하지 않으면 (예: 학생="예", 모범="아니오") 즉시 0점 처리. 이유 평가는 하지 않음
   c) **3단계: 일치 시 이유 평가**: 정답이 일치하는 경우에만 다음 규칙 적용
      - "예" 답변: 이유 없어도 만점 (적절하므로 이유 불필요)
      - "아니오" 답변: 반드시 이유 필수. 이유 없으면 ${(question.score * 0.3).toFixed(1)}점 이하
2. **키워드**: 의미 통하면 인정. 기계적 매칭 금지
3. **수험상 합의된 언어 인정**: "충적감증(충분하고 적합한 감사증거)", "성시범(성격 시기 범위)" 등 수험상 널리 합의된 약어/표현은 정식 용어와 동일하게 인정
4. **모범 답안**: 핵심 결론만 추출. 해설 TMI 요구 금지
5. **괄호 안 내용**: 모범 답안의 괄호 안 영문 키워드 및 부연 설명은 평가 대상이 아님. 학생 답안에 없어도 감점 금지

---

# 채점 기준

## ${isRule ? '기준서형 (Rule)' : isCase ? '사례/OX형 (Case)' : '일반'}
${isRule ? `- 키워드 중심. 의미 통하면 만점. 기준서 번호 불필요.
- 수험상 합의된 언어: "충적감증", "성시범" 등 약어도 정식 용어와 동일하게 인정
- 점수: 만점/${(question.score * 0.8).toFixed(1)}/${(question.score * 0.6).toFixed(1)}/${(question.score * 0.4).toFixed(1)}/0` : ''}
${isCase ? `- ⚠️ 예/아니오 문제 채점 절차:
  1) 모범 답안의 정답("예"/"아니오") 확인
  2) 학생 답안이 모범 답안 정답과 일치하지 않으면 즉시 0점
  3) 일치하는 경우에만:
     * "예" 답변: 이유 없어도 만점
     * "아니오" 답변: 이유 필수, 없으면 ${(question.score * 0.3).toFixed(1)}점 이하
- 근거 요구 문제만: 결론만 맞고 근거 없음 → ${(question.score * 0.3).toFixed(1)}점
- 점수: 만점/${(question.score * 0.8).toFixed(1)}/${(question.score * 0.6).toFixed(1)}/${(question.score * 0.3).toFixed(1)}/0` : ''}

---

# 출력 형식 (JSON)
\`\`\`json
{
  "score": 0~${question.score} (0.5단위),
  "question_type": "${typeDisplay}",
  "feedback": "총평 2-3문장",
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"],
  "keywordMatch": ["키워드1"],
  "missingKeywords": ["누락키워드1"]
}
\`\`\`

⚠️ ${isRule ? '의미 통하면 점수. ' : isCase ? '문제 지시사항 우선. ' : ''}모범 답안 해설 요구 금지.
`;

    return basePrompt;
  }

  /**
   * Gemini API 호출 (채점)
   * Gemma 3 모델 지원: JSON mode 미지원으로 text mode 사용
   */
  async callGeminiForGrading(systemPrompt, userPrompt, apiKey, model) {
    console.log('🔑 [examService.js] callGeminiForGrading - API 키:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ 없음');
    console.log('🔑 [examService.js] callGeminiForGrading - 모델:', model);

    // Gemma 모델 여부 확인
    const isGemma = model && model.startsWith('gemma-');
    console.log('🔍 [examService.js] isGemma 체크:', isGemma, '| model:', model, '| typeof:', typeof model);

    if (isGemma) {
      // Gemma 3 모델: Text mode + Delimiter 사용
      console.log('✅ [examService.js] Gemma 모델 감지 → callGemmaGrading 호출');
      try {
        return await this.callGemmaGrading(systemPrompt, userPrompt, apiKey, model);
      } catch (error) {
        // 429 에러(quota 초과) 발생 시 Gemini 모델로 자동 폴백
        if (error.message && error.message.includes('429')) {
          console.warn(`⚠️ [examService.js] Gemma 모델 quota 초과 감지`);
          console.warn(`   → gemini-2.5-flash로 자동 전환하여 채점을 계속합니다.`);
          console.warn(`   💡 Gemma 모델은 무료 tier 토큰 할당량이 15,000개로 제한됩니다.`);
          console.warn(`   💡 Gemini 모델 사용을 권장합니다 (설정 > AI 모델 선택).`);
          model = 'gemini-2.5-flash';
          // Gemini 모델로 재시도 (아래 블록으로 진행)
        } else {
          throw error;
        }
      }
    }

    if (!isGemma || model === 'gemini-2.5-flash') {
      // Gemini 모델: JSON mode 사용
      const { callGeminiJsonAPI } = await import('../../services/geminiApi.js');

      // systemPrompt와 userPrompt를 합쳐서 하나의 prompt로 만들기
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

      // JSON 응답 스키마 정의
      const responseSchema = {
        type: 'OBJECT',
        properties: {
          reasoning: {
            type: 'STRING',
            description: '채점 점수를 도출하게 된 논리적 근거 요약'
          },
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
        required: ['reasoning', 'score', 'question_type', 'feedback', 'strengths', 'improvements', 'keywordMatch', 'missingKeywords']
      };

      try {
        // 채점 일관성을 위해 temperature 0.3 설정
        const generationConfigOverride = {
          temperature: 0.3
        };
        const result = await callGeminiJsonAPI(fullPrompt, responseSchema, apiKey, model, 3, 1500, generationConfigOverride);
        return result;
      } catch (error) {
        console.error('채점 API 호출 실패:', error);
        throw error;
      }
    }
  }

  /**
   * 실제 기출문제 데이터를 활용한 Few-Shot 예시 생성
   */
  async generateFewShotExamples() {
    try {
      // 2025, 2024 기출문제 데이터 로드
      const data2025 = this.examData[2025] || [];
      const data2024 = this.examData[2024] || [];

      const examples = [];

      // 2025년 Rule 타입 예시 (Q1-1-1)
      const rule2025 = data2025.flatMap(c => c.questions).find(q => q.type === 'Rule' && q.score === 1.0);
      if (rule2025 && rule2025.keywords && rule2025.keywords.length > 0) {
        examples.push(`[기출문제 채점 예시 1 - 2025년]
문제 유형: ${rule2025.type} (기준서형)
배점: ${rule2025.score}점
지문: ${(rule2025.scenario || '').substring(0, 150)}
질문: ${(rule2025.question || '').substring(0, 200)}
모범답안: ${(rule2025.answer || rule2025.model_answer || '').substring(0, 300)}

핵심 키워드: ${rule2025.keywords.slice(0, 3).join(', ')}

예상 학생 답안 (부분 정답): "${rule2025.keywords[0] || ''}"

분석:
1. 모범답안 키워드: ${rule2025.keywords.join(', ')}
2. 학생 답안: 첫 번째 키워드만 포함
3. 누락: ${rule2025.keywords.slice(1).join(', ')}
4. 판단: 기준서형이므로 키워드 중심 채점. 부분 점수

결과: {"reasoning": "기준서형 문제로 키워드 ${rule2025.keywords.length}개 중 1개만 포함", "score": ${(rule2025.score / rule2025.keywords.length).toFixed(1)}, "question_type": "기준서형", "feedback": "${rule2025.keywords[0]}는 포함했으나, ${rule2025.keywords.slice(1, 2).join(', ')} 등이 누락되었습니다.", "strengths": ["${rule2025.keywords[0]} 언급"], "improvements": ["${rule2025.keywords.slice(1, 2).join(', ')} 추가 필요"], "keywordMatch": ["${rule2025.keywords[0]}"], "missingKeywords": ${JSON.stringify(rule2025.keywords.slice(1))}}`);
      }

      // 2024년 Case 타입 예시 (예/아니오 문제)
      const case2024 = data2024.flatMap(c => c.questions).find(q =>
        (q.answer || '').toLowerCase().startsWith('아니오') ||
        (q.answer || '').toLowerCase().startsWith('예')
      );
      if (case2024) {
        const correctAnswer = (case2024.answer || '').toLowerCase().startsWith('예') ? '예' : '아니오';
        const wrongAnswer = correctAnswer === '예' ? '아니오' : '예';
        const answerText = (case2024.answer || '').substring(0, 200);

        examples.push(`[기출문제 채점 예시 2 - 2024년]
문제 유형: Case (사례/OX형)
배점: ${case2024.score}점
질문: ${(case2024.question || '').substring(0, 200)}
모범답안: ${correctAnswer}, ${answerText}

예상 학생 답안 (오답): "${wrongAnswer}"

분석:
1. 정답 일치 확인: 학생="${wrongAnswer}", 모범="${correctAnswer}" → 불일치
2. 판단: 예/아니오가 다르므로 즉시 0점 처리 (이유 평가 불필요)

결과: {"reasoning": "정답 불일치 (학생=${wrongAnswer}, 모범=${correctAnswer})", "score": 0, "question_type": "사례/OX형", "feedback": "정답이 모범 답안과 다릅니다. 정답은 '${correctAnswer}'입니다.", "strengths": [], "improvements": ["정답 재검토 필요", "근거 학습 필요"], "keywordMatch": [], "missingKeywords": ["정답"]}`);
      }

      return examples.join('\n\n');
    } catch (error) {
      console.warn('⚠️ [Gemma] Few-Shot 예시 생성 실패, 기본 예시 사용:', error);
      // 폴백: 기본 예시 사용
      return `[기출문제 채점 예시]
실제 기출문제 데이터를 기반으로 Few-Shot 학습을 진행합니다.`;
    }
  }

  /**
   * Gemma 3 전용 채점 로직 (Text mode + Delimiter)
   */
  async callGemmaGrading(systemPrompt, userPrompt, apiKey, model) {
    console.log('🔑 [examService.js] callGemmaGrading - Gemma 3 모델 사용');

    const { extractJsonWithDelimiter, sanitizeModelText } = await import('../../utils/helpers.js');

    // 실제 기출문제 데이터 기반 Few-Shot 예시 생성
    const fewShotExamples = await this.generateFewShotExamples();

    // Gemma 전용 구조화된 프롬프트 (Few-Shot + CoT + Delimiter)
    const fullPrompt = `<Instruction>
${systemPrompt}

[제약사항]
1. 모범답안에 명시된 키워드를 반드시 확인하세요.
2. 법규의 미묘한 차이('하여야 한다' vs '할 수 있다')를 엄격히 구분하세요.
3. 기출문제는 배점이 명확하므로 배점에 맞춰 채점하세요.
4. 예/아니오 문제는 정답 일치 여부를 먼저 확인하세요.
</Instruction>

${fewShotExamples}

<Context>
${userPrompt}
</Context>

<Task>
위 예시를 참고하여, 다음 단계로 채점하세요:
1. 모범답안의 핵심 키워드 추출
2. 사용자 답안과 비교
3. 점수와 피드백 결정 (배점 기준)

반드시 다음 형식으로만 답변하세요 (다른 설명 금지):

###JSON###
{
  "reasoning": "채점 점수를 도출하게 된 논리적 근거 요약 (1-2문장)",
  "score": 점수 (숫자),
  "question_type": "문제 유형",
  "feedback": "총평 2-3문장",
  "strengths": ["강점1", "강점2"],
  "improvements": ["개선점1", "개선점2"],
  "keywordMatch": ["키워드1"],
  "missingKeywords": ["누락키워드1"]
}
###END###
</Task>`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const generationConfig = {
      temperature: 0.2,  // 채점 일관성을 위해 낮은 temperature
      maxOutputTokens: 2048,
      topP: 0.95,
      topK: 40
    };

    const payload = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig
    };

    // 재시도 로직 (최대 3회, 503/429 에러 대응)
    let retries = 3;
    let delay = 800;

    while (retries > 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = body?.error?.message || res.statusText;

          // 429 에러(quota 초과)는 재시도하지 않고 즉시 폴백
          if (res.status === 429) {
            console.error(`❌ [Gemma] Quota 초과 (429): ${msg}`);
            throw new Error(`429: ${msg}`);
          }

          // 재시도 가능한 에러: 503(서버 과부하), 5xx 에러
          if (res.status >= 500 && retries > 1) {
            const retryDelay = delay * 2.5;
            console.warn(`⚠️ [Gemma] ${res.status} 에러 - ${(retryDelay / 1000).toFixed(1)}초 후 재시도 (남은 횟수: ${retries - 1})`);
            await new Promise(r => setTimeout(r, retryDelay));
            retries--;
            delay *= 1.8;
            continue;
          }

          throw new Error(`Gemma API 오류 (${res.status}): ${msg}`);
        }

        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        console.log('🔍 [Gemma] 원본 응답:', raw.substring(0, 200));

        // Delimiter 우선 파싱
        let parsed;
        const delimiterJson = extractJsonWithDelimiter(raw);
        if (delimiterJson) {
          parsed = JSON.parse(delimiterJson);
        } else {
          // Delimiter 실패 시 sanitize 방식 폴백
          const cleaned = sanitizeModelText(raw);
          parsed = JSON.parse(cleaned);
        }

        // 필수 필드 검증 및 기본값 설정
        return {
          reasoning: parsed.reasoning || '채점 완료',
          score: typeof parsed.score === 'number' ? parsed.score : 0,
          question_type: parsed.question_type || '일반',
          feedback: parsed.feedback || '피드백 없음',
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
          keywordMatch: Array.isArray(parsed.keywordMatch) ? parsed.keywordMatch : [],
          missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : []
        };
      } catch (error) {
        // 타임아웃 에러
        if (error.name === 'AbortError') {
          throw new Error('API 요청 타임아웃 (60초 초과)');
        }

        // 재시도 가능한 에러가 아니거나 재시도 횟수 소진
        if (retries <= 1) {
          console.error('❌ [Gemma] 채점 최종 실패:', error);
          throw error;
        }

        // 503/429 에러면 재시도
        const is503 = String(error.message).includes('503');
        const is429 = String(error.message).includes('429');
        if (is503 || is429) {
          const retryDelay = is503 ? delay * 2.5 : delay;
          console.warn(`⚠️ [Gemma] 에러 - ${(retryDelay / 1000).toFixed(1)}초 후 재시도 (남은 횟수: ${retries - 1})`);
          await new Promise(r => setTimeout(r, retryDelay));
          retries--;
          delay *= 1.8;
          continue;
        }

        // 그 외 에러는 즉시 throw
        console.error('❌ [Gemma] 채점 실패:', error);
        throw error;
      }
    }

    throw new Error('Gemma API 재시도 횟수 초과');
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
          
          // 점수 검증 및 보정
          if (result && typeof result.score === 'number') {
            // 소숫점 둘째자리까지 반올림
            result.score = Math.round(result.score * 100) / 100;
            // 점수가 배점을 초과하거나 음수인 경우 보정
            const maxScore = question.score || 0;
            result.score = Math.max(0, Math.min(result.score, maxScore));
            // 최종적으로 소숫점 둘째자리까지 반올림 (보정 후에도)
            result.score = Math.round(result.score * 100) / 100;
          } else {
            // 점수가 없거나 유효하지 않은 경우 0점 처리
            result.score = 0;
            console.warn(`⚠️ 문제 ${question.id}의 점수가 유효하지 않음:`, result.score);
          }
          
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

  // ============================================
  // 단원별 문제풀이 기능 (Chapter-based Practice)
  // ============================================

  /**
   * 모든 연도에서 특정 단원의 문제 추출 (연도순 정렬)
   * @param {string|number} chapter - 단원 번호 (예: "2.0", 3, "10.5")
   * @returns {Array} 해당 단원의 문제 배열 [{year, caseId, topic, chapter, subQuestions, questions}, ...]
   */
  getQuestionsByChapter(chapter) {
    const questions = [];
    const sortedYears = Object.keys(this.examData).sort((a, b) => parseInt(a) - parseInt(b)); // 연도순

    for (const year of sortedYears) {
      const yearData = this.examData[year];
      if (!yearData || !Array.isArray(yearData)) continue;

      yearData.forEach(exam => {
        // exam.chapter가 있는지 확인 (새 구조)
        if (exam.chapter && parseFloat(exam.chapter) === parseFloat(chapter)) {
          questions.push({
            year: parseInt(year),
            caseId: exam.id,
            topic: exam.topic || '',
            chapter: exam.chapter,
            questions: exam.questions || []
          });
        }
      });
    }
    return questions;
  }

  /**
   * 사용 가능한 단원 목록 조회
   * @returns {Map} chapter -> {chapter, name, questionCount, years: Set, cases: []}
   */
  getAvailableChapters() {
    const { CHAPTER_LABELS } = this.getChapterLabels();
    const chapters = new Map();

    const years = Object.keys(this.examData).sort((a, b) => parseInt(a) - parseInt(b));

    for (const year of years) {
      const yearData = this.examData[year];
      if (!yearData || !Array.isArray(yearData)) continue;

      yearData.forEach(exam => {
        if (!exam.chapter) return; // chapter가 없으면 스킵

        const chapterKey = parseFloat(exam.chapter);
        if (isNaN(chapterKey)) return;

        if (!chapters.has(chapterKey)) {
          chapters.set(chapterKey, {
            chapter: exam.chapter,
            chapterNum: chapterKey,
            name: CHAPTER_LABELS[Math.floor(chapterKey)] || `단원 ${Math.floor(chapterKey)}`,
            questionCount: 0,
            totalScore: 0,
            years: new Set(),
            cases: []
          });
        }

        const chapterData = chapters.get(chapterKey);
        chapterData.years.add(parseInt(year));
        chapterData.cases.push({
          year: parseInt(year),
          caseId: exam.id,
          topic: exam.topic,
          questionCount: exam.questions?.length || 0,
          totalScore: exam.questions?.reduce((sum, q) => sum + (q.score || 0), 0) || 0
        });
        chapterData.questionCount += exam.questions?.length || 0;
        chapterData.totalScore += exam.questions?.reduce((sum, q) => sum + (q.score || 0), 0) || 0;
      });
    }

    return chapters;
  }

  /**
   * CHAPTER_LABELS 가져오기 (동적 import 대신 직접 정의)
   */
  getChapterLabels() {
    const CHAPTER_LABELS = {
      1: "제1장 감사와 회계감사의 기본개념",
      2: "제2장 감사인의 의무, 책임 및 자격요건",
      3: "제3장 감사인의 독립성과 품질관리",
      4: "제1장 감사인의 선임",
      5: "제2장 감사계약",
      6: "제1장 회계감사수행을 위한 기초지식",
      7: "제2장 위험평가절차와 계획수립",
      8: "제1장 통제테스트와 위험평가의 확정",
      9: "제1-2장 정보시스템환경 및 외부서비스조직 이용 회사에 대한 TOC",
      10: "제2장 실증절차의 기초",
      11: "제3장 기초잔액과 거래유형별 실증절차",
      12: "제4장 특정항목별 감사절차",
      13: "제5장 테스트항목의 범위와 표본감사",
      14: "제6장 실증절차의 마무리절차",
      15: "제1장 미수정왜곡표시의 평가와 감사의견의 형성",
      16: "제2장 감사보고서의 작성과 보고",
      17: "제1장 인증업무개념체계와 특정목적재무보고체계, 제2장 그룹재무제표에 대한 감사",
      18: "제3장 내부회계관리제도에 대한 감사와 검토",
      19: "제4장 중간재무제표에 대한 검토",
      20: "제5장 소규모기업 재무제표에 대한 감사"
    };
    return { CHAPTER_LABELS };
  }

  // ============================================
  // 단원별 점수 저장/불러오기
  // ============================================

  /**
   * 단원별 점수 저장
   */
  async saveChapterScore(chapter, score, details, type = 'normal') {
    const key = `exam_chapter_${chapter}_scores`;
    const existing = this.getChapterScores(chapter);
    const attemptNumber = existing.length + 1;

    const scoreData = {
      score,
      details,
      timestamp: Date.now(),
      attempt: attemptNumber,
      type
    };

    existing.push(scoreData);

    try {
      localStorage.setItem(key, JSON.stringify(existing));
      console.log(`📊 단원 ${chapter} 점수 저장: ${score}점 (${attemptNumber}차 응시)`);
    } catch (error) {
      console.error('단원별 점수 저장 실패:', error);
    }
  }

  /**
   * 단원별 점수 불러오기
   */
  getChapterScores(chapter) {
    const key = `exam_chapter_${chapter}_scores`;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('단원별 점수 불러오기 실패:', error);
      return [];
    }
  }

  /**
   * 단원별 최고 점수 가져오기
   */
  getBestChapterScore(chapter) {
    const scores = this.getChapterScores(chapter);
    if (scores.length === 0) return null;
    return Math.max(...scores.map(s => s.score));
  }

  /**
   * 단원별 답안 저장
   */
  saveChapterAnswer(chapter, questionId, answer) {
    const key = `exam_chapter_${chapter}_answers`;
    const existing = this.getChapterAnswers(chapter);

    existing[questionId] = {
      answer,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem(key, JSON.stringify(existing));
      console.log(`💾 단원 ${chapter} 답안 저장: ${questionId}`);
    } catch (error) {
      console.error('단원별 답안 저장 실패:', error);
    }
  }

  /**
   * 단원별 답안 불러오기
   */
  getChapterAnswers(chapter) {
    const key = `exam_chapter_${chapter}_answers`;
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('단원별 답안 불러오기 실패:', error);
      return {};
    }
  }

  /**
   * 단원별 답안 초기화
   */
  clearChapterAnswers(chapter) {
    const key = `exam_chapter_${chapter}_answers`;
    localStorage.removeItem(key);
    console.log(`🗑️ 단원 ${chapter} 답안 초기화 완료`);
  }

  /**
   * 단원별 타이머 시작 시간 저장
   */
  saveChapterTimerStart(chapter) {
    const key = `exam_chapter_${chapter}_timer_start`;
    localStorage.setItem(key, Date.now().toString());
  }

  /**
   * 단원별 타이머 시작 시간 가져오기
   */
  getChapterTimerStart(chapter) {
    const key = `exam_chapter_${chapter}_timer_start`;
    const start = localStorage.getItem(key);
    return start ? parseInt(start, 10) : null;
  }

  /**
   * 단원별 남은 시간 계산
   */
  getChapterRemainingTime(chapter, timeLimit) {
    const start = this.getChapterTimerStart(chapter);
    if (!start) return null;

    const now = Date.now();
    const elapsed = (now - start) / 1000 / 60; // 분 단위
    const remaining = timeLimit - elapsed;

    return Math.max(0, remaining);
  }

  /**
   * 단원별 타이머 초기화
   */
  clearChapterTimer(chapter) {
    const key = `exam_chapter_${chapter}_timer_start`;
    localStorage.removeItem(key);
  }

  /**
   * 단원별 제한시간 계산 (문제 수 기반: 문제당 약 5분)
   */
  calculateChapterTimeLimit(questionCount) {
    // 최소 15분, 최대 90분
    const timeLimit = Math.max(15, Math.min(90, Math.ceil(questionCount * 5)));
    return timeLimit;
  }

  /**
   * 사용자 설정 타이머 저장
   */
  saveChapterTimeLimit(chapter, timeLimit) {
    const key = `exam_chapter_${chapter}_time_limit`;
    localStorage.setItem(key, timeLimit.toString());
    console.log(`⏱️ 단원 ${chapter} 타이머 설정 저장: ${timeLimit}분`);
  }

  /**
   * 사용자 설정 타이머 불러오기
   */
  getChapterTimeLimit(chapter) {
    const key = `exam_chapter_${chapter}_time_limit`;
    const value = localStorage.getItem(key);
    return value ? parseInt(value, 10) : null;
  }

  // ============================================
  // 단원별 채점
  // ============================================

  /**
   * 단원별 시험 채점
   */
  async gradeChapterExam(chapter, userAnswers, apiKey, model = 'gemini-2.5-flash', onProgress = null) {
    console.log(`✅ 단원 ${chapter} 채점 시작`);

    const chapterData = this.getQuestionsByChapter(chapter);
    const results = {};

    // 모든 문제를 단일 배열로 변환
    const allQuestions = [];
    chapterData.forEach(caseItem => {
      caseItem.questions.forEach(q => {
        allQuestions.push({
          ...q,
          year: caseItem.year,
          caseId: caseItem.caseId,
          topic: caseItem.topic
        });
      });
    });

    const totalQuestions = allQuestions.length;
    let completedQuestions = 0;

    // 동시 3개씩 처리
    const questionTasks = allQuestions.map((question) => async () => {
      const userAnswer = userAnswers[question.id]?.answer;

      if (!userAnswer || userAnswer.trim() === '') {
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
        // gradeQuestion을 위한 가상의 examCase 객체 생성
        const examCase = {
          id: question.caseId,
          topic: question.topic,
          scenario: question.scenario
        };

        const result = await this.gradeQuestion(examCase, question, userAnswer, apiKey, model);

        // 점수 검증
        if (result && typeof result.score === 'number') {
          result.score = Math.round(result.score * 100) / 100;
          const maxScore = question.score || 0;
          result.score = Math.max(0, Math.min(result.score, maxScore));
          result.score = Math.round(result.score * 100) / 100;
        } else {
          result.score = 0;
        }

        return { questionId: question.id, result };
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

    // 동시 3개씩 처리
    const gradedResults = await this.limitConcurrency(questionTasks, 3);

    // 결과 저장 및 진행률 업데이트
    gradedResults.forEach(({ questionId, result }) => {
      results[questionId] = result;
      completedQuestions++;

      if (onProgress) {
        onProgress({
          current: completedQuestions,
          total: totalQuestions,
          percentage: Math.round((completedQuestions / totalQuestions) * 100),
          questionId
        });
      }
    });

    // 총점 계산
    const totalScore = Object.values(results).reduce((sum, r) => sum + (r.score || 0), 0);

    console.log(`✅ 단원 ${chapter} 채점 완료: ${totalScore}점`);

    return {
      totalScore,
      details: results,
      timestamp: Date.now()
    };
  }
}

// 싱글톤 인스턴스
export const examService = new ExamService();
