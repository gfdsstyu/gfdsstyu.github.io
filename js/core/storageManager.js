// ==========================================
// Storage Manager Module
// ==========================================
// 모든 localStorage 작업을 중앙화하여 관리합니다.
// - 안전한 JSON 파싱/저장
// - 키 상수 중앙 관리
// - 에러 처리
// ==========================================

// ==========================================
// Storage Keys Constants
// ==========================================
export const STORAGE_KEYS = {
  // Core data
  QUIZ_SCORES: 'auditQuizScores',
  SCHEMA_VERSION: 'schemaVersion',

  // API & Settings
  GEMINI_API_KEY: 'geminiApiKey',
  AI_MODEL: 'aiModel',
  DARK_MODE: 'darkMode',

  // Date & Stats
  EXAM_DATE: 'examDate_v1',
  STATS_DATE: 'statsDate_v1',
  STATS_VIEW: 'statsView_v1',

  // Targets
  DAILY_TARGET: 'dailyTarget_v1',
  WEEKLY_TARGET: 'weeklyTarget_v1',
  MONTHLY_TARGET: 'monthlyTarget_v1',

  // Read sessions (회독)
  READ_SESSIONS: 'readSessions_v2',
  READ_STORE_BACKFILLED: 'readStoreBackfilled_v2',

  // Achievements
  ACHIEVEMENTS: 'achievements_v1',
  BEST_STREAK: 'bestStreak_v1',

  // Filters & UI State
  SOURCE_FILTER: 'sourceFilter_v1',
  REVIEW_STRATEGY: 'reviewStrategy_v1',
};

// ==========================================
// Generic Storage Utilities
// ==========================================

/**
 * Safely get item from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {string|null} - Stored value or default
 */
export function getItem(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    return value !== null ? value : defaultValue;
  } catch (error) {
    console.error(`Error getting localStorage item '${key}':`, error);
    return defaultValue;
  }
}

/**
 * Safely set item to localStorage
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 * @returns {boolean} - Success status
 */
export function setItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Error setting localStorage item '${key}':`, error);
    return false;
  }
}

/**
 * Remove item from localStorage
 * @param {string} key - Storage key
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing localStorage item '${key}':`, error);
  }
}

/**
 * Safely get JSON object from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or parse fails
 * @returns {*} - Parsed object or default
 */
export function getJSON(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return defaultValue;
    return JSON.parse(value);
  } catch (error) {
    console.error(`Error parsing JSON from localStorage '${key}':`, error);
    return defaultValue;
  }
}

/**
 * Safely set JSON object to localStorage
 * @param {string} key - Storage key
 * @param {*} value - Object to store
 * @returns {boolean} - Success status
 */
export function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error storing JSON to localStorage '${key}':`, error);
    return false;
  }
}

// ==========================================
// Quiz Scores Management
// ==========================================

/**
 * Load quiz scores from localStorage
 * @returns {Object} - Quiz scores object
 */
export function loadScores() {
  try {
    const scores = getJSON(STORAGE_KEYS.QUIZ_SCORES, {});
    return scores || {};
  } catch {
    // If parsing fails, remove corrupted data
    removeItem(STORAGE_KEYS.QUIZ_SCORES);
    return {};
  }
}

/**
 * Save quiz scores to localStorage
 * @param {Object} scores - Quiz scores object
 * @returns {boolean} - Success status
 */
export function saveScores(scores) {
  return setJSON(STORAGE_KEYS.QUIZ_SCORES, scores);
}

/**
 * Get schema version
 * @returns {string|null} - Schema version
 */
export function getSchemaVersion() {
  return getItem(STORAGE_KEYS.SCHEMA_VERSION);
}

/**
 * Set schema version
 * @param {string} version - Schema version
 */
export function setSchemaVersion(version) {
  setItem(STORAGE_KEYS.SCHEMA_VERSION, version);
}

// ==========================================
// API Key Management
// ==========================================

/**
 * Load Gemini API key from localStorage or sessionStorage
 * @returns {string} - API key
 */
export function loadApiKey() {
  return sessionStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) ||
         localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) ||
         '';
}

/**
 * Save Gemini API key
 * @param {string} key - API key
 * @param {boolean} remember - Whether to save to localStorage (true) or sessionStorage (false)
 */
export function saveApiKey(key, remember = false) {
  sessionStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, key);
  if (remember) {
    setItem(STORAGE_KEYS.GEMINI_API_KEY, key);
  } else {
    removeItem(STORAGE_KEYS.GEMINI_API_KEY);
  }
}

/**
 * Check if API key is remembered in localStorage
 * @returns {boolean}
 */
export function isApiKeyRemembered() {
  return !!localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY);
}

// ==========================================
// Settings Management
// ==========================================

/**
 * Load AI model setting
 * @returns {string} - AI model name
 */
export function loadAiModel() {
  return getItem(STORAGE_KEYS.AI_MODEL, 'gemini-2.5-flash');
}

/**
 * Save AI model setting
 * @param {string} model - AI model name
 */
export function saveAiModel(model) {
  setItem(STORAGE_KEYS.AI_MODEL, model);
}

/**
 * Load dark mode setting
 * @returns {string} - Dark mode setting ('light', 'dark', 'system')
 */
export function loadDarkMode() {
  return getItem(STORAGE_KEYS.DARK_MODE, 'system');
}

/**
 * Save dark mode setting
 * @param {string} mode - Dark mode setting
 */
export function saveDarkMode(mode) {
  setItem(STORAGE_KEYS.DARK_MODE, mode);
}

// ==========================================
// Exam Date Management (D-DAY)
// ==========================================

/**
 * Load exam date
 * @returns {string|null} - Exam date in YYYY-MM-DD format
 */
export function loadExamDate() {
  return getItem(STORAGE_KEYS.EXAM_DATE);
}

/**
 * Save exam date
 * @param {string} dateStr - Date in YYYY-MM-DD format
 */
export function saveExamDate(dateStr) {
  setItem(STORAGE_KEYS.EXAM_DATE, dateStr);
}

// ==========================================
// Stats Date Management
// ==========================================

/**
 * Load stats reference date
 * @returns {string|null} - Date in YYYY-MM-DD format
 */
export function loadStatsDate() {
  return getItem(STORAGE_KEYS.STATS_DATE);
}

/**
 * Save stats reference date
 * @param {Date} date - Date object
 */
export function saveStatsDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  setItem(STORAGE_KEYS.STATS_DATE, `${y}-${m}-${d}`);
}

/**
 * Load stats view mode
 * @returns {string} - View mode ('day', 'week', 'month')
 */
export function loadStatsView() {
  return getItem(STORAGE_KEYS.STATS_VIEW, 'day');
}

/**
 * Save stats view mode
 * @param {string} view - View mode
 */
export function saveStatsView(view) {
  setItem(STORAGE_KEYS.STATS_VIEW, view);
}

// ==========================================
// Target Management
// ==========================================

/**
 * Load daily target
 * @returns {number} - Daily target
 */
export function loadDailyTarget() {
  return parseInt(getItem(STORAGE_KEYS.DAILY_TARGET, '20'), 10);
}

/**
 * Save daily target
 * @param {number} target - Daily target
 */
export function saveDailyTarget(target) {
  setItem(STORAGE_KEYS.DAILY_TARGET, String(target));
}

/**
 * Load weekly target
 * @returns {number} - Weekly target
 */
export function loadWeeklyTarget() {
  const daily = loadDailyTarget();
  return parseInt(getItem(STORAGE_KEYS.WEEKLY_TARGET, String(daily * 7)), 10);
}

/**
 * Save weekly target
 * @param {number} target - Weekly target
 */
export function saveWeeklyTarget(target) {
  setItem(STORAGE_KEYS.WEEKLY_TARGET, String(target));
}

/**
 * Load monthly target
 * @returns {number} - Monthly target
 */
export function loadMonthlyTarget() {
  const daily = loadDailyTarget();
  return parseInt(getItem(STORAGE_KEYS.MONTHLY_TARGET, String(daily * 30)), 10);
}

/**
 * Save monthly target
 * @param {number} target - Monthly target
 */
export function saveMonthlyTarget(target) {
  setItem(STORAGE_KEYS.MONTHLY_TARGET, String(target));
}

/**
 * Initialize weekly and monthly targets if not set
 */
export function initializeTargets() {
  const daily = loadDailyTarget();
  if (!getItem(STORAGE_KEYS.WEEKLY_TARGET)) {
    saveWeeklyTarget(daily * 7);
  }
  if (!getItem(STORAGE_KEYS.MONTHLY_TARGET)) {
    saveMonthlyTarget(daily * 30);
  }
}

// ==========================================
// Read Sessions Management (회독)
// ==========================================

/**
 * Load read sessions data
 * @returns {Object} - Read sessions object
 */
export function loadReadStore() {
  return getJSON(STORAGE_KEYS.READ_SESSIONS, {});
}

/**
 * Save read sessions data
 * @param {Object} data - Read sessions object
 */
export function saveReadStore(data) {
  setJSON(STORAGE_KEYS.READ_SESSIONS, data);
}

/**
 * Check if read store has been backfilled
 * @returns {boolean}
 */
export function isReadStoreBackfilled() {
  return getItem(STORAGE_KEYS.READ_STORE_BACKFILLED) === '1';
}

/**
 * Mark read store as backfilled
 */
export function markReadStoreBackfilled() {
  setItem(STORAGE_KEYS.READ_STORE_BACKFILLED, '1');
}

// ==========================================
// Achievements Management
// ==========================================

/**
 * Load achievements data
 * @returns {Object} - Achievements object
 */
export function loadAchievements() {
  return getJSON(STORAGE_KEYS.ACHIEVEMENTS, {});
}

/**
 * Save achievements data
 * @param {Object} data - Achievements object
 */
export function saveAchievements(data) {
  setJSON(STORAGE_KEYS.ACHIEVEMENTS, data);
}

/**
 * Load best streak
 * @returns {number} - Best streak count
 */
export function loadBestStreak() {
  return parseInt(getItem(STORAGE_KEYS.BEST_STREAK, '0'), 10);
}

/**
 * Save best streak
 * @param {number} streak - Streak count
 */
export function saveBestStreak(streak) {
  setItem(STORAGE_KEYS.BEST_STREAK, String(streak));
}

// ==========================================
// Filter & UI State Management
// ==========================================

/**
 * Load source filter groups
 * @returns {Array} - Array of selected source groups
 */
export function loadSourceFilter() {
  return getJSON(STORAGE_KEYS.SOURCE_FILTER, ['basic', 'advanced', 'other']);
}

/**
 * Save source filter groups
 * @param {Array} groups - Array of source groups
 */
export function saveSourceFilter(groups) {
  setJSON(STORAGE_KEYS.SOURCE_FILTER, groups);
}

/**
 * Load review strategy
 * @returns {string} - Review strategy
 */
export function loadReviewStrategy() {
  return getItem(STORAGE_KEYS.REVIEW_STRATEGY, 'smart');
}

/**
 * Save review strategy
 * @param {string} strategy - Review strategy
 */
export function saveReviewStrategy(strategy) {
  setItem(STORAGE_KEYS.REVIEW_STRATEGY, strategy);
}

// ==========================================
// Bulk Operations
// ==========================================

/**
 * Reset all quiz scores and related data
 */
export function resetAllScores() {
  removeItem(STORAGE_KEYS.QUIZ_SCORES);
  removeItem(STORAGE_KEYS.SCHEMA_VERSION);
  removeItem(STORAGE_KEYS.READ_SESSIONS);
  removeItem(STORAGE_KEYS.READ_STORE_BACKFILLED);
}

/**
 * Export all data for backup
 * @param {Object} questionScores - Current quiz scores
 * @param {string} geminiApiKey - Current API key
 * @param {string} selectedAiModel - Current AI model
 * @param {string} darkMode - Current dark mode setting
 * @returns {Object} - Export data object
 */
export function exportAllData(questionScores, geminiApiKey, selectedAiModel, darkMode) {
  return {
    version: '3.x',
    schemaVersion: parseInt(getSchemaVersion() || '2', 10),
    exportDate: new Date().toISOString(),
    auditQuizScores: questionScores,
    geminiApiKey: geminiApiKey || getItem(STORAGE_KEYS.GEMINI_API_KEY) || '',
    aiModel: selectedAiModel,
    darkMode: darkMode
  };
}

/**
 * Import data from backup
 * @param {Object} data - Import data object
 * @returns {Object} - Imported data with applied values
 */
export function importAllData(data) {
  const result = {
    success: false,
    questionScores: {},
    geminiApiKey: '',
    aiModel: 'gemini-2.5-flash',
    darkMode: 'system'
  };

  try {
    if (!data.auditQuizScores) {
      throw new Error('올바른 백업 파일이 아닙니다.');
    }

    // Save quiz scores
    saveScores(data.auditQuizScores);
    result.questionScores = data.auditQuizScores;

    // Save API key if present
    if (data.geminiApiKey) {
      setItem(STORAGE_KEYS.GEMINI_API_KEY, data.geminiApiKey);
      result.geminiApiKey = data.geminiApiKey;
    }

    // Save AI model if present
    if (data.aiModel) {
      saveAiModel(data.aiModel);
      result.aiModel = data.aiModel;
    }

    // Save dark mode if present
    if (data.darkMode) {
      saveDarkMode(data.darkMode);
      result.darkMode = data.darkMode;
    }

    // Save schema version if present
    if (data.schemaVersion) {
      setSchemaVersion(String(data.schemaVersion));
    }

    result.success = true;
  } catch (error) {
    console.error('Import error:', error);
    result.error = error.message;
  }

  return result;
}

// ==========================================
// Data Migration
// ==========================================

/**
 * Migrate data to latest schema version
 * @param {Array} allData - All questions data for ID mapping
 * @param {Object} currentScores - Current quiz scores
 * @param {Function} showToast - Toast notification function
 * @returns {Object} - Migrated scores or current scores
 */
export function migrateData(allData, currentScores, showToast) {
  const version = getSchemaVersion();
  if (version === '2') return currentScores;

  try {
    const old = getItem(STORAGE_KEYS.QUIZ_SCORES);
    if (!old) {
      setSchemaVersion('2');
      return currentScores;
    }

    const parsed = JSON.parse(old);
    const newScores = {};
    const map = {};

    // Build ID mapping
    allData.forEach(q => {
      const disp = String(q.표시번호 ?? '').trim();
      const num = String(q.물음번호 ?? '').trim();
      if (disp) map[disp] = q.고유ID;
      if (num) map[num] = q.고유ID;
    });

    // Migrate each score
    Object.keys(parsed).forEach(k => {
      const nk = map[k] || k;
      const ov = parsed[k] || {};
      const hist = Array.isArray(ov.solveHistory)
        ? ov.solveHistory
        : (ov.score != null ? [{date: Date.now(), score: +ov.score || 0}] : []);

      newScores[nk] = {
        score: +(ov.score ?? 0),
        feedback: String(ov.feedback ?? ''),
        user_answer: String(ov.user_answer ?? ''),
        hintUsed: !!ov.hintUsed,
        isSolved: !!(ov.isSolved || (ov.score != null)),
        lastSolvedDate: +(ov.lastSolvedDate ?? (hist.at(-1)?.date || Date.now())),
        solveHistory: hist,
        userReviewFlag: !!ov.userReviewFlag,
        userReviewExclude: !!ov.userReviewExclude
      };
    });

    saveScores(newScores);
    setSchemaVersion('2');

    if (showToast) {
      showToast('데이터 마이그레이션 완료', 'info');
    }

    return newScores;
  } catch (e) {
    console.error('Migration error:', e);
    if (showToast) {
      showToast('마이그레이션 오류', 'error');
    }
    return currentScores;
  }
}

// ==========================================
// Export all functions for global bridge
// ==========================================
export default {
  STORAGE_KEYS,
  // Generic utilities
  getItem,
  setItem,
  removeItem,
  getJSON,
  setJSON,
  // Quiz scores
  loadScores,
  saveScores,
  getSchemaVersion,
  setSchemaVersion,
  // API key
  loadApiKey,
  saveApiKey,
  isApiKeyRemembered,
  // Settings
  loadAiModel,
  saveAiModel,
  loadDarkMode,
  saveDarkMode,
  // Exam date
  loadExamDate,
  saveExamDate,
  // Stats
  loadStatsDate,
  saveStatsDate,
  loadStatsView,
  saveStatsView,
  // Targets
  loadDailyTarget,
  saveDailyTarget,
  loadWeeklyTarget,
  saveWeeklyTarget,
  loadMonthlyTarget,
  saveMonthlyTarget,
  initializeTargets,
  // Read sessions
  loadReadStore,
  saveReadStore,
  isReadStoreBackfilled,
  markReadStoreBackfilled,
  // Achievements
  loadAchievements,
  saveAchievements,
  loadBestStreak,
  saveBestStreak,
  // Filters
  loadSourceFilter,
  saveSourceFilter,
  loadReviewStrategy,
  saveReviewStrategy,
  // Bulk operations
  resetAllScores,
  exportAllData,
  importAllData,
  migrateData,
};
