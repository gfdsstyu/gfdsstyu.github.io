# 🚀 KAM 기능 통합 가이드

## ✅ 개발 완료 항목

### 1. RAG 검색 시스템 (`js/services/ragSearch.js`)
- **기능**: questions.json에서 회계감사기준서 검색
- **특징**:
  - 키워드 기반 검색 알고리즘
  - TF-IDF 유사도 점수 계산
  - 불용어 필터링 및 전문 용어 가중치 적용
- **사용법**:
  ```javascript
  import ragSearchService from './js/services/ragSearch.js';

  await ragSearchService.initialize();
  const results = ragSearchService.searchByKeywords(['수익인식', '기간귀속'], 5);
  ```

### 2. KAM 핵심 로직 (`js/features/kam/kamCore.js`)
- **기능**: KAM 사례 평가 및 AI 피드백 생성
- **특징**:
  - Step 1: Why 평가 (선정 이유) - 구체성, 위험 요소, 재무적 중요성 평가
  - Step 2: How 평가 (감사 절차) - 연계성, 구체성, 필수 요소 평가
  - 금융감독원 모범사례 기준 적용
  - RAG 기반 관련 기준서 자동 인용
- **사용법**:
  ```javascript
  import kamEvaluationService from './js/features/kam/kamCore.js';

  await kamEvaluationService.initialize();
  const cases = kamEvaluationService.getAllCases(); // 26개 사례

  const whyResult = await kamEvaluationService.evaluateWhy(
    userAnswer,
    kamCase,
    apiKey,
    'gemini-2.5-flash'
  );
  ```

### 3. KAM UI (`js/features/kam/kamUI.js`)
- **기능**: 2단계 학습 흐름 UI
- **특징**:
  - 사례 목록 (산업별 그룹화)
  - Step 1: Why 입력 → AI 피드백 → 모범 답안
  - Step 2: How 입력 → 종합 평가
  - 최종 결과 화면 (관련 기준서 카드 포함)
  - 다크 모드 지원
- **사용법**:
  ```javascript
  import { renderKAMUI } from './js/features/kam/kamUI.js';

  const container = document.querySelector('#kam-container');
  renderKAMUI(container, apiKey, selectedModel);
  ```

### 4. 데이터 (`js/data/kamData.json`)
- **구조**:
  ```json
  {
    "num": 1,
    "management_assertion": "운송주선용역 매출의 발생사실 및 기간귀속",
    "industry": "서비스업",
    "size": "자산 2조원 이상",
    "situation": "연결그룹은 운송주선용역을 수행하고...",
    "reason": "우리는 연결그룹의 판단 오류나...",
    "kam": "운송주선용역 매출의 발생사실 및 기간귀속의 적정성",
    "procedures": [...]
  }
  ```
- **사례 수**: 26개 (산업별 다양)

### 5. 평가 기준 (`docs/KAM_EVALUATION_CRITERIA.md`)
- 금융감독원 모범사례 기반 평가 기준
- AI 프롬프트 가이드라인
- 주제별 핵심 키워드 매핑

---

## 🔧 메인 앱 통합 방법

### Step 1: app.js에 import 추가

`js/app.js` 파일의 모듈 임포트 섹션에 다음을 추가하세요:

```javascript
// 기능 - KAM 실전 훈련
import * as KAM from './features/kam/kamUI.js';
import ragSearchService from './services/ragSearch.js';
import kamEvaluationService from './features/kam/kamCore.js';
```

### Step 2: 상태 관리에 KAM 모드 추가

`js/core/stateManager.js` 파일의 `state` 객체에 추가:

```javascript
const state = {
  // ... 기존 상태들

  // KAM 모드
  isKAMMode: false,
  kamSelectedCase: null
};

// Getter/Setter 추가
export const getIsKAMMode = () => state.isKAMMode;
export const setIsKAMMode = (mode) => { state.isKAMMode = mode; };
export const getKAMSelectedCase = () => state.kamSelectedCase;
export const setKAMSelectedCase = (caseData) => { state.kamSelectedCase = caseData; };
```

### Step 3: Dashboard에 KAM 버튼 추가

`js/ui/dashboard.js` 또는 메인 UI 파일에 KAM 모드 진입 버튼 추가:

```javascript
export function mountDashboard(store) {
  const left = ensure('#v4-left');
  left.innerHTML = `
    <!-- 기존 대시보드 섹션들 -->

    <!-- KAM 실전 훈련 섹션 -->
    <section class="p-4 rounded-xl border bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 dark:border-purple-800">
      <h3 class="font-bold mb-2 text-purple-700 dark:text-purple-400">
        📝 KAM 사례형 실전 훈련
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
        금융감독원 모범사례 기준으로 핵심감사사항 작성 능력 향상
      </p>
      <button id="btn-start-kam"
        class="w-full px-4 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700
               dark:bg-purple-600 dark:hover:bg-purple-500 font-bold transition-colors">
        KAM 실전 연습 시작 →
      </button>
    </section>
  `;

  // 이벤트 리스너
  document.getElementById('btn-start-kam')?.addEventListener('click', () => {
    enterKAMMode();
  });
}

function enterKAMMode() {
  // KAM 모드로 전환
  StateManager.setIsKAMMode(true);

  // 퀴즈 영역 숨기고 KAM UI 표시
  const quizArea = document.querySelector('#quiz-area');
  quizArea.style.display = 'none';

  const kamContainer = document.createElement('div');
  kamContainer.id = 'kam-container';
  quizArea.parentNode.insertBefore(kamContainer, quizArea);

  // KAM UI 렌더링
  const apiKey = StateManager.getGeminiApiKey();
  const model = StateManager.getSelectedAiModel();

  KAM.renderKAMUI(kamContainer, apiKey, model);
}
```

### Step 4: 초기화 코드 추가

`js/app.js`의 초기화 함수에서 KAM 시스템 초기화:

```javascript
async function initializeApp() {
  // ... 기존 초기화 코드

  // KAM 시스템 초기화 (선택적, 지연 로딩 가능)
  try {
    await kamEvaluationService.initialize();
    await ragSearchService.initialize();
    console.log('✅ KAM System initialized');
  } catch (error) {
    console.warn('⚠️ KAM System initialization delayed:', error.message);
  }
}
```

---

## 📂 파일 구조

```
gfdsstyu.github.io-main/
├── docs/
│   ├── kam.md                        # 개발 명세서
│   ├── KAM.CSV                       # 원본 데이터 (26개 사례)
│   ├── KAM_EVALUATION_CRITERIA.md    # 평가 기준
│   └── KAM_INTEGRATION_GUIDE.md      # 이 파일
├── js/
│   ├── data/
│   │   └── kamData.json              # KAM 사례 데이터 (26개)
│   ├── services/
│   │   └── ragSearch.js              # RAG 검색 시스템 ✨
│   └── features/
│       └── kam/
│           ├── kamCore.js            # KAM 평가 로직 ✨
│           └── kamUI.js              # KAM UI 컴포넌트 ✨
└── questions.json                    # 회계감사기준서 DB (RAG용)
```

---

## 🎯 사용 시나리오

### 1. 사용자 플로우
1. **대시보드에서 "KAM 실전 연습 시작" 버튼 클릭**
2. **사례 목록 화면**: 산업별로 그룹화된 26개 사례 중 선택
3. **Step 1 (Why)**:
   - 상황 지문 읽기
   - 핵심감사사항 선정 이유 작성
   - AI 피드백 받기
   - 모범 답안 확인
4. **Step 2 (How)**:
   - 선정 이유 참고
   - 감사 절차 3가지 이상 작성
   - 최종 제출
5. **종합 결과 화면**:
   - Why (40%) + How (60%) 종합 점수
   - 상세 피드백
   - 모범 답안
   - 관련 기준서 카드 (RAG 검색 결과)
6. **재도전 또는 다른 사례 선택**

### 2. AI 평가 프로세스
1. **사용자 답안 분석**: 텍스트에서 키워드 추출
2. **RAG 검색**: questions.json에서 관련 기준서 검색
3. **Gemini API 호출**:
   - 시스템 프롬프트: 평가 기준 + 모범 답안 + RAG 결과
   - 사용자 쿼리: 사용자 답안
4. **피드백 생성**:
   - 점수 (0-100)
   - 잘한 점 / 개선할 점
   - 구체적 코멘트

---

## 🧪 테스트 방법

### 1. 기본 기능 테스트

브라우저 콘솔에서:

```javascript
// RAG 검색 테스트
import ragSearchService from './js/services/ragSearch.js';
await ragSearchService.initialize();
const results = ragSearchService.searchByKeywords(['수익인식', '기간귀속']);
console.log(results);

// KAM 평가 시스템 테스트
import kamEvaluationService from './js/features/kam/kamCore.js';
await kamEvaluationService.initialize();
const cases = kamEvaluationService.getAllCases();
console.log(`총 ${cases.length}개 사례`);
```

### 2. UI 테스트

1. 대시보드에서 KAM 버튼 클릭
2. 사례 선택 (예: 사례 1번 - 운송주선용역)
3. Step 1 작성:
   ```
   운송주선용역 매출 337,756백만원은 연결재무제표 매출의 35%를 차지하며,
   계약 조건에 따라 수익인식 시점이 다양하여 경영진의 유의적인 판단이 필요합니다.
   특수관계자 거래가 포함되어 있어 실재성 및 기간귀속의 왜곡표시 위험이 있습니다.
   ```
4. AI 피드백 확인
5. Step 2 작성:
   ```
   1. 운송주선용역 관련 내부통제의 설계 및 운영 효과성 테스트
   2. 표본추출을 통한 발생증빙과 수익인식시점 비교 대사
   3. 보고기간말 전후 거래의 기간귀속 적정성 확인
   ```
6. 최종 결과 확인

---

## ⚙️ 설정 및 요구사항

### API 키
- **Gemini API 키** 필요
- 모델 추천: `gemini-2.5-flash` (빠르고 정확)
- 대안: `gemini-2.5-pro` (더 정교한 평가)

### 브라우저 호환성
- Chrome/Edge: ✅ 완벽 지원
- Firefox: ✅ 지원
- Safari: ✅ 지원 (ES6 모듈)

### 데이터 로딩
- `kamData.json`: ~100KB (26개 사례)
- `questions.json`: ~600KB (기준서 DB)
- RAG 검색은 클라이언트 사이드에서 처리

---

## 🐛 문제 해결

### 1. KAM 데이터 로드 실패
**증상**: "Failed to load kamData.json"

**해결**:
```bash
# 파일 경로 확인
ls js/data/kamData.json

# 파일이 없으면 복사
cp docs/kamData.json js/data/kamData.json
```

### 2. RAG 검색 결과 없음
**증상**: 관련 기준서가 표시되지 않음

**해결**:
- questions.json 파일 확인
- 키워드 추출 로직 확인 (ragSearch.js의 `extractKeywords` 함수)

### 3. AI 평가 실패
**증상**: "Gemini API Error"

**해결**:
- API 키 유효성 확인
- 네트워크 연결 확인
- 콘솔에서 상세 오류 메시지 확인

---

## 📈 향후 개선 사항

### Phase 2 (선택적)
1. **Explorer 통합**: KAM 모드 트리 구조
   - 산업별 → 사례별 네비게이션
   - 진행 상황 표시

2. **성적 추적**:
   - KAM 사례별 점수 저장
   - 학습 진도 시각화

3. **더 많은 사례 추가**:
   - 현재 26개 → 50개 이상 확장

4. **사용자 답안 저장**:
   - localStorage에 답안 저장
   - 재작성 시 불러오기

---

## 📞 지원

문제가 발생하거나 질문이 있으면:
1. `docs/kam.md` 확인 (원본 명세서)
2. `docs/KAM_EVALUATION_CRITERIA.md` 확인 (평가 기준)
3. 브라우저 콘솔 확인 (오류 메시지)

---

**개발 완료일**: 2025-12-04
**개발자**: Claude (Anthropic)
**버전**: 1.0.0
