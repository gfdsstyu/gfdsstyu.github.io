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
import { getMyGroups, updateGroupDescription, getGroupMembers, kickMember, deleteGroup } from '../group/groupCore.js';
import { handleLeaveGroup } from '../group/groupUI.js';
import { getMyUniversity, getUniversityRankings, getIntraUniversityRankings } from '../university/universityCore.js';
import { showToast } from '../../ui/domUtils.js';

// ============================================
// State
// ============================================

let currentPeriod = 'daily';
let currentCriteria = 'totalScore';

// Phase 3.5.1: 탭 상태
let currentMainTab = 'global'; // 'global', 'all-groups', 'all-classes', 'my-groups', 'my-classes'
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

  if (tab === 'all-groups') {
    updateGroupsTabUI(currentUser);
  } else if (tab === 'all-classes') {
    updateClassesTabUI(currentUser);
  } else if (tab === 'my-groups') {
    updateMyGroupsTabUI(currentUser);
  } else if (tab === 'my-classes') {
    updateMyClassesTabUI(currentUser);
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
async function updateClassesTabUI(currentUser) {
  const loginRequired = document.getElementById('classes-login-required');
  const verifyRequired = document.getElementById('classes-verify-required');
  const classesContent = document.getElementById('classes-content');

  if (!currentUser) {
    // 로그인 안 됨
    loginRequired?.classList.remove('hidden');
    verifyRequired?.classList.add('hidden');
    classesContent?.classList.add('hidden');
    return;
  }

  // 로그인 됨
  loginRequired?.classList.add('hidden');

  // Phase 3.6: 대학교 인증 여부 확인
  const universityInfo = await getMyUniversity();

  if (!universityInfo) {
    // 대학교 미인증
    verifyRequired?.classList.remove('hidden');
    classesContent?.classList.add('hidden');
    return;
  }

  // 대학교 인증 완료
  verifyRequired?.classList.add('hidden');
  classesContent?.classList.remove('hidden');

  // 현재 서브탭에 따라 데이터 로드
  if (currentClassSubtab === 'class-level') {
    await loadUniversityLevelRankings();
  } else if (currentClassSubtab === 'intra-class') {
    await loadIntraUniversityRankings(universityInfo.university);
  }
}

/**
 * 내 그룹 관리 탭 UI 업데이트
 */
async function updateMyGroupsTabUI(currentUser) {
  const loginRequired = document.getElementById('my-groups-login-required');
  const myGroupsContent = document.getElementById('my-groups-content');

  if (!currentUser) {
    // 로그인 안 됨
    loginRequired?.classList.remove('hidden');
    myGroupsContent?.classList.add('hidden');
    return;
  }

  // 로그인 됨
  loginRequired?.classList.add('hidden');
  myGroupsContent?.classList.remove('hidden');

  // 내 그룹 목록 로드
  await loadMyGroupsList();
}

/**
 * 내 고시반 관리 탭 UI 업데이트
 */
function updateMyClassesTabUI(currentUser) {
  // TODO: Phase 3.6에서 구현
  console.log('📚 [RankingUI] 내 고시반 탭 (미구현)');
}

/**
 * 내 그룹 목록 로드 및 표시
 */
async function loadMyGroupsList() {
  const myGroupsList = document.getElementById('my-groups-list');
  const myGroupsCount = document.getElementById('my-groups-count');

  if (!myGroupsList) return;

  myGroupsList.innerHTML = '<p class="text-center py-8 text-gray-500">로딩 중...</p>';

  try {
    const myGroups = await getMyGroups();
    const currentUser = getCurrentUser();

    // 그룹 수 업데이트
    if (myGroupsCount) {
      myGroupsCount.textContent = `(${myGroups.length}/3)`;
    }

    if (myGroups.length === 0) {
      myGroupsList.innerHTML = `
        <div class="text-center py-12 text-gray-500 dark:text-gray-400">
          <p class="text-lg mb-2">📭 아직 가입한 그룹이 없습니다.</p>
          <p class="text-sm">그룹을 만들거나 검색해서 가입해보세요!</p>
        </div>
      `;
      return;
    }

    renderMyGroupsList(myGroups, currentUser);
  } catch (error) {
    console.error('❌ [RankingUI] 내 그룹 목록 로드 실패:', error);
    myGroupsList.innerHTML = `
      <div class="text-center py-8 text-red-500 dark:text-red-400">
        <p>그룹 목록을 불러오는데 실패했습니다.</p>
        <p class="text-sm mt-2">${error.message}</p>
      </div>
    `;
  }
}

/**
 * 그룹 관리 UI 열기/닫기 토글
 * @param {string} groupId - 그룹 ID
 */
async function openGroupManagement(groupId) {
  const managementSection = document.getElementById(`group-management-${groupId}`);

  // 이미 열려있으면 닫기
  if (managementSection && !managementSection.classList.contains('hidden')) {
    managementSection.classList.add('hidden');
    return;
  }

  // 다른 모든 관리 섹션 닫기
  document.querySelectorAll('[id^="group-management-"]').forEach(section => {
    section.classList.add('hidden');
  });

  // 관리 섹션이 없으면 생성
  if (!managementSection) {
    await loadGroupManagementUI(groupId);
  } else {
    managementSection.classList.remove('hidden');
  }
}

/**
 * 그룹 관리 UI 로드
 * @param {string} groupId - 그룹 ID
 */
async function loadGroupManagementUI(groupId) {
  const groupCard = document.querySelector(`[data-group-id="${groupId}"]`);
  if (!groupCard) return;

  // 로딩 표시
  const loadingHtml = `
    <div id="group-management-${groupId}" class="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
      <p class="text-center text-gray-500 dark:text-gray-400">로딩 중...</p>
    </div>
  `;
  groupCard.insertAdjacentHTML('beforeend', loadingHtml);

  try {
    // 그룹 정보와 멤버 로드
    const myGroups = await getMyGroups();
    const group = myGroups.find(g => g.groupId === groupId);
    const members = await getGroupMembers(groupId);

    if (!group) return;

    const managementSection = document.getElementById(`group-management-${groupId}`);
    if (!managementSection) return;

    // 관리 UI 렌더링
    let html = `
      <div class="space-y-4">
        <!-- 그룹 설명 수정 -->
        <div>
          <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">📝 그룹 설명 수정</label>
          <textarea
            id="edit-description-${groupId}"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none"
            rows="2"
            placeholder="그룹 설명을 입력하세요"
          >${group.description || ''}</textarea>
          <div class="mt-2 flex items-center justify-between">
            <button
              onclick="window.RankingUI?.handleUpdateDescription('${groupId}');"
              class="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white font-bold text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition"
            >
              💾 저장
            </button>
            <button
              onclick="window.RankingUI?.handleDeleteGroup('${groupId}', '${group.name.replace(/'/g, "\\'")}')"
              class="text-red-600 dark:text-red-400 text-xs hover:text-red-800 dark:hover:text-red-300 hover:underline transition"
              title="그룹을 삭제하면 모든 데이터가 영구적으로 삭제됩니다."
            >
              🗑️ 그룹 삭제
            </button>
          </div>
        </div>

        <!-- 그룹원 관리 -->
        <div>
          <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">👥 그룹원 관리 (${members.length}명)</label>
          <div class="space-y-2 max-h-60 overflow-y-auto">
    `;

    members.forEach(member => {
      const isOwner = member.role === 'owner';
      html += `
        <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">${member.nickname}</span>
            ${isOwner ? '<span class="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-bold rounded-full">👑</span>' : ''}
          </div>
          ${isOwner ? '' : `
            <button
              onclick="window.RankingUI?.handleKickMember('${groupId}', '${member.userId}', '${member.nickname.replace(/'/g, "\\'")}');"
              class="px-3 py-1 bg-red-600 dark:bg-red-500 text-white font-bold text-xs rounded hover:bg-red-700 dark:hover:bg-red-600 transition"
            >
              강퇴
            </button>
          `}
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;

    managementSection.innerHTML = html;
  } catch (error) {
    console.error('❌ [RankingUI] 그룹 관리 UI 로드 실패:', error);
    const managementSection = document.getElementById(`group-management-${groupId}`);
    if (managementSection) {
      managementSection.innerHTML = '<p class="text-center text-red-500 dark:text-red-400">관리 정보를 불러오는데 실패했습니다.</p>';
    }
  }
}

/**
 * 그룹 설명 업데이트 처리
 * @param {string} groupId - 그룹 ID
 */
async function handleUpdateDescription(groupId) {
  const textarea = document.getElementById(`edit-description-${groupId}`);
  if (!textarea) return;

  const newDescription = textarea.value;

  try {
    const result = await updateGroupDescription(groupId, newDescription);

    if (result.success) {
      showToast(result.message, 'success');
      // 그룹 목록 새로고침
      await loadMyGroupsList();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('❌ [RankingUI] 그룹 설명 업데이트 오류:', error);
    showToast('설명 수정 중 오류가 발생했습니다.', 'error');
  }
}

/**
 * 그룹원 강퇴 처리
 * @param {string} groupId - 그룹 ID
 * @param {string} userId - 사용자 ID
 * @param {string} nickname - 닉네임
 */
async function handleKickMember(groupId, userId, nickname) {
  const confirmed = confirm(`"${nickname}" 님을 그룹에서 강퇴하시겠습니까?`);

  if (!confirmed) return;

  try {
    const result = await kickMember(groupId, userId);

    if (result.success) {
      showToast(result.message, 'success');
      // 관리 UI 새로고침
      document.getElementById(`group-management-${groupId}`)?.remove();
      await loadGroupManagementUI(groupId);
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('❌ [RankingUI] 그룹원 강퇴 오류:', error);
    showToast('강퇴 중 오류가 발생했습니다.', 'error');
  }
}

/**
 * 그룹 삭제 처리
 * @param {string} groupId - 그룹 ID
 * @param {string} groupName - 그룹 이름
 */
async function handleDeleteGroup(groupId, groupName) {
  const confirmed = confirm(`정말 "${groupName}" 그룹을 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.`);

  if (!confirmed) return;

  try {
    const result = await deleteGroup(groupId);

    if (result.success) {
      showToast(result.message, 'success');
      // 랭킹 모달 닫기
      closeRankingModal();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('❌ [RankingUI] 그룹 삭제 오류:', error);
    showToast('그룹 삭제 중 오류가 발생했습니다.', 'error');
  }
}

/**
 * 내 그룹 목록 렌더링
 * @param {Array} groups - 그룹 배열
 * @param {Object} currentUser - 현재 사용자
 */
function renderMyGroupsList(groups, currentUser) {
  const myGroupsList = document.getElementById('my-groups-list');
  if (!myGroupsList) return;

  let html = '';

  groups.forEach(group => {
    const isOwner = group.ownerId === currentUser.uid;
    const ownerBadge = isOwner ? `
      <span class="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-bold rounded-full">
        👑 그룹장
      </span>
    ` : '';

    html += `
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-3" data-group-id="${group.groupId}">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100">
                ${group.name}
              </h4>
              ${ownerBadge}
            </div>
            ${group.description ? `
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                ${group.description}
              </p>
            ` : ''}
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>👥 ${group.memberCount}/${group.maxMembers}명</span>
            ${group.isPublic ? '<span>🌍 공개</span>' : '<span>🔒 비공개</span>'}
          </div>

          ${isOwner ? `
            <button
              onclick="window.RankingUI?.openGroupManagement('${group.groupId}');"
              class="px-4 py-2 rounded-lg font-bold text-sm bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600 transition"
            >
              ⚙️ 관리
            </button>
          ` : `
            <button
              onclick="window.GroupUI?.handleLeaveGroup('${group.groupId}', '${group.name.replace(/'/g, "\\'")}');"
              class="px-4 py-2 rounded-lg font-bold text-sm bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 transition"
            >
              탈퇴하기
            </button>
          `}
        </div>
      </div>
    `;
  });

  myGroupsList.innerHTML = html;
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
async function switchClassSubtab(subtab) {
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

  // 데이터 로드
  if (subtab === 'class-level') {
    await loadUniversityLevelRankings();
  } else if (subtab === 'intra-class') {
    const universityInfo = await getMyUniversity();
    if (universityInfo) {
      await loadIntraUniversityRankingsData(universityInfo.university);
    }
  }
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
        <span class="ml-2 bg-blue-600 dark:bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
          ⭐ 내 순위
        </span>
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

    // 통계를 한 줄로 간략히
    const totalScoreStr = typeof user.totalScore === 'number' ? user.totalScore.toLocaleString() : user.totalScore;
    const problemsStr = typeof user.problems === 'number' ? user.problems.toLocaleString() : user.problems;
    const avgScoreStr = typeof user.avgScore === 'number' && user.avgScore % 1 !== 0 ? user.avgScore.toFixed(1) : user.avgScore;

    html += `
      <div class="${cardClass} rounded-xl p-3 mb-2 transition-all hover:shadow-lg">
        <div class="flex items-center gap-3">
          <!-- 순위 -->
          <div class="flex items-center justify-center w-12 flex-shrink-0">
            ${rankDisplay.replace('text-4xl', 'text-3xl').replace('w-12 h-12', 'w-10 h-10').replace('text-lg', 'text-base').replace('text-xl', 'text-lg')}
          </div>
          <!-- 닉네임 -->
          <div class="flex-1 min-w-0">
            <div class="${isMe ? 'text-gray-900 dark:text-gray-900' : 'text-gray-900 dark:text-gray-100'} font-bold text-base truncate flex items-center">
              ${user.nickname}${myBadge}
            </div>
          </div>
          <!-- 통계 (한 줄) -->
          <div class="text-sm ${isMe ? 'text-gray-800 dark:text-gray-800' : 'text-gray-600 dark:text-gray-400'} flex-shrink-0">
            <span class="${currentCriteria === 'totalScore' ? 'font-bold text-blue-600 dark:text-blue-400' : ''}">📊 ${totalScoreStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'problems' ? 'font-bold text-blue-600 dark:text-blue-400' : ''}">✍️ ${problemsStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'avgScore' ? 'font-bold text-blue-600 dark:text-blue-400' : ''}">⭐ ${avgScoreStr}</span>
          </div>
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

    // 통계를 한 줄로 간략히
    const totalScoreStr = typeof group.totalScore === 'number' ? group.totalScore.toLocaleString() : group.totalScore;
    const problemsStr = typeof group.problems === 'number' ? group.problems.toLocaleString() : group.problems;
    const avgScoreStr = typeof group.avgScore === 'number' && group.avgScore % 1 !== 0 ? group.avgScore.toFixed(1) : group.avgScore;

    html += `
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-2 transition-all hover:shadow-lg">
        <div class="flex items-center gap-3">
          <!-- 순위 -->
          <div class="flex items-center justify-center w-12 flex-shrink-0">
            ${rankDisplay.replace('text-4xl', 'text-3xl').replace('w-12 h-12', 'w-10 h-10').replace('text-lg', 'text-base').replace('text-xl', 'text-lg')}
          </div>
          <!-- 그룹명 + 인원 -->
          <div class="flex-1 min-w-0">
            <div class="text-gray-900 dark:text-gray-100 font-bold text-base truncate">
              ${group.groupName}
            </div>
            <div class="text-gray-600 dark:text-gray-400 text-xs">
              👥 ${group.memberCount}명
            </div>
          </div>
          <!-- 통계 (한 줄) -->
          <div class="text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">
            <span class="${currentCriteria === 'totalScore' ? 'font-bold text-green-600 dark:text-green-400' : ''}">📊 ${totalScoreStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'problems' ? 'font-bold text-green-600 dark:text-green-400' : ''}">✍️ ${problemsStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'avgScore' ? 'font-bold text-green-600 dark:text-green-400' : ''}">⭐ ${avgScoreStr}</span>
          </div>
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
        <span class="ml-2 bg-green-600 dark:bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
          ⭐ 내 순위
        </span>
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

    // 통계를 한 줄로 간략히
    const totalScoreStr = typeof user.totalScore === 'number' ? user.totalScore.toLocaleString() : user.totalScore;
    const problemsStr = typeof user.problems === 'number' ? user.problems.toLocaleString() : user.problems;
    const avgScoreStr = typeof user.avgScore === 'number' && user.avgScore % 1 !== 0 ? user.avgScore.toFixed(1) : user.avgScore;

    html += `
      <div class="${cardClass} rounded-xl p-3 mb-2 transition-all hover:shadow-lg">
        <div class="flex items-center gap-3">
          <!-- 순위 -->
          <div class="flex items-center justify-center w-12 flex-shrink-0">
            ${rankDisplay.replace('text-4xl', 'text-3xl').replace('w-12 h-12', 'w-10 h-10').replace('text-lg', 'text-base').replace('text-xl', 'text-lg')}
          </div>
          <!-- 닉네임 -->
          <div class="flex-1 min-w-0">
            <div class="${isMe ? 'text-gray-900 dark:text-gray-900' : 'text-gray-900 dark:text-gray-100'} font-bold text-base truncate flex items-center">
              ${user.nickname}${myBadge}
            </div>
          </div>
          <!-- 통계 (한 줄) -->
          <div class="text-sm ${isMe ? 'text-gray-800 dark:text-gray-800' : 'text-gray-600 dark:text-gray-400'} flex-shrink-0">
            <span class="${currentCriteria === 'totalScore' ? 'font-bold text-green-600 dark:text-green-400' : ''}">📊 ${totalScoreStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'problems' ? 'font-bold text-green-600 dark:text-green-400' : ''}">✍️ ${problemsStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'avgScore' ? 'font-bold text-green-600 dark:text-green-400' : ''}">⭐ ${avgScoreStr}</span>
          </div>
        </div>
      </div>
    `;
  });

  intraGroupList.innerHTML = html;
}

// ============================================
// Phase 3.6: 대학교별 랭킹
// ============================================

/**
 * 대학교별 랭킹 로드 및 표시
 */
async function loadUniversityLevelRankings() {
  const universityLevelList = document.getElementById('university-level-list');
  if (!universityLevelList) return;

  universityLevelList.innerHTML = '<div class="text-center py-8 text-gray-500">로딩 중...</div>';

  try {
    const universityRankings = await getUniversityRankings(currentPeriod, currentCriteria);

    if (universityRankings.length === 0) {
      universityLevelList.innerHTML = `
        <div class="text-center py-12 text-gray-500 dark:text-gray-400">
          <p class="text-lg mb-2">📭 아직 대학교 랭킹 데이터가 없습니다.</p>
          <p class="text-sm">대학교 인증 후 문제를 풀면 랭킹이 집계됩니다!</p>
        </div>
      `;
      return;
    }

    renderUniversityRankings(universityRankings);
  } catch (error) {
    console.error('❌ [RankingUI] 대학교별 랭킹 로드 실패:', error);
    universityLevelList.innerHTML = `
      <div class="text-center py-8 text-red-500">
        <p>대학교 랭킹을 불러오는데 실패했습니다.</p>
        <p class="text-sm mt-2">${error.message}</p>
      </div>
    `;
  }
}

/**
 * 대학교별 랭킹 리스트 렌더링
 * @param {Array} universityRankings - 대학교 랭킹 배열
 */
function renderUniversityRankings(universityRankings) {
  const universityLevelList = document.getElementById('university-level-list');
  if (!universityLevelList) return;

  const currentUser = getCurrentUser();

  let html = '';

  universityRankings.forEach((university, index) => {
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
      rankDisplay = `<div class="w-12 h-12 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center text-white font-bold text-lg">${rank}</div>`;
    } else {
      rankDisplay = `<div class="text-gray-500 dark:text-gray-400 font-bold text-xl">${rank}</div>`;
    }

    // 통계를 한 줄로 간략히
    const totalScoreStr = typeof university.totalScore === 'number' ? university.totalScore.toLocaleString() : university.totalScore;
    const problemsStr = typeof university.problems === 'number' ? university.problems.toLocaleString() : university.problems;
    const avgScoreStr = typeof university.avgScore === 'number' && university.avgScore % 1 !== 0 ? university.avgScore.toFixed(1) : university.avgScore;

    html += `
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-2 transition-all hover:shadow-lg">
        <div class="flex items-center gap-3">
          <!-- 순위 -->
          <div class="flex items-center justify-center w-12 flex-shrink-0">
            ${rankDisplay.replace('text-4xl', 'text-3xl').replace('w-12 h-12', 'w-10 h-10').replace('text-lg', 'text-base').replace('text-xl', 'text-lg')}
          </div>
          <!-- 대학교명 -->
          <div class="flex-1 min-w-0">
            <div class="text-gray-900 dark:text-gray-100 font-bold text-base truncate">
              🎓 ${university.university}
            </div>
          </div>
          <!-- 통계 (한 줄) -->
          <div class="text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">
            <span class="${currentCriteria === 'totalScore' ? 'font-bold text-purple-600 dark:text-purple-400' : ''}">📊 ${totalScoreStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'problems' ? 'font-bold text-purple-600 dark:text-purple-400' : ''}">✍️ ${problemsStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'avgScore' ? 'font-bold text-purple-600 dark:text-purple-400' : ''}">⭐ ${avgScoreStr}</span>
          </div>
        </div>
      </div>
    `;
  });

  universityLevelList.innerHTML = html;
}

// ============================================
// Phase 3.6: 대학 내 랭킹
// ============================================

/**
 * 대학 내 랭킹 데이터 로드
 * @param {string} university - 대학교 이름
 */
async function loadIntraUniversityRankingsData(university) {
  const intraUniversityList = document.getElementById('intra-university-list');
  if (!intraUniversityList) return;

  intraUniversityList.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">로딩 중...</div>';

  try {
    const rankings = await getIntraUniversityRankings(university, currentPeriod, currentCriteria);

    if (rankings.length === 0) {
      intraUniversityList.innerHTML = `
        <div class="text-center py-12 text-gray-500 dark:text-gray-400">
          <p class="text-lg mb-2">📭 아직 랭킹 데이터가 없습니다.</p>
          <p class="text-sm">같은 대학 사용자들이 문제를 풀면 랭킹이 집계됩니다!</p>
        </div>
      `;
      return;
    }

    renderIntraUniversityRankings(rankings);
  } catch (error) {
    console.error('❌ [RankingUI] 대학 내 랭킹 로드 실패:', error);
    intraUniversityList.innerHTML = `
      <div class="text-center py-8 text-red-500 dark:text-red-400">
        <p>대학 내 랭킹을 불러오는데 실패했습니다.</p>
        <p class="text-sm mt-2">${error.message}</p>
      </div>
    `;
  }
}

/**
 * 대학 내 멤버 랭킹 리스트 렌더링
 * @param {Array} rankings - 대학 멤버 랭킹 배열
 */
function renderIntraUniversityRankings(rankings) {
  const intraUniversityList = document.getElementById('intra-university-list');
  if (!intraUniversityList) return;

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
      cardClass = 'bg-purple-100 dark:bg-purple-900/50 border-2 border-purple-600 dark:border-purple-400 shadow-lg';
      myBadge = `
        <span class="ml-2 bg-purple-600 dark:bg-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
          ⭐ 내 순위
        </span>
      `;
    } else {
      cardClass = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700';
    }

    // 통계를 한 줄로 간략히
    const totalScoreStr = typeof user.totalScore === 'number' ? user.totalScore.toLocaleString() : user.totalScore;
    const problemsStr = typeof user.problems === 'number' ? user.problems.toLocaleString() : user.problems;
    const avgScoreStr = typeof user.avgScore === 'number' && user.avgScore % 1 !== 0 ? user.avgScore.toFixed(1) : user.avgScore;

    html += `
      <div class="${cardClass} rounded-xl p-3 mb-2 transition-all hover:shadow-lg">
        <div class="flex items-center gap-3">
          <!-- 순위 -->
          <div class="flex items-center justify-center w-12 flex-shrink-0">
            ${rankDisplay.replace('text-4xl', 'text-3xl').replace('w-12 h-12', 'w-10 h-10').replace('text-lg', 'text-base').replace('text-xl', 'text-lg')}
          </div>
          <!-- 닉네임 -->
          <div class="flex-1 min-w-0">
            <div class="${isMe ? 'text-gray-900 dark:text-gray-900' : 'text-gray-900 dark:text-gray-100'} font-bold text-base truncate flex items-center">
              ${user.nickname}${myBadge}
            </div>
          </div>
          <!-- 통계 (한 줄) -->
          <div class="text-sm ${isMe ? 'text-gray-800 dark:text-gray-800' : 'text-gray-600 dark:text-gray-400'} flex-shrink-0">
            <span class="${currentCriteria === 'totalScore' ? 'font-bold text-purple-600 dark:text-purple-400' : ''}">📊 ${totalScoreStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'problems' ? 'font-bold text-purple-600 dark:text-purple-400' : ''}">✍️ ${problemsStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'avgScore' ? 'font-bold text-purple-600 dark:text-purple-400' : ''}">⭐ ${avgScoreStr}</span>
          </div>
        </div>
      </div>
    `;
  });

  intraUniversityList.innerHTML = html;
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
    closeRankingModal,
    openGroupManagement,
    handleUpdateDescription,
    handleKickMember,
    handleDeleteGroup
  };
}
