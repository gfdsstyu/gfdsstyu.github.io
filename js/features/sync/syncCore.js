// ============================================
// 학습 데이터 동기화 핵심 로직 (Phase 2)
// ============================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import { db } from '../../app.js';
import { getQuestionScores, setQuestionScores, saveQuestionScores } from '../../core/stateManager.js';
import { mergeQuizScores } from '../../services/dataImportExport.js';

// ============================================
// 데이터 변환 함수
// ============================================

/**
 * localStorage의 questionScores를 Firestore 형식으로 변환 (경량화)
 *
 * 경량화 전략:
 * - user_answer, feedback 제외 (용량 큼)
 * - score, lastSolvedDate, solveHistory만 유지
 * - userReviewFlag, userReviewExclude 유지
 *
 * @param {Object} localScores - localStorage의 questionScores
 * @returns {Object} Firestore 형식의 userScores
 */
export function toFirestoreFormat(localScores) {
  const firestoreScores = {};

  Object.entries(localScores).forEach(([qid, data]) => {
    // 필수 필드만 추출
    firestoreScores[qid] = {
      score: data.score ?? 0,
      lastSolvedDate: data.lastSolvedDate ?? Date.now(),
      solveHistory: data.solveHistory ?? [],
      userReviewFlag: !!data.userReviewFlag,
      userReviewExclude: !!data.userReviewExclude
    };
  });

  return firestoreScores;
}

/**
 * Firestore의 userScores를 localStorage 형식으로 변환
 *
 * 주의: feedback, user_answer는 Firestore에 없으므로 빈 값으로 복원
 *
 * @param {Object} firestoreScores - Firestore의 userScores
 * @returns {Object} localStorage 형식의 questionScores
 */
export function toLocalStorageFormat(firestoreScores) {
  const localScores = {};

  Object.entries(firestoreScores).forEach(([qid, data]) => {
    localScores[qid] = {
      score: data.score ?? 0,
      lastSolvedDate: data.lastSolvedDate ?? Date.now(),
      solveHistory: data.solveHistory ?? [],
      userReviewFlag: !!data.userReviewFlag,
      userReviewExclude: !!data.userReviewExclude,

      // Firestore에 없는 필드는 기본값 설정
      feedback: '', // 복원 불가
      user_answer: '', // 복원 불가
      hintUsed: false,
      memoryTipUsed: false,
      isSolved: true // 점수가 있으면 풀이한 것으로 간주
    };
  });

  return localScores;
}

// ============================================
// 로그인 시 동기화 (Cloud 우선)
// ============================================

/**
 * 로그인 시 Firestore와 localStorage 동기화
 *
 * 전략:
 * 1. Firestore에 데이터가 있으면 → localStorage 덮어쓰기 (Cloud 우선)
 * 2. Firestore에 데이터가 없으면 → localStorage를 Firestore에 업로드
 * 3. 양쪽에 모두 있으면 → 병합 (mergeQuizScores 활용)
 *
 * @param {string} userId - 사용자 UID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function syncOnLogin(userId) {
  try {
    console.log('🔄 로그인 시 데이터 동기화 시작...', userId);

    // 1. Firestore에서 사용자 데이터 가져오기
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.error('❌ Firestore 사용자 문서가 없습니다:', userId);
      return { success: false, message: 'Firestore 사용자 문서가 없습니다.' };
    }

    const userData = userDocSnap.data();
    const cloudScores = userData.userScores || {};
    const localScores = getQuestionScores();

    const cloudCount = Object.keys(cloudScores).length;
    const localCount = Object.keys(localScores).length;

    console.log(`   - Cloud: ${cloudCount}개 문제`);
    console.log(`   - Local: ${localCount}개 문제`);

    // 2. 동기화 전략 결정
    if (cloudCount === 0 && localCount === 0) {
      // 양쪽 모두 비어있음 - 아무것도 안 함
      console.log('✅ 동기화 불필요 (양쪽 모두 비어있음)');
      return { success: true, message: '동기화 불필요' };
    } else if (cloudCount > 0 && localCount === 0) {
      // Cloud만 있음 → Local로 다운로드
      console.log('📥 Cloud → Local 동기화 중...');
      const convertedScores = toLocalStorageFormat(cloudScores);
      setQuestionScores(convertedScores);
      saveQuestionScores();
      console.log(`✅ ${cloudCount}개 문제 다운로드 완료`);
      return { success: true, message: `${cloudCount}개 문제 동기화 완료` };
    } else if (cloudCount === 0 && localCount > 0) {
      // Local만 있음 → Cloud로 업로드
      console.log('📤 Local → Cloud 동기화 중...');
      const convertedScores = toFirestoreFormat(localScores);
      await updateDoc(userDocRef, {
        userScores: convertedScores,
        'profile.lastSyncAt': serverTimestamp()
      });
      console.log(`✅ ${localCount}개 문제 업로드 완료`);
      return { success: true, message: `${localCount}개 문제 업로드 완료` };
    } else {
      // 양쪽 모두 있음 → 병합
      console.log('🔀 Cloud ↔ Local 병합 중...');
      const convertedCloudScores = toLocalStorageFormat(cloudScores);
      const mergedScores = mergeQuizScores(localScores, convertedCloudScores);

      // Local에 병합 결과 저장
      setQuestionScores(mergedScores);
      saveQuestionScores();

      // Cloud에도 병합 결과 업로드
      const convertedMergedScores = toFirestoreFormat(mergedScores);
      await updateDoc(userDocRef, {
        userScores: convertedMergedScores,
        'profile.lastSyncAt': serverTimestamp()
      });

      const mergedCount = Object.keys(mergedScores).length;
      console.log(`✅ ${mergedCount}개 문제 병합 완료`);
      return { success: true, message: `${mergedCount}개 문제 병합 완료` };
    }
  } catch (error) {
    console.error('❌ 동기화 실패:', error);
    return { success: false, message: `동기화 실패: ${error.message}` };
  }
}

// ============================================
// 학습 중 실시간 동기화
// ============================================

/**
 * 학습 중 점수 저장 시 Firestore에 업데이트
 *
 * 주의: 전체 userScores를 매번 업로드하는 것은 비효율적이지만,
 * Firestore의 제한(단일 필드 업데이트 시 배열 병합 어려움) 때문에
 * 전체 userScores를 업데이트합니다.
 *
 * @param {string} userId - 사용자 UID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function syncToFirestore(userId) {
  if (!userId) {
    console.warn('⚠️ 로그인되지 않음 - Firestore 동기화 스킵');
    return { success: false, message: '로그인되지 않음' };
  }

  try {
    const localScores = getQuestionScores();
    const convertedScores = toFirestoreFormat(localScores);

    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      userScores: convertedScores,
      'profile.lastSyncAt': serverTimestamp()
    });

    const count = Object.keys(convertedScores).length;
    console.log(`✅ Firestore 동기화 완료: ${count}개 문제`);
    return { success: true, message: `${count}개 문제 동기화` };
  } catch (error) {
    console.error('❌ Firestore 동기화 실패:', error);
    return { success: false, message: `동기화 실패: ${error.message}` };
  }
}

// ============================================
// 디버깅 함수
// ============================================

/**
 * 현재 questionScores의 용량 추정
 * @returns {number} 대략적인 바이트 크기
 */
export function estimateScoresSize() {
  const scores = getQuestionScores();
  const json = JSON.stringify(scores);
  const bytes = new Blob([json]).size;
  const kb = (bytes / 1024).toFixed(2);
  const mb = (bytes / 1024 / 1024).toFixed(4);

  console.log(`📊 questionScores 용량: ${bytes} bytes (${kb} KB, ${mb} MB)`);
  console.log(`   - 문제 수: ${Object.keys(scores).length}개`);
  console.log(`   - 평균 문제당: ${(bytes / Object.keys(scores).length).toFixed(0)} bytes`);

  return bytes;
}

/**
 * Firestore 형식 변환 시 용량 절감 효과 확인
 */
export function compareFormats() {
  const localScores = getQuestionScores();
  const firestoreScores = toFirestoreFormat(localScores);

  const localSize = new Blob([JSON.stringify(localScores)]).size;
  const firestoreSize = new Blob([JSON.stringify(firestoreScores)]).size;

  const reduction = ((1 - firestoreSize / localSize) * 100).toFixed(2);

  console.log('📊 데이터 포맷 비교:');
  console.log(`   - localStorage: ${localSize} bytes (${(localSize / 1024).toFixed(2)} KB)`);
  console.log(`   - Firestore: ${firestoreSize} bytes (${(firestoreSize / 1024).toFixed(2)} KB)`);
  console.log(`   - 절감: ${reduction}%`);

  return { localSize, firestoreSize, reduction };
}
