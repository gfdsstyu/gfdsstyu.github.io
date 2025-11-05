// ==========================================
// Data Manager Module
// ==========================================
// 문제 데이터 로딩, 검증, 필터링을 담당합니다.
// ==========================================

import { showToast } from '../ui/domUtils.js';
import { normId, isPartValue, parsePartValue, computePartRanges } from '../utils/helpers.js';
import { chapterLabelText } from '../config/config.js';

// ==========================================
// State
// ==========================================

// 모든 문제 데이터 (원본)
let allData = [];

// 현재 퀴즈에 사용 중인 데이터 (필터링된)
let currentQuizData = [];

// 현재 문제 인덱스
let currentQuestionIndex = 0;

// ==========================================
// Data Loading
// ==========================================

/**
 * Load questions from questions.json (with fallback to embedded data)
 * @param {Array} candidatePaths - Array of candidate file paths to try
 * @returns {Promise<Array>} - Loaded question data
 */
export async function loadQuestions(candidatePaths = ['questions.json']) {
  const errs = [];

  // Try each candidate path
  for (const path of candidatePaths) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) {
        errs.push(`${path}: HTTP ${res.status}`);
        continue;
      }

      const arr = await res.json();
      if (!Array.isArray(arr)) {
        errs.push(`${path}: JSON 최상위가 배열 아님`);
        continue;
      }

      // Validate required fields
      const need = ['고유ID', '단원', '물음', '정답'];
      const bad = arr.findIndex(r => !r || need.some(k => !(k in r)));
      if (bad !== -1) {
        errs.push(`${path}: 필수키 누락(index ${bad})`);
        continue;
      }

      // Success!
      allData = arr;
      console.info('[questions.json] loaded from', path);
      return arr;
    } catch (e) {
      errs.push(`${path}: ${e.message}`);
    }
  }

  // Fallback to embedded data
  try {
    const node = document.getElementById('dataset-json');
    if (!node) throw new Error('dataset-json 없음');

    const text = (node.textContent || '').trim();
    if (!text) throw new Error('내장 데이터 비어 있음');

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('내장 데이터 최상위가 배열 아님');
    }

    allData = parsed;
    console.warn('[questions.json] 모든 후보 실패. 내장 데이터로 폴백', errs);
    showToast('외부 DB 실패 → 내장 데이터 사용', 'warn');
    return parsed;
  } catch (err) {
    console.error('질문 데이터 로드 실패:', errs, err);
    showToast('문제 데이터 로드 실패: 콘솔 확인', 'error');
    throw new Error('문제 데이터 로드 실패 (questions.json 또는 dataset-json 확인).');
  }
}

/**
 * Validate loaded question data
 * @param {Array} data - Question data to validate
 * @returns {Object} - Validation result with warnings
 */
export function validateData(data = allData) {
  const result = {
    valid: true,
    missingFields: [],
    duplicateIds: [],
    warnings: []
  };

  // Check for missing required fields
  const miss = [];
  data.forEach((r, i) => {
    if (!(r && '고유ID' in r && '단원' in r && '물음' in r && '정답' in r)) {
      miss.push(i + 1);
    }
  });

  if (miss.length) {
    result.valid = false;
    result.missingFields = miss;
    result.warnings.push(`필수 필드 누락 ${miss.length}개`);
    showToast(`경고: 필수 필드 누락 ${miss.length}개`, 'warn');
  }

  // Check for duplicate IDs
  const seen = new Set();
  const dup = [];
  for (const r of data) {
    const k = String(r.고유ID).trim();
    if (seen.has(k)) {
      dup.push(k);
    } else {
      seen.add(k);
    }
  }

  if (dup.length) {
    result.valid = false;
    result.duplicateIds = dup;
    result.warnings.push(`중복 고유ID ${dup.length}개`);
    showToast(`경고: 중복 고유ID ${dup.length}개`, 'warn');
  }

  // Check for chapter data
  const uniqueChapters = new Set(data.map(r => String(r.단원).trim()));
  if (!uniqueChapters.size) {
    result.valid = false;
    result.warnings.push('단원 데이터 없음');
    throw new Error('단원 데이터 없음');
  }

  return result;
}

/**
 * Perform self-test on loaded data (legacy name for validateData)
 */
export function selfTest() {
  return validateData(allData);
}

// ==========================================
// Chapter Management
// ==========================================

/**
 * Get all unique chapter numbers from data
 * @param {Array} data - Question data (defaults to allData)
 * @returns {Array} - Sorted array of chapter numbers
 */
export function getAllChapterNums(data = allData) {
  return [...new Set(data.map(i => +i.단원).filter(Number.isFinite))].sort((a, b) => a - b);
}

/**
 * Populate chapter select dropdown with options
 * @param {HTMLSelectElement} selectElement - The select element to populate
 * @param {Array} data - Question data (defaults to allData)
 */
export function populateChapterSelect(selectElement, data = allData) {
  if (!selectElement) return;

  // Clear existing options (except first one - "전체 문제")
  while (selectElement.options.length > 1) {
    selectElement.remove(1);
  }

  const chNums = getAllChapterNums(data);
  const ranges = computePartRanges(chNums);

  // Add part options
  for (const [label, vals] of ranges) {
    const opt = document.createElement('option');
    opt.value = `part:${vals[0]}-${vals[vals.length - 1]}`;
    opt.textContent = chapterLabelText(label);
    selectElement.appendChild(opt);
  }

  // Add individual chapter options
  for (const ch of chNums) {
    const opt = document.createElement('option');
    opt.value = String(ch);
    opt.textContent = chapterLabelText(String(ch));
    selectElement.appendChild(opt);
  }
}

// ==========================================
// Filtering Functions
// ==========================================

/**
 * Filter questions by chapter selection
 * @param {Array} list - Question list to filter
 * @param {string} selection - Chapter selection value
 * @returns {Array} - Filtered question list
 */
export function filterByChapterSelection(list, selection) {
  if (!selection || selection === '') return list;

  // Handle part values (e.g., "part:1-10")
  if (isPartValue(selection)) {
    const pr = parsePartValue(selection);
    if (!pr) return list;
    return list.filter(q => {
      const n = +q.단원;
      return Number.isFinite(n) && n >= pr.start && n <= pr.end;
    });
  }

  // Handle individual chapter
  return list.filter(q => String(q.단원).trim() === String(selection));
}

/**
 * Filter questions by score criteria
 * @param {Array} list - Question list to filter
 * @param {string} filter - Filter type ('all', 'unanswered', '80', '60')
 * @param {Object} questionScores - Question scores object
 * @returns {Array} - Filtered question list
 */
export function filterByScore(list, filter, questionScores) {
  if (filter === 'all') return list;

  return list.filter(q => {
    const key = normId(q.고유ID);
    const s = questionScores[key];

    // 안푼문제: questionScores에 없거나, score가 null/undefined인 경우
    if (filter === 'unanswered') {
      return !s || s.score == null || s.score === undefined;
    }

    // 80점 미만: 점수가 없거나 80점 미만
    if (filter === '80') {
      return !s || s.score == null || s.score === undefined || +s.score < 80;
    }

    // 60점 미만: 점수가 없거나 60점 미만
    if (filter === '60') {
      return !s || s.score == null || s.score === undefined || +s.score < 60;
    }

    return true;
  });
}

/**
 * Filter questions by source group
 * @param {Array} list - Question list to filter
 * @param {Array} selectedGroups - Selected source groups
 * @param {Object} config - Configuration with BASIC_TAGS and ADV_TAGS
 * @returns {Array} - Filtered question list
 */
export function filterBySource(list, selectedGroups, config) {
  const { BASIC_TAGS, ADV_TAGS } = config;

  if (!selectedGroups || selectedGroups.length === 0 || selectedGroups.length === 3) {
    return list; // Show all if no filter or all filters selected
  }

  const selected = new Set(selectedGroups);

  return list.filter(q => {
    const src = String(q.출처 || '').toUpperCase();
    const tok = src.split(/\s*[;,\/\s]\s*/).filter(Boolean);

    const hasBasic = tok.some(t => BASIC_TAGS.includes(t));
    const hasAdv = tok.some(t => ADV_TAGS.includes(t));

    let group;
    if (hasBasic && !hasAdv) {
      group = 'basic';
    } else if (!hasBasic && hasAdv) {
      group = 'advanced';
    } else if (hasBasic && hasAdv) {
      // Both basic and advanced
      return selected.has('basic') || selected.has('advanced');
    } else {
      group = 'other';
    }

    return selected.has(group);
  });
}

/**
 * Detect source group for a question
 * @param {string} src - Source string
 * @param {Object} config - Configuration with BASIC_TAGS and ADV_TAGS
 * @returns {string} - Source group ('basic', 'advanced', 'basic-advanced', 'other')
 */
export function detectSourceGroup(src, config) {
  const { BASIC_TAGS, ADV_TAGS } = config;
  const s = String(src || '').toUpperCase();
  const tok = s.split(/\s*[;,\/\s]\s*/).filter(Boolean);

  const hasBasic = tok.some(t => BASIC_TAGS.includes(t));
  const hasAdv = tok.some(t => ADV_TAGS.includes(t));

  if (hasBasic && !hasAdv) return 'basic';
  if (!hasBasic && hasAdv) return 'advanced';
  if (hasBasic && hasAdv) return 'basic-advanced';
  return 'other';
}

// ==========================================
// State Management
// ==========================================

/**
 * Get all data (원본 데이터)
 * @returns {Array}
 */
export function getAllData() {
  return allData;
}

/**
 * Set all data (for testing or manual updates)
 * @param {Array} data
 */
export function setAllData(data) {
  allData = data;
}

/**
 * Get current quiz data (필터링된 데이터)
 * @returns {Array}
 */
export function getCurrentQuizData() {
  return currentQuizData;
}

/**
 * Set current quiz data
 * @param {Array} data
 */
export function setCurrentQuizData(data) {
  currentQuizData = data;
}

/**
 * Get current question index
 * @returns {number}
 */
export function getCurrentQuestionIndex() {
  return currentQuestionIndex;
}

/**
 * Set current question index
 * @param {number} index
 */
export function setCurrentQuestionIndex(index) {
  currentQuestionIndex = index;
}

/**
 * Get current question
 * @returns {Object|null}
 */
export function getCurrentQuestion() {
  if (currentQuizData.length === 0) return null;
  return currentQuizData[currentQuestionIndex];
}

/**
 * Navigate to next question
 * @returns {boolean} - Success status
 */
export function nextQuestion() {
  if (currentQuestionIndex < currentQuizData.length - 1) {
    currentQuestionIndex++;
    return true;
  }
  return false;
}

/**
 * Navigate to previous question
 * @returns {boolean} - Success status
 */
export function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    return true;
  }
  return false;
}

/**
 * Check if at first question
 * @returns {boolean}
 */
export function isFirstQuestion() {
  return currentQuestionIndex === 0;
}

/**
 * Check if at last question
 * @returns {boolean}
 */
export function isLastQuestion() {
  return currentQuestionIndex === currentQuizData.length - 1;
}

/**
 * Find question by ID in all data
 * @param {string} id - Question ID
 * @returns {Object|null} - Question object or null
 */
export function findQuestionById(id) {
  return allData.find(q => String(q.고유ID).trim() === String(id).trim());
}

/**
 * Find question index in current quiz data by ID
 * @param {string} id - Question ID
 * @returns {number} - Index or -1 if not found
 */
export function findQuestionIndexById(id) {
  return currentQuizData.findIndex(q => String(q.고유ID).trim() === String(id).trim());
}

// ==========================================
// Export all
// ==========================================

export default {
  // Loading
  loadQuestions,
  validateData,
  selfTest,
  // Chapter management
  getAllChapterNums,
  populateChapterSelect,
  // Filtering
  filterByChapterSelection,
  filterByScore,
  filterBySource,
  detectSourceGroup,
  // State getters/setters
  getAllData,
  setAllData,
  getCurrentQuizData,
  setCurrentQuizData,
  getCurrentQuestionIndex,
  setCurrentQuestionIndex,
  getCurrentQuestion,
  // Navigation
  nextQuestion,
  prevQuestion,
  isFirstQuestion,
  isLastQuestion,
  // Search
  findQuestionById,
  findQuestionIndexById,
};
