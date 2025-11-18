// ============================================
// Phase 3.6: 대학교 인증 및 랭킹 (University Verification & Rankings)
// ============================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

import { db } from '../../app.js';
import { getCurrentUser } from '../auth/authCore.js';
import { getPeriodKey } from '../ranking/rankingCore.js';

// ============================================
// 대학교 도메인 목록 (한국 주요 대학)
// ============================================

const UNIVERSITY_DOMAINS = {
  // 서울
  'snu.ac.kr': '서울대학교',
  'yonsei.ac.kr': '연세대학교',
  'korea.ac.kr': '고려대학교',
  'sogang.ac.kr': '서강대학교',
  'skku.edu': '성균관대학교',
  'hanyang.ac.kr': '한양대학교',
  'cau.ac.kr': '중앙대학교',
  'khu.ac.kr': '경희대학교',
  'hufs.ac.kr': '한국외국어대학교',
  'ssu.ac.kr': '숭실대학교',
  'dongguk.edu': '동국대학교',
  'kookmin.ac.kr': '국민대학교',
  'dankook.ac.kr': '단국대학교',
  'sejong.ac.kr': '세종대학교',
  'sungshin.ac.kr': '성신여자대학교',
  'sookmyung.ac.kr': '숙명여자대학교',
  'ewha.ac.kr': '이화여자대학교',

  // 인천/경기
  'inha.ac.kr': '인하대학교',
  'ajou.ac.kr': '아주대학교',
  'kgu.ac.kr': '경기대학교',

  // 대전/충청
  'kaist.ac.kr': 'KAIST',
  'cnu.ac.kr': '충남대학교',
  'cbu.ac.kr': '충북대학교',

  // 광주/전라
  'gist.ac.kr': 'GIST',
  'jnu.ac.kr': '전남대학교',
  'jbnu.ac.kr': '전북대학교',

  // 대구/경북
  'dgist.ac.kr': 'DGIST',
  'knu.ac.kr': '경북대학교',
  'kmu.ac.kr': '계명대학교',
  'yu.ac.kr': '영남대학교',

  // 부산/경남
  'pusan.ac.kr': '부산대학교',
  'unist.ac.kr': 'UNIST',
  'inje.ac.kr': '인제대학교',
  'kyungnam.ac.kr': '경남대학교',

  // 기타
  'postech.ac.kr': 'POSTECH',
  'ulsan.ac.kr': '울산대학교'
};

// ============================================
// 대학교 인증
// ============================================

/**
 * 이메일 도메인에서 대학교 이름 추출
 * @param {string} email - 이메일 주소
 * @returns {string|null} - 대학교 이름 또는 null
 */
function getUniversityFromEmail(email) {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1].toLowerCase();

  // 정확한 도메인 매칭
  if (UNIVERSITY_DOMAINS[domain]) {
    return UNIVERSITY_DOMAINS[domain];
  }

  // 서브도메인 매칭 (예: student.yonsei.ac.kr)
  for (const [key, value] of Object.entries(UNIVERSITY_DOMAINS)) {
    if (domain.endsWith(key)) {
      return value;
    }
  }

  // ac.kr로 끝나는 경우 일반 대학으로 처리
  if (domain.endsWith('.ac.kr')) {
    // 도메인에서 대학 이름 추출 시도
    const parts = domain.split('.');
    if (parts.length >= 2) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '대학교';
    }
  }

  return null;
}

/**
 * 대학교 이메일 인증 (간소화 버전)
 * @param {string} email - 대학교 이메일
 * @returns {Promise<Object>}
 */
export async function verifyUniversityEmail(email) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  try {
    // 1. 이미 인증된 사용자인지 확인
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists() && userDocSnap.data().university) {
      return { success: false, message: '이미 대학교 인증이 완료되었습니다.' };
    }

    // 2. 이메일 도메인 검증
    const university = getUniversityFromEmail(email);
    if (!university) {
      return {
        success: false,
        message: '유효한 대학교 이메일이 아닙니다. (.ac.kr 등 대학 도메인 필요)'
      };
    }

    // 3. 사용자 문서에 대학교 정보 저장
    await setDoc(userDocRef, {
      university: university,
      universityEmail: email,
      universityVerifiedAt: serverTimestamp()
    }, { merge: true });

    console.log(`✅ [University] 대학교 인증 완료: ${university}`);
    return {
      success: true,
      message: `${university} 인증이 완료되었습니다!`,
      university: university
    };

  } catch (error) {
    console.error('❌ [University] 인증 실패:', error);
    return {
      success: false,
      message: `인증 실패: ${error.message}`
    };
  }
}

/**
 * 사용자의 대학교 정보 조회
 * @returns {Promise<Object|null>}
 */
export async function getMyUniversity() {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;

  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists() || !userDocSnap.data().university) {
      return null;
    }

    return {
      university: userDocSnap.data().university,
      universityEmail: userDocSnap.data().universityEmail,
      verifiedAt: userDocSnap.data().universityVerifiedAt
    };

  } catch (error) {
    console.error('❌ [University] 대학교 정보 조회 실패:', error);
    return null;
  }
}

// ============================================
// Phase 3.6: 대학교 랭킹
// ============================================

/**
 * 대학교 통계 업데이트 (문제 풀이 후 호출)
 * @param {string} userId - 사용자 UID
 * @param {number} score - 문제 점수 (0-100)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function updateUniversityStats(userId, score) {
  if (!userId) {
    return { success: false, message: 'userId 누락' };
  }

  try {
    // 사용자의 대학교 정보 가져오기
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists() || !userDocSnap.data().university) {
      // 대학교 미인증 사용자는 통계 업데이트 안 함
      return { success: true, message: '대학교 미인증 사용자' };
    }

    const university = userDocSnap.data().university;

    console.log(`📊 [UniversityRanking] 대학교 통계 업데이트 시작... (university: ${university}, userId: ${userId}, score: ${score})`);

    // 기간별 키 생성
    const dailyKey = getPeriodKey('daily');
    const weeklyKey = getPeriodKey('weekly');
    const monthlyKey = getPeriodKey('monthly');

    // universityRankings 컬렉션에서 해당 대학교 문서 가져오기
    const universityRankingDocRef = doc(db, 'universityRankings', university);
    const universityRankingDocSnap = await getDoc(universityRankingDocRef);

    let currentUniversityStats = {};
    if (universityRankingDocSnap.exists()) {
      currentUniversityStats = universityRankingDocSnap.data();
    }

    // 기간별 통계 업데이트
    const updatePeriodStats = (periodKey, periodName) => {
      const fieldName = `${periodName}.${periodKey}`;
      const currentPeriodStats = currentUniversityStats[fieldName] || { problems: 0, totalScore: 0, avgScore: 0 };

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
    await setDoc(universityRankingDocRef, {
      university: university,
      ...dailyUpdate,
      ...weeklyUpdate,
      ...monthlyUpdate,
      lastUpdatedAt: serverTimestamp()
    }, { merge: true });

    console.log(`✅ [UniversityRanking] 대학교 통계 업데이트 완료 (${university})`);
    return { success: true, message: '대학교 통계 업데이트 완료' };

  } catch (error) {
    console.error('❌ [UniversityRanking] 대학교 통계 업데이트 실패:', error);
    return { success: false, message: `대학교 통계 업데이트 실패: ${error.message}` };
  }
}

/**
 * 대학교별 랭킹 조회
 * @param {string} period - 'daily', 'weekly', 'monthly'
 * @param {string} criteria - 'totalScore', 'problems', 'avgScore'
 * @returns {Promise<Array>} 대학교 랭킹 배열
 */
export async function getUniversityRankings(period, criteria) {
  try {
    const universityRankingsRef = collection(db, 'universityRankings');
    const snapshot = await getDocs(universityRankingsRef);

    // 현재 기간 키 생성
    const periodKey = getPeriodKey(period);
    const fieldName = `${period}.${periodKey}`;

    console.log(`📊 [UniversityRanking] 대학교 랭킹 조회 - period: ${period}, criteria: ${criteria}, periodKey: ${periodKey}`);

    let rankings = [];

    snapshot.forEach(doc => {
      const universityRankingData = doc.data();
      const periodData = universityRankingData[fieldName];

      if (!periodData) {
        return; // 해당 기간 데이터 없으면 제외
      }

      rankings.push({
        university: universityRankingData.university || doc.id,
        totalScore: periodData.totalScore || 0,
        problems: periodData.problems || 0,
        avgScore: periodData.avgScore || 0
      });
    });

    // 기준에 따라 정렬
    rankings.sort((a, b) => {
      const aValue = a[criteria];
      const bValue = b[criteria];
      return bValue - aValue;
    });

    console.log(`✅ [UniversityRanking] ${rankings.length}개 대학교 랭킹 데이터 로드 완료`);
    return rankings;

  } catch (error) {
    console.error('❌ [UniversityRanking] 대학교 랭킹 조회 실패:', error);
    return [];
  }
}

/**
 * 대학 내 개인 랭킹 조회
 * @param {string} university - 대학교 이름
 * @param {string} period - 'daily', 'weekly', 'monthly'
 * @param {string} criteria - 'totalScore', 'problems', 'avgScore'
 * @returns {Promise<Array>} 대학 내 멤버 랭킹 배열
 */
export async function getIntraUniversityRankings(university, period, criteria) {
  try {
    console.log(`📊 [IntraUniversityRanking] 대학 내 랭킹 조회 - university: ${university}, period: ${period}, criteria: ${criteria}`);

    // rankings 컬렉션에서 모든 사용자 조회하고 필터링
    const rankingsRef = collection(db, 'rankings');
    const rankingsSnapshot = await getDocs(rankingsRef);

    const periodKey = getPeriodKey(period);
    const fieldName = `${period}.${periodKey}`;

    const rankings = [];

    for (const rankingDoc of rankingsSnapshot.docs) {
      const rankingData = rankingDoc.data();
      const userId = rankingDoc.id;

      // 사용자의 대학교 확인
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists() || userDocSnap.data().university !== university) {
        continue; // 해당 대학 아니면 제외
      }

      const periodData = rankingData[fieldName];
      if (!periodData) {
        continue; // 해당 기간 데이터 없으면 제외
      }

      rankings.push({
        userId: userId,
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

    console.log(`✅ [IntraUniversityRanking] ${rankings.length}명의 대학 내 랭킹 데이터 로드 완료`);
    return rankings;

  } catch (error) {
    console.error('❌ [IntraUniversityRanking] 대학 내 랭킹 조회 실패:', error);
    return [];
  }
}

// ============================================
// 전역 노출 (디버깅용)
// ============================================

if (typeof window !== 'undefined') {
  window.UniversityCore = {
    verifyUniversityEmail,
    getMyUniversity,
    updateUniversityStats,
    getUniversityRankings,
    getIntraUniversityRankings
  };
}
