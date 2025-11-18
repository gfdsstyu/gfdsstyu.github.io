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
  // 서울 - SKY
  'snu.ac.kr': '서울대학교',
  'yonsei.ac.kr': '연세대학교',
  'korea.ac.kr': '고려대학교',

  // 서울 - 주요 사립
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
  'dku.ac.kr': '단국대학교',
  'sejong.ac.kr': '세종대학교',
  'sju.ac.kr': '세종대학교',
  'hongik.ac.kr': '홍익대학교',
  'kw.ac.kr': '광운대학교',

  // 서울 - 여대
  'sungshin.ac.kr': '성신여자대학교',
  'sookmyung.ac.kr': '숙명여자대학교',
  'ewha.ac.kr': '이화여자대학교',
  'dongduk.ac.kr': '동덕여자대학교',

  // 서울 - 국공립
  'uos.ac.kr': '서울시립대학교',
  'seoultech.ac.kr': '서울과학기술대학교',

  // 인천/경기
  'inha.ac.kr': '인하대학교',
  'inu.ac.kr': '인천대학교',
  'ajou.ac.kr': '아주대학교',
  'kgu.ac.kr': '경기대학교',
  'gachon.ac.kr': '가천대학교',

  // 대전/충청
  'kaist.ac.kr': 'KAIST',
  'cnu.ac.kr': '충남대학교',
  'chungnam.ac.kr': '충남대학교',
  'cbu.ac.kr': '충북대학교',
  'chungbuk.ac.kr': '충북대학교',
  'dju.ac.kr': '대전대학교',
  'konyang.ac.kr': '건양대학교',
  'eulji.ac.kr': '을지대학교',

  // 광주/전라
  'gist.ac.kr': 'GIST',
  'jnu.ac.kr': '전남대학교',
  'jbnu.ac.kr': '전북대학교',
  'mokpo.ac.kr': '목포대학교',

  // 대구/경북
  'dgist.ac.kr': 'DGIST',
  'knu.ac.kr': '경북대학교',
  'kmu.ac.kr': '계명대학교',
  'yu.ac.kr': '영남대학교',
  'cu.ac.kr': '대구가톨릭대학교',
  'kju.ac.kr': '경주대학교',

  // 부산/경남
  'pusan.ac.kr': '부산대학교',
  'unist.ac.kr': 'UNIST',
  'inje.ac.kr': '인제대학교',
  'kyungnam.ac.kr': '경남대학교',
  'donga.ac.kr': '동아대학교',
  'gntech.ac.kr': '경남과학기술대학교',

  // 강원
  'kangwon.ac.kr': '강원대학교',

  // 기타
  'postech.ac.kr': 'POSTECH',
  'ulsan.ac.kr': '울산대학교',
  'uway.kr': '한국방송통신대학교',
  'csj.ac.kr': '가톨릭상지대학교',
  'mjc.ac.kr': '명지전문대학',
  'baewha.ac.kr': '배화여자대학교'
};

const UNIVERSITY_NAME_CORRECTIONS = {
  'uos대학교': '서울시립대학교',
  'uos대학': '서울시립대학교'
};

/**
 * 대학교 이름 정규화 (legacy 데이터 보정용)
 * @param {string} universityName
 * @returns {string|undefined}
 */
function normalizeUniversityName(universityName) {
  if (!universityName || typeof universityName !== 'string') {
    return universityName;
  }

  let normalized = universityName.trim();
  if (!normalized) {
    return normalized;
  }

  const simplifiedKey = normalized.toLowerCase().replace(/\s+/g, '');

  if (UNIVERSITY_NAME_CORRECTIONS[simplifiedKey]) {
    const correctedName = UNIVERSITY_NAME_CORRECTIONS[simplifiedKey];
    if (correctedName !== normalized) {
      console.log(`🔄 [University] 이름 보정: ${normalized} -> ${correctedName}`);
    }
    return correctedName;
  }

  if (simplifiedKey.endsWith('대학') && !simplifiedKey.endsWith('대학교')) {
    normalized = `${normalized}교`;
  }

  return normalized;
}


// ============================================
// 대학교 인증
// ============================================

/**
 * 6자리 랜덤 인증 코드 생성
 * @returns {string}
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 이메일 도메인에서 대학교 이름 추출
 * @param {string} email - 이메일 주소
 * @returns {string|null} - 대학교 이름 또는 null
 */
function getUniversityFromEmail(email) {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1].toLowerCase();

  // 1. 정확한 도메인 매칭 (최우선)
  if (UNIVERSITY_DOMAINS[domain]) {
    console.log(`✅ [University] 정확한 도메인 매칭: ${domain} -> ${UNIVERSITY_DOMAINS[domain]}`);
    return normalizeUniversityName(UNIVERSITY_DOMAINS[domain]);
  }

  // 2. 서브도메인 매칭 (예: student.yonsei.ac.kr)
  for (const [key, value] of Object.entries(UNIVERSITY_DOMAINS)) {
    if (domain.endsWith(key)) {
      console.log(`✅ [University] 서브도메인 매칭: ${domain} -> ${value}`);
      return normalizeUniversityName(value);
    }
  }

  // 3. .ac.kr로 끝나는 경우만 fallback (등록되지 않은 대학)
  if (domain.endsWith('.ac.kr')) {
    const parts = domain.split('.');
    if (parts.length >= 2) {
      const universityName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '대학교';
      console.log(`⚠️ [University] Fallback 매칭: ${domain} -> ${universityName}`);
      return normalizeUniversityName(universityName);
    }
  }

  return null;
}

/**
 * 대학교 이메일로 인증 코드 발송
 * @param {string} email - 대학교 이메일
 * @returns {Promise<Object>}
 */
export async function sendVerificationEmail(email) {
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

    // 3. 인증 코드 생성
    const verificationCode = generateVerificationCode();

    // 4. Firestore에 인증 코드 저장 (10분 유효)
    const verificationDocRef = doc(db, 'universityVerifications', currentUser.uid);
    await setDoc(verificationDocRef, {
      email: email,
      university: university,
      code: verificationCode,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10분 후 만료
    });

    console.log(`📧 [University] 인증 코드 생성: ${verificationCode} (${email})`);

    // 5. Firebase를 통한 이메일 발송
    try {
      await sendEmailViaFirebase(email, verificationCode, university);
      console.log(`✅ [University] 인증 메일 발송 완료: ${email}`);

      return {
        success: true,
        message: `${email}로 인증 코드가 발송되었습니다. (유효시간: 10분)`,
        university: university
      };
    } catch (emailError) {
      console.error('❌ [University] 이메일 발송 실패:', emailError);
      return {
        success: false,
        message: `이메일 발송 실패: ${emailError.message}. Firebase Extensions 설정을 확인하세요.`
      };
    }

  } catch (error) {
    console.error('❌ [University] 인증 코드 생성 실패:', error);
    return {
      success: false,
      message: `인증 실패: ${error.message}`
    };
  }
}

/**
 * Firebase를 통한 이메일 발송
 * (Firebase Extensions "Trigger Email from Firestore" 사용)
 * @param {string} toEmail - 수신자 이메일
 * @param {string} code - 인증 코드
 * @param {string} university - 대학교 이름
 * @returns {Promise<void>}
 */
async function sendEmailViaFirebase(toEmail, code, university) {
  // Firebase Extensions의 'mail' 컬렉션에 문서 추가
  // Extensions가 자동으로 이메일 발송
  const mailRef = collection(db, 'mail');

  await setDoc(doc(mailRef), {
    to: toEmail,
    message: {
      subject: `[코테공부] ${university} 이메일 인증 코드`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
            .code-box { background: #f5f5f5; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
            .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: 'Courier New', monospace; }
            .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }
            .warning { color: #e74c3c; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎓 대학교 이메일 인증</h1>
            </div>
            <div class="content">
              <p>안녕하세요!</p>
              <p><strong>${university}</strong> 이메일 인증을 요청하셨습니다.</p>
              <p>아래 인증 코드를 입력하여 인증을 완료해주세요:</p>

              <div class="code-box">
                <div class="code">${code}</div>
              </div>

              <p class="warning">⚠️ 이 인증 코드는 10분간 유효합니다.</p>
              <p style="color: #666; font-size: 14px;">
                본인이 요청하지 않은 경우, 이 이메일을 무시하셔도 됩니다.
              </p>
            </div>
            <div class="footer">
              <p>이 메일은 발신 전용입니다.</p>
              <p>© 2025 코테공부. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
[코테공부] ${university} 이메일 인증

안녕하세요!

${university} 이메일 인증을 요청하셨습니다.
아래 인증 코드를 입력하여 인증을 완료해주세요:

인증 코드: ${code}

⚠️ 이 인증 코드는 10분간 유효합니다.

본인이 요청하지 않은 경우, 이 이메일을 무시하셔도 됩니다.

---
이 메일은 발신 전용입니다.
© 2025 코테공부. All rights reserved.
      `
    }
  });

  console.log(`✅ [University] Firebase mail 컬렉션에 이메일 문서 추가 완료`);
}

/**
 * 인증 코드 검증 및 대학교 정보 저장
 * @param {string} code - 사용자가 입력한 인증 코드
 * @returns {Promise<Object>}
 */
export async function verifyCode(code) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, message: '로그인이 필요합니다.' };
  }

  try {
    // 1. Firestore에서 인증 코드 조회
    const verificationDocRef = doc(db, 'universityVerifications', currentUser.uid);
    const verificationDocSnap = await getDoc(verificationDocRef);

    if (!verificationDocSnap.exists()) {
      return { success: false, message: '인증 요청을 찾을 수 없습니다. 먼저 인증 메일을 발송하세요.' };
    }

    const verificationData = verificationDocSnap.data();

    // 2. 만료 시간 확인
    const expiresAt = verificationData.expiresAt.toDate();
    if (new Date() > expiresAt) {
      return { success: false, message: '인증 코드가 만료되었습니다. 다시 발송해주세요.' };
    }

    // 3. 코드 일치 확인
    if (verificationData.code !== code) {
      return { success: false, message: '인증 코드가 일치하지 않습니다.' };
    }

    // 4. 사용자 문서에 대학교 정보 저장
    const userDocRef = doc(db, 'users', currentUser.uid);
    await setDoc(userDocRef, {
      university: verificationData.university,
      universityEmail: verificationData.email,
      universityVerifiedAt: serverTimestamp()
    }, { merge: true });

    // 5. 인증 코드 문서 삭제 (재사용 방지)
    await setDoc(verificationDocRef, {
      verified: true,
      verifiedAt: serverTimestamp()
    }, { merge: true });

    console.log(`✅ [University] 대학교 인증 완료: ${verificationData.university}`);
    return {
      success: true,
      message: `${verificationData.university} 인증이 완료되었습니다!`,
      university: verificationData.university
    };

  } catch (error) {
    console.error('❌ [University] 인증 코드 검증 실패:', error);
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

    const userData = userDocSnap.data();
    const originalUniversity = userData.university;
    let university = normalizeUniversityName(originalUniversity) || originalUniversity;
    const universityEmail = userData.universityEmail;

    if (university && university !== originalUniversity) {
      console.log(`🔄 [University] 대학교 이름 보정: ${originalUniversity} -> ${university}`);
      await setDoc(userDocRef, {
        university: university
      }, { merge: true });
    }

    // 저장된 대학교 이름이 이메일 도메인 매핑과 다른 경우 자동 업데이트
    // (이전 fallback으로 저장된 데이터를 올바른 매핑으로 수정)
    if (universityEmail) {
      const correctUniversity = getUniversityFromEmail(universityEmail);
      if (correctUniversity && correctUniversity !== university) {
        console.log(`🔄 [University] 대학교 이름 업데이트: ${university} -> ${correctUniversity}`);

        // Firestore 업데이트
        await setDoc(userDocRef, {
          university: correctUniversity
        }, { merge: true });

        university = correctUniversity;
      }
    }

    return {
      university: university,
      universityEmail: universityEmail,
      verifiedAt: userData.universityVerifiedAt
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

    const originalUniversity = userDocSnap.data().university;
    const university = normalizeUniversityName(originalUniversity) || originalUniversity;

    if (!university) {
      return { success: true, message: '대학교 미인증 사용자' };
    }

    if (university !== originalUniversity) {
      await setDoc(userDocRef, {
        university: university
      }, { merge: true });
    }

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

    const aggregatedRankings = new Map();

    snapshot.forEach(docSnap => {
      const universityRankingData = docSnap.data();
      const periodData = universityRankingData[fieldName];

      if (!periodData) {
        return; // 해당 기간 데이터 없으면 제외
      }

      const rawName = universityRankingData.university || docSnap.id;
      const normalizedName = normalizeUniversityName(rawName) || rawName;

      if (!normalizedName) {
        return;
      }

      if (!aggregatedRankings.has(normalizedName)) {
        aggregatedRankings.set(normalizedName, {
          university: normalizedName,
          totalScore: 0,
          problems: 0
        });
      }

      const entry = aggregatedRankings.get(normalizedName);
      entry.totalScore += periodData.totalScore || 0;
      entry.problems += periodData.problems || 0;
    });

    const rankings = Array.from(aggregatedRankings.values()).map(entry => ({
      university: entry.university,
      totalScore: entry.totalScore,
      problems: entry.problems,
      avgScore: entry.problems > 0 ? entry.totalScore / entry.problems : 0
    }));

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

      if (!userDocSnap.exists()) {
        continue;
      }

      const userUniversity = normalizeUniversityName(userDocSnap.data().university) || userDocSnap.data().university;
      if (userUniversity !== university) {
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
    sendVerificationEmail,
    verifyCode,
    getMyUniversity,
    updateUniversityStats,
    getUniversityRankings,
    getIntraUniversityRankings
  };
}
