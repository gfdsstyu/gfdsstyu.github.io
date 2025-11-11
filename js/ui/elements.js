// ============================================
// 감린이 v4.0 - DOM 엘리먼트 참조
// ============================================

/**
 * DOM 엘리먼트 가져오기 헬퍼
 */
export const $ = (id) => document.getElementById(id);

/**
 * 모든 주요 DOM 엘리먼트 참조 객체
 * DOMContentLoaded 이후에 초기화해야 함
 */
export function initElements() {
  return {
    // Toast
    toast: $('toast'),

    // API Modal
    apiModal: $('api-modal'),
    apiModalInput: $('api-modal-input'),
    apiModalRemember: $('modal-remember'),
    apiModalSaveBtn: $('api-save-btn'),
    apiModalCancelBtn: $('api-cancel-btn'),

    // Settings Modal
    settingsBtn: $('settings-btn'),
    settingsModal: $('settings-modal'),
    settingsCloseBtn: $('settings-close-btn'),
    settingsCloseBtnBottom: $('settings-close-btn-bottom'),
    openApiKeyModalBtn: $('open-api-key-modal-btn'),
    aiModelSelect: $('ai-model-select'),
    darkModeSelect: $('dark-mode-select'),

    // Data Import/Export
    exportDataBtn: $('export-data-btn'),
    importDataBtn: $('import-data-btn'),
    importFileInput: $('import-file-input'),
    mergeDataBtn: $('merge-data-btn'),
    mergeFileInput: $('merge-file-input'),

    // Quiz Controls
    chapterSelect: $('chapter-select'),
    filterSelect: $('filter-select'),
    loadQuizBtn: $('load-quiz-btn'),
    randomQuizBtn: $('random-quiz-btn'),

    // Quiz Area
    quizArea: $('quiz-area'),
    questionNumber: $('question-number'),
    questionText: $('question-text'),
    questionCounter: $('question-counter'),
    userAnswer: $('user-answer'),
    errorMessage: $('error-message'),

    // Quiz Navigation
    prevBtn: $('prev-btn'),
    nextBtn: $('next-btn'),
    gradeBtn: $('grade-btn'),
    gradeBtnText: $('grade-btn-text'),
    gradeLoader: $('grade-loader'),
    hintBtn: $('hint-btn'),
    hintBox: $('hint-container'),
    loadPrevAnswerBtn: $('load-prev-answer-btn'),

    // Result Display
    resultBox: $('result-box'),
    modelAnswerBox: $('model-answer-box'),  // ⚠️ CRITICAL: 모범답안 박스 추가
    score: $('score'),
    progressBar: $('progress-bar'),
    aiFeedback: $('ai-feedback'),
    correctAnswer: $('correct-answer'),

    // Summary Area
    summaryArea: $('summary-area'),
    scoreSummary: $('score-summary'),
    clearFilterBtn: $('clear-filter-btn'),
    resetScoresBtn: $('reset-scores-btn'),
    summaryViewAllBtn: $('summary-view-all'),
    summaryViewCurrentBtn: $('summary-view-current'),
    dbQuestionId: $('db-question-id'),

    // Layout
    fixedHeader: $('fixed-header'),
    layoutRoot: $('layout-root'),

    // Dashboard
    statsOverview: $('stats-overview'),
    reviewStrategySelect: $('review-strategy-select'),
    startReviewBtn: $('start-review-btn'),

    // Source Filter
    sourceFilterSide: $('source-filter-side'),
    sourceGroupFilter: $('source-group-filter'),

    // Explorer
    explorerChapters: $('explorer-chapters'),
    explorerProblems: $('explorer-problems'),
    explorerSearch: $('explorer-search'),
    reviewFlagToggle: $('review-flag-toggle'),
    reviewExcludeToggle: $('review-exclude-toggle'),

    // Mobile Menu
    hamburger: $('hamburger'),
    leftDashboard: $('left-dashboard'),
    drawerBackdrop: $('drawer-backdrop'),
    drawerClose: $('drawer-close'),

    // Calendar
    calPrev: $('cal-prev'),
    calNext: $('cal-next'),
    calTitle: $('cal-title'),
    calendarGrid: $('calendar-grid'),

    // Report Modal
    openReportBtn: $('open-report-btn'),
    reportModal: $('report-modal'),
    reportCloseBtn: $('report-close-btn'),
    reportPeriodSelect: $('report-period-select'),
    reportThresholdSelect: $('report-threshold-select'),
    chartScopeSelect: $('chart-scope-select'),
    reportRefreshBtn: $('report-refresh-btn'),
    reportSaveSnapshotBtn: $('report-save-snapshot-btn'),
    reportLoadSnapshotBtn: $('report-load-snapshot-btn'),
    reportLoadSnapshotInput: $('report-load-snapshot-input'),
    reportPrintBtn: $('report-print-btn'),

    // AI Analysis
    aiAnalysisStartBtn: $('ai-analysis-start-btn'),
    aiAnalysisResult: $('ai-analysis-result'),
    aiAnalysisLoading: $('ai-analysis-loading'),
    aiAnalysisCopyBtn: $('ai-analysis-copy-btn'),
    aiErrorPattern: $('ai-error-pattern'),
    aiConceptWeakness: $('ai-concept-weakness'),

    // Achievements
    openAchievementsBtn: $('open-achievements-btn'),
    achievementsModal: $('achievements-modal'),
    achievementsCloseBtn: $('achievements-close-btn'),
    achievementCountTotal: $('achievement-count-total'),
    achievementCountUnlocked: $('achievement-count-unlocked'),
    achievementProgressPercent: $('achievement-progress-percent'),
    achievementPoints: $('achievement-points'),
    achievementsList: $('achievements-list'),

    // Flashcard Mode
    flashcardModeBtn: $('flashcard-mode-btn'),
    flashcardArea: $('flashcard-area'),
    flashcardTitle: $('flashcard-title'),
    flashcardQuestion: $('flashcard-question'),
    flashcardToggleQuestion: $('flashcard-toggle-question'),
    flashcardQuestionArrow: $('flashcard-question-arrow'),
    flashcardQuestionBox: $('flashcard-question-box'),
    flashcardAnswer: $('flashcard-answer'),
    flashcardCounter: $('flashcard-counter'),
    flashcardToggleAnswer: $('flashcard-toggle-answer'),
    flashcardAnswerBox: $('flashcard-answer-box'),
    flashcardAnswerHidden: $('flashcard-answer-hidden'),
    flashcardPrevBtn: $('flashcard-prev-btn'),
    flashcardNextBtn: $('flashcard-next-btn'),
    flashcardRandomBtn: $('flashcard-random-btn'),
    flashcardExitBtn: $('flashcard-exit-btn'),

    // D-DAY
    ddayDisplay: $('dday-display'),
    examDateInput: $('exam-date-input'),
    saveExamDateBtn: $('save-exam-date-btn'),

    // STT (음성 인식)
    sttProviderSelect: $('stt-provider-select'),
    sttGoogleSettings: $('stt-google-settings'),
    googleSttKey: $('google-stt-key'),
    recordBtn: $('record-btn'),
    recordBtnText: $('record-btn-text'),
    recordIconMic: $('record-icon-mic')
  };
}

/**
 * 전역 el 객체 (나중에 initElements()로 초기화됨)
 */
export let el = null;

/**
 * el 객체를 초기화
 */
export function setElements(elements) {
  el = elements;
}
