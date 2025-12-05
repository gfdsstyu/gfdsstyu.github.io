/**
 * ============================================
 * Firebase Cloud Functions - 랭킹 스냅샷 자동 생성
 * ============================================
 *
 * 목적:
 * - 6시간마다 자동으로 랭킹 스냅샷을 생성하여 ranking_cache에 저장
 * - 서버리스 방식으로 완전 자동화
 *
 * 배포 방법:
 * 1. Firebase CLI 설치:
 *    npm install -g firebase-tools
 *
 * 2. Firebase 로그인:
 *    firebase login
 *
 * 3. 프로젝트 초기화 (이미 했다면 생략):
 *    firebase init functions
 *
 * 4. 배포:
 *    firebase deploy --only functions
 *
 * 실행 주기:
 * - Cloud Scheduler가 6시간마다 자동 실행
 * - 수동 실행도 가능 (Firebase Console에서)
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * 랭킹 스냅샷 생성 함수
 * - 공부 피크타임에 자동 실행 (8시, 13시, 18시, 23시)
 */
exports.generateRankingSnapshot = functions
  .region('asia-northeast3') // 서울 리전
  .pubsub
  .schedule('0 8,13,18,23 * * *') // 8시, 13시, 18시, 23시
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    console.log('🚀 랭킹 스냅샷 생성 시작...');
    console.log(`⏰ 실행 시각: ${new Date().toISOString()}`);

    try {
      // 1. rankings 컬렉션에서 모든 데이터 읽기
      console.log('📖 rankings 컬렉션 읽기 중...');
      const rankingsSnapshot = await db.collection('rankings').get();

      console.log(`✅ 총 ${rankingsSnapshot.size}명의 사용자 데이터 발견`);

      // 2. 핵심 데이터만 추출
      const users = [];

      rankingsSnapshot.forEach(doc => {
        const data = doc.data();

        // 🔧 FIX: Firestore의 "daily.2025-11-26" 형식을 중첩 객체로 변환
        const daily = {};
        const weekly = {};
        const monthly = {};

        Object.keys(data).forEach(key => {
          if (key.startsWith('daily.')) {
            const dateKey = key.replace('daily.', '');
            daily[dateKey] = data[key];
          } else if (key.startsWith('weekly.')) {
            const weekKey = key.replace('weekly.', '');
            weekly[weekKey] = data[key];
          } else if (key.startsWith('monthly.')) {
            const monthKey = key.replace('monthly.', '');
            monthly[monthKey] = data[key];
          }
        });

        users.push({
          userId: data.userId || doc.id,
          nickname: data.nickname || '익명',
          university: data.university || null,
          daily: daily,
          weekly: weekly,
          monthly: monthly
        });
      });

      // 3. 스냅샷 생성
      const snapshot = {
        users: users,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalUsers: users.length,
        version: '1.0'
      };

      // 4. ranking_cache 컬렉션에 저장
      console.log('💾 ranking_cache에 스냅샷 저장 중...');

      await db.collection('ranking_cache').doc('snapshot').set(snapshot);

      console.log('✅ 스냅샷 생성 완료!');
      console.log(`   - 사용자 수: ${users.length}명`);

      // 5. 데이터 크기 추정
      const estimatedSize = JSON.stringify(snapshot).length;
      const sizeKB = (estimatedSize / 1024).toFixed(2);
      console.log(`   - 데이터 크기: 약 ${sizeKB} KB`);

      return { success: true, userCount: users.length, sizeKB };

    } catch (error) {
      console.error('❌ 스냅샷 생성 실패:', error);
      throw error;
    }
  });

/**
 * 수동 실행용 HTTP 트리거 (테스트/긴급 갱신용)
 * - URL: https://asia-northeast3-[프로젝트ID].cloudfunctions.net/manualGenerateRankingSnapshot
 * - 관리자만 실행 가능하도록 보안 설정 필요
 */
exports.manualGenerateRankingSnapshot = functions
  .region('asia-northeast3')
  .https
  .onRequest(async (req, res) => {
    console.log('🔧 수동 스냅샷 생성 요청 받음');

    try {
      const rankingsSnapshot = await db.collection('rankings').get();
      const users = [];

      rankingsSnapshot.forEach(doc => {
        const data = doc.data();

        // 🔧 FIX: Firestore의 "daily.2025-11-26" 형식을 중첩 객체로 변환
        const daily = {};
        const weekly = {};
        const monthly = {};

        Object.keys(data).forEach(key => {
          if (key.startsWith('daily.')) {
            const dateKey = key.replace('daily.', '');
            daily[dateKey] = data[key];
          } else if (key.startsWith('weekly.')) {
            const weekKey = key.replace('weekly.', '');
            weekly[weekKey] = data[key];
          } else if (key.startsWith('monthly.')) {
            const monthKey = key.replace('monthly.', '');
            monthly[monthKey] = data[key];
          }
        });

        users.push({
          userId: data.userId || doc.id,
          nickname: data.nickname || '익명',
          university: data.university || null,
          daily: daily,
          weekly: weekly,
          monthly: monthly
        });
      });

      const snapshot = {
        users: users,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalUsers: users.length,
        version: '1.0'
      };

      await db.collection('ranking_cache').doc('snapshot').set(snapshot);

      res.json({
        success: true,
        message: '스냅샷 생성 완료',
        userCount: users.length,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ 수동 스냅샷 생성 실패:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
