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

// 코어 - 상태 관리
import * as StateManager from './core/stateManager.js';

// 코어 - 데이터 관리
import * as DataManager from './core/dataManager.js';

// 코어 - 저장소 관리
import * as StorageManager from './core/storageManager.js';

// 기능 - 퀴즈 채점
import * as Grading from './features/quiz/grading.js';

// 기능 - 퀴즈 핵심
import * as QuizCore from './features/quiz/quizCore.js';

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
window.getCurrentQuizData = StateManager.getCurrentQuizData;
window.setCurrentQuizData = StateManager.setCurrentQuizData;
window.getCurrentQuestionIndex = StateManager.getCurrentQuestionIndex;
window.setCurrentQuestionIndex = StateManager.setCurrentQuestionIndex;
window.getQuestionScores = StateManager.getQuestionScores;
window.setQuestionScores = StateManager.setQuestionScores;
window.getGeminiApiKey = StateManager.getGeminiApiKey;
window.setGeminiApiKey = StateManager.setGeminiApiKey;
window.getSelectedAiModel = StateManager.getSelectedAiModel;
window.setSelectedAiModel = StateManager.setSelectedAiModel;
window.getDarkMode = StateManager.getDarkMode;
window.setDarkMode = StateManager.setDarkMode;
window.getActiveHintQuestionKey = StateManager.getActiveHintQuestionKey;
window.setActiveHintQuestionKey = StateManager.setActiveHintQuestionKey;
window.getPrevLoaded = StateManager.getPrevLoaded;
window.setPrevLoaded = StateManager.setPrevLoaded;
window.getSummaryViewMode = StateManager.getSummaryViewMode;
window.setSummaryViewMode = StateManager.setSummaryViewMode;
window.getStatsView = StateManager.getStatsView;
window.setStatsView = StateManager.setStatsView;
window.getIsFlashcardMode = StateManager.getIsFlashcardMode;
window.setIsFlashcardMode = StateManager.setIsFlashcardMode;

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
window.statsRefDate = StorageManager.statsRefDate; // 전역 변수로도 노출

// Grading (퀴즈 채점 및 힌트)
window.Grading = Grading;
window.handleGrade = Grading.handleGrade;
window.handleHint = Grading.handleHint;
window.showResult = Grading.showResult;
window.setGradeLoading = Grading.setGradeLoading;

// QuizCore (퀴즈 핵심 로직)
window.QuizCore = QuizCore;
window.displayQuestion = QuizCore.displayQuestion;
window.updateFlagButtonsUI = QuizCore.updateFlagButtonsUI;
window.reloadAndRefresh = QuizCore.reloadAndRefresh;
window.startRandomQuiz = QuizCore.startRandomQuiz;

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
console.log('  - core/stateManager.js (전역 상태 관리)');
console.log('  - core/dataManager.js (데이터 로드 및 관리)');
console.log('  - core/storageManager.js (저장소 및 마이그레이션)');
console.log('  - features/quiz/grading.js (채점 및 힌트)');
console.log('  - features/quiz/quizCore.js (퀴즈 핵심 로직)');
