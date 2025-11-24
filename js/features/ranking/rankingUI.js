// ============================================
// Phase 3.3: 랭킹 UI (Ranking UI)
// ============================================

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import { db } from '../../app.js';
import { getCurrentUser, getNickname } from '../auth/authCore.js';
import { getMyRanking, getGroupRankings, getIntraGroupRankings } from './rankingCore.js';
import { getMyGroups, updateGroupDescription, getGroupMembers, kickMember, deleteGroup, delegateGroupOwner } from '../group/groupCore.js';
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
// Snapshot Cache (올인원 스냅샷 최적화)
// ============================================

// 스냅샷 캐시 (메모리에 저장하여 재사용)
let rankingSnapshotCache = null;
let snapshotCacheTimestamp = null;
const SNAPSHOT_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6시간 (밀리초)

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

  // 모달을 body의 직계 자식으로 이동 (최상위 레벨 보장)
  if (modal.parentNode !== document.body) {
    document.body.appendChild(modal);
  }

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
 * 그룹 상세(관리/멤버보기) 토글
 * @param {string} groupId - 그룹 ID
 * @param {boolean} isOwner - 그룹장 여부
 */
async function toggleGroupExpansion(groupId, isOwner) {
  const expansionContainer = document.getElementById(`group-expansion-${groupId}`);
  const arrow = document.getElementById(`group-arrow-${groupId}`);

  if (!expansionContainer) return;

  const isHidden = expansionContainer.classList.contains('hidden');

  if (isHidden) {
    // 열기
    expansionContainer.classList.remove('hidden');
    if (arrow) arrow.style.transform = 'rotate(180deg)';

    // 내용 로드
    const contentLoaded = expansionContainer.dataset.loaded === 'true';
    if (!contentLoaded) {
       expansionContainer.innerHTML = `
        <div class="pt-4 border-t border-gray-300 dark:border-gray-600">
          <p class="text-center text-gray-500 dark:text-gray-400">로딩 중...</p>
        </div>
       `;
       // 그룹원 관리/보기 렌더링 (isOwner에 따라 UI 달라짐)
       await renderGroupMembersManagement(groupId, isOwner, expansionContainer);
       expansionContainer.dataset.loaded = 'true';
    }
  } else {
    // 닫기
    expansionContainer.classList.add('hidden');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}

/**
 * 주차 키 생성 (YYYY-WW 형식)
 */
function getWeekKey(date) {
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${year}-${String(weekNumber).padStart(2, '0')}`;
}

/**
 * 멤버 타일 색상 결정 (일별 문제 수 기반)
 * GitHub 기여도 차트 스타일의 세밀한 그라데이션
 * @param {number} dailyProblems - 일별 문제 수
 * @returns {string} Tailwind CSS 클래스
 */
function getMemberTileColor(dailyProblems) {
  // 16+ 문제: 진한 보라 (최고 레벨)
  if (dailyProblems >= 16) {
    return 'bg-purple-200 dark:bg-purple-900/50 text-purple-900 dark:text-purple-200';
  }
  // 13-15 문제: 진한 파랑
  else if (dailyProblems >= 13) {
    return 'bg-blue-200 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200';
  }
  // 11-12 문제: 중간 파랑
  else if (dailyProblems >= 11) {
    return 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300';
  }
  // 9-10 문제: 연한 파랑
  else if (dailyProblems >= 9) {
    return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  }
  // 7-8 문제: 진한 초록
  else if (dailyProblems >= 7) {
    return 'bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-200';
  }
  // 5-6 문제: 중간 초록
  else if (dailyProblems >= 5) {
    return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300';
  }
  // 3-4 문제: 연한 초록
  else if (dailyProblems >= 3) {
    return 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  }
  // 1-2 문제: 연한 노랑
  else if (dailyProblems >= 1) {
    return 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
  }
  // 0 문제: 회색
  else {
    return 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400';
  }
}

/**
 * 그룹 관리/보기 UI 렌더링 (기존 renderGroupMembersManagement 수정)
 * @param {string} groupId - 그룹 ID
 * @param {boolean} isOwner - 그룹장 여부
 * @param {HTMLElement} container - 렌더링할 컨테이너
 */
async function renderGroupMembersManagement(groupId, isOwner, container) {
  try {
    const currentUser = getCurrentUser();
    const myGroups = await getMyGroups();
    const group = myGroups.find(g => g.groupId === groupId);
    const members = await getGroupMembers(groupId);

    if (!group || !currentUser) return;

    // 1. 각 멤버의 rankings 데이터 + 프로필 데이터 로드
    const membersWithStats = await Promise.all(members.map(async (member) => {
      const rankingDocRef = doc(db, 'rankings', member.userId);
      const rankingDocSnap = await getDoc(rankingDocRef);

      let dailyProblems = 0;
      let weeklyProblems = 0;
      let dailyScore = 0;
      let weeklyScore = 0;

      if (rankingDocSnap.exists()) {
        const rankingData = rankingDocSnap.data();
        const today = new Date();
        const dailyKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const weekKey = getWeekKey(today);

        // Flat field structure 접근 (예: rankingData['daily.2025-01-18'])
        const dailyFieldName = `daily.${dailyKey}`;
        const weeklyFieldName = `weekly.${weekKey}`;

        const dailyData = rankingData[dailyFieldName];
        const weeklyData = rankingData[weeklyFieldName];

        console.log(`🔍 [GroupMembers] ${member.nickname} (${member.userId}):`, {
          dailyKey,
          weekKey,
          dailyFieldName,
          weeklyFieldName,
          dailyData,
          weeklyData
        });

        if (dailyData) {
          dailyProblems = dailyData.problems || 0;
          dailyScore = dailyData.totalScore || 0;
        }
        if (weeklyData) {
          weeklyProblems = weeklyData.problems || 0;
          weeklyScore = weeklyData.totalScore || 0;
        }
      }

      // 프로필 데이터 로드 (상태 메시지, 대표 업적)
      let statusMessage = '';
      let achievementPoints = 0;
      let featuredAchievement = null;

      try {
        const userDocRef = doc(db, 'users', member.userId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          statusMessage = userData.profile?.statusMessage || '';

          // 대표 업적 불러오기
          const featuredId = userData.profile?.featuredAchievement;
          if (featuredId) {
            // ACHIEVEMENTS config에서 업적 정보 가져오기
            const { ACHIEVEMENTS } = await import('../../config/config.js');
            if (ACHIEVEMENTS[featuredId]) {
              featuredAchievement = {
                id: featuredId,
                icon: ACHIEVEMENTS[featuredId].icon,
                name: ACHIEVEMENTS[featuredId].name
              };
            }
          }

          // 업적 점수 계산 (achievements 객체의 모든 달성된 업적 점수 합계)
          if (userData.achievements) {
            console.log(`🔍 [GroupMembers] ${member.userId} achievements:`, userData.achievements);

            // ACHIEVEMENTS config에서 포인트 가져오기
            const { ACHIEVEMENTS } = await import('../../config/config.js');

            achievementPoints = Object.keys(userData.achievements)
              .filter(achievementId => userData.achievements[achievementId]?.unlocked === true)
              .reduce((sum, achievementId) => {
                const points = ACHIEVEMENTS[achievementId]?.points || 0;
                return sum + points;
              }, 0);

            console.log(`✅ [GroupMembers] ${member.userId} 업적 점수: ${achievementPoints}점`);
          }
        }
      } catch (error) {
        console.error(`⚠️ [GroupMembers] ${member.userId} 프로필 로드 실패:`, error);
      }

      return {
        ...member,
        dailyProblems,
        weeklyProblems,
        dailyScore,
        weeklyScore,
        statusMessage,
        achievementPoints,
        featuredAchievement
      };
    }));

    // 2. 정렬
    membersWithStats.sort((a, b) => b.dailyProblems - a.dailyProblems);

    // 3. UI 렌더링
    let html = `<div class="space-y-4 pt-2 border-t border-gray-300 dark:border-gray-600">`;

    // 그룹장 전용 관리 UI (설명 수정)
    if (isOwner) {
      html += `
        <div>
          <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">📝 그룹 설명 수정</label>
          <div class="flex gap-2">
              <textarea
                id="edit-description-${groupId}"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm resize-none"
                rows="1"
                placeholder="그룹 설명을 입력하세요"
              >${group.description || ''}</textarea>
              <button
                onclick="window.RankingUI?.handleUpdateDescription('${groupId}');"
                class="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white font-bold text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition h-full"
              >
                저장
              </button>
          </div>
        </div>
      `;
    }

    // 멤버 리스트 (타일 형태)
    html += `
      <div>
        <div class="flex items-center justify-between mb-3">
          <label class="text-sm font-bold text-gray-700 dark:text-gray-300">👥 그룹원 (${members.length}명)</label>
          ${isOwner ? `
            <div class="flex gap-2">
                 <button
                  id="delegate-btn-${groupId}"
                  onclick="window.RankingUI?.handleDelegateButton('${groupId}');"
                  class="px-3 py-1.5 bg-amber-600 dark:bg-amber-500 text-white font-bold text-xs rounded hover:bg-amber-700 dark:hover:bg-amber-600 transition"
                >
                  그룹장 위임
                </button>
                <button
                  id="kick-btn-${groupId}"
                  onclick="window.RankingUI?.handleKickButton('${groupId}');"
                  class="px-3 py-1.5 bg-red-600 dark:bg-red-500 text-white font-bold text-xs rounded hover:bg-red-700 dark:hover:bg-red-600 transition"
                >
                  강퇴
                </button>
            </div>
          ` : ''}
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
    `;

    membersWithStats.forEach(member => {
      const memberIsOwner = member.role === 'owner';
      const tileColor = getMemberTileColor(member.dailyProblems);

      html += `
        <div class="relative">
          <div
            class="member-tile p-3 rounded-lg ${tileColor} transition-transform hover:scale-105 cursor-pointer h-24 flex flex-col justify-center relative"
            data-member-data='${JSON.stringify({
              nickname: member.nickname,
              isOwner: memberIsOwner,
              statusMessage: member.statusMessage || '',
              featuredAchievement: member.featuredAchievement,
              dailyScore: member.dailyScore,
              dailyProblems: member.dailyProblems,
              weeklyScore: member.weeklyScore,
              weeklyProblems: member.weeklyProblems,
              achievementPoints: member.achievementPoints
            }).replace(/'/g, "&#39;")}'
          >
             ${isOwner && !memberIsOwner ? `
              <input
                type="checkbox"
                class="kick-checkbox absolute top-2 left-2 w-4 h-4 hidden"
                data-group-id="${groupId}"
                data-user-id="${member.userId}"
                data-nickname="${member.nickname.replace(/"/g, '&quot;')}"
              />
            ` : ''}
            ${isOwner && !memberIsOwner ? `
              <input
                type="checkbox"
                class="delegate-checkbox absolute top-2 right-2 w-4 h-4 hidden"
                data-group-id="${groupId}"
                data-user-id="${member.userId}"
                data-nickname="${member.nickname.replace(/"/g, '&quot;')}"
                onchange="window.RankingUI?.handleSingleSelection(this, '${groupId}')"
              />
            ` : ''}

            <div class="flex flex-col items-center text-center">
              <div class="text-lg font-bold mb-1">${member.dailyScore}<span class="text-xs">점</span></div>
              <div class="text-xs font-medium truncate w-full">
                ${memberIsOwner ? '👑' : ''}${member.nickname}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`; // End grid

    // 하단 액션 버튼 (그룹 삭제 or 탈퇴)
    html += `
      <div class="flex justify-end mt-4 pt-2 border-t border-gray-200 dark:border-gray-700">
        ${isOwner ? `
           <button
              onclick="window.RankingUI?.handleDeleteGroup('${groupId}', '${group.name.replace(/'/g, "\\'")}')"
              class="text-red-600 dark:text-red-400 text-xs hover:text-red-800 dark:hover:text-red-300 hover:underline transition"
            >
              🗑️ 그룹 삭제 (영구)
            </button>
        ` : `
            <button
              onclick="window.GroupUI?.handleLeaveGroup('${groupId}', '${group.name.replace(/'/g, "\\'")}')"
              class="text-red-600 dark:text-red-400 text-sm hover:underline transition font-bold"
            >
              그룹 탈퇴하기
            </button>
        `}
      </div>
    `;

    html += `</div>`; // End space-y-4
    container.innerHTML = html;

    // 말풍선 이벤트 리스너 추가
    attachMemberTooltipListeners();

  } catch (error) {
    console.error('❌ [RankingUI] 그룹 상세 로드 실패:', error);
    container.innerHTML = '<p class="text-center text-red-500">정보를 불러오는데 실패했습니다.</p>';
  }
}

/**
 * 그룹원 타일에 말풍선 이벤트 리스너 추가
 */
function attachMemberTooltipListeners() {
  // 기존 말풍선 제거
  const existingTooltip = document.getElementById('member-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }

  // 모든 멤버 타일에 이벤트 추가
  document.querySelectorAll('.member-tile').forEach(tile => {
    tile.addEventListener('mouseenter', showMemberTooltip);
    tile.addEventListener('mouseleave', hideMemberTooltip);
  });
}

/**
 * 그룹원 말풍선 표시
 */
function showMemberTooltip(e) {
  const tile = e.currentTarget;
  const memberData = JSON.parse(tile.getAttribute('data-member-data'));

  // 기존 말풍선 제거
  hideMemberTooltip();

  // 말풍선 생성
  const tooltip = document.createElement('div');
  tooltip.id = 'member-tooltip';
  tooltip.className = 'fixed z-[99999] pointer-events-none';

  tooltip.innerHTML = `
    <div class="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg p-3 shadow-2xl min-w-max max-w-xs">
      <div class="font-bold mb-2 text-center">${memberData.nickname} ${memberData.isOwner ? '👑' : ''}</div>
      ${memberData.statusMessage ? `<div class="text-center mb-2 px-2 py-1 bg-white/10 dark:bg-gray-900/10 rounded italic">💬 "${memberData.statusMessage}"</div>` : ''}
      ${memberData.featuredAchievement ? `<div class="text-center mb-2 px-2 py-1 bg-blue-500/20 dark:bg-blue-500/30 rounded font-medium">⭐ ${memberData.featuredAchievement.icon} ${memberData.featuredAchievement.name}</div>` : ''}
      <div class="space-y-1">
        <div>📅 일: ${memberData.dailyScore}점 (${memberData.dailyProblems}문제)</div>
        <div>📊 주: ${memberData.weeklyScore}점 (${memberData.weeklyProblems}문제)</div>
        <div>🏆 업적: ${memberData.achievementPoints}점</div>
      </div>
      <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
        <div class="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
      </div>
    </div>
  `;

  document.body.appendChild(tooltip);

  // 위치 계산
  positionTooltip(tile, tooltip);

  // 타일 이동 시 말풍선 위치 업데이트
  tile._tooltipUpdateInterval = setInterval(() => {
    if (document.body.contains(tooltip)) {
      positionTooltip(tile, tooltip);
    }
  }, 100);
}

/**
 * 그룹원 말풍선 숨기기
 */
function hideMemberTooltip() {
  const tooltip = document.getElementById('member-tooltip');
  if (tooltip) {
    tooltip.remove();
  }

  // 위치 업데이트 인터벌 제거
  document.querySelectorAll('.member-tile').forEach(tile => {
    if (tile._tooltipUpdateInterval) {
      clearInterval(tile._tooltipUpdateInterval);
      tile._tooltipUpdateInterval = null;
    }
  });
}

/**
 * 말풍선 위치 계산
 */
function positionTooltip(tile, tooltip) {
  const tileRect = tile.getBoundingClientRect();
  const tooltipRect = tooltip.firstElementChild.getBoundingClientRect();

  // 타일 위쪽 중앙에 위치
  const left = tileRect.left + (tileRect.width / 2) - (tooltipRect.width / 2);
  const top = tileRect.top - tooltipRect.height - 8; // 8px 간격

  tooltip.style.left = `${Math.max(10, left)}px`;
  tooltip.style.top = `${Math.max(10, top)}px`;
}

/**
 * 강퇴 버튼 핸들러
 */
function handleKickButton(groupId) {
  // 위임 모드가 켜져있으면 끔
  const delegateChecks = document.querySelectorAll(`.delegate-checkbox[data-group-id="${groupId}"]`);
  if (!delegateChecks[0]?.classList.contains('hidden')) {
     handleDelegateButton(groupId); // 토글해서 끔
  }

  const checkboxes = document.querySelectorAll(`.kick-checkbox[data-group-id="${groupId}"]`);
  const button = document.getElementById(`kick-btn-${groupId}`);
  const isKickMode = !checkboxes[0]?.classList.contains('hidden');

  if (!isKickMode) {
    checkboxes.forEach(cb => cb.classList.remove('hidden'));
    button.textContent = '선택 강퇴 실행';
    button.classList.replace('bg-red-600', 'bg-orange-600');
    button.classList.replace('dark:bg-red-500', 'dark:bg-orange-500');
  } else {
    executeKick(groupId);
  }
}

/**
 * 그룹장 위임 버튼 핸들러
 */
function handleDelegateButton(groupId) {
  // 강퇴 모드가 켜져있으면 끔
  const kickChecks = document.querySelectorAll(`.kick-checkbox[data-group-id="${groupId}"]`);
  if (!kickChecks[0]?.classList.contains('hidden')) {
     handleKickButton(groupId); // 토글해서 끔
  }

  const checkboxes = document.querySelectorAll(`.delegate-checkbox[data-group-id="${groupId}"]`);
  const button = document.getElementById(`delegate-btn-${groupId}`);
  const isDelegateMode = !checkboxes[0]?.classList.contains('hidden');

  if (!isDelegateMode) {
    checkboxes.forEach(cb => {
        cb.classList.remove('hidden');
        cb.checked = false;
    });
    button.textContent = '위임 실행';
    button.classList.replace('bg-amber-600', 'bg-red-600'); // 경고색으로 변경
    button.classList.replace('dark:bg-amber-500', 'dark:bg-red-500');
  } else {
    executeDelegate(groupId);
  }
}

/**
 * 위임 체크박스 단일 선택 강제
 */
function handleSingleSelection(checkbox, groupId) {
    if (checkbox.checked) {
        const all = document.querySelectorAll(`.delegate-checkbox[data-group-id="${groupId}"]`);
        all.forEach(cb => {
            if (cb !== checkbox) cb.checked = false;
        });
    }
}

/**
 * 강퇴 실행
 */
async function executeKick(groupId) {
  const checkboxes = document.querySelectorAll(`.kick-checkbox[data-group-id="${groupId}"]:checked`);
  if (checkboxes.length === 0) {
     // 선택 없이 다시 누르면 취소로 간주
     resetGroupActionUI(groupId, 'kick');
     return;
  }

  const memberNames = Array.from(checkboxes).map(cb => cb.dataset.nickname).join(', ');
  if (!confirm(`⚠️ ${memberNames} 멤버를 강퇴하시겠습니까?\n(7일간 재가입 불가)`)) return;

  let successCount = 0;
  for (const cb of checkboxes) {
    try {
      const result = await kickMember(groupId, cb.dataset.userId);
      if (result.success) successCount++;
    } catch (e) { console.error(e); }
  }

  if (successCount > 0) {
    showToast(`${successCount}명 강퇴 완료`, 'success');
    // 강제 리로드 대신 다시 렌더링
    const container = document.getElementById(`group-expansion-${groupId}`);
    if(container) {
         container.dataset.loaded = 'false'; // 리로드 트리거
         toggleGroupExpansion(groupId, true); // 닫았다 열면 리로드됨 (단순화) -> 아니면 직접 호출
         // UI Refresh
         await renderGroupMembersManagement(groupId, true, container);
    }
  }
}

/**
 * 위임 실행
 */
async function executeDelegate(groupId) {
    const checkboxes = document.querySelectorAll(`.delegate-checkbox[data-group-id="${groupId}"]:checked`);

    if (checkboxes.length === 0) {
        // 취소
        resetGroupActionUI(groupId, 'delegate');
        return;
    }

    if (checkboxes.length > 1) {
        showToast('한 명의 멤버에게만 위임할 수 있습니다.', 'warning');
        return;
    }

    const targetUser = checkboxes[0];
    const targetName = targetUser.dataset.nickname;
    const targetId = targetUser.dataset.userId;

    const confirmed = confirm(
        `⚠️ 정말로 그룹장을 "${targetName}"님에게 위임하시겠습니까?\n\n` +
        `위임 후 귀하는 '일반 멤버'가 되며, 이 작업은 되돌릴 수 없습니다.`
    );

    if (!confirmed) return;

    try {
        const result = await delegateGroupOwner(groupId, targetId);
        if (result.success) {
            showToast(result.message, 'success');
            // 권한이 바뀌었으므로 전체 리스트 리로드 필요
            await loadMyGroupsList();
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('위임 중 오류 발생', 'error');
    }
}

/**
 * 액션 UI 초기화 (버튼 색상 복구 및 체크박스 숨김)
 */
function resetGroupActionUI(groupId, action) {
    if (action === 'kick') {
        const checkboxes = document.querySelectorAll(`.kick-checkbox[data-group-id="${groupId}"]`);
        const button = document.getElementById(`kick-btn-${groupId}`);
        checkboxes.forEach(cb => { cb.classList.add('hidden'); cb.checked = false; });
        button.textContent = '강퇴';
        button.classList.replace('bg-orange-600', 'bg-red-600');
        button.classList.replace('dark:bg-orange-500', 'dark:bg-red-500');
    } else if (action === 'delegate') {
        const checkboxes = document.querySelectorAll(`.delegate-checkbox[data-group-id="${groupId}"]`);
        const button = document.getElementById(`delegate-btn-${groupId}`);
        checkboxes.forEach(cb => { cb.classList.add('hidden'); cb.checked = false; });
        button.textContent = '그룹장 위임';
        button.classList.replace('bg-red-600', 'bg-amber-600');
        button.classList.replace('dark:bg-red-500', 'dark:bg-amber-500');
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
 * 내 그룹 목록 렌더링 (펼치기 방식 적용)
 */
function renderMyGroupsList(groups, currentUser) {
  const myGroupsList = document.getElementById('my-groups-list');
  if (!myGroupsList) return;

  let html = '';

  groups.forEach(group => {
    const isOwner = group.ownerId === currentUser.uid;
    const ownerBadge = isOwner ? `
      <span class="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-bold rounded-full">
        👑 그룹장
      </span>
    ` : '';

    html += `
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-3 transition-all shadow-sm hover:shadow-md" data-group-id="${group.groupId}">
        <div
            class="p-4 cursor-pointer flex items-center justify-between group-header select-none"
            onclick="window.RankingUI?.toggleGroupExpansion('${group.groupId}', ${isOwner})"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="text-lg font-bold text-gray-900 dark:text-gray-100">
                ${group.name}
              </h4>
              ${ownerBadge}
            </div>
             <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>👥 ${group.memberCount}/${group.maxMembers}명</span>
                ${group.isPublic ? '<span>🌍 공개</span>' : '<span>🔒 비공개</span>'}
             </div>
          </div>

          <div class="text-gray-400 transform transition-transform duration-200" id="group-arrow-${group.groupId}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div id="group-expansion-${group.groupId}" class="hidden bg-gray-50 dark:bg-gray-800/50 px-4 pb-4" data-loaded="false">
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
 * 🚀 올인원 스냅샷 기반 랭킹 데이터 가져오기 (최적화)
 *
 * 작동 방식:
 * 1. ranking_cache 컬렉션에서 스냅샷 1개만 읽음 (서버 읽기 1회)
 * 2. 메모리에 캐싱하여 탭 전환 시 서버 통신 0회
 * 3. 모든 필터링/정렬은 클라이언트(브라우저)에서 처리
 *
 * @param {string} period - 'daily', 'weekly', 'monthly'
 * @param {string} criteria - 'totalScore', 'problems', 'avgScore'
 * @returns {Promise<Array>} 랭킹 배열
 */
async function fetchRankings(period, criteria) {
  console.log(`📊 [Ranking] 스냅샷 기반 랭킹 조회 - period: ${period}, criteria: ${criteria}`);

  // 1. 스냅샷 로드 (캐시 확인 후 필요시 서버에서 가져오기)
  const snapshot = await loadRankingSnapshot();

  if (!snapshot || !snapshot.users) {
    console.warn('⚠️ [Ranking] 스냅샷 데이터가 없습니다.');
    return [];
  }

  // 2. 현재 기간 키 생성
  const periodKey = getPeriodKeyForQuery();
  console.log(`🔍 [Ranking] 기간 키: ${periodKey}, 총 ${snapshot.users.length}명 데이터`);

  // 3. 로컬 필터링 (브라우저에서 처리)
  let rankings = [];

  snapshot.users.forEach(user => {
    // 기간별 데이터 추출
    const periodData = user[period]?.[periodKey];

    if (!periodData) {
      return; // 해당 기간 데이터 없으면 제외
    }

    // 평균점수 기준일 때: 최소 문제 수 필터링
    if (criteria === 'avgScore') {
      const minProblems = MIN_PROBLEMS_FOR_AVG[period];
      if (periodData.problems < minProblems) {
        return; // 제외
      }
    }

    rankings.push({
      userId: user.userId,
      nickname: user.nickname || '익명',
      totalScore: periodData.totalScore || 0,
      problems: periodData.problems || 0,
      avgScore: periodData.avgScore || 0
    });
  });

  // 4. 로컬 정렬 (브라우저에서 처리)
  rankings.sort((a, b) => {
    const aValue = a[criteria];
    const bValue = b[criteria];
    return bValue - aValue;
  });

  console.log(`✅ [Ranking] ${rankings.length}명의 랭킹 데이터 처리 완료 (서버 읽기: 0회)`);

  return rankings;
}

/**
 * 랭킹 스냅샷 로드 (캐시 우선, 만료 시 서버에서 다시 로드)
 * @returns {Promise<Object|null>} 스냅샷 데이터
 */
async function loadRankingSnapshot() {
  const now = Date.now();

  // 캐시가 유효한지 확인
  if (rankingSnapshotCache && snapshotCacheTimestamp) {
    const elapsed = now - snapshotCacheTimestamp;
    if (elapsed < SNAPSHOT_CACHE_DURATION) {
      console.log(`📦 [Ranking] 캐시된 스냅샷 사용 (${Math.floor(elapsed / 60000)}분 경과)`);
      return rankingSnapshotCache;
    } else {
      console.log(`⏰ [Ranking] 캐시 만료 (${Math.floor(elapsed / 60000)}분 경과), 새로 로드...`);
    }
  }

  // 서버에서 스냅샷 로드
  try {
    console.log(`🌐 [Ranking] ranking_cache에서 스냅샷 다운로드 중...`);

    const snapshotDocRef = doc(db, 'ranking_cache', 'snapshot');
    const snapshotDoc = await getDoc(snapshotDocRef);

    if (!snapshotDoc.exists()) {
      console.error('❌ [Ranking] 스냅샷이 존재하지 않습니다. 관리자에게 문의하세요.');
      return null;
    }

    const data = snapshotDoc.data();

    // 캐시에 저장
    rankingSnapshotCache = data;
    snapshotCacheTimestamp = now;

    console.log(`✅ [Ranking] 스냅샷 로드 완료 - 생성시각: ${data.generatedAt?.toDate?.() || '알 수 없음'}`);
    console.log(`   - 사용자 수: ${data.users?.length || 0}명`);

    return data;
  } catch (error) {
    console.error('❌ [Ranking] 스냅샷 로드 실패:', error);
    return null;
  }
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
          <div class="text-sm text-blue-600 dark:text-blue-400 flex-shrink-0">
            <span class="${currentCriteria === 'totalScore' ? 'font-bold' : ''}">📊 ${totalScoreStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'problems' ? 'font-bold' : ''}">✍️ ${problemsStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'avgScore' ? 'font-bold' : ''}">⭐ ${avgScoreStr}</span>
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
  console.log(`🔄 [changePeriod] 호출됨 - period: ${period}, currentMainTab: ${currentMainTab}, currentGroupSubtab: ${currentGroupSubtab}, currentClassSubtab: ${currentClassSubtab}`);
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

  // 현재 탭에 따라 데이터 다시 로드
  if (currentMainTab === 'global') {
    await loadRankings();
  } else if (currentMainTab === 'all-groups') {
    if (currentGroupSubtab === 'group-level') {
      await loadGroupLevelRankings();
    } else if (currentGroupSubtab === 'intra-group') {
      const myGroups = await getMyGroups();
      await loadIntraGroupRankings(myGroups);
    }
  } else if (currentMainTab === 'all-classes') {
    if (currentClassSubtab === 'class-level') {
      await loadUniversityLevelRankings();
    } else if (currentClassSubtab === 'intra-class') {
      const universityInfo = await getMyUniversity();
      if (universityInfo) {
        await loadIntraUniversityRankingsData(universityInfo.university);
      }
    }
  }
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

  // 현재 탭에 따라 데이터 다시 로드
  if (currentMainTab === 'global') {
    await loadRankings();
  } else if (currentMainTab === 'all-groups') {
    if (currentGroupSubtab === 'group-level') {
      await loadGroupLevelRankings();
    } else if (currentGroupSubtab === 'intra-group') {
      const myGroups = await getMyGroups();
      await loadIntraGroupRankings(myGroups);
    }
  } else if (currentMainTab === 'all-classes') {
    if (currentClassSubtab === 'class-level') {
      await loadUniversityLevelRankings();
    } else if (currentClassSubtab === 'intra-class') {
      const universityInfo = await getMyUniversity();
      if (universityInfo) {
        await loadIntraUniversityRankingsData(universityInfo.university);
      }
    }
  }
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
          <div class="text-sm text-green-600 dark:text-green-400 flex-shrink-0">
            <span class="${currentCriteria === 'totalScore' ? 'font-bold' : ''}">📊 ${totalScoreStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'problems' ? 'font-bold' : ''}">✍️ ${problemsStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'avgScore' ? 'font-bold' : ''}">⭐ ${avgScoreStr}</span>
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
          <div class="text-sm text-green-600 dark:text-green-400 flex-shrink-0">
            <span class="${currentCriteria === 'totalScore' ? 'font-bold' : ''}">📊 ${totalScoreStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'problems' ? 'font-bold' : ''}">✍️ ${problemsStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'avgScore' ? 'font-bold' : ''}">⭐ ${avgScoreStr}</span>
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
          <div class="text-sm text-purple-600 dark:text-purple-400 flex-shrink-0">
            <span class="${currentCriteria === 'totalScore' ? 'font-bold' : ''}">📊 ${totalScoreStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'problems' ? 'font-bold' : ''}">✍️ ${problemsStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'avgScore' ? 'font-bold' : ''}">⭐ ${avgScoreStr}</span>
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
          <div class="text-sm text-purple-600 dark:text-purple-400 flex-shrink-0">
            <span class="${currentCriteria === 'totalScore' ? 'font-bold' : ''}">📊 ${totalScoreStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'problems' ? 'font-bold' : ''}">✍️ ${problemsStr}</span>
            <span class="mx-1">•</span>
            <span class="${currentCriteria === 'avgScore' ? 'font-bold' : ''}">⭐ ${avgScoreStr}</span>
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
  const periodButtons = document.querySelectorAll('[data-period]');
  console.log(`🔧 [initRankingUI] 기간 필터 버튼 ${periodButtons.length}개 발견`);
  periodButtons.forEach((btn, index) => {
    console.log(`  - 버튼 ${index + 1}: data-period="${btn.dataset.period}"`);
    btn.addEventListener('click', () => {
      console.log(`🖱️ [클릭] 기간 필터 버튼 클릭됨: ${btn.dataset.period}`);
      changePeriod(btn.dataset.period);
    });
  });

  // 기준 필터 버튼들
  document.querySelectorAll('[data-criteria]').forEach(btn => {
    btn.addEventListener('click', () => {
      changeCriteria(btn.dataset.criteria);
    });
  });

  // 전체 랭킹 탭 기간 드롭다운
  const globalPeriodSelect = document.getElementById('global-period-select');
  globalPeriodSelect?.addEventListener('change', (e) => {
    changePeriod(e.target.value);
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
    toggleGroupExpansion,
    handleKickButton,
    handleDelegateButton,
    handleSingleSelection,
    handleUpdateDescription,
    handleDeleteGroup
  };
}
