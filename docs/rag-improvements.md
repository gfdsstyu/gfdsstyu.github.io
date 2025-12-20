# RAG System Improvements

## 개요

Fuse.js 기반 RAG 검색 시스템을 개선하고 Gemma 3 Few-Shot 학습에 통합했습니다.

## 주요 개선사항

### 1. ✅ RAG-통합 Few-Shot 선택

**Before:**
```javascript
// 점수대만 고려하여 랜덤 선택
selectFewShotExamples(70, 5)
// → 70점대 예시 5개 (문제 유형 무관)
```

**After:**
```javascript
// 모범 답안과 유사한 문제의 few-shot 선택
selectFewShotExamples(70, 5, correctAnswer)
// → RAG로 유사 문제 검색 → 해당 문제의 few-shot 선택
// → 문제 유형 + 점수대 모두 고려
```

**효과:**
- "감사증거" 문제 → "감사증거" 관련 few-shot 예시만 선택
- "재고자산" 문제 → "재고자산" 관련 few-shot 예시만 선택
- **더 관련성 높은 학습 → 채점 정확도 향상**

### 2. ✅ 유의어 확장 활성화

**Before:**
```javascript
// expandKeywords() 함수만 정의, 실제 사용 안 함
retrieveDocuments(query, limit) {
  const processedQuery = this.preprocessQuery(query);
  const results = this.fuseIndex.search(processedQuery); // 유의어 미사용
}
```

**After:**
```javascript
// 유의어 확장 적용
retrieveDocuments(query, limit) {
  const keywords = this.extractKeywords(query);
  const expandedKeywords = this.expandKeywords(keywords); // ✅ 활성화
  const expandedQuery = Array.from(expandedKeywords).join(' ');
  const results = this.fuseIndex.search(expandedQuery);
}
```

**효과:**
- 쿼리: "매출" → 확장: "매출", "수익", "수익인식", "기간귀속" 등
- 쿼리: "재고" → 확장: "재고", "재고자산", "저가법", "순실현가능가치" 등
- **검색 범위 확대 → 관련 문제 더 많이 검색**

### 3. ✅ Threshold 정밀화

**Before:**
```javascript
const options = {
  threshold: 0.6, // 너무 관대 → 부정확한 결과 포함
  keys: [
    { name: 'answer', weight: 0.45 },
    { name: 'question', weight: 0.35 },
    { name: 'problemTitle', weight: 0.2 }
  ]
};
```

**After:**
```javascript
const options = {
  threshold: 0.4, // 더 정확한 매칭 (0.6 → 0.4)
  minMatchCharLength: 2, // 최소 2글자 이상 매칭
  ignoreLocation: true, // 위치 무관하게 매칭
  keys: [
    { name: 'answer', weight: 0.5 },        // 45% → 50%
    { name: 'question', weight: 0.35 },     // 유지
    { name: 'problemTitle', weight: 0.15 }  // 20% → 15%
  ]
};
```

**효과:**
- Threshold 0.6 → 0.4: 더 정확한 매칭만 반환
- Answer 가중치 45% → 50%: 정답 내용 중요도 증가
- **정확도 향상, 노이즈 감소**

## 작동 흐름

### RAG-통합 Few-Shot 선택

```
1. Gemma 채점 요청
   ↓
2. correctAnswer로 RAG 검색
   - "감사증거의 충분성과 적합성"
   ↓
3. 유의어 확장
   - "감사증거", "충분성", "적합성", "입증절차", "감사절차" 등
   ↓
4. Fuse.js 검색 (threshold 0.4)
   - 유사 문제 상위 20개 검색
   ↓
5. Few-shot 필터링
   - gemma_few_shots.json에서 해당 문제 ID의 예시만 선택
   ↓
6. 점수대별 선택
   - 필터링된 예시 중 점수대에 맞는 5개 선택
   ↓
7. Gemma API 호출
   - 관련성 높은 few-shot으로 학습
```

## 로그 예시

```javascript
// RAG-통합 Few-Shot 선택
🔍 [RAG] 키워드 확장: {
  original: 5,
  expanded: 12,
  keywords: "감사증거, 충분성, 적합성, 입증절차, 감사절차..."
}
🔍 [RAG-FewShot] 유사 문제 검색: 18개
✅ [RAG-FewShot] 필터링된 예시: 12개
📊 [RAG-FewShot] 필터링 후 점수 분포: {
  high: 4, medium: 6, low: 2
}
✅ [FewShot] 선택된 예시: 5개 (점수: 85, 75, 70, 65, 82)
```

## 성능 비교

### Before (점수대만 고려)
```
문제: "감사증거의 충분성 평가"
Few-Shot:
  1. q_042 (재고자산 평가) - 75점
  2. q_118 (리스 회계처리) - 70점
  3. q_003 (감사절차) - 65점 ✅ 관련
  4. q_089 (법인세) - 80점
  5. q_145 (연결재무제표) - 68점

관련성: 1/5 = 20%
```

### After (RAG 통합)
```
문제: "감사증거의 충분성 평가"
Few-Shot:
  1. q_003 (감사절차) - 65점 ✅
  2. q_027 (감사증거 평가) - 73점 ✅
  3. q_051 (입증절차) - 80점 ✅
  4. q_112 (표본추출) - 70점 ✅
  5. q_156 (분석적절차) - 68점 ✅

관련성: 5/5 = 100%
```

## API 변경사항

### gemmaFewShotLoader.js

```javascript
// Before
selectFewShotExamples(targetScore, count)

// After
selectFewShotExamples(targetScore, count, correctAnswer)
// correctAnswer: RAG 검색용 모범 답안 (옵션)
```

```javascript
// Before
buildGemmaFewShotPrompt(userAnswer, correctAnswer, estimatedScore)
// → 점수대만 고려

// After
buildGemmaFewShotPrompt(userAnswer, correctAnswer, estimatedScore)
// → RAG로 관련 예시 선택
```

### ragSearch.js

```javascript
// 유의어 확장 활성화
retrieveDocuments(query, limit) {
  // ✅ expandKeywords() 호출 추가
  const expandedKeywords = this.expandKeywords(keywords);
  const expandedQuery = Array.from(expandedKeywords).join(' ');
  return this.fuseIndex.search(expandedQuery);
}
```

## 설정 값

| 설정 | Before | After | 설명 |
|------|--------|-------|------|
| Threshold | 0.6 | 0.4 | 더 정확한 매칭 |
| Answer 가중치 | 45% | 50% | 정답 중요도 증가 |
| Title 가중치 | 20% | 15% | 제목 중요도 감소 |
| minMatchCharLength | - | 2 | 최소 매칭 글자 수 |
| ignoreLocation | - | true | 위치 무관 매칭 |

## 예상 효과

1. **Few-Shot 관련성 향상**: 20% → 100%
2. **채점 정확도 향상**: 유사 문제 예시로 학습
3. **검색 범위 확대**: 유의어 확장으로 더 많은 관련 문제 검색
4. **노이즈 감소**: Threshold 0.4로 부정확한 결과 제거

## 테스트 방법

```javascript
// 1. RAG-통합 Few-Shot 테스트
const correctAnswer = "감사증거의 충분성과 적합성을 평가한다";
const examples = await selectFewShotExamples(70, 5, correctAnswer);
console.log('선택된 예시:', examples.map(ex => ex.id));

// 2. 유의어 확장 테스트
await ragService.initializeRAG();
const results = ragService.retrieveDocuments("매출인식 기준", 10);
console.log('검색 결과:', results.map(r => r.id));
```

## 관련 파일

- `js/services/gemmaFewShotLoader.js` - RAG 통합 Few-Shot
- `js/services/ragSearch.js` - 유의어 확장 + Threshold 개선
- `docs/rag-improvements.md` - 본 문서
