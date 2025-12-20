# Gemma 3 Few-Shot Learning System

## 개요

Gemma 3 모델의 채점 정확도를 향상시키기 위해, 실제 Gemini가 채점한 93개의 문항 데이터를 활용한 few-shot learning 시스템입니다.

## 데이터 소스

**파일**: `js/config/gemma_few_shots.json`

- **총 문항 수**: 93개 (q_001 ~ q_xxx, q_008 제외)
- **데이터 구조**:
  ```json
  {
    "q_001": {
      "score": 95,
      "feedback": "모든 핵심 키워드를 정확히 포함했으며...",
      "user_answer": "재무보고성격\n감사절차성격\n합시합비로 감사가 수행될 필요성",
      "solveHistory": [{"date": 1761394965737, "score": 95}]
    }
  }
  ```

## 작동 원리

### 1. 점수대별 예시 선택 (`gemmaFewShotLoader.js`)

```javascript
// 점수대 분류
- 고득점 (80-100점): 3개 선택
- 중간 점수 (60-79점): 2개 선택
- 저득점 (0-59점): 1개 선택
```

**선택 전략**:
- 예상 점수가 80점 이상 → 고득점 예시 위주
- 예상 점수가 60-79점 → 중간 예시 위주
- 예상 점수가 60점 미만 → 저득점 예시 위주

### 2. Few-Shot 프롬프트 생성

```xml
<Examples>
다음은 실제 채점 예시입니다. 이 예시들의 채점 기준과 피드백 스타일을 참고하세요:

[예시 1]
사용자 답안: 재무보고성격
감사절차성격
합시합비로 감사가 수행될 필요성
점수: 95점
피드백: 모든 핵심 키워드를 정확히 포함했으며, '합시합비'와 같은 수험상 합의된 표현을 올바르게 사용했습니다...

[예시 2]
사용자 답안: ...
점수: 73점
피드백: ...

(최대 5개 예시)
</Examples>
```

### 3. Gemma API 통합

**파일**: `js/services/geminiApi.js`

```javascript
// Gemma 모델 사용 시
if (isGemmaModel(model)) {
  // 실제 채점 데이터 로드
  const fewShotPrompt = await buildGemmaFewShotPrompt(userAnswer, correctAnswer, 70);

  // 프롬프트에 삽입
  userQuery = `
    <Instruction>...</Instruction>
    ${fewShotPrompt}
    <Context>...</Context>
    <Task>...</Task>
  `;
}
```

## API

### `selectFewShotExamples(targetScore, count)`

점수대별로 few-shot 예시를 선택합니다.

**Parameters**:
- `targetScore` (number): 예상 점수 (0-100), 기본값 70
- `count` (number): 선택할 예시 개수, 기본값 5

**Returns**: `Array<Object>`
```javascript
[
  {
    id: "q_001",
    score: 95,
    feedback: "...",
    userAnswer: "...",
    latestScore: 95
  }
]
```

### `formatFewShotPrompt(examples)`

Few-shot 예시를 프롬프트 텍스트로 변환합니다.

**Parameters**:
- `examples` (Array): `selectFewShotExamples()`의 반환값

**Returns**: `string` - XML 형식의 프롬프트 텍스트

### `buildGemmaFewShotPrompt(userAnswer, correctAnswer, estimatedScore)`

Gemma API 호출용 완전한 few-shot 프롬프트를 생성합니다.

**Parameters**:
- `userAnswer` (string): 사용자 답안
- `correctAnswer` (string): 모범 답안
- `estimatedScore` (number): 예상 점수, 기본값 70

**Returns**: `Promise<string>` - Few-shot 포함 프롬프트

### `getFewShotStats()`

Few-shot 데이터 통계를 반환합니다.

**Returns**: `Promise<Object>`
```javascript
{
  total: 93,
  avgScore: 67.5,
  maxScore: 95,
  minScore: 25,
  distribution: {
    high: 28,   // 80점 이상
    medium: 42, // 60-79점
    low: 23     // 60점 미만
  }
}
```

### `clearFewShotCache()`

캐시를 초기화합니다 (디버깅용).

## 사용 예시

### 기본 사용

```javascript
import { buildGemmaFewShotPrompt } from './gemmaFewShotLoader.js';

// Gemma 채점 시 자동으로 few-shot 적용
const fewShotPrompt = await buildGemmaFewShotPrompt(
  "사용자 답안",
  "모범 답안",
  70  // 예상 점수
);
```

### 통계 확인

```javascript
import { getFewShotStats } from './gemmaFewShotLoader.js';

const stats = await getFewShotStats();
console.log('Few-shot 데이터 통계:', stats);
// {
//   total: 93,
//   avgScore: 67.5,
//   distribution: { high: 28, medium: 42, low: 23 }
// }
```

### 커스텀 예시 선택

```javascript
import { selectFewShotExamples, formatFewShotPrompt } from './gemmaFewShotLoader.js';

// 고득점 예상 시 8개 예시 선택
const examples = await selectFewShotExamples(85, 8);
const prompt = formatFewShotPrompt(examples);
```

## 성능 최적화

### 캐싱

- `gemma_few_shots.json`은 첫 로드 시 캐시되어 이후 요청에서 재사용
- 메모리 효율적인 구조로 설계

### 랜덤 셔플

- 매 요청마다 Fisher-Yates 알고리즘으로 예시를 셔플
- 동일한 점수대에서도 다양한 예시 조합 제공

## 주의사항

1. **q_008 제외**: 옛날 프롬프트로 기준서 언급을 감점한 잘못된 예시
2. **점수 기준**: 80점 미만 문제만 오답으로 간주 (retry mode 기준)
3. **최대 5개 예시**: 토큰 사용량과 성능의 균형

## 향후 개선 방향

- [ ] 문제 유형별 few-shot 선택 (재무제표, 감사절차 등)
- [ ] 사용자 답안 길이에 따른 동적 예시 선택
- [ ] Few-shot 효과 A/B 테스트
- [ ] 주기적으로 새로운 채점 데이터 추가

## 관련 파일

- `js/services/gemmaFewShotLoader.js` - Few-shot 로더
- `js/services/geminiApi.js` - Gemma API 통합
- `js/config/gemma_few_shots.json` - 실제 채점 데이터
- `docs/gemma-few-shot.md` - 본 문서
