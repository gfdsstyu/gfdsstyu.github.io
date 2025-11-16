// ============================================
// 감린이 v4.0 - 전역 상태 관리자
// ============================================

// ============================================
// 상태 객체 (모든 전역 변수를 여기서 관리)
// ============================================

const state = {
  // 데이터
  allData: [],
  currentQuizData: [],
  currentQuestionIndex: 0,
  questionScores: {},

  // API 및 설정
  geminiApiKey: '',
  selectedAiModel: 'gemini-2.5-flash',
  darkMode: 'system',

  // UI 상태
  activeHintQuestionKey: null,
  activeMemoryTipQuestionKey: null,
  prevLoaded: false,
  summaryViewMode: 'ALL',
  statsView: 'day',
  isFlashcardMode: false,

  // STT (음성 인식 설정)
  sttProvider: 'webspeech',
  googleSttKey: '',

  // DOM 요소 (initElements로 초기화됨)
  el: null
};

// ============================================
// Getter: 상태 읽기
// ============================================

/**
 * 전체 상태 객체 반환
 * @returns {Object} state
 */
export function getState() {
  return state;
}

/**
 * 특정 키의 값 반환
 * @param {string} key - 상태 키
 * @returns {*} 해당 키의 값
 */
export function get(key) {
  return state[key];
}

// 자주 사용하는 getter들
export const getAllData = () => state.allData;
export const getCurrentQuizData = () => state.currentQuizData;
export const getCurrentQuestionIndex = () => state.currentQuestionIndex;
export const getQuestionScores = () => state.questionScores;
export const getGeminiApiKey = () => state.geminiApiKey;
export const getSelectedAiModel = () => state.selectedAiModel;
export const getDarkMode = () => state.darkMode;
export const getActiveHintQuestionKey = () => state.activeHintQuestionKey;
export const getActiveMemoryTipQuestionKey = () => state.activeMemoryTipQuestionKey;
export const getPrevLoaded = () => state.prevLoaded;
export const getSummaryViewMode = () => state.summaryViewMode;
export const getStatsView = () => state.statsView;
export const getIsFlashcardMode = () => state.isFlashcardMode;
export const getSttProvider = () => state.sttProvider;
export const getGoogleSttKey = () => state.googleSttKey;
export const getElements = () => state.el;

// ============================================
// Setter: 상태 변경
// ============================================

/**
 * 특정 키의 값 설정
 * @param {string} key - 상태 키
 * @param {*} value - 설정할 값
 */
export function set(key, value) {
  state[key] = value;
}

/**
 * 여러 키를 한 번에 설정
 * @param {Object} updates - { key: value } 형태의 객체
 */
export function setMultiple(updates) {
  Object.entries(updates).forEach(([key, value]) => {
    state[key] = value;
  });
}

// 자주 사용하는 setter들
export const setAllData = (data) => { state.allData = data; };
export const setCurrentQuizData = (data) => { state.currentQuizData = data; };
export const setCurrentQuestionIndex = (index) => { state.currentQuestionIndex = index; };
export const setQuestionScores = (scores) => { state.questionScores = scores; };
export const setGeminiApiKey = (key) => { state.geminiApiKey = key; };
export const setSelectedAiModel = (model) => { state.selectedAiModel = model; };
export const setDarkMode = (mode) => { state.darkMode = mode; };
export const setActiveHintQuestionKey = (key) => { state.activeHintQuestionKey = key; };
export const setActiveMemoryTipQuestionKey = (key) => { state.activeMemoryTipQuestionKey = key; };
export const setPrevLoaded = (loaded) => { state.prevLoaded = loaded; };
export const setSummaryViewMode = (mode) => { state.summaryViewMode = mode; };
export const setStatsView = (view) => { state.statsView = view; };
export const setIsFlashcardMode = (mode) => { state.isFlashcardMode = mode; };
export const setSttProvider = (provider) => { state.sttProvider = provider; };
export const setGoogleSttKey = (key) => { state.googleSttKey = key; };
export const setElements = (elements) => { state.el = elements; };

// ============================================
// localStorage 통합 관리
// ============================================

const STORAGE_KEYS = {
  questionScores: 'auditQuizScores',
  geminiApiKeyLocal: 'geminiApiKey',
  geminiApiKeySession: 'geminiApiKey',
  selectedAiModel: 'aiModel',
  darkMode: 'darkMode',
  statsView: 'statsView_v1',
  schemaVersion: 'schemaVersion',

  // STT (음성 인식)
  sttProvider: 'sttProvider_v1',
  googleSttKey: 'googleSttKey_v1'
};

/**
 * localStorage에서 모든 상태 로드
 */
export function loadFromStorage() {
  try {
    // questionScores 로드
    const scoresData = localStorage.getItem(STORAGE_KEYS.questionScores);
    state.questionScores = scoresData ? JSON.parse(scoresData) : {};
  } catch (e) {
    console.error('questionScores 로드 실패:', e);
    state.questionScores = {};
    localStorage.removeItem(STORAGE_KEYS.questionScores);
  }

  // API 키 로드 (sessionStorage 우선, 없으면 localStorage)
  state.geminiApiKey =
    sessionStorage.getItem(STORAGE_KEYS.geminiApiKeySession) ||
    localStorage.getItem(STORAGE_KEYS.geminiApiKeyLocal) ||
    '';

  // AI 모델 설정 로드
  state.selectedAiModel = localStorage.getItem(STORAGE_KEYS.selectedAiModel) || 'gemini-2.5-flash';

  // 다크 모드 로드
  state.darkMode = localStorage.getItem(STORAGE_KEYS.darkMode) || 'system';

  // 통계 뷰 로드
  state.statsView = localStorage.getItem(STORAGE_KEYS.statsView) || 'day';

  // STT 설정 로드
  state.sttProvider = localStorage.getItem(STORAGE_KEYS.sttProvider) || 'webspeech';
  state.googleSttKey = localStorage.getItem(STORAGE_KEYS.googleSttKey) || '';
}

/**
 * questionScores를 localStorage에 저장
 */
export function saveQuestionScores() {
  try {
    localStorage.setItem(STORAGE_KEYS.questionScores, JSON.stringify(state.questionScores));
  } catch (e) {
    console.error('questionScores 저장 실패:', e);
    throw e;
  }
}

/**
 * STT 설정 저장
 */
export function saveSttSettings() {
  localStorage.setItem(STORAGE_KEYS.sttProvider, state.sttProvider);
  localStorage.setItem(STORAGE_KEYS.googleSttKey, state.googleSttKey);
}

/**
 * API 키 저장
 * @param {string} key - API 키
 * @param {boolean} remember - localStorage에도 저장할지 여부
 */
export function saveApiKey(key, remember = false) {
  state.geminiApiKey = key;
  sessionStorage.setItem(STORAGE_KEYS.geminiApiKeySession, key);

  if (remember) {
    localStorage.setItem(STORAGE_KEYS.geminiApiKeyLocal, key);
  } else {
    localStorage.removeItem(STORAGE_KEYS.geminiApiKeyLocal);
  }
}

/**
 * AI 모델 설정 저장
 * @param {string} model - AI 모델
 */
export function saveAiModel(model) {
  state.selectedAiModel = model;
  localStorage.setItem(STORAGE_KEYS.selectedAiModel, model);
}

/**
 * 다크 모드 설정 저장
 * @param {string} mode - 다크 모드 ('auto', 'dark', 'light')
 */
export function saveDarkModeToStorage(mode) {
  state.darkMode = mode;
  localStorage.setItem(STORAGE_KEYS.darkMode, mode);
}

/**
 * 통계 뷰 설정 저장
 * @param {string} view - 통계 뷰 ('day', 'week', 'month')
 */
export function saveStatsView(view) {
  state.statsView = view;
  localStorage.setItem(STORAGE_KEYS.statsView, view);
}

// ============================================
// 특정 questionScore 업데이트
// ============================================

/**
 * 특정 문제의 점수 업데이트 및 저장
 * @param {string} questionId - 문제 ID
 * @param {Object} scoreData - 점수 데이터
 */
export function updateQuestionScore(questionId, scoreData) {
  state.questionScores[questionId] = scoreData;
  saveQuestionScores();
}

/**
 * 특정 문제의 점수 데이터 반환
 * @param {string} questionId - 문제 ID
 * @returns {Object|undefined} 점수 데이터
 */
export function getQuestionScore(questionId) {
  return state.questionScores[questionId];
}

// ============================================
// 초기화
// ============================================

/**
 * 상태 관리자 초기화
 * localStorage에서 데이터 로드
 */
export function initializeState() {
  loadFromStorage();
  console.log('✅ StateManager initialized');
  console.log('  - questionScores:', Object.keys(state.questionScores).length, 'items');
  console.log('  - geminiApiKey:', state.geminiApiKey ? '***' : '(empty)');
  console.log('  - selectedAiModel:', state.selectedAiModel);
}

// ============================================
// 디버깅용
// ============================================

/**
 * 현재 상태를 콘솔에 출력 (디버깅용)
 */
export function debugState() {
  console.log('===== State Manager Debug =====');
  console.log('allData:', state.allData.length, 'items');
  console.log('currentQuizData:', state.currentQuizData.length, 'items');
  console.log('currentQuestionIndex:', state.currentQuestionIndex);
  console.log('questionScores:', Object.keys(state.questionScores).length, 'items');
  console.log('geminiApiKey:', state.geminiApiKey ? '***' : '(empty)');
  console.log('selectedAiModel:', state.selectedAiModel);
  console.log('darkMode:', state.darkMode);
  console.log('summaryViewMode:', state.summaryViewMode);
  console.log('isFlashcardMode:', state.isFlashcardMode);
  console.log('===============================');
}

// 전역에서 디버깅 함수 접근 가능하도록
if (typeof window !== 'undefined') {
  window.__debugState = debugState;
}
