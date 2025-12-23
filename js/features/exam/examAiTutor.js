/**
 * AI Tutor Service - 채점 결과에 대한 AI 질의응답 기능
 *
 * 기능:
 * - 특정 문제에 대해 AI와 대화하며 궁금증 해소
 * - 자동 컨텍스트 주입 (지문, 물음, 모범답안, 채점기준, 사용자답안)
 * - 단계적 설명 (Step-by-Step Reasoning)
 * - Gemini Chat SDK 사용으로 효율적인 대화 관리
 */

import { GeminiChatSession } from '../../services/geminiChatApi.js';

/**
 * AI 튜터 대화 세션 클래스
 */
class AiTutorSession {
  constructor(questionId, questionData, userAnswer, feedback, examCase) {
    this.questionId = questionId;
    this.questionData = questionData; // { question, model_answer, score, scenario, type, keywords, explanation }
    this.userAnswer = userAnswer;
    this.feedback = feedback; // { score, feedback, strengths, improvements, keywordMatch, missingKeywords }
    this.examCase = examCase; // { topic, scenario, type }
    this.chatSession = null; // Gemini Chat SDK 세션
    this.conversationHistory = []; // { role: 'user' | 'assistant', content: string }
  }

  /**
   * 컨텍스트 프롬프트 생성
   * 문제 정보를 AI에게 전달하기 위한 시스템 프롬프트
   */
  buildContextPrompt() {
    const scenario = this.questionData.scenario || this.examCase.scenario || '';
    const questionType = this.questionData.type || this.examCase.type || '일반';
    const typeDisplay = questionType === 'Rule' ? '기준서형' : questionType === 'Case' ? '사례/OX형' : '일반';

    return `# 당신의 역할
KICPA 2차 회계감사 전문 강사이자 채점 위원입니다. 학생의 질문에 친절하고 상세하게 답변해주세요.

# 문제 정보
- 주제: ${this.examCase.topic}
- 유형: ${typeDisplay}
- 배점: ${this.questionData.score}점

## 지문 (Scenario)
${scenario || '지문 없음'}

## 물음 (Question)
${this.questionData.question}

## 모범 답안 (Model Answer)
${this.questionData.model_answer}

${this.questionData.keywords && this.questionData.keywords.length > 0 ? `## 핵심 키워드
${this.questionData.keywords.join(', ')}` : ''}

${this.questionData.explanation ? `## 채점 가이드
${this.questionData.explanation}` : ''}

---

# 학생 정보
## 학생 답안
${this.userAnswer || '(작성하지 않음)'}

## 채점 결과
- 획득 점수: ${this.feedback.score}점 / ${this.questionData.score}점
- 채점 피드백: ${this.feedback.feedback}
${this.feedback.strengths && this.feedback.strengths.length > 0 ? `- 강점: ${this.feedback.strengths.join(', ')}` : ''}
${this.feedback.improvements && this.feedback.improvements.length > 0 ? `- 개선점: ${this.feedback.improvements.join(', ')}` : ''}
${this.feedback.keywordMatch && this.feedback.keywordMatch.length > 0 ? `- 포함된 키워드: ${this.feedback.keywordMatch.join(', ')}` : ''}
${this.feedback.missingKeywords && this.feedback.missingKeywords.length > 0 ? `- 누락된 키워드: ${this.feedback.missingKeywords.join(', ')}` : ''}

---

# 답변 원칙
1. **단계별 사고**: 질문의 범위를 명확히 하고, 회계 기준 요건별로 하나씩 검토하여 답변하세요.
2. **엄격성 유지**: 실전 채점 기조를 유지하되, 학생의 논리가 합리적이라면 부분 점수 가능성이나 보완 방향을 제시하세요.
3. **기준서 명시**: 가능한 경우 관련 회계감사기준서(KSA) 번호를 언급하세요.
4. **친절하고 명확하게**: 학생이 이해하기 쉽게 설명하되, 수험생 수준에 맞는 전문성을 유지하세요.

학생의 질문에 답변해주세요.`;
  }

  /**
   * AI에게 질문 전송 (Chat SDK 사용)
   * @param {string} userQuestion - 사용자 질문
   * @param {string} apiKey - Gemini API 키
   * @param {string} model - 사용할 모델 (기본: gemini-2.5-flash)
   * @returns {Promise<string>} - AI 답변
   */
  async askQuestion(userQuestion, apiKey, model = 'gemini-2.5-flash') {
    try {
      // 첫 질문이면 Chat 세션 초기화
      if (!this.chatSession) {
        const systemInstruction = this.buildContextPrompt();

        this.chatSession = new GeminiChatSession(
          apiKey,
          model,
          systemInstruction,
          {
            temperature: 0.7,
            maxOutputTokens: 16384
          }
        );

        await this.chatSession.initialize();
      }

      // Chat SDK로 메시지 전송 (자동으로 히스토리 관리됨)
      const response = await this.chatSession.sendMessage(userQuestion);

      // 로컬 히스토리에도 저장 (PDF 내보내기용)
      this.conversationHistory.push({
        role: 'user',
        content: userQuestion
      });

      this.conversationHistory.push({
        role: 'assistant',
        content: response
      });

      return response;
    } catch (error) {
      console.error('❌ [AI Tutor] Chat API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 빠른 질문 템플릿 생성
   * @returns {Array<{id: string, label: string, prompt: string}>}
   */
  getQuickQuestions() {
    const scorePercent = (this.feedback.score / this.questionData.score) * 100;

    const questions = [];

    // 만점이 아닌 경우 (0~99점)
    if (scorePercent < 100) {
      questions.push({
        id: 'detail-deduction',
        icon: '📉',
        label: '감점 상세 분석',
        prompt: '내 답안에서 어떤 요건이 빠져서 감점된 건가요? 구체적으로 분석해주세요.'
      });
    }

    // 부분 점수를 받은 경우
    if (scorePercent > 0 && scorePercent < 100) {
      questions.push({
        id: 'alternative-answer',
        icon: '📝',
        label: '대안 답안 확인',
        prompt: '만약 이렇게 썼다면 어땠을까요? 제 답안을 조금만 수정하면 만점을 받을 수 있는 방법을 알려주세요.'
      });
    }

    // 오답인 경우 또는 만점인 경우 - 올바른 접근법 확인
    if (scorePercent === 0 || scorePercent === 100) {
      questions.push({
        id: 'correct-approach',
        icon: '💡',
        label: '올바른 접근법',
        prompt: scorePercent === 100
          ? '이 문제의 핵심 논리와 올바른 접근법을 정리해주세요. 다음에도 확실하게 맞출 수 있도록 요점을 알려주세요.'
          : '이 문제의 올바른 접근법과 핵심 논리를 단계별로 설명해주세요.'
      });
    }

    // 기준서형 문제
    if (this.questionData.type === 'Rule' || this.examCase.type === 'Rule') {
      questions.push({
        id: 'memorization-tip',
        icon: '💡',
        label: '암기 팁 요청',
        prompt: '이 문제의 핵심 키워드를 따서 암기하기 쉬운 코드나 암기법을 만들어주세요.'
      });
    }

    // 사례/OX형 문제
    if (this.questionData.type === 'Case' || this.examCase.type === 'Case') {
      questions.push({
        id: 'reasoning-explanation',
        icon: '🔍',
        label: '논리적 근거 설명',
        prompt: '왜 이런 결론이 나오는지 논리적 근거를 단계별로 설명해주세요.'
      });
    }

    return questions;
  }

  /**
   * 대화 이력 초기화
   */
  clearHistory() {
    this.conversationHistory = [];
  }
}

/**
 * AI 튜터 세션 관리자
 */
class AiTutorManager {
  constructor() {
    this.sessions = new Map(); // questionId -> AiTutorSession
  }

  /**
   * 새 세션 생성 또는 기존 세션 반환
   */
  getSession(questionId, questionData, userAnswer, feedback, examCase) {
    if (!this.sessions.has(questionId)) {
      this.sessions.set(
        questionId,
        new AiTutorSession(questionId, questionData, userAnswer, feedback, examCase)
      );
    }
    return this.sessions.get(questionId);
  }

  /**
   * 세션 삭제
   */
  deleteSession(questionId) {
    this.sessions.delete(questionId);
  }

  /**
   * 모든 세션 삭제
   */
  clearAllSessions() {
    this.sessions.clear();
  }
}

// 싱글톤 인스턴스
export const aiTutorManager = new AiTutorManager();

/**
 * 특정 문제에 대한 AI 튜터 세션 가져오기
 */
export function getAiTutorSession(questionId, questionData, userAnswer, feedback, examCase) {
  return aiTutorManager.getSession(questionId, questionData, userAnswer, feedback, examCase);
}

/**
 * AI 튜터 세션 초기화
 */
export function clearAiTutorSession(questionId) {
  aiTutorManager.deleteSession(questionId);
}

/**
 * 모든 AI 튜터 세션 초기화
 */
export function clearAllAiTutorSessions() {
  aiTutorManager.clearAllSessions();
}
