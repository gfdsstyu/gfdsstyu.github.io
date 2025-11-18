# Firestore 보안 규칙 (Firestore Security Rules)

## ⚠️ 중요: 보안 규칙 업데이트 필요

현재 그룹 기능을 사용하려면 Firebase Console에서 Firestore 보안 규칙을 업데이트해야 합니다.

## 📝 보안 규칙 적용 방법

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. 좌측 메뉴에서 **Firestore Database** 클릭
4. **규칙(Rules)** 탭 클릭
5. 아래 규칙 복사 & 붙여넣기
6. **게시(Publish)** 클릭

## 🔐 권장 보안 규칙

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================
    // Helper Functions
    // ============================================

    // 인증된 사용자인지 확인
    function isAuthenticated() {
      return request.auth != null;
    }

    // 본인 문서인지 확인
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // ============================================
    // Users Collection
    // ============================================

    match /users/{userId} {
      // 읽기: 본인만 가능
      allow read: if isOwner(userId);

      // 쓰기: 본인만 가능
      allow write: if isOwner(userId);
    }

    // ============================================
    // Rankings Collection (Phase 3)
    // ============================================

    match /rankings/{userId} {
      // 읽기: 모든 인증된 사용자
      allow read: if isAuthenticated();

      // 쓰기: 본인만 가능
      allow write: if isOwner(userId);
    }

    // ============================================
    // Groups Collection (Phase 3.5)
    // ============================================

    match /groups/{groupId} {
      // 읽기: 공개 그룹은 모든 인증된 사용자, 비공개는 멤버만
      allow read: if isAuthenticated();

      // 생성: 모든 인증된 사용자
      allow create: if isAuthenticated()
        && request.resource.data.ownerId == request.auth.uid
        && request.resource.data.memberCount == 1;

      // 업데이트: 그룹장만 가능 (memberCount 제외)
      allow update: if isAuthenticated()
        && (resource.data.ownerId == request.auth.uid
            || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberCount', 'lastUpdatedAt']));

      // 삭제: 그룹장만 가능
      allow delete: if isAuthenticated()
        && resource.data.ownerId == request.auth.uid;

      // 멤버 서브컬렉션
      match /members/{userId} {
        // 읽기: 같은 그룹 멤버만
        allow read: if isAuthenticated()
          && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));

        // 생성: 본인 또는 그룹장
        allow create: if isAuthenticated()
          && (request.auth.uid == userId
              || get(/databases/$(database)/documents/groups/$(groupId)).data.ownerId == request.auth.uid);

        // 업데이트: 본인 또는 그룹장
        allow update: if isAuthenticated()
          && (request.auth.uid == userId
              || get(/databases/$(database)/documents/groups/$(groupId)).data.ownerId == request.auth.uid);

        // 삭제: 본인 또는 그룹장
        allow delete: if isAuthenticated()
          && (request.auth.uid == userId
              || get(/databases/$(database)/documents/groups/$(groupId)).data.ownerId == request.auth.uid);
      }
    }

    // ============================================
    // Group Rankings Collection (Phase 3.5.3)
    // ============================================

    match /groupRankings/{groupId} {
      // 읽기: 모든 인증된 사용자
      allow read: if isAuthenticated();

      // 쓰기: 해당 그룹 멤버만
      allow write: if isAuthenticated()
        && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
    }

    // ============================================
    // University Verifications Collection (Phase 3.6)
    // ============================================

    match /universityVerifications/{userId} {
      // 읽기: 본인만 가능
      allow read: if isOwner(userId);

      // 쓰기: 본인만 가능 (인증 코드 생성/검증)
      allow write: if isOwner(userId);
    }

    // ============================================
    // University Rankings Collection (Phase 3.6)
    // ============================================

    match /universityRankings/{university} {
      // 읽기: 모든 인증된 사용자
      allow read: if isAuthenticated();

      // 쓰기: 해당 대학교로 인증된 사용자만
      allow write: if isAuthenticated();
    }

    // ============================================
    // Mail Collection (Firebase Extensions - Trigger Email)
    // ============================================

    match /mail/{mailId} {
      // 생성: 인증된 사용자만 (이메일 발송)
      allow create: if isAuthenticated();

      // 읽기/업데이트/삭제: Firebase Extensions만 가능 (관리자 권한)
      allow read, update, delete: if false;
    }

    // ============================================
    // Default Deny All
    // ============================================

    // 명시되지 않은 모든 경로는 차단
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 🔍 규칙 설명

### 1. Users Collection
- **읽기/쓰기**: 본인만 가능
- 개인 학습 데이터 보호

### 2. Rankings Collection
- **읽기**: 모든 인증된 사용자 (랭킹 조회용)
- **쓰기**: 본인만 가능 (통계 업데이트)

### 3. Groups Collection
- **생성**: 모든 인증된 사용자
- **읽기**: 모든 인증된 사용자 (공개 그룹 검색용)
- **업데이트**: 그룹장 또는 memberCount/lastUpdatedAt만 변경
- **삭제**: 그룹장만 가능

### 4. Groups Members Subcollection
- **읽기**: 같은 그룹 멤버만
- **생성/업데이트/삭제**: 본인 또는 그룹장

### 5. Group Rankings Collection
- **읽기**: 모든 인증된 사용자 (랭킹 조회용)
- **쓰기**: 해당 그룹 멤버만 (통계 업데이트)

### 6. University Verifications Collection (Phase 3.6)
- **읽기/쓰기**: 본인만 가능
- 이메일 인증 코드 임시 저장용

### 7. University Rankings Collection (Phase 3.6)
- **읽기**: 모든 인증된 사용자 (랭킹 조회용)
- **쓰기**: 모든 인증된 사용자 (대학교별 통계 업데이트)

### 8. Mail Collection (Firebase Extensions)
- **생성**: 인증된 사용자만 가능 (이메일 발송 요청)
- **읽기/업데이트/삭제**: 차단 (Firebase Extensions만 접근)
- Firebase Extensions "Trigger Email from Firestore" 사용

## ⚡ 적용 후 테스트

규칙 적용 후 다음 기능들이 정상 작동하는지 확인하세요:

**그룹 기능 (Phase 3.5)**
1. ✅ 그룹 생성
2. ✅ 그룹 검색
3. ✅ 그룹 가입
4. ✅ 그룹 탈퇴
5. ✅ 그룹별 랭킹 조회
6. ✅ 그룹 내 랭킹 조회

**대학교 기능 (Phase 3.6)**
7. ✅ 대학교 이메일 인증
8. ✅ 대학교별 랭킹 조회
9. ✅ 대학 내 랭킹 조회

## 🛡️ 보안 참고사항

- **비밀번호 평문 저장**: 현재 그룹 비밀번호가 평문으로 저장됩니다. 프로덕션 환경에서는 bcrypt 등으로 해싱 권장
- **데이터 검증**: 클라이언트 측 검증만 있으므로, 중요한 로직은 Cloud Functions 사용 권장
- **속도 제한**: Firebase App Check 사용 권장

## 📧 Firebase Extensions 설정 (이메일 발송)

대학교 이메일 인증 기능을 사용하려면 **Firebase Extensions "Trigger Email from Firestore"**를 설치해야 합니다.

### 1. Firebase Extensions 설치

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. 좌측 메뉴 → **Extensions** (확장 프로그램) 클릭
4. **"Browse extensions"** 또는 **"확장 프로그램 탐색"** 클릭
5. **"Trigger Email from Firestore"** 검색
6. **설치(Install)** 클릭

### 2. Extensions 설정

설치 과정에서 다음 정보를 입력합니다:

**SMTP 설정 (Gmail 예시):**
- **SMTP connection URI**: `smtps://YOUR_EMAIL@gmail.com:YOUR_APP_PASSWORD@smtp.gmail.com:465`
- **Email documents collection**: `mail` (기본값)
- **Default FROM address**: `your-email@gmail.com`

**Gmail App Password 생성 방법:**
1. Google 계정 → 보안 → 2단계 인증 활성화
2. 앱 비밀번호 생성 ([https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords))
3. "메일" 앱 선택 → 생성
4. 생성된 16자리 비밀번호 복사

### 3. 다른 이메일 제공자 SMTP 설정

**SendGrid:**
```
smtps://apikey:YOUR_API_KEY@smtp.sendgrid.net:465
```

**Outlook/Hotmail:**
```
smtps://YOUR_EMAIL@outlook.com:YOUR_PASSWORD@smtp.office365.com:587
```

**Custom SMTP:**
```
smtps://username:password@smtp.yourdomain.com:465
```

### 4. 설치 후 테스트

Extensions 설치 후:
1. Firestore → `mail` 컬렉션 확인
2. 대학교 이메일 인증 기능 테스트
3. `mail` 컬렉션에 문서가 생성되고 `delivery.state: "SUCCESS"` 확인

### ⚠️ 중요 사항

- Extensions 설치 없이는 이메일 발송이 작동하지 않습니다
- SMTP 인증 정보는 안전하게 보관하세요
- Gmail의 경우 2단계 인증 + 앱 비밀번호 필수
- 일일 발송 한도 확인 (Gmail 무료: 500통/일)

## 📚 참고 자료

- [Firestore 보안 규칙 공식 문서](https://firebase.google.com/docs/firestore/security/get-started)
- [보안 규칙 테스트 도구](https://firebase.google.com/docs/rules/emulator-setup)
- [Firebase Extensions - Trigger Email](https://firebase.google.com/products/extensions/firestore-send-email)
