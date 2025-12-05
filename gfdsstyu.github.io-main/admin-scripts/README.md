# 랭킹 스냅샷 생성 스크립트

## 📋 개요

이 스크립트는 **올인원 스냅샷 기반 랭킹 시스템**을 위해 6시간마다 실행되어야 합니다.

### 작동 원리
1. `rankings` 컬렉션의 모든 사용자 데이터 (2,300명)를 읽습니다
2. 핵심 데이터 (닉네임, 점수)만 추출하여 JSON으로 압축합니다
3. `ranking_cache` 컬렉션에 단일 문서로 저장합니다

### 효과
- **서버 비용**: 무료 한도 내 (일일 9,200회 읽기만 발생)
- **클라이언트 성능**: 탭 전환 시 서버 통신 0회, 즉시 응답
- **사용자 경험**: 로딩 없이 부드러운 랭킹 탐색

---

## 🚀 초기 설정 (1회만 수행)

### 1단계: Firebase 서비스 계정 키 다운로드

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. **프로젝트 설정 (⚙️)** → **서비스 계정** 탭
4. **새 비공개 키 생성** 버튼 클릭
5. 다운로드한 JSON 파일을 `admin-scripts/serviceAccountKey.json`으로 저장

```bash
# 파일 위치 확인
ls admin-scripts/serviceAccountKey.json
```

**⚠️ 중요**: 이 파일은 **절대 Git에 커밋하지 마세요!** (.gitignore에 이미 추가됨)

### 2단계: 의존성 설치

```bash
cd admin-scripts
npm install
```

---

## 💻 실행 방법

### 수동 실행 (테스트용)

```bash
cd admin-scripts
node generate-ranking-snapshot.js
```

또는

```bash
npm run snapshot
```

### 실행 결과 예시

```
🚀 랭킹 스냅샷 생성 시작...
⏰ 실행 시각: 2025-01-24T12:00:00.000Z
📖 rankings 컬렉션 읽기 중...
✅ 총 2300명의 사용자 데이터 발견
💾 ranking_cache에 스냅샷 저장 중...
✅ 스냅샷 생성 완료!
   - 사용자 수: 2300명
   - 데이터 크기: 약 345.67 KB

🎉 작업 완료!
```

---

## ⏰ 자동화 설정 (권장)

스냅샷은 **6시간마다** 자동으로 생성되어야 합니다.

### 방법 1: cron (Linux/Mac)

```bash
# cron 작업 편집
crontab -e

# 6시간마다 실행 (0시, 6시, 12시, 18시)
0 */6 * * * cd /절대경로/gfdsstyu.github.io/admin-scripts && node generate-ranking-snapshot.js >> /tmp/ranking-snapshot.log 2>&1
```

### 방법 2: Cloud Functions (서버리스 - 권장)

Firebase Cloud Functions로 완전 자동화할 수 있습니다.

아래 `functions/index.js` 파일을 참고하세요.

---

## 🔍 모니터링

### Firestore에서 확인

1. Firebase Console → Firestore Database
2. `ranking_cache` 컬렉션 열기
3. `snapshot` 문서 확인
4. `generatedAt` 필드로 최신 생성 시각 확인

### 로그 확인

```bash
# cron 로그 확인 (Linux)
tail -f /tmp/ranking-snapshot.log
```

---

## 📊 비용 시뮬레이션

### 일일 Firestore 읽기 횟수

| 항목 | 횟수 |
|------|------|
| 스크립트 실행 (6시간마다 4회) | 2,300 × 4 = **9,200회** |
| 사용자 스냅샷 다운로드 (DAU 1,500명) | **1,500회** |
| **총합** | **10,700회** |

- **무료 한도**: 50,000회/일
- **사용률**: 21%
- **초과 비용**: $0 (완전 무료)

---

## 🛠 문제 해결

### "serviceAccountKey.json not found" 오류

→ Firebase Console에서 서비스 계정 키를 다운로드하여 `admin-scripts/` 폴더에 저장하세요.

### "Permission denied" 오류

→ Firebase 프로젝트의 서비스 계정에 **Cloud Firestore 편집자** 권한이 있는지 확인하세요.

### 스냅샷 크기가 너무 큼

→ 현재 설계상 2,300명 기준 약 300-500KB로 매우 작습니다. 만약 더 크다면 불필요한 필드가 포함되었는지 확인하세요.

---

## 📝 다음 단계

이 스크립트를 성공적으로 실행했다면:

1. ✅ 클라이언트는 자동으로 `ranking_cache/snapshot`을 읽습니다
2. ✅ 탭 전환 시 서버 통신 없이 즉시 응답합니다
3. ✅ 6시간마다 자동으로 스냅샷이 갱신됩니다

**Cloud Functions로 완전 자동화**를 원하시면 `functions/` 폴더의 설정을 참고하세요.
