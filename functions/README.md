# Firebase Cloud Functions - 랭킹 스냅샷 자동 생성

## 📋 개요

이 Cloud Functions는 **6시간마다 자동으로** 랭킹 스냅샷을 생성합니다.

- **자동화**: Cloud Scheduler로 스케줄링
- **서버리스**: 서버 관리 불필요
- **확장성**: 사용자 수 증가에도 자동 대응

---

## 🚀 배포 방법

### 1단계: Firebase CLI 설치

```bash
npm install -g firebase-tools
```

### 2단계: Firebase 로그인

```bash
firebase login
```

### 3단계: 프로젝트 초기화 (최초 1회만)

```bash
# 프로젝트 루트에서 실행
firebase init functions

# 설정 옵션:
# - Use an existing project: 본인의 Firebase 프로젝트 선택
# - Language: JavaScript
# - ESLint: No (선택사항)
# - Install dependencies: Yes
```

### 4단계: 의존성 설치

```bash
cd functions
npm install
```

### 5단계: 배포

```bash
# functions 폴더에서 실행 또는 프로젝트 루트에서
firebase deploy --only functions
```

---

## ⏰ 자동 실행 설정

배포 후, Cloud Scheduler가 자동으로 설정됩니다:

- **함수명**: `generateRankingSnapshot`
- **실행 주기**: 6시간마다 (0시, 6시, 12시, 18시)
- **타임존**: 서울 (Asia/Seoul)

### 설정 확인

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. Cloud Scheduler 메뉴 이동
3. `firebase-schedule-generateRankingSnapshot-*` 확인

---

## 🔧 수동 실행 (테스트용)

### HTTP 트리거 사용

```bash
# 배포 후 URL 확인
firebase functions:log

# URL 예시:
# https://asia-northeast3-[프로젝트ID].cloudfunctions.net/manualGenerateRankingSnapshot
```

브라우저나 curl로 접속:

```bash
curl https://asia-northeast3-[프로젝트ID].cloudfunctions.net/manualGenerateRankingSnapshot
```

---

## 📊 모니터링

### 로그 확인

```bash
firebase functions:log
```

또는 Firebase Console → Functions → 로그 탭

### 실행 내역 확인

```bash
firebase functions:log --only generateRankingSnapshot --limit 10
```

---

## 💰 비용

### Cloud Functions

- **무료 할당량**:
  - 호출 2,000,000회/월
  - 실행 시간 400,000 GB-초/월
  - 아웃바운드 네트워크 5GB/월

- **이 프로젝트 예상 사용량**:
  - 호출: 4회/일 × 30일 = **120회/월**
  - 실행 시간: 약 2초 × 120회 = **240초/월**

**결론**: 완전 무료

### Cloud Scheduler

- **무료 할당량**: 3개 작업까지 무료
- **이 프로젝트**: 1개 작업만 사용

**결론**: 완전 무료

---

## 🔒 보안 설정 (권장)

수동 실행 URL은 누구나 접근 가능하므로 보안 설정을 권장합니다.

### 방법 1: Firebase Authentication 필요

```javascript
// functions/index.js에서
exports.manualGenerateRankingSnapshot = functions
  .region('asia-northeast3')
  .https
  .onRequest(async (req, res) => {
    // 관리자 인증 확인
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: '인증 필요' });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      // 관리자 확인 로직 추가
    } catch (error) {
      return res.status(403).json({ error: '권한 없음' });
    }

    // ... 기존 코드
  });
```

### 방법 2: Secret Key 사용

```javascript
const SECRET_KEY = functions.config().admin.secret_key;

if (req.query.key !== SECRET_KEY) {
  return res.status(403).json({ error: '권한 없음' });
}
```

---

## 🛠 문제 해결

### "Billing account not configured" 오류

→ Firebase 프로젝트를 **Blaze(종량제)** 플랜으로 업그레이드해야 Cloud Functions를 사용할 수 있습니다.
   (무료 할당량이 충분하므로 실제 과금은 발생하지 않습니다)

### 배포 실패

```bash
# 권한 확인
firebase login --reauth

# 프로젝트 확인
firebase projects:list
firebase use [프로젝트ID]
```

### Cloud Scheduler 미생성

```bash
# 수동으로 Scheduler 트리거
gcloud scheduler jobs create pubsub firebase-schedule-generateRankingSnapshot \
  --schedule="0 */6 * * *" \
  --topic=firebase-schedule-generateRankingSnapshot \
  --location=asia-northeast3 \
  --time-zone="Asia/Seoul"
```

---

## ✅ 다음 단계

배포 완료 후:

1. ✅ 6시간마다 자동으로 스냅샷 생성
2. ✅ 클라이언트는 자동으로 최신 스냅샷 사용
3. ✅ 서버 비용 $0 (무료 할당량 내)
4. ✅ 관리 불필요 (완전 자동화)

**축하합니다! 올인원 스냅샷 시스템이 완성되었습니다! 🎉**
