// ============================================
// Firebase 인증 핵심 로직
// ============================================

import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import { auth, db } from '../../app.js';
import { syncOnLogin } from '../sync/syncCore.js';
import { showToast } from '../../ui/domUtils.js';
import { getMyGroups, leaveGroup } from '../group/groupCore.js';

// ============================================
// 상태 관리
// ============================================

let currentUser = null;
let authStateListeners = [];

/**
 * 현재 인증된 사용자 반환
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * 인증 상태 변경 리스너 추가
 */
export function addAuthStateListener(callback) {
  authStateListeners.push(callback);
}

/**
 * 인증 상태 변경 알림
 */
function notifyAuthStateChange(user) {
  authStateListeners.forEach(callback => callback(user));
}

// ============================================
// Google 로그인
// ============================================

/**
 * Google 계정으로 로그인
 */
export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    console.log('✅ Google 로그인 성공:', user.email);

    // Firestore에 사용자 프로필 생성/업데이트
    await ensureUserProfile(user);

    // Note: 학습 데이터 동기화는 initAuthStateObserver()에서 자동 처리됨

    return { success: true, user };
  } catch (error) {
    console.error('❌ Google 로그인 실패:', error);
    console.error('   - 에러 코드:', error.code);
    console.error('   - 에러 메시지:', error.message);

    let message = '로그인에 실패했습니다.';

    if (error.code === 'auth/popup-closed-by-user') {
      message = '로그인 창이 닫혔습니다.';
    } else if (error.code === 'auth/popup-blocked') {
      message = '팝업이 차단되었습니다. 브라우저 설정을 확인해주세요.';
    } else if (error.code === 'auth/unauthorized-domain') {
      message = '⚠️ Firebase Console에서 이 도메인을 승인된 도메인에 추가해주세요.\n\n' +
                '1. Firebase Console → Authentication → Settings\n' +
                '2. Authorized domains에 현재 도메인 추가';
    } else if (error.code === 'auth/operation-not-allowed') {
      message = '⚠️ Firebase Console에서 Google 로그인을 활성화해주세요.\n\n' +
                '1. Firebase Console → Authentication → Sign-in method\n' +
                '2. Google 제공업체 활성화';
    } else {
      // 알 수 없는 에러 - 개발자에게 전체 정보 표시
      message = `로그인 실패: ${error.code || 'UNKNOWN'}\n${error.message}\n\n콘솔을 확인하세요.`;
    }

    return { success: false, error: message, errorCode: error.code };
  }
}

// ============================================
// 이메일/비밀번호 로그인
// ============================================

/**
 * 이메일/비밀번호로 로그인
 */
export async function signInWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    console.log('✅ 이메일 로그인 성공:', user.email);

    await ensureUserProfile(user);

    // Note: 학습 데이터 동기화는 initAuthStateObserver()에서 자동 처리됨

    return { success: true, user };
  } catch (error) {
    console.error('❌ 이메일 로그인 실패:', error);

    let message = '로그인에 실패했습니다.';
    if (error.code === 'auth/user-not-found') {
      message = '등록되지 않은 이메일입니다.';
    } else if (error.code === 'auth/wrong-password') {
      message = '비밀번호가 일치하지 않습니다.';
    } else if (error.code === 'auth/invalid-email') {
      message = '이메일 형식이 올바르지 않습니다.';
    } else if (error.code === 'auth/invalid-credential') {
      message = '이메일 또는 비밀번호가 일치하지 않습니다.';
    }

    return { success: false, error: message };
  }
}

/**
 * 이메일/비밀번호로 회원가입
 */
export async function signUpWithEmail(email, password, displayName) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    console.log('✅ 회원가입 성공:', user.email);

    // 프로필 생성 시 displayName 포함
    await ensureUserProfile(user, displayName);

    // 학습 데이터 동기화 (Phase 2)
    console.log('🔄 학습 데이터 동기화 시작...');
    const syncResult = await syncOnLogin(user.uid);
    if (syncResult.success) {
      console.log('✅ 학습 데이터 동기화 완료:', syncResult.message);
      showToast(`✅ ${syncResult.message}`, 'success');
    } else {
      console.error('❌ 학습 데이터 동기화 실패:', syncResult.message);
      showToast(`⚠️ ${syncResult.message}`, 'warning');
    }

    return { success: true, user };
  } catch (error) {
    console.error('❌ 회원가입 실패:', error);

    let message = '회원가입에 실패했습니다.';
    if (error.code === 'auth/email-already-in-use') {
      message = '이미 가입된 이메일입니다. 로그인을 시도해주세요.';
    } else if (error.code === 'auth/weak-password') {
      message = '비밀번호는 최소 6자 이상이어야 합니다.';
    } else if (error.code === 'auth/invalid-email') {
      message = '이메일 형식이 올바르지 않습니다.';
    }

    return { success: false, error: message, errorCode: error.code };
  }
}

// ============================================
// 로그아웃
// ============================================

/**
 * 로그아웃
 */
export async function logout() {
  try {
    await signOut(auth);
    console.log('✅ 로그아웃 성공');
    return { success: true };
  } catch (error) {
    console.error('❌ 로그아웃 실패:', error);
    return { success: false, error: '로그아웃에 실패했습니다.' };
  }
}

// ============================================
// Firestore 사용자 프로필 관리
// ============================================

/**
 * 닉네임 업데이트 (Phase 3.1)
 * @param {string} nickname - 새 닉네임
 * @returns {Promise<{success: boolean, message: string, nextChangeDate?: string}>}
 */
export async function updateNickname(nickname) {
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  // 닉네임 유효성 검사
  const trimmedNickname = nickname.trim();
  if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
    return { success: false, message: '닉네임은 2-20자여야 합니다.' };
  }

  // 금지어 필터링
  const forbiddenWords = ['관리자', 'admin', '운영자', 'moderator', 'owner'];
  if (forbiddenWords.some(word => trimmedNickname.toLowerCase().includes(word))) {
    return { success: false, message: '사용할 수 없는 닉네임입니다.' };
  }

  try {
    console.log('👤 닉네임 업데이트 시작:', trimmedNickname);

    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const profile = userDocSnap.data().profile;
      const lastUpdatedAt = profile?.nicknameLastUpdatedAt;

      // 쿨다운 체크 (7일 = 604,800,000 ms)
      const COOLDOWN_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7일

      if (lastUpdatedAt) {
        const lastUpdatedTime = lastUpdatedAt.toMillis();
        const now = Date.now();
        const timeSinceUpdate = now - lastUpdatedTime;

        if (timeSinceUpdate < COOLDOWN_PERIOD) {
          const remainingTime = COOLDOWN_PERIOD - timeSinceUpdate;
          const daysRemaining = Math.ceil(remainingTime / (24 * 60 * 60 * 1000));
          const nextChangeDate = new Date(lastUpdatedTime + COOLDOWN_PERIOD);
          const nextChangeDateStr = nextChangeDate.toLocaleDateString('ko-KR');

          return {
            success: false,
            message: `닉네임은 7일마다 한 번만 변경할 수 있습니다.\n다음 변경 가능 날짜: ${nextChangeDateStr} (${daysRemaining}일 후)`,
            nextChangeDate: nextChangeDateStr
          };
        }
      }
    }

    // 닉네임 업데이트
    await updateDoc(userDocRef, {
      'profile.nickname': trimmedNickname,
      'profile.nicknameLastUpdatedAt': serverTimestamp()
    });

    console.log('✅ 닉네임 업데이트 완료');
    return { success: true, message: '닉네임이 저장되었습니다.\n7일 후 다시 변경할 수 있습니다.' };
  } catch (error) {
    console.error('❌ 닉네임 업데이트 실패:', error);
    return { success: false, message: `닉네임 저장 실패: ${error.message}` };
  }
}

/**
 * 현재 사용자의 닉네임 조회
 * @returns {Promise<string|null>}
 */
export async function getNickname() {
  if (!currentUser) return null;

  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      return userDocSnap.data().profile?.nickname || null;
    }

    return null;
  } catch (error) {
    console.error('❌ 닉네임 조회 실패:', error);
    return null;
  }
}

/**
 * Firestore에 사용자 프로필 생성/업데이트
 * @param {Object} user - Firebase Auth 사용자 객체
 * @param {string} customDisplayName - 커스텀 표시 이름 (회원가입 시)
 */
async function ensureUserProfile(user, customDisplayName = null) {
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    const displayName = customDisplayName || user.displayName || user.email.split('@')[0];

    if (!userDocSnap.exists()) {
      // 신규 사용자 - 프로필 생성
      console.log('🆕 신규 사용자 프로필 생성:', user.uid);

      await setDoc(userDocRef, {
        profile: {
          displayName: displayName,
          nickname: null, // Phase 3.1: 닉네임 (사용자가 직접 설정)
          email: user.email,
          photoURL: user.photoURL || null,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        },
        userScores: {} // 빈 객체로 초기화 (Phase 2에서 동기화)
      });
    } else {
      // 기존 사용자 - lastLoginAt만 업데이트
      console.log('👤 기존 사용자 로그인:', user.uid);

      await setDoc(userDocRef, {
        profile: {
          lastLoginAt: serverTimestamp()
        }
      }, { merge: true });
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Firestore 프로필 생성/업데이트 실패:', error);
    return { success: false, error };
  }
}

// ============================================
// 인증 상태 관찰
// ============================================

/**
 * Firebase 인증 상태 관찰 시작
 */
export function initAuthStateObserver() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (user) {
      console.log('🔐 사용자 로그인됨:', user.email);
      console.log('   - UID:', user.uid);
      console.log('   - displayName:', user.displayName);

      // Phase 2: 학습 데이터 동기화
      console.log('🔄 학습 데이터 동기화 시작...');
      try {
        const syncResult = await syncOnLogin(user.uid);
        if (syncResult.success) {
          console.log('✅ 학습 데이터 동기화 완료:', syncResult.message);
          showToast(`✅ ${syncResult.message}`, 'success');
        } else {
          console.warn('⚠️ 학습 데이터 동기화 실패:', syncResult.message);
        }
      } catch (error) {
        console.error('❌ 학습 데이터 동기화 에러:', error);
      }
    } else {
      console.log('🔓 사용자 로그아웃됨');
    }

    // 등록된 모든 리스너에 알림
    notifyAuthStateChange(user);
  });
}

// ============================================
// 비밀번호 재설정
// ============================================

/**
 * 비밀번호 재설정 이메일 발송
 * @param {string} email - 비밀번호를 재설정할 이메일 주소
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function resetPassword(email) {
  try {
    if (!email || !email.trim()) {
      return { success: false, message: '이메일 주소를 입력해주세요.' };
    }

    // Firebase에서 비밀번호 재설정 이메일 발송
    await sendPasswordResetEmail(auth, email);

    console.log('✅ 비밀번호 재설정 이메일 발송 성공:', email);
    return {
      success: true,
      message: '비밀번호 재설정 링크가 이메일로 전송되었습니다.\n메일함을 확인해주세요.'
    };
  } catch (error) {
    console.error('❌ 비밀번호 재설정 이메일 발송 실패:', error);

    let message = '비밀번호 재설정에 실패했습니다.';
    if (error.code === 'auth/user-not-found') {
      message = '등록되지 않은 이메일입니다.';
    } else if (error.code === 'auth/invalid-email') {
      message = '이메일 형식이 올바르지 않습니다.';
    } else if (error.code === 'auth/too-many-requests') {
      message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    }

    return { success: false, message };
  }
}

// ============================================
// 상태 메시지 관리
// ============================================

/**
 * 상태 메시지 업데이트
 * @param {string} message - 상태 메시지 (최대 20자)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function updateStatusMessage(message) {
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  // 상태 메시지 유효성 검사
  const trimmedMessage = message.trim();
  if (trimmedMessage.length > 20) {
    return { success: false, message: '상태 메시지는 최대 20자까지 가능합니다.' };
  }

  try {
    console.log('💬 상태 메시지 업데이트 시작:', trimmedMessage);

    const userDocRef = doc(db, 'users', currentUser.uid);

    // 상태 메시지 업데이트
    await updateDoc(userDocRef, {
      'profile.statusMessage': trimmedMessage || null,
      'profile.lastUpdatedAt': serverTimestamp()
    });

    console.log('✅ 상태 메시지 업데이트 완료');
    return { success: true, message: '상태 메시지가 저장되었습니다.' };
  } catch (error) {
    console.error('❌ 상태 메시지 업데이트 실패:', error);
    return { success: false, message: `상태 메시지 저장 실패: ${error.message}` };
  }
}

/**
 * 현재 사용자의 상태 메시지 조회
 * @returns {Promise<string|null>}
 */
export async function getStatusMessage() {
  if (!currentUser) return null;

  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      return userDocSnap.data().profile?.statusMessage || null;
    }

    return null;
  } catch (error) {
    console.error('❌ 상태 메시지 조회 실패:', error);
    return null;
  }
}

// ============================================
// 회원 탈퇴 (Soft Delete)
// ============================================

/**
 * 회원 탈퇴 (재인증 + Soft Delete)
 * @param {string} password - 현재 비밀번호 (이메일 로그인 사용자만)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteUserAccount(password = null) {
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  try {
    console.log('⚠️ 회원 탈퇴 시작:', currentUser.email);

    // 이메일/비밀번호 로그인 사용자는 재인증 필요
    const isEmailProvider = currentUser.providerData.some(
      provider => provider.providerId === 'password'
    );

    if (isEmailProvider) {
      if (!password) {
        return {
          success: false,
          message: '회원 탈퇴를 위해 현재 비밀번호를 입력해주세요.'
        };
      }

      // 재인증
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      try {
        await reauthenticateWithCredential(currentUser, credential);
        console.log('✅ 재인증 성공');
      } catch (reauthError) {
        console.error('❌ 재인증 실패:', reauthError);
        if (reauthError.code === 'auth/wrong-password') {
          return { success: false, message: '비밀번호가 일치하지 않습니다.' };
        }
        return { success: false, message: '재인증에 실패했습니다.' };
      }
    }

    // Firestore에서 Soft Delete 처리
    const userDocRef = doc(db, 'users', currentUser.uid);

    await updateDoc(userDocRef, {
      deleted: true,
      deletedAt: serverTimestamp(),
      'profile.displayName': '(알 수 없음)',
      'profile.nickname': '(알 수 없음)',
      'profile.statusMessage': null,
      'profile.email': '(알 수 없음)',
      'profile.photoURL': null
    });

    console.log('✅ Firestore 데이터 익명화 완료');

    // Firebase Auth에서 사용자 삭제
    await deleteUser(currentUser);

    console.log('✅ 회원 탈퇴 완료');
    return {
      success: true,
      message: '회원 탈퇴가 완료되었습니다. 그동안 감사했습니다.'
    };
  } catch (error) {
    console.error('❌ 회원 탈퇴 실패:', error);

    let message = '회원 탈퇴에 실패했습니다.';
    if (error.code === 'auth/requires-recent-login') {
      message = '보안을 위해 다시 로그인한 후 탈퇴를 진행해주세요.';
    }

    return { success: false, message };
  }
}

// ============================================
// 회원 탈퇴 (완전 삭제)
// ============================================

/**
 * 회원 탈퇴 (데이터 정리 및 계정 완전 삭제)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function withdrawUser() {
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  try {
    const userId = currentUser.uid;
    console.log(`🗑️ 회원 탈퇴 프로세스 시작: ${userId}`);

    // 1. 그룹 소유 여부 확인 및 탈퇴 처리
    // 그룹장은 탈퇴 불가하므로, 먼저 그룹을 삭제하거나 권한을 위임해야 함
    console.log('   - 그룹 정보 확인 중...');
    const myGroups = await getMyGroups();
    const ownedGroups = myGroups.filter(g => g.ownerId === userId);

    if (ownedGroups.length > 0) {
      return {
        success: false,
        message: `운영 중인 그룹(${ownedGroups[0].name} 등)이 있습니다.\n그룹을 삭제하거나 그룹장을 위임한 후 탈퇴해주세요.`
      };
    }

    // 2. 가입된 그룹에서 모두 탈퇴
    // (그룹 랭킹 및 멤버 카운트 갱신을 위해 leaveGroup 함수 재사용)
    if (myGroups.length > 0) {
      console.log(`   - ${myGroups.length}개 그룹에서 탈퇴 중...`);
      for (const group of myGroups) {
        console.log(`     * 그룹 탈퇴: ${group.name}`);
        await leaveGroup(group.groupId);
      }
    }

    // 3. Firestore 개인 데이터 삭제
    // (보안 규칙상 본인 데이터 삭제 허용됨)
    console.log('   - Firestore 개인 데이터 삭제 중...');
    const deletions = [
      deleteDoc(doc(db, 'users', userId)),           // 사용자 정보 & 점수
      deleteDoc(doc(db, 'rankings', userId))         // 랭킹 정보
    ];

    // universityVerifications 문서는 존재할 수도, 안 할 수도 있음
    try {
      const verificationDocRef = doc(db, 'universityVerifications', userId);
      const verificationDocSnap = await getDoc(verificationDocRef);
      if (verificationDocSnap.exists()) {
        deletions.push(deleteDoc(verificationDocRef));
      }
    } catch (err) {
      console.warn('   - universityVerifications 확인 실패 (무시):', err.message);
    }

    await Promise.all(deletions);
    console.log('   - Firestore 개인 데이터 삭제 완료');

    // 4. Firebase Auth 계정 삭제
    // (가장 마지막에 수행. 성공 시 자동으로 로그아웃 처리됨)
    console.log('   - Firebase Auth 계정 삭제 중...');
    await deleteUser(currentUser);
    console.log('✅ Firebase Auth 계정 삭제 완료');

    return { success: true, message: '회원 탈퇴가 완료되었습니다. 그동안 감사했습니다.' };

  } catch (error) {
    console.error('❌ 회원 탈퇴 실패:', error);

    // 재인증 필요 에러 처리
    if (error.code === 'auth/requires-recent-login') {
      return {
        success: false,
        message: '보안을 위해 다시 로그인이 필요합니다.\n로그아웃 후 다시 로그인하여 시도해주세요.'
      };
    }

    return { success: false, message: `탈퇴 실패: ${error.message}` };
  }
}
