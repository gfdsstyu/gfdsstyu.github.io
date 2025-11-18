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
import { getMyRanking, getGroupRankings, getIntraGroupRankings } from './rankingCore.js';
import { getMyGroups } from '../group/groupCore.js';
import { showToast } from '../../ui/domUtils.js';

// ============================================
// State
// ============================================

let currentPeriod = 'daily';
let currentCriteria = 'totalScore';

// Phase 3.5.1: 탭 상태
let currentMainTab = 'global'; // 'global', 'groups', 'classes'
let currentGroupSubtab = 'group-level'; // 'group-level', 'intra-group'
let currentClassSubtab = 'class-level'; // 'class-level', 'intra-class'

// Phase 3.5.4: 그룹 내 랭킹용 선택된 그룹
let selectedGroupId = null;

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

  // Phase 3.5.1: 탭 초기화
  currentMainTab = 'global';
  currentGroupSubtab = 'group-level';
  currentClassSubtab = 'class-level';
  switchMainTab('global');

  // 내 통계 업데이트 (전체 탭 전용)
  await updateMyStatsDisplay();

  // 랭킹 리스트 로드 (전체 탭 전용)
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
// Phase 3.5.1: Tab Switching
// ============================================

/**
 * 메인 탭 전환
 * @param {string} tab - 'global', 'groups', 'classes'
 */
function switchMainTab(tab) {
  currentMainTab = tab;

  // 모든 탭 콘텐츠 숨기기
  document.querySelectorAll('.ranking-tab-content').forEach(content => {
    content.classList.add('hidden');
  });

  // 선택된 탭 콘텐츠 표시
  const selectedTabContent = document.getElementById(`ranking-tab-${tab}`);
  selectedTabContent?.classList.remove('hidden');

  // 탭 버튼 활성화 상태 업데이트
  document.querySelectorAll('.ranking-main-tab').forEach(btn => {
    if (btn.dataset.tab === tab) {
      btn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
      btn.classList.add('bg-blue-600', 'dark:bg-blue-500', 'text-white');
    } else {
      btn.classList.remove('bg-blue-600', 'dark:bg-blue-500', 'text-white');
      btn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
    }
  });

  // 로그인 상태에 따른 UI 표시
  const currentUser = getCurrentUser();

  if (tab === 'groups') {
    updateGroupsTabUI(currentUser);
  } else if (tab === 'classes') {
    updateClassesTabUI(currentUser);
  }
}

/**
 * 그룹 탭 UI 업데이트
 */
async function updateGroupsTabUI(currentUser) {
  const loginRequired = document.getElementById('groups-login-required');
  const groupsContent = document.getElementById('groups-content');
  const emptyState = document.getElementById('groups-empty-state');

  if (!currentUser) {
    // 로그인 안 됨
    loginRequired?.classList.remove('hidden');
    groupsContent?.classList.add('hidden');
    emptyState?.classList.add('hidden');
    return;
  }

  // 로그인 됨
  loginRequired?.classList.add('hidden');

  // Phase 3.5.3: 실제 그룹 가입 여부 확인
  try {
    const myGroups = await getMyGroups();

    if (myGroups && myGroups.length > 0) {
      // 그룹에 가입되어 있음 - 콘텐츠 표시
      groupsContent?.classList.remove('hidden');
      emptyState?.classList.add('hidden');

      // 현재 서브탭에 따라 데이터 로드
      if (currentGroupSubtab === 'group-level') {
        await loadGroupLevelRankings();
      } else if (currentGroupSubtab === 'intra-group') {
        await loadIntraGroupRankings(myGroups);
      }
    } else {
      // 그룹에 가입하지 않음 - 빈 상태 표시
      groupsContent?.classList.add('hidden');
      emptyState?.classList.remove('hidden');
    }
  } catch (error) {
    console.error('❌ [RankingUI] 그룹 목록 조회 실패:', error);
    groupsContent?.classList.add('hidden');
    emptyState?.classList.remove('hidden');
  }
}

/**
 * 고시반 탭 UI 업데이트
 */
function updateClassesTabUI(currentUser) {
  const loginRequired = document.getElementById('classes-login-required');
  const classesContent = document.getElementById('classes-content');
  const emptyState = document.getElementById('classes-empty-state');

  if (!currentUser) {
    // 로그인 안 됨
    loginRequired?.classList.remove('hidden');
    classesContent?.classList.add('hidden');
    emptyState?.classList.add('hidden');
    return;
  }

  // 로그인 됨
  loginRequired?.classList.add('hidden');

  // TODO: Phase 3.6에서 실제 고시반 가입 여부 확인
  // 현재는 빈 상태만 표시
  classesContent?.classList.add('hidden');
  emptyState?.classList.remove('hidden');
}

/**
 * 그룹 서브 탭 전환
 * @param {string} subtab - 'group-level', 'intra-group'
 */
async function switchGroupSubtab(subtab) {
  currentGroupSubtab = subtab;

  // 모든 서브 탭 콘텐츠 숨기기
  document.querySelectorAll('.ranking-group-subtab-content').forEach(content => {
    content.classList.add('hidden');
  });

  // 선택된 서브 탭 콘텐츠 표시
  const selectedContent = document.getElementById(`${subtab}-content`);
  selectedContent?.classList.remove('hidden');

  // 서브 탭 버튼 활성화 상태 업데이트
  document.querySelectorAll('.ranking-group-subtab').forEach(btn => {
    if (btn.dataset.subtab === subtab) {
      btn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
      btn.classList.add('bg-green-600', 'dark:bg-green-500', 'text-white');
    } else {
      btn.classList.remove('bg-green-600', 'dark:bg-green-500', 'text-white');
      btn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
    }
  });

  // 데이터 로드
  if (subtab === 'group-level') {
    await loadGroupLevelRankings();
  } else if (subtab === 'intra-group') {
    const myGroups = await getMyGroups();
    await loadIntraGroupRankings(myGroups);
  }
}

/**
 * 고시반 서브 탭 전환
 * @param {string} subtab - 'class-level', 'intra-class'
 */
function switchClassSubtab(subtab) {
  currentClassSubtab = subtab;

  // 모든 서브 탭 콘텐츠 숨기기
  document.querySelectorAll('.ranking-class-subtab-content').forEach(content => {
    content.classList.add('hidden');
  });

  // 선택된 서브 탭 콘텐츠 표시
  const selectedContent = document.getElementById(`${subtab}-content`);
  selectedContent?.classList.remove('hidden');

  // 서브 탭 버튼 활성화 상태 업데이트
  document.querySelectorAll('.ranking-class-subtab').forEach(btn => {
    if (btn.dataset.subtab === subtab) {
      btn.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
      btn.classList.add('bg-purple-600', 'dark:bg-purple-500', 'text-white');
    } else {
      btn.classList.remove('bg-purple-600', 'dark:bg-purple-500', 'text-white');
      btn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
    }
  });
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
 * 랭킹 리스트 렌더링 (UI 개선 버전)
 * @param {Array} rankings - 랭킹 배열
 */
function renderRankingList(rankings) {
  const rankingList = document.getElementById('ranking-list');
  const currentUser = getCurrentUser();

  let html = '';

  rankings.forEach((user, index) => {
    const rank = index + 1;
    const isMe = currentUser && user.userId === currentUser.uid;

    // 순위 표시
    let rankDisplay = '';

    if (rank === 1) {
      rankDisplay = '<div class="text-4xl">🥇</div>';
    } else if (rank === 2) {
      rankDisplay = '<div class="text-4xl">🥈</div>';
    } else if (rank === 3) {
      rankDisplay = '<div class="text-4xl">🥉</div>';
    } else if (rank <= 10) {
      rankDisplay = `<div class="w-12 h-12 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center text-white font-bold text-lg">${rank}</div>`;
    } else {
      rankDisplay = `<div class="text-gray-500 dark:text-gray-400 font-bold text-xl">${rank}</div>`;
    }

    // 내 순위 강조
    let cardClass = '';
    let myBadge = '';

    if (isMe) {
      cardClass = 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-600 dark:border-blue-400 shadow-lg';
      myBadge = `
        <div class="absolute top-2 right-2 bg-blue-600 dark:bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold">
          ⭐ 내 순위
        </div>
      `;
    } else {
      cardClass = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700';
    }

    // 통계 렌더링
    const renderStat = (label, value, criteria) => {
      const isHighlight = currentCriteria === criteria;

      // 하이라이트 시 더 크고 강조
      const containerClass = isHighlight
        ? 'bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500 dark:border-blue-400 rounded-lg px-3 py-2'
        : 'bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2';

      const labelClass = isHighlight
        ? 'text-blue-700 dark:text-blue-300 font-bold text-xs'
        : 'text-gray-600 dark:text-gray-400 font-medium text-xs';

      const valueClass = isHighlight
        ? 'text-blue-900 dark:text-blue-100 font-extrabold text-2xl'
        : 'text-gray-900 dark:text-gray-100 font-bold text-lg';

      const displayValue = typeof value === 'number' && value % 1 !== 0
        ? value.toFixed(1)
        : value.toLocaleString();

      return `
        <div class="${containerClass}">
          <div class="${labelClass} mb-1 whitespace-nowrap">${label}</div>
          <div class="${valueClass}">${displayValue}</div>
        </div>
      `;
    };

    html += `
      <div class="${cardClass} rounded-xl p-4 mb-3 transition-all hover:shadow-lg relative">
        ${myBadge}

        <!-- 상단: 순위 + 닉네임 -->
        <div class="flex items-center gap-4 mb-3">
          <div class="flex items-center justify-center w-16 flex-shrink-0">
            ${rankDisplay}
          </div>
          <div class="flex-1 min-w-0">
            <div class="${isMe ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'} font-bold text-lg truncate">
              ${user.nickname}
            </div>
          </div>
        </div>

        <!-- 하단: 통계 (순서: 총점수, 문풀횟수, 평균점수) -->
        <div class="grid grid-cols-3 gap-2">
          ${renderStat('📊 총점수', user.totalScore, 'totalScore')}
          ${renderStat('✍️ 문풀', user.problems, 'problems')}
          ${renderStat('⭐ 평균', user.avgScore, 'avgScore')}
        </div>
      </div>
    `;
  });

  // 평균점수 기준일 때 안내 메시지 추가
  if (currentCriteria === 'avgScore') {
    const minProblems = MIN_PROBLEMS_FOR_AVG[currentPeriod];
    html = `
      <div class="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-4 mb-4">
        <p class="text-sm text-yellow-900 dark:text-yellow-100 font-medium">
          💡 평균점수 랭킹은 최소 <strong class="text-yellow-700 dark:text-yellow-300">${minProblems}문제</strong> 이상 푼 사용자만 표시됩니다.
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
// Phase 3.5.3: 그룹별 랭킹
// ============================================

/**
 * 그룹별 랭킹 로드 및 표시
 */
async function loadGroupLevelRankings() {
  const groupLevelList = document.getElementById('group-level-list');
  if (!groupLevelList) return;

  groupLevelList.innerHTML = '<div class="text-center py-8 text-gray-500">로딩 중...</div>';

  try {
    const groupRankings = await getGroupRankings(currentPeriod, currentCriteria);

    if (groupRankings.length === 0) {
      groupLevelList.innerHTML = `
        <div class="text-center py-12 text-gray-500 dark:text-gray-400">
          <p class="text-lg mb-2">📭 아직 그룹 랭킹 데이터가 없습니다.</p>
          <p class="text-sm">그룹원들이 문제를 풀면 랭킹이 집계됩니다!</p>
        </div>
      `;
      return;
    }

    renderGroupRankings(groupRankings);
  } catch (error) {
    console.error('❌ [RankingUI] 그룹별 랭킹 로드 실패:', error);
    groupLevelList.innerHTML = `
      <div class="text-center py-8 text-red-500">
        <p>그룹 랭킹을 불러오는데 실패했습니다.</p>
        <p class="text-sm mt-2">${error.message}</p>
      </div>
    `;
  }
}

/**
 * 그룹별 랭킹 리스트 렌더링
 * @param {Array} groupRankings - 그룹 랭킹 배열
 */
function renderGroupRankings(groupRankings) {
  const groupLevelList = document.getElementById('group-level-list');
  if (!groupLevelList) return;

  const currentUser = getCurrentUser();

  let html = '';

  groupRankings.forEach((group, index) => {
    const rank = index + 1;

    // 순위 표시
    let rankDisplay = '';
    if (rank === 1) {
      rankDisplay = '<div class="text-4xl">🥇</div>';
    } else if (rank === 2) {
      rankDisplay = '<div class="text-4xl">🥈</div>';
    } else if (rank === 3) {
      rankDisplay = '<div class="text-4xl">🥉</div>';
    } else if (rank <= 10) {
      rankDisplay = `<div class="w-12 h-12 rounded-full bg-green-600 dark:bg-green-500 flex items-center justify-center text-white font-bold text-lg">${rank}</div>`;
    } else {
      rankDisplay = `<div class="text-gray-500 dark:text-gray-400 font-bold text-xl">${rank}</div>`;
    }

    // 통계 렌더링
    const renderStat = (label, value, criteria) => {
      const isHighlight = currentCriteria === criteria;

      const containerClass = isHighlight
        ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-500 dark:border-green-400 rounded-lg px-3 py-2'
        : 'bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2';

      const labelClass = isHighlight
        ? 'text-green-700 dark:text-green-300 font-bold text-xs'
        : 'text-gray-600 dark:text-gray-400 font-medium text-xs';

      const valueClass = isHighlight
        ? 'text-green-900 dark:text-green-100 font-extrabold text-2xl'
        : 'text-gray-900 dark:text-gray-100 font-bold text-lg';

      const displayValue = typeof value === 'number' && value % 1 !== 0
        ? value.toFixed(1)
        : value.toLocaleString();

      return `
        <div class="${containerClass}">
          <div class="${labelClass} mb-1 whitespace-nowrap">${label}</div>
          <div class="${valueClass}">${displayValue}</div>
        </div>
      `;
    };

    html += `
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-3 transition-all hover:shadow-lg">
        <!-- 상단: 순위 + 그룹명 + 인원 -->
        <div class="flex items-center gap-4 mb-3">
          <div class="flex items-center justify-center w-16 flex-shrink-0">
            ${rankDisplay}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-gray-900 dark:text-gray-100 font-bold text-lg truncate">
              ${group.groupName}
            </div>
            <div class="text-gray-600 dark:text-gray-400 text-sm mt-1">
              👥 ${group.memberCount}명
            </div>
          </div>
        </div>

        <!-- 하단: 통계 (순서: 총점수, 문풀횟수, 평균점수) -->
        <div class="grid grid-cols-3 gap-2">
          ${renderStat('📊 총점수', group.totalScore, 'totalScore')}
          ${renderStat('✍️ 문풀', group.problems, 'problems')}
          ${renderStat('⭐ 평균', group.avgScore, 'avgScore')}
        </div>
      </div>
    `;
  });

  groupLevelList.innerHTML = html;
}

// ============================================
// Phase 3.5.4: 그룹 내 랭킹
// ============================================

/**
 * 그룹 내 랭킹 로드 및 표시
 * @param {Array} myGroups - 내가 가입한 그룹 목록
 */
async function loadIntraGroupRankings(myGroups) {
  const intraGroupContainer = document.getElementById('intra-group-content');
  if (!intraGroupContainer) return;

  // 그룹 선택 드롭다운 + 랭킹 리스트
  if (!myGroups || myGroups.length === 0) {
    intraGroupContainer.innerHTML = `
      <div class="text-center py-12 text-gray-500 dark:text-gray-400">
        <p class="text-lg">가입한 그룹이 없습니다.</p>
      </div>
    `;
    return;
  }

  // 첫 번째 그룹 자동 선택
  if (!selectedGroupId) {
    selectedGroupId = myGroups[0].groupId;
  }

  // 그룹 선택 드롭다운 렌더링
  let groupSelectHtml = `
    <div class="mb-4">
      <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">📋 그룹 선택</label>
      <select id="intra-group-select" class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">
  `;

  myGroups.forEach(group => {
    const selected = group.groupId === selectedGroupId ? 'selected' : '';
    groupSelectHtml += `<option value="${group.groupId}" ${selected}>${group.name} (${group.memberCount}명)</option>`;
  });

  groupSelectHtml += `
      </select>
    </div>
    <div id="intra-group-list">
      <div class="text-center py-8 text-gray-500 dark:text-gray-400">로딩 중...</div>
    </div>
  `;

  intraGroupContainer.innerHTML = groupSelectHtml;

  // 드롭다운 이벤트 리스너
  const selectElement = document.getElementById('intra-group-select');
  selectElement?.addEventListener('change', (e) => {
    selectedGroupId = e.target.value;
    loadIntraGroupRankingData(selectedGroupId);
  });

  // 선택된 그룹의 랭킹 로드
  await loadIntraGroupRankingData(selectedGroupId);
}

/**
 * 선택된 그룹의 멤버 랭킹 데이터 로드
 * @param {string} groupId - 그룹 ID
 */
async function loadIntraGroupRankingData(groupId) {
  const intraGroupList = document.getElementById('intra-group-list');
  if (!intraGroupList) return;

  intraGroupList.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">로딩 중...</div>';

  try {
    const rankings = await getIntraGroupRankings(groupId, currentPeriod, currentCriteria);

    if (rankings.length === 0) {
      intraGroupList.innerHTML = `
        <div class="text-center py-12 text-gray-500 dark:text-gray-400">
          <p class="text-lg mb-2">📭 아직 랭킹 데이터가 없습니다.</p>
          <p class="text-sm">그룹원들이 문제를 풀면 랭킹이 집계됩니다!</p>
        </div>
      `;
      return;
    }

    renderIntraGroupRankings(rankings);
  } catch (error) {
    console.error('❌ [RankingUI] 그룹 내 랭킹 로드 실패:', error);
    intraGroupList.innerHTML = `
      <div class="text-center py-8 text-red-500 dark:text-red-400">
        <p>그룹 내 랭킹을 불러오는데 실패했습니다.</p>
        <p class="text-sm mt-2">${error.message}</p>
      </div>
    `;
  }
}

/**
 * 그룹 내 멤버 랭킹 리스트 렌더링
 * @param {Array} rankings - 그룹 멤버 랭킹 배열
 */
function renderIntraGroupRankings(rankings) {
  const intraGroupList = document.getElementById('intra-group-list');
  if (!intraGroupList) return;

  const currentUser = getCurrentUser();
  let html = '';

  rankings.forEach((user, index) => {
    const rank = index + 1;
    const isMe = currentUser && user.userId === currentUser.uid;

    // 순위 표시
    let rankDisplay = '';
    if (rank === 1) {
      rankDisplay = '<div class="text-4xl">🥇</div>';
    } else if (rank === 2) {
      rankDisplay = '<div class="text-4xl">🥈</div>';
    } else if (rank === 3) {
      rankDisplay = '<div class="text-4xl">🥉</div>';
    } else if (rank <= 10) {
      rankDisplay = `<div class="w-12 h-12 rounded-full bg-green-600 dark:bg-green-500 flex items-center justify-center text-white font-bold text-lg">${rank}</div>`;
    } else {
      rankDisplay = `<div class="text-gray-500 dark:text-gray-400 font-bold text-xl">${rank}</div>`;
    }

    // 내 순위 강조
    let cardClass = '';
    let myBadge = '';

    if (isMe) {
      cardClass = 'bg-green-100 dark:bg-green-900/50 border-2 border-green-600 dark:border-green-400 shadow-lg';
      myBadge = `
        <div class="absolute top-2 right-2 bg-green-600 dark:bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
          ⭐ 내 순위
        </div>
      `;
    } else {
      cardClass = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700';
    }

    // 통계 렌더링
    const renderStat = (label, value, criteria) => {
      const isHighlight = currentCriteria === criteria;

      const containerClass = isHighlight
        ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-500 dark:border-green-400 rounded-lg px-3 py-2'
        : 'bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2';

      const labelClass = isHighlight
        ? 'text-green-700 dark:text-green-300 font-bold text-xs'
        : 'text-gray-600 dark:text-gray-400 font-medium text-xs';

      const valueClass = isHighlight
        ? 'text-green-900 dark:text-green-100 font-extrabold text-2xl'
        : 'text-gray-900 dark:text-gray-100 font-bold text-lg';

      const displayValue = typeof value === 'number' && value % 1 !== 0
        ? value.toFixed(1)
        : value.toLocaleString();

      return `
        <div class="${containerClass}">
          <div class="${labelClass} mb-1 whitespace-nowrap">${label}</div>
          <div class="${valueClass}">${displayValue}</div>
        </div>
      `;
    };

    html += `
      <div class="${cardClass} rounded-xl p-4 mb-3 transition-all hover:shadow-lg relative">
        ${myBadge}

        <!-- 상단: 순위 + 닉네임 -->
        <div class="flex items-center gap-4 mb-3">
          <div class="flex items-center justify-center w-16 flex-shrink-0">
            ${rankDisplay}
          </div>
          <div class="flex-1 min-w-0">
            <div class="${isMe ? 'text-green-900 dark:text-green-100' : 'text-gray-900 dark:text-gray-100'} font-bold text-lg truncate">
              ${user.nickname}
            </div>
          </div>
        </div>

        <!-- 하단: 통계 (순서: 총점수, 문풀횟수, 평균점수) -->
        <div class="grid grid-cols-3 gap-2">
          ${renderStat('📊 총점수', user.totalScore, 'totalScore')}
          ${renderStat('✍️ 문풀', user.problems, 'problems')}
          ${renderStat('⭐ 평균', user.avgScore, 'avgScore')}
        </div>
      </div>
    `;
  });

  intraGroupList.innerHTML = html;
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

  // Phase 3.5.1: 메인 탭 버튼들
  document.querySelectorAll('.ranking-main-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchMainTab(btn.dataset.tab);
    });
  });

  // Phase 3.5.1: 그룹 서브 탭 버튼들
  document.querySelectorAll('.ranking-group-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchGroupSubtab(btn.dataset.subtab);
    });
  });

  // Phase 3.5.1: 고시반 서브 탭 버튼들
  document.querySelectorAll('.ranking-class-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchClassSubtab(btn.dataset.subtab);
    });
  });

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

  console.log('✅ Ranking UI 모듈 초기화 완료 (Phase 3.5.1: 탭 구조 포함)');
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
