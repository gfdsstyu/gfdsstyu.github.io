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

// 코어
import * as DataManager from './core/dataManager.js';
import * as StorageManager from './core/storageManager.js';

// 유틸리티
import * as Helpers from './utils/helpers.js';

// UI
import { initElements, setElements, $ } from './ui/elements.js';
import * as DomUtils from './ui/domUtils.js';

// 서비스
import * as GeminiApi from './services/geminiApi.js';

// ========================================
// 임시 브릿지: index.html의 기존 코드가 새 모듈을 찾을 수 있도록
// (Phase 3에서 모든 로직이 이전되면 제거 예정)
// ========================================

// 전역으로 노출 (index.html의 기존 script에서 사용)
window.Config = Config;
window.DataManager = DataManager;
window.StorageManager = StorageManager;
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

// DataManager 함수들
window.loadQuestions = DataManager.loadQuestions;
window.validateData = DataManager.validateData;
window.selfTest = DataManager.selfTest;
window.getAllChapterNums = DataManager.getAllChapterNums;
window.populateChapterSelect = DataManager.populateChapterSelect;
window.filterByChapterSelection = DataManager.filterByChapterSelection;
window.filterByScore = DataManager.filterByScore;
window.filterBySource = DataManager.filterBySource;
window.detectSourceGroup = DataManager.detectSourceGroup;
window.getAllData = DataManager.getAllData;
window.setAllData = DataManager.setAllData;
window.getCurrentQuizData = DataManager.getCurrentQuizData;
window.setCurrentQuizData = DataManager.setCurrentQuizData;
window.getCurrentQuestionIndex = DataManager.getCurrentQuestionIndex;
window.setCurrentQuestionIndex = DataManager.setCurrentQuestionIndex;
window.getCurrentQuestion = DataManager.getCurrentQuestion;
window.findQuestionById = DataManager.findQuestionById;
window.findQuestionIndexById = DataManager.findQuestionIndexById;

// StorageManager 함수들
window.loadScores = StorageManager.loadScores;
window.saveScores = StorageManager.saveScores;
window.loadApiKey = StorageManager.loadApiKey;
window.saveApiKey = StorageManager.saveApiKey;
window.loadExamDate = StorageManager.loadExamDate;
window.saveExamDate = StorageManager.saveExamDate;
window.loadStatsDate = StorageManager.loadStatsDate;
window.saveStatsDate = StorageManager.saveStatsDate;
window.loadStatsView = StorageManager.loadStatsView;
window.saveStatsView = StorageManager.saveStatsView;
window.loadReadStore = StorageManager.loadReadStore;
window.saveReadStore = StorageManager.saveReadStore;
window.loadAchievements = StorageManager.loadAchievements;
window.saveAchievements = StorageManager.saveAchievements;
window.resetAllScores = StorageManager.resetAllScores;
window.exportAllData = StorageManager.exportAllData;
window.importAllData = StorageManager.importAllData;
window.migrateData = StorageManager.migrateData;
window.STORAGE_KEYS = StorageManager.STORAGE_KEYS;

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

  // DOM 엘리먼트 초기화
  const elements = initElements();
  setElements(elements);

  // 전역으로 el 객체 노출 (index.html의 기존 코드에서 사용)
  window.el = elements;

  console.log('✅ DOM 엘리먼트 초기화 완료');
  console.log('✅ 임시 브릿지 설정 완료 - index.html 기존 코드와 연동됨');

  // TODO: Phase 3에서 index.html의 모든 이벤트 리스너를 여기로 이전
  // 현재는 index.html의 기존 script 태그가 모든 로직을 처리함
});

console.log('✅ 감린이 v4.0 모듈 로드 완료');
console.log('📦 로드된 모듈:');
console.log('  - config/config.js (상수 및 설정)');
console.log('  - core/dataManager.js (데이터 관리)');
console.log('  - core/storageManager.js (Storage 관리)');
console.log('  - utils/helpers.js (유틸리티 함수)');
console.log('  - ui/elements.js (DOM 엘리먼트)');
console.log('  - ui/domUtils.js (DOM 유틸리티)');
console.log('  - services/geminiApi.js (Gemini API)');
