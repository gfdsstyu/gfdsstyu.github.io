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
import { getCurrentUser, getNickname, addAuthStateListener } from '../auth/authCore.js';

// ============================================
// Helper Functions
// ============================================

/**
 * 현재 날짜를 기간별 키로 변환
 * @param {string} period - 'daily', 'weekly', 'monthly'
 * @returns {string} 기간 키 (예: '2025-01-17', '2025-W03', '2025-01')
 */
export function getPeriodKey(period = 'daily') {
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
    // [Safety Check] 점수 업데이트 전 마이그레이션 확인
    // 기존 사용자가 로그인 없이 바로 문제를 풀 경우를 대비해 여기서도 체크합니다.
    await checkAndMigrateAP(userId);

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

    // ============================================================
    // [Achievement System 2.0] 활동 점수(AP) 계산
    // ============================================================

    // 1. 기본 풀이 점수 (채굴형 점수 Grinding)
    const earnedAP = score >= 80 ? 3 : 1; // 80점 이상: 3 AP, 미만: 1 AP

    // 2. 데일리 미션 보너스
    let bonusAP = 0;
    const todayProblems = dailyStats.problems;

    // 10문제 첫 달성 시 +30 AP 보너스
    if (todayProblems === 10) {
      bonusAP += 30;
      console.log(`🎉 [Ranking AP] 데일리 미션 달성: 10문제 (+30 AP)`);
    }

    // 50문제 첫 달성 시 +100 AP 보너스
    if (todayProblems === 50) {
      bonusAP += 100;
      console.log(`🎉 [Ranking AP] 데일리 미션 달성: 50문제 (+100 AP)`);
    }

    const totalGainedAP = earnedAP + bonusAP;

    // 현재 랭크 포인트 (currentRP) 증가
    const currentRP = (userData.ranking?.currentRP || 0) + totalGainedAP;

    console.log(`📊 [Ranking AP] 획득: 기본 ${earnedAP} + 보너스 ${bonusAP} = ${totalGainedAP} AP (누적: ${currentRP} AP)`);

    // 1. users 컬렉션 업데이트
    await updateDoc(userDocRef, {
      'stats.totalProblems': newTotalProblems,
      'stats.totalScore': newTotalScore,
      'stats.averageScore': Math.round(newAverageScore * 100) / 100, // 소수점 2자리
      'stats.lastProblemSolvedAt': serverTimestamp(),
      [`stats.daily.${dailyKey}`]: dailyStats,
      [`stats.weekly.${weeklyKey}`]: weeklyStats,
      [`stats.monthly.${monthlyKey}`]: monthlyStats,
      // [Achievement System 2.0] 랭크 포인트 업데이트
      'ranking.currentRP': currentRP,
      'ranking.totalAccumulatedRP': (userData.ranking?.totalAccumulatedRP || 0) + totalGainedAP,
      'ranking.lastAPGainedAt': serverTimestamp()
    });

    // 2. Phase 3.4: rankings 컬렉션 업데이트 (성능 최적화용)
    try {
      console.log(`🔍 [Ranking DEBUG] rankings 컬렉션 업데이트 시도 중...`);

      const nickname = await getNickname();
      console.log(`🔍 [Ranking DEBUG] 닉네임: ${nickname || '익명'}`);

      // ✅ [최적화] 대학교 정보 가져오기 (대학교 랭킹 필터링용)
      const university = userData.university || null;
      console.log(`🔍 [Ranking DEBUG] 대학교: ${university || '미인증'}`);

      const rankingDocRef = doc(db, 'rankings', userId);
      console.log(`🔍 [Ranking DEBUG] rankings 문서 경로: rankings/${userId}`);

      const rankingData = {
        userId: userId,
        nickname: nickname || '익명',
        university: university, // ✅ [신규] 대학교 필드 추가
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
// Phase 3.5.3: 그룹 랭킹 (Group Rankings)
// ============================================

/**
 * 그룹 통계 업데이트 (문제 풀이 후 호출)
 * @param {string} groupId - 그룹 ID
 * @param {string} userId - 사용자 UID
 * @param {number} score - 문제 점수 (0-100)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function updateGroupStats(groupId, userId, score) {
  if (!groupId || !userId) {
    return { success: false, message: 'groupId 또는 userId 누락' };
  }

  try {
    console.log(`📊 [GroupRanking] 그룹 통계 업데이트 시작... (groupId: ${groupId}, userId: ${userId}, score: ${score})`);

    // 그룹 정보 가져오기 (그룹명 등)
    const groupDocRef = doc(db, 'groups', groupId);
    const groupDocSnap = await getDoc(groupDocRef);

    if (!groupDocSnap.exists()) {
      console.error('❌ [GroupRanking] 그룹이 존재하지 않습니다:', groupId);
      return { success: false, message: '그룹이 존재하지 않음' };
    }

    const groupData = groupDocSnap.data();
    const groupName = groupData.name;

    // 기간별 키 생성
    const dailyKey = getPeriodKey('daily');
    const weeklyKey = getPeriodKey('weekly');
    const monthlyKey = getPeriodKey('monthly');

    // groupRankings 컬렉션에서 해당 그룹 문서 가져오기
    const groupRankingDocRef = doc(db, 'groupRankings', groupId);
    const groupRankingDocSnap = await getDoc(groupRankingDocRef);

    let currentGroupStats = {};
    if (groupRankingDocSnap.exists()) {
      currentGroupStats = groupRankingDocSnap.data();
    }

    // 기간별 통계 업데이트
    const updatePeriodStats = (periodKey, periodName) => {
      const fieldName = `${periodName}.${periodKey}`;
      const currentPeriodStats = currentGroupStats[fieldName] || { problems: 0, totalScore: 0, avgScore: 0 };

      currentPeriodStats.problems += 1;
      currentPeriodStats.totalScore += score;
      currentPeriodStats.avgScore = currentPeriodStats.totalScore / currentPeriodStats.problems;

      return { [fieldName]: currentPeriodStats };
    };

    // 일일, 주간, 월간 통계 업데이트
    const dailyUpdate = updatePeriodStats(dailyKey, 'daily');
    const weeklyUpdate = updatePeriodStats(weeklyKey, 'weekly');
    const monthlyUpdate = updatePeriodStats(monthlyKey, 'monthly');

    // Firestore에 저장
    await setDoc(groupRankingDocRef, {
      groupId: groupId,
      groupName: groupName,
      memberCount: groupData.memberCount || 0,
      ...dailyUpdate,
      ...weeklyUpdate,
      ...monthlyUpdate,
      lastUpdatedAt: serverTimestamp()
    }, { merge: true });

    console.log(`✅ [GroupRanking] 그룹 통계 업데이트 완료 (${groupName})`);
    return { success: true, message: '그룹 통계 업데이트 완료' };

  } catch (error) {
    console.error('❌ [GroupRanking] 그룹 통계 업데이트 실패:', error);
    return { success: false, message: `그룹 통계 업데이트 실패: ${error.message}` };
  }
}

/**
 * 그룹별 랭킹 조회
 * @param {string} period - 'daily', 'weekly', 'monthly'
 * @param {string} criteria - 'totalScore', 'problems', 'avgScore'
 * @returns {Promise<Array>} 그룹 랭킹 배열
 */
export async function getGroupRankings(period, criteria) {
  try {
    const groupRankingsRef = collection(db, 'groupRankings');
    const snapshot = await getDocs(groupRankingsRef);

    // 현재 기간 키 생성
    const periodKey = getPeriodKey(period);
    const fieldName = `${period}.${periodKey}`;

    console.log(`📊 [GroupRanking] 그룹 랭킹 조회 - period: ${period}, criteria: ${criteria}, periodKey: ${periodKey}`);

    let rankings = [];

    // 삭제된 그룹 필터링을 위해 존재 여부 확인
    for (const docSnapshot of snapshot.docs) {
      const groupRankingData = docSnapshot.data();
      const periodData = groupRankingData[fieldName];

      if (!periodData) {
        continue; // 해당 기간 데이터 없으면 제외
      }

      // 그룹이 실제로 존재하는지 확인 (삭제된 그룹 제외)
      const groupId = groupRankingData.groupId || docSnapshot.id;
      const groupDocRef = doc(db, 'groups', groupId);
      const groupDocSnap = await getDoc(groupDocRef);

      if (!groupDocSnap.exists()) {
        console.log(`⚠️ [GroupRanking] 삭제된 그룹 제외: ${groupRankingData.groupName} (${groupId})`);
        continue; // 삭제된 그룹은 랭킹에서 제외
      }

      rankings.push({
        groupId: groupId,
        groupName: groupRankingData.groupName || '이름 없음',
        memberCount: groupRankingData.memberCount || 0,
        totalScore: periodData.totalScore || 0,
        problems: periodData.problems || 0,
        avgScore: periodData.avgScore || 0
      });
    }

    // 기준에 따라 정렬
    rankings.sort((a, b) => {
      const aValue = a[criteria];
      const bValue = b[criteria];
      return bValue - aValue;
    });

    console.log(`✅ [GroupRanking] ${rankings.length}개 그룹 랭킹 데이터 로드 완료`);
    return rankings;

  } catch (error) {
    console.error('❌ [GroupRanking] 그룹 랭킹 조회 실패:', error);
    return [];
  }
}

// ============================================
// Phase 3.5.4: 그룹 내 랭킹 (Intra-Group Rankings)
// ============================================

/**
 * 그룹 내 개인 랭킹 조회
 * @param {string} groupId - 그룹 ID
 * @param {string} period - 'daily', 'weekly', 'monthly'
 * @param {string} criteria - 'totalScore', 'problems', 'avgScore'
 * @returns {Promise<Array>} 그룹 멤버 랭킹 배열
 */
export async function getIntraGroupRankings(groupId, period, criteria) {
  try {
    console.log(`📊 [IntraGroupRanking] 그룹 내 랭킹 조회 - groupId: ${groupId}, period: ${period}, criteria: ${criteria}`);

    // 1. 그룹 멤버 목록 조회
    const membersRef = collection(db, 'groups', groupId, 'members');
    const membersSnapshot = await getDocs(membersRef);

    if (membersSnapshot.empty) {
      console.log('❌ [IntraGroupRanking] 그룹 멤버가 없습니다.');
      return [];
    }

    const memberUserIds = [];
    membersSnapshot.forEach(doc => {
      memberUserIds.push(doc.id); // userId
    });

    console.log(`📋 [IntraGroupRanking] ${memberUserIds.length}명의 멤버 발견`);

    // 2. rankings 컬렉션에서 각 멤버의 개인 랭킹 데이터 조회
    const periodKey = getPeriodKey(period);
    const fieldName = `${period}.${periodKey}`;

    const rankings = [];

    for (const userId of memberUserIds) {
      const rankingDocRef = doc(db, 'rankings', userId);
      const rankingDocSnap = await getDoc(rankingDocRef);

      if (!rankingDocSnap.exists()) {
        continue; // 랭킹 데이터 없으면 제외
      }

      const rankingData = rankingDocSnap.data();
      const periodData = rankingData[fieldName];

      if (!periodData) {
        continue; // 해당 기간 데이터 없으면 제외
      }

      rankings.push({
        userId: rankingData.userId || userId,
        nickname: rankingData.nickname || '익명',
        totalScore: periodData.totalScore || 0,
        problems: periodData.problems || 0,
        avgScore: periodData.avgScore || 0
      });
    }

    // 기준에 따라 정렬
    rankings.sort((a, b) => {
      const aValue = a[criteria];
      const bValue = b[criteria];
      return bValue - aValue;
    });

    console.log(`✅ [IntraGroupRanking] ${rankings.length}명의 그룹 내 랭킹 데이터 로드 완료`);
    return rankings;

  } catch (error) {
    console.error('❌ [IntraGroupRanking] 그룹 내 랭킹 조회 실패:', error);
    return [];
  }
}

// ============================================
// [Achievement System 2.0] 티어 시스템 (Tier System)
// ============================================

/**
 * 총 누적 AP 기반 티어 계산
 * @param {number} totalAccumulatedRP - 총 누적 랭크 포인트
 * @returns {Object} { tier: string, name: string, minAP: number, nextTier: string|null, nextMinAP: number|null }
 */
export function calculateTier(totalAccumulatedRP) {
  const tiers = [
    { tier: 'master', name: 'Master', minAP: 30000, color: '#9333ea', decayRate: 300 },
    { tier: 'diamond', name: 'Diamond', minAP: 20000, color: '#3b82f6', decayRate: 150 },
    { tier: 'platinum', name: 'Platinum', minAP: 10000, color: '#06b6d4', decayRate: 50 },
    { tier: 'gold', name: 'Gold', minAP: 5000, color: '#eab308', decayRate: 20 },
    { tier: 'silver', name: 'Silver', minAP: 2000, color: '#71717a', decayRate: 0 },
    { tier: 'bronze', name: 'Bronze', minAP: 500, color: '#a3725f', decayRate: 0 }
  ];

  for (let i = 0; i < tiers.length; i++) {
    if (totalAccumulatedRP >= tiers[i].minAP) {
      return {
        tier: tiers[i].tier,
        name: tiers[i].name,
        minAP: tiers[i].minAP,
        color: tiers[i].color,
        decayRate: tiers[i].decayRate,
        nextTier: i > 0 ? tiers[i - 1].tier : null,
        nextMinAP: i > 0 ? tiers[i - 1].minAP : null
      };
    }
  }

  // 500 AP 미만은 Unranked
  return {
    tier: 'unranked',
    name: 'Unranked',
    minAP: 0,
    color: '#52525b',
    decayRate: 0,
    nextTier: 'bronze',
    nextMinAP: 500
  };
}

// ============================================
// [Achievement System 2.0] 강등(Decay) 시스템 준비
// ============================================

/**
 * ⚠️ [주의] 이 함수는 Cloud Functions에서 일일 스케줄러로 실행되어야 합니다.
 *
 * 티어별 일일 AP 차감 로직:
 * - Bronze/Silver: 차감 없음 (decayRate: 0)
 * - Gold: 일일 -20 AP (decayRate: 20)
 * - Platinum: 일일 -50 AP (decayRate: 50)
 * - Diamond: 일일 -150 AP (decayRate: 150)
 * - Master: 일일 -300 AP (decayRate: 300)
 *
 * 작동 원리:
 * 1. 매일 오전 5시(KST)에 Cloud Function 실행
 * 2. 모든 사용자의 lastAPGainedAt 확인
 * 3. 24시간 이상 비활동 시 티어별 차감 실행
 * 4. currentRP가 해당 티어 최소값 미만으로 떨어지면 티어 강등
 *
 * 구현 예시 (Cloud Functions):
 *
 * ```javascript
 * exports.applyDailyDecay = functions.pubsub
 *   .schedule('0 5 * * *') // 매일 오전 5시 (KST: +9시간)
 *   .timeZone('Asia/Seoul')
 *   .onRun(async (context) => {
 *     const usersRef = admin.firestore().collection('users');
 *     const snapshot = await usersRef.get();
 *
 *     const now = admin.firestore.Timestamp.now();
 *     const oneDayAgo = new Date(now.toMillis() - 24 * 60 * 60 * 1000);
 *
 *     const batch = admin.firestore().batch();
 *     let decayCount = 0;
 *
 *     snapshot.forEach(doc => {
 *       const userData = doc.data();
 *       const lastAPGainedAt = userData.ranking?.lastAPGainedAt;
 *
 *       // 24시간 이상 비활동 체크
 *       if (!lastAPGainedAt || lastAPGainedAt.toMillis() < oneDayAgo.getTime()) {
 *         const totalAccumulatedRP = userData.ranking?.totalAccumulatedRP || 0;
 *         const tierInfo = calculateTier(totalAccumulatedRP);
 *
 *         // Bronze/Silver는 차감 없음
 *         if (tierInfo.decayRate === 0) return;
 *
 *         const currentRP = userData.ranking?.currentRP || 0;
 *         const newRP = Math.max(tierInfo.minAP, currentRP - tierInfo.decayRate);
 *
 *         if (newRP < currentRP) {
 *           batch.update(doc.ref, {
 *             'ranking.currentRP': newRP,
 *             'ranking.lastDecayAt': now
 *           });
 *           decayCount++;
 *           console.log(`🔻 Decay applied: ${userData.nickname} (${tierInfo.name}) -${tierInfo.decayRate} AP`);
 *         }
 *       }
 *     });
 *
 *     await batch.commit();
 *     console.log(`✅ Daily decay completed: ${decayCount} users affected`);
 *   });
 * ```
 *
 * 배포 방법:
 * 1. functions/index.js에 위 코드 추가
 * 2. firebase deploy --only functions:applyDailyDecay
 * 3. Cloud Scheduler 콘솔에서 작동 확인
 *
 * @param {string} userId - 사용자 UID (테스트용 단일 사용자 차감)
 * @returns {Promise<{success: boolean, message: string, decayed: number}>}
 */
export async function applyDecayForUser(userId) {
  // ⚠️ 이 함수는 테스트/디버깅 전용입니다. 실제 운영에서는 Cloud Functions를 사용하세요.

  if (!userId) {
    return { success: false, message: 'userId 누락', decayed: 0 };
  }

  try {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return { success: false, message: '사용자 문서 없음', decayed: 0 };
    }

    const userData = userDocSnap.data();
    const lastAPGainedAt = userData.ranking?.lastAPGainedAt;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 24시간 이내 활동이 있으면 차감 안 함
    if (lastAPGainedAt && lastAPGainedAt.toMillis() > oneDayAgo.getTime()) {
      return { success: true, message: '최근 활동 있음 - 차감 없음', decayed: 0 };
    }

    const totalAccumulatedRP = userData.ranking?.totalAccumulatedRP || 0;
    const tierInfo = calculateTier(totalAccumulatedRP);

    // Bronze/Silver는 차감 없음
    if (tierInfo.decayRate === 0) {
      return { success: true, message: `${tierInfo.name} 티어 - 차감 없음`, decayed: 0 };
    }

    const currentRP = userData.ranking?.currentRP || 0;
    const newRP = Math.max(tierInfo.minAP, currentRP - tierInfo.decayRate);

    if (newRP >= currentRP) {
      return { success: true, message: '이미 최소값 도달 - 차감 없음', decayed: 0 };
    }

    const decayedAmount = currentRP - newRP;

    await updateDoc(userDocRef, {
      'ranking.currentRP': newRP,
      'ranking.lastDecayAt': serverTimestamp()
    });

    console.log(`🔻 [Decay] ${tierInfo.name} 티어 사용자 차감: -${decayedAmount} AP (${currentRP} → ${newRP})`);

    return {
      success: true,
      message: `${tierInfo.name} 티어 차감 완료`,
      decayed: decayedAmount
    };

  } catch (error) {
    console.error('❌ [Decay] 차감 실패:', error);
    return { success: false, message: `차감 실패: ${error.message}`, decayed: 0 };
  }
}

// ============================================
// [Achievement System 2.0] 기존 업적 포인트 마이그레이션
// ============================================

/**
 * 마이그레이션 여부 체크 및 실행 (내부 호출용)
 */
async function checkAndMigrateAP(userId) {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      // 아직 마이그레이션 안 된 경우 실행
      if (!data.ranking?.apMigrated) {
        console.log('🔄 [Auto Migration] 미마이그레이션 유저 감지, 마이그레이션 시작...');
        await migrateAchievementPointsToAP();
      }
    }
  } catch (e) {
    console.warn('⚠️ 마이그레이션 체크 중 오류 (무시됨):', e);
  }
}

/**
 * 기존 업적 포인트를 AP로 소급 적용
 * @returns {Promise<{success: boolean, message: string, migratedAP: number}>}
 */
export async function migrateAchievementPointsToAP() {
  const user = getCurrentUser();
  if (!user) {
    return { success: false, message: '로그인이 필요합니다.', migratedAP: 0 };
  }

  try {
    console.log('🔄 [Migration] 기존 업적 포인트 마이그레이션 시작...');

    // 1. 사용자 문서 가져오기
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return { success: false, message: '사용자 문서 없음', migratedAP: 0 };
    }

    const userData = userDocSnap.data();

    // 이미 마이그레이션했는지 체크
    if (userData.ranking?.apMigrated) {
      console.log('✅ [Migration] 이미 마이그레이션 완료됨');
      return { success: true, message: '이미 마이그레이션 완료', migratedAP: 0 };
    }

    // 2. localStorage에서 업적 데이터 가져오기 (오류 방지 처리)
    let achievements = {};
    try {
      const stored = localStorage.getItem('achievements');
      if (stored) {
        achievements = JSON.parse(stored);
      }
    } catch (storageError) {
      console.warn('⚠️ [Migration] localStorage 접근 차단됨 (Tracking Prevention):', storageError);
      // 스토리지를 읽을 수 없으면 업적 마이그레이션을 건너뛰거나 기본값 처리
      return { success: false, message: '브라우저 보안 설정으로 로컬 데이터에 접근할 수 없습니다.', migratedAP: 0 };
    }

    // 3. ACHIEVEMENTS config 가져오기 (동적 import)
    let ACHIEVEMENTS;
    try {
      const configModule = await import('../../config/config.js');
      ACHIEVEMENTS = configModule.ACHIEVEMENTS;
    } catch (err) {
      console.error('❌ [Migration] config 로드 실패:', err);
      return { success: false, message: '설정 파일 로드 실패', migratedAP: 0 };
    }

    // 4. 포인트 계산
    let totalAchievementPoints = 0;
    const unlockedAchievements = [];

    Object.keys(achievements).forEach(achievementId => {
      if (achievements[achievementId] && ACHIEVEMENTS && ACHIEVEMENTS[achievementId]) {
        const points = ACHIEVEMENTS[achievementId].points || 0;
        totalAchievementPoints += points;
        unlockedAchievements.push({
          id: achievementId,
          name: ACHIEVEMENTS[achievementId].name,
          points: points,
          unlockedAt: new Date().toISOString() // 기록용
        });
      }
    });

    console.log(`📊 [Migration] 발견된 업적: ${unlockedAchievements.length}개, 총 ${totalAchievementPoints} AP`);

    // 5. Firestore 업데이트
    const currentRP = userData.ranking?.currentRP || 0;
    const currentTotal = userData.ranking?.totalAccumulatedRP || 0;

    await updateDoc(userDocRef, {
      'ranking.currentRP': currentRP + totalAchievementPoints,
      'ranking.totalAccumulatedRP': currentTotal + totalAchievementPoints,
      'ranking.apMigrated': true,
      'ranking.apMigratedAt': serverTimestamp(),
      'ranking.migratedAchievements': unlockedAchievements
    });

    console.log(`✅ [Migration] 마이그레이션 성공! (+${totalAchievementPoints} AP)`);

    return {
      success: true,
      message: `${totalAchievementPoints} AP 마이그레이션 완료`,
      migratedAP: totalAchievementPoints
    };

  } catch (error) {
    console.error('❌ [Migration] 마이그레이션 실패:', error);
    return { success: false, message: `마이그레이션 실패: ${error.message}`, migratedAP: 0 };
  }
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
  window.RankingCore = {
    updateUserStats,
    getUserStats,
    getMyRanking,
    getPeriodKey,
    updateGroupStats,
    getGroupRankings,
    getIntraGroupRankings,
    calculateTier,
    applyDecayForUser,
    migrateAchievementPointsToAP
  };
}

// ============================================
// ✨ [Fix] 순환 참조 방지 및 자동 실행 로직
// ============================================

// authCore.js의 변수 초기화가 완료된 후 실행되도록 setTimeout으로 지연시킵니다.
// 이것이 "Uncaught ReferenceError: Cannot access 'authStateListeners' before initialization" 에러를 방지합니다.
setTimeout(() => {
  console.log('🔌 [Ranking] Auth Listener 연결 시도...');
  try {
    addAuthStateListener(async (user) => {
      if (user) {
        // 로그인 시 마이그레이션 자동 실행
        await checkAndMigrateAP(user.uid);
      }
    });
    console.log('✅ [Ranking] 자동 마이그레이션 리스너 등록 완료');
  } catch (err) {
    console.error('❌ [Ranking] 리스너 등록 실패:', err);
  }
}, 0);
