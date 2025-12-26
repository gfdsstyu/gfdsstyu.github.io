/**
 * AI Tutor Service (Gamlini 2.0) - 채점 결과에 대한 AI 질의응답 기능
 *
 * 기능:
 * - 특정 문제에 대해 AI와 대화하며 궁금증 해소
 * - 자동 컨텍스트 주입 (지문, 물음, 모범답안, 채점기준, 사용자답안)
 * - RAG 기반 실증절차/기준서/유사문제 검색
 * - 대화 보관 및 복습
 * - Context Injection Preset Buttons
 * - Gemini Chat SDK 사용으로 효율적인 대화 관리
 */

import { GeminiChatSession } from '../../services/geminiChatApi.js';
import { OpenRouterChatSession } from '../../services/openRouterApi.js';
import { ragService } from '../../services/ragService.js';
import { chatStorage } from '../../services/chatStorageManager.js';

/**
 * AI 튜터 대화 세션 클래스 (Gamlini 2.0)
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
    this.currentChatId = null; // Chat Storage ID
    this.ragContext = null; // RAG 검색 결과 캐시
  }

  /**
   * 컨텍스트 프롬프트 생성
   * 문제 정보를 AI에게 전달하기 위한 시스템 프롬프트
   */
  buildContextPrompt() {
    const scenario = this.questionData.scenario || this.examCase.scenario || '';
    const questionType = this.questionData.type || this.examCase.type || '일반';
    const typeDisplay = questionType === 'Rule' ? '기준서형' : questionType === 'Case' ? '사례/OX형' : '일반';

    // 일반 대화 모드 (컨텍스트 없음)
    if (questionType === 'General') {
      return `# 당신의 역할
KICPA 2차 회계감사 시험 준비를 돕는 AI 튜터입니다.

# 지식 출처 우선순위
답변 시 다음 규정을 최우선 근거로 활용합니다:
1. **회계감사기준 (KSA)**: 2025년 개정 사항 포함 - **ISA보다 KSA(한국채택감사기준)를 우선 적용**
2. **공인회계사 윤리기준**: 2024년 개정 (독립성, 안전장치, 직무제한 등)
3. **외부감사법 및 시행령**: 감사인 선임, 지정, 해임 등
4. **공인회계사법**: 직무 제한, 징계 등 (윤리기준과 병행 참조)

# 답변 원칙
1. **기준서 원문 인용**: KSA 번호와 문단을 명시하고, 규정 원문을 인용구(>)로 정확히 표기
2. **두괄식 답변**: 결론을 먼저 명확하게 제시
3. **수험 목적**: KICPA 2차 시험 범위에 맞춰 답변

학생의 질문에 답변해주세요.`;
    }

    // Exam 모드 (특정 문제에 대한 질의)
    return `# 당신의 역할
KICPA 2차 시험 출제 의도와 채점 기준을 완벽히 파악한 고득점 합격자이자 튜터입니다. 답안지 작성 표준(두괄식)과 정확한 기준서 암기를 돕는 것이 목표입니다.

# 지식 출처 우선순위
답변 시 다음 규정을 최우선 근거로 활용합니다:
1. **회계감사기준 (KSA)**: 2025년 개정 사항 포함 - **ISA보다 KSA(한국채택감사기준)를 우선 적용**
2. **공인회계사 윤리기준**: 2024년 개정 (독립성, 안전장치, 직무제한 등)
3. **외부감사법 및 시행령**: 감사인 선임, 지정, 해임 등
4. **공인회계사법**: 직무 제한, 징계 등 (윤리기준과 병행 참조)

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

${this.questionData.keywords && this.questionData.keywords.length > 0 ? `## 핵심 채점 키워드
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

## 1. 철저한 두괄식
결론을 먼저 명확하게 제시하세요.
- 예: '적절하지 않습니다', '수행해야 할 절차는 다음과 같습니다'

## 2. 기준서 원문 인용 (핵심)
요약하지 말고 **규정의 원문(Full Sentence)**을 그대로 인용하여 암기를 돕습니다.
- **형식**: > [KSA 500 문단 6] 감사인은 감사증거로 사용될 정보가 경영진측 전문가가 수행한 업무를 이용하여 작성되었다면...
- **원칙**: KSA(한국채택감사기준) 번호와 문단을 명시하고, 핵심 문장을 인용구(>)로 원문 그대로 표기
- **주의**: 조사 하나까지 정확하게 표기하여 학생이 눈으로 익힐 수 있게 합니다
- **우선순위**: ISA가 아닌 **KSA를 우선 적용**하며, 2025년 개정사항을 반영합니다

## 3. 채점 키워드 강조
부분 점수를 받을 수 있는 핵심 키워드를 불릿 포인트로 명시합니다.

## 4. 유형별 맞춤 설명
- **기준서형**: 기준서 원문을 왜 적용하는지, 유사 기준서와 구분 포인트
- **사례형**: 지문의 어떤 단서(Clue)가 해당 기준서를 트리거했는지 논리적 연결
- **OX형**: 틀린 부분을 명확히 짚고 올바른 문장으로 수정

## 5. 부분 점수 전략
명확하지 않은 경우 '최소한 이 키워드는 포함해야 부분 점수'라는 팁 제공.

학생의 질문에 답변해주세요.`;
  }

  /**
   * AI에게 질문 전송 (Chat SDK 사용) - Gamlini 2.0 Enhanced
   * @param {string} userQuestion - 사용자 질문
   * @param {string} apiKey - API 키 (Gemini 또는 OpenRouter)
   * @param {string} model - 사용할 모델 (기본: gemini-2.5-flash)
   * @param {boolean} enableRAG - RAG Context 활성화 여부 (기본: true)
   * @returns {Promise<string>} - AI 답변
   */
  async askQuestion(userQuestion, apiKey, model = 'gemini-2.5-flash', enableRAG = true) {
    try {
      // 첫 질문이면 Chat 세션 초기화
      if (!this.chatSession) {
        // Exam/KAM은 Gemini만 지원 (Groq는 Quiz 전용)
        const systemInstruction = this.buildContextPrompt(); // 전체 모드

        console.log('🔑 [AI Tutor] Gemini API 키 사용:', apiKey ? apiKey.substring(0, 10) + '...' : '❌ 없음');

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

      // 🆕 [Gamlini 2.0] RAG Context 주입
      let enrichedQuestion = userQuestion;
      if (enableRAG) {
        enrichedQuestion = await this.enrichWithRAGContext(userQuestion);
      }

      // Chat SDK로 메시지 전송 (자동으로 히스토리 관리됨)
      const response = await this.chatSession.sendMessage(enrichedQuestion);

      // 로컬 히스토리에도 저장 (원본 질문 저장, RAG Context는 내부 처리)
      this.conversationHistory.push({
        role: 'user',
        content: userQuestion,
        timestamp: Date.now()
      });

      this.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });

      // 🆕 [Gamlini 2.0] Chat Storage에 자동 저장
      this.saveToStorage();

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

  /**
   * Chat Session 초기화 (모델 변경 시 호출)
   */
  resetSession() {
    this.chatSession = null;
    this.conversationHistory = []; // 대화 히스토리도 함께 초기화 (중요!)
    this.ragContext = null; // RAG 캐시도 초기화
    console.log('🔄 [AI Tutor] Chat Session + History 완전 초기화됨 (모델 변경)');
  }

  /**
   * 🆕 [Gamlini 2.0] RAG Context 검색 및 프롬프트 주입
   * @param {string} userQuestion - 사용자 질문
   * @returns {Promise<string>} - RAG Context가 추가된 질문
   */
  async enrichWithRAGContext(userQuestion) {
    try {
      // 이미 캐시된 Context가 있으면 재사용
      if (!this.ragContext) {
        console.log('🔍 [Gamlini 2.0] RAG Context 검색 중...');

        // 문제 텍스트와 키워드로 검색
        const questionText = this.questionData.question || '';
        const keywords = this.questionData.keywords || [];

        this.ragContext = await ragService.searchAll(questionText, keywords);

        console.log('✅ [Gamlini 2.0] RAG Context 검색 완료:', {
          procedures: this.ragContext.procedures.length,
          standards: this.ragContext.standards.length,
          examQuestions: this.ragContext.examQuestions.length
        });
      }

      // Context가 있으면 질문에 추가
      if (this.ragContext.context && this.ragContext.context.trim()) {
        return `${userQuestion}\n\n---\n\n# 참고 자료 (RAG Context)\n${this.ragContext.context}`;
      }

      return userQuestion;
    } catch (error) {
      console.error('❌ [Gamlini 2.0] RAG Context 검색 실패:', error);
      // 실패해도 원래 질문은 전달
      return userQuestion;
    }
  }

  /**
   * 🆕 [Gamlini 2.0] 대화를 Chat Storage에 저장
   * @returns {boolean} - 성공 여부
   */
  saveToStorage() {
    try {
      if (this.conversationHistory.length === 0) {
        console.log('⚠️ [Gamlini 2.0] 저장할 대화 없음');
        return false;
      }

      // 새 대화 세션이면 생성
      if (!this.currentChatId) {
        const chat = chatStorage.createChat(
          this.questionId,
          this.questionData.question || '문제 없음',
          {
            ...this.questionData,
            examCase: this.examCase,
            feedback: this.feedback
          }
        );

        this.currentChatId = chat.id;

        // 메시지 추가
        this.conversationHistory.forEach(msg => {
          chat.messages.push(msg);
        });

        chatStorage.saveChat(chat);
        console.log('✅ [Gamlini 2.0] 새 대화 저장:', this.currentChatId);
      } else {
        // 기존 대화 업데이트
        const chat = chatStorage.loadChat(this.currentChatId);
        if (chat) {
          chat.messages = [...this.conversationHistory];
          chatStorage.saveChat(chat);
          console.log('✅ [Gamlini 2.0] 대화 업데이트:', this.currentChatId);
        }
      }

      return true;
    } catch (error) {
      console.error('❌ [Gamlini 2.0] 대화 저장 실패:', error);
      return false;
    }
  }

  /**
   * 🆕 [Gamlini 2.0] Context Injection Preset Buttons
   * 기획서에서 제안한 프리셋 버튼들
   * @returns {Array<{id: string, icon: string, label: string, prompt: string}>}
   */
  getContextInjectionPresets() {
    return [
      {
        id: 'kam-original-text',
        icon: '📘',
        label: '기준서 원문',
        prompt: '이 문제와 관련된 회계감사기준서(KAM) 원문을 보여주고 요약해주세요. 핵심 조문을 인용해주세요.',
        requiresRAG: true
      },
      {
        id: 'trap-analysis',
        icon: '🔍',
        label: '함정 포인트',
        prompt: '이 문제에서 수험생들이 가장 많이 실수하는 "단어 살짝 바꾸기" 함정 포인트를 분석해주세요. 어떤 부분을 주의해야 하나요?',
        requiresRAG: false
      },
      {
        id: 'case-example',
        icon: '✍️',
        label: '사례로 이해',
        prompt: '이 이론이 실제 감사 현장에서 어떻게 적용되는지 아주 쉬운 사례를 들어 설명해주세요. 실증절차와 연결해주세요.',
        requiresRAG: true
      },
      {
        id: 'mnemonic-code',
        icon: '💡',
        label: '암기 코드',
        prompt: '이 문제의 핵심 키워드 3개를 뽑아서 절대 안 까먹는 두문자(Mnemonics) 암기법을 만들어주세요.',
        requiresRAG: false
      },
      {
        id: 'reverse-scenario',
        icon: '❓',
        label: '반대 상황',
        prompt: '이 문장이 틀린 지문으로 출제된다면 어떻게 변형될 수 있을까요? 옳은/틀린 반대 케이스를 만들어주세요.',
        requiresRAG: false
      },
      {
        id: 'substantive-procedures',
        icon: '🔗',
        label: '관련 실증절차',
        prompt: '이 이론과 연결되는 실제 감사 실증절차를 kamData에서 찾아서 설명해주세요. 어떤 절차를 수행하나요?',
        requiresRAG: true
      }
    ];
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
