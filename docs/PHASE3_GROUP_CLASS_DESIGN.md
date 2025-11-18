# Phase 3.5-3.6: 그룹 & 고시반 시스템 설계

## 📋 목차
1. [개요](#개요)
2. [랭킹 시스템 전체 구조](#랭킹-시스템-전체-구조)
3. [UI 구조](#ui-구조)
4. [데이터 구조](#데이터-구조)
5. [Phase 3.5: 그룹 시스템](#phase-35-그룹-시스템)
6. [Phase 3.6: 고시반 시스템](#phase-36-고시반-시스템)
7. [구현 순서](#구현-순서)

---

## 개요

**목표**: 개인 학습뿐만 아니라 **그룹 스터디**와 **고시반(학습반)** 기능을 통해 사용자 간 협력·경쟁 학습 환경 제공

**핵심 기능**:
- 개인 전체 랭킹 (✅ 완료)
- 그룹별 랭킹 (그룹 간 경쟁) 🆕
- 그룹 내 랭킹 (그룹 멤버 간 경쟁) 🆕
- 고시반별 랭킹 (고시반 간 경쟁) 🆕
- 고시반 내 랭킹 (고시반 멤버 간 경쟁) 🆕

---

## 랭킹 시스템 전체 구조

### 5가지 랭킹 타입

| 랭킹 타입 | 설명 | 경쟁 대상 | 데이터 소스 |
|----------|------|----------|------------|
| **개인 전체 랭킹** | 전체 사용자 순위 | 모든 사용자 | `rankings/{userId}` |
| **그룹별 랭킹** | 그룹 간 순위 | 전체 그룹 | `groupRankings/{groupId}` |
| **그룹 내 랭킹** | 특정 그룹 내 멤버 순위 | 그룹 멤버 | `groups/{groupId}/members/{userId}` |
| **고시반별 랭킹** | 고시반 간 순위 | 전체 고시반 | `classRankings/{classId}` |
| **고시반 내 랭킹** | 특정 고시반 내 멤버 순위 | 고시반 멤버 | `classes/{classId}/members/{userId}` |

### 랭킹 기준 (모든 타입 공통)

- **기간**: 일간(daily), 주간(weekly), 월간(monthly)
- **항목**: 총점수(totalScore), 문풀횟수(problems), 평균점수(avgScore)
- **총 9개 랭킹** = 3 기간 × 3 항목

---

## UI 구조

### 랭킹 모달 탭 구조

```
┌─────────────────────────────────────────────────────┐
│  📊 랭킹                                       ✕    │
├─────────────────────────────────────────────────────┤
│  [🌍 전체]  [👥 내 그룹]  [🎓 내 고시반]  ← 메인 탭 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ 탭별 콘텐츠 ───────────────────────────┐       │
│  │                                          │       │
│  │  🌍 전체 탭:                             │       │
│  │    - 개인 전체 랭킹 (현재 구현)          │       │
│  │    - 내 통계 + 전체 순위                 │       │
│  │                                          │       │
│  │  👥 내 그룹 탭:                          │       │
│  │    ┌───────────────────────────┐        │       │
│  │    │ [🏆 그룹별] [👤 그룹내]    │        │       │
│  │    └───────────────────────────┘        │       │
│  │    - 그룹별: 전체 그룹 간 경쟁           │       │
│  │    - 그룹내: 내 그룹 멤버 간 경쟁        │       │
│  │                                          │       │
│  │  🎓 내 고시반 탭:                        │       │
│  │    ┌───────────────────────────┐        │       │
│  │    │ [🏆 반별] [👤 반내]        │        │       │
│  │    └───────────────────────────┘        │       │
│  │    - 반별: 전체 고시반 간 경쟁           │       │
│  │    - 반내: 내 고시반 멤버 간 경쟁        │       │
│  │                                          │       │
│  └──────────────────────────────────────────┘       │
│                                                     │
│  ┌─ 공통 필터 (모든 탭) ──────────────┐            │
│  │  [일간] [주간] [월간]               │            │
│  │  [총점수] [문풀횟수] [평균점수]      │            │
│  └─────────────────────────────────┘            │
│                                                     │
│  ┌─ 랭킹 리스트 ─────────────────────┐            │
│  │  1위 🥇 닉네임A  총점:1000 ...     │            │
│  │  2위 🥈 닉네임B  총점:900  ...     │            │
│  │  ...                                │            │
│  └─────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
```

### 빈 상태 (Empty State)

사용자가 그룹이나 고시반에 가입하지 않은 경우:

```
┌─────────────────────────────────────┐
│  👥 내 그룹 탭                      │
├─────────────────────────────────────┤
│                                     │
│         📭                          │
│    가입한 그룹이 없습니다            │
│                                     │
│    [➕ 그룹 만들기] [🔍 그룹 찾기]  │
│                                     │
└─────────────────────────────────────┘
```

---

## 데이터 구조

### 1. 개인 랭킹 (✅ 완료)

```javascript
// users/{userId}
{
  profile: {
    nickname: "닉네임",
    nicknameLastUpdatedAt: timestamp
  },
  stats: {
    totalProblems: 100,
    totalScore: 8500,
    averageScore: 85.0,
    lastProblemSolvedAt: timestamp,
    daily: {
      "2025-11-17": { problems: 5, totalScore: 425, avgScore: 85.0 }
    },
    weekly: {
      "2025-W47": { problems: 15, totalScore: 1275, avgScore: 85.0 }
    },
    monthly: {
      "2025-11": { problems: 50, totalScore: 4250, avgScore: 85.0 }
    }
  }
}

// rankings/{userId} (성능 최적화용)
{
  userId: "user123",
  nickname: "닉네임",
  "daily.2025-11-17": { problems: 5, totalScore: 425, avgScore: 85.0 },
  "weekly.2025-W47": { problems: 15, totalScore: 1275, avgScore: 85.0 },
  "monthly.2025-11": { problems: 50, totalScore: 4250, avgScore: 85.0 },
  lastUpdatedAt: timestamp
}
```

### 2. 그룹 시스템 🆕

#### groups/{groupId} - 그룹 기본 정보

```javascript
{
  // 기본 정보
  groupId: "group_abc123",
  name: "감사왕 스터디",
  description: "매일 5문제 이상 풀기!",

  // 인증
  password: "hashed_password", // bcrypt 등으로 해싱

  // 소유권
  ownerId: "user123",
  createdAt: timestamp,

  // 멤버 정보
  memberCount: 5,
  maxMembers: 50, // 최대 인원

  // 규칙 (그룹장 설정)
  rules: {
    minDailyProblems: 5,      // 일일 최소 문제 수
    minWeeklyProblems: 30,    // 주간 최소 문제 수
    minMonthlyProblems: 120,  // 월간 최소 문제 수

    autoKickEnabled: true,    // 자동 강퇴 활성화
    kickGracePeriod: 3,       // 유예 기간 (일)
    kickCheckPeriod: "weekly" // 체크 주기: daily, weekly, monthly
  },

  // 그룹 상태
  isPublic: true, // 공개 그룹 (검색 가능)
  tags: ["감사", "회계감사", "스터디"], // 검색용 태그

  // 통계 (전체 멤버 집계)
  stats: {
    "daily.2025-11-17": {
      totalScore: 2125,  // 멤버 총점 합계
      problems: 25,      // 멤버 문풀 합계
      avgScore: 85.0,    // 멤버 평균점수 평균
      activeMemberCount: 5 // 활동 멤버 수
    },
    "weekly.2025-W47": { ... },
    "monthly.2025-11": { ... }
  }
}
```

#### groups/{groupId}/members/{userId} - 그룹 멤버 통계

```javascript
{
  // 멤버 정보
  userId: "user123",
  nickname: "닉네임",
  role: "owner", // owner, admin, member
  joinedAt: timestamp,

  // 그룹 내 통계 (개인 stats와 별도)
  "daily.2025-11-17": { problems: 5, totalScore: 425, avgScore: 85.0 },
  "weekly.2025-W47": { problems: 15, totalScore: 1275, avgScore: 85.0 },
  "monthly.2025-11": { problems: 50, totalScore: 4250, avgScore: 85.0 },

  // 규칙 준수 여부
  violations: {
    lastCheckedAt: timestamp,
    warningCount: 0, // 경고 횟수
    lastViolationDate: null,
    status: "good" // good, warning, violation
  },

  lastActiveAt: timestamp
}
```

#### groupRankings/{groupId} - 그룹별 랭킹 (성능 최적화용)

```javascript
{
  groupId: "group_abc123",
  name: "감사왕 스터디",
  memberCount: 5,
  ownerId: "user123",

  // 그룹 전체 통계 (flat structure)
  "daily.2025-11-17": {
    totalScore: 2125,
    problems: 25,
    avgScore: 85.0,
    activeMemberCount: 5
  },
  "weekly.2025-W47": { ... },
  "monthly.2025-11": { ... },

  lastUpdatedAt: timestamp
}
```

### 3. 고시반 시스템 🆕

#### classes/{classId} - 고시반 기본 정보

```javascript
{
  // 기본 정보
  classId: "class_xyz789",
  name: "2025년 1차 대비반",
  description: "2025년 1차 시험 대비 집중 학습반",

  // 인증
  password: "hashed_password",

  // 소유권
  ownerId: "user456",
  createdAt: timestamp,

  // 멤버 정보
  memberCount: 20,
  maxMembers: 100,

  // 고시반 특화 설정
  targetExamDate: "2025-03-15", // 목표 시험일

  // 규칙 (그룹보다 엄격)
  rules: {
    minDailyProblems: 10,
    minWeeklyProblems: 70,
    minMonthlyProblems: 300,

    autoKickEnabled: true,
    kickGracePeriod: 1, // 고시반은 유예 기간 짧음
    kickCheckPeriod: "daily", // 매일 체크

    // 고시반 추가 규칙
    attendanceRequired: true, // 출석 체크
    weeklyReportRequired: true // 주간 리포트 제출
  },

  // 고시반 상태
  isPublic: false, // 대부분 비공개
  tags: ["감사", "1차시험", "2025"],

  // 통계 (전체 멤버 집계)
  stats: {
    "daily.2025-11-17": {
      totalScore: 17000,
      problems: 200,
      avgScore: 85.0,
      activeMemberCount: 20,
      attendanceRate: 95.0 // 출석률
    },
    "weekly.2025-W47": { ... },
    "monthly.2025-11": { ... }
  }
}
```

#### classes/{classId}/members/{userId} - 고시반 멤버 통계

```javascript
{
  // 멤버 정보
  userId: "user456",
  nickname: "닉네임",
  role: "owner", // owner, admin, member
  joinedAt: timestamp,

  // 고시반 내 통계
  "daily.2025-11-17": { problems: 10, totalScore: 850, avgScore: 85.0 },
  "weekly.2025-W47": { problems: 70, totalScore: 5950, avgScore: 85.0 },
  "monthly.2025-11": { problems: 300, totalScore: 25500, avgScore: 85.0 },

  // 규칙 준수 여부
  violations: {
    lastCheckedAt: timestamp,
    warningCount: 0,
    lastViolationDate: null,
    status: "good"
  },

  // 고시반 특화 데이터
  attendance: {
    "2025-11-17": true,
    "2025-11-16": true,
    "2025-11-15": false
  },
  weeklyReports: {
    "2025-W47": {
      submitted: true,
      submittedAt: timestamp,
      content: "이번 주 학습 내용..."
    }
  },

  lastActiveAt: timestamp
}
```

#### classRankings/{classId} - 고시반별 랭킹 (성능 최적화용)

```javascript
{
  classId: "class_xyz789",
  name: "2025년 1차 대비반",
  memberCount: 20,
  ownerId: "user456",
  targetExamDate: "2025-03-15",

  // 고시반 전체 통계 (flat structure)
  "daily.2025-11-17": {
    totalScore: 17000,
    problems: 200,
    avgScore: 85.0,
    activeMemberCount: 20,
    attendanceRate: 95.0
  },
  "weekly.2025-W47": { ... },
  "monthly.2025-11": { ... },

  lastUpdatedAt: timestamp
}
```

### 4. 사용자-그룹/고시반 매핑

#### users/{userId}에 추가

```javascript
{
  // 기존 필드...

  // 그룹 멤버십
  groups: {
    "group_abc123": {
      role: "member",
      joinedAt: timestamp
    }
  },

  // 고시반 멤버십
  classes: {
    "class_xyz789": {
      role: "member",
      joinedAt: timestamp
    }
  }
}
```

---

## Phase 3.5: 그룹 시스템

### Phase 3.5.1: 랭킹 모달 탭 구조 재설계 ⏳

**목표**: 현재 단일 랭킹 모달을 3탭 구조로 변경

**작업**:
1. `index.html` 수정:
   - 메인 탭 추가: [🌍 전체] [👥 내 그룹] [🎓 내 고시반]
   - 서브 탭 추가: 그룹/고시반용 [그룹별/반별] [그룹내/반내]
   - 빈 상태 UI 추가

2. `rankingUI.js` 수정:
   - 탭 전환 로직
   - 현재 탭 상태 관리
   - 빈 상태 처리

3. `rankingCore.js` 확장:
   - 그룹/고시반 통계 조회 함수 준비 (placeholder)

**완료 조건**:
- 탭 클릭 시 UI 전환
- 빈 상태 정상 표시
- 기존 개인 랭킹 기능 정상 작동

---

### Phase 3.5.2: 그룹 기본 구조 (생성/가입/탈퇴)

**목표**: 그룹 생성, 가입, 탈퇴 기능

**작업**:
1. `groupCore.js` 생성:
   ```javascript
   - createGroup(name, description, password, rules)
   - joinGroup(groupId, password)
   - leaveGroup(groupId)
   - getMyGroups()
   - getGroupInfo(groupId)
   ```

2. `groupUI.js` 생성:
   - 그룹 생성 모달
   - 그룹 검색/가입 모달
   - 그룹 목록 표시

3. `index.html` 수정:
   - 그룹 관리 UI 추가

**완료 조건**:
- 그룹 생성 가능
- 비밀번호로 그룹 가입 가능
- 그룹 탈퇴 가능
- 내 그룹 목록 조회 가능

---

### Phase 3.5.3: 그룹별 랭킹 구현

**목표**: 그룹 간 경쟁 랭킹 표시

**작업**:
1. `rankingCore.js` 확장:
   ```javascript
   - updateGroupStats(groupId, userId, score) // 문제 풀 때마다 호출
   - getGroupRankings(period, criteria) // groupRankings 컬렉션 조회
   ```

2. `rankingUI.js` 수정:
   - "👥 내 그룹" > "🏆 그룹별" 탭 구현
   - 그룹 랭킹 리스트 렌더링

3. `grading.js` 수정:
   - 문제 풀이 후 그룹 통계 업데이트 추가

**완료 조건**:
- 그룹별 랭킹 정상 표시
- 문제 풀이 시 그룹 통계 자동 업데이트
- 내가 속한 그룹 강조 표시

---

### Phase 3.5.4: 그룹 내 랭킹 구현

**목표**: 그룹 멤버 간 경쟁 랭킹 표시

**작업**:
1. `rankingCore.js` 확장:
   ```javascript
   - getGroupMemberRankings(groupId, period, criteria)
   - getMyRankInGroup(groupId, period)
   ```

2. `rankingUI.js` 수정:
   - "👥 내 그룹" > "👤 그룹내" 탭 구현
   - 그룹 멤버 랭킹 리스트 렌더링
   - 내 순위 강조

**완료 조건**:
- 그룹 내 멤버 랭킹 정상 표시
- 내 순위 강조 표시
- 그룹 선택 가능 (여러 그룹 가입 시)

---

### Phase 3.5.5: 그룹장 권한 & 규칙

**목표**: 그룹장이 규칙 설정 및 자동 강퇴 기능

**작업**:
1. `groupCore.js` 확장:
   ```javascript
   - updateGroupRules(groupId, rules) // 그룹장만 가능
   - checkMemberViolations(groupId) // 정기 실행
   - kickMember(groupId, userId) // 그룹장/자동
   ```

2. `groupUI.js` 수정:
   - 그룹 설정 모달 (그룹장용)
   - 규칙 설정 UI
   - 멤버 관리 UI

3. Cloud Functions (선택적):
   - 정기 실행: 규칙 위반 체크 & 자동 강퇴
   - 또는 클라이언트에서 주기적 체크

**완료 조건**:
- 그룹장이 규칙 설정 가능
- 규칙 위반 시 경고 표시
- 유예 기간 후 자동 강퇴
- 멤버 수동 강퇴 가능 (그룹장)

---

## Phase 3.6: 고시반 시스템

### Phase 3.6.1: 고시반 기본 구조

**작업**: Phase 3.5.2와 동일하지만 고시반용
- `classCore.js` 생성
- `classUI.js` 생성
- 고시반 생성/가입/탈퇴

### Phase 3.6.2: 고시반별 랭킹 구현

**작업**: Phase 3.5.3과 동일하지만 고시반용
- `classRankings` 컬렉션 활용

### Phase 3.6.3: 고시반 내 랭킹 구현

**작업**: Phase 3.5.4와 동일하지만 고시반용
- 고시반 멤버 간 랭킹

### Phase 3.6.4: 고시반 특화 기능

**추가 기능**:
- 출석 체크
- 주간 리포트
- D-Day 카운터 (시험일까지)
- 진도 관리

---

## 구현 순서

### 우선순위 1 (현재 작업 중)
- ✅ Phase 3.1: 닉네임 설정
- ✅ Phase 3.2: 랭킹 코어
- ✅ Phase 3.3: 랭킹 UI
- ✅ Phase 3.4: rankings 컬렉션 최적화
- ⏳ **Phase 3.5.1: 랭킹 모달 탭 구조 재설계** ← 지금 여기

### 우선순위 2 (그룹 기본 기능)
- Phase 3.5.2: 그룹 생성/가입/탈퇴
- Phase 3.5.3: 그룹별 랭킹
- Phase 3.5.4: 그룹 내 랭킹

### 우선순위 3 (그룹 고급 기능)
- Phase 3.5.5: 그룹장 권한 & 규칙

### 우선순위 4 (고시반 시스템)
- Phase 3.6.1-3: 고시반 기본 + 랭킹
- Phase 3.6.4: 고시반 특화 기능

---

## 보류된 기능

다음 기능들은 현재 보류:
- ⏸️ 그룹 채팅/댓글 (소통)
- ⏸️ 그룹 뱃지/업적
- ⏸️ 그룹 대결 모드

---

## Firestore Security Rules (추가 필요)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 그룹 기본 정보: 로그인 사용자 읽기 가능, 그룹장만 수정
    match /groups/{groupId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
        get(/databases/$(database)/documents/groups/$(groupId)).data.ownerId == request.auth.uid;
      allow delete: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;
    }

    // 그룹 멤버: 그룹 멤버만 읽기, 본인 데이터만 수정
    match /groups/{groupId}/members/{userId} {
      allow read: if request.auth != null &&
        exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
      allow write: if request.auth != null && userId == request.auth.uid;
    }

    // 그룹 랭킹: 로그인 사용자 읽기 가능
    match /groupRankings/{groupId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // 고시반도 동일한 구조
    match /classes/{classId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null &&
        get(/databases/$(database)/documents/classes/$(classId)).data.ownerId == request.auth.uid;
      allow delete: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;
    }

    match /classes/{classId}/members/{userId} {
      allow read: if request.auth != null &&
        exists(/databases/$(database)/documents/classes/$(classId)/members/$(request.auth.uid));
      allow write: if request.auth != null && userId == request.auth.uid;
    }

    match /classRankings/{classId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```수정(최신 버전)
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper Functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Users Collection
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId);
    }

    // Rankings Collection
    match /rankings/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);
    }

    // Groups Collection
    match /groups/{groupId} {
      allow read: if isAuthenticated();
      
      allow create: if isAuthenticated()
        && request.resource.data.ownerId == request.auth.uid
        && request.resource.data.memberCount == 1;
      
      allow update: if isAuthenticated()
        && (resource.data.ownerId == request.auth.uid
            || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberCount', 'lastUpdatedAt']));
      
      allow delete: if isAuthenticated()
        && resource.data.ownerId == request.auth.uid;

      // Members Subcollection
      match /members/{userId} {
        
        // 🛑 [수정된 부분] 🛑
        // 기존: 같은 그룹 멤버만 읽기 허용 (exists(...))
        // 수정: 본인(isOwner)이거나 또는 같은 그룹 멤버이면 읽기 허용
        allow read: if isAuthenticated()
          && (isOwner(userId) // <-- 이 조건 추가: 본인 문서는 항상 읽기 허용
              || exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)));
        
        // 생성: 본인 또는 그룹장 (기존과 동일)
        allow create: if isAuthenticated()
          && (request.auth.uid == userId
              || get(/databases/$(database)/documents/groups/$(groupId)).data.ownerId == request.auth.uid);
        
        // 업데이트: 본인 또는 그룹장 (기존과 동일)
        allow update: if isAuthenticated()
          && (request.auth.uid == userId
              || get(/databases/$(database)/documents/groups/$(groupId)).data.ownerId == request.auth.uid);
        
        // 삭제: 본인 또는 그룹장 (기존과 동일)
        allow delete: if isAuthenticated()
          && (request.auth.uid == userId
              || get(/databases/$(database)/documents/groups/$(groupId)).data.ownerId == request.auth.uid);
      }
    }

    // Group Rankings Collection
    match /groupRankings/{groupId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated()
        && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
    }

    // University Verifications Collection (Phase 3.6)
    match /universityVerifications/{userId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId);
    }

    // University Rankings Collection (Phase 3.6)
    match /universityRankings/{university} {
      allow read: if isAuthenticated();
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
    // Default Deny All
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
---

## 참고사항

### 성능 최적화
- 그룹/고시반 통계는 별도 컬렉션(`groupRankings`, `classRankings`)에 flat structure로 저장
- 문제 풀이 시 일괄 업데이트: `users` → `rankings` → `groups/.../members` → `groupRankings` → `classes/.../members` → `classRankings`

### 데이터 일관성
- 문제 풀이 시 모든 통계는 동일한 점수로 업데이트
- 트랜잭션 사용 고려 (또는 실패 시 재시도)

### 확장성
- 그룹/고시반 최대 멤버 수 제한 (50명/100명)
- 사용자당 최대 가입 그룹/고시반 수 제한 고려

---

**작성일**: 2025-11-17
**작성자**: Claude (AI)
**버전**: 1.0
