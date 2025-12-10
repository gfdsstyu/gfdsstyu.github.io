# Exam UI Update Plan - SubQuestion-Level Scenario Support

## 목표
새로운 계층형 데이터 구조에서 **각 SubQuestion이 독립적인 Scenario를 가질 수 있도록** UI를 업데이트합니다.

## 현재 구조의 문제점
- ❌ 좌측 패널에 Case 레벨의 scenario를 sticky로 고정 표시
- ❌ 모든 questions가 동일한 scenario를 공유한다고 가정
- ❌ Q1-1은 Scenario A, Q1-2는 Scenario B인 경우 대응 불가

## 새로운 UX 전략

### 옵션 1: Per-Question Scenario Card (권장)
**각 Question 카드에 Scenario를 포함시키고, 동일 Scenario는 접이식으로 처리**

```
┌─────────────────────────────────────┐
│ Case 1: 윤리기준과 독립성            │
├─────────────────────────────────────┤
│ ┌─ Question Q1-1-1 ─────────────┐  │
│ │ 📄 Scenario:                   │  │
│ │ "다음은 윤리기준과 품질관리..."  │  │
│ │ [펼치기/접기 버튼]              │  │
│ │                                 │  │
│ │ 📝 Question:                    │  │
│ │ "(물음 1) A 상황..."           │  │
│ │                                 │  │
│ │ ✍️ 답안 작성:                   │  │
│ │ [textarea]                      │  │
│ └─────────────────────────────────┘  │
│                                       │
│ ┌─ Question Q1-1-2 ─────────────┐  │
│ │ 📄 Scenario: (동일)           │  │
│ │ [접혀있음 - 클릭하여 펼치기]   │  │
│ │                                 │  │
│ │ 📝 Question:                    │  │
│ │ "(물음 1) B 상황..."           │  │
│ │ ...                             │  │
│ └─────────────────────────────────┘  │
└─────────────────────────────────────┘
```

**장점:**
- ✅ 각 Question이 독립적인 Scenario를 가질 수 있음
- ✅ 동일 Scenario 반복 시 접이식으로 공간 절약
- ✅ 모바일에서도 자연스러운 UX
- ✅ Scenario 변경 시 시각적 하이라이트 가능

**단점:**
- 화면 길이가 길어질 수 있음 (접이식으로 완화)

### 옵션 2: Dynamic Left Panel
**좌측 패널을 유지하되, 현재 보고 있는 Question의 Scenario를 동적으로 표시**

```
┌──────────────┬──────────────────────┐
│ 📄 Scenario  │ 📝 Questions         │
│ (Dynamic)    │                      │
│              │ ┌─ Q1-1-1 ──────┐   │
│ "현재 보고   │ │ (물음 1) A...  │ ← 이 Question을 보면
│  있는        │ │ [답안 입력]    │   좌측에 해당 Scenario 표시
│  Question의  │ └────────────────┘   │
│  Scenario"   │                      │
│              │ ┌─ Q1-1-2 ──────┐   │
│ [다음으로    │ │ (물음 1) B...  │ ← 이 Question을 보면
│  이동 시     │ │ [답안 입력]    │   좌측 Scenario가 변경
│  변경됨]     │ └────────────────┘   │
└──────────────┴──────────────────────┘
```

**장점:**
- ✅ 기존 Split View 레이아웃 유지
- ✅ 화면 공간 효율적

**단점:**
- ❌ Scroll 이벤트 감지 필요 (복잡도 증가)
- ❌ 사용자가 혼란스러울 수 있음 (왜 지문이 바뀌지?)

## 권장 사항: 옵션 1 (Per-Question Scenario Card)

### 구현 세부사항

#### 1. Scenario 중복 감지 로직
```javascript
function renderQuestionWithScenario(question, previousQuestion) {
  const isSameScenario = previousQuestion &&
    question.scenario === previousQuestion.scenario;

  return `
    <div class="question-card">
      ${isSameScenario ? `
        <!-- 접혀있는 Scenario -->
        <button class="scenario-toggle collapsed"
                data-scenario-id="${generateScenarioHash(question.scenario)}">
          📄 지문 (이전과 동일) - 클릭하여 펼치기
        </button>
        <div class="scenario-content hidden">
          ${question.scenario}
        </div>
      ` : `
        <!-- 새로운 Scenario (펼쳐진 상태) -->
        <div class="scenario-header ${!previousQuestion ? 'first' : 'changed'}">
          <span class="badge">📄 새로운 지문</span>
          ${!previousQuestion ? '' : '<span class="badge-warning">⚠️ 상황 변경</span>'}
        </div>
        <div class="scenario-content">
          ${question.scenario}
        </div>
      `}

      <!-- Question -->
      <div class="question-text">${question.question}</div>

      <!-- Answer Input -->
      <textarea>...</textarea>
    </div>
  `;
}
```

#### 2. 시각적 피드백
- **첫 번째 Question**: 일반 테두리 (회색)
- **Scenario 변경**: 주황색 테두리 + "⚠️ 상황 변경" 뱃지
- **Scenario 동일**: 녹색 접이식 버튼 "📄 지문 (이전과 동일)"

#### 3. CSS 애니메이션
```css
.scenario-changed {
  border-left: 4px solid #f97316; /* orange */
  animation: pulse-border 2s ease-in-out;
}

@keyframes pulse-border {
  0%, 100% { border-color: #f97316; }
  50% { border-color: #fb923c; }
}
```

## 다음 단계
1. ✅ examData.js 업데이트 완료
2. ✅ examService.js 업데이트 완료
3. 🔄 examUI.js - renderExamPaper 함수 리팩토링
4. ⏳ CSS 스타일 추가
5. ⏳ 모바일 반응형 테스트
6. ⏳ 실제 데이터로 통합 테스트
