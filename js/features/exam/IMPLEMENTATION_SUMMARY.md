# Hierarchical Exam Data Structure - Implementation Summary

## 📋 Overview
새로운 계층형 데이터 구조를 지원하도록 기출문제 시스템을 전면 개편했습니다. **Scenario가 SubQuestion 레벨에 위치**하여, 각 소문항마다 독립적인 지문을 가질 수 있습니다.

## 🎯 핵심 변경사항

### 1. 데이터 구조 변경 (Schema v2.0)

#### 이전 구조 (Flat):
```json
{
  "id": "2025_Q1",
  "scenario": "공통 지문...",  // Case 레벨
  "questions": [...]
}
```

#### 새로운 구조 (Hierarchical):
```json
{
  "examId": "2025_KAM",
  "cases": [
    {
      "caseId": "2025_Q1",
      "topic": "윤리기준과 독립성",
      "subQuestions": [
        {
          "id": "Q1-1-1",
          "scenario": "각 문제마다 독립적인 지문",  // SubQuestion 레벨
          "question": "...",
          "answer": "...",
          "keywords": ["키워드1", "키워드2"],
          "explanation": "..."
        }
      ]
    }
  ]
}
```

### 2. 수정된 파일 목록

#### ✅ `js/features/exam/data/examSchema.js` (신규)
- TypeScript-style JSDoc 타입 정의
- 계층형 데이터 구조 문서화

#### ✅ `js/features/exam/data/2025_hierarchical.json` (신규)
- 메인 저장소의 `2025.json` 복사본
- 새로운 계층형 구조 사용

#### ✅ `js/features/exam/examData.js`
**변경 사항:**
- `loadHierarchicalData()` 함수 추가
- `getExam2025()`: 계층형 → Flat 구조로 변환 (하위 호환성)
- `getExamMetadata()`: 동적 계산으로 변경

**호환성 전략:**
```javascript
// question 객체에 scenario 필드 추가 (SubQuestion 레벨)
questions: caseItem.subQuestions.map(sq => ({
  id: sq.id,
  scenario: sq.scenario,  // ← 새로 추가!
  question: sq.question,
  // ...
}))
```

#### ✅ `js/features/exam/examService.js`
**변경 사항:**
- `buildGradingPrompt()`: scenario 소스 결정 로직 추가

```javascript
// Scenario 우선순위: question > examCase
const scenario = question.scenario || examCase.scenario || '지문 없음';

// Keywords 우선순위: question.keywords > evaluation_criteria
const evaluationCriteria = question.keywords && question.keywords.length > 0
  ? `[Check Point]\n${question.keywords.map(k => `• ${k}`).join('\n')}`
  : question.evaluation_criteria || '';
```

#### ✅ `js/features/exam/examUI.js`
**변경 사항:**

1. **renderExamPaper() - 시험 응시 화면**
   - Split View 제거
   - Per-Question Scenario Card 도입
   - Scenario 중복 감지 및 접이식 UI

```javascript
// 이전 문제와 scenario 비교
const isSameScenario = previousScenario && currentScenario === previousScenario;

// UI 분기:
// - 같은 scenario: 초록색 접힌 상태 "📄 지문 (이전과 동일)"
// - 다른 scenario: 주황색 펼쳐진 상태 "⚠️ 상황 변경"
```

2. **Scenario Toggle 기능**
   - 접기/펼치기 버튼 이벤트 리스너
   - 화살표 아이콘 회전 (▶/▼)

3. **renderResults() - 결과 화면**
   - 각 Question 카드에 Scenario 포함
   - 동일 Scenario는 축약 표시 "📄 지문 (이전과 동일)"
   - 다른 Scenario는 전체 표시 + "⚠️ 상황 변경" 뱃지

### 3. UX 개선사항

#### 시각적 피드백
- 🟢 **녹색**: 이전과 동일한 Scenario (접혀있음)
- 🟠 **주황색**: 새로운 Scenario (펼쳐짐) + 애니메이션
- 📄 **뱃지**: "지문 (이전과 동일)" / "⚠️ 상황 변경"

#### 모바일 대응
- 접이식 디자인으로 화면 공간 절약
- 반응형 레이아웃 (flex-wrap, gap)

## 📊 데이터 흐름

```
2025.json (메인 저장소)
    ↓
2025_hierarchical.json (워크트리)
    ↓
loadHierarchicalData()
    ↓
getExam2025() → Flat 구조로 변환
    ↓
examService.buildGradingPrompt() → question.scenario 사용
    ↓
examUI.renderExamPaper() → Per-Question Scenario 렌더링
```

## 🔧 호환성 보장

### 하위 호환성 (Backward Compatibility)
기존 flat 구조 데이터도 계속 작동합니다:

```javascript
// question.scenario가 없으면 examCase.scenario 사용
const scenario = question.scenario || examCase.scenario || '';
```

### 상위 호환성 (Forward Compatibility)
미래에 추가될 필드도 대비:

```javascript
// 옵셔널 체이닝과 기본값 활용
const keywords = question.keywords || [];
const explanation = question.explanation || '';
```

## 🎨 UI 변경 비교

### Before (Split View)
```
┌─────────────┬─────────────┐
│ Scenario    │ Questions   │
│ (Sticky)    │             │
│             │ Q1-1        │
│ 공통 지문   │ Q1-2        │
│             │ Q1-3        │
└─────────────┴─────────────┘
```

### After (Per-Question Cards)
```
┌─────────────────────────────┐
│ 📄 지문: "..."              │
│ ▼ 펼치기/접기               │
│                             │
│ 물음 Q1-1                   │
│ [답안 입력]                 │
└─────────────────────────────┘

┌─────────────────────────────┐
│ 📄 지문 (이전과 동일)       │
│ ▶ 접혀있음                  │
│                             │
│ 물음 Q1-2                   │
│ [답안 입력]                 │
└─────────────────────────────┘

┌─────────────────────────────┐
│ 📄 지문: "..." (다른 내용)  │
│ ⚠️ 상황 변경                │
│ ▼ 펼쳐짐                    │
│                             │
│ 물음 Q1-3                   │
│ [답안 입력]                 │
└─────────────────────────────┘
```

## ✅ 테스트 체크리스트

### 기능 테스트
- [ ] 시험 시작 시 데이터 로딩 확인
- [ ] Scenario 토글 (접기/펼치기) 동작 확인
- [ ] 동일 Scenario 감지 및 표시 확인
- [ ] 다른 Scenario 변경 시 주황색 하이라이트 확인
- [ ] 답안 자동 저장 정상 작동
- [ ] 채점 시 question.scenario 사용 확인
- [ ] 결과 화면에서 Scenario 표시 확인

### 호환성 테스트
- [ ] 기존 flat 구조 데이터로도 정상 작동
- [ ] scenario 없는 question 처리 확인

### UI/UX 테스트
- [ ] 모바일 반응형 확인
- [ ] 다크모드 색상 확인
- [ ] 애니메이션 부드러움 확인
- [ ] 긴 지문 스크롤 처리 확인

## 📝 추가 개선 사항 (Optional)

### 단기
1. CSS 애니메이션 polish
2. 접이식 transition 부드럽게
3. 모바일 탭 인터페이스 고려

### 중기
1. Scenario 북마크 기능
2. 지문 하이라이트 기능
3. 문제 간 scenario 비교 뷰

### 장기
1. Scenario 기반 필터링
2. 유사 scenario 문제 추천
3. scenario 난이도 분석

## 🚀 배포 준비사항

1. **워크트리 → 메인 저장소 병합**
   ```bash
   git add .
   git commit -m "feat: Implement hierarchical exam data structure with per-question scenarios"
   git push origin peaceful-lewin
   ```

2. **메인 저장소 업데이트**
   - `D:\gfdsstyu.github.io\js\features\exam\data\2025.json` 사용 중
   - 이미 올바른 계층형 구조 사용 중 ✅

3. **프로덕션 배포 전 확인**
   - [ ] 로컬에서 전체 기능 테스트
   - [ ] 기존 사용자 데이터 마이그레이션 불필요 (LocalStorage 호환)
   - [ ] 성능 테스트 (대용량 JSON 로딩)

## 📖 참고 문서

- [examSchema.js](./data/examSchema.js) - 타입 정의
- [UI_UPDATE_PLAN.md](./UI_UPDATE_PLAN.md) - UI 설계 문서
- [2025_hierarchical_sample.json](./data/2025_hierarchical_sample.json) - 샘플 데이터

## 🎉 완료!
계층형 데이터 구조 지원이 완료되었습니다. 이제 각 SubQuestion마다 독립적인 Scenario를 가질 수 있으며, 사용자는 시각적 피드백을 통해 상황 변경을 쉽게 인지할 수 있습니다.
