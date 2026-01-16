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
 * @param {string} sortStrategy - 정렬 전략 (선택적, 없으면 localStorage에서 가져옴)
 * @returns {Array} 우선순위 정렬된 문제 목록
 */
export function prioritizeTodayReview(list, predictor, sortStrategy = null) {
  // Access global state via window (NEVER import from stateManager)
  const questionScores = window.questionScores || {};

  // 제외된 문제 필터링
  list = (list || []).filter(a => !questionScores[normId(a.고유ID)]?.userReviewExclude);

  const strat = sortStrategy || getReviewStrategy();

  // HLR 전략: 회상 확률 + FSRS 난이도 기반 정렬
  if (strat === 'hlr') {
    const readStore = window.readStore || {};
    const difficultyTracker = window.difficultyTracker;
    const now = Date.now();

    const scored = list.map(q => {
      const qid = normId(q.고유ID);
      const rec = questionScores[qid];
      const readData = readStore[qid];

      // 우선순위 점수 계산 (낮을수록 높은 우선순위)
      let priority = 0;

      // 1. 복습 플래그 최상위
      if (rec?.userReviewFlag && !rec?.userReviewExclude) priority -= 10000;

      // 🚨 Phase 1: Short-term Loop (오늘 틀린 문제 긴급 구제)
      // 조건: 24시간 이내 + 점수 < 60점 OR 플래그 설정
      const lastReview = rec?.lastSolvedDate || 0;
      const hoursSinceReview = (now - lastReview) / (3600 * 1000);
      const lastScore = rec?.score || 100;

      if (hoursSinceReview < 24 && (lastScore < 60 || rec?.userReviewFlag)) {
        // 오늘 틀린 문제는 HLR 계산과 무관하게 최상단 노출
        priority -= 99999;

        // 점수가 낮을수록 더 높은 우선순위
        priority += lastScore * 10; // 0점=+0, 59점=+590

        return { q, priority, hlrData: { isShortTerm: true, lastScore } };
      }

      // 2. HLR 회상 확률 계산
      const hlrData = calculateRecallProbability(qid, predictor);
      if (hlrData) {
        // 단기 기억 (1시간 미만)인 경우 낮은 우선순위
        if (hlrData.isShortTerm) {
          priority += 50000; // 단기 기억은 아직 복습 불필요
          return { q, priority, hlrData };
        }

        // p_current가 null이 아닌 경우 (정상적인 HLR 계산)
        if (hlrData.p_current !== null) {
          // 회상 확률 낮을수록 우선순위 높음 (망각 임박)
          priority += hlrData.p_current * 1000; // 0~1000

          // 반감기가 짧을수록 우선순위 높음
          priority += hlrData.h_pred * 10;
        } else {
          // p_current가 null (단기 기억)
          priority += 50000;
        }
      } else {
        // HLR 데이터 없으면 (미풀이) 우선순위 최하위로 설정
        priority += 99999;
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

  // 최근 풀이순 (점수 무관, 풀이 날짜만으로 정렬)
  if (strat === 'recentWrong') {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reviewCore.js:125',message:'recentWrong strategy start',data:{listLength:list.length,strat},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const sorted = [...list].sort((a, b) => {
      const sa = questionScores[normId(a.고유ID)];
      const sb = questionScores[normId(b.고유ID)];
      const ad = sa?.lastSolvedDate ?? 0;
      const bd = sb?.lastSolvedDate ?? 0;
      // 최근 풀이한 순 (날짜 높은 것 우선, 내림차순)
      const result = bd - ad;
      // #region agent log
      if (list.length <= 5) {
        fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reviewCore.js:132',message:'recentWrong sort comparison',data:{aId:a.고유ID,bId:b.고유ID,ad,bd,result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      }
      // #endregion
      return result;
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reviewCore.js:140',message:'recentWrong strategy end',data:{sortedLength:sorted.length,firstThreeIds:sorted.slice(0,3).map(q=>q.고유ID)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return sorted;
  }

  // 오래전 풀이순 (점수 무관, 풀이 날짜만으로 정렬)
  if (strat === 'oldWrong') {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reviewCore.js:145',message:'oldWrong strategy start',data:{listLength:list.length,strat},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const sorted = [...list].sort((a, b) => {
      const sa = questionScores[normId(a.고유ID)];
      const sb = questionScores[normId(b.고유ID)];
      const ad = sa?.lastSolvedDate ?? 0;
      const bd = sb?.lastSolvedDate ?? 0;
      // 오래전 풀이한 순 (날짜 낮은 것 우선, 오름차순)
      const result = ad - bd;
      // #region agent log
      if (list.length <= 5) {
        fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reviewCore.js:152',message:'oldWrong sort comparison',data:{aId:a.고유ID,bId:b.고유ID,ad,bd,result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      }
      // #endregion
      return result;
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/169d67f2-e384-4729-9ce9-d3ef8e71205b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reviewCore.js:160',message:'oldWrong strategy end',data:{sortedLength:sorted.length,firstThreeIds:sorted.slice(0,3).map(q=>q.고유ID)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return sorted;
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
