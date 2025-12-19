/**
 * @fileoverview 사용자 지정 복습 목록 관리
 * - 목록 생성/삭제/이름 변경
 * - 문제 추가/제거
 * - LocalStorage 기반 영구 저장
 */

import { showToast } from '../../ui/domUtils.js';
import { normId } from '../../utils/helpers.js';

const CUSTOM_LISTS_KEY = 'customReviewLists_v1'; // 목록 메타데이터
const QUESTION_LISTS_KEY = 'questionCustomLists_v1'; // 문제 ID -> 목록 ID[] 매핑

/**
 * 사용자 지정 복습 목록 데이터 구조:
 * {
 *   "list-uuid-1": {
 *     id: "list-uuid-1",
 *     name: "헷갈리는 문제들",
 *     createdAt: 1234567890,
 *     questionCount: 5
 *   },
 *   ...
 * }
 */

/**
 * 문제별 목록 할당 구조:
 * {
 *   "q1-1-1": ["list-uuid-1", "list-uuid-2"],
 *   "q2-3-4": ["list-uuid-1"],
 *   ...
 * }
 */

// ==================== LocalStorage 접근 ====================

/**
 * 모든 사용자 지정 목록 가져오기
 * @returns {Object} 목록 ID -> 목록 객체 매핑
 */
export function getAllCustomLists() {
  try {
    const data = localStorage.getItem(CUSTOM_LISTS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('[CustomLists] 목록 로드 실패:', e);
    return {};
  }
}

/**
 * 사용자 지정 목록 저장
 * @param {Object} lists - 목록 객체
 */
function saveCustomLists(lists) {
  try {
    localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(lists));
  } catch (e) {
    console.error('[CustomLists] 목록 저장 실패:', e);
  }
}

/**
 * 문제별 목록 할당 가져오기
 * @returns {Object} 문제 ID -> 목록 ID[] 매핑
 */
export function getQuestionListsMap() {
  try {
    const data = localStorage.getItem(QUESTION_LISTS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('[CustomLists] 문제 매핑 로드 실패:', e);
    return {};
  }
}

/**
 * 문제별 목록 할당 저장
 * @param {Object} mapping - 문제 ID -> 목록 ID[] 매핑
 */
function saveQuestionListsMap(mapping) {
  try {
    localStorage.setItem(QUESTION_LISTS_KEY, JSON.stringify(mapping));
  } catch (e) {
    console.error('[CustomLists] 문제 매핑 저장 실패:', e);
  }
}

// ==================== 목록 관리 ====================

/**
 * 새 목록 생성
 * @param {string} name - 목록 이름
 * @returns {string} 생성된 목록 ID
 */
export function createCustomList(name) {
  const lists = getAllCustomLists();
  const listId = 'list-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

  lists[listId] = {
    id: listId,
    name: name || '새 복습 목록',
    createdAt: Date.now(),
    questionCount: 0
  };

  saveCustomLists(lists);
  showToast(`✓ "${name}" 목록이 생성되었습니다`, 'success');

  // 드롭다운 업데이트
  if (typeof renderCustomListsInDropdown === 'function') {
    renderCustomListsInDropdown();
  }

  return listId;
}

/**
 * 목록 삭제
 * @param {string} listId - 삭제할 목록 ID
 */
export function deleteCustomList(listId) {
  const lists = getAllCustomLists();
  const listName = lists[listId]?.name;

  if (!lists[listId]) {
    showToast('목록을 찾을 수 없습니다', 'error');
    return;
  }

  // 목록에서 제거
  delete lists[listId];
  saveCustomLists(lists);

  // 모든 문제에서 이 목록 참조 제거
  const mapping = getQuestionListsMap();
  Object.keys(mapping).forEach(qid => {
    mapping[qid] = mapping[qid].filter(lid => lid !== listId);
    if (mapping[qid].length === 0) {
      delete mapping[qid];
    }
  });
  saveQuestionListsMap(mapping);

  showToast(`✓ "${listName}" 목록이 삭제되었습니다`, 'info');

  // 드롭다운 업데이트
  if (typeof renderCustomListsInDropdown === 'function') {
    renderCustomListsInDropdown();
  }
}

/**
 * 목록 이름 변경
 * @param {string} listId - 목록 ID
 * @param {string} newName - 새 이름
 */
export function renameCustomList(listId, newName) {
  const lists = getAllCustomLists();

  if (!lists[listId]) {
    showToast('목록을 찾을 수 없습니다', 'error');
    return;
  }

  lists[listId].name = newName;
  saveCustomLists(lists);

  showToast(`✓ 목록 이름이 "${newName}"(으)로 변경되었습니다`, 'success');

  // 드롭다운 업데이트
  if (typeof renderCustomListsInDropdown === 'function') {
    renderCustomListsInDropdown();
  }
}

// ==================== 문제 관리 ====================

/**
 * 문제를 목록에 추가
 * @param {string} questionId - 문제 ID (정규화 필요)
 * @param {string} listId - 목록 ID
 */
export function addQuestionToList(questionId, listId) {
  const qid = normId(questionId);
  const lists = getAllCustomLists();
  const mapping = getQuestionListsMap();

  if (!lists[listId]) {
    showToast('목록을 찾을 수 없습니다', 'error');
    return;
  }

  // 이미 추가된 경우 무시
  if (mapping[qid] && mapping[qid].includes(listId)) {
    showToast(`이미 "${lists[listId].name}" 목록에 추가되어 있습니다`, 'info');
    return;
  }

  // 문제 추가
  if (!mapping[qid]) {
    mapping[qid] = [];
  }
  mapping[qid].push(listId);

  // 목록의 문제 개수 업데이트
  lists[listId].questionCount = (lists[listId].questionCount || 0) + 1;

  saveQuestionListsMap(mapping);
  saveCustomLists(lists);

  showToast(`✓ "${lists[listId].name}" 목록에 추가되었습니다`, 'success');

  // 드롭다운 업데이트
  if (typeof renderCustomListsInDropdown === 'function') {
    renderCustomListsInDropdown();
  }
}

/**
 * 문제를 목록에서 제거
 * @param {string} questionId - 문제 ID (정규화 필요)
 * @param {string} listId - 목록 ID
 */
export function removeQuestionFromList(questionId, listId) {
  const qid = normId(questionId);
  const lists = getAllCustomLists();
  const mapping = getQuestionListsMap();

  if (!lists[listId]) {
    showToast('목록을 찾을 수 없습니다', 'error');
    return;
  }

  if (!mapping[qid] || !mapping[qid].includes(listId)) {
    showToast('이 문제는 해당 목록에 없습니다', 'info');
    return;
  }

  // 문제 제거
  mapping[qid] = mapping[qid].filter(lid => lid !== listId);
  if (mapping[qid].length === 0) {
    delete mapping[qid];
  }

  // 목록의 문제 개수 업데이트
  lists[listId].questionCount = Math.max(0, (lists[listId].questionCount || 0) - 1);

  saveQuestionListsMap(mapping);
  saveCustomLists(lists);

  showToast(`✓ "${lists[listId].name}" 목록에서 제거되었습니다`, 'info');

  // 드롭다운 업데이트
  if (typeof renderCustomListsInDropdown === 'function') {
    renderCustomListsInDropdown();
  }
}

/**
 * 특정 문제가 속한 모든 목록 ID 가져오기
 * @param {string} questionId - 문제 ID (정규화 필요)
 * @returns {string[]} 목록 ID 배열
 */
export function getQuestionLists(questionId) {
  const qid = normId(questionId);
  const mapping = getQuestionListsMap();
  return mapping[qid] || [];
}

/**
 * 특정 목록에 속한 모든 문제 ID 가져오기
 * @param {string} listId - 목록 ID
 * @returns {string[]} 문제 ID 배열
 */
export function getQuestionsInList(listId) {
  const mapping = getQuestionListsMap();
  const questions = [];

  Object.keys(mapping).forEach(qid => {
    if (mapping[qid].includes(listId)) {
      questions.push(qid);
    }
  });

  return questions;
}

// ==================== UI 렌더링 ====================

/**
 * filter-select 드롭다운에 사용자 지정 목록 옵션 추가
 */
export function renderCustomListsInDropdown() {
  const filterSelect = document.getElementById('filter-select');
  if (!filterSelect) return;

  const lists = getAllCustomLists();
  const listIds = Object.keys(lists);

  // 기존 사용자 지정 목록 옵션 및 관리 옵션 제거
  Array.from(filterSelect.options).forEach(option => {
    if (option.getAttribute('data-custom-list') === 'true' ||
        option.getAttribute('data-separator') === 'custom-lists' ||
        option.getAttribute('data-action') === 'add-question' ||
        option.getAttribute('data-action') === 'add-list' ||
        option.getAttribute('data-action') === 'manage-lists') {
      option.remove();
    }
  });

  // 사용자 목록이 있거나 관리 옵션을 표시하기 위한 구분선 추가
  const separator = document.createElement('option');
  separator.disabled = true;
  separator.textContent = '━━━━ 📝 나만의 복습 목록 ━━━━';
  separator.setAttribute('data-separator', 'custom-lists');
  filterSelect.appendChild(separator);

  // 사용자 지정 목록 옵션 추가
  listIds.forEach(listId => {
    const list = lists[listId];
    const option = document.createElement('option');
    option.value = `custom-list:${listId}`;
    option.textContent = `📝 ${list.name} (${list.questionCount || 0}문제)`;
    option.setAttribute('data-custom-list', 'true');
    filterSelect.appendChild(option);
  });

  // "문제를 목록에 추가" 옵션 (드롭다운 내부)
  const addQuestionOption = document.createElement('option');
  addQuestionOption.value = 'action:add-question';
  addQuestionOption.textContent = '+ 이 문제를 목록에 추가';
  addQuestionOption.setAttribute('data-action', 'add-question');
  addQuestionOption.style.color = '#2563eb'; // 파란색
  addQuestionOption.style.fontWeight = 'bold';
  filterSelect.appendChild(addQuestionOption);

  // "새 목록 만들기" 옵션 (드롭다운 내부)
  const addListOption = document.createElement('option');
  addListOption.value = 'action:add-list';
  addListOption.textContent = '+ 새 복습 목록 만들기';
  addListOption.setAttribute('data-action', 'add-list');
  addListOption.style.color = '#059669'; // 초록색
  addListOption.style.fontWeight = 'bold';
  filterSelect.appendChild(addListOption);

  // "목록 관리" 옵션 (드롭다운 내부)
  const manageOption = document.createElement('option');
  manageOption.value = 'action:manage-lists';
  manageOption.textContent = '⚙️ 목록 관리 (이름변경/삭제)';
  manageOption.setAttribute('data-action', 'manage-lists');
  manageOption.style.color = '#7c3aed'; // 보라색
  manageOption.style.fontWeight = 'bold';
  filterSelect.appendChild(manageOption);
}

/**
 * 목록 관리 UI 표시 (모달 방식)
 */
export function showListManagementModal() {
  const lists = getAllCustomLists();
  const listIds = Object.keys(lists);

  const modalHTML = `
    <div id="list-management-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" style="backdrop-filter: blur(4px);">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100">📝 복습 목록 관리</h3>
          <button id="close-mgmt-modal-btn" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>
        <div class="space-y-2 max-h-96 overflow-y-auto mb-4">
          ${listIds.length === 0 ? '<p class="text-sm text-gray-500 dark:text-gray-400">복습 목록이 없습니다.</p>' : ''}
          ${listIds.map(listId => {
            const list = lists[listId];
            return `
              <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-800 dark:text-gray-100">${list.name}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">${list.questionCount || 0}문제</div>
                </div>
                <div class="flex items-center gap-1">
                  <button class="mgmt-rename-btn text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition" data-list-id="${listId}">
                    이름변경
                  </button>
                  <button class="mgmt-delete-btn text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded transition" data-list-id="${listId}">
                    삭제
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <button id="add-new-list-btn" class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
          + 새 목록 추가
        </button>
      </div>
    </div>
  `;

  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer.firstElementChild);

  const modal = document.getElementById('list-management-modal');

  // 닫기 버튼
  document.getElementById('close-mgmt-modal-btn')?.addEventListener('click', () => {
    modal.remove();
  });

  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // 새 목록 추가 버튼
  document.getElementById('add-new-list-btn')?.addEventListener('click', () => {
    const name = prompt('새 복습 목록의 이름을 입력하세요:', '나만의 복습 목록');
    if (name && name.trim()) {
      createCustomList(name.trim());
      modal.remove();
      renderCustomListsInDropdown();
      showListManagementModal(); // 모달 다시 열기
    }
  });

  // 이름 변경 버튼
  modal.querySelectorAll('.mgmt-rename-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const listId = btn.getAttribute('data-list-id');
      const lists = getAllCustomLists();
      const currentName = lists[listId]?.name;

      const newName = prompt('새 목록 이름을 입력하세요:', currentName);
      if (newName && newName.trim()) {
        renameCustomList(listId, newName.trim());
        modal.remove();
        renderCustomListsInDropdown();
        showListManagementModal(); // 모달 다시 열기
      }
    });
  });

  // 삭제 버튼
  modal.querySelectorAll('.mgmt-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const listId = btn.getAttribute('data-list-id');
      const lists = getAllCustomLists();
      const listName = lists[listId]?.name;

      if (confirm(`"${listName}" 목록을 삭제하시겠습니까?\n(목록에 추가된 문제들은 유지됩니다)`)) {
        deleteCustomList(listId);
        modal.remove();
        renderCustomListsInDropdown();
        showListManagementModal(); // 모달 다시 열기
      }
    });
  });
}

/**
 * 초기화: 이벤트 리스너 등록 및 UI 렌더링
 */
export function initCustomReviewLists() {
  // 드롭다운에 목록 렌더링
  renderCustomListsInDropdown();

  // filter-select 드롭다운 change 이벤트 처리
  const filterSelect = document.getElementById('filter-select');
  if (filterSelect && !filterSelect.dataset.customListListenerAdded) {
    // 이전 선택값 저장 (액션 실행 후 복원용)
    let previousValue = filterSelect.value;

    filterSelect.addEventListener('change', (e) => {
      const selectedValue = e.target.value;

      // 액션 옵션 처리
      if (selectedValue === 'action:add-question') {
        // 현재 문제를 목록에 추가
        e.stopPropagation();
        showAddToListModal();
        // 이전 값으로 복원
        setTimeout(() => {
          filterSelect.value = previousValue;
        }, 0);
      } else if (selectedValue === 'action:add-list') {
        // 새 목록 만들기
        e.stopPropagation();
        const name = prompt('새 복습 목록의 이름을 입력하세요:', '나만의 복습 목록');
        if (name && name.trim()) {
          createCustomList(name.trim());
        }
        // 이전 값으로 복원
        setTimeout(() => {
          filterSelect.value = previousValue;
        }, 0);
      } else if (selectedValue === 'action:manage-lists') {
        // 목록 관리 모달
        e.stopPropagation();
        showListManagementModal();
        // 이전 값으로 복원
        setTimeout(() => {
          filterSelect.value = previousValue;
        }, 0);
      } else {
        // 일반 필터 선택 (목록 선택 포함)
        previousValue = selectedValue;
      }
    });

    filterSelect.dataset.customListListenerAdded = 'true';
  }

  // review-flag-toggle 버튼 더블클릭 이벤트 추가
  const reviewFlagBtn = document.getElementById('review-flag-toggle');
  if (reviewFlagBtn && !reviewFlagBtn.dataset.doubleClickListenerAdded) {
    let clickCount = 0;
    let clickTimer = null;

    reviewFlagBtn.addEventListener('click', (e) => {
      clickCount++;

      if (clickCount === 1) {
        clickTimer = setTimeout(() => {
          // 단일 클릭: 기본 동작 (별 토글)
          clickCount = 0;
        }, 300);
      } else if (clickCount === 2) {
        // 더블 클릭: 이 문제를 목록에 추가하는 모달 열기
        clearTimeout(clickTimer);
        clickCount = 0;
        e.stopPropagation();
        showAddToListModal();
      }
    });

    reviewFlagBtn.dataset.doubleClickListenerAdded = 'true';
  }
}

/**
 * 현재 문제를 사용자 지정 목록에 추가하는 모달 표시
 */
function showAddToListModal() {
  const lists = getAllCustomLists();
  const listIds = Object.keys(lists);

  // 현재 문제 ID 가져오기 (전역 상태에서)
  const currentQuizData = window.currentQuizData || [];
  const currentQuestionIndex = window.currentQuestionIndex ?? -1;
  const currentQuestion = currentQuizData[currentQuestionIndex];
  const currentQuestionId = currentQuestion ? String(currentQuestion.고유ID).trim() : null;

  if (!currentQuestionId) {
    showToast('⚠️ 문제를 먼저 불러와주세요', 'warning');
    return;
  }

  const modalHTML = `
    <div id="add-to-list-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" style="backdrop-filter: blur(4px);">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100">📝 복습 목록에 추가</h3>
          <button id="close-add-modal-btn" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
        </div>
        <div class="space-y-2 max-h-96 overflow-y-auto mb-4">
          ${listIds.length === 0 ? '<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">복습 목록이 없습니다. 아래 버튼으로 새 목록을 만드세요.</p>' : ''}
          ${listIds.map(listId => {
            const list = lists[listId];
            const isAdded = getQuestionLists(currentQuestionId).includes(listId);
            return `
              <button class="add-to-list-btn w-full flex items-center justify-between p-3 ${isAdded ? 'bg-green-50 dark:bg-green-900 border-green-300 dark:border-green-600' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'} rounded border hover:bg-gray-100 dark:hover:bg-gray-600 transition" data-list-id="${listId}" data-is-added="${isAdded}">
                <div class="flex-1 text-left">
                  <div class="text-sm font-medium text-gray-800 dark:text-gray-100">${list.name}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">${list.questionCount || 0}문제</div>
                </div>
                <div class="text-sm font-medium ${isAdded ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}">
                  ${isAdded ? '✓ 추가됨' : '+ 추가'}
                </div>
              </button>
            `;
          }).join('')}
        </div>
        <button id="create-new-list-btn" class="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition">
          + 새 목록 만들고 추가
        </button>
      </div>
    </div>
  `;

  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer.firstElementChild);

  const modal = document.getElementById('add-to-list-modal');

  // 닫기 버튼
  document.getElementById('close-add-modal-btn')?.addEventListener('click', () => {
    modal.remove();
  });

  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // 목록에 추가/제거 버튼
  modal.querySelectorAll('.add-to-list-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const listId = btn.getAttribute('data-list-id');
      const isAdded = btn.getAttribute('data-is-added') === 'true';

      if (isAdded) {
        // 이미 추가된 경우: 제거
        removeQuestionFromList(currentQuestionId, listId);
      } else {
        // 추가되지 않은 경우: 추가
        addQuestionToList(currentQuestionId, listId);
      }
      modal.remove();
    });
  });

  // 새 목록 만들고 추가 버튼
  document.getElementById('create-new-list-btn')?.addEventListener('click', () => {
    const name = prompt('새 복습 목록의 이름을 입력하세요:', '나만의 복습 목록');
    if (name && name.trim()) {
      const newListId = createCustomList(name.trim());
      addQuestionToList(currentQuestionId, newListId);
      modal.remove();
    }
  });
}
