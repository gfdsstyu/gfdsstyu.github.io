// ============================================
// Phase 3.3: 랭킹 UI (Ranking UI)
// ============================================

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import { db } from '../../app.js';
import { getCurrentUser, getNickname } from '../auth/authCore.js';
import { getMyRanking } from './rankingCore.js';
import { showToast } from '../../ui/domUtils.js';

// ============================================
// State
// ============================================

let currentPeriod = 'daily';
let currentCriteria = 'totalScore';

// 평균점수 랭킹 최소 문제 수 기준 (기간별)
const MIN_PROBLEMS_FOR_AVG = {
  daily: 3,
  weekly: 10,
  monthly: 30
};

// ============================================
// Modal Open/Close
// ============================================

/**
 * 랭킹 모달 열기
 */
export async function openRankingModal() {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    showToast('랭킹을 보려면 로그인이 필요합니다.', 'warning');
    return;
  }

  const modal = document.getElementById('ranking-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // 내 통계 업데이트
  await updateMyStatsDisplay();

  // 랭킹 리스트 로드
  await loadRankings();
}

/**
 * 랭킹 모달 닫기
 */
export function closeRankingModal() {
  const modal = document.getElementById('ranking-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// ============================================
// My Stats Display
// ============================================

/**
 * 내 통계 표시 업데이트
 */
async function updateMyStatsDisplay() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const myStats = await getMyRanking(currentPeriod);

  if (!myStats) {
    document.getElementById('my-total-score').textContent = '-';
    document.getElementById('my-problem-count').textContent = '-';
    document.getElementById('my-average-score').textContent = '-';
    return;
  }

  // 순서: 총점수, 문풀횟수, 평균점수
  const totalScoreEl = document.getElementById('my-total-score');
  const problemCountEl = document.getElementById('my-problem-count');
  const avgScoreEl = document.getElementById('my-average-score');

  totalScoreEl.textContent = myStats.totalScore.toLocaleString();
  problemCountEl.textContent = myStats.problems.toLocaleString();
  avgScoreEl.textContent = myStats.avgScore.toFixed(1);

  // 현재 선택된 기준 강조
  const allStatEls = [totalScoreEl, problemCountEl, avgScoreEl];
  allStatEls.forEach(el => {
    el.classList.remove('text-5xl', 'text-blue-600', 'dark:text-blue-400', 'animate-pulse');
    el.classList.add('text-3xl');
  });

  // 선택된 기준만 크게
  const selectedEl = currentCriteria === 'totalScore' ? totalScoreEl :
                     currentCriteria === 'problems' ? problemCountEl :
                     avgScoreEl;

  selectedEl.classList.remove('text-3xl');
  selectedEl.classList.add('text-5xl', 'text-blue-600', 'dark:text-blue-400');
}

// ============================================
// Ranking List
// ============================================

/**
 * 랭킹 리스트 로드 및 표시
 */
async function loadRankings() {
  const rankingList = document.getElementById('ranking-list');
  rankingList.innerHTML = '<div class="text-center py-8 text-gray-500">로딩 중...</div>';

  try {
    const rankings = await fetchRankings(currentPeriod, currentCriteria);

    if (rankings.length === 0) {
      rankingList.innerHTML = `
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          <p class="text-lg">📭 아직 랭킹 데이터가 없습니다.</p>
          <p class="text-sm mt-2">문제를 풀고 랭킹에 도전해보세요!</p>
        </div>
      `;
      return;
    }

    renderRankingList(rankings);
  } catch (error) {
    console.error('❌ [Ranking] 랭킹 로드 실패:', error);
    rankingList.innerHTML = `
      <div class="text-center py-8 text-red-500">
        <p>랭킹을 불러오는데 실패했습니다.</p>
        <p class="text-sm mt-2">${error.message}</p>
      </div>
    `;
  }
}

/**
 * Phase 3.4: rankings 컬렉션에서 랭킹 데이터 가져오기
 * @param {string} period - 'daily', 'weekly', 'monthly'
 * @param {string} criteria - 'totalScore', 'problems', 'avgScore'
 * @returns {Promise<Array>} 랭킹 배열
 */
async function fetchRankings(period, criteria) {
  const rankingsRef = collection(db, 'rankings');

  // 현재 기간 키 (예: '2025-01-17', '2025-W03', '2025-01')
  const periodKey = getPeriodKeyForQuery();

  console.log(`📊 [Ranking] 랭킹 조회 시작 - period: ${period}, criteria: ${criteria}, periodKey: ${periodKey}`);

  // rankings 컬렉션에서 모든 사용자 가져오기
  const snapshot = await getDocs(rankingsRef);

  console.log(`🔍 [Ranking DEBUG] 총 ${snapshot.size}개의 ranking 문서 발견`);

  let rankings = [];
  snapshot.forEach(doc => {
    const rankingData = doc.data();
    console.log(`🔍 [Ranking DEBUG] 문서 ${doc.id}:`, rankingData);

    // 기간별 데이터 추출 (flat field structure)
    const fieldName = `${period}.${periodKey}`;
    const periodData = rankingData[fieldName];

    console.log(`🔍 [Ranking DEBUG] ${doc.id}의 필드명 "${fieldName}" 데이터:`, periodData);

    if (!periodData) {
      console.log(`🔍 [Ranking DEBUG] ${doc.id} - ${period}[${periodKey}] 데이터 없음, 제외`);
      return; // 해당 기간 데이터 없으면 제외
    }

    // ✅ 평균점수 기준일 때: 최소 문제 수 필터링
    if (criteria === 'avgScore') {
      const minProblems = MIN_PROBLEMS_FOR_AVG[period];
      console.log(`🔍 [Ranking DEBUG] ${doc.id} - avgScore 필터링: problems=${periodData.problems}, 최소=${minProblems}`);
      if (periodData.problems < minProblems) {
        console.log(`🔍 [Ranking DEBUG] ${doc.id} - 최소 문제 수 미달로 제외`);
        return; // 제외
      }
    }

    rankings.push({
      userId: rankingData.userId || doc.id,
      nickname: rankingData.nickname || '익명',
      totalScore: periodData.totalScore || 0,
      problems: periodData.problems || 0,
      avgScore: periodData.avgScore || 0
    });
  });

  // 기준에 따라 정렬
  rankings.sort((a, b) => {
    const aValue = a[criteria];
    const bValue = b[criteria];
    return bValue - aValue;
  });

  console.log(`✅ [Ranking] ${rankings.length}명의 랭킹 데이터 로드 완료`);

  return rankings;
}

/**
 * 현재 기간 키 생성 (쿼리용)
 */
function getPeriodKeyForQuery() {
  const now = new Date();

  if (currentPeriod === 'daily') {
    return now.toISOString().split('T')[0]; // '2025-01-17'
  }

  if (currentPeriod === 'weekly') {
    const year = now.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (now - firstDayOfYear) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`; // '2025-W03'
  }

  if (currentPeriod === 'monthly') {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`; // '2025-01'
  }

  return '';
}

/**
 * 랭킹 리스트 렌더링
 * @param {Array} rankings - 랭킹 배열
 */
function renderRankingList(rankings) {
  const rankingList = document.getElementById('ranking-list');
  const currentUser = getCurrentUser();

  let html = '';

  rankings.forEach((user, index) => {
    const rank = index + 1;
    const isMe = currentUser && user.userId === currentUser.uid;

    // 순위 표시 (메달 + 배경)
    let rankDisplay = '';
    let rankBadgeClass = '';

    if (rank === 1) {
      rankDisplay = '<span class="text-3xl">🥇</span>';
      rankBadgeClass = 'bg-yellow-100 dark:bg-yellow-900/30';
    } else if (rank === 2) {
      rankDisplay = '<span class="text-3xl">🥈</span>';
      rankBadgeClass = 'bg-gray-100 dark:bg-gray-700';
    } else if (rank === 3) {
      rankDisplay = '<span class="text-3xl">🥉</span>';
      rankBadgeClass = 'bg-orange-100 dark:bg-orange-900/30';
    } else if (rank <= 10) {
      rankDisplay = `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">${rank}</div>`;
    } else {
      rankDisplay = `<div class="text-gray-400 dark:text-gray-500 font-semibold text-lg">${rank}</div>`;
    }

    // 내 순위 강조 (매우 명확하게!)
    let cardClass = '';
    let meIndicator = '';

    if (isMe) {
      cardClass = 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 border-3 border-blue-500 shadow-lg shadow-blue-200 dark:shadow-blue-900/50';
      meIndicator = `
        <div class="absolute -left-2 top-1/2 -translate-y-1/2">
          <div class="bg-blue-500 text-white px-2 py-1 rounded-r-lg font-bold text-sm shadow-lg">
            ⭐ 내 순위
          </div>
        </div>
      `;
    } else {
      cardClass = `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${rankBadgeClass}`;
    }

    // 현재 선택된 기준 값 강조
    const criteriaValue = currentCriteria === 'totalScore' ? user.totalScore :
                          currentCriteria === 'problems' ? user.problems :
                          user.avgScore;

    const highlightCriteria = (criteria, value) => {
      const isHighlight = currentCriteria === criteria;
      const valueClass = isHighlight ? 'text-blue-600 dark:text-blue-400 font-extrabold text-xl' : 'font-bold text-gray-900 dark:text-gray-100 text-lg';
      const labelClass = isHighlight ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-500 dark:text-gray-400';

      return `
        <div class="text-center ${isHighlight ? 'transform scale-110' : ''}">
          <div class="${labelClass} text-xs mb-1">${criteria === 'totalScore' ? '총점수' : criteria === 'problems' ? '문풀횟수' : '평균점수'}</div>
          <div class="${valueClass}">${typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value.toLocaleString()}</div>
        </div>
      `;
    };

    html += `
      <div class="${cardClass} rounded-xl p-5 mb-4 transition-all hover:shadow-xl hover:scale-[1.02] relative overflow-visible">
        ${meIndicator}
        <div class="flex items-center justify-between gap-6">
          <!-- 순위 -->
          <div class="flex items-center justify-center w-16">
            ${rankDisplay}
          </div>

          <!-- 닉네임 -->
          <div class="flex-1">
            <div class="${isMe ? 'text-blue-900 dark:text-blue-100 font-bold text-lg' : 'font-semibold text-gray-900 dark:text-gray-100'}">
              ${user.nickname}
            </div>
          </div>

          <!-- 통계 (순서: 총점수, 문풀횟수, 평균점수) -->
          <div class="flex gap-8">
            ${highlightCriteria('totalScore', user.totalScore)}
            ${highlightCriteria('problems', user.problems)}
            ${highlightCriteria('avgScore', user.avgScore)}
          </div>
        </div>
      </div>
    `;
  });

  // 평균점수 기준일 때 안내 메시지 추가
  if (currentCriteria === 'avgScore') {
    const minProblems = MIN_PROBLEMS_FOR_AVG[currentPeriod];
    html = `
      <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
        <p class="text-sm text-yellow-800 dark:text-yellow-200">
          💡 평균점수 랭킹은 최소 <strong>${minProblems}문제</strong> 이상 푼 사용자만 표시됩니다.
        </p>
      </div>
    ` + html;
  }

  rankingList.innerHTML = html;
}

// ============================================
// Filter Handlers
// ============================================

/**
 * 기간 필터 변경
 * @param {string} period - 'daily', 'weekly', 'monthly'
 */
async function changePeriod(period) {
  currentPeriod = period;

  // 버튼 활성화 상태 업데이트
  document.querySelectorAll('[data-period]').forEach(btn => {
    if (btn.dataset.period === period) {
      btn.classList.add('bg-blue-500', 'text-white');
      btn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
    } else {
      btn.classList.remove('bg-blue-500', 'text-white');
      btn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
    }
  });

  // 데이터 다시 로드
  await updateMyStatsDisplay();
  await loadRankings();
}

/**
 * 기준 필터 변경
 * @param {string} criteria - 'totalScore', 'problems', 'avgScore'
 */
async function changeCriteria(criteria) {
  currentCriteria = criteria;

  // 버튼 활성화 상태 업데이트
  document.querySelectorAll('[data-criteria]').forEach(btn => {
    if (btn.dataset.criteria === criteria) {
      btn.classList.add('bg-blue-500', 'text-white');
      btn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
    } else {
      btn.classList.remove('bg-blue-500', 'text-white');
      btn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
    }
  });

  // 데이터 다시 로드
  await loadRankings();
}

// ============================================
// Event Listeners 초기화
// ============================================

/**
 * 랭킹 UI 이벤트 리스너 초기화
 */
export function initRankingUI() {
  // 모달 닫기 버튼
  const closeBtn = document.getElementById('ranking-close-btn');
  closeBtn?.addEventListener('click', closeRankingModal);

  // 기간 필터 버튼들
  document.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      changePeriod(btn.dataset.period);
    });
  });

  // 기준 필터 버튼들
  document.querySelectorAll('[data-criteria]').forEach(btn => {
    btn.addEventListener('click', () => {
      changeCriteria(btn.dataset.criteria);
    });
  });

  console.log('✅ Ranking UI 모듈 초기화 완료');
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
  window.RankingUI = {
    openRankingModal,
    closeRankingModal
  };
}
