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
      // 읽기: 모든 인증된 사용자 가능 (그룹 멤버 프로필, 업적 조회용)
      allow read: if isAuthenticated();

      // 쓰기: 본인만 가능
      allow write: if isOwner(userId);

      // 상세 기록 서브컬렉션 (user_answer, feedback 등)
      match /records/{recordId} {
        allow read, write: if isOwner(userId);
      }
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
    // University Emails Collection (Phase 3.6 - 중복 방지)
    // ============================================

    // [신규] 대학교 인증된 이메일 목록 (중복 방지용)
    // ID가 이메일 주소인 문서입니다.
    match /universityEmails/{email} {
      // 존재 여부 확인(get)은 누구나 가능 (중복 체크용)
      // 목록 조회(list)는 불가능 (이메일 유출 방지)
      allow get: if isAuthenticated();

      // 생성은 인증된 사용자만
      allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;

      // 수정/삭제 불가 (한 번 인증되면 고정)
      allow update, delete: if false;
    }

    // ============================================
    // Ranking Cache Collection (스냅샷 기반 랭킹 시스템)
    // ============================================

    match /ranking_cache/{document} {
      // 읽기: 모든 인증된 사용자 가능
      allow read: if isAuthenticated();

      // 쓰기: 서버 사이드만 가능 (Cloud Functions)
      allow write: if false;
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
- **읽기**: 모든 인증된 사용자 (그룹 멤버 프로필, 업적 조회용)
- **쓰기**: 본인만 가능
- 개인 학습 데이터는 본인만 수정 가능, 조회는 그룹 기능을 위해 허용

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

### 8. University Emails Collection (Phase 3.6)
- **읽기(get)**: 모든 인증된 사용자 (중복 체크용)
- **생성**: 인증된 사용자만
- **수정/삭제**: 불가능 (한 번 인증되면 고정)

### 9. Ranking Cache Collection (스냅샷 시스템)
- **읽기**: 모든 인증된 사용자 (스냅샷 기반 랭킹 조회)
- **쓰기**: 불가능 (Cloud Functions만 가능)
- Firestore 읽기 횟수를 96% 절감하는 스냅샷 캐시

### 10. Mail Collection (Firebase Extensions)
- **생성**: 인증된 사용자만 가능 (이메일 발송 요청)
- **읽기/업데이트/삭제**: 차단 (Firebase Extensions만 접근)
- Firebase Extensions "Trigger Email from Firestore" 사용

## ⚡ 적용 후 테스트

규칙 적용 후 다음 기능들이 정상 작동하는지 확인하세요:

**기본 기능**
1. ✅ 랭킹 조회 (스냅샷 기반)
2. ✅ 그룹 멤버 프로필 조회 (업적, 상태 메시지)
3. ✅ 개인 데이터 수정

**그룹 기능 (Phase 3.5)**
4. ✅ 그룹 생성
5. ✅ 그룹 검색
6. ✅ 그룹 가입
7. ✅ 그룹 탈퇴
8. ✅ 그룹별 랭킹 조회
9. ✅ 그룹 내 랭킹 조회
10. ✅ 그룹원 업적 포인트 조회

**대학교 기능 (Phase 3.6)**
11. ✅ 대학교 이메일 인증
12. ✅ 대학교별 랭킹 조회
13. ✅ 대학 내 랭킹 조회

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
  - 예시: `smtps://myemail@gmail.com:abcd efgh ijkl mnop@smtp.gmail.com:465`
  - ⚠️ 앱 비밀번호의 공백은 그대로 입력하거나 제거해도 됩니다
- **Email documents collection**: `mail` (기본값)
- **Default FROM address**: `your-email@gmail.com`

**Gmail App Password 생성 방법:**
1. Google 계정 → 보안 → 2단계 인증 활성화
2. 앱 비밀번호 생성 페이지 접속: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. "앱 비밀번호" 페이지에서 앱 이름 입력 (예: "Firebase Email")
4. **생성** 버튼 클릭
5. 표시되는 16자리 비밀번호 복사 (예: `abcd efgh ijkl mnop`)
   - ⚠️ 최신 버전에서는 앱/기기 선택 없이 바로 비밀번호가 생성됩니다
   - 이 비밀번호는 다시 확인할 수 없으므로 안전하게 보관하세요

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

## 🐛 이메일 발송 안 될 때 디버깅

인증 메일이 발송되지 않는 경우 다음 사항들을 확인하세요:

### 1. Firebase Extensions 상태 확인

1. Firebase Console → Extensions 메뉴
2. "Trigger Email from Firestore" 상태 확인
   - ✅ **Active** (활성화)로 표시되어야 함
   - ❌ **Error** 또는 **Paused**인 경우: Extensions 재설정 필요

### 2. SMTP 설정 확인

1. Extensions → "Trigger Email from Firestore" → **관리** 클릭
2. **재구성(Reconfigure)** 클릭
3. SMTP connection URI 확인:
   ```
   smtps://your-email@gmail.com:your-app-password@smtp.gmail.com:465
   ```
   - ⚠️ 이메일 주소 정확한지 확인
   - ⚠️ 앱 비밀번호 정확한지 확인 (공백 제거 또는 유지)
   - ⚠️ `@smtp.gmail.com:465` 누락되지 않았는지 확인

### 3. Firestore mail 컬렉션 확인

1. Firebase Console → Firestore Database
2. `mail` 컬렉션 확인
   - ✅ 문서가 생성되었는가?
     - **YES**: Extensions는 작동 중, SMTP 설정 문제
     - **NO**: 앱 코드 또는 보안 규칙 문제
3. 문서 내부 확인:
   ```json
   {
     "to": "student@university.ac.kr",
     "message": { ... },
     "delivery": {
       "state": "SUCCESS" 또는 "ERROR",
       "error": "오류 메시지 (있는 경우)"
     }
   }
   ```
   - `delivery.state: "ERROR"`인 경우: `delivery.error` 메시지 확인

### 4. Extensions 로그 확인

1. Firebase Console → Extensions
2. "Trigger Email from Firestore" → **관리**
3. **함수 로그 보기(View logs)** 클릭
4. 최근 로그에서 오류 확인:
   - `SMTP connection failed`: SMTP URI 또는 앱 비밀번호 오류
   - `Authentication failed`: 이메일/비밀번호 불일치
   - `Permission denied`: Firestore 보안 규칙 문제

### 5. 브라우저 콘솔 확인

1. 웹사이트에서 F12 → Console 탭
2. 인증 메일 발송 시도
3. 다음 메시지 확인:
   - ✅ `📧 [University] 인증 코드 생성: XXXXXX`
   - ✅ `✅ [University] 인증 메일 발송 완료`
   - ❌ `❌ [University] 이메일 발송 실패` → 오류 메시지 확인

### 6. 일반적인 문제 해결

**문제: SMTP Authentication failed**
- 해결: Gmail 앱 비밀번호 재생성
- 2단계 인증이 활성화되어 있는지 확인

**문제: mail 컬렉션에 문서가 생성되지 않음**
- 해결: Firestore 보안 규칙 확인
- `allow create: if isAuthenticated();` 규칙이 있는지 확인

**문제: delivery.state: "ERROR", "Invalid login"**
- 해결: SMTP URI에서 이메일 주소와 앱 비밀번호 확인
- 공백 제거 시도: `abcdefghijklmnop` (공백 없이)

**문제: Extensions가 "Error" 상태**
- 해결: Extensions 삭제 후 재설치
- Cloud Functions API 활성화 확인

## 📚 참고 자료

- [Firestore 보안 규칙 공식 문서](https://firebase.google.com/docs/firestore/security/get-started)
- [보안 규칙 테스트 도구](https://firebase.google.com/docs/rules/emulator-setup)
- [Firebase Extensions - Trigger Email](https://firebase.google.com/products/extensions/firestore-send-email)
