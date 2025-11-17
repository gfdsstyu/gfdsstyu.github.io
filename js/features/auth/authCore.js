// ============================================
// Firebase 인증 핵심 로직
// ============================================

import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import { auth, db } from '../../app.js';
import { syncOnLogin } from '../sync/syncCore.js';
import { showToast } from '../../ui/domUtils.js';

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
      message = '이미 사용 중인 이메일입니다.';
    } else if (error.code === 'auth/weak-password') {
      message = '비밀번호는 최소 6자 이상이어야 합니다.';
    } else if (error.code === 'auth/invalid-email') {
      message = '이메일 형식이 올바르지 않습니다.';
    }

    return { success: false, error: message };
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
  onAuthStateChanged(auth, (user) => {
    currentUser = user;

    if (user) {
      console.log('🔐 사용자 로그인됨:', user.email);
      console.log('   - UID:', user.uid);
      console.log('   - displayName:', user.displayName);
    } else {
      console.log('🔓 사용자 로그아웃됨');
    }

    // 등록된 모든 리스너에 알림
    notifyAuthStateChange(user);
  });
}
