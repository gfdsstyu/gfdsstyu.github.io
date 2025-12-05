# 🚀 KAM 기능 빠른 시작 가이드

## ✅ 설치 완료!

KAM (핵심감사사항) 사례형 실전 훈련 기능이 성공적으로 통합되었습니다!

---

## 📦 개발 완료 항목

### 1. 핵심 모듈
- ✅ **RAG 검색 시스템** (`js/services/ragSearch.js`)
- ✅ **KAM 평가 로직** (`js/features/kam/kamCore.js`)
- ✅ **KAM UI 컴포넌트** (`js/features/kam/kamUI.js`)
- ✅ **통합 헬퍼** (`js/features/kam/kamIntegration.js`)

### 2. 데이터
- ✅ **KAM 사례 데이터** (`js/data/kamData.json`) - 26개 사례
- ✅ **평가 기준** (`docs/KAM_EVALUATION_CRITERIA.md`)

### 3. 상태 관리
- ✅ `isKAMMode`, `kamSelectedCase` 상태 추가
- ✅ Getter/Setter 함수 추가

### 4. 전역 함수
- ✅ `window.enterKAMMode()` - KAM 모드 진입
- ✅ `window.exitKAMMode()` - KAM 모드 종료
- ✅ `window.getKAMStats()` - 통계 조회

---

## 🎮 사용 방법

### 방법 1: 브라우저 콘솔에서 테스트

브라우저 개발자 도구(F12)를 열고 콘솔에서:

```javascript
// KAM 모드 진입
enterKAMMode();

// KAM 통계 확인
getKAMStats();
// { totalCases: 26, industries: 8, casesByIndustry: {...} }

// KAM 모드 종료
exitKAMMode();
```

### 방법 2: HTML에 버튼 추가

`index.html` 파일의 적절한 위치에 버튼 추가:

```html
<!-- KAM 시작 버튼 (예: 대시보드 영역) -->
<button onclick="enterKAMMode()"
        class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg">
  📝 KAM 사례형 실전 훈련 시작
</button>
```

### 방법 3: Dashboard에 통합 (권장)

`js/ui/dashboard.js` 파일을 수정하여 대시보드에 KAM 섹션 추가:

```javascript
export function mountDashboard(store) {
  const left = ensure('#v4-left');
  left.innerHTML = `
    <!-- 기존 섹션들 -->

    <!-- KAM 섹션 추가 -->
    <section class="p-4 rounded-xl border bg-gradient-to-r from-purple-50 to-indigo-50
                    dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200 dark:border-purple-800">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-2xl">📝</span>
        <h3 class="font-bold text-purple-700 dark:text-purple-400">KAM 사례형 실전 훈련</h3>
      </div>
      <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
        금융감독원 모범사례 기준으로 핵심감사사항 작성 능력 향상
      </p>
      <button id="btn-start-kam"
        class="w-full px-4 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700
               font-bold transition-colors">
        KAM 실전 연습 시작 →
      </button>
    </section>
  `;

  // 이벤트 리스너
  document.getElementById('btn-start-kam')?.addEventListener('click', () => {
    window.enterKAMMode();
  });
}
```

---

## 🧪 테스트 체크리스트

### 1. 기본 기능 테스트

```javascript
// ✅ 1. RAG 검색 시스템
await ragSearchService.initialize();
const results = ragSearchService.searchByKeywords(['수익인식', '기간귀속'], 5);
console.log('검색 결과:', results);

// ✅ 2. KAM 데이터 로드
await kamEvaluationService.initialize();
const cases = kamEvaluationService.getAllCases();
console.log(`총 ${cases.length}개 KAM 사례 로드됨`);

// ✅ 3. 특정 사례 조회
const case1 = kamEvaluationService.getCaseByNum(1);
console.log('사례 1:', case1.kam);

// ✅ 4. 산업별 필터링
const manufacturing = kamEvaluationService.getCasesByIndustry('제조업');
console.log(`제조업 사례: ${manufacturing.length}개`);
```

### 2. UI 테스트

1. **KAM 모드 진입**
   ```javascript
   enterKAMMode();
   ```
   - ✅ 로딩 오버레이 표시
   - ✅ KAM 컨테이너 생성
   - ✅ 퀴즈 영역 숨김
   - ✅ 사례 목록 표시

2. **사례 선택**
   - ✅ 산업별 그룹화 확인
   - ✅ 사례 카드 클릭 → Step 1 화면 이동

3. **Step 1: Why 작성**
   - ✅ 상황 지문 표시
   - ✅ 텍스트 입력
   - ✅ 제출 → AI 평가
   - ✅ 피드백 표시
   - ✅ 모범 답안 표시

4. **Step 2: How 작성**
   - ✅ 힌트 (선정 이유) 표시
   - ✅ 감사 절차 입력
   - ✅ 최종 제출
   - ✅ 종합 평가 표시

5. **최종 결과**
   - ✅ 종합 점수 (Why 40% + How 60%)
   - ✅ 상세 피드백
   - ✅ 모범 답안
   - ✅ 관련 기준서 카드
   - ✅ 재도전/목록으로 버튼

6. **KAM 모드 종료**
   ```javascript
   exitKAMMode();
   ```
   - ✅ KAM 컨테이너 제거
   - ✅ 퀴즈 영역 복원

---

## 📊 KAM 사례 데이터 구조

총 **26개** 사례, **8개** 산업군:

```javascript
getKAMStats();
/*
{
  totalCases: 26,
  industries: 8,
  casesByIndustry: {
    "서비스업": 1,
    "농림어업": 1,
    "제조업(수주산업)": 1,
    "건설업": 1,
    "도소매업": 1,
    "제조업": 10,
    "숙박 및 음식료업": 1,
    "금융 및 보험업": 3
  }
}
*/
```

---

## 🔧 필수 요구사항

### 1. Gemini API 키
- KAM 평가를 위해 **Gemini API 키**가 필요합니다
- 설정 → API 키 메뉴에서 등록
- 권장 모델: `gemini-2.5-flash` (빠르고 정확)

### 2. 브라우저
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅

### 3. 데이터 파일
- ✅ `js/data/kamData.json` (~100KB)
- ✅ `questions.json` (~600KB)

---

## 🐛 문제 해결

### 문제: "API 키를 먼저 설정해주세요"
**해결**: 설정 메뉴에서 Gemini API 키를 등록하세요.

### 문제: "Failed to load kamData.json"
**해결**:
```bash
# 파일 경로 확인
ls js/data/kamData.json

# 파일이 없으면 복사
cp docs/kamData.json js/data/kamData.json
```

### 문제: RAG 검색 결과 없음
**해결**: questions.json 파일 경로 확인
```bash
ls questions.json
```

### 문제: AI 평가 실패
**해결**:
1. API 키 유효성 확인
2. 네트워크 연결 확인
3. 브라우저 콘솔에서 오류 메시지 확인

---

## 📈 다음 단계 (선택 사항)

### Phase 2: 추가 기능
1. **Explorer 통합**
   - KAM 전용 트리 네비게이션
   - 산업별 → 사례별 탐색

2. **성적 추적**
   - KAM 사례별 점수 저장
   - 학습 진도 시각화

3. **더 많은 사례**
   - 26개 → 50개 이상 확장

4. **답안 저장**
   - localStorage에 사용자 답안 저장
   - 재작성 시 불러오기

---

## 📞 지원

### 문서
- 📘 [KAM 통합 가이드](./KAM_INTEGRATION_GUIDE.md)
- 📘 [평가 기준](./KAM_EVALUATION_CRITERIA.md)
- 📘 [개발 명세](./kam.md)

### 콘솔 명령어
```javascript
// 현재 상태 확인
StateManager.getState();

// KAM 모드 확인
StateManager.getIsKAMMode();

// 선택된 사례 확인
StateManager.getKAMSelectedCase();

// 통계
getKAMStats();
```

---

## ✨ 기능 하이라이트

### 1. RAG (검색 증강 생성)
- questions.json에서 관련 기준서 자동 검색
- 키워드 기반 유사도 계산
- AI 피드백에 기준서 인용

### 2. 2단계 학습 흐름
- **Step 1 (Why)**: 선정 이유 작성 → 피드백
- **Step 2 (How)**: 감사 절차 작성 → 종합 평가

### 3. 금감원 모범사례 기준
- 구체성, 연계성, 명확성 평가
- 필수 요소 체크리스트
- 실무 중심 피드백

### 4. 다크 모드 지원
- 앱 전체 테마와 동기화
- Tailwind CSS 스타일 적용

---

**개발 완료**: 2025-12-04
**버전**: 1.0.0
**개발자**: Claude (Anthropic)

🎉 **즐거운 학습 되세요!**
