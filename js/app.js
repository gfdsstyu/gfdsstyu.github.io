// ============================================
// 감린이 - 회계감사 학습 도우미 v4.0
// 메인 애플리케이션 엔트리 포인트
// ============================================

console.log('🚀 감린이 v4.0 Refactored App Loading...');

// ========================================
// 모듈 임포트
// ========================================

// 설정 및 상수
import * as Config from './config/config.js';

// 유틸리티
import * as Helpers from './utils/helpers.js';

// UI
import { initElements, setElements, $ } from './ui/elements.js';
import * as DomUtils from './ui/domUtils.js';

// 서비스
import * as GeminiApi from './services/geminiApi.js';
import * as DataImportExport from './services/dataImportExport.js';

// 코어 - 상태 관리
import * as StateManager from './core/stateManager.js';

// 코어 - 데이터 관리
import * as DataManager from './core/dataManager.js';

// 코어 - 저장소 관리
import * as StorageManager from './core/storageManager.js';

// 기능 - 퀴즈 시스템
import * as Grading from './features/quiz/grading.js';
import * as QuizCore from './features/quiz/quizCore.js';
import * as Navigation from './features/quiz/navigation.js';

// 기능 - 필터링 시스템
import * as Filter from './features/filter/filterCore.js';

// 기능 - 요약/대시보드
import * as Summary from './features/summary/summaryCore.js';

// 기능 - 캘린더/통계
import * as Calendar from './features/calendar/calendarCore.js';

// 기능 - 설정 관리
import * as Settings from './features/settings/settingsCore.js';

// ========================================
// 임시 브릿지: index.html의 기존 코드가 새 모듈을 찾을 수 있도록
// (Phase 3에서 모든 로직이 이전되면 제거 예정)
// ========================================

// 전역으로 노출 (index.html의 기존 script에서 사용)
window.Config = Config;
window.Helpers = Helpers;
window.DomUtils = DomUtils;
window.GeminiApi = GeminiApi;

// 개별 함수들도 전역으로 노출
window.$ = $;
window.clamp = Helpers.clamp;
window.normId = Helpers.normId;
window.sanitizeModelText = Helpers.sanitizeModelText;
window.ymd = Helpers.ymd;
window.dowMon0 = Helpers.dowMon0;
window.hslToHex = Helpers.hslToHex;
window.colorForCount = Helpers.colorForCount;
window.computePartRanges = Helpers.computePartRanges;

window.showToast = DomUtils.showToast;
window.getHeaderOffset = DomUtils.getHeaderOffset;
window.smoothScrollTo = DomUtils.smoothScrollTo;
window.elmTop = DomUtils.elmTop;
window.applyDarkMode = DomUtils.applyDarkMode;
window.watchSystemDarkMode = DomUtils.watchSystemDarkMode;
window.setLoading = DomUtils.setLoading;

window.callGeminiAPI = GeminiApi.callGeminiAPI;
window.callGeminiHintAPI = GeminiApi.callGeminiHintAPI;
window.callGeminiTextAPI = GeminiApi.callGeminiTextAPI;

// DataImportExport (데이터 Import/Export)
window.DataImportExport = DataImportExport;
window.mergeQuizScores = DataImportExport.mergeQuizScores;
window.exportData = DataImportExport.exportData;
window.importData = DataImportExport.importData;
window.mergeData = DataImportExport.mergeData;
window.initDataImportExport = DataImportExport.initDataImportExport;

// StateManager (전역 상태 관리)
window.StateManager = StateManager;
window.getState = StateManager.getState;
window.initializeState = StateManager.initializeState;
window.loadFromStorage = StateManager.loadFromStorage;
window.saveQuestionScores = StateManager.saveQuestionScores;
window.saveApiKey = StateManager.saveApiKey;
window.saveAiModel = StateManager.saveAiModel;
window.saveDarkModeToStorage = StateManager.saveDarkModeToStorage;
window.saveStatsView = StateManager.saveStatsView;
window.updateQuestionScore = StateManager.updateQuestionScore;
window.getQuestionScore = StateManager.getQuestionScore;

// StateManager getter/setter
window.getAllData = StateManager.getAllData;
window.setAllData = StateManager.setAllData;
// allData를 전역 변수로도 노출 (하위 호환성 - getFilteredByUI에서 사용)
Object.defineProperty(window, 'allData', {
  get: () => StateManager.getAllData(),
  set: (value) => StateManager.setAllData(value),
  configurable: true
});
window.getCurrentQuizData = StateManager.getCurrentQuizData;
window.setCurrentQuizData = StateManager.setCurrentQuizData;
// currentQuizData를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'currentQuizData', {
  get: () => StateManager.getCurrentQuizData(),
  set: (value) => StateManager.setCurrentQuizData(value),
  configurable: true
});
window.getCurrentQuestionIndex = StateManager.getCurrentQuestionIndex;
window.setCurrentQuestionIndex = StateManager.setCurrentQuestionIndex;
// currentQuestionIndex를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'currentQuestionIndex', {
  get: () => StateManager.getCurrentQuestionIndex(),
  set: (value) => StateManager.setCurrentQuestionIndex(value),
  configurable: true
});
window.getQuestionScores = StateManager.getQuestionScores;
window.setQuestionScores = StateManager.setQuestionScores;
// questionScores를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'questionScores', {
  get: () => StateManager.getQuestionScores(),
  set: (value) => StateManager.setQuestionScores(value),
  configurable: true
});
window.getGeminiApiKey = StateManager.getGeminiApiKey;
window.setGeminiApiKey = StateManager.setGeminiApiKey;
// geminiApiKey를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'geminiApiKey', {
  get: () => StateManager.getGeminiApiKey(),
  set: (value) => StateManager.setGeminiApiKey(value),
  configurable: true
});
window.getSelectedAiModel = StateManager.getSelectedAiModel;
window.setSelectedAiModel = StateManager.setSelectedAiModel;
// selectedAiModel를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'selectedAiModel', {
  get: () => StateManager.getSelectedAiModel(),
  set: (value) => StateManager.setSelectedAiModel(value),
  configurable: true
});
window.getDarkMode = StateManager.getDarkMode;
window.setDarkMode = StateManager.setDarkMode;
// darkMode를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'darkMode', {
  get: () => StateManager.getDarkMode(),
  set: (value) => StateManager.setDarkMode(value),
  configurable: true
});
window.getActiveHintQuestionKey = StateManager.getActiveHintQuestionKey;
window.setActiveHintQuestionKey = StateManager.setActiveHintQuestionKey;
// activeHintQuestionKey를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'activeHintQuestionKey', {
  get: () => StateManager.getActiveHintQuestionKey(),
  set: (value) => StateManager.setActiveHintQuestionKey(value),
  configurable: true
});
window.getPrevLoaded = StateManager.getPrevLoaded;
window.setPrevLoaded = StateManager.setPrevLoaded;
// prevLoaded를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'prevLoaded', {
  get: () => StateManager.getPrevLoaded(),
  set: (value) => StateManager.setPrevLoaded(value),
  configurable: true
});
window.getSummaryViewMode = StateManager.getSummaryViewMode;
window.setSummaryViewMode = StateManager.setSummaryViewMode;
// summaryViewMode를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'summaryViewMode', {
  get: () => StateManager.getSummaryViewMode(),
  set: (value) => StateManager.setSummaryViewMode(value),
  configurable: true
});
window.getStatsView = StateManager.getStatsView;
window.setStatsView = StateManager.setStatsView;
// statsView를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'statsView', {
  get: () => StateManager.getStatsView(),
  set: (value) => StateManager.setStatsView(value),
  configurable: true
});
window.getIsFlashcardMode = StateManager.getIsFlashcardMode;
window.setIsFlashcardMode = StateManager.setIsFlashcardMode;
// isFlashcardMode를 전역 변수로도 노출 (하위 호환성)
Object.defineProperty(window, 'isFlashcardMode', {
  get: () => StateManager.getIsFlashcardMode(),
  set: (value) => StateManager.setIsFlashcardMode(value),
  configurable: true
});

// DataManager (데이터 관리)
window.DataManager = DataManager;
window.getAllChapterNums = DataManager.getAllChapterNums;
window.loadData = DataManager.loadData;
window.selfTest = DataManager.selfTest;
window.populateChapterSelect = DataManager.populateChapterSelect;

// StorageManager (저장소 관리)
window.StorageManager = StorageManager;
window.initStatsDate = StorageManager.initStatsDate;
window.saveStatsDate = StorageManager.saveStatsDate;
window.loadExamDate = StorageManager.loadExamDate;
window.saveExamDate = StorageManager.saveExamDate;
window.calculateDDay = StorageManager.calculateDDay;
window.updateDDayDisplay = StorageManager.updateDDayDisplay;
window.migrateData = StorageManager.migrateData;
window.enforceExclusiveFlagsOnAll = StorageManager.enforceExclusiveFlagsOnAll;
window.setFlagState = StorageManager.setFlagState;
window.loadReadStore = StorageManager.loadReadStore;
window.saveReadStore = StorageManager.saveReadStore;
window.computeUniqueReadsFromHistory = StorageManager.computeUniqueReadsFromHistory;
window.backfillReadStoreFromScores = StorageManager.backfillReadStoreFromScores;
window.registerUniqueRead = StorageManager.registerUniqueRead;
window.getStatsRefDate = StorageManager.getStatsRefDate;
window.setStatsRefDate = StorageManager.setStatsRefDate;
// statsRefDate를 전역 변수로 노출 (Object.defineProperty 사용 - 하위 호환성)
// ⚠️ CRITICAL: StorageManager의 내부 변수와 동기화하기 위해 getter/setter 사용
Object.defineProperty(window, 'statsRefDate', {
  get: () => StorageManager.getStatsRefDate(),
  set: (value) => StorageManager.setStatsRefDate(value),
  configurable: true
});

// Grading (채점 및 힌트)
window.Grading = Grading;
window.setGradeLoading = Grading.setGradeLoading;
window.showResult = Grading.showResult;
window.handleGrade = Grading.handleGrade;
window.handleHint = Grading.handleHint;

// QuizCore (퀴즈 핵심 로직)
window.QuizCore = QuizCore;
window.updateFlagButtonsUI = QuizCore.updateFlagButtonsUI;
window.displayQuestion = QuizCore.displayQuestion;
window.reloadAndRefresh = QuizCore.reloadAndRefresh;
window.startRandomQuiz = QuizCore.startRandomQuiz;

// Navigation (네비게이션 및 포커스 모드)
window.Navigation = Navigation;
window.getCtrlNavState = Navigation.getCtrlNavState;
window.setCtrlNavState = Navigation.setCtrlNavState;
window.handlePrevQuestion = Navigation.handlePrevQuestion;
window.handleNextQuestion = Navigation.handleNextQuestion;
window.enterFocusMode = Navigation.enterFocusMode;
window.exitToDashboard = Navigation.exitToDashboard;
window.backFromFocus = Navigation.backFromFocus;
window.initKeyboardShortcuts = Navigation.initKeyboardShortcuts;

// Filter (필터링 시스템)
window.Filter = Filter;
window.buildSourceFilterUI = Filter.buildSourceFilterUI;
window.getSelectedSourceGroups = Filter.getSelectedSourceGroups;
window.detectSourceGroup = Filter.detectSourceGroup;
window.applySourceFilter = Filter.applySourceFilter;
window.filterByChapterSelection = Filter.filterByChapterSelection;
window.getFilteredByUI = Filter.getFilteredByUI;
window.getScopeFilteredData = Filter.getScopeFilteredData;
window.SOURCE_LS = Filter.SOURCE_LS;
window.BASIC_TAGS = Filter.BASIC_TAGS;
window.ADV_TAGS = Filter.ADV_TAGS;

// Summary (요약/대시보드)
window.Summary = Summary;
window.updateSummary = Summary.updateSummary;
window.updateSummaryHighlight = Summary.updateSummaryHighlight;
window.ensureResultBoxReady = Summary.ensureResultBoxReady;

// Calendar (캘린더/통계)
window.Calendar = Calendar;
window.renderCalendarMonth = Calendar.renderCalendarMonth;
window.bindCalendarDateClick = Calendar.bindCalendarDateClick;
window.renderStatsDateNav = Calendar.renderStatsDateNav;
window.renderStats = Calendar.renderStats;

// Settings (설정 관리)
window.Settings = Settings;
window.openApiModal = Settings.openApiModal;
window.closeApiModal = Settings.closeApiModal;
window.ensureApiKeyGate = Settings.ensureApiKeyGate;
window.openSettingsModal = Settings.openSettingsModal;
window.closeSettingsModal = Settings.closeSettingsModal;
window.initApiModalListeners = Settings.initApiModalListeners;
window.initSettingsModalListeners = Settings.initSettingsModalListeners;
window.initDDayListeners = Settings.initDDayListeners;
window.initGlobalEscapeHandler = Settings.initGlobalEscapeHandler;
window.initSettings = Settings.initSettings;

// 상수들
window.BASE_SYSTEM_PROMPT = Config.BASE_SYSTEM_PROMPT;
window.LITE_STRICT_ADDENDUM = Config.LITE_STRICT_ADDENDUM;
window.CHAPTER_LABELS = Config.CHAPTER_LABELS;
window.PART_INSERTIONS = Config.PART_INSERTIONS;
window.ACHIEVEMENTS = Config.ACHIEVEMENTS;
window.ACHIEVEMENTS_LS_KEY = Config.ACHIEVEMENTS_LS_KEY;
window.STATS_DATE_KEY = Config.STATS_DATE_KEY;
window.EXAM_DATE_KEY = Config.EXAM_DATE_KEY;
window.chapterLabelText = Config.chapterLabelText;
window.PART_VALUE = Config.PART_VALUE;
window.isPartValue = Config.isPartValue;
window.parsePartValue = Config.parsePartValue;

// ========================================
// 앱 초기화
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOMContentLoaded - Refactored app initialized');

  // 1. StateManager 초기화 (localStorage에서 데이터 로드)
  StateManager.initializeState();

  // 2. DOM 엘리먼트 초기화
  const elements = initElements();
  setElements(elements);

  // 3. 전역으로 el 객체 노출 (index.html의 기존 코드에서 사용)
  window.el = elements;
  StateManager.setElements(elements);

  console.log('✅ DOM 엘리먼트 초기화 완료');
  console.log('✅ 임시 브릿지 설정 완료 - index.html 기존 코드와 연동됨');

  // TODO: Phase 3에서 index.html의 모든 이벤트 리스너를 여기로 이전
  // 현재는 index.html의 기존 script 태그가 모든 로직을 처리함
});

console.log('✅ 감린이 v4.0 모듈 로드 완료');
console.log('📦 로드된 모듈:');
console.log('  - config/config.js (상수 및 설정)');
console.log('  - utils/helpers.js (유틸리티 함수)');
console.log('  - ui/elements.js (DOM 엘리먼트)');
console.log('  - ui/domUtils.js (DOM 유틸리티)');
console.log('  - services/geminiApi.js (Gemini API)');
console.log('  - services/dataImportExport.js (데이터 Import/Export)');
console.log('  - core/stateManager.js (전역 상태 관리)');
console.log('  - core/dataManager.js (데이터 로드 및 관리)');
console.log('  - core/storageManager.js (저장소 및 마이그레이션)');
console.log('  - features/quiz/grading.js (채점 및 힌트)');
console.log('  - features/quiz/quizCore.js (퀴즈 핵심 로직)');
console.log('  - features/quiz/navigation.js (네비게이션 및 키보드 단축키)');
console.log('  - features/filter/filterCore.js (필터링 시스템)');
console.log('  - features/summary/summaryCore.js (요약/대시보드)');
console.log('  - features/calendar/calendarCore.js (캘린더/통계)');
console.log('  - features/settings/settingsCore.js (설정 관리)');
