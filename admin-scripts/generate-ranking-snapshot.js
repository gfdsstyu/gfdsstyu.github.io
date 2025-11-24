#!/usr/bin/env node
/**
 * ============================================
 * 랭킹 스냅샷 생성 스크립트 (관리자용)
 * ============================================
 *
 * 목적:
 * - rankings 컬렉션의 모든 사용자 데이터를 읽어서
 * - 하나의 JSON 스냅샷으로 만들어
 * - ranking_cache 컬렉션에 저장
 *
 * 실행 방법:
 * 1. Firebase Admin SDK 설정:
 *    - Firebase Console > 프로젝트 설정 > 서비스 계정
 *    - "새 비공개 키 생성" 클릭
 *    - 다운로드한 JSON 파일을 이 폴더에 'serviceAccountKey.json'으로 저장
 *
 * 2. 의존성 설치:
 *    cd admin-scripts
 *    npm install firebase-admin
 *
 * 3. 실행:
 *    node generate-ranking-snapshot.js
 *
 * 4. 자동화 (옵션):
 *    - cron 또는 Cloud Scheduler로 6시간마다 실행
 *    - crontab -e 로 편집하여 6시간 간격 스케줄 설정
 */

const admin = require('firebase-admin');
const path = require('path');

// ============================================
// Firebase Admin 초기화
// ============================================

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ============================================
// 스냅샷 생성 함수
// ============================================

async function generateRankingSnapshot() {
  console.log('🚀 랭킹 스냅샷 생성 시작...');
  console.log(`⏰ 실행 시각: ${new Date().toISOString()}`);

  try {
    // 1. rankings 컬렉션에서 모든 데이터 읽기
    console.log('📖 rankings 컬렉션 읽기 중...');
    const rankingsSnapshot = await db.collection('rankings').get();

    console.log(`✅ 총 ${rankingsSnapshot.size}명의 사용자 데이터 발견`);

    // 2. 핵심 데이터만 추출 (불필요한 정보 제거)
    const users = [];

    rankingsSnapshot.forEach(doc => {
      const data = doc.data();

      users.push({
        userId: data.userId || doc.id,
        nickname: data.nickname || '익명',
        university: data.university || null,
        daily: data.daily || {},
        weekly: data.weekly || {},
        monthly: data.monthly || {}
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
    return { success: false, error: error.message };
  }
}

// ============================================
// 실행
// ============================================

(async () => {
  const result = await generateRankingSnapshot();

  if (result.success) {
    console.log('\n🎉 작업 완료!');
    process.exit(0);
  } else {
    console.error('\n❌ 작업 실패!');
    process.exit(1);
  }
})();
