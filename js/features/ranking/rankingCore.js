// ============================================
// Phase 3.2: 랭킹 시스템 (Ranking System)
// ============================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import { db } from '../../app.js';
import { getCurrentUser, getNickname } from '../auth/authCore.js';

// ============================================
// Helper Functions
// ============================================

/**
 * 현재 날짜를 기간별 키로 변환
 * @param {string} period - 'daily', 'weekly', 'monthly'
 * @returns {string} 기간 키 (예: '2025-01-17', '2025-W03', '2025-01')
 */
function getPeriodKey(period = 'daily') {
  const now = new Date();

  if (period === 'daily') {
    return now.toISOString().split('T')[0]; // '2025-01-17'
  }

  if (period === 'weekly') {
    // ISO 8601 week number
    const year = now.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (now - firstDayOfYear) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`; // '2025-W03'
  }

  if (period === 'monthly') {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`; // '2025-01'
  }

  return null;
}

/**
 * 사용자 통계 업데이트 (문제 풀이 후 호출)
 * @param {string} userId - 사용자 UID
 * @param {number} score - 문제 점수 (0-100)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function updateUserStats(userId, score) {
  console.log(`🔍 [Ranking DEBUG] updateUserStats 호출됨 - userId: ${userId}, score: ${score}`);

  if (!userId) {
    console.error('❌ [Ranking] userId가 없습니다!');
    return { success: false, message: 'userId 누락' };
  }

  try {
    console.log(`📊 [Ranking] 사용자 통계 업데이트 시작... (userId: ${userId}, score: ${score})`);

    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      console.error('❌ [Ranking] 사용자 문서가 없습니다:', userId);
      return { success: false, message: '사용자 문서 없음' };
    }

    const userData = userDocSnap.data();
    const currentStats = userData.stats || {
      totalProblems: 0,
      totalScore: 0,
      averageScore: 0,
      daily: {},
      weekly: {},
      monthly: {}
    };

    // 전체 통계 업데이트
    const newTotalProblems = currentStats.totalProblems + 1;
    const newTotalScore = currentStats.totalScore + score;
    const newAverageScore = newTotalScore / newTotalProblems;

    // 기간별 키 생성
    const dailyKey = getPeriodKey('daily');
    const weeklyKey = getPeriodKey('weekly');
    const monthlyKey = getPeriodKey('monthly');

    // 일일 통계
    const dailyStats = currentStats.daily[dailyKey] || { problems: 0, totalScore: 0, avgScore: 0 };
    dailyStats.problems += 1;
    dailyStats.totalScore += score;
    dailyStats.avgScore = dailyStats.totalScore / dailyStats.problems;

    // 주간 통계
    const weeklyStats = currentStats.weekly[weeklyKey] || { problems: 0, totalScore: 0, avgScore: 0 };
    weeklyStats.problems += 1;
    weeklyStats.totalScore += score;
    weeklyStats.avgScore = weeklyStats.totalScore / weeklyStats.problems;

    // 월간 통계
    const monthlyStats = currentStats.monthly[monthlyKey] || { problems: 0, totalScore: 0, avgScore: 0 };
    monthlyStats.problems += 1;
    monthlyStats.totalScore += score;
    monthlyStats.avgScore = monthlyStats.totalScore / monthlyStats.problems;

    // 1. users 컬렉션 업데이트
    await updateDoc(userDocRef, {
      'stats.totalProblems': newTotalProblems,
      'stats.totalScore': newTotalScore,
      'stats.averageScore': Math.round(newAverageScore * 100) / 100, // 소수점 2자리
      'stats.lastProblemSolvedAt': serverTimestamp(),
      [`stats.daily.${dailyKey}`]: dailyStats,
      [`stats.weekly.${weeklyKey}`]: weeklyStats,
      [`stats.monthly.${monthlyKey}`]: monthlyStats
    });

    // 2. Phase 3.4: rankings 컬렉션 업데이트 (성능 최적화용)
    try {
      console.log(`🔍 [Ranking DEBUG] rankings 컬렉션 업데이트 시도 중...`);

      const nickname = await getNickname();
      console.log(`🔍 [Ranking DEBUG] 닉네임: ${nickname || '익명'}`);

      const rankingDocRef = doc(db, 'rankings', userId);
      console.log(`🔍 [Ranking DEBUG] rankings 문서 경로: rankings/${userId}`);

      const rankingData = {
        userId: userId,
        nickname: nickname || '익명',
        [`daily.${dailyKey}`]: dailyStats,
        [`weekly.${weeklyKey}`]: weeklyStats,
        [`monthly.${monthlyKey}`]: monthlyStats,
        lastUpdatedAt: serverTimestamp()
      };

      console.log(`🔍 [Ranking DEBUG] 저장할 데이터:`, rankingData);

      await setDoc(rankingDocRef, rankingData, { merge: true });

      console.log(`✅ [Ranking] rankings 컬렉션 업데이트 완료`);
    } catch (rankingError) {
      console.error('❌ [Ranking] rankings 컬렉션 업데이트 실패!');
      console.error('   - 에러 타입:', rankingError.name);
      console.error('   - 에러 메시지:', rankingError.message);
      console.error('   - 에러 코드:', rankingError.code);
      console.error('   - 전체 에러:', rankingError);
      // rankings 실패해도 users는 업데이트되었으므로 계속 진행
    }

    console.log(`✅ [Ranking] 사용자 통계 업데이트 완료`);
    console.log(`   - 총 문제: ${newTotalProblems}개`);
    console.log(`   - 평균 점수: ${newAverageScore.toFixed(2)}점`);

    return { success: true, message: '통계 업데이트 완료' };
  } catch (error) {
    console.error('❌ [Ranking] 통계 업데이트 실패:', error);
    return { success: false, message: `통계 업데이트 실패: ${error.message}` };
  }
}

/**
 * 사용자의 통계 조회
 * @param {string} userId - 사용자 UID
 * @returns {Promise<Object|null>} 통계 객체 또는 null
 */
export async function getUserStats(userId) {
  if (!userId) return null;

  try {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      return userDocSnap.data().stats || null;
    }

    return null;
  } catch (error) {
    console.error('❌ [Ranking] 통계 조회 실패:', error);
    return null;
  }
}

/**
 * 현재 사용자의 랭킹 정보 조회
 * @param {string} period - 'daily', 'weekly', 'monthly', 'all'
 * @returns {Promise<Object|null>}
 */
export async function getMyRanking(period = 'all') {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;

  const stats = await getUserStats(currentUser.uid);
  if (!stats) return null;

  const periodKey = period === 'all' ? null : getPeriodKey(period);

  let problems = 0;
  let avgScore = 0;
  let totalScore = 0;

  if (period === 'all') {
    problems = stats.totalProblems || 0;
    avgScore = stats.averageScore || 0;
    totalScore = stats.totalScore || 0;
  } else {
    const periodStats = period === 'daily' ? stats.daily?.[periodKey] :
                        period === 'weekly' ? stats.weekly?.[periodKey] :
                        stats.monthly?.[periodKey];

    if (periodStats) {
      problems = periodStats.problems || 0;
      avgScore = periodStats.avgScore || 0;
      totalScore = periodStats.totalScore || 0;
    }
  }

  return {
    problems,
    avgScore: Math.round(avgScore * 100) / 100,
    totalScore,
    period,
    periodKey
  };
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
  window.RankingCore = {
    updateUserStats,
    getUserStats,
    getMyRanking,
    getPeriodKey
  };
}
