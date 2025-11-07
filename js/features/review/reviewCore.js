/**
 * @fileoverview 복습 전략 및 우선순위 정렬
 * - 복습 전략 관리 (smart, HLR, flag, low, recentWrong)
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
 * @returns {string} 'smart' | 'hlr' | 'flag' | 'low' | 'recentWrong'
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

  // HLR 전략: 회상 확률 기반 정렬
  if (strat === 'hlr') {
    const scored = list.map(q => {
      const qid = normId(q.고유ID);
      const rec = questionScores[qid];

      // 우선순위 점수 계산 (낮을수록 높은 우선순위)
      let priority = 0;

      // 1. 복습 플래그 최상위
      if (rec?.userReviewFlag && !rec?.userReviewExclude) priority -= 1000;

      // 2. HLR 회상 확률 계산
      const hlrData = calculateRecallProbability(qid, predictor);
      if (hlrData) {
        // 회상 확률 낮을수록 우선순위 높음 (망각 임박)
        priority += hlrData.p_current * 100; // 0~100

        // 마지막 풀이 오래된 순
        priority += hlrData.timeSinceLastReview * 0.5;
      } else {
        // HLR 데이터 없으면 (미풀이) 중간 우선순위
        priority += 50;
      }

      // 3. 평균 점수 낮은 순
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
