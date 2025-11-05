// ============================================
// 감린이 v4.0 - 저장소 관리
// ============================================

import { showToast } from '../ui/domUtils.js';
import { allData } from './dataManager.js';

// ============================================
// 상수
// ============================================

const SCORES_KEY = 'auditQuizScores';
const SCHEMA_VERSION_KEY = 'schemaVersion';
const API_KEY_SESSION = 'geminiApiKey';
const API_KEY_LOCAL = 'geminiApiKey';
const AI_MODEL_KEY = 'aiModel';
const DARK_MODE_KEY = 'darkMode';
export const EXAM_DATE_KEY = 'examDate';
const READ_STORE_KEY = 'readSessions_v2';
const READ_STORE_BACKFILLED_KEY = 'readStoreBackfilled_v2';
const UNIQUE_WINDOW_MS = 5 * 60 * 1000; // 5분

// ============================================
// 문제 점수 관리
// ============================================

/**
 * questionScores 로드
 * @returns {Object} questionScores 객체
 */
export function loadScores() {
  try {
    const data = localStorage.getItem(SCORES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    localStorage.removeItem(SCORES_KEY);
    return {};
  }
}

/**
 * questionScores 저장
 * @param {Object} scores - 저장할 scores 객체
 */
export function saveScores(scores) {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch (e) {
    console.error('점수 저장 실패:', e);
  }
}

// ============================================
// API 키 관리
// ============================================

/**
 * Gemini API 키 로드
 * @returns {string} API 키
 */
export function loadApiKey() {
  return sessionStorage.getItem(API_KEY_SESSION) || localStorage.getItem(API_KEY_LOCAL) || '';
}

/**
 * Gemini API 키 저장
 * @param {string} key - API 키
 * @param {boolean} remember - localStorage에 저장 여부
 */
export function saveApiKey(key, remember = false) {
  sessionStorage.setItem(API_KEY_SESSION, key);
  if (remember) {
    localStorage.setItem(API_KEY_LOCAL, key);
  } else {
    localStorage.removeItem(API_KEY_LOCAL);
  }
}

// ============================================
// 설정 관리
// ============================================

/**
 * AI 모델 설정 로드
 * @returns {string} AI 모델 이름
 */
export function loadAiModel() {
  return localStorage.getItem(AI_MODEL_KEY) || 'gemini-2.5-flash';
}

/**
 * AI 모델 설정 저장
 * @param {string} model - AI 모델 이름
 */
export function saveAiModel(model) {
  localStorage.setItem(AI_MODEL_KEY, model);
}

/**
 * 다크 모드 설정 로드
 * @returns {string} 다크 모드 설정 ('auto', 'dark', 'light')
 */
export function loadDarkMode() {
  return localStorage.getItem(DARK_MODE_KEY) || 'auto';
}

/**
 * 다크 모드 설정 저장
 * @param {string} mode - 다크 모드 설정
 */
export function saveDarkMode(mode) {
  localStorage.setItem(DARK_MODE_KEY, mode);
}

// ============================================
// 시험 날짜 관리
// ============================================

/**
 * 시험 날짜 로드
 * @returns {string} YYYY-MM-DD 형식의 날짜
 */
export function loadExamDate() {
  const saved = localStorage.getItem(EXAM_DATE_KEY);
  return saved || '2026-06-27'; // 기본값
}

/**
 * 시험 날짜 저장
 * @param {string} dateStr - YYYY-MM-DD 형식의 날짜
 */
export function saveExamDate(dateStr) {
  localStorage.setItem(EXAM_DATE_KEY, dateStr);
}

// ============================================
// 데이터 마이그레이션
// ============================================

/**
 * 스키마 버전 2로 데이터 마이그레이션
 * 표시번호/물음번호 → 고유ID 변환
 */
export function migrateData() {
  const version = localStorage.getItem(SCHEMA_VERSION_KEY);
  if (version === '2') return;

  try {
    const old = localStorage.getItem(SCORES_KEY);
    if (!old) {
      localStorage.setItem(SCHEMA_VERSION_KEY, '2');
      return;
    }

    const parsed = JSON.parse(old);
    const newScores = {};
    const map = {};

    // 표시번호/물음번호 → 고유ID 매핑 생성
    allData.forEach(q => {
      const disp = String(q.표시번호 ?? '').trim();
      const num = String(q.물음번호 ?? '').trim();
      if (disp) map[disp] = q.고유ID;
      if (num) map[num] = q.고유ID;
    });

    // 기존 데이터 변환
    Object.keys(parsed).forEach(k => {
      const nk = map[k] || k;
      const ov = parsed[k] || {};
      const hist = Array.isArray(ov.solveHistory)
        ? ov.solveHistory
        : (ov.score != null ? [{ date: Date.now(), score: +ov.score || 0 }] : []);

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

    localStorage.setItem(SCORES_KEY, JSON.stringify(newScores));
    localStorage.setItem(SCHEMA_VERSION_KEY, '2');
    showToast('데이터 마이그레이션 완료', 'info');
  } catch (e) {
    console.error('마이그레이션 오류:', e);
    showToast('마이그레이션 오류', 'error');
  }
}

// ============================================
// 플래그 상태 관리 (★ vs ➖ 상호배타)
// ============================================

/**
 * 모든 항목의 플래그 상태 정합성 보정
 * userReviewFlag (★)와 userReviewExclude (➖)가 동시에 true인 경우
 * 제외(➖) 우선 정책으로 플래그를 false로 변경
 * @param {Object} questionScores - 문제 점수 객체
 */
export function enforceExclusiveFlagsOnAll(questionScores) {
  let changed = 0;
  for (const [qid, rec] of Object.entries(questionScores || {})) {
    if (rec?.userReviewFlag && rec?.userReviewExclude) {
      rec.userReviewFlag = false;
      changed++;
    }
  }
  if (changed) {
    saveScores(questionScores);
  }
}

/**
 * 특정 문제의 플래그 상태 설정 (상호배타 적용)
 * @param {Object} questionScores - 문제 점수 객체
 * @param {string} qid - 문제 고유ID
 * @param {Object} options - { flag: boolean, exclude: boolean, silent: boolean }
 * @param {Function} refreshCallback - UI 갱신 콜백 (silent=false일 때 호출)
 */
export function setFlagState(questionScores, qid, { flag = false, exclude = false, silent = false }, refreshCallback) {
  const rec = questionScores[qid] || {};

  // 상호배타 적용
  if (exclude) flag = false;
  if (flag) exclude = false;

  questionScores[qid] = {
    ...rec,
    userReviewFlag: !!flag,
    userReviewExclude: !!exclude
  };

  saveScores(questionScores);

  if (!silent && refreshCallback) {
    refreshCallback(); // 좌/우 패널 동기화
  }
}

// ============================================
// 고유 읽기 추적 (Read Store)
// ============================================

/**
 * 읽기 세션 저장소 로드
 * @returns {Object} { qid: { uniqueReads: number, lastAt: timestamp } }
 */
export function loadReadStore() {
  try {
    const data = localStorage.getItem(READ_STORE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * 읽기 세션 저장소 저장
 * @param {Object} obj - 저장할 읽기 세션 객체
 */
export function saveReadStore(obj) {
  localStorage.setItem(READ_STORE_KEY, JSON.stringify(obj));
}

/**
 * solveHistory로부터 고유 읽기 횟수 계산
 * 5분 이내 연속 학습은 한 번으로 간주
 * @param {Array} history - solveHistory 배열
 * @returns {{ uniqueReads: number, lastAt: number }}
 */
export function computeUniqueReadsFromHistory(history) {
  const times = (Array.isArray(history) ? history : [])
    .map(x => +x?.date)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!times.length) return { uniqueReads: 0, lastAt: 0 };

  let count = 0;
  let last = -Infinity;

  for (const t of times) {
    if (t - last >= UNIQUE_WINDOW_MS) {
      count++;
      last = t;
    }
  }

  return { uniqueReads: count, lastAt: times.at(-1) };
}

/**
 * 기존 questionScores의 solveHistory로부터 readStore 역산 채우기
 * @param {Object} questionScores - 문제 점수 객체
 * @param {boolean} force - 강제 실행 여부
 */
export function backfillReadStoreFromScores(questionScores, force = false) {
  if (!force && localStorage.getItem(READ_STORE_BACKFILLED_KEY) === '1') return;

  const db = loadReadStore();
  let touched = 0;

  for (const [qid, rec] of Object.entries(questionScores || {})) {
    const hist = Array.isArray(rec?.solveHistory) ? rec.solveHistory : [];
    if (!hist.length) continue;

    const has = db[qid];
    if (!has || !Number.isFinite(+has.uniqueReads) || +has.uniqueReads === 0) {
      const seed = computeUniqueReadsFromHistory(hist);
      if (seed.uniqueReads > 0) {
        db[qid] = seed;
        touched++;
      }
    }
  }

  if (touched > 0) saveReadStore(db);
  localStorage.setItem(READ_STORE_BACKFILLED_KEY, '1');
}

/**
 * 고유 읽기 횟수 등록
 * 5분 이상 경과 시 uniqueReads 증가
 * @param {string} qid - 문제 고유ID
 * @param {Object} questionScores - 문제 점수 객체
 * @returns {{ increased: boolean, uniqueReads: number }}
 */
export function registerUniqueRead(qid, questionScores) {
  const t = Date.now();
  const db = loadReadStore();
  let rec = db[qid];

  if (!rec) {
    const hist = questionScores[qid]?.solveHistory;
    rec = Array.isArray(hist) && hist.length
      ? computeUniqueReadsFromHistory(hist)
      : { uniqueReads: 0, lastAt: 0 };
  }

  if (t - (rec.lastAt || 0) >= UNIQUE_WINDOW_MS) {
    rec.uniqueReads = (+rec.uniqueReads || 0) + 1;
    rec.lastAt = t;
    db[qid] = rec;
    saveReadStore(db);
    return { increased: true, uniqueReads: rec.uniqueReads };
  }

  rec.lastAt = t;
  db[qid] = rec;
  saveReadStore(db);
  return { increased: false, uniqueReads: rec.uniqueReads };
}
