// ============================================
// 감린이 v4.0 - 저장소 관리자
// 데이터 마이그레이션, 플래그 관리, 읽음 상태 등
// ============================================

import { getQuestionScores, setQuestionScores, saveQuestionScores, getAllData, getElements } from './stateManager.js';
import { showToast } from '../ui/domUtils.js';
import { STATS_DATE_KEY, EXAM_DATE_KEY } from '../config/config.js';

// ============================================
// 전역 변수 (statsRefDate, calRefDate - 나중에 StateManager로 이전 고려)
// ============================================

export let statsRefDate = new Date();
statsRefDate.setHours(0, 0, 0, 0);

export let calRefDate = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1); // 월의 첫날로 설정
  return d;
})();

// ============================================
// 통계 날짜 관리
// ============================================

/**
 * 통계 기준 날짜 초기화 (localStorage에서 로드)
 */
export function initStatsDate() {
  const saved = localStorage.getItem(STATS_DATE_KEY);
  if (saved) {
    const d = new Date(saved + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      statsRefDate = d;
      return;
    }
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  statsRefDate = now;
}

/**
 * 통계 기준 날짜 저장
 */
export function saveStatsDate() {
  const y = statsRefDate.getFullYear();
  const m = String(statsRefDate.getMonth() + 1).padStart(2, '0');
  const d = String(statsRefDate.getDate()).padStart(2, '0');
  localStorage.setItem(STATS_DATE_KEY, `${y}-${m}-${d}`);
}

// ============================================
// D-DAY (시험일) 관리
// ============================================

/**
 * 시험 날짜 로드
 * @returns {string} YYYY-MM-DD 형식의 시험 날짜
 */
export function loadExamDate() {
  const saved = localStorage.getItem(EXAM_DATE_KEY);
  if (saved) {
    return saved; // YYYY-MM-DD format
  }
  return '2026-06-27'; // 기본값
}

/**
 * 시험 날짜 저장
 * @param {string} dateStr - YYYY-MM-DD 형식의 날짜
 */
export function saveExamDate(dateStr) {
  localStorage.setItem(EXAM_DATE_KEY, dateStr);
}

/**
 * D-Day 계산
 * @param {string} examDateStr - YYYY-MM-DD 형식의 시험 날짜
 * @returns {number|null} D-Day 값 (양수: 남은 일수, 0: 당일, 음수: 지난 일수)
 */
export function calculateDDay(examDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const examDate = new Date(examDateStr + 'T00:00:00');
  if (isNaN(examDate.getTime())) {
    return null;
  }

  const diffTime = examDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * D-Day 표시 업데이트
 */
export function updateDDayDisplay() {
  const el = getElements();
  if (!el?.ddayDisplay) return;

  const examDate = loadExamDate();
  const dday = calculateDDay(examDate);

  if (dday === null) {
    el.ddayDisplay.textContent = 'D-DAY';
    return;
  }

  if (dday > 0) {
    el.ddayDisplay.textContent = `D-${dday}`;
  } else if (dday === 0) {
    el.ddayDisplay.textContent = 'D-DAY';
  } else {
    el.ddayDisplay.textContent = `D+${Math.abs(dday)}`;
  }
}

// ============================================
// 데이터 마이그레이션
// ============================================

/**
 * 데이터 스키마 마이그레이션
 * 구 버전의 questionScores를 새 스키마로 변환
 */
export function migrateData() {
  const version = localStorage.getItem('schemaVersion');
  if (version === '2') return;

  try {
    const old = localStorage.getItem('auditQuizScores');
    if (!old) {
      localStorage.setItem('schemaVersion', '2');
      return;
    }

    const parsed = JSON.parse(old);
    const newScores = {};
    const map = {};

    // 고유ID 매핑 생성
    const allData = getAllData();
    allData.forEach(q => {
      const disp = String(q.표시번호 ?? '').trim();
      const num = String(q.물음번호 ?? '').trim();
      if (disp) map[disp] = q.고유ID;
      if (num) map[num] = q.고유ID;
    });

    // 데이터 변환
    Object.keys(parsed).forEach(k => {
      const nk = map[k] || k;
      const ov = parsed[k] || {};
      const hist = Array.isArray(ov.solveHistory)
        ? ov.solveHistory
        : (ov.score != null ? [{ date: Date.now(), score: +ov.score || 0 }] : []);

      // 기본 엔트리 구조
      const entry = {
        solveHistory: hist,
        isSolved: !!(ov.isSolved || (ov.score != null)),
        userReviewFlag: !!ov.userReviewFlag,
        userReviewExclude: !!ov.userReviewExclude
      };

      // score가 실제로 존재하는 경우에만 추가 (undefined/null이면 추가하지 않음)
      if (ov.score != null) {
        entry.score = +ov.score;
        entry.feedback = String(ov.feedback ?? '');
        entry.user_answer = String(ov.user_answer ?? '');
        entry.hintUsed = !!ov.hintUsed;
        entry.lastSolvedDate = +(ov.lastSolvedDate ?? (hist.at(-1)?.date || Date.now()));
      }

      // memoryTip이 있으면 보존
      if (ov.memoryTip) {
        entry.memoryTip = ov.memoryTip;
      }

      // userMemo가 있으면 보존
      if (ov.userMemo) {
        entry.userMemo = ov.userMemo;
      }

      newScores[nk] = entry;
    });

    localStorage.setItem('auditQuizScores', JSON.stringify(newScores));
    localStorage.setItem('schemaVersion', '2');
    setQuestionScores(newScores);
    showToast('데이터 마이그레이션 완료', 'info');
  } catch (e) {
    console.error(e);
    showToast('마이그레이션 오류', 'error');
  }
}

// ============================================
// 복습 플래그 관리 (★ vs ➖ 상호배타)
// ============================================

/**
 * 모든 문제의 상호배타적 플래그 정합성 보정
 * userReviewFlag(★)와 userReviewExclude(➖)가 동시에 true인 경우 제외 우선
 */
export function enforceExclusiveFlagsOnAll() {
  let changed = 0;
  const questionScores = getQuestionScores();

  for (const [qid, rec] of Object.entries(questionScores || {})) {
    if (rec?.userReviewFlag && rec?.userReviewExclude) {
      // 정책: '제외(➖) 우선'
      rec.userReviewFlag = false;
      changed++;
    }
  }

  if (changed) {
    try {
      saveQuestionScores();
    } catch (e) {
      console.error('플래그 정합성 저장 실패:', e);
    }
  }
}

/**
 * 특정 문제의 플래그 상태 설정
 * @param {string} qid - 문제 고유ID
 * @param {Object} options - 플래그 옵션
 * @param {boolean} options.flag - 복습 플래그 (★)
 * @param {boolean} options.exclude - 제외 플래그 (➖)
 * @param {boolean} options.silent - true면 패널 새로고침 안 함
 */
export function setFlagState(qid, { flag = false, exclude = false, silent = false }) {
  const questionScores = getQuestionScores();
  const rec = questionScores[qid] || {};

  // 상호배타 적용
  if (exclude) flag = false;
  if (flag) exclude = false;

  questionScores[qid] = { ...rec, userReviewFlag: !!flag, userReviewExclude: !!exclude };

  // StateManager를 통한 상태 업데이트 (중요!)
  setQuestionScores(questionScores);

  try {
    saveQuestionScores();
  } catch (e) {
    console.error('플래그 상태 저장 실패:', e);
  }

  if (!silent && typeof window.refreshPanels === 'function') {
    window.refreshPanels(); // 좌/우 패널 동기화
  }
}

// ============================================
// 읽음 상태 관리 (Read Store)
// ============================================

const READ_STORE_KEY = 'readSessions_v2';
export const UNIQUE_WINDOW_MS = 5 * 60 * 1000; // 5분

/**
 * Read Store 로드
 * @returns {Object} 읽음 상태 객체
 */
export function loadReadStore() {
  try {
    return JSON.parse(localStorage.getItem(READ_STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Read Store 저장
 * @param {Object} obj - 읽음 상태 객체
 */
export function saveReadStore(obj) {
  localStorage.setItem(READ_STORE_KEY, JSON.stringify(obj));
}

/**
 * 풀이 이력에서 고유 읽음 횟수 계산
 * @param {Array} h - solveHistory 배열
 * @returns {Object} {uniqueReads, lastAt}
 */
export function computeUniqueReadsFromHistory(h) {
  const times = (Array.isArray(h) ? h : [])
    .map(x => +x?.date)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!times.length) return { uniqueReads: 0, lastAt: 0 };

  let c = 0;
  let last = -Infinity;

  for (const t of times) {
    if (t - last >= UNIQUE_WINDOW_MS) {
      c++;
      last = t;
    }
  }

  return { uniqueReads: c, lastAt: times.at(-1) };
}

/**
 * questionScores의 solveHistory로부터 Read Store 백필
 * @param {boolean} force - 강제 실행 여부
 */
export function backfillReadStoreFromScores(force = false) {
  if (!force && localStorage.getItem('readStoreBackfilled_v2') === '1') return;

  const db = loadReadStore();
  let touched = 0;
  const questionScores = getQuestionScores();

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
  localStorage.setItem('readStoreBackfilled_v2', '1');
}

/**
 * 고유 읽음 등록 (5분 이상 간격이면 +1)
 * @param {string} qid - 문제 고유ID
 * @returns {Object} {increased: boolean, uniqueReads: number}
 */
export function registerUniqueRead(qid) {
  const t = Date.now();
  const db = loadReadStore();
  let rec = db[qid];
  const questionScores = getQuestionScores();

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

/**
 * solveHistory에서 고유 회독수 반환 (간단한 래퍼)
 * @param {Array} solveHistory - solveHistory 배열
 * @returns {number} 고유 회독수
 */
export function getUniqueReadCount(solveHistory) {
  if (!Array.isArray(solveHistory) || solveHistory.length === 0) {
    return 0;
  }
  return computeUniqueReadsFromHistory(solveHistory).uniqueReads;
}

/**
 * 현재 풀이가 새 회독인지 판단
 * @param {Array} solveHistory - solveHistory 배열 (현재 풀이 제외)
 * @param {number} currentTime - 현재 시간 (timestamp)
 * @returns {boolean} 새 회독인지 여부
 */
export function shouldCountAsNewRead(solveHistory, currentTime = Date.now()) {
  if (!Array.isArray(solveHistory) || solveHistory.length === 0) {
    return true; // 첫 풀이는 항상 새 회독
  }
  
  const times = solveHistory
    .map(x => +x?.date)
    .filter(Number.isFinite)
    .sort((a, b) => b - a); // 최신순 정렬
  
  if (times.length === 0) return true;
  
  // 가장 최근 풀이 시간 확인
  const lastTime = times[0];
  return (currentTime - lastTime) >= UNIQUE_WINDOW_MS;
}

/**
 * 전체 questionScores에서 고유 회독수 총합 계산
 * @param {Object} questionScores - questionScores 객체
 * @returns {number} 고유 회독수 총합
 */
export function getTotalUniqueReads(questionScores) {
  if (!questionScores || typeof questionScores !== 'object') {
    return 0;
  }
  
  let total = 0;
  for (const record of Object.values(questionScores)) {
    if (record && Array.isArray(record.solveHistory)) {
      total += getUniqueReadCount(record.solveHistory);
    }
  }
  
  return total;
}

// ============================================
// 유틸리티 - statsRefDate getter/setter
// ============================================

/**
 * 통계 기준 날짜 가져오기
 * @returns {Date} statsRefDate
 */
export function getStatsRefDate() {
  return statsRefDate;
}

/**
 * 통계 기준 날짜 설정
 * @param {Date} date - 설정할 날짜
 */
export function setStatsRefDate(date) {
  statsRefDate = date;
}

// ============================================
// 유틸리티 - calRefDate getter/setter
// ============================================

/**
 * 캘린더 기준 날짜 가져오기
 * @returns {Date} calRefDate
 */
export function getCalRefDate() {
  return calRefDate;
}

/**
 * 캘린더 기준 날짜 설정
 * @param {Date} date - 설정할 날짜
 */
export function setCalRefDate(date) {
  calRefDate = date;
}
