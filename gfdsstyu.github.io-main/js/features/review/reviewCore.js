/**
 * @fileoverview 복습 전략 및 우선순위 정렬
 * - 복습 전략 관리 (smart, HLR, flag, low, recentWrong, oldWrong)
 * - 문제 우선순위 정렬
 * - 복습 UI 이벤트 핸들러
 */

import { el } from '../../ui/elements.js';
import { showToast } from '../../ui/domUtils.js';
import { normId, clamp } from '../../utils/helpers.js';
import { calculateRecallProbability } from './hlrDataset.js';

const REVIEW_STRATEGY_LS = 'reviewStrategy_v1';

/**
 * Get current review strategy from localStorage
 * @returns {string} 'smart' | 'hlr' | 'flag' | 'low' | 'recentWrong' | 'oldWrong'
 */
export function getReviewStrategy() {
  return localStorage.getItem(REVIEW_STRATEGY_LS) || 'smart';
}

/**
 * 오늘의 복습 문제 우선순위 정렬
 * @param {Array} list - 문제 목록
 * @param {object} predictor - HLR predictor 인스턴스
 * @returns {Array} 우선순위 정렬된 문제 목록
 */
export function prioritizeTodayReview(list, predictor) {
  // Access global state via window (NEVER import from stateManager)
  const questionScores = window.questionScores || {};

  // 제외된 문제 필터링
  list = (list || []).filter(a => !questionScores[normId(a.고유ID)]?.userReviewExclude);

  const strat = getReviewStrategy();

  // HLR 전략: 회상 확률 + FSRS 난이도 기반 정렬
  if (strat === 'hlr') {
    const readStore = window.readStore || {};
    const difficultyTracker = window.difficultyTracker;

    const scored = list.map(q => {
      const qid = normId(q.고유ID);
      const rec = questionScores[qid];
      const readData = readStore[qid];

      // 우선순위 점수 계산 (낮을수록 높은 우선순위)
      let priority = 0;

      // 1. 복습 플래그 최상위
      if (rec?.userReviewFlag && !rec?.userReviewExclude) priority -= 10000;

      // 2. HLR 회상 확률 계산
      const hlrData = calculateRecallProbability(qid, predictor);
      if (hlrData) {
        // 회상 확률 낮을수록 우선순위 높음 (망각 임박)
        priority += hlrData.p_current * 1000; // 0~1000

        // 반감기가 짧을수록 우선순위 높음
        priority += hlrData.h_pred * 10;
      } else {
        // HLR 데이터 없으면 (미풀이) 중간 우선순위
        priority -= 500;
      }

      // 3. FSRS 난이도로 보정 (부가적)
      if (difficultyTracker) {
        const difficulty = difficultyTracker.getDifficulty(qid);
        // 어려운 문제일수록 자주 복습 (난이도 5 기준)
        priority -= (difficulty - 5) * 20;
      }

      // 4. 수동 재인 이력 고려
      if (readData?.stats?.rated_views > 0) {
        // 평가된 재인이 많을수록 약간 우선순위 낮춤
        // (이미 어느 정도 학습됨)
        priority += readData.stats.rated_views * 5;
      }

      // 5. 최근 재인 시간 고려
      if (readData?.viewHistory?.length > 0) {
        const lastView = readData.viewHistory[readData.viewHistory.length - 1];
        const hoursSinceView = (Date.now() - lastView.timestamp) / (3600 * 1000);

        // 24시간 이내 본 카드는 우선순위 낮춤
        if (hoursSinceView < 24) {
          priority += (24 - hoursSinceView) * 10;
        }
      }

      // 6. 평균 점수 낮은 순
      const hist = Array.isArray(rec?.solveHistory) ? rec.solveHistory : [];
      if (hist.length > 0) {
        const scores = hist.map(h => clamp(+h?.score || 0, 0, 100));
        const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        priority += (100 - meanScore) * 0.1;
      } else {
        priority += 5; // 미풀이는 낮은 가중치
      }

      return { q, priority, hlrData };
    });

    return scored.sort((a, b) => a.priority - b.priority).map(s => s.q);
  }

  // 복습 플래그 우선
  if (strat === 'flag') {
    const f = list.filter(a => questionScores[normId(a.고유ID)]?.userReviewFlag && !questionScores[normId(a.고유ID)]?.userReviewExclude);
    const r = list.filter(a => !(questionScores[normId(a.고유ID)]?.userReviewFlag && !questionScores[normId(a.고유ID)]?.userReviewExclude));
    return f.concat(r);
  }

  // 낮은 점수 우선
  if (strat === 'low') {
    return [...list].sort((a, b) => {
      const sa = questionScores[normId(a.고유ID)]?.score ?? 101;
      const sb = questionScores[normId(b.고유ID)]?.score ?? 101;
      return sa - sb;
    });
  }

  // 최근 오답 우선
  if (strat === 'recentWrong') {
    return [...list].sort((a, b) => {
      const sa = questionScores[normId(a.고유ID)];
      const sb = questionScores[normId(b.고유ID)];
      const as = sa?.score ?? 101;
      const bs = sb?.score ?? 101;
      const ad = sa?.lastSolvedDate ?? 0;
      const bd = sb?.lastSolvedDate ?? 0;
      // 점수 낮은 순 우선, 같으면 최근 틀린 순 (날짜 높은 것 우선)
      return (as - bs) || (bd - ad);
    });
  }

  // 오래전 오답 우선
  if (strat === 'oldWrong') {
    return [...list].sort((a, b) => {
      const sa = questionScores[normId(a.고유ID)];
      const sb = questionScores[normId(b.고유ID)];
      const as = sa?.score ?? 101;
      const bs = sb?.score ?? 101;
      const ad = sa?.lastSolvedDate ?? 0;
      const bd = sb?.lastSolvedDate ?? 0;
      // 점수 낮은 순 우선, 같으면 오래전 틀린 순 (날짜 낮은 것 우선)
      return (as - bs) || (ad - bd);
    });
  }

  // Smart 전략 (기본): 플래그 > 미풀이 > 낮은 점수 > 오래된 순
  return [...list].sort((a, b) => {
    const sa = questionScores[normId(a.고유ID)];
    const sb = questionScores[normId(b.고유ID)];
    const af = (sa?.userReviewFlag && !sa?.userReviewExclude) ? 0 : 1;
    const bf = (sb?.userReviewFlag && !sb?.userReviewExclude) ? 0 : 1;
    const aUn = sa ? 1 : 0;
    const bUn = sb ? 1 : 0;
    const aS = sa?.score ?? 101;
    const bS = sb?.score ?? 101;
    const aD = sa?.lastSolvedDate ?? 0;
    const bD = sb?.lastSolvedDate ?? 0;
    return (af - bf) || (aUn - bUn) || (aS - bS) || (aD - bD);
  });
}

/**
 * Initialize review UI event listeners
 */
export function initReviewListeners() {
  // Review strategy select change
  el.reviewStrategySelect?.addEventListener('change', e => {
    localStorage.setItem(REVIEW_STRATEGY_LS, e.target.value);
    showToast(`오늘의 복습 전략: ${e.target.value}`);
    if (window.refreshPanels) window.refreshPanels();
  });

  // Sync current strategy to UI
  (function syncStrategy() {
    const cur = getReviewStrategy();
    if (el.reviewStrategySelect) el.reviewStrategySelect.value = cur;
  })();

  // Start review button
  el.startReviewBtn?.addEventListener('click', () => {
    if (el.filterSelect) el.filterSelect.value = 'today-review';
    if (window.reloadAndRefresh) window.reloadAndRefresh();
    showToast('오늘의 복습 시작');
  });
}
