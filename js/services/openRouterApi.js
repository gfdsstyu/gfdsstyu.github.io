/**
 * Groq API 서비스
 * 초고속 LLM 추론 (Llama, Qwen, Kimi 등)
 */

/**
 * Groq Chat Session 클래스
 */
export class OpenRouterChatSession {
  constructor(apiKey, model = 'llama-3.3-70b-versatile', systemInstruction = null, generationConfig = {}) {
    this.apiKey = apiKey;
    this.modelName = model;
    this.systemInstruction = systemInstruction;
    this.generationConfig = {
      temperature: 0.7,
      max_tokens: 8192, // Groq API 최대값: 8192
      ...generationConfig
    };
    this.history = [];
    this.initialized = false;
  }

  /**
   * 세션 초기화
   */
  async initialize() {
    if (this.initialized) return;

    // 시스템 메시지 추가
    if (this.systemInstruction) {
      this.history = [{
        role: 'system',
        content: this.systemInstruction
      }];
    }

    this.initialized = true;
    console.log('✅ [Groq] 세션 초기화 완료:', this.modelName);
  }

  /**
   * 메시지 전송 - 자동 재시도 포함
   * @param {string} message - 사용자 메시지
   * @param {number} maxRetries - 최대 재시도 횟수 (기본: 3)
   * @returns {Promise<string>} - AI 응답
   */
  async sendMessage(message, maxRetries = 3) {
    if (!this.initialized) {
      await this.initialize();
    }

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 [Groq] 메시지 전송 중... (시도 ${attempt}/${maxRetries})`);

        // 사용자 메시지 히스토리에 추가
        this.history.push({
          role: 'user',
          content: message
        });

        // Groq TPM 제한 대응: 최근 대화만 유지 (system + 최근 1개 대화 쌍)
        // Exam AI Tutor는 각 질문이 독립적이므로 이전 대화 컨텍스트가 거의 필요 없음
        const maxHistoryPairs = 1; // user-assistant 쌍 최대 개수 (현재 질문만)
        let messagesToSend = [];

        // System 메시지는 항상 포함
        const systemMessages = this.history.filter(m => m.role === 'system');
        const conversationMessages = this.history.filter(m => m.role !== 'system');

        // 최근 N개 대화만 유지 (user-assistant 쌍 기준)
        const recentMessages = conversationMessages.slice(-maxHistoryPairs * 2);
        messagesToSend = [...systemMessages, ...recentMessages];

        console.log(`🔍 [Groq] 전송 메시지 수: ${messagesToSend.length} (전체: ${this.history.length})`);

        // Groq API 호출
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.modelName,
            messages: messagesToSend,
            temperature: this.generationConfig.temperature,
            max_tokens: this.generationConfig.max_tokens
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Groq API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const assistantMessage = data.choices[0].message.content;

        // 응답 히스토리에 추가
        this.history.push({
          role: 'assistant',
          content: assistantMessage
        });

        console.log('✅ [Groq] 응답 받음:', assistantMessage.substring(0, 100) + '...');
        return assistantMessage;

      } catch (error) {
        lastError = error;
        const errorMessage = error.message || String(error);

        // 429 Rate Limit 에러 처리
        if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
          // Rate limit 에러 메시지에서 대기 시간 추출 (예: "Please try again in 20.13s")
          const waitMatch = errorMessage.match(/try again in ([\d.]+)s/);
          const waitSeconds = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) : 30;

          console.warn(`⏳ [Groq] Rate Limit 도달 - ${waitSeconds}초 대기 필요`);

          // 사용자 친화적인 에러 메시지로 변경
          throw new Error(
            `Groq API 사용량 한도 초과입니다.\n` +
            `${waitSeconds}초 후에 다시 시도해주세요.\n\n` +
            `💡 팁: 더 적은 토큰을 사용하는 모델(llama-3.1-8b-instant)을 선택하거나, ` +
            `Gemini 모델로 변경해보세요.`
          );
        }

        // 500 에러 또는 일시적 오류인 경우에만 재시도
        const isRetryable = errorMessage.includes('500') ||
                           errorMessage.includes('502') ||
                           errorMessage.includes('503') ||
                           errorMessage.includes('timeout') ||
                           errorMessage.includes('network');

        if (!isRetryable) {
          console.error('❌ [Groq] 재시도 불가능한 오류:', error);
          throw error;
        }

        if (attempt < maxRetries) {
          // 지수 백오프: 1초, 2초, 4초...
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.warn(`⚠️ [Groq] 오류 발생, ${waitTime}ms 후 재시도... (${attempt}/${maxRetries})`, errorMessage);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.error(`❌ [Groq] 최대 재시도 횟수 초과 (${maxRetries}회)`, error);
        }
      }
    }

    throw lastError;
  }

  /**
   * 대화 이력 가져오기
   */
  async getHistory() {
    return this.history
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
  }

  /**
   * 대화 이력 초기화
   */
  async clearHistory() {
    // 시스템 메시지만 유지
    this.history = this.systemInstruction ? [{
      role: 'system',
      content: this.systemInstruction
    }] : [];
    console.log('🗑️ [Groq] 대화 이력 초기화됨');
  }
}

/**
 * Groq 지원 모델 목록 (2025년 12월 공식 문서 기준)
 * https://console.groq.com/docs/models
 */
export const GROQ_MODELS = {
  // Production Models - Llama
  'llama-3.3-70b-versatile': {
    name: 'Llama 3.3 70B Versatile',
    icon: '🦙',
    provider: 'Meta'
  },
  'llama-3.1-8b-instant': {
    name: 'Llama 3.1 8B Instant',
    icon: '🦙',
    provider: 'Meta'
  },

  // Preview Models - Llama 4
  'meta-llama/llama-4-maverick-17b-128e-instruct': {
    name: 'Llama 4 Maverick 17B',
    icon: '🦙',
    provider: 'Meta'
  },
  'meta-llama/llama-4-scout-17b-16e-instruct': {
    name: 'Llama 4 Scout 17B',
    icon: '🦙',
    provider: 'Meta'
  },

  // Preview Models - Qwen
  'qwen/qwen3-32b': {
    name: 'Qwen 3 32B',
    icon: '🎯',
    provider: 'Qwen'
  },

  // Preview Models - Moonshot
  'moonshotai/kimi-k2-instruct': {
    name: 'Kimi K2 Instruct',
    icon: '🌙',
    provider: 'Moonshot'
  },
  'moonshotai/kimi-k2-instruct-0905': {
    name: 'Kimi K2 Instruct (0905)',
    icon: '🌙',
    provider: 'Moonshot'
  },

  // Featured Models - OpenAI
  'openai/gpt-oss-120b': {
    name: 'GPT OSS 120B',
    icon: '🤖',
    provider: 'OpenAI'
  }
};
