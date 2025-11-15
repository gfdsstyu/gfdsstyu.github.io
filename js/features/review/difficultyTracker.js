/**
 * @fileoverview FSRS 스타일 난이도 추적 및 수동 재인 관리
 * - DifficultyFeatureTracker: FSRS Difficulty 개념 구현
 * - ReadStore: 플래시카드 수동 재인 이벤트 관리
 * - 기존 HLR 모델에 부가적으로 통합
 */

import { normId } from '../../utils/helpers.js';

// ============================================
// 상수: 수동 재인 가중치
// ============================================

/**
 * 난이도 평가별 HLR 기여도 가중치
 * - easy: 쉬운 문제는 최소 기여 (빠른 인지)
 * - medium: 보통 문제는 중간 기여
 * - hard: 어려운 문제는 최대 기여 (더 많은 인지 노력)
 * - skip: 건너뛰기는 기여 없음
 */
export const PASSIVE_WEIGHTS = {
  'easy': 0.05,
  'medium': 0.10,
  'hard': 0.15,
  'skip': 0
};

// ============================================
// DifficultyFeatureTracker 클래스
// ============================================

/**
 * FSRS 스타일 난이도를 HLR 추가 피처로 관리
 */
export class DifficultyFeatureTracker {
  constructor() {
    this.difficulties = {}; // 문제별 난이도 (1-10)
    this.INITIAL_D = 5.0;   // 초기 난이도
    this.ADJUSTMENT_RATE = 0.05; // FSRS W7 파라미터

    this.loadFromStorage();
  }

  /**
   * 난이도 평가를 통한 업데이트 (FSRS 공식 차용)
   * @param {string} qid - 문제 고유 ID
   * @param {string} rating - 난이도 평가 ('easy', 'medium', 'hard', 'skip')
   * @returns {number} 업데이트된 난이도 (1-10)
   */
  updateDifficulty(qid, rating) {
    const current = this.difficulties[qid] || this.INITIAL_D;

    // 플래시카드 평가 → FSRS Grade 매핑
    const gradeMap = {
      'easy': 4,    // 쉽게 기억함
      'medium': 3,  // 보통으로 기억함
      'hard': 2,    // 어렵게 기억함
      'skip': null
    };

    const grade = gradeMap[rating];
    if (grade === null || grade === undefined) return current;

    // FSRS 공식: D' = D × (1 + ADJUSTMENT_RATE × (grade - 3))
    const newD = current * (1 + this.ADJUSTMENT_RATE * (grade - 3));
    this.difficulties[qid] = Math.max(1, Math.min(10, newD));

    this.saveToStorage();
    return this.difficulties[qid];
  }

  /**
   * 난이도를 HLR 피처로 변환 (0-1 범위로 정규화)
   * @param {string} qid - 문제 고유 ID
   * @returns {number} 정규화된 난이도 (0-1)
   */
  getDifficultyFeature(qid) {
    const d = this.difficulties[qid] || this.INITIAL_D;
    return (d - 1) / 9; // 1-10 범위를 0-1로 정규화
  }

  /**
   * 원본 난이도 값 반환
   * @param {string} qid - 문제 고유 ID
   * @returns {number} 난이도 (1-10)
   */
  getDifficulty(qid) {
    return this.difficulties[qid] || this.INITIAL_D;
  }

  /**
   * localStorage에 저장
   */
  saveToStorage() {
    try {
      localStorage.setItem('difficultyCache_v1', JSON.stringify(this.difficulties));
    } catch (e) {
      console.error('난이도 캐시 저장 실패:', e);
    }
  }

  /**
   * localStorage에서 로드
   */
  loadFromStorage() {
    try {
      const cached = localStorage.getItem('difficultyCache_v1');
      if (cached) {
        this.difficulties = JSON.parse(cached);
      }
    } catch (e) {
      console.error('난이도 캐시 로드 실패:', e);
      this.difficulties = {};
    }
  }

  /**
   * 난이도 분포 통계 계산
   * @returns {Object} { avg, easy, medium, hard, total }
   */
  getStats() {
    const values = Object.values(this.difficulties);
    if (values.length === 0) {
      return { avg: 0, easy: 0, medium: 0, hard: 0, total: 0 };
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const easy = values.filter(d => d < 4).length;
    const medium = values.filter(d => d >= 4 && d <= 6).length;
    const hard = values.filter(d => d > 6).length;

    return { avg, easy, medium, hard, total: values.length };
  }
}

// ============================================
// ReadStore 관리 함수
// ============================================

/**
 * ReadStore 초기화 (전역 window.readStore 사용)
 */
export function initReadStore() {
  if (!window.readStore) {
    // localStorage에서 복원 시도
    try {
      const cached = localStorage.getItem('readStore_v1');
      window.readStore = cached ? JSON.parse(cached) : {};
    } catch (e) {
      console.error('ReadStore 로드 실패:', e);
      window.readStore = {};
    }
  }
}

/**
 * ReadStore에 수동 재인 이벤트 기록
 * @param {string} qid - 문제 고유 ID
 * @param {Object} eventData - 이벤트 데이터
 */
export function recordPassiveView(qid, eventData) {
  initReadStore();

  const normalizedQid = normId(qid);

  if (!window.readStore[normalizedQid]) {
    window.readStore[normalizedQid] = {
      viewHistory: [],
      stats: {
        total_views: 0,
        rated_views: 0,
        avg_difficulty_score: 0,
        fsrs_difficulty: 5.0
      }
    };
  }

  const record = window.readStore[normalizedQid];

  // 이벤트 기록
  const event = {
    timestamp: Date.now(),
    event_type: eventData.event_type || 'passive_view',
    difficulty_rating: eventData.difficulty_rating || null,
    answer_viewed: eventData.answer_viewed || false,
    time_spent: eventData.time_spent || 0,
    session_id: eventData.session_id || window.sessionId || Date.now().toString()
  };

  record.viewHistory.push(event);

  // 통계 업데이트
  record.stats.total_views++;

  if (eventData.difficulty_rating && eventData.difficulty_rating !== 'skip') {
    record.stats.rated_views++;

    // 평균 난이도 점수 업데이트
    const scoreMap = { easy: 1, medium: 2, hard: 3 };
    const score = scoreMap[eventData.difficulty_rating];
    if (score) {
      const prevAvg = record.stats.avg_difficulty_score;
      const ratedCount = record.stats.rated_views;
      record.stats.avg_difficulty_score = (prevAvg * (ratedCount - 1) + score) / ratedCount;
    }
  }

  // FSRS 난이도 업데이트 (별도 트래커에서 처리됨)
  if (window.difficultyTracker && eventData.difficulty_rating) {
    record.stats.fsrs_difficulty = window.difficultyTracker.getDifficulty(normalizedQid);
  }
}

/**
 * ReadStore를 localStorage에 저장
 */
export function saveReadStoreToLocal() {
  try {
    // 오래된 데이터 정리 (30일 이상)
    cleanOldReadData();

    localStorage.setItem('readStore_v1', JSON.stringify(window.readStore || {}));
  } catch (e) {
    console.error('ReadStore 저장 실패:', e);
  }
}

/**
 * 오래된 수동 재인 데이터 정리 (30일 이상)
 */
export function cleanOldReadData() {
  if (!window.readStore) return;

  const thirtyDaysAgo = Date.now() - (30 * 86400 * 1000);

  for (const qid in window.readStore) {
    const history = window.readStore[qid].viewHistory;
    if (Array.isArray(history)) {
      window.readStore[qid].viewHistory = history.filter(v => v.timestamp > thirtyDaysAgo);
    }
  }
}

/**
 * 특정 문제의 수동 재인 통계 반환
 * @param {string} qid - 문제 고유 ID
 * @returns {Object|null} 통계 객체
 */
export function getReadStats(qid) {
  initReadStore();
  const normalizedQid = normId(qid);
  return window.readStore[normalizedQid]?.stats || null;
}

/**
 * 특정 문제의 최근 재인 시간 반환
 * @param {string} qid - 문제 고유 ID
 * @returns {number|null} 타임스탬프 (ms)
 */
export function getLastReadTime(qid) {
  initReadStore();
  const normalizedQid = normId(qid);
  const history = window.readStore[normalizedQid]?.viewHistory;

  if (!history || history.length === 0) return null;

  return history[history.length - 1].timestamp;
}

// ============================================
// 초기화
// ============================================

/**
 * 난이도 추적 시스템 초기화
 */
export function initDifficultySystem() {
  // DifficultyFeatureTracker 인스턴스 생성
  if (!window.difficultyTracker) {
    window.difficultyTracker = new DifficultyFeatureTracker();
    console.log('✅ DifficultyFeatureTracker initialized');
  }

  // ReadStore 초기화
  initReadStore();
  console.log('✅ ReadStore initialized');

  // 30초마다 자동 저장
  setInterval(() => {
    saveReadStoreToLocal();
    window.difficultyTracker?.saveToStorage();
  }, 30000);

  // 페이지 종료 시 저장
  window.addEventListener('beforeunload', () => {
    saveReadStoreToLocal();
    window.difficultyTracker?.saveToStorage();
  });
}
