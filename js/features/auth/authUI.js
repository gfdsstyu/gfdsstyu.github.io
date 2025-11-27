// ============================================
// Firebase 인증 UI 관리
// ============================================

import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  logout,
  getCurrentUser,
  addAuthStateListener,
  resetPassword,
  updateStatusMessage,
  getStatusMessage,
  deleteUserAccount,
  withdrawUser,
  getNickname,
  updateNickname,
  checkNicknameDuplicate
} from './authCore.js';

import { showToast } from '../../ui/domUtils.js';

// [Achievement System 2.0] 티어 시스템
import { calculateTier } from '../ranking/rankingCore.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { db } from '../../app.js';

// ============================================
// DOM 요소
// ============================================

let loginBtn = null;
let userMenuBtn = null;
let loginModal = null;
let loginTabBtns = null;
let loginTabPanels = null;

// ============================================
// UI 초기화
// ============================================

/**
 * 인증 UI 초기화
 */
export function initAuthUI() {
  console.log('🔐 인증 UI 초기화 시작...');

  // DOM 요소 가져오기
  loginBtn = document.getElementById('login-btn');
  userMenuBtn = document.getElementById('user-menu-btn');
  loginModal = document.getElementById('login-modal');

  if (!loginBtn || !userMenuBtn || !loginModal) {
    console.error('❌ 인증 UI 요소를 찾을 수 없습니다.');
    return;
  }

  // 이벤트 리스너 설정
  setupEventListeners();

  // 인증 상태 변경 리스너 등록
  addAuthStateListener(updateUIForAuthState);

  // 초기 UI 상태 설정
  updateUIForAuthState(getCurrentUser());

  console.log('✅ 인증 UI 초기화 완료');
}

// ============================================
// 이벤트 리스너 설정
// ============================================

function setupEventListeners() {
  // 로그인 버튼 클릭
  loginBtn.addEventListener('click', openLoginModal);

  // 사용자 메뉴 버튼 클릭
  userMenuBtn.addEventListener('click', toggleUserMenu);

  // 로그인 모달 닫기
  const closeModalBtn = document.getElementById('login-modal-close');
  const modalBackdrop = document.getElementById('login-modal-backdrop');

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeLoginModal);
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', closeLoginModal);
  }

  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && loginModal && !loginModal.classList.contains('hidden')) {
      closeLoginModal();
    }
  });

  // 탭 전환
  const loginTab = document.getElementById('login-tab');
  const signupTab = document.getElementById('signup-tab');

  if (loginTab && signupTab) {
    loginTab.addEventListener('click', () => switchTab('login'));
    signupTab.addEventListener('click', () => switchTab('signup'));
  }

  // Google 로그인 버튼
  const googleLoginBtn = document.getElementById('google-login-btn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', handleGoogleLogin);
  }

  // Google 회원가입 버튼 (동일한 핸들러 사용)
  const googleSignupBtn = document.getElementById('google-signup-btn');
  if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', handleGoogleLogin);
  }

  // 이메일 로그인 폼
  const loginForm = document.getElementById('email-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleEmailLogin);
  }

  // 이메일 회원가입 폼
  const signupForm = document.getElementById('email-signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', handleEmailSignup);
  }

  // 로그아웃 버튼
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // 회원 탈퇴 버튼
  const withdrawBtn = document.getElementById('withdraw-btn');
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', handleWithdrawal);
  }

  // 비밀번호 찾기 버튼
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', handleForgotPassword);
  }

  // 내 프로필 버튼
  const myProfileBtn = document.getElementById('my-profile-btn');
  if (myProfileBtn) {
    myProfileBtn.addEventListener('click', openProfileModal);
  }

  // 프로필 모달 닫기
  const profileModalClose = document.getElementById('profile-modal-close');
  const profileModalBackdrop = document.getElementById('profile-modal-backdrop');

  if (profileModalClose) {
    profileModalClose.addEventListener('click', closeProfileModal);
  }

  if (profileModalBackdrop) {
    profileModalBackdrop.addEventListener('click', closeProfileModal);
  }

  // 상태 메시지 입력 - 글자 수 카운터
  const statusMessageInput = document.getElementById('status-message-input');
  const statusCharCount = document.getElementById('status-char-count');

  if (statusMessageInput && statusCharCount) {
    statusMessageInput.addEventListener('input', () => {
      statusCharCount.textContent = statusMessageInput.value.length;
    });
  }

  // 상태 메시지 저장 버튼
  const saveStatusBtn = document.getElementById('save-status-btn');
  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', handleSaveStatusMessage);
  }

  // [프로필 닉네임] 닉네임 입력 - 글자 수 카운터 및 실시간 중복 체크
  const profileNicknameInput = document.getElementById('profile-nickname-input');
  const nicknameCharCount = document.getElementById('nickname-char-count');
  const nicknameValidationMessage = document.getElementById('nickname-validation-message');

  if (profileNicknameInput && nicknameCharCount) {
    let nicknameCheckTimeout;

    profileNicknameInput.addEventListener('input', () => {
      const length = profileNicknameInput.value.length;
      nicknameCharCount.textContent = length;

      // 실시간 중복 체크 (디바운싱)
      clearTimeout(nicknameCheckTimeout);
      nicknameCheckTimeout = setTimeout(async () => {
        if (length >= 2 && length <= 20) {
          const result = await checkNicknameDuplicate(profileNicknameInput.value);
          if (nicknameValidationMessage) {
            nicknameValidationMessage.classList.remove('hidden');
            if (result.isDuplicate) {
              nicknameValidationMessage.className = 'text-xs text-red-600 dark:text-red-400';
              nicknameValidationMessage.textContent = '❌ ' + result.message;
            } else {
              nicknameValidationMessage.className = 'text-xs text-green-600 dark:text-green-400';
              nicknameValidationMessage.textContent = '✅ ' + result.message;
            }
          }
        } else if (length > 0) {
          if (nicknameValidationMessage) {
            nicknameValidationMessage.classList.remove('hidden');
            nicknameValidationMessage.className = 'text-xs text-gray-600 dark:text-gray-400';
            nicknameValidationMessage.textContent = '닉네임은 2-20자여야 합니다.';
          }
        } else {
          if (nicknameValidationMessage) {
            nicknameValidationMessage.classList.add('hidden');
          }
        }
      }, 500); // 500ms 디바운싱
    });
  }

  // [프로필 닉네임] 닉네임 저장 버튼
  const saveProfileNicknameBtn = document.getElementById('save-profile-nickname-btn');
  if (saveProfileNicknameBtn) {
    saveProfileNicknameBtn.addEventListener('click', handleSaveProfileNickname);
  }

  // 회원 탈퇴 버튼
  const deleteAccountBtn = document.getElementById('delete-account-btn');
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', handleDeleteAccount);
  }
}

// ============================================
// 모달 관리
// ============================================

function openLoginModal() {
  if (loginModal) {
    // 모달을 body의 직계 자식으로 이동 (최상위 레벨 보장)
    if (loginModal.parentNode !== document.body) {
      document.body.appendChild(loginModal);
    }

    loginModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeLoginModal() {
  if (loginModal) {
    loginModal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// ============================================
// 탭 전환
// ============================================

function switchTab(tab) {
  const loginTab = document.getElementById('login-tab');
  const signupTab = document.getElementById('signup-tab');
  const loginPanel = document.getElementById('login-panel');
  const signupPanel = document.getElementById('signup-panel');

  if (!loginTab || !signupTab || !loginPanel || !signupPanel) return;

  if (tab === 'login') {
    // 로그인 탭 활성화
    loginTab.classList.add('border-blue-600', 'text-blue-600');
    loginTab.classList.remove('border-transparent', 'text-gray-500');
    signupTab.classList.remove('border-blue-600', 'text-blue-600');
    signupTab.classList.add('border-transparent', 'text-gray-500');

    loginPanel.classList.remove('hidden');
    signupPanel.classList.add('hidden');
  } else {
    // 회원가입 탭 활성화
    signupTab.classList.add('border-blue-600', 'text-blue-600');
    signupTab.classList.remove('border-transparent', 'text-gray-500');
    loginTab.classList.remove('border-blue-600', 'text-blue-600');
    loginTab.classList.add('border-transparent', 'text-gray-500');

    signupPanel.classList.remove('hidden');
    loginPanel.classList.add('hidden');
  }
}

// ============================================
// 로그인/회원가입 핸들러
// ============================================

async function handleGoogleLogin() {
  const result = await signInWithGoogle();

  if (result.success) {
    showToast('✅ 로그인 성공!', 'success');
    closeLoginModal();
  } else {
    showToast(`❌ ${result.error}`, 'error');
  }
}

async function handleEmailLogin(e) {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showToast('❌ 이메일과 비밀번호를 입력해주세요.', 'error');
    return;
  }

  const result = await signInWithEmail(email, password);

  if (result.success) {
    showToast('✅ 로그인 성공!', 'success');
    closeLoginModal();
  } else {
    showToast(`❌ ${result.error}`, 'error');
  }
}

async function handleEmailSignup(e) {
  e.preventDefault();

  const displayName = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const passwordConfirm = document.getElementById('signup-password-confirm').value;

  if (!displayName || !email || !password || !passwordConfirm) {
    showToast('❌ 모든 필드를 입력해주세요.', 'error');
    return;
  }

  if (password !== passwordConfirm) {
    showToast('❌ 비밀번호가 일치하지 않습니다.', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('❌ 비밀번호는 최소 6자 이상이어야 합니다.', 'error');
    return;
  }

  const result = await signUpWithEmail(email, password, displayName);

  if (result.success) {
    showToast('✅ 회원가입 성공!', 'success');
    closeLoginModal();
  } else {
    showToast(`❌ ${result.error}`, 'error');
  }
}

async function handleLogout() {
  const confirmed = confirm('로그아웃 하시겠습니까?');
  if (!confirmed) return;

  const result = await logout();

  if (result.success) {
    showToast('✅ 로그아웃 되었습니다.', 'info');
    closeUserMenu();
  } else {
    showToast(`❌ ${result.error}`, 'error');
  }
}

/**
 * 회원 탈퇴 핸들러
 */
async function handleWithdrawal() {
  // 1차 경고
  if (!confirm('정말로 탈퇴하시겠습니까?\n\n모든 학습 기록, 랭킹 정보, 그룹 활동 내역이 영구적으로 삭제되며 복구할 수 없습니다.')) {
    return;
  }

  // 2차 확인 (실수 방지)
  if (!confirm('마지막 확인입니다.\n\n정말 삭제하시겠습니까?')) {
    return;
  }

  // 로딩 표시
  showToast('탈퇴 처리 중입니다...', 'info');

  const result = await withdrawUser();

  if (result.success) {
    showToast('안녕히 가세요. 계정이 삭제되었습니다.', 'success');
    closeUserMenu();
    // 페이지 새로고침으로 상태 초기화
    setTimeout(() => window.location.reload(), 1500);
  } else {
    showToast(`❌ ${result.message}`, 'error');

    // 재로그인 필요 시 안내
    if (result.message.includes('다시 로그인')) {
      setTimeout(() => {
        if (confirm('로그아웃 후 다시 로그인하시겠습니까?')) {
          logout().then(() => {
            showToast('로그아웃되었습니다. 다시 로그인해주세요.', 'info');
            closeUserMenu();
          });
        }
      }, 2000);
    }
  }
}

// ============================================
// 사용자 메뉴
// ============================================

function toggleUserMenu() {
  const userMenu = document.getElementById('user-menu');
  if (userMenu) {
    userMenu.classList.toggle('hidden');
  }
}

function closeUserMenu() {
  const userMenu = document.getElementById('user-menu');
  if (userMenu) {
    userMenu.classList.add('hidden');
  }
}

// 사용자 메뉴 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userMenu = document.getElementById('user-menu');

  if (userMenuBtn && userMenu && !userMenu.classList.contains('hidden')) {
    if (!userMenuBtn.contains(e.target) && !userMenu.contains(e.target)) {
      closeUserMenu();
    }
  }
});

// ============================================
// 프로필 모달 관리
// ============================================

/**
 * 프로필 모달 열기
 */
async function openProfileModal() {
  const profileModal = document.getElementById('profile-modal');
  if (!profileModal) return;

  const user = getCurrentUser();
  if (!user) {
    showToast('❌ 로그인이 필요합니다.', 'error');
    return;
  }

  try {
    // 사용자 정보 표시 (티어 정보 포함)
    await updateProfileModalUI(user);
  } catch (error) {
    console.error('❌ [Profile] 프로필 정보 로드 실패:', error);
    // 에러가 발생해도 모달은 열리도록 계속 진행
  }

  try {
    // 현재 상태 메시지 가져오기
    const statusResult = await getStatusMessage();
    if (statusResult && statusResult.success && statusResult.statusMessage) {
      const statusInput = document.getElementById('status-message-input');
      const charCount = document.getElementById('status-char-count');
      if (statusInput) {
        statusInput.value = statusResult.statusMessage;
        if (charCount) {
          charCount.textContent = statusResult.statusMessage.length;
        }
      }
    }
  } catch (error) {
    console.error('❌ [Profile] 상태 메시지 로드 실패:', error);
  }

  // 이메일 로그인 사용자인지 확인하여 비밀번호 섹션 표시 여부 결정
  const isEmailProvider = user.providerData.some(
    provider => provider.providerId === 'password'
  );
  const deletePasswordSection = document.getElementById('delete-password-section');
  if (deletePasswordSection) {
    if (isEmailProvider) {
      deletePasswordSection.classList.remove('hidden');
    } else {
      deletePasswordSection.classList.add('hidden');
    }
  }

  // 모달을 body의 직계 자식으로 이동 (최상위 레벨 보장)
  if (profileModal.parentNode !== document.body) {
    document.body.appendChild(profileModal);
  }

  // 모달 표시
  profileModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // 사용자 메뉴 닫기
  closeUserMenu();
}

/**
 * 프로필 모달 닫기
 */
function closeProfileModal() {
  const profileModal = document.getElementById('profile-modal');
  if (profileModal) {
    profileModal.classList.add('hidden');
    document.body.style.overflow = '';

    // 입력 필드 초기화
    const statusInput = document.getElementById('status-message-input');
    const deletePasswordInput = document.getElementById('delete-password-input');
    if (statusInput) statusInput.value = '';
    if (deletePasswordInput) deletePasswordInput.value = '';
  }
}

/**
 * 프로필 모달 UI 업데이트
 */
async function updateProfileModalUI(user) {
  // 사용자 이름
  const displayNameEl = document.getElementById('profile-display-name');
  if (displayNameEl) {
    displayNameEl.textContent = user.displayName || user.email.split('@')[0];
  }

  // 이메일
  const emailEl = document.getElementById('profile-email');
  if (emailEl) {
    emailEl.textContent = user.email;
  }

  // 아바타 (이니셜 표시)
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    const name = user.displayName || user.email;
    const initial = name.charAt(0).toUpperCase();
    avatarEl.textContent = initial;

    // Google 프로필 사진이 있으면 표시
    if (user.photoURL) {
      avatarEl.style.backgroundImage = `url(${user.photoURL})`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.textContent = '';
    }
  }

  // [Achievement System 2.0] 티어 정보 표시
  await updateProfileTierUI(user.uid);

  // [프로필 닉네임] 현재 닉네임 로드
  await loadProfileNickname();
}

/**
 * [Achievement System 2.0] 프로필 모달의 티어 정보 업데이트
 * @param {string} userId - 사용자 UID
 */
async function updateProfileTierUI(userId) {
  try {
    // Firestore에서 사용자 데이터 가져오기
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.warn('[Profile] 사용자 문서를 찾을 수 없습니다.');
      return;
    }

    const userData = userDocSnap.data();

    // [디버깅] 사용자 데이터 구조 확인
    console.log('🔍 [Profile Debug] userId:', userId);
    console.log('🔍 [Profile Debug] userData.ranking:', userData.ranking);

    const totalAccumulatedRP = userData.ranking?.totalAccumulatedRP || 0;
    console.log('🔍 [Profile Debug] totalAccumulatedRP:', totalAccumulatedRP);

    // 티어 계산
    const tierInfo = calculateTier(totalAccumulatedRP);
    console.log('✅ [Profile Debug] tierInfo:', tierInfo);

    // 티어 아이콘 매핑
    const tierIcons = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '🔷',
      diamond: '💎',
      master: '👑',
      unranked: '⭐'
    };

    // UI 업데이트
    const tierIconEl = document.getElementById('profile-tier-icon');
    const tierNameEl = document.getElementById('profile-tier-name');
    const totalApEl = document.getElementById('profile-total-ap');
    const currentApEl = document.getElementById('profile-current-ap');
    const nextTierApEl = document.getElementById('profile-next-tier-ap');
    const progressBarEl = document.getElementById('profile-tier-progress-bar');
    const nextTierTextEl = document.getElementById('profile-next-tier-text');
    const progressTextEl = document.getElementById('profile-tier-progress-text');

    if (tierIconEl) tierIconEl.textContent = tierIcons[tierInfo.tier] || '⭐';
    if (tierNameEl) {
      tierNameEl.textContent = tierInfo.name;
      tierNameEl.style.color = tierInfo.color;
    }
    if (totalApEl) totalApEl.textContent = totalAccumulatedRP.toLocaleString();

    // 진행률 계산
    if (tierInfo.nextTier && tierInfo.nextMinAP) {
      const currentTierMin = tierInfo.minAP;
      const nextTierMin = tierInfo.nextMinAP;
      const apInCurrentTier = totalAccumulatedRP - currentTierMin;
      const apNeededForNextTier = nextTierMin - currentTierMin;
      const progressPercent = Math.min(100, (apInCurrentTier / apNeededForNextTier) * 100);

      if (currentApEl) currentApEl.textContent = apInCurrentTier.toLocaleString();
      if (nextTierApEl) nextTierApEl.textContent = apNeededForNextTier.toLocaleString();
      if (progressBarEl) progressBarEl.style.width = `${progressPercent}%`;

      if (nextTierTextEl) {
        const apRemaining = nextTierMin - totalAccumulatedRP;
        const nextTierNames = {
          bronze: 'Bronze',
          silver: 'Silver',
          gold: 'Gold',
          platinum: 'Platinum',
          diamond: 'Diamond',
          master: 'Master'
        };
        nextTierTextEl.textContent = `${nextTierNames[tierInfo.nextTier]} 티어까지 ${apRemaining.toLocaleString()} AP 남음`;
      }

      if (progressTextEl) {
        progressTextEl.textContent = '다음 티어까지';
      }
    } else {
      // 최고 티어 도달
      if (currentApEl) currentApEl.textContent = totalAccumulatedRP.toLocaleString();
      if (nextTierApEl) nextTierApEl.textContent = totalAccumulatedRP.toLocaleString();
      if (progressBarEl) progressBarEl.style.width = '100%';
      if (nextTierTextEl) nextTierTextEl.textContent = '🎉 최고 티어 달성!';
      if (progressTextEl) progressTextEl.textContent = '최고 티어';
    }

    console.log(`✅ [Profile] 티어 정보 표시: ${tierInfo.name} (${totalAccumulatedRP} AP)`);

  } catch (error) {
    console.error('❌ [Profile] 티어 정보 표시 실패:', error);
  }
}

/**
 * [프로필 닉네임] 현재 닉네임 로드
 */
async function loadProfileNickname() {
  try {
    const nickname = await getNickname();
    const profileNicknameInput = document.getElementById('profile-nickname-input');
    const nicknameCharCount = document.getElementById('nickname-char-count');

    if (profileNicknameInput) {
      profileNicknameInput.value = nickname || '';
      if (nicknameCharCount) {
        nicknameCharCount.textContent = (nickname || '').length;
      }
    }
  } catch (error) {
    console.error('❌ [Profile] 닉네임 로드 실패:', error);
  }
}

/**
 * [프로필 닉네임] 닉네임 저장 핸들러
 */
async function handleSaveProfileNickname() {
  const profileNicknameInput = document.getElementById('profile-nickname-input');
  const saveBtn = document.getElementById('save-profile-nickname-btn');
  const validationMessage = document.getElementById('nickname-validation-message');

  if (!profileNicknameInput || !saveBtn) return;

  const nickname = profileNicknameInput.value.trim();

  // 유효성 검사
  if (nickname.length < 2 || nickname.length > 20) {
    showToast('❌ 닉네임은 2-20자여야 합니다.', 'error');
    return;
  }

  // 중복 체크
  const duplicateCheck = await checkNicknameDuplicate(nickname);
  if (duplicateCheck.isDuplicate) {
    showToast('❌ ' + duplicateCheck.message, 'error');
    return;
  }

  // 저장 중 UI 업데이트
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

  // 닉네임 저장
  const result = await updateNickname(nickname);

  // 버튼 복원
  saveBtn.disabled = false;
  saveBtn.innerHTML = '닉네임 저장';

  if (result.success) {
    showToast('✅ ' + result.message, 'success');
    if (validationMessage) {
      validationMessage.classList.add('hidden');
    }
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

// ============================================
// 비밀번호 재설정
// ============================================

/**
 * 비밀번호 찾기 핸들러
 */
async function handleForgotPassword() {
  const emailInput = document.getElementById('login-email');
  const email = emailInput ? emailInput.value.trim() : '';

  if (!email) {
    showToast('❌ 이메일 주소를 먼저 입력해주세요.', 'error');
    return;
  }

  const confirmed = confirm(`${email}로 비밀번호 재설정 링크를 보내시겠습니까?`);
  if (!confirmed) return;

  const result = await resetPassword(email);

  if (result.success) {
    showToast('✅ ' + result.message, 'success');
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

// ============================================
// 상태 메시지 관리
// ============================================

/**
 * 상태 메시지 저장 핸들러
 */
async function handleSaveStatusMessage() {
  const statusInput = document.getElementById('status-message-input');
  if (!statusInput) return;

  const message = statusInput.value.trim();

  // 저장 중 표시
  const saveBtn = document.getElementById('save-status-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 저장 중...';
  }

  const result = await updateStatusMessage(message);

  // 버튼 복원
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> 저장';
  }

  if (result.success) {
    showToast('✅ 상태 메시지가 저장되었습니다.', 'success');
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

// ============================================
// 회원 탈퇴
// ============================================

/**
 * 회원 탈퇴 핸들러
 */
async function handleDeleteAccount() {
  const user = getCurrentUser();
  if (!user) {
    showToast('❌ 로그인이 필요합니다.', 'error');
    return;
  }

  // 확인 메시지
  const confirmed = confirm(
    '⚠️ 정말로 탈퇴하시겠습니까?\n\n' +
    '이 작업은 되돌릴 수 없으며, 다음 정보가 모두 삭제됩니다:\n' +
    '• 프로필 정보\n' +
    '• 학습 기록 및 통계\n' +
    '• 그룹 가입 정보\n' +
    '• 업적 달성 기록'
  );

  if (!confirmed) return;

  // 한 번 더 확인
  const doubleConfirmed = confirm(
    '마지막 확인입니다.\n정말로 탈퇴하시겠습니까?'
  );

  if (!doubleConfirmed) return;

  // 이메일 로그인 사용자는 비밀번호 확인
  const isEmailProvider = user.providerData.some(
    provider => provider.providerId === 'password'
  );

  let password = null;
  if (isEmailProvider) {
    const passwordInput = document.getElementById('delete-password-input');
    password = passwordInput ? passwordInput.value : '';

    if (!password) {
      showToast('❌ 본인 확인을 위해 비밀번호를 입력해주세요.', 'error');
      return;
    }
  }

  // 탈퇴 진행 중 표시
  const deleteBtn = document.getElementById('delete-account-btn');
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '탈퇴 처리 중...';
  }

  const result = await deleteUserAccount(password);

  // 버튼 복원
  if (deleteBtn) {
    deleteBtn.disabled = false;
    deleteBtn.textContent = '탈퇴하기';
  }

  if (result.success) {
    showToast('✅ 회원 탈퇴가 완료되었습니다.', 'info');
    closeProfileModal();
    // 페이지 새로고침하여 로그아웃 상태 반영
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

// ============================================
// UI 상태 업데이트
// ============================================

/**
 * 인증 상태에 따라 UI 업데이트
 */
function updateUIForAuthState(user) {
  if (user) {
    // 로그인 상태
    if (loginBtn) loginBtn.classList.add('hidden');
    if (userMenuBtn) {
      userMenuBtn.classList.remove('hidden');

      // 사용자 이름 표시
      const userNameSpan = userMenuBtn.querySelector('span');
      if (userNameSpan) {
        userNameSpan.textContent = user.displayName || user.email.split('@')[0];
      }
    }
  } else {
    // 로그아웃 상태
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (userMenuBtn) userMenuBtn.classList.add('hidden');
  }
}
