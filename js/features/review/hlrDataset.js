/**
 * @fileoverview HLR (Half-Life Regression) 데이터셋 생성 및 예측
 * - HLR 학습 데이터셋 생성
 * - HLR 반감기 예측 모델
 * - 회상 확률 계산
 */

import { clamp, normId } from '../../utils/helpers.js';
import { showToast } from '../../ui/domUtils.js';
import { PASSIVE_WEIGHTS } from './difficultyTracker.js';

/**
 * HLR 데이터셋 생성: solveHistory를 HLR 학습용 피처로 변환
 * @returns {Array} HLR 학습용 레코드 배열
 */
export function buildHLRDataset() {
  // Access global state via window (NEVER import from stateManager)
  const questionScores = window.questionScores || {};
  const records = [];
  const now = Date.now();

  for (const [qid, rec] of Object.entries(questionScores)) {
    const hist = Array.isArray(rec?.solveHistory) ? rec.solveHistory : [];
    if (hist.length < 1) continue;

    // 시간순 정렬
    hist.sort((a, b) => (+a?.date || 0) - (+b?.date || 0));

    let prevDate = null;
    let totalReviews = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    const scores = [];

    for (let i = 0; i < hist.length; i++) {
      const h = hist[i];
      const date = +h?.date;
      const score = clamp(+h?.score || 0, 0, 100);

      if (!Number.isFinite(date)) continue;

      scores.push(score);
      totalReviews++;
      if (score >= 80) correctCount++;
      else incorrectCount++;

      // i >= 1: 이전 학습 기록이 있어야 Δ 계산 가능
      if (prevDate && i >= 1) {
        const delta = (date - prevDate) / (1000 * 86400); // 일 단위
        if (delta <= 0) continue; // 같은 날 연속 풀이는 skip

        // 🚨 수정 3: 순환 참조 해결 - 점수를 직접 확률로 사용하지 않고 성능 지표로 사용
        // 기존: p_observed = score / 100 (이것이 순환 참조의 원인)
        // 새로운 방식: 실제 망각 곡선 기반으로 관찰된 회상 확률 추정

        // 이전 점수와 현재 점수로 실제 학습 효과 측정
        const prevScore = hist[i - 1]?.score || 50;
        const scoreDecay = score / Math.max(prevScore, 1); // 점수 변화율

        // 실제 회상 확률 추정 (점수 기반이 아닌 성능 기반)
        // 80점 이상: 잘 기억함 (0.8~0.95)
        // 60~79점: 어느 정도 기억 (0.6~0.79)
        // 40~59점: 일부 망각 (0.4~0.59)
        // 0~39점: 대부분 망각 (0.1~0.39)
        let p_observed;
        if (score >= 80) {
          p_observed = 0.8 + (score - 80) * 0.0075; // 80점=0.8, 100점=0.95
        } else if (score >= 60) {
          p_observed = 0.6 + (score - 60) * 0.0095; // 60점=0.6, 79점=0.79
        } else if (score >= 40) {
          p_observed = 0.4 + (score - 40) * 0.01; // 40점=0.4, 59점=0.59
        } else {
          p_observed = 0.1 + score * 0.0075; // 0점=0.1, 39점=0.39
        }

        // 극단값 방지
        p_observed = Math.max(0.05, Math.min(0.99, p_observed));

        // h 계산: p = 2^(-Δ/h) → h = -Δ / log₂(p)
        const h_true = -delta / Math.log2(p_observed);
        const y = Math.log2(h_true); // 타겟: log₂(h)

        // 피처 벡터 x
        const x = {
          bias: 1,
          total_reviews: totalReviews,
          mean_score: scores.reduce((a, b) => a + b, 0) / scores.length,
          last_score: score,
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          correct_ratio: correctCount / totalReviews,
          last_is_correct: score >= 80 ? 1 : 0,
          time_since_first: (date - hist[0].date) / (1000 * 86400),
          first_solve_quality: hist[0].score / 100.0
        };

        records.push({ qid, y, x, delta, p_observed, h_true });
      }

      prevDate = date;
    }
  }

  return records;
}

/**
 * HLR 데이터셋 CSV 내보내기
 */
export function exportHLRDataset() {
  const records = buildHLRDataset();
  const csv = [
    ['qid', 'y(log2h)', 'delta', 'p_observed', 'h_true', 'total_reviews', 'mean_score', 'last_score', 'correct_count', 'incorrect_count'].join(','),
    ...records.map(r => [
      r.qid,
      r.y.toFixed(4),
      r.delta.toFixed(2),
      r.p_observed.toFixed(2),
      r.h_true.toFixed(2),
      r.x.total_reviews,
      r.x.mean_score.toFixed(2),
      r.x.last_score,
      r.x.correct_count,
      r.x.incorrect_count
    ].join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hlr_dataset_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('HLR 데이터셋 내보내기 완료');
}

/**
 * LocalHLRPredictor 클래스: 간단한 규칙 기반 HLR 모델
 */
export class LocalHLRPredictor {
  constructor() {
    // 초기 가중치 (Phase 1: 현실적 기본값으로 수정)
    // 학습된 가중치가 있으면 우선 사용 (Phase 2)
    const learnedWeights = this.loadLearnedWeights();

    this.modelWeights = learnedWeights || {
      bias: 1.0,              // [수정] 4.0 → 1.0 (기본 반감기: 2일, 회계사 수험생 모드)
      total_reviews: 0.15,    // 리뷰 많을수록 반감기 증가
      mean_score: 0.008,      // 평균 점수 높을수록 반감기 증가
      last_score: 0.02,       // [수정] 0.005 → 0.02 (최근 점수 영향력 강화)
      correct_count: 0.1,     // 정답 횟수 많을수록 반감기 증가
      incorrect_count: -0.8,  // [수정] -0.12 → -0.8 (오답 페널티 강화, 반감기 40~50% 감소)
      time_since_first: 0.02, // 첫 풀이부터 오래될수록 반감기 증가
      first_solve_quality: 0.5 // 첫 풀이 점수 높을수록 반감기 증가
    };
  }

  /**
   * Phase 2: localStorage에서 학습된 가중치 로드
   * @returns {object|null} 학습된 가중치 또는 null
   */
  loadLearnedWeights() {
    try {
      const stored = localStorage.getItem('hlr_learned_weights_v2');
      if (!stored) return null;

      const weights = JSON.parse(stored);

      // 안전 장치: 학습된 가중치 검증
      if (this.validateWeights(weights)) {
        console.log('[HLR] 학습된 가중치 로드 성공');
        return weights;
      } else {
        console.warn('[HLR] 학습된 가중치가 비정상적입니다. 기본값을 사용합니다.');
        localStorage.removeItem('hlr_learned_weights_v2');
        return null;
      }
    } catch (e) {
      console.error('[HLR] 가중치 로드 실패:', e);
      return null;
    }
  }

  /**
   * 학습된 가중치 검증 (Safety Clamp)
   * @param {object} weights - 검증할 가중치
   * @returns {boolean} 유효성 여부
   */
  validateWeights(weights) {
    if (!weights || typeof weights !== 'object') return false;

    // bias가 너무 크면 비정상
    if (weights.bias > 5.0 || weights.bias < -2.0) return false;

    // incorrect_count는 반드시 음수여야 함 (오답은 페널티)
    if (weights.incorrect_count > 0) return false;

    // 필수 키 존재 여부
    const requiredKeys = ['bias', 'total_reviews', 'last_score', 'incorrect_count'];
    for (const key of requiredKeys) {
      if (!(key in weights)) return false;
    }

    return true;
  }

  predict(features) {
    let log2h = this.modelWeights.bias;

    for (const [key, weight] of Object.entries(this.modelWeights)) {
      if (key === 'bias') continue;
      const val = features[key] || 0;
      log2h += weight * val;
    }

    // log₂(h)를 h로 변환
    const h = Math.pow(2, log2h);
    return Math.max(1, Math.min(365, h)); // 1일~1년 사이로 제한
  }

  getNextReviewDelta(h, targetRetrieval = 0.9) {
    // p = 2^(-Δ/h) = R_target
    // Δ = -h * log₂(R_target)
    const log2_R = Math.log2(targetRetrieval);
    const delta = -h * log2_R;
    return delta; // 일 단위
  }
}

/**
 * 특정 문제의 HLR 피처 생성
 * @param {string} qid - 문제 고유 ID
 * @returns {object} HLR 피처 객체
 */
export function buildFeaturesForQID(qid) {
  const questionScores = window.questionScores || {};
  const rec = questionScores[normId(qid)];
  if (!rec) return null;

  const hist = Array.isArray(rec?.solveHistory) ? rec.solveHistory : [];
  if (hist.length < 1) return null;

  hist.sort((a, b) => (+a?.date || 0) - (+b?.date || 0));

  const now = Date.now();
  const scores = hist.map(h => clamp(+h?.score || 0, 0, 100));
  const totalReviews = hist.length;
  const correctCount = scores.filter(s => s >= 80).length;
  const incorrectCount = scores.filter(s => s < 80).length;

  return {
    bias: 1,
    total_reviews: totalReviews,
    mean_score: scores.reduce((a, b) => a + b, 0) / scores.length,
    last_score: scores[scores.length - 1],
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    correct_ratio: correctCount / totalReviews,
    last_is_correct: scores[scores.length - 1] >= 80 ? 1 : 0,
    time_since_first: (now - (+hist[0]?.date || now)) / (1000 * 86400),
    first_solve_quality: scores[0] / 100.0
  };
}

/**
 * HLR 기반 회상 확률 계산
 * @param {string} qid - 문제 고유 ID
 * @param {LocalHLRPredictor} predictor - HLR 예측기 인스턴스
 * @returns {object} { h_pred, p_current, timeSinceLastReview, lastScore } 또는 null
 */
export function calculateRecallProbability(qid, predictor) {
  const questionScores = window.questionScores || {};
  const rec = questionScores[normId(qid)];
  if (!rec) return null;

  const features = buildFeaturesForQID(qid);
  if (!features) return null;

  // HLR 반감기 예측 (EnhancedHLRPredictor가 qid를 받으면 자동으로 FSRS 적용)
  const h_pred = predictor.predict ? predictor.predict(features, qid) : predictor.predict(features);

  // 마지막 풀이 후 경과 시간
  const lastReview = rec?.lastSolvedDate || 0;
  const now = Date.now();
  const timeSinceLastReview = (now - lastReview) / (1000 * 86400); // 일 단위

  // 🚨 수정 1: 최소 1시간 미만은 회상 확률 계산 안 함 (단기 기억 루프)
  // 이 경우 null을 반환하여 reviewCore.js에서 별도 처리하도록 함
  const MIN_TIME_THRESHOLD_HOURS = 1;
  if (timeSinceLastReview < (MIN_TIME_THRESHOLD_HOURS / 24)) {
    // 1시간 미만: 단기 기억으로 간주, 별도 처리 필요
    return {
      h_pred,
      p_current: null, // null로 표시하여 단기 기억임을 알림
      timeSinceLastReview,
      lastScore: features.last_score,
      isShortTerm: true // 단기 기억 플래그
    };
  }

  // 기본 시간 기반 회상 확률: p = 2^(-Δ/h)
  const p_time = Math.pow(2, -timeSinceLastReview / h_pred);

  // 🚨 수정 2: 최근 점수를 회상 확률에 반영
  // 점수가 낮으면 회상 확률도 낮게 조정 (방금 풀었어도 점수 나쁘면 복습 필요)
  const lastScore = features.last_score || 0;

  // 점수 가중치 계산 (0점 = 0.3배, 100점 = 1.0배)
  // pow(0.3)을 사용하여 점수 차이를 완화 (60점도 0.83배로 유지)
  const scoreWeight = Math.pow(lastScore / 100, 0.3);
  const minScoreWeight = 0.3; // 최소 가중치 (0점이어도 30%는 유지)

  // 최종 회상 확률 = 시간 기반 × 점수 가중치
  const p_current = p_time * Math.max(minScoreWeight, scoreWeight);

  return {
    h_pred,
    p_current: Math.min(0.99, Math.max(0.01, p_current)), // 0.01~0.99로 제한
    timeSinceLastReview,
    lastScore,
    isShortTerm: false
  };
}

// ============================================
// EnhancedHLRPredictor: HLR + FSRS 하이브리드
// ============================================

/**
 * 기존 HLR 모델에 FSRS Difficulty 요소를 부가한 향상된 예측기
 */
export class EnhancedHLRPredictor extends LocalHLRPredictor {
  constructor() {
    super();

    // 기존 HLR 가중치에 FSRS 요소 추가
    // Phase 2 학습된 가중치가 있어도 이 FSRS 요소는 추가로 적용
    if (!this.modelWeights.difficulty_feature) {
      this.modelWeights.difficulty_feature = -0.8;  // 난이도 높을수록 h 감소
    }
    if (!this.modelWeights.passive_views) {
      this.modelWeights.passive_views = 0.03;       // 수동 재인 횟수
    }
    if (!this.modelWeights.rated_passive) {
      this.modelWeights.rated_passive = 0.05;       // 평가된 재인의 추가 효과
    }
  }

  /**
   * 수동 재인의 HLR 기여도 계산
   * @param {string} qid - 문제 고유 ID
   * @returns {number} HLR log2(h) 기여도
   */
  calculatePassiveHLRContribution(qid) {
    const readData = window.readStore?.[normId(qid)];
    if (!readData?.viewHistory) return 0;

    const now = Date.now();
    let contribution = 0;

    // 최근 30일 이내 재인만 고려
    const thirtyDaysAgo = now - (30 * 86400 * 1000);
    const recentViews = readData.viewHistory.filter(v =>
      v.timestamp > thirtyDaysAgo
    );

    for (const view of recentViews) {
      if (!view.answer_viewed) continue;

      // 난이도별 가중치
      const weight = PASSIVE_WEIGHTS[view.difficulty_rating] || 0;
      if (weight === 0) continue;

      // 시간 감쇠 (30일 반감기)
      const ageInDays = (now - view.timestamp) / (86400 * 1000);
      const timeDecay = Math.pow(2, -ageInDays / 30);

      // 학습 시간 보정 (10초 이상 = 100%)
      const timeSpentBonus = Math.min(1, (view.time_spent || 0) / 10000);

      contribution += weight * timeDecay * timeSpentBonus;
    }

    // 최대 기여도 제한 (능동 회상의 30%)
    return Math.min(contribution, 0.3);
  }

  /**
   * HLR 피처 벡터 생성 (FSRS 요소 포함)
   * @param {string} qid - 문제 고유 ID
   * @returns {Object|null} 향상된 피처 객체
   */
  buildEnhancedFeatures(qid) {
    const baseFeatures = buildFeaturesForQID(qid);
    if (!baseFeatures) return null;

    // FSRS 난이도 피처 추가
    if (window.difficultyTracker) {
      baseFeatures.difficulty_feature = window.difficultyTracker.getDifficultyFeature(normId(qid));
    } else {
      baseFeatures.difficulty_feature = 0.5; // 기본값 (중간 난이도)
    }

    // 수동 재인 통계 추가
    const readData = window.readStore?.[normId(qid)];
    if (readData) {
      baseFeatures.passive_views = readData.stats?.total_views || 0;
      baseFeatures.rated_passive = readData.stats?.rated_views || 0;
    } else {
      baseFeatures.passive_views = 0;
      baseFeatures.rated_passive = 0;
    }

    return baseFeatures;
  }

  /**
   * HLR 반감기 예측 (FSRS 요소 통합)
   * @param {Object} features - HLR 피처 객체
   * @param {string|null} qid - 문제 고유 ID (선택적, 제공 시 향상된 피처 사용)
   * @returns {number} 반감기 (일 단위)
   */
  predict(features, qid = null) {
    // qid가 있으면 향상된 피처 사용
    if (qid) {
      const enhancedFeatures = this.buildEnhancedFeatures(qid);
      if (enhancedFeatures) {
        features = enhancedFeatures;
      }
    }

    // 기본 HLR 예측
    let log2h = super.predict(features);

    // 수동 재인 기여도 추가
    if (qid) {
      const passiveBoost = this.calculatePassiveHLRContribution(qid);
      log2h += passiveBoost;
    }

    // log₂(h)를 h로 변환
    const h = Math.pow(2, log2h);
    return Math.max(1, Math.min(365, h));
  }
}
