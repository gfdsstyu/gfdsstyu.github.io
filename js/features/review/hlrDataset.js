/**
 * @fileoverview HLR (Half-Life Regression) 데이터셋 생성 및 예측
 * - HLR 학습 데이터셋 생성
 * - HLR 반감기 예측 모델
 * - 회상 확률 계산
 */

import { clamp, normId } from '../../utils/helpers.js';
import { showToast } from '../../ui/domUtils.js';

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

        let p_observed = score / 100.0;
        p_observed = Math.max(0.01, Math.min(0.99, p_observed)); // log(0) 방지

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
    // 초기 가중치 (경험적 기본값)
    this.modelWeights = {
      bias: 4.0,              // log₂(h) 기본값 ≈ h=16일
      total_reviews: 0.15,    // 리뷰 많을수록 반감기 증가
      mean_score: 0.008,      // 평균 점수 높을수록 반감기 증가
      last_score: 0.005,      // 최근 점수 높을수록 반감기 증가
      correct_count: 0.1,     // 정답 횟수 많을수록 반감기 증가
      incorrect_count: -0.12, // 오답 횟수 많을수록 반감기 감소
      time_since_first: 0.02, // 첫 풀이부터 오래될수록 반감기 증가
      first_solve_quality: 0.5 // 첫 풀이 점수 높을수록 반감기 증가
    };
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
 * @returns {object} { h_pred, p_current, timeSinceLastReview } 또는 null
 */
export function calculateRecallProbability(qid, predictor) {
  const questionScores = window.questionScores || {};
  const rec = questionScores[normId(qid)];
  if (!rec) return null;

  const features = buildFeaturesForQID(qid);
  if (!features) return null;

  // HLR 반감기 예측
  const h_pred = predictor.predict(features);

  // 마지막 풀이 후 경과 시간
  const lastReview = rec?.lastSolvedDate || 0;
  const now = Date.now();
  const timeSinceLastReview = (now - lastReview) / (1000 * 86400); // 일 단위

  // 현재 회상 확률: p = 2^(-Δ/h)
  const p_current = Math.pow(2, -timeSinceLastReview / h_pred);

  return { h_pred, p_current, timeSinceLastReview };
}
