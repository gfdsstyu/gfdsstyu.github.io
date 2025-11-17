// ============================================
// 감린이 - 회계감사 학습 도우미 v4.0
// 메인 애플리케이션 엔트리 포인트
// ============================================
// ============================================
// 1. [신규] Firebase 연동 (로드맵 1단계)
// ============================================

// Firebase SDK 임포트 (NPM 방식이 아닌, 브라우저 CDN URL 방식입니다)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-analytics.js";

// 사장님이 제공해주신 Firebase 설정 객체
const firebaseConfig = {
  apiKey: "AIzaSyDS_tGZbWF3bUN3qKhg1ASPhYmiPZPQ8Bo",
  authDomain: "gamrini-24b1f.firebaseapp.com",
  projectId: "gamrini-24b1f",
  storageBucket: "gamrini-24b1f.firebasestorage.app",
  messagingSenderId: "789315789234",
  appId: "1:789315789234:web:745213c65219149d0b04ab",
  measurementId: "G-RX2G5VW9Y1"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 다른 모듈(랭킹, 인증)에서 사용할 수 있도록 주요 서비스 export
export const auth = getAuth(app); // 인증 기능
export const db = getFirestore(app); // Firestore DB 기능
export const analytics = getAnalytics(app); // 애널리틱스

console.log('🔥 Firebase Initialized (v10+ SDK)');


// ============================================
// (기존) 감린이 - 회계감사 학습 도우미 v4.0
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
import * as HeaderScroll from './ui/headerScroll.js';

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

// 기능 - 리포트 시스템
import * as ReportCore from './features/report/reportCore.js';
import * as Charts from './features/report/charts.js';
import * as Analysis from './features/report/analysis.js';

// 기능 - 플래시카드 시스템
import * as Flashcard from './features/flashcard/flashcardCore.js';

// 기능 - 업적 시스템
import * as Achievements from './features/achievements/achievementsCore.js';

// 기능 - 문제 탐색기
import * as Explorer from './features/explorer/explorerCore.js';

// 기능 - 복습 시스템 (HLR)
import * as HLRDataset from './features/review/hlrDataset.js';
import * as ReviewCore from './features/review/reviewCore.js';
import * as DifficultyTracker from './features/review/difficultyTracker.js';

// 기능 - STT (음성 인식)
import * as GoogleSttApi from './services/googleSttApi.js';
import * as WebSpeechApi from './services/webSpeechApi.js';
import * as SttHandler from './features/stt/sttHandler.js';
import * as SttVocabulary from './features/stt/sttVocabulary.js';

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

// Phase 6.1: showToast, closeDrawer removed (direct import in modules)
window.getHeaderOffset = DomUtils.getHeaderOffset;
window.smoothScrollTo = DomUtils.smoothScrollTo;
window.openDrawer = DomUtils.openDrawer;
window.initUIListeners = DomUtils.initUIListeners;
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
window.initQuizListeners = QuizCore.initQuizListeners;
window.initQuizEventListeners = QuizCore.initQuizEventListeners;

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
window.initFilterListeners = Filter.initFilterListeners;
window.SOURCE_LS = Filter.SOURCE_LS;
window.BASIC_TAGS = Filter.BASIC_TAGS;
window.ADV_TAGS = Filter.ADV_TAGS;

// Summary (요약/대시보드)
window.Summary = Summary;
// Phase 6.4.3: updateSummary, updateSummaryHighlight removed (direct import in modules)
window.ensureResultBoxReady = Summary.ensureResultBoxReady;
window.initSummaryListeners = Summary.initSummaryListeners;

// Calendar (캘린더/통계)
window.Calendar = Calendar;
window.renderCalendarMonth = Calendar.renderCalendarMonth;
window.bindCalendarDateClick = Calendar.bindCalendarDateClick;
window.renderStatsDateNav = Calendar.renderStatsDateNav;
window.renderStats = Calendar.renderStats;
window.initCalendarListeners = Calendar.initCalendarListeners;

// Settings (설정 관리)
window.Settings = Settings;
// Phase 6.1: openApiModal removed (direct import in modules)
window.closeApiModal = Settings.closeApiModal;
window.ensureApiKeyGate = Settings.ensureApiKeyGate;
window.openSettingsModal = Settings.openSettingsModal;
window.closeSettingsModal = Settings.closeSettingsModal;
window.initApiModalListeners = Settings.initApiModalListeners;
window.initSettingsModalListeners = Settings.initSettingsModalListeners;
window.initDDayListeners = Settings.initDDayListeners;
window.initGlobalEscapeHandler = Settings.initGlobalEscapeHandler;
window.initSettings = Settings.initSettings;
window.initSettingsListeners = Settings.initSettingsListeners;

// ReportCore (리포트 모달 및 데이터 처리)
window.ReportCore = ReportCore;
window.openReportModal = ReportCore.openReportModal;
// Phase 6.1: closeReportModal removed (direct import in modules)
window.switchReportTab = ReportCore.switchReportTab;
window.getReportData = ReportCore.getReportData;
window.generateReport = ReportCore.generateReport;
window.renderActionPlan = ReportCore.renderActionPlan;
window.initReportListeners = ReportCore.initReportListeners;

// Charts (리포트 차트 렌더링)
window.Charts = Charts;
window.renderDailyVolumeChart = Charts.renderDailyVolumeChart;
window.renderScoreTrendChart = Charts.renderScoreTrendChart;
window.renderChapterWeaknessChart = Charts.renderChapterWeaknessChart;
window.showChapterDetail = Charts.showChapterDetail;

// Analysis (AI 분석)
window.Analysis = Analysis;
window.startAIAnalysis = Analysis.startAIAnalysis;
window.copyAIAnalysis = Analysis.copyAIAnalysis;
window.initAIAnalysisListeners = Analysis.initAIAnalysisListeners;

// Flashcard (플래시카드 시스템)
window.Flashcard = Flashcard;
window.startFlashcardMode = Flashcard.startFlashcardMode;
window.refreshFlashcardData = Flashcard.refreshFlashcardData;
window.displayFlashcard = Flashcard.displayFlashcard;
window.toggleFlashcardAnswer = Flashcard.toggleFlashcardAnswer;
window.showFlashcardAnswer = Flashcard.showFlashcardAnswer;
window.hideFlashcardAnswer = Flashcard.hideFlashcardAnswer;
window.flashcardPrev = Flashcard.flashcardPrev;
window.flashcardNext = Flashcard.flashcardNext;
window.flashcardRandom = Flashcard.flashcardRandom;
window.jumpToFlashcard = Flashcard.jumpToFlashcard;
window.getCurrentFlashcardInfo = Flashcard.getCurrentFlashcardInfo;
window.exitFlashcardMode = Flashcard.exitFlashcardMode;
window.initFlashcardListeners = Flashcard.initFlashcardListeners;

// Achievements (업적 시스템)
window.Achievements = Achievements;
window.loadAchievements = Achievements.loadAchievements;
window.saveAchievements = Achievements.saveAchievements;
window.unlockAchievement = Achievements.unlockAchievement;
window.showAchievementNotification = Achievements.showAchievementNotification;
window.updateAchievementBadge = Achievements.updateAchievementBadge;
window.checkAchievements = Achievements.checkAchievements;
window.checkStreakAchievements = Achievements.checkStreakAchievements;
window.checkVolumeAchievements = Achievements.checkVolumeAchievements;
window.checkSourceAchievements = Achievements.checkSourceAchievements;
window.openAchievementsModal = Achievements.openAchievementsModal;
window.closeAchievementsModal = Achievements.closeAchievementsModal;
window.renderAchievements = Achievements.renderAchievements;
window.createAchievementCard = Achievements.createAchievementCard;
window.initAchievementListeners = Achievements.initAchievementListeners;

// Explorer (문제 탐색기)
window.Explorer = Explorer;
window.renderExplorer = Explorer.renderExplorer;
window.moveSourceFilterToSide = Explorer.moveSourceFilterToSide;
window.initExplorerListeners = Explorer.initExplorerListeners;

// HLR Dataset (복습 알고리즘 - 데이터셋)
window.HLRDataset = HLRDataset;
window.buildHLRDataset = HLRDataset.buildHLRDataset;
window.exportHLRDataset = HLRDataset.exportHLRDataset;
window.LocalHLRPredictor = HLRDataset.LocalHLRPredictor;
window.buildFeaturesForQID = HLRDataset.buildFeaturesForQID;
window.calculateRecallProbability = HLRDataset.calculateRecallProbability;

// HLR Predictor global instance (Enhanced with FSRS difficulty)
window.hlrPredictor = new HLRDataset.EnhancedHLRPredictor();

// Review Core (복습 전략)
window.ReviewCore = ReviewCore;
window.getReviewStrategy = ReviewCore.getReviewStrategy;
window.prioritizeTodayReview = (list) => ReviewCore.prioritizeTodayReview(list, window.hlrPredictor);
window.initReviewListeners = ReviewCore.initReviewListeners;

// STT (음성 인식)
window.transcribeGoogle = GoogleSttApi.transcribeGoogle;
window.isWebSpeechSupported = WebSpeechApi.isWebSpeechSupported;
window.startWebSpeechRecognition = WebSpeechApi.startRecognition;
window.stopWebSpeechRecognition = WebSpeechApi.stopRecognition;
window.initSttListeners = SttHandler.initSttListeners;
window.getBoostKeywords = SttVocabulary.getBoostKeywords;

// Wrapper for calculateRecallProbability that uses global predictor
window.calculateRecallProbability = (qid) => HLRDataset.calculateRecallProbability(qid, window.hlrPredictor);

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

// ============================================
// 2. [신규] Firebase Auth 모듈 임포트
// ============================================
import * as AuthCore from './features/auth/authCore.js';
import * as AuthUI from './features/auth/authUI.js';

// ============================================
// 3. [신규] Firebase Sync 모듈 임포트 (Phase 2)
// ============================================
import * as SyncCore from './features/sync/syncCore.js';

// 전역 노출 (디버깅 및 콘솔 접근용)
window.AuthCore = AuthCore;
window.AuthUI = AuthUI;
window.SyncCore = SyncCore;

// ========================================
// 앱 초기화
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOMContentLoaded - Refactored app initialized');

  // 1. StateManager 초기화 (localStorage에서 데이터 로드)
  StateManager.initializeState();

  // 2. Firebase 인증 초기화
  console.log('🔐 Firebase 인증 초기화 시작...');
  AuthCore.initAuthStateObserver(); // 인증 상태 관찰 시작
  AuthUI.initAuthUI(); // 인증 UI 초기화
  console.log('✅ Firebase 인증 초기화 완료');

  // 3. DOM 엘리먼트 초기화
  const elements = initElements();
  setElements(elements);

  // 4. 전역으로 el 객체 노출 (index.html의 기존 코드에서 사용)
  window.el = elements;
  StateManager.setElements(elements);

  // 5. 헤더 스크롤 제어 초기화
  HeaderScroll.initHeaderScroll();

  // 6. FSRS 난이도 추적 시스템 초기화
  DifficultyTracker.initDifficultySystem();

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
console.log('  - features/report/reportCore.js (리포트 모달 및 데이터 처리)');
console.log('  - features/report/charts.js (리포트 차트 렌더링)');
console.log('  - features/report/analysis.js (AI 분석)');
console.log('  - features/flashcard/flashcardCore.js (플래시카드 시스템)');
