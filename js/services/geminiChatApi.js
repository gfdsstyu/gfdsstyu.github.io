/**
 * Gemini Chat API 서비스 (SDK 방식)
 * Google Generative AI SDK를 동적으로 로드하여 사용
 */

/**
 * Gemini SDK를 동적으로 로드
 */
async function loadGeminiSDK() {
  // 이미 로드되어 있으면 반환
  if (window.GoogleGenerativeAI) {
    console.log('✅ [Gemini SDK] 이미 로드됨');
    return window.GoogleGenerativeAI;
  }

  console.log('🔄 [Gemini SDK] 동적 로드 시작...');

  // SDK 스크립트 동적 로드
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
      window.GoogleGenerativeAI = GoogleGenerativeAI;
      console.log('✅ [Gemini SDK] 로드 완료');
      window.dispatchEvent(new Event('gemini-sdk-loaded'));
    `;

    script.onerror = (error) => {
      console.error('❌ [Gemini SDK] 스크립트 로드 실패:', error);
      reject(new Error('Gemini SDK 스크립트 로드 실패'));
    };

    const timeout = setTimeout(() => {
      console.error('❌ [Gemini SDK] 로드 타임아웃 (10초)');
      reject(new Error('Gemini SDK 로드 타임아웃 - 네트워크를 확인해주세요.'));
    }, 10000);

    window.addEventListener('gemini-sdk-loaded', () => {
      clearTimeout(timeout);
      if (window.GoogleGenerativeAI) {
        console.log('✅ [Gemini SDK] 이벤트 수신 성공');
        resolve(window.GoogleGenerativeAI);
      } else {
        reject(new Error('SDK 로드되었으나 GoogleGenerativeAI를 찾을 수 없음'));
      }
    }, { once: true });

    document.head.appendChild(script);
  });
}

/**
 * Gemini Chat 세션 클래스 (SDK 기반)
 */
export class GeminiChatSession {
  constructor(apiKey, model = 'gemini-2.5-flash', systemInstruction = null, generationConfig = {}) {
    this.apiKey = apiKey;
    this.modelName = model;
    this.systemInstruction = systemInstruction;
    this.generationConfig = {
      temperature: 0.7,
      maxOutputTokens: 16384,
      ...generationConfig
    };
    this.genAI = null;
    this.model = null;
    this.chat = null;
    this.initialized = false;
  }

  /**
   * SDK 초기화 및 Chat 세션 시작
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const GoogleGenerativeAI = await loadGeminiSDK();
      this.genAI = new GoogleGenerativeAI(this.apiKey);

      const modelConfig = {
        model: this.modelName,
        generationConfig: this.generationConfig
      };

      // systemInstruction 추가 (지원되는 경우)
      if (this.systemInstruction) {
        modelConfig.systemInstruction = this.systemInstruction;
      }

      this.model = this.genAI.getGenerativeModel(modelConfig);

      // Chat 세션 시작 (빈 히스토리로)
      this.chat = this.model.startChat({
        history: []
      });

      this.initialized = true;
      console.log('✅ [Gemini Chat] SDK 초기화 완료:', this.modelName);
    } catch (error) {
      console.error('❌ [Gemini Chat] SDK 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 메시지 전송 (SDK의 sendMessage 사용)
   * @param {string} message - 사용자 메시지
   * @returns {Promise<string>} - AI 응답
   */
  async sendMessage(message) {
    if (!this.initialized) {
      console.log('🔄 [Gemini Chat] SDK 초기화 중...');
      await this.initialize();
    }

    try {
      console.log('📤 [Gemini Chat] 메시지 전송 중...');
      const result = await this.chat.sendMessage(message);
      const response = result.response;
      const text = response.text();
      console.log('✅ [Gemini Chat] 응답 받음:', text.substring(0, 100) + '...');
      return text;
    } catch (error) {
      console.error('❌ [Gemini Chat] 메시지 전송 실패:', error);
      throw error;
    }
  }

  /**
   * 대화 이력 가져오기 (SDK 형식을 앱 형식으로 변환)
   */
  async getHistory() {
    if (!this.initialized || !this.chat) return [];

    try {
      const history = await this.chat.getHistory();
      return history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.parts.map(p => p.text || '').join('')
      }));
    } catch (error) {
      console.error('❌ [Gemini Chat] 히스토리 가져오기 실패:', error);
      return [];
    }
  }

  /**
   * 대화 이력 초기화 (새 세션 시작)
   */
  async clearHistory() {
    if (!this.initialized) return;

    // 새 Chat 세션 시작
    this.chat = this.model.startChat({
      history: []
    });
  }
}
