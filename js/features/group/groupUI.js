// ============================================
// Phase 3.5.2: 그룹 UI (Group UI)
// ============================================

import {
  createGroup,
  joinGroup,
  leaveGroup,
  getMyGroups,
  searchPublicGroups
} from './groupCore.js';
import { showToast } from '../../ui/domUtils.js';

// ============================================
// 그룹 생성 모달
// ============================================

/**
 * 그룹 생성 모달 열기
 */
export function openCreateGroupModal() {
  const modal = document.getElementById('create-group-modal');
  if (!modal) {
    console.error('❌ [GroupUI] 그룹 생성 모달을 찾을 수 없습니다.');
    return;
  }

  // 다른 그룹 모달이 열려있으면 닫기
  closeSearchGroupModal();

  // 폼 초기화
  document.getElementById('create-group-name').value = '';
  document.getElementById('create-group-description').value = '';
  document.getElementById('create-group-password').value = '';
  document.getElementById('create-group-max-members').value = '50';
  document.getElementById('create-group-is-public').checked = true;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/**
 * 그룹 생성 모달 닫기
 */
export function closeCreateGroupModal() {
  const modal = document.getElementById('create-group-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/**
 * 그룹 생성 폼 제출
 */
async function handleCreateGroupSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('create-group-name').value;
  const description = document.getElementById('create-group-description').value;
  const password = document.getElementById('create-group-password').value;
  const maxMembers = parseInt(document.getElementById('create-group-max-members').value);
  const isPublic = document.getElementById('create-group-is-public').checked;

  // 로딩 표시
  const submitBtn = document.getElementById('create-group-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = '생성 중...';

  try {
    const result = await createGroup({
      name,
      description,
      password,
      maxMembers,
      isPublic
    });

    if (result.success) {
      showToast(result.message, 'success');
      closeCreateGroupModal();

      // 그룹 목록 새로고침 (TODO: 이벤트 발행)
      window.location.reload();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('❌ [GroupUI] 그룹 생성 오류:', error);
    showToast('그룹 생성 중 오류가 발생했습니다.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ============================================
// 그룹 검색/가입 모달
// ============================================

/**
 * 그룹 검색 모달 열기
 */
export async function openSearchGroupModal() {
  const modal = document.getElementById('search-group-modal');
  if (!modal) {
    console.error('❌ [GroupUI] 그룹 검색 모달을 찾을 수 없습니다.');
    return;
  }

  // 다른 그룹 모달이 열려있으면 닫기
  closeCreateGroupModal();

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // 초기 공개 그룹 로드
  await loadPublicGroups();
}

/**
 * 그룹 검색 모달 닫기
 */
export function closeSearchGroupModal() {
  const modal = document.getElementById('search-group-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/**
 * 공개 그룹 로드 및 표시
 */
async function loadPublicGroups(searchTerm = '') {
  const groupList = document.getElementById('search-group-list');
  if (!groupList) return;

  groupList.innerHTML = '<div class="text-center py-8 text-gray-500">검색 중...</div>';

  try {
    const groups = await searchPublicGroups(searchTerm);

    if (groups.length === 0) {
      groupList.innerHTML = `
        <div class="text-center py-12 text-gray-500 dark:text-gray-400">
          <p class="text-lg mb-2">📭 검색 결과가 없습니다.</p>
          <p class="text-sm">다른 검색어를 시도해보세요!</p>
        </div>
      `;
      return;
    }

    renderGroupList(groups);
  } catch (error) {
    console.error('❌ [GroupUI] 공개 그룹 로드 실패:', error);
    groupList.innerHTML = `
      <div class="text-center py-8 text-red-500">
        <p>그룹 로드 실패</p>
        <p class="text-sm mt-2">${error.message}</p>
      </div>
    `;
  }
}

/**
 * 그룹 리스트 렌더링
 */
function renderGroupList(groups) {
  const groupList = document.getElementById('search-group-list');
  if (!groupList) return;

  let html = '';

  groups.forEach(group => {
    const isFull = group.memberCount >= group.maxMembers;

    html += `
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-3">
        <div class="flex items-start justify-between mb-2">
          <div class="flex-1">
            <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
              ${group.name}
            </h3>
            ${group.description ? `
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                ${group.description}
              </p>
            ` : ''}
          </div>
          ${isFull ? `
            <span class="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold rounded-full">
              만원
            </span>
          ` : `
            <span class="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold rounded-full">
              모집중
            </span>
          `}
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>👥 ${group.memberCount}/${group.maxMembers}명</span>
            ${group.isPublic ? '<span>🌍 공개</span>' : '<span>🔒 비공개</span>'}
          </div>

          <button
            class="join-group-btn px-4 py-2 rounded-lg font-bold text-sm ${
              isFull
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
            }"
            data-group-id="${group.groupId}"
            data-group-name="${group.name}"
            data-has-password="${group.password && group.password.trim().length > 0 ? 'true' : 'false'}"
            ${isFull ? 'disabled' : ''}
          >
            ${isFull ? '만원' : '가입하기'}
          </button>
        </div>
      </div>
    `;
  });

  groupList.innerHTML = html;

  // 가입하기 버튼 이벤트 리스너
  document.querySelectorAll('.join-group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const groupId = btn.dataset.groupId;
      const groupName = btn.dataset.groupName;
      const hasPassword = btn.dataset.hasPassword === 'true';
      promptJoinGroup(groupId, groupName, hasPassword);
    });
  });
}

/**
 * 그룹 가입 비밀번호 입력 프롬프트
 * @param {string} groupId - 그룹 ID
 * @param {string} groupName - 그룹 이름
 * @param {boolean} hasPassword - 비밀번호 설정 여부
 */
function promptJoinGroup(groupId, groupName, hasPassword) {
  // 비밀번호가 설정되어 있지 않으면 바로 가입
  if (!hasPassword) {
    handleJoinGroup(groupId, '');
    return;
  }

  // 비밀번호 입력 프롬프트
  const password = prompt(`"${groupName}" 그룹의 비밀번호를 입력하세요:`);

  if (password === null) {
    return; // 취소
  }

  handleJoinGroup(groupId, password);
}

/**
 * 그룹 가입 처리
 */
async function handleJoinGroup(groupId, password) {
  try {
    const result = await joinGroup(groupId, password);

    if (result.success) {
      showToast(result.message, 'success');
      closeSearchGroupModal();

      // 그룹 목록 새로고침
      window.location.reload();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('❌ [GroupUI] 그룹 가입 오류:', error);
    showToast('그룹 가입 중 오류가 발생했습니다.', 'error');
  }
}

/**
 * 그룹 검색 처리
 */
async function handleSearchGroups(e) {
  e.preventDefault();

  const searchInput = document.getElementById('search-group-input');
  const searchTerm = searchInput?.value || '';

  await loadPublicGroups(searchTerm);
}

// ============================================
// 그룹 탈퇴
// ============================================

/**
 * 그룹 탈퇴 처리
 */
export async function handleLeaveGroup(groupId, groupName) {
  const confirmed = confirm(`"${groupName}" 그룹에서 탈퇴하시겠습니까?`);

  if (!confirmed) {
    return;
  }

  try {
    const result = await leaveGroup(groupId);

    if (result.success) {
      showToast(result.message, 'success');

      // 그룹 목록 새로고침
      window.location.reload();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    console.error('❌ [GroupUI] 그룹 탈퇴 오류:', error);
    showToast('그룹 탈퇴 중 오류가 발생했습니다.', 'error');
  }
}

// ============================================
// 이벤트 리스너 초기화
// ============================================

/**
 * 그룹 UI 이벤트 리스너 초기화
 */
export function initGroupUI() {
  // 그룹 생성 모달
  const createGroupForm = document.getElementById('create-group-form');
  createGroupForm?.addEventListener('submit', handleCreateGroupSubmit);

  const createGroupCloseBtn = document.getElementById('create-group-close-btn');
  createGroupCloseBtn?.addEventListener('click', closeCreateGroupModal);

  // 그룹 검색 모달
  const searchGroupForm = document.getElementById('search-group-form');
  searchGroupForm?.addEventListener('submit', handleSearchGroups);

  const searchGroupCloseBtn = document.getElementById('search-group-close-btn');
  searchGroupCloseBtn?.addEventListener('click', closeSearchGroupModal);

  console.log('✅ Group UI 모듈 초기화 완료');
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
  window.GroupUI = {
    openCreateGroupModal,
    closeCreateGroupModal,
    openSearchGroupModal,
    closeSearchGroupModal,
    handleLeaveGroup
  };
}
