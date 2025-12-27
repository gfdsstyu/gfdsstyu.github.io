/**
 * 감린이 - AI Tutor Floating Chat UI
 *
 * 기능:
 * - 우측 하단 플로팅 버튼
 * - 아래에서 올라오는 채팅 패널
 * - Context Injection Preset Buttons
 * - 대화 보관함 (History)
 * - 기준서 질문 모드(index.html)와 시험 모드(exam.html) 모두 지원
 * - 크기 조절 가능
 */

import { getAiTutorSession } from './examAiTutor.js';
import { chatStorage } from '../../services/chatStorageManager.js';

/**
 * Gamlini Drawer 클래스
 */
export class GamliniDrawer {
  constructor() {
    this.isOpen = false;
    this.currentTab = 'chat'; // 'chat' | 'history'
    this.currentSession = null;
    this.drawerElement = null;
    this.fabElement = null;
    this.apiKey = null;
    this.mode = 'exam'; // 'exam' | 'standards' (기준서 질문 모드)
    this.currentContext = null; // 현재 보고 있는 컨텍스트 (문제 또는 기준서 항목)
    this.currentSize = 'normal'; // 'small' | 'normal' | 'large'
    this.currentChatId = null; // 현재 대화 ID (학습 기록 저장용)
  }

  /**
   * 드로어 초기화
   */
  initialize() {
    this.createFloatingButton();
    this.createDrawerHTML();
    this.attachEventListeners();
    console.log('✅ [Gamlini Drawer] 초기화 완료');
  }

  /**
   * 플로팅 버튼 생성 (우측 하단)
   * exam 모드에서는 생성하지 않음 (감린이로 깊이 학습하기 버튼만 사용)
   */
  createFloatingButton() {
    // exam 모드에서는 floating 버튼 숨김
    // exam 모드는 DOM에 특정 요소가 있는지로 감지 (더 정확한 셀렉터 사용)
    const isExamMode = document.getElementById('exam-header') ||
                       document.querySelector('.exam-selection-container');

    console.log('🔍 [Gamlini] Exam 모드 여부:', isExamMode);

    if (isExamMode) {
      console.log('📝 [Gamlini] Exam 모드 - Floating 버튼 숨김');
      // 기존 버튼이 있다면 제거
      const existing = document.getElementById('gamlini-fab');
      if (existing) existing.remove();
      return;
    }

    const existing = document.getElementById('gamlini-fab');
    if (existing) existing.remove();

    const fab = document.createElement('button');
    fab.id = 'gamlini-fab';
    fab.className = 'gamlini-fab';
    fab.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="48" height="48">
        <rect width="100" height="100" rx="20" fill="#6D28D9"/>
        <rect x="20" y="20" width="60" height="60" rx="10" fill="white"/>
        <circle cx="36" cy="43" r="9" fill="#8B5CF6"/>
        <text x="36" y="46" font-size="14" fill="white" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="900" text-anchor="middle" dominant-baseline="central">ㄱ</text>
        <g transform="translate(64, 43)">
          <path d="M0 0 L 4 10 L 14 14 L 4 18 L 0 28 L -4 18 L -14 14 L -4 10 Z" fill="#FACC15" transform="scale(0.8) translate(0, -14)"/>
        </g>
        <path d="M30 60 H 70 V 72 H 30 Z M35 60 V 72 M 40 60 V 72 M 45 60 V 72 M 50 60 V 72 M 55 60 V 72 M 60 60 V 72 M 65 60 V 72" fill="none" stroke="#4F46E5" stroke-width="2"/>
      </svg>
    `;

    document.body.appendChild(fab);
    this.fabElement = fab;

    // FAB 클릭 이벤트
    fab.addEventListener('click', () => {
      if (this.isOpen) {
        this.close();
      } else {
        // 현재 화면의 컨텍스트를 자동으로 가져와서 열기
        this.detectAndOpenWithContext();
      }
    });
  }

  /**
   * 현재 화면의 컨텍스트 감지 및 드로어 열기
   */
  detectAndOpenWithContext() {
    // API 키 먼저 확인
    const apiKey = localStorage.getItem('gemini_api_key');
    console.log('API 키 확인:', apiKey ? '있음' : '없음', apiKey?.substring(0, 10) + '...');

    if (!apiKey) {
      alert('먼저 Gemini API 키를 설정해주세요. (설정 > API 키)');
      return;
    }

    // exam.html - 채점 결과 화면에서는 아무것도 안함 (버튼으로만 열림)
    // index.html - 기준서 모드에서는 현재 보고있는 기준서 항목 감지
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
      this.openWithStandardsContext(apiKey);
    } else {
      // 기본 열기 (일반 대화 모드 - 빈 세션 생성)
      this.openGeneralMode(apiKey);
    }
  }

  /**
   * 일반 대화 모드로 열기 (컨텍스트 없음)
   */
  openGeneralMode(apiKey) {
    this.mode = 'general';
    this.apiKey = apiKey;

    // 일반 대화용 더미 세션 생성
    const questionData = {
      question: '일반 대화',
      model_answer: '',
      score: 0,
      type: 'General',
      keywords: []
    };

    const examCase = {
      topic: '일반 대화',
      scenario: '',
      type: 'General'
    };

    this.currentSession = getAiTutorSession(
      'general_chat',
      questionData,
      '',
      { score: 0, feedback: '' },
      examCase
    );

    this.drawerElement.classList.add('open');
    if (this.fabElement) {
      this.fabElement.classList.add('hidden');
    }
    this.isOpen = true;

    this.updateContextInfo();
    this.clearMessages();
    this.renderWelcomeMessage();

    console.log('✅ [Gamlini Drawer] 열림 (일반 대화 모드)');
  }

  /**
   * 기준서 질문 모드에서 현재 보고있는 항목으로 열기
   */
  openWithStandardsContext(apiKey) {
    console.log('openWithStandardsContext 호출, API 키:', apiKey ? '있음' : '없음');

    // 현재 활성화된 기준서 항목 찾기
    const activeElement = document.querySelector('.highlight-target.highlight-active');
    if (activeElement) {
      const standardsText = activeElement.textContent;
      const standardsId = activeElement.id;

      const standardsContext = {
        mode: 'standards',
        standardsId: standardsId,
        text: standardsText,
        title: standardsId
      };

      this.openWithCustomContext(standardsContext, apiKey);
    } else {
      // 활성 항목이 없으면 일반 모드로
      console.log('활성 기준서 항목 없음, 일반 모드로 전환');
      this.openGeneralMode(apiKey);
    }
  }

  /**
   * 커스텀 컨텍스트로 열기 (기준서 질문 모드용)
   */
  openWithCustomContext(context, apiKey) {
    this.mode = context.mode || 'exam';
    this.currentContext = context;
    this.apiKey = apiKey;

    // 기준서 모드용 세션 생성
    const questionData = {
      question: context.text,
      model_answer: '',
      score: 0,
      type: 'Standards',
      keywords: []
    };

    const examCase = {
      topic: context.title,
      scenario: '',
      type: 'Standards'
    };

    this.currentSession = getAiTutorSession(
      context.standardsId || 'standards_general',
      questionData,
      '',
      { score: 0, feedback: '' },
      examCase
    );

    this.drawerElement.classList.add('open');
    if (this.fabElement) {
      this.fabElement.classList.add('hidden');
    }
    this.isOpen = true;

    this.updateContextInfo();
    this.clearMessages();
    this.renderWelcomeMessage();

    console.log('✅ [Gamlini Drawer] 열림 (기준서 질문 모드):', context.standardsId);
  }

  /**
   * 드로어 HTML 생성 (하단에서 올라오는 방식)
   */
  createDrawerHTML() {
    const existing = document.getElementById('gamlini-drawer');
    if (existing) existing.remove();

    const drawer = document.createElement('div');
    drawer.id = 'gamlini-drawer';
    drawer.className = 'gamlini-drawer';
    drawer.innerHTML = `
      <!-- Drawer Panel (하단에서 올라옴) -->
      <div class="gamlini-panel">
        <!-- Header -->
        <div class="gamlini-header">
          <div class="gamlini-tabs">
            <button class="gamlini-tab active" data-tab="chat">
              💬 현재 대화
            </button>
            <button class="gamlini-tab" data-tab="history">
              📚 학습 기록
            </button>
          </div>
          <div class="gamlini-controls">
            <button class="gamlini-resize" id="gamlini-resize" title="크기 조절">
              ⇲
            </button>
            <button class="gamlini-close" id="gamlini-close" title="닫기">
              ✕
            </button>
          </div>
        </div>

        <!-- Tab Content: Chat -->
        <div class="gamlini-content" id="gamlini-chat-tab">
          <!-- Context Info -->
          <div class="gamlini-context-info" id="gamlini-context-info">
            <div class="context-badge">📚 문제 정보 로딩 중...</div>
          </div>

          <!-- 🆕 Exam 물음 선택 (Exam 모드 전용) -->
          <div class="gamlini-question-selector hidden" id="gamlini-question-selector">
            <label class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">📝 물음 선택:</label>
            <select id="gamlini-question-select" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none">
              <option value="">물음을 선택하세요...</option>
            </select>
          </div>

          <!-- Preset Buttons -->
          <div class="gamlini-presets" id="gamlini-presets">
            <button class="preset-btn preset-btn-context" id="load-current-question">📝 현재 문제</button>
            <button class="preset-btn" data-preset="original">기준서 원문</button>
            <button class="preset-btn" data-preset="trap">함정 포인트</button>
            <button class="preset-btn" data-preset="example">사례로 이해</button>
            <button class="preset-btn" data-preset="opposite">반대 상황</button>
          </div>

          <!-- Messages -->
          <div class="gamlini-messages" id="gamlini-messages">
            <div class="gamlini-welcome">
              <div class="welcome-icon">🤖</div>
              <h3>안녕하세요, 감린이입니다!</h3>
              <p>이 문제에 대해 궁금한 점을 자유롭게 물어보세요.</p>
              <p class="welcome-hint">💡 위의 버튼을 눌러 빠르게 시작할 수 있어요</p>
            </div>
          </div>

          <!-- Input (모델 선택 + 입력창 + 전송) -->
          <div class="gamlini-input-area">
            <div class="model-select-wrapper">
              <span class="model-icon" id="model-icon">⚡</span>
              <select id="gamlini-model-select" class="gamlini-model-select" title="AI 모델 선택">
                <optgroup label="Gemini 모델 (Exam/KAM 전용)">
                  <option value="gemini-2.5-flash" data-icon="⚡">⚡ Flash</option>
                  <option value="gemini-2.5-flash-lite" data-icon="💨">💨 Lite</option>
                  <option value="gemini-2.5-pro" data-icon="💎">💎 Pro</option>
                  <option value="gemini-2.0-flash" data-icon="⚡">⚡ 2.0</option>
                  <option value="gemini-3-pro-preview" data-icon="🧪">🧪 3 Pro</option>
                  <option value="gemini-3-flash-preview" data-icon="🧪">🧪 3 Flash</option>
                  <option value="gemma-3-27b-it" data-icon="🤖">🤖 Gemma 27B</option>
                </optgroup>
              </select>
            </div>
            <textarea
              id="gamlini-input"
              class="gamlini-input"
              placeholder="질문을 입력하세요..."
              rows="2"
            ></textarea>
            <button class="gamlini-send" id="gamlini-send" title="전송 (Enter)">
              ⏎
            </button>
          </div>
        </div>

        <!-- Tab Content: History -->
        <div class="gamlini-content hidden" id="gamlini-history-tab">
          <div class="history-header">
            <input
              type="text"
              class="history-search"
              id="history-search"
              placeholder="대화 검색..."
            />
            <button class="history-filter-btn" id="history-filter-favorites">
              ⭐ 즐겨찾기만
            </button>
          </div>

          <div class="history-list" id="history-list">
            <!-- 동적 생성 -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(drawer);
    this.drawerElement = drawer;

    // CSS 추가
    this.injectStyles();

    // 이벤트 리스너 재바인딩 (HTML이 새로 생성되었으므로)
    this.attachEventListeners();
  }

  /**
   * 스타일 주입 (하단 올라오기 + 플로팅 버튼)
   */
  injectStyles() {
    if (document.getElementById('gamlini-drawer-styles')) return;

    const style = document.createElement('style');
    style.id = 'gamlini-drawer-styles';
    style.textContent = `
      /* 플로팅 버튼 (우측 하단 - 네모 파비콘만) */
      .gamlini-fab {
        position: fixed;
        bottom: 16px;
        right: 16px;
        width: 56px;
        height: 56px;
        border-radius: 12px;
        background: transparent;
        border: none;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        cursor: pointer;
        z-index: 9998;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .gamlini-fab:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
      }

      .gamlini-fab:active {
        transform: translateY(0);
      }

      .gamlini-fab.hidden {
        transform: translateY(100px) scale(0);
        opacity: 0;
        pointer-events: none;
      }

      /* Gamlini Drawer (우측 하단에서 올라옴 - 모바일 스타일) */
      .gamlini-drawer {
        position: fixed;
        bottom: 8px;
        right: 8px;
        width: 420px;
        height: calc(100vh - 80px);
        max-height: calc(100vh - 80px);
        z-index: 10000;
        pointer-events: none;
        transition: width 0.3s ease, height 0.3s ease, max-height 0.3s ease;
      }

      .gamlini-drawer.size-small {
        width: 360px;
        max-height: calc(100vh - 200px);
      }

      .gamlini-drawer.size-large {
        width: 520px;
        max-height: calc(100vh - 20px);
      }

      .gamlini-drawer.open {
        pointer-events: auto;
      }

      .gamlini-panel {
        position: relative;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(20px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        transform: translateY(calc(100% + 8px));
        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        border-radius: 16px;
      }

      .gamlini-drawer.open .gamlini-panel {
        transform: translateY(0);
      }

      /* Header */
      .gamlini-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        background: rgba(255, 255, 255, 0.5);
        border-radius: 16px 16px 0 0;
      }

      .gamlini-tabs {
        display: flex;
        gap: 8px;
      }

      .gamlini-tab {
        padding: 10px 20px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        color: #666;
        transition: all 0.2s;
      }

      .gamlini-tab:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .gamlini-tab.active {
        background: rgba(102, 126, 234, 0.15);
        color: #667eea;
      }

      .gamlini-controls {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .gamlini-resize {
        padding: 8px 10px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 18px;
        color: #666;
        border-radius: 8px;
        transition: all 0.2s;
        line-height: 1;
      }

      .gamlini-resize:hover {
        background: rgba(102, 126, 234, 0.1);
        color: #667eea;
      }

      .gamlini-close {
        padding: 8px 10px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 20px;
        color: #666;
        border-radius: 8px;
        transition: all 0.2s;
        line-height: 1;
      }

      .gamlini-close:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }

      /* Content */
      .gamlini-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding: 20px;
      }

      .gamlini-content.hidden {
        display: none;
      }

      /* Context Info */
      .gamlini-context-info {
        margin-bottom: 16px;
        padding: 12px 16px;
        background: rgba(102, 126, 234, 0.1);
        border-radius: 12px;
        border-left: 4px solid #667eea;
      }

      .context-badge {
        font-size: 13px;
        color: #667eea;
        font-weight: 600;
      }

      /* Question Selector (Exam 모드 전용) */
      .gamlini-question-selector {
        margin-bottom: 12px;
        padding: 12px;
        background: rgba(102, 126, 234, 0.05);
        border-radius: 8px;
        border: 1px solid rgba(102, 126, 234, 0.2);
      }

      .gamlini-question-selector.hidden {
        display: none;
      }

      /* Preset Buttons */
      .gamlini-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }

      .preset-btn {
        padding: 6px 10px;
        background: white;
        border: 1.5px solid #e5e7eb;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        color: #333;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .preset-btn:hover {
        border-color: #667eea;
        background: rgba(102, 126, 234, 0.05);
        transform: translateY(-1px);
      }

      .preset-btn:active {
        transform: translateY(0);
      }

      .preset-btn-context {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-color: #667eea;
        font-weight: 600;
      }

      .preset-btn-context:hover {
        background: linear-gradient(135deg, #5568d3 0%, #63408b 100%);
        border-color: #5568d3;
        transform: translateY(-1px);
      }

      /* Messages */
      .gamlini-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: rgba(249, 250, 251, 0.5);
        border-radius: 12px;
        margin-bottom: 16px;
      }

      .gamlini-welcome {
        text-align: center;
        padding: 40px 20px;
        color: #666;
      }

      .welcome-icon {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 16px;
      }

      .gamlini-welcome h3 {
        font-size: 20px;
        font-weight: 700;
        color: #333;
        margin-bottom: 8px;
      }

      .gamlini-welcome p {
        font-size: 14px;
        margin-bottom: 8px;
      }

      .welcome-hint {
        font-size: 13px;
        color: #999;
      }

      .message {
        margin-bottom: 16px;
        animation: fadeInUp 0.3s ease;
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .message-user {
        display: flex;
        justify-content: flex-end;
      }

      .message-assistant {
        display: flex;
        justify-content: flex-start;
      }

      .message-bubble {
        max-width: 85%;
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.6;
        word-wrap: break-word;
      }

      .message-user .message-bubble {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .message-assistant .message-bubble {
        background: white;
        color: #333;
        border: 1px solid #e5e7eb;
        border-bottom-left-radius: 4px;
      }

      /* Markdown 스타일 */
      .message-bubble strong {
        font-weight: 700;
        color: #1f2937;
      }

      .message-bubble em {
        font-style: italic;
        color: #4b5563;
      }

      .message-bubble code {
        background: rgba(102, 126, 234, 0.1);
        color: #667eea;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 13px;
      }

      .message-bubble pre {
        background: #1f2937;
        color: #f3f4f6;
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 8px 0;
      }

      .message-bubble pre code {
        background: none;
        color: inherit;
        padding: 0;
        font-size: 13px;
        line-height: 1.5;
      }

      .message-bubble h1,
      .message-bubble h2,
      .message-bubble h3 {
        font-weight: 700;
        margin: 12px 0 8px 0;
        color: #1f2937;
      }

      .message-bubble h1 {
        font-size: 18px;
      }

      .message-bubble h2 {
        font-size: 16px;
      }

      .message-bubble h3 {
        font-size: 15px;
      }

      .message-bubble ul {
        margin: 8px 0;
        padding-left: 0;
        list-style: none;
      }

      .message-bubble li {
        margin: 4px 0;
        padding-left: 20px;
        position: relative;
      }

      .message-bubble li::before {
        content: '•';
        position: absolute;
        left: 8px;
        color: #667eea;
        font-weight: bold;
      }

      .message-bubble a {
        color: #667eea;
        text-decoration: underline;
      }

      .message-bubble a:hover {
        color: #764ba2;
      }

      /* 로딩 애니메이션 */
      .message-loading {
        display: flex;
        justify-content: flex-start;
        margin-bottom: 16px;
      }

      .loading-bubble {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        border-bottom-left-radius: 4px;
        padding: 12px 16px;
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .loading-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #667eea;
        animation: loadingDot 1.4s infinite;
      }

      .loading-dot:nth-child(1) {
        animation-delay: 0s;
      }

      .loading-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .loading-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes loadingDot {
        0%, 60%, 100% {
          transform: translateY(0);
          opacity: 0.4;
        }
        30% {
          transform: translateY(-10px);
          opacity: 1;
        }
      }

      /* Model Select Wrapper */
      .model-select-wrapper {
        position: relative;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        transition: width 0.2s;
      }

      .model-select-wrapper:focus-within {
        width: 130px;
      }

      .model-icon {
        position: absolute;
        left: 9px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 14px;
        pointer-events: none;
        z-index: 2;
        transition: opacity 0.2s;
      }

      .model-select-wrapper:focus-within .model-icon {
        opacity: 0;
      }

      .gamlini-model-select {
        width: 100%;
        height: 100%;
        padding: 0;
        border: 1.5px solid #e5e7eb;
        border-radius: 10px;
        font-size: 11px;
        font-family: inherit;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        color: #333;
        padding-left: 10px;
      }

      .gamlini-model-select:hover {
        border-color: #667eea;
        background: rgba(102, 126, 234, 0.05);
      }

      .gamlini-model-select:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        color: #333;
        padding-right: 28px;
        background: white url('data:image/svg+xml;utf8,<svg fill="%23667eea" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>') no-repeat right 6px center;
        background-size: 14px;
      }

      .gamlini-model-select option {
        color: #333;
        background: white;
        padding: 8px 12px;
        font-size: 13px;
      }

      .gamlini-model-select optgroup {
        color: #666;
        font-weight: 600;
        font-size: 12px;
      }

      /* Input Area */
      .gamlini-input-area {
        display: flex;
        gap: 4px;
        align-items: flex-end;
        position: relative;
      }

      .gamlini-input {
        flex: 1;
        padding: 12px 16px;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        font-size: 14px;
        font-family: inherit;
        resize: none;
        transition: all 0.2s;
      }

      .gamlini-input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .gamlini-send {
        width: 44px;
        height: 44px;
        padding: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 20px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .gamlini-send:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .gamlini-send:active {
        transform: translateY(0);
      }

      .gamlini-send:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      /* Preset Buttons - 전체 토글 방식 */
      /* 토글 관련 스타일 제거됨 - Preset 버튼 스타일은 위쪽에 정의됨 */

      /* History Tab */
      .history-header {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
      }

      .history-search {
        flex: 1;
        padding: 10px 16px;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        font-size: 14px;
      }

      .history-search:focus {
        outline: none;
        border-color: #667eea;
      }

      .history-filter-btn {
        padding: 10px 16px;
        background: white;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .history-filter-btn:hover {
        background: rgba(102, 126, 234, 0.1);
        border-color: #667eea;
      }

      .history-filter-btn.active {
        background: rgba(102, 126, 234, 0.15);
        border-color: #667eea;
        color: #667eea;
        font-weight: 600;
      }

      .history-list {
        flex: 1;
        overflow-y: auto;
      }

      .history-item {
        padding: 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        margin-bottom: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .history-item:hover {
        border-color: #667eea;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
        transform: translateY(-1px);
      }

      .history-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .history-item-title {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        flex: 1;
      }

      .history-item-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .history-item-favorite {
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        transition: transform 0.2s;
      }

      .history-item-favorite:hover {
        transform: scale(1.2);
      }

      .history-item-delete {
        font-size: 16px;
        cursor: pointer;
        padding: 4px 6px;
        color: #999;
        transition: all 0.2s;
        border-radius: 4px;
      }

      .history-item-delete:hover {
        background: #fee;
        color: #f44;
        transform: scale(1.1);
      }

      .history-item-meta {
        font-size: 12px;
        color: #999;
        margin-bottom: 8px;
      }

      .history-item-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .history-tag {
        padding: 4px 10px;
        background: rgba(102, 126, 234, 0.1);
        color: #667eea;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
      }

      /* 반응형 */
      @media (max-width: 768px) {
        .gamlini-drawer {
          bottom: 0;
          right: 0;
          left: 0;
          width: 100vw;
          height: 60vh;
          max-height: none;
          box-sizing: border-box;
        }

        .gamlini-panel {
          box-sizing: border-box;
        }

        .gamlini-drawer.size-small {
          height: 40vh;
        }

        /* 모바일 large 모드 = 전체화면 모달 */
        .gamlini-drawer.size-large {
          top: 0;
          bottom: 0;
          height: 100vh;
          max-height: 100vh;
        }

        .gamlini-drawer.size-large .gamlini-panel {
          border-radius: 0;
        }

        .gamlini-drawer.size-large .gamlini-header {
          border-radius: 0;
        }

        .gamlini-drawer.open {
          bottom: 0;
        }

        .gamlini-fab {
          width: 52px;
          height: 52px;
          bottom: 12px;
          right: 12px;
        }

        .gamlini-panel {
          border-radius: 12px 12px 0 0;
        }

        .gamlini-header {
          border-radius: 12px 12px 0 0;
        }
      }

      /* 데스크톱 큰 화면 */
      @media (min-width: 1400px) {
        .gamlini-drawer {
          width: 480px;
          max-height: 900px;
        }

        .gamlini-drawer.size-large {
          width: 560px;
          max-height: calc(100vh - 88px);
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 이벤트 리스너 연결
   */
  attachEventListeners() {
    // 닫기 버튼
    const closeBtn = document.getElementById('gamlini-close');
    closeBtn.addEventListener('click', () => this.close());

    // 크기 조절 버튼
    const resizeBtn = document.getElementById('gamlini-resize');
    resizeBtn.addEventListener('click', () => this.toggleSize());

    // ESC 키로 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // 탭 전환
    const tabs = this.drawerElement.querySelectorAll('.gamlini-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // 전송 버튼
    const sendBtn = document.getElementById('gamlini-send');
    const input = document.getElementById('gamlini-input');

    sendBtn.addEventListener('click', () => this.sendMessage());

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // History 검색
    const searchInput = document.getElementById('history-search');
    searchInput.addEventListener('input', (e) => {
      this.filterHistory(e.target.value);
    });

    // 즐겨찾기 필터
    const favBtn = document.getElementById('history-filter-favorites');
    favBtn.addEventListener('click', () => {
      favBtn.classList.toggle('active');

      // 검색어가 있으면 검색 결과에 필터 적용, 없으면 전체 목록에 필터 적용
      const searchQuery = searchInput.value.trim();
      if (searchQuery) {
        this.filterHistory(searchQuery);
      } else {
        this.renderHistory();
      }
    });

    // Preset 버튼 이벤트 리스너 등록 (초기화)
    this.reattachPresetEventListeners();

    // 모델 선택기 - 선택된 옵션의 아이콘만 표시
    const modelSelect = document.getElementById('gamlini-model-select');
    this.updateModelSelectIcon(modelSelect);

    modelSelect.addEventListener('change', () => {
      this.updateModelSelectIcon(modelSelect);

      // 모델 변경 시 Chat Session 초기화 (Groq ↔ Gemini 전환 시 필수)
      if (this.aiTutor) {
        this.aiTutor.resetSession();
        console.log('🔄 [Gamlini] 모델 변경 감지 - Chat Session 초기화됨');
      }
    });

    // 포커스 해제 시 아이콘만 다시 표시
    modelSelect.addEventListener('blur', () => {
      setTimeout(() => {
        this.updateModelSelectIcon(modelSelect);
      }, 200);
    });
  }

  /**
   * 모델 선택기 아이콘 업데이트
   */
  updateModelSelectIcon(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const icon = selectedOption.getAttribute('data-icon');

    // 별도의 아이콘 요소 업데이트
    const iconElement = document.getElementById('model-icon');
    if (iconElement && icon) {
      iconElement.textContent = icon;
    }
  }

  /**
   * 크기 조절 (small → normal → large → small...)
   */
  toggleSize() {
    const sizes = ['normal', 'large', 'small'];
    const currentIndex = sizes.indexOf(this.currentSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    this.currentSize = sizes[nextIndex];

    // 기존 크기 클래스 제거
    this.drawerElement.classList.remove('size-small', 'size-large');

    // 새 크기 클래스 추가
    if (this.currentSize !== 'normal') {
      this.drawerElement.classList.add(`size-${this.currentSize}`);
    }

    console.log(`🔄 [Gamlini Drawer] 크기 변경: ${this.currentSize}`);
  }

  /**
   * 드로어 열기 (시험 문제 컨텍스트)
   */
  open(session, apiKey, allExams = null, allUserAnswers = null, result = null) {
    this.currentSession = session;
    this.apiKey = apiKey;
    this.allExams = allExams;  // 전체 exam 데이터 저장
    this.allUserAnswers = allUserAnswers;
    this.result = result;

    // session의 questionData.type에 따라 mode 자동 감지
    if (session && session.questionData) {
      const qType = session.questionData.type;
      this.mode = (qType === 'Rule' || qType === 'Standards') ? 'standards' : 'exam';
    } else {
      this.mode = 'exam'; // 기본값
    }

    this.drawerElement.classList.add('open');
    if (this.fabElement) {
      this.fabElement.classList.add('hidden');
    }
    this.isOpen = true;

    if (session) {
      this.updateContextInfo();
      this.clearMessages();
      this.renderWelcomeMessage();
      this.updatePresetButtons(); // 빠른 질문 버튼 동적 생성
      this.updateQuestionSelector(); // 물음 선택 드롭다운 업데이트
    }

    console.log('✅ [Gamlini Drawer] 열림:', {
      questionId: session?.questionId || 'general',
      type: session?.questionData?.type,
      mode: this.mode,
      hasAllExams: !!allExams
    });
  }

  /**
   * 드로어 닫기
   */
  close() {
    this.drawerElement.classList.remove('open');
    if (this.fabElement) {
      this.fabElement.classList.remove('hidden');
    }
    this.isOpen = false;

    console.log('✅ [Gamlini Drawer] 닫힘');
  }

  /**
   * 탭 전환
   */
  switchTab(tabName) {
    this.currentTab = tabName;

    // 탭 버튼 활성화
    const tabs = this.drawerElement.querySelectorAll('.gamlini-tab');
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // 탭 컨텐츠 표시
    const chatTab = document.getElementById('gamlini-chat-tab');
    const historyTab = document.getElementById('gamlini-history-tab');

    if (tabName === 'chat') {
      chatTab.classList.remove('hidden');
      historyTab.classList.add('hidden');
    } else {
      chatTab.classList.add('hidden');
      historyTab.classList.remove('hidden');
      this.renderHistory();
    }
  }

  /**
   * 현재 화면의 문제 컨텍스트 로드
   */
  loadCurrentQuestion() {
    console.log('📝 [Gamlini] 현재 문제 로드 시도');
    console.log('📝 [Gamlini] currentSession:', this.currentSession);

    // Quiz 페이지 또는 일반 페이지
    // API 키 확인
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      alert('먼저 Gemini API 키를 설정해주세요. (설정 > API 키)');
      return;
    }

    // index.html (기준서 모드)에서는 현재 활성화된 기준서 항목 감지
    const activeElement = document.querySelector('.highlight-target.highlight-active');
    if (activeElement) {
      console.log('📚 [Gamlini] 기준서 모드 - 현재 활성 항목 감지:', activeElement.id);

      const standardsText = activeElement.textContent;
      const standardsId = activeElement.id;

      const questionData = {
        question: standardsText,
        model_answer: '',
        score: 0,
        type: 'Standards',
        keywords: []
      };

      const examCase = {
        topic: standardsId,
        scenario: '',
        type: 'Standards'
      };

      // 세션 업데이트
      this.mode = 'standards';
      this.apiKey = apiKey;
      this.currentSession = getAiTutorSession(
        standardsId,
        questionData,
        '',
        { score: 0, feedback: '' },
        examCase
      );

      // UI 업데이트
      this.updateContextInfo();
      this.clearMessages();
      this.renderWelcomeMessage();

      // 입력창에 포커스
      const input = document.getElementById('gamlini-input');
      if (input) {
        input.focus();
      }

      console.log('✅ [Gamlini] 기준서 컨텍스트 갱신 완료:', standardsId);
      return;
    }

    // index.html의 전역 변수에서 현재 문제 데이터 가져오기
    let questionData = null;
    let examCase = null;

    // window.currentQuestion 또는 다른 전역 변수에서 데이터 가져오기 시도
    if (window.currentQuestionData) {
      questionData = window.currentQuestionData;
      examCase = window.currentExamCase || { topic: questionData.question?.substring(0, 30) + '...', scenario: '', type: questionData.type || 'Exam' };
    } else {
      // DOM에서 직접 문제 데이터 추출 시도
      const questionTextElement = document.getElementById('question-text');
      const modelAnswerElement = document.getElementById('model-answer');

      if (questionTextElement && questionTextElement.textContent.trim()) {
        const questionText = questionTextElement.textContent.trim();
        const modelAnswer = modelAnswerElement ? modelAnswerElement.textContent.trim() : '';

        // 현재 화면이 퀴즈(기준서 문제)인지 확인
        const isQuizPage = window.location.pathname.includes('index.html') ||
                          document.title.includes('감사론') ||
                          document.title.includes('Quiz');

        const questionType = isQuizPage ? 'Rule' : 'Exam';

        questionData = {
          question: questionText,
          model_answer: modelAnswer,
          score: 0,
          type: questionType,
          keywords: []
        };

        examCase = {
          topic: questionText.substring(0, 30) + '...',
          scenario: '',
          type: questionType
        };
      } else {
        alert('현재 화면에서 문제를 찾을 수 없습니다. 문제 화면에서 시도해주세요.');
        return;
      }
    }

    // 세션 생성 - questionData.type에 따라 mode 설정
    this.mode = questionData.type === 'Rule' || questionData.type === 'Standards' ? 'standards' : 'exam';
    this.apiKey = apiKey;

    console.log('📍 [Gamlini] 현재 문제 로드:', {
      questionType: questionData.type,
      examCaseType: examCase.type,
      mode: this.mode,
      isQuizPage: window.location.pathname.includes('index.html')
    });

    this.currentSession = getAiTutorSession(
      'current_question_' + Date.now(),
      questionData,
      '',
      { score: 0, feedback: '' },
      examCase
    );

    // UI 업데이트
    this.updateContextInfo();
    this.clearMessages();
    this.renderWelcomeMessage();

    // 입력창에 포커스만 이동
    const input = document.getElementById('gamlini-input');
    if (input) {
      input.focus();
    }

    console.log('✅ 현재 문제 로드 완료:', questionData.question.substring(0, 50) + '...');
  }

  /**
   * Context 정보 업데이트
   */
  updateContextInfo() {
    const contextInfo = document.getElementById('gamlini-context-info');

    console.log('🔍 [updateContextInfo] currentSession:', this.currentSession);

    if (!this.currentSession) {
      console.log('⚠️ [updateContextInfo] currentSession이 없음 → 일반 대화 모드');
      contextInfo.innerHTML = '<div class="context-badge">💬 일반 대화 모드</div>';
      return;
    }

    const { questionData, examCase } = this.currentSession;
    const type = questionData?.type || '';

    console.log('🔍 [updateContextInfo] questionData:', questionData);
    console.log('🔍 [updateContextInfo] examCase:', examCase);
    console.log('🔍 [updateContextInfo] type:', type);

    // 모드에 따라 표시
    if (type === 'Standards' || type === 'Rule') {
      console.log('✅ [updateContextInfo] 기준서 모드');
      contextInfo.innerHTML = '<div class="context-badge">📚 기준서 질의</div>';
    } else if (type === 'General') {
      console.log('✅ [updateContextInfo] 일반 모드');
      contextInfo.innerHTML = '<div class="context-badge">💬 일반 대화 모드</div>';
    } else {
      // Exam 모드
      const topic = examCase?.topic || '시험 문제';
      console.log('✅ [updateContextInfo] Exam 모드, topic:', topic);
      contextInfo.innerHTML = `<div class="context-badge">📝 ${topic}</div>`;
    }
  }

  /**
   * Preset 버튼 렌더링
   */
  // renderPresetButtons() 제거 - 이제 정적 토글 버튼 사용

  /**
   * 환영 메시지 렌더링
   */
  renderWelcomeMessage() {
    const messagesContainer = document.getElementById('gamlini-messages');
    messagesContainer.innerHTML = `
      <div class="gamlini-welcome">
        <div class="welcome-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="64" height="64">
            <rect width="100" height="100" rx="20" fill="#6D28D9"/>
            <rect x="20" y="20" width="60" height="60" rx="10" fill="white"/>
            <circle cx="36" cy="43" r="9" fill="#8B5CF6"/>
            <text x="36" y="46" font-size="14" fill="white" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="900" text-anchor="middle" dominant-baseline="central">ㄱ</text>
            <g transform="translate(64, 43)">
              <path d="M0 0 L 4 10 L 14 14 L 4 18 L 0 28 L -4 18 L -14 14 L -4 10 Z" fill="#FACC15" transform="scale(0.8) translate(0, -14)"/>
            </g>
            <path d="M30 60 H 70 V 72 H 30 Z M35 60 V 72 M 40 60 V 72 M 45 60 V 72 M 50 60 V 72 M 55 60 V 72 M 60 60 V 72 M 65 60 V 72" fill="none" stroke="#4F46E5" stroke-width="2"/>
          </svg>
        </div>
        <h3>안녕하세요, 감린이입니다!</h3>
        <p>이 문제에 대해 궁금한 점을 자유롭게 물어보세요.</p>
        <p class="welcome-hint">💡 위의 버튼을 눌러 빠르게 시작할 수 있어요</p>
      </div>
    `;
  }

  /**
   * 메시지 초기화
   */
  clearMessages() {
    const messagesContainer = document.getElementById('gamlini-messages');
    messagesContainer.innerHTML = '';
  }

  /**
   * 메시지 렌더링
   */
  renderMessages() {
    if (!this.currentSession) return;

    const messagesContainer = document.getElementById('gamlini-messages');
    const history = this.currentSession.getHistory();

    if (history.length === 0) {
      this.renderWelcomeMessage();
      return;
    }

    messagesContainer.innerHTML = history.map(msg => {
      const roleClass = msg.role === 'user' ? 'message-user' : 'message-assistant';
      return `
        <div class="message ${roleClass}">
          <div class="message-bubble">${this.escapeHtml(msg.content)}</div>
        </div>
      `;
    }).join('');

    // 스크롤 최하단
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * 메시지 전송
   */
  async sendMessage() {
    const input = document.getElementById('gamlini-input');
    const sendBtn = document.getElementById('gamlini-send');
    const modelSelect = document.getElementById('gamlini-model-select');
    const userQuestion = input.value.trim();
    const selectedModel = modelSelect.value || 'gemini-2.5-flash';

    if (!userQuestion || !this.currentSession) return;

    console.log('메시지 전송 시작:', {
      question: userQuestion,
      model: selectedModel,
      hasApiKey: !!this.apiKey,
      apiKeyPreview: this.apiKey?.substring(0, 10) + '...',
      hasSession: !!this.currentSession
    });

    // 입력창 초기화 및 비활성화
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    modelSelect.disabled = true;

    // 사용자 메시지 추가
    this.addMessage('user', userQuestion);

    // 로딩 메시지 추가
    this.addLoadingMessage();

    try {
      // API 키 재확인 (localStorage에서 매번 다시 읽기)
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) {
        throw new Error('API 키가 설정되지 않았습니다. 설정 > API 키에서 다시 설정해주세요.');
      }

      // this.apiKey 업데이트
      this.apiKey = apiKey;

      console.log('API 키 재확인 완료:', apiKey.substring(0, 10) + '...');

      // AI 응답 받기 (선택된 모델 사용)
      const response = await this.currentSession.askQuestion(
        userQuestion,
        apiKey,
        selectedModel,
        true // RAG 활성화
      );

      console.log('AI 응답 받음:', response.substring(0, 100) + '...');

      // 로딩 메시지 제거
      this.removeLoadingMessage();

      // AI 메시지 추가
      this.addMessage('assistant', response);

      // 대화 저장
      this.saveCurrentChat(userQuestion, response);
    } catch (error) {
      console.error('❌ [Gamlini Drawer] 메시지 전송 실패:', error);
      console.error('에러 상세:', error.message, error.stack);

      // 로딩 메시지 제거
      this.removeLoadingMessage();

      // 에러 메시지 분석 및 사용자 친화적 메시지 생성
      const errorMessage = error.message || String(error);
      let userMessage = '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다.';

      if (errorMessage.includes('[500]') || errorMessage.includes('internal error')) {
        userMessage += '\n\n**일시적인 서버 오류가 발생했습니다.**\n잠시 후 다시 시도해주세요. (자동으로 3회까지 재시도했지만 실패했습니다)';
      } else if (errorMessage.includes('API key')) {
        userMessage += '\n\n**API 키 오류입니다.**\n설정 > API 키에서 올바른 키를 입력했는지 확인해주세요.';
      } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        userMessage += '\n\n**API 사용량 한도 초과입니다.**\nGoogle Cloud Console에서 할당량을 확인해주세요.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
        userMessage += '\n\n**네트워크 오류가 발생했습니다.**\n인터넷 연결을 확인하고 다시 시도해주세요.';
      } else {
        userMessage += `\n\n에러: ${errorMessage}`;
      }

      this.addMessage('assistant', userMessage);
    } finally {
      // 입력창 재활성화
      input.disabled = false;
      sendBtn.disabled = false;
      modelSelect.disabled = false;
      input.focus();
    }
  }

  /**
   * Preset 질문 전송 (새로운 토글 방식)
   */
  async sendPresetQuestion(presetType) {
    if (!this.currentSession) return;

    const presetPrompts = {
      // 기본 프리셋 (퀴즈/일반용)
      original: '이 문제와 관련된 기준서의 원문을 자세히 설명해주세요.',
      trap: '이 문제에서 놓치기 쉬운 함정 포인트와 주의사항을 알려주세요.',
      example: '이 개념을 실무 사례를 통해 쉽게 이해할 수 있도록 설명해주세요.',
      opposite: '이 개념의 반대 상황이나 비교되는 개념을 설명해주세요.',

      // Exam 결과 전용 프리셋
      deduction: '내 답안에서 어떤 요건이 빠져서 감점된 건가요? 구체적으로 분석해주세요.',
      alternative: '만약 이렇게 썼다면 어땠을까요? 제 답안을 조금만 수정하면 만점을 받을 수 있는 방법을 알려주세요.',
      approach: '이 문제의 올바른 접근법과 핵심 논리를 단계별로 설명해주세요.',
      mnemonic: '이 문제의 핵심 키워드를 따서 암기하기 쉬운 코드나 암기법을 만들어주세요.',
      reasoning: '왜 이런 결론이 나오는지 논리적 근거를 단계별로 설명해주세요.'
    };

    const prompt = presetPrompts[presetType];
    if (!prompt) return;

    const input = document.getElementById('gamlini-input');
    const sendBtn = document.getElementById('gamlini-send');
    const modelSelect = document.getElementById('gamlini-model-select');
    const selectedModel = modelSelect.value || 'gemini-2.5-flash';

    // 입력창 비활성화
    input.disabled = true;
    sendBtn.disabled = true;
    modelSelect.disabled = true;

    // 사용자 메시지 추가
    this.addMessage('user', prompt);

    // 로딩 메시지 추가
    this.addLoadingMessage();

    try {
      // API 키 재확인 (localStorage에서 매번 다시 읽기)
      const apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) {
        throw new Error('API 키가 설정되지 않았습니다. 설정 > API 키에서 다시 설정해주세요.');
      }

      // this.apiKey 업데이트
      this.apiKey = apiKey;

      console.log('🔑 [Gamlini] 프리셋 버튼 - API 키 재확인 완료:', apiKey.substring(0, 10) + '...');

      // AI 응답 받기
      const response = await this.currentSession.askQuestion(
        prompt,
        apiKey,
        selectedModel,
        true // RAG 활성화
      );

      // 로딩 메시지 제거
      this.removeLoadingMessage();

      // AI 메시지 추가
      this.addMessage('assistant', response);
    } catch (error) {
      console.error('❌ [Gamlini Drawer] 프리셋 질문 전송 실패:', error);

      // 로딩 메시지 제거
      this.removeLoadingMessage();

      this.addMessage('assistant', '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다.');
    } finally {
      // 입력창 재활성화
      input.disabled = false;
      sendBtn.disabled = false;
      modelSelect.disabled = false;
      input.focus();
    }
  }

  /**
   * 로딩 메시지 추가
   */
  addLoadingMessage() {
    const messagesContainer = document.getElementById('gamlini-messages');

    // 환영 메시지 제거
    const welcome = messagesContainer.querySelector('.gamlini-welcome');
    if (welcome) welcome.remove();

    const loadingEl = document.createElement('div');
    loadingEl.className = 'message-loading';
    loadingEl.id = 'loading-message';
    loadingEl.innerHTML = `
      <div class="loading-bubble">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <span style="margin-left: 8px; color: #667eea; font-size: 13px;">생각 중...</span>
      </div>
    `;

    messagesContainer.appendChild(loadingEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * 로딩 메시지 제거
   */
  removeLoadingMessage() {
    const loadingEl = document.getElementById('loading-message');
    if (loadingEl) {
      loadingEl.remove();
    }
  }

  /**
   * 메시지 추가 (마크다운 지원)
   */
  addMessage(role, content) {
    const messagesContainer = document.getElementById('gamlini-messages');

    // 환영 메시지 제거
    const welcome = messagesContainer.querySelector('.gamlini-welcome');
    if (welcome) welcome.remove();

    const roleClass = role === 'user' ? 'message-user' : 'message-assistant';
    const messageEl = document.createElement('div');
    messageEl.className = `message ${roleClass}`;

    // AI 응답은 마크다운 렌더링, 사용자 메시지는 일반 텍스트
    const renderedContent = role === 'assistant'
      ? this.renderMarkdown(content)
      : this.escapeHtml(content);

    messageEl.innerHTML = `
      <div class="message-bubble">${renderedContent}</div>
    `;

    messagesContainer.appendChild(messageEl);

    // UX 개선: AI 답변 완료 시 질문과 답변 시작이 보이도록 스크롤
    if (role === 'assistant') {
      // 모든 메시지 요소들
      const allMessages = messagesContainer.querySelectorAll('.message');
      if (allMessages.length >= 2) {
        // 마지막 2개 메시지 = 사용자 질문 + AI 답변
        const userQuestion = allMessages[allMessages.length - 2];
        // 사용자 질문이 보이도록 스크롤 (부드럽게)
        userQuestion.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      // 사용자 메시지는 바로 스크롤 (기존 동작)
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * 간단한 마크다운 렌더러
   */
  renderMarkdown(text) {
    let html = this.escapeHtml(text);

    // 코드 블록 (```)
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // 인라인 코드 (`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 볼드 (**text** or __text__)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // 이탤릭 (*text* or _text_)
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // 헤딩 (# ## ###)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 리스트 (- item or * item)
    html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // 링크 ([text](url))
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // 줄바꿈
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  /**
   * History 렌더링
   */
  renderHistory() {
    const historyList = document.getElementById('history-list');
    const favBtn = document.getElementById('history-filter-favorites');
    const showOnlyFavorites = favBtn.classList.contains('active');

    let chats = chatStorage.loadAllChats();

    if (showOnlyFavorites) {
      chats = chats.filter(chat => chat.favorite);
    }

    if (chats.length === 0) {
      historyList.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
          <p>저장된 대화가 없습니다</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = chats.map(chat => `
      <div class="history-item" data-chat-id="${chat.id}">
        <div class="history-item-header">
          <div class="history-item-title">${this.escapeHtml(chat.title)}</div>
          <div class="history-item-actions">
            <div class="history-item-favorite" data-action="favorite" title="${chat.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
              ${chat.favorite ? '⭐' : '☆'}
            </div>
            <div class="history-item-delete" data-action="delete" title="삭제">
              ✕
            </div>
          </div>
        </div>
        <div class="history-item-meta">
          ${new Date(chat.createdAt).toLocaleString('ko-KR')} · ${chat.messages.length}개 메시지
        </div>
        <div class="history-item-tags">
          ${chat.tags.map(tag => `<span class="history-tag">${tag}</span>`).join('')}
        </div>
      </div>
    `).join('');

    // 이벤트 리스너
    historyList.querySelectorAll('.history-item').forEach(item => {
      const chatId = item.dataset.chatId;

      item.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'favorite') {
          e.stopPropagation();
          chatStorage.toggleFavorite(chatId);
          this.renderHistory();
        } else if (e.target.dataset.action === 'delete') {
          e.stopPropagation();
          this.deleteChatFromHistory(chatId);
        } else {
          this.loadChatFromHistory(chatId);
        }
      });
    });
  }

  /**
   * History 필터링
   */
  filterHistory(query) {
    if (!query.trim()) {
      this.renderHistory();
      return;
    }

    const favBtn = document.getElementById('history-filter-favorites');
    const showOnlyFavorites = favBtn?.classList.contains('active') || false;

    let results = chatStorage.searchChats(query);

    // 즐겨찾기 필터 적용
    if (showOnlyFavorites) {
      results = results.filter(chat => chat.favorite);
    }

    const historyList = document.getElementById('history-list');

    if (results.length === 0) {
      historyList.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <p>검색 결과가 없습니다</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = results.map(chat => `
      <div class="history-item" data-chat-id="${chat.id}">
        <div class="history-item-header">
          <div class="history-item-title">${this.escapeHtml(chat.title)}</div>
          <div class="history-item-actions">
            <div class="history-item-favorite" data-action="favorite" title="${chat.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
              ${chat.favorite ? '⭐' : '☆'}
            </div>
            <div class="history-item-delete" data-action="delete" title="삭제">
              ✕
            </div>
          </div>
        </div>
        <div class="history-item-meta">
          ${new Date(chat.createdAt).toLocaleString('ko-KR')} · ${chat.messages.length}개 메시지
        </div>
        <div class="history-item-tags">
          ${chat.tags.map(tag => `<span class="history-tag">${tag}</span>`).join('')}
        </div>
      </div>
    `).join('');

    // 검색 결과에도 이벤트 리스너 추가
    historyList.querySelectorAll('.history-item').forEach(item => {
      const chatId = item.dataset.chatId;

      item.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'favorite') {
          e.stopPropagation();
          chatStorage.toggleFavorite(chatId);
          this.filterHistory(query);
        } else if (e.target.dataset.action === 'delete') {
          e.stopPropagation();
          this.deleteChatFromHistory(chatId);
        } else {
          this.loadChatFromHistory(chatId);
        }
      });
    });
  }

  /**
   * 현재 대화 저장
   */
  saveCurrentChat(userQuestion, aiResponse) {
    if (!this.currentSession) return;

    const { questionData, examCase } = this.currentSession;
    const chatId = this.currentChatId || `chat_${Date.now()}`;

    // 첫 메시지면 새 채팅 생성
    if (!this.currentChatId) {
      this.currentChatId = chatId;
      const title = questionData?.question?.substring(0, 50) || examCase?.topic || '일반 대화';
      const tags = [];

      if (this.mode === 'exam') tags.push('시험 문제');
      else if (this.mode === 'standards') tags.push('기준서');
      else if (this.mode === 'general') tags.push('일반 대화');

      chatStorage.createChat(chatId, title, tags, this.currentSession);
    }

    // 메시지 추가
    chatStorage.addMessage(chatId, {
      role: 'user',
      content: userQuestion,
      timestamp: Date.now()
    });

    chatStorage.addMessage(chatId, {
      role: 'assistant',
      content: aiResponse,
      timestamp: Date.now()
    });

    console.log('✅ 대화 저장됨:', chatId);
  }

  /**
   * History에서 대화 불러오기
   */
  loadChatFromHistory(chatId) {
    const chat = chatStorage.loadChat(chatId);
    if (!chat) return;

    console.log('대화 불러오기:', chat);

    // 세션 복원
    this.currentSession = chat.session;
    this.currentChatId = chatId;
    this.mode = chat.session?.questionData?.type === 'Standards' ? 'standards' :
                chat.session?.questionData?.type === 'General' ? 'general' : 'exam';

    // Chat 탭으로 전환
    this.switchTab('chat');

    // UI 업데이트
    this.updateContextInfo();
    this.clearMessages();

    // 메시지 복원
    chat.messages.forEach(msg => {
      this.addMessage(msg.role, msg.content);
    });

    console.log('✅ 대화 복원 완료:', chat.title);
  }

  /**
   * History에서 대화 삭제
   */
  deleteChatFromHistory(chatId) {
    const chat = chatStorage.loadChat(chatId);
    if (!chat) return;

    // 삭제 확인
    const confirmDelete = confirm(`"${chat.title}" 대화를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmDelete) return;

    // 삭제 실행
    chatStorage.deleteChat(chatId);

    // 현재 열려있는 대화가 삭제된 대화인 경우 초기화
    if (this.currentChatId === chatId) {
      this.currentChatId = null;
      this.clearMessages();
      this.renderWelcomeMessage();
    }

    // 검색 중이면 검색 결과 갱신, 아니면 전체 목록 갱신
    const searchInput = document.getElementById('history-search');
    if (searchInput && searchInput.value.trim()) {
      this.filterHistory(searchInput.value);
    } else {
      this.renderHistory();
    }

    console.log('✅ 대화 삭제 완료:', chat.title);
  }

  /**
   * HTML 이스케이프
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 물음 선택 드롭다운 업데이트 (Exam 모드 전용)
   */
  updateQuestionSelector() {
    const selector = document.getElementById('gamlini-question-selector');
    const selectEl = document.getElementById('gamlini-question-select');

    if (!selector || !selectEl) return;

    // Exam 모드이고 전체 exam 데이터가 있을 때만 표시
    if (this.mode === 'exam' && this.allExams && this.allExams.length > 0) {
      selector.classList.remove('hidden');

      // 드롭다운 옵션 생성
      let optionsHtml = '<option value="">물음을 선택하세요...</option>';

      this.allExams.forEach((examCase, caseIdx) => {
        if (examCase.questions && examCase.questions.length > 0) {
          examCase.questions.forEach((q, qIdx) => {
            const qNum = q.id.replace(/^.*Q/i, ''); // "2025_Q1" -> "1"
            const selected = q.id === this.currentSession?.questionId ? 'selected' : '';
            optionsHtml += `<option value="${q.id}" ${selected}>물음 ${qNum}</option>`;
          });
        }
      });

      selectEl.innerHTML = optionsHtml;

      // 선택 변경 이벤트 리스너 (한 번만 등록)
      if (!selectEl._hasChangeListener) {
        selectEl._hasChangeListener = true;
        selectEl.addEventListener('change', (e) => {
          const selectedQuestionId = e.target.value;
          if (!selectedQuestionId) return;

          // 선택한 물음의 데이터 찾기
          let foundQuestion = null;
          let foundExamCase = null;

          for (const examCase of this.allExams) {
            for (const q of examCase.questions) {
              if (q.id === selectedQuestionId) {
                foundQuestion = q;
                foundExamCase = examCase;
                break;
              }
            }
            if (foundQuestion) break;
          }

          if (!foundQuestion) {
            console.error('❌ 선택한 물음을 찾을 수 없습니다:', selectedQuestionId);
            return;
          }

          // 새로운 세션으로 전환
          const userAnswer = this.allUserAnswers?.[selectedQuestionId]?.answer || '';
          const feedback = this.result?.details?.[selectedQuestionId];

          const newSession = getAiTutorSession(
            selectedQuestionId,
            foundQuestion,
            userAnswer,
            feedback,
            foundExamCase
          );

          this.currentSession = newSession;
          this.updateContextInfo();
          this.clearMessages();
          this.renderWelcomeMessage();
          this.updatePresetButtons();

          console.log('✅ [Gamlini] 물음 전환:', selectedQuestionId);
        });
      }
    } else {
      selector.classList.add('hidden');
    }
  }

  /**
   * Preset 버튼 동적 업데이트 (Exam 결과 화면용)
   */
  updatePresetButtons() {
    const presetsContainer = document.getElementById('gamlini-presets');
    if (!presetsContainer || !this.currentSession) return;

    // 기본 버튼들 (현재 문제, 기준서 원문 등)
    const defaultButtons = `
      <button class="preset-btn preset-btn-context" id="load-current-question">📝 현재 문제</button>
      <button class="preset-btn" data-preset="original">기준서 원문</button>
      <button class="preset-btn" data-preset="trap">함정 포인트</button>
      <button class="preset-btn" data-preset="example">사례로 이해</button>
      <button class="preset-btn" data-preset="opposite">반대 상황</button>
    `;

    // Exam 결과 화면인 경우 (feedback이 있는 경우)
    if (this.currentSession.feedback && typeof this.currentSession.getQuickQuestions === 'function') {
      const quickQuestions = this.currentSession.getQuickQuestions();
      const examButtons = quickQuestions.map(q => {
        const presetMap = {
          'detail-deduction': 'deduction',
          'alternative-answer': 'alternative',
          'correct-approach': 'approach',
          'memorization-tip': 'mnemonic',
          'reasoning-explanation': 'reasoning'
        };
        const presetId = presetMap[q.id] || q.id;
        return `<button class="preset-btn" data-preset="${presetId}">${q.icon} ${q.label}</button>`;
      }).join('');

      presetsContainer.innerHTML = defaultButtons + examButtons;
    } else {
      // 일반 모드는 기본 버튼만
      presetsContainer.innerHTML = defaultButtons;
    }

    // 이벤트 리스너 재등록
    this.reattachPresetEventListeners();
  }

  /**
   * Preset 버튼 이벤트 리스너 재등록 (flag 방식으로 중복 방지)
   */
  reattachPresetEventListeners() {
    const presetsContainer = document.getElementById('gamlini-presets');
    if (!presetsContainer) return;

    // 이미 리스너가 등록되어 있으면 스킵
    if (presetsContainer._hasPresetListener) return;
    presetsContainer._hasPresetListener = true;

    // 이벤트 위임: 컨테이너에 한 번만 등록
    presetsContainer.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      // 현재 문제 로드 버튼
      if (target.id === 'load-current-question') {
        this.loadCurrentQuestion();
        return;
      }

      // Preset 버튼
      if (target.dataset.preset) {
        const presetType = target.dataset.preset;
        this.sendPresetQuestion(presetType);
      }
    });
  }
}

// 싱글톤 인스턴스
let gamliniDrawer = null;

/**
 * Gamlini Drawer 초기화
 */
export function initializeGamliniDrawer() {
  if (!gamliniDrawer) {
    gamliniDrawer = new GamliniDrawer();
    gamliniDrawer.initialize();
  }
  return gamliniDrawer;
}

/**
 * Gamlini Drawer 열기 (시험 문제용)
 */
export function openGamliniDrawer(questionId, questionData, userAnswer, feedback, examCase, apiKey, allExams = null, allUserAnswers = null, result = null) {
  if (!gamliniDrawer) {
    gamliniDrawer = initializeGamliniDrawer();
  }

  const session = getAiTutorSession(questionId, questionData, userAnswer, feedback, examCase);
  gamliniDrawer.open(session, apiKey, allExams, allUserAnswers, result);
}

/**
 * Gamlini Drawer 인스턴스 가져오기
 */
export function getGamliniDrawer() {
  return gamliniDrawer;
}
