# 단원별 문제풀이 기능 구현 계획

## 현재 구조 분석

### 기존 데이터 구조 (2025_hierarchical.json)
```json
{
  "examId": "2025완료 (2)",
  "cases": [
    {
      "caseId": "2025_Q1",
      "topic": "윤리기준과 독립성",
      "chapter": "2.0",  // <- 이미 chapter 필드 존재! (문자열, 소수점 허용)
      "subQuestions": [...]
    }
  ]
}
```

### 단원 매핑 (config.js의 CHAPTER_LABELS 참조)
```javascript
// js/config/config.js에 이미 정의됨
export const CHAPTER_LABELS = {
  1: "제1장 감사와 회계감사의 기본개념",
  2: "제2장 감사인의 의무, 책임 및 자격요건",
  3: "제3장 감사인의 독립성과 품질관리",
  4: "제1장 감사인의 선임",
  5: "제2장 감사계약",
  // ... 1~20까지 정의됨
};
```

### 현재 UI 흐름
```
renderExamMode()
  → renderYearSelection()  // 연도 카드 그리드
    → startExam(year)      // 연도별 시험 시작
      → renderExamPaper()  // 문제지 렌더링
```

---

## 구현 계획

### 1단계: 데이터 구조 확인 및 chapter 필드 표준화

**작업 내용:**
- `2024_hierarchical.json`, `2025_hierarchical.json`의 chapter 필드 현황 확인
- chapter 값이 문자열("2.0", "3", "10.5" 등)일 수 있으므로 **숫자 정렬 로직** 적용
  - 정렬 시 `parseFloat()` 사용하여 "1", "2", "10" 순서로 정렬 (문자열 정렬 오류 방지)

**chapter 정렬 함수 (신규):**
```javascript
// chapter 문자열을 숫자로 파싱하여 정렬
function sortByChapter(a, b) {
  const numA = parseFloat(a) || 0;
  const numB = parseFloat(b) || 0;
  return numA - numB;
}
```

### 2단계: examService.js - 단원별 데이터 조회 함수 추가

**새로운 함수:**
```javascript
// 모든 연도에서 특정 단원의 문제 추출 (연도순 정렬)
getQuestionsByChapter(chapter) {
  const questions = [];
  const sortedYears = Object.keys(this.examData).sort((a, b) => a - b); // 연도순

  for (const year of sortedYears) {
    const yearData = this.examData[year];
    yearData.forEach(exam => {
      exam.cases?.forEach(caseItem => {
        // chapter 비교 시 parseFloat로 숫자 비교
        if (parseFloat(caseItem.chapter) === parseFloat(chapter)) {
          questions.push({
            year,
            caseId: caseItem.caseId,
            topic: caseItem.topic,
            subQuestions: caseItem.subQuestions
          });
        }
      });
    });
  }
  return questions;
}

// 사용 가능한 단원 목록 조회
getAvailableChapters() {
  const chapters = new Map(); // chapter -> {name, questionCount, years: []}
  // 모든 연도의 모든 case에서 chapter 수집
  // CHAPTER_LABELS에서 단원명 가져오기
  return chapters;
}

// 단원별 점수 저장/조회
saveChapterScore(chapter, score, details)
getChapterScores(chapter)
getBestChapterScore(chapter)
clearChapterAnswers(chapter)
```

### 3단계: examUI.js - 모드 선택 UI 추가

**renderExamMode() 수정:**
```
renderExamMode()
  → renderModeSelection()  // 새로운 모드 선택 화면
    ├─ [연도별 풀이] → renderYearSelection() (기존)
    └─ [단원별 풀이] → renderChapterSelection() (신규)
```

**renderChapterSelection() 구현:**
- 단원별 카드 그리드 표시
- 각 카드에 단원명(CHAPTER_LABELS 참조), 문제 수, 출제 연도, 최고 점수, 응시 횟수 표시
- "시작하기" 버튼 클릭 시 해당 단원 문제만 추출하여 시험 시작

### 4단계: 단원별 시험 시작 함수

**startChapterExam(chapter) 구현:**
- 모든 연도에서 해당 단원 문제 수집
- **연도순 정렬** (기본값)
- 제한시간 계산 (문제 수 기반: 문제당 약 5분)
- renderExamPaper() 호출 (기존 함수 재사용, mode 파라미터 추가)

### 5단계: 점수 저장 로직 수정

**examService.js 수정:**
- `saveScore()` 함수에서 단원별 풀이 여부 체크
- 단원별 점수는 별도 키로 저장: `exam_chapter_${chapter}_scores`
- 단원별 답안 저장: `exam_chapter_${chapter}_answers`

---

## 수정 대상 파일

| 파일 | 수정 내용 |
|------|----------|
| `js/features/exam/data/*.json` | chapter 필드 현황 확인 (수정 필요시만) |
| `js/features/exam/examService.js` | 단원별 데이터 조회/점수 저장 함수 추가 |
| `js/features/exam/examUI.js` | 모드 선택 UI, 단원 선택 UI 추가, renderExamPaper 수정 |

---

## UI 레이아웃 (안)

### 모드 선택 화면
```
┌─────────────────────────────────────────┐
│  📝 기출문제 실전연습                    │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ 📅 연도별   │  │ 📚 단원별   │      │
│  │    풀이     │  │    풀이     │      │
│  │             │  │             │      │
│  │ 특정 연도의 │  │ 특정 단원을 │      │
│  │ 전체 문제를 │  │ 모든 연도에서│      │
│  │ 풀어봅니다  │  │ 집중 연습   │      │
│  │             │  │             │      │
│  │ [선택하기]  │  │ [선택하기]  │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
└─────────────────────────────────────────┘
```

### 단원 선택 화면
```
┌─────────────────────────────────────────────────────┐
│  📚 단원별 문제풀이          [← 뒤로가기]           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │ 제3장           │  │ 제7장           │          │
│  │ 감사인의 독립성 │  │ 위험평가절차와  │          │
│  │ 과 품질관리     │  │ 계획수립        │          │
│  │                 │  │                 │          │
│  │ 📊 8문제        │  │ 📊 12문제       │          │
│  │ 📅 2024, 2025   │  │ 📅 2024, 2025   │          │
│  │ 최고 85점       │  │ 미응시          │          │
│  │                 │  │                 │          │
│  │ [시작하기]      │  │ [시작하기]      │          │
│  └─────────────────┘  └─────────────────┘          │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

---

## 결정 사항 (사용자 확인 완료)

1. **chapter 번호 체계**: 문자열 허용 ("2.0", "10.5" 등), 정렬 시 parseFloat() 사용
2. **단원명 매핑**: `js/config/config.js`의 `CHAPTER_LABELS` 참조
3. **문제 정렬**: 연도순 정렬 (기본값)
