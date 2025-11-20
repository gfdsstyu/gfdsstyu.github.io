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
import {
  getQuestionScores,
  setQuestionScores,
  saveQuestionScores,
  setSelectedAiModel,
  setDarkMode,
  setMemoryTipMode,
  setSttProvider
} from '../../core/stateManager.js';
import { mergeQuizScores } from '../../services/dataImportExport.js';
import { applyDarkMode } from '../../ui/domUtils.js';
import { updateDDayDisplay } from '../../core/storageManager.js';

// Achievement and settings management (for Option C)
const ACHIEVEMENTS_LS_KEY = 'achievements_v1';
const SETTINGS_KEYS = {
  selectedAiModel: 'aiModel',
  darkMode: 'darkMode',
  examDate: 'examDate_v1',
  reviewMode: 'reviewMode',
  memoryTipMode: 'memoryTipMode',
  sttProvider: 'sttProvider_v1'
  // NOTE: geminiApiKey and googleSttKey are intentionally excluded for security
};

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
// Achievements 변환 함수
// ============================================

/**
 * localStorage의 achievements를 Firestore 형식으로 변환
 * @param {Object} localAchievements - localStorage의 achievements
 * @returns {Object} Firestore 형식의 achievements
 */
export function achievementsToFirestoreFormat(localAchievements) {
  // achievements는 이미 { achievementId: { unlockedAt, seen } } 형태이므로
  // 그대로 반환 (추가 변환 불필요)
  return localAchievements || {};
}

/**
 * Firestore의 achievements를 localStorage 형식으로 변환
 * @param {Object} firestoreAchievements - Firestore의 achievements
 * @returns {Object} localStorage 형식의 achievements
 */
export function achievementsToLocalStorageFormat(firestoreAchievements) {
  // achievements는 동일한 형태이므로 그대로 반환
  return firestoreAchievements || {};
}

// ============================================
// Settings 변환 함수
// ============================================

/**
 * localStorage의 settings를 Firestore 형식으로 변환
 * @returns {Object} Firestore 형식의 settings
 */
export function settingsToFirestoreFormat() {
  const settings = {};

  console.log('📦 [SyncCore] settingsToFirestoreFormat 시작...');
  Object.entries(SETTINGS_KEYS).forEach(([key, lsKey]) => {
    const value = localStorage.getItem(lsKey);
    console.log(`   - ${key} (${lsKey}): ${value === null ? 'null' : `"${value}"`}`);
    if (value !== null) {
      settings[key] = value;
    }
  });

  console.log(`✅ [SyncCore] 변환 완료: ${Object.keys(settings).length}개 설정`);
  return settings;
}

/**
 * Firestore의 settings를 localStorage로 복원
 * @param {Object} firestoreSettings - Firestore의 settings
 */
export function settingsToLocalStorageFormat(firestoreSettings) {
  if (!firestoreSettings) return;

  Object.entries(SETTINGS_KEYS).forEach(([key, lsKey]) => {
    if (firestoreSettings[key] !== undefined) {
      localStorage.setItem(lsKey, firestoreSettings[key]);
    }
  });
}

/**
 * Settings를 StateManager와 UI에 적용
 * @param {Object} settings - Firestore settings 객체
 */
function applySettingsToUI(settings) {
  if (!settings) return;

  console.log('   - 적용할 설정:', settings);

  // 1. StateManager 업데이트
  if (settings.selectedAiModel) {
    setSelectedAiModel(settings.selectedAiModel);
    console.log(`   - AI 모델: ${settings.selectedAiModel}`);
  }

  if (settings.darkMode) {
    setDarkMode(settings.darkMode);
    applyDarkMode(); // UI 반영
    console.log(`   - 다크모드: ${settings.darkMode}`);
  }

  if (settings.memoryTipMode) {
    setMemoryTipMode(settings.memoryTipMode);
    console.log(`   - 암기팁 모드: ${settings.memoryTipMode}`);
  }

  if (settings.sttProvider) {
    setSttProvider(settings.sttProvider);
    console.log(`   - STT 공급자: ${settings.sttProvider}`);
  }

  // 2. D-Day 업데이트 (examDate가 변경되었을 수 있음)
  if (settings.examDate) {
    updateDDayDisplay();
    console.log(`   - 시험 날짜: ${settings.examDate}`);
  }

  console.log('✅ Settings UI 반영 완료');
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

    console.log(`   - Cloud questionScores: ${cloudCount}개 문제`);
    console.log(`   - Local questionScores: ${localCount}개 문제`);

    // Phase 2.5: Achievements and settings sync
    console.log('🔄 Achievements & Settings 동기화 시작...');

    // Load local achievements
    const localAchievementsStr = localStorage.getItem(ACHIEVEMENTS_LS_KEY);
    const localAchievements = localAchievementsStr ? JSON.parse(localAchievementsStr) : {};
    const cloudAchievements = userData.achievements || {};

    console.log(`   - Cloud achievements: ${Object.keys(cloudAchievements).length}개`);
    console.log(`   - Local achievements: ${Object.keys(localAchievements).length}개`);

    // Load local settings
    const localSettings = settingsToFirestoreFormat();
    const cloudSettings = userData.settings || {};

    console.log(`   - Cloud settings: ${Object.keys(cloudSettings).length}개 항목`);
    if (Object.keys(cloudSettings).length > 0) {
      console.log(`   - Cloud settings 내용:`, cloudSettings);
    }
    console.log(`   - Local settings: ${Object.keys(localSettings).length}개 항목`);
    if (Object.keys(localSettings).length > 0) {
      console.log(`   - Local settings 내용:`, localSettings);
    }

    // 2. 동기화 전략 결정
    let syncMessage = '';

    // 2-1. QuestionScores 동기화
    if (cloudCount === 0 && localCount === 0) {
      // 양쪽 모두 비어있음 - 아무것도 안 함
      console.log('✅ questionScores 동기화 불필요 (양쪽 모두 비어있음)');
      syncMessage += 'questionScores: 없음';
    } else if (cloudCount > 0 && localCount === 0) {
      // Cloud만 있음 → Local로 다운로드
      console.log('📥 questionScores: Cloud → Local 동기화 중...');
      const convertedScores = toLocalStorageFormat(cloudScores);
      setQuestionScores(convertedScores);
      saveQuestionScores();
      console.log(`✅ ${cloudCount}개 문제 다운로드 완료`);
      syncMessage += `questionScores: ${cloudCount}개 다운로드`;
    } else if (cloudCount === 0 && localCount > 0) {
      // Local만 있음 → Cloud로 업로드
      console.log('📤 questionScores: Local → Cloud 동기화 중...');
      const convertedScores = toFirestoreFormat(localScores);
      await updateDoc(userDocRef, {
        userScores: convertedScores,
        'profile.lastSyncAt': serverTimestamp()
      });
      console.log(`✅ ${localCount}개 문제 업로드 완료`);
      syncMessage += `questionScores: ${localCount}개 업로드`;
    } else {
      // 양쪽 모두 있음 → 병합
      console.log('🔀 questionScores: Cloud ↔ Local 병합 중...');
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
      syncMessage += `questionScores: ${mergedCount}개 병합`;
    }

    // 2-2. Achievements 동기화 (병합: union of unlocked achievements)
    console.log('🏆 Achievements 병합 중...');
    const mergedAchievements = { ...cloudAchievements };
    Object.entries(localAchievements).forEach(([achievementId, data]) => {
      if (!mergedAchievements[achievementId]) {
        // Local에만 있는 업적 추가
        mergedAchievements[achievementId] = data;
      } else {
        // 양쪽에 있으면 더 빠른 시간 우선 (더 먼저 달성한 것)
        if (data.unlockedAt < mergedAchievements[achievementId].unlockedAt) {
          mergedAchievements[achievementId] = data;
        }
      }
    });

    // Local에 병합 결과 저장
    localStorage.setItem(ACHIEVEMENTS_LS_KEY, JSON.stringify(mergedAchievements));

    // Cloud에 병합 결과 업로드
    await updateDoc(userDocRef, {
      achievements: mergedAchievements,
      'profile.lastSyncAt': serverTimestamp()
    });

    const achievementCount = Object.keys(mergedAchievements).length;
    console.log(`✅ ${achievementCount}개 업적 병합 완료`);
    syncMessage += `, achievements: ${achievementCount}개`;

    // 2-3. Settings 동기화 (Cloud 우선)
    console.log('⚙️ Settings 동기화 중...');
    const cloudSettingsCount = Object.keys(cloudSettings).length;
    const localSettingsCount = Object.keys(localSettings).length;

    if (cloudSettingsCount > 0) {
      // Cloud에 설정이 있으면 → Local로 다운로드 (Cloud 우선)
      console.log('📥 Settings: Cloud → Local 동기화 중...');
      settingsToLocalStorageFormat(cloudSettings);

      // UI 및 StateManager 반영
      console.log('🔄 Settings UI 반영 중...');
      applySettingsToUI(cloudSettings);

      console.log(`✅ ${cloudSettingsCount}개 설정 다운로드 완료`);
      syncMessage += `, settings: ${cloudSettingsCount}개 다운로드`;
    } else if (localSettingsCount > 0) {
      // Cloud에 설정이 없으면 → Local을 Cloud로 업로드
      console.log('📤 Settings: Local → Cloud 동기화 중...');
      await updateDoc(userDocRef, {
        settings: localSettings,
        'profile.lastSyncAt': serverTimestamp()
      });
      console.log(`✅ ${localSettingsCount}개 설정 업로드 완료`);
      syncMessage += `, settings: ${localSettingsCount}개 업로드`;
    } else {
      console.log('✅ Settings 동기화 불필요 (양쪽 모두 비어있음)');
      syncMessage += `, settings: 없음`;
    }

    console.log('✅ 전체 동기화 완료');
    return { success: true, message: syncMessage };
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
 * 개선: 1MB 제한 회피를 위해 상세 데이터는 서브컬렉션에 분리 저장
 * - 메인 문서: 점수, 날짜, 플래그 등 경량 데이터 (리스트 렌더링용)
 * - 서브컬렉션: user_answer, feedback 등 상세 데이터 (개별 조회용)
 *
 * @param {string} userId - 사용자 UID
 * @param {string} specificQid - (선택) 특정 문제 ID. 제공 시 해당 문제의 상세 데이터를 서브컬렉션에 저장
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function syncToFirestore(userId, specificQid = null) {
  if (!userId) {
    console.warn('⚠️ [SyncCore] 로그인되지 않음 - Firestore 동기화 스킵');
    return { success: false, message: '로그인되지 않음' };
  }

  try {
    console.log(`📤 [SyncCore] Firestore 업로드 시작... (userId: ${userId})`);

    const localScores = getQuestionScores();
    const localCount = Object.keys(localScores).length;
    console.log(`   - Local 문제 수: ${localCount}개`);

    // 1️⃣ 메인 문서 업데이트: 경량 데이터만 (user_answer, feedback 제외)
    const convertedScores = toFirestoreFormat(localScores);
    const convertedCount = Object.keys(convertedScores).length;
    console.log(`   - 변환 후 문제 수: ${convertedCount}개`);

    const userDocRef = doc(db, 'users', userId);
    console.log(`   - Firestore 경로: users/${userId}`);

    await updateDoc(userDocRef, {
      userScores: convertedScores,
      'profile.lastSyncAt': serverTimestamp()
    });

    console.log(`✅ [SyncCore] 메인 문서 동기화 완료: ${convertedCount}개 문제`);

    // 2️⃣ 서브컬렉션 업데이트: specificQid가 있으면 상세 데이터 저장
    if (specificQid && localScores[specificQid]) {
      const detailedData = localScores[specificQid];
      const recordRef = doc(db, 'users', userId, 'records', specificQid);

      console.log(`📝 [SyncCore] 서브컬렉션 저장: records/${specificQid}`);

      await setDoc(recordRef, {
        user_answer: detailedData.user_answer || '',
        feedback: detailedData.feedback || '',
        score: detailedData.score || 0,
        lastSolvedDate: detailedData.lastSolvedDate || Date.now(),
        hintUsed: !!detailedData.hintUsed,
        memoryTipUsed: !!detailedData.memoryTipUsed,
        updatedAt: serverTimestamp()
      }, { merge: true });

      console.log(`✅ [SyncCore] 서브컬렉션 저장 완료: ${specificQid}`);
    }

    return { success: true, message: `${convertedCount}개 문제 동기화${specificQid ? ' + 상세 데이터 저장' : ''}` };
  } catch (error) {
    console.error('❌ [SyncCore] Firestore 동기화 실패:', error);
    console.error('   - 에러 코드:', error.code);
    console.error('   - 에러 메시지:', error.message);

    let message = `동기화 실패: ${error.message}`;
    if (error.code === 'permission-denied') {
      message = '⚠️ Firestore 쓰기 권한 없음. 보안 규칙을 확인하세요.';
    } else if (error.code === 'not-found') {
      message = '⚠️ 사용자 문서를 찾을 수 없습니다.';
    }

    return { success: false, message };
  }
}

/**
 * Achievements 실시간 동기화 (업적 달성 시 호출)
 * @param {string} userId - 사용자 UID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function syncAchievementsToFirestore(userId) {
  if (!userId) {
    console.warn('⚠️ [SyncCore] 로그인되지 않음 - Achievements 동기화 스킵');
    return { success: false, message: '로그인되지 않음' };
  }

  try {
    console.log(`🏆 [SyncCore] Achievements 업로드 시작... (userId: ${userId})`);

    const localAchievementsStr = localStorage.getItem(ACHIEVEMENTS_LS_KEY);
    const localAchievements = localAchievementsStr ? JSON.parse(localAchievementsStr) : {};
    const achievementCount = Object.keys(localAchievements).length;

    console.log(`   - Local 업적 수: ${achievementCount}개`);

    const convertedAchievements = achievementsToFirestoreFormat(localAchievements);
    const userDocRef = doc(db, 'users', userId);

    await updateDoc(userDocRef, {
      achievements: convertedAchievements,
      'profile.lastSyncAt': serverTimestamp()
    });

    console.log(`✅ [SyncCore] Achievements 동기화 완료: ${achievementCount}개 업적`);
    return { success: true, message: `${achievementCount}개 업적 동기화` };
  } catch (error) {
    console.error('❌ [SyncCore] Achievements 동기화 실패:', error);
    return { success: false, message: `동기화 실패: ${error.message}` };
  }
}

/**
 * Settings 실시간 동기화 (설정 변경 시 호출)
 * @param {string} userId - 사용자 UID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function syncSettingsToFirestore(userId) {
  if (!userId) {
    console.warn('⚠️ [SyncCore] 로그인되지 않음 - Settings 동기화 스킵');
    return { success: false, message: '로그인되지 않음' };
  }

  try {
    console.log(`⚙️ [SyncCore] Settings 업로드 시작... (userId: ${userId})`);

    const localSettings = settingsToFirestoreFormat();
    const settingsCount = Object.keys(localSettings).length;

    console.log(`   - Local 설정 수: ${settingsCount}개`);
    console.log(`   - 업로드할 데이터:`, localSettings);

    const userDocRef = doc(db, 'users', userId);

    await updateDoc(userDocRef, {
      settings: localSettings,
      'profile.lastSyncAt': serverTimestamp()
    });

    console.log(`✅ [SyncCore] Settings 동기화 완료: ${settingsCount}개 설정`);
    return { success: true, message: `${settingsCount}개 설정 동기화` };
  } catch (error) {
    console.error('❌ [SyncCore] Settings 동기화 실패:', error);
    console.error('   - Error code:', error.code);
    console.error('   - Error message:', error.message);
    return { success: false, message: `동기화 실패: ${error.message}` };
  }
}

// ============================================
// 상세 기록 조회 (서브컬렉션 records)
// ============================================

/**
 * 여러 문제의 상세 기록(답안/피드백)을 한 번에 조회
 * @param {string} userId - 사용자 UID
 * @param {Array<string>} questionIds - 조회할 문제 ID 배열
 * @returns {Promise<Object>} { qid: { user_answer, feedback, ... } } 형태의 맵
 */
export async function fetchDetailedRecords(userId, questionIds) {
  if (!userId || !questionIds || questionIds.length === 0) {
    console.warn('⚠️ [SyncCore] fetchDetailedRecords: userId 또는 questionIds 없음');
    return {};
  }

  console.log(`📥 [SyncCore] 상세 기록 조회 시작: ${questionIds.length}개 문제`);
  const recordsMap = {};

  const promises = questionIds.map(async (qid) => {
    try {
      const recordRef = doc(db, 'users', userId, 'records', qid);
      const snapshot = await getDoc(recordRef);
      if (snapshot.exists()) {
        recordsMap[qid] = snapshot.data();
        console.log(`   ✅ ${qid}: 데이터 로드 성공`);
      } else {
        console.log(`   ⚠️ ${qid}: 데이터 없음`);
      }
    } catch (e) {
      console.error(`   ❌ ${qid}: 조회 실패:`, e.message);
    }
  });

  await Promise.all(promises);

  console.log(`✅ [SyncCore] 상세 기록 조회 완료: ${Object.keys(recordsMap).length}/${questionIds.length}개 성공`);
  return recordsMap;
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
