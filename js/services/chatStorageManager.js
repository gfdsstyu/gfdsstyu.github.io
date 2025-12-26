/**
 * Chat Storage Manager - AI 튜터 대화 보관 시스템
 *
 * 기능:
 * - localStorage 기반 대화 저장
 * - 자동 네이밍 (문제 키워드 기반)
 * - 대화 복습 및 재개
 * - 즐겨찾기 및 검색
 */

const STORAGE_KEY = 'gamlini_chat_history';
const MAX_CHATS = 100; // 최대 보관 개수

/**
 * 대화 세션 데이터 구조
 * @typedef {Object} ChatSession
 * @property {string} id - 고유 ID (timestamp)
 * @property {string} title - 대화 제목
 * @property {string} questionId - 관련 문제 ID
 * @property {string} questionText - 문제 텍스트 (미리보기용)
 * @property {Array} messages - 대화 메시지 배열 [{role: 'user'|'assistant', content: string, timestamp: number}]
 * @property {number} createdAt - 생성 시간
 * @property {number} updatedAt - 마지막 업데이트 시간
 * @property {boolean} favorite - 즐겨찾기 여부
 * @property {string[]} tags - 태그 배열
 * @property {Object} metadata - 추가 메타데이터 (문제 정보 등)
 */

/**
 * 대화 제목 자동 생성
 * @param {string} questionText - 문제 텍스트
 * @param {Object} questionData - 문제 데이터
 * @returns {string} - 생성된 제목
 */
function generateChatTitle(questionText, questionData = {}) {
  // 문제 제목이 있으면 사용
  if (questionData.problemTitle) {
    return questionData.problemTitle;
  }

  // KSA 번호 추출 시도
  const ksaMatch = questionText.match(/KSA\s*(\d+)/i);
  if (ksaMatch) {
    return `KSA ${ksaMatch[1]} 관련 질문`;
  }

  // 주요 키워드 추출 (첫 30자)
  const preview = questionText.substring(0, 30).trim();
  return preview + (questionText.length > 30 ? '...' : '');
}

/**
 * 태그 자동 추출
 * @param {string} questionText - 문제 텍스트
 * @param {Object} questionData - 문제 데이터
 * @returns {string[]} - 태그 배열
 */
function extractTags(questionText, questionData = {}) {
  const tags = [];

  // 문제 유형 태그
  if (questionData.type) {
    tags.push(questionData.type);
  }

  // 주제 태그
  if (questionData.topic) {
    tags.push(questionData.topic);
  }

  // 키워드 태그
  if (questionData.keywords && Array.isArray(questionData.keywords)) {
    tags.push(...questionData.keywords.slice(0, 3)); // 상위 3개만
  }

  // KSA 번호 태그
  const ksaMatches = questionText.match(/KSA\s*\d+/gi);
  if (ksaMatches) {
    tags.push(...ksaMatches.map(m => m.replace(/\s+/g, ' ')));
  }

  return [...new Set(tags)]; // 중복 제거
}

/**
 * Chat Storage Manager 클래스
 */
export class ChatStorageManager {
  constructor() {
    this.storageKey = STORAGE_KEY;
  }

  /**
   * 모든 대화 세션 로드
   * @returns {ChatSession[]} - 대화 세션 배열
   */
  loadAllChats() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];

      const chats = JSON.parse(stored);
      // 최신순 정렬
      return chats.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('❌ [Chat Storage] 로드 실패:', error);
      return [];
    }
  }

  /**
   * 특정 대화 세션 로드
   * @param {string} chatId - 대화 ID
   * @returns {ChatSession|null} - 대화 세션
   */
  loadChat(chatId) {
    const chats = this.loadAllChats();
    return chats.find(chat => chat.id === chatId) || null;
  }

  /**
   * 새 대화 세션 생성
   * @param {string} questionId - 문제 ID
   * @param {string} questionText - 문제 텍스트
   * @param {Object} questionData - 문제 데이터
   * @returns {ChatSession} - 생성된 대화 세션
   */
  createChat(questionId, questionText, questionData = {}) {
    const now = Date.now();
    const chatId = `chat_${now}`;

    const newChat = {
      id: chatId,
      title: generateChatTitle(questionText, questionData),
      questionId,
      questionText: questionText.substring(0, 200), // 미리보기용 (200자)
      messages: [],
      createdAt: now,
      updatedAt: now,
      favorite: false,
      tags: extractTags(questionText, questionData),
      metadata: {
        questionData,
        examCase: questionData.examCase || null
      }
    };

    console.log('✅ [Chat Storage] 새 대화 생성:', chatId);
    return newChat;
  }

  /**
   * 대화에 메시지 추가
   * @param {string} chatId - 대화 ID
   * @param {string} role - 'user' | 'assistant'
   * @param {string} content - 메시지 내용
   * @returns {ChatSession|null} - 업데이트된 대화 세션
   */
  addMessage(chatId, role, content) {
    const chats = this.loadAllChats();
    const chat = chats.find(c => c.id === chatId);

    if (!chat) {
      console.warn('⚠️ [Chat Storage] 대화를 찾을 수 없음:', chatId);
      return null;
    }

    chat.messages.push({
      role,
      content,
      timestamp: Date.now()
    });

    chat.updatedAt = Date.now();

    this._saveChats(chats);
    console.log('✅ [Chat Storage] 메시지 추가:', chatId, role);
    return chat;
  }

  /**
   * 대화 세션 저장
   * @param {ChatSession} chat - 대화 세션
   * @returns {boolean} - 성공 여부
   */
  saveChat(chat) {
    try {
      const chats = this.loadAllChats();
      const index = chats.findIndex(c => c.id === chat.id);

      if (index >= 0) {
        // 기존 대화 업데이트
        chats[index] = { ...chat, updatedAt: Date.now() };
      } else {
        // 새 대화 추가
        chats.unshift(chat);

        // 최대 개수 초과 시 가장 오래된 대화 삭제 (즐겨찾기 제외)
        if (chats.length > MAX_CHATS) {
          const nonFavorites = chats.filter(c => !c.favorite);
          const favorites = chats.filter(c => c.favorite);

          if (nonFavorites.length > MAX_CHATS) {
            // 즐겨찾기가 아닌 것 중 오래된 것 삭제
            const toKeep = nonFavorites
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, MAX_CHATS - favorites.length);

            this._saveChats([...favorites, ...toKeep]);
            console.log('🗑️ [Chat Storage] 오래된 대화 삭제');
            return true;
          }
        }
      }

      this._saveChats(chats);
      console.log('✅ [Chat Storage] 대화 저장:', chat.id);
      return true;
    } catch (error) {
      console.error('❌ [Chat Storage] 저장 실패:', error);
      return false;
    }
  }

  /**
   * 대화 삭제
   * @param {string} chatId - 대화 ID
   * @returns {boolean} - 성공 여부
   */
  deleteChat(chatId) {
    try {
      const chats = this.loadAllChats();
      const filtered = chats.filter(c => c.id !== chatId);

      this._saveChats(filtered);
      console.log('✅ [Chat Storage] 대화 삭제:', chatId);
      return true;
    } catch (error) {
      console.error('❌ [Chat Storage] 삭제 실패:', error);
      return false;
    }
  }

  /**
   * 즐겨찾기 토글
   * @param {string} chatId - 대화 ID
   * @returns {boolean} - 업데이트된 즐겨찾기 상태
   */
  toggleFavorite(chatId) {
    const chats = this.loadAllChats();
    const chat = chats.find(c => c.id === chatId);

    if (!chat) return false;

    chat.favorite = !chat.favorite;
    chat.updatedAt = Date.now();

    this._saveChats(chats);
    console.log('✅ [Chat Storage] 즐겨찾기 토글:', chatId, chat.favorite);
    return chat.favorite;
  }

  /**
   * 대화 제목 변경
   * @param {string} chatId - 대화 ID
   * @param {string} newTitle - 새 제목
   * @returns {boolean} - 성공 여부
   */
  updateTitle(chatId, newTitle) {
    const chats = this.loadAllChats();
    const chat = chats.find(c => c.id === chatId);

    if (!chat) return false;

    chat.title = newTitle;
    chat.updatedAt = Date.now();

    this._saveChats(chats);
    console.log('✅ [Chat Storage] 제목 변경:', chatId, newTitle);
    return true;
  }

  /**
   * 대화 검색
   * @param {string} query - 검색어
   * @returns {ChatSession[]} - 검색 결과
   */
  searchChats(query) {
    if (!query || query.trim() === '') {
      return this.loadAllChats();
    }

    const normalizedQuery = query.toLowerCase();
    const chats = this.loadAllChats();

    return chats.filter(chat => {
      // 제목 검색
      if (chat.title.toLowerCase().includes(normalizedQuery)) return true;

      // 태그 검색
      if (chat.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))) return true;

      // 메시지 내용 검색
      if (chat.messages.some(msg => msg.content.toLowerCase().includes(normalizedQuery))) return true;

      return false;
    });
  }

  /**
   * 태그별 필터링
   * @param {string} tag - 태그
   * @returns {ChatSession[]} - 필터링된 대화
   */
  filterByTag(tag) {
    const chats = this.loadAllChats();
    return chats.filter(chat => chat.tags.includes(tag));
  }

  /**
   * 즐겨찾기만 조회
   * @returns {ChatSession[]} - 즐겨찾기 대화
   */
  getFavorites() {
    const chats = this.loadAllChats();
    return chats.filter(chat => chat.favorite);
  }

  /**
   * 통계 정보 조회
   * @returns {Object} - 통계 정보
   */
  getStats() {
    const chats = this.loadAllChats();

    return {
      totalChats: chats.length,
      favorites: chats.filter(c => c.favorite).length,
      totalMessages: chats.reduce((sum, c) => sum + c.messages.length, 0),
      oldestChat: chats.length > 0 ? Math.min(...chats.map(c => c.createdAt)) : null,
      newestChat: chats.length > 0 ? Math.max(...chats.map(c => c.createdAt)) : null
    };
  }

  /**
   * 전체 삭제
   * @returns {boolean} - 성공 여부
   */
  clearAll() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('✅ [Chat Storage] 전체 삭제');
      return true;
    } catch (error) {
      console.error('❌ [Chat Storage] 전체 삭제 실패:', error);
      return false;
    }
  }

  /**
   * 내부: localStorage에 저장
   * @private
   */
  _saveChats(chats) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(chats));
    } catch (error) {
      console.error('❌ [Chat Storage] localStorage 저장 실패:', error);
      throw error;
    }
  }

  /**
   * Export to JSON (백업용)
   * @returns {string} - JSON 문자열
   */
  exportToJSON() {
    const chats = this.loadAllChats();
    return JSON.stringify(chats, null, 2);
  }

  /**
   * Import from JSON (복원용)
   * @param {string} jsonString - JSON 문자열
   * @returns {boolean} - 성공 여부
   */
  importFromJSON(jsonString) {
    try {
      const chats = JSON.parse(jsonString);
      if (!Array.isArray(chats)) {
        throw new Error('Invalid format: expected array');
      }

      this._saveChats(chats);
      console.log('✅ [Chat Storage] JSON 복원 완료:', chats.length);
      return true;
    } catch (error) {
      console.error('❌ [Chat Storage] JSON 복원 실패:', error);
      return false;
    }
  }
}

// 싱글톤 인스턴스
export const chatStorage = new ChatStorageManager();

/**
 * 간편 사용 함수들
 */
export function saveConversation(questionId, questionText, messages, questionData = {}) {
  const chat = chatStorage.createChat(questionId, questionText, questionData);
  messages.forEach(msg => {
    chat.messages.push({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp || Date.now()
    });
  });
  return chatStorage.saveChat(chat);
}

export function loadConversation(chatId) {
  return chatStorage.loadChat(chatId);
}

export function getAllConversations() {
  return chatStorage.loadAllChats();
}
