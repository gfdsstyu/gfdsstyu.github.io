사용자님의 예리한 분석대로, 현재의 **규칙 기반(Rule-based) 결함 수정**과 **머신러닝(ML) 도입**은 별개의 작업이 아니라 **순차적으로 적용되어야 할 하나의 프로젝트**입니다.

머신러닝이 도입되더라도 데이터가 쌓이기 전(Cold Start)까지는 '기본값'이 중요하며,  문제는 머신러닝으로도 해결하기 어려운 구조적 문제이기 때문입니다.

이 모든 내용을 통합하여, **AI 개발자에게 바로 던져줄 수 있는 [통합 상세 개발 기획서]**를 작성했습니다.

---

# 📝 제품 상세 기획서 (PRD): HLR 시스템 고도화 (Logic Fix + On-Device ML)

## 1. 개요 (Overview)

* **프로젝트명:** HLR 2.0 - Hybrid Review System
* **목표:**
1. **Phase 1 (즉시 개선):** 현재 알고리즘의 치명적 결함(단기 기억 루프 부재, 솜방망이 처벌, 과도한 초기 신뢰)을 수동 로직 수정으로 즉시 해결한다.
2. **Phase 2 (AI 도입):** TensorFlow.js를 도입하여, 유저 데이터가 쌓이면 선형 회귀 학습을 통해 개인화된 가중치로 자동 전환되게 한다.


* **핵심 원칙:** "데이터가 없을 땐 **엄격한 규칙**으로, 데이터가 쌓이면 **똑똑한 AI**로."

## 2. Phase 1: 알고리즘 로직 및 기본값 수정 (Rule-Based Fixes)

머신러닝 도입 전, 기본 로직 자체가 합리적으로 동작하도록 수정해야 합니다.

### 2.1. "오늘 틀린 문제" 긴급 구제 (Short-term Loop)

* **문제:** 일 때 HLR 확률이 100%가 되어 복습에서 제외됨.
* **수정 위치:** `js/features/review/reviewCore.js` 내부 `prioritizeTodayReview` 함수.
* **요구 사항:**
* HLR 확률 계산 **전(Pre-check)** 또는 **후(Post-check)**에 예외 처리를 추가한다.
* **조건:** `마지막 풀이 시간 < 24시간` **AND** `점수 < 60점` (혹은 `userReviewFlag` 설정 시).
* **동작:** 위 조건 만족 시 HLR 점수와 무관하게 `priority` 값을 극단적으로 낮춰(예: `-99999`) 최상단에 노출한다.



### 2.2. "초기 가중치" 현실화 (Realistic Defaults)

* **문제:** Bias 4.0(16일)은 너무 김, 오답 페널티 약함.
* **수정 위치:** `js/features/review/hlrDataset.js` 내부 `LocalHLRPredictor` 생성자.
* **요구 사항:** 기본 `modelWeights` 값을 아래와 같이 '회계사 수험생 모드'로 변경한다.
```javascript
this.modelWeights = {
  bias: 1.0,              // [수정] 4.0 -> 1.0 (기본 반감기: 2일)
  incorrect_count: -0.8,  // [수정] -0.12 -> -0.8 (오답 시 반감기 40~50% 감소)
  last_score: 0.02,       // [수정] 0.005 -> 0.02 (점수 영향력 강화)
  total_reviews: 0.15     // [유지] 반복 효과
  // ... 나머지 유지
};

```



---

## 3. Phase 2: On-Device ML 도입 (AI Tutor Implementation) ✅ 완료

**상태**: ✅ 구현 완료 (2026-01-16)
**구현 파일**: `js/features/review/trainHLR.js`

데이터가 충분히(예: 50건 이상) 쌓이면 위 기본값 대신 AI가 학습한 값을 사용합니다.

### 3.1. 기술 스택 (Tech Stack)

* **라이브러리:** [TensorFlow.js](https://www.tensorflow.org/js) (CDN 로드)
* **모델:** 다변수 선형 회귀 (Multivariate Linear Regression)
* 



### 3.2. 학습 모듈 구현 (`js/features/review/trainHLR.js`) ✅ 완료

* **기능:**
1. ✅ `buildHLRDataset()`으로 데이터 로드.
2. ✅ 데이터 유효성 검사 (최소 50건 이상).
3. ✅ TensorFlow.js 모델 생성 및 학습 (Epochs 50, Adam Optimizer).
4. ✅ 학습된 가중치()와 편향()을 `localStorage` (`hlr_learned_weights_v2`)에 저장.
5. ✅ **안전 장치(Safety Clamp):** 학습된 `bias`가 너무 크거나(>5.0), `incorrect_count`가 양수(+)가 되는 등 비정상적인 경우 학습 결과를 폐기하거나 제한 범위(Clamp)를 적용한다.
6. ✅ **Lazy Loading:** TensorFlow.js를 필요할 때만 로드하여 초기 페이지 로드 영향 최소화
7. ✅ **requestIdleCallback:** 백그라운드 학습으로 사용자 경험 비침해



### 3.3. 예측기 업그레이드 (`js/features/review/hlrDataset.js`) ✅ 완료

* **수정 위치:** `LocalHLRPredictor` 클래스.
* **요구 사항:**
* ✅ 생성자(`constructor`) 실행 시, `localStorage`에 학습된 가중치가 있는지 확인.
* ✅ 있으면: AI 가중치 사용.
* ✅ 없으면: Phase 1에서 수정한 '현실적 기본값' 사용.
* ✅ 가중치 검증 로직 (`validateWeights()`) 추가



### 3.4. 학습 트리거 ✅ 완료

**구현 위치**: `js/features/quiz/grading.js:484-488`

* **요구 사항:**
* ✅ 사용자가 문제를 풀 때마다 백그라운드에서 `trainHLRInBackground()`를 실행
* ✅ 사용자 경험을 해치지 않도록 `requestIdleCallback` 활용
* ✅ 데이터 부족 시 자동 스킵 (최소 50건, 10건 이상 신규 데이터 필요)
* ✅ `window.trainHLRInBackground` 전역 함수로 노출 (`js/app.js:493-498`)



---

## 4. 구현 가이드 (개발 프롬프트)

*(이 내용을 복사해서 AI 코딩 도구에게 전달하세요)*

> **역할:** 시니어 프론트엔드 개발자 겸 데이터 사이언티스트
> **목표:** 현재의 HLR 복습 시스템을 전면 개편하여 논리적 결함을 수정하고, 머신러닝 기능을 추가하시오.
> **작업 순서 및 요구사항:**
> **Step 1: 기본 로직 긴급 수정 (Phase 1)**
> 1. `js/features/review/hlrDataset.js`의 `LocalHLRPredictor` 기본 가중치를 수정하시오.
> * `bias`: 4.0 → 1.0
> * `incorrect_count`: -0.12 → -0.8
> * `last_score`: 0.005 → 0.02
> 
> 
> 2. `js/features/review/reviewCore.js`의 `prioritizeTodayReview` 함수를 수정하시오.
> * HLR 계산 로직 앞단에 **Short-term Loop**를 추가하시오.
> * 조건: `(오늘 품) AND (점수 < 60 OR 플래그 있음)`
> * 결과: `priority = -99999` (무조건 최상단 노출)
> 
> 
> 
> 
> **Step 2: TensorFlow.js ML 모듈 구현 (Phase 2)**
> 1. `index.html` 헤더에 TensorFlow.js CDN 스크립트를 추가하시오.
> 2. `js/features/review/trainHLR.js` 파일을 신규 생성하시오.
> * `buildHLRDataset` 데이터를 이용해 선형 회귀 모델을 학습시키는 `trainHLRModel` 함수 구현.
> * 학습된 가중치를 `localStorage`에 저장.
> * **필수:** 학습된 가중치가 논리적으로 타당한지 검증하는 로직 포함 (예: 오답 가중치는 반드시 음수여야 함).
> 
> 
> 3. `js/features/review/hlrDataset.js`를 수정하여, `localStorage`에 학습된 가중치가 있다면 그것을 우선 사용하도록 하시오.
> 4. `js/features/review/reviewCore.js`에 문제 풀이 저장 시점(또는 일정 주기)에 학습을 트리거하는 로직을 연결하시오.
> 
> 
> **주의사항:**
> * 기존 데이터 구조(`questionScores`, `solveHistory`)를 변경하지 마시오.
> * 코드는 모듈화되어야 하며, 에러 처리(데이터 부족 등)가 확실해야 합니다.
> 
> 

---

### 💡 기획 의도 설명 (개발자용 코멘트)

이 기획서는 **"안정성"과 "성장성"**을 동시에 잡기 위해 설계되었습니다.

1. **Phase 1**은 일종의 **지혈(First Aid)**입니다. AI가 학습하기 전이라도 사용자가 "어? 방금 틀린 거 왜 안 나와?"라며 앱을 삭제하는 일을 막아줍니다.
2. **Phase 2**는 **성장(Growth)**입니다. 유저 A는 오답에 민감하고, 유저 B는 둔감할 수 있습니다. 수동으로 맞춘 -0.8이라는 값도 누군가에겐 안 맞을 수 있습니다. 이때 ML이 개입하여 -0.8을 -1.5로 바꾸거나 -0.4로 튜닝해줍니다.
3. 특히 ** 문제는 ML로도 해결이 불가능한 수학적 특이점**이므로, Phase 1의 `prioritizeTodayReview` 수정(하드코딩된 예외 처리)은 ML 도입 후에도 반드시 유지되어야 합니다.

---

## ✅ 구현 완료 (2026-01-16)

**Phase 1 (Rule-Based Fixes)**: ✅ 완료
- 초기 가중치 현실화 (bias 1.0, incorrect_count -0.8)
- 단기 기억 루프 (1시간 임계값)
- 점수 가중치 적용
- 순환 참조 해결
- 오늘 틀린 문제 긴급 구제 (24h + 60점 미만)

**Phase 2 (On-Device ML)**: ✅ 완료
- TensorFlow.js 4.11.0 Lazy Loading (`index.html:25-55`)
- 학습 모듈 구현 (`js/features/review/trainHLR.js`)
- 예측기 업그레이드 (`js/features/review/hlrDataset.js`)
- 학습 트리거 통합 (`js/features/quiz/grading.js:484-488`)
- 전역 함수 노출 (`js/app.js:493-498`)

**상세 문서**:
- Phase 1 보고서: `docs/HLR_Phase1_Implementation.md`
- Phase 2 보고서: `docs/HLR_Phase2_Implementation.md`

**테스트 방법**:
```javascript
// 브라우저 콘솔에서 실행
// 학습 상태 확인
window.getTrainingStatus()

// 수동 학습 실행 (50건 이상 데이터 필요)
await window.trainHLRModel(false)

// 학습된 가중치 확인
JSON.parse(localStorage.getItem('hlr_learned_weights_v2'))

// 학습 데이터 초기화 (디버깅용)
window.clearLearnedWeights()
```