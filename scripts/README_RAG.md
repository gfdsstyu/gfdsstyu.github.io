# Gamlini RAG 시스템 가이드

## 개요

Gamlini RAG(Retrieval-Augmented Generation) 시스템은 회계감사기준, 법령, 윤리기준 데이터를 기반으로 한 클라이언트 사이드 검색 증강 생성 시스템입니다.

### 3대 원칙

1. **서버 비용 0원 (Serverless)**: 모든 처리가 브라우저에서 수행
2. **사용자 키 사용 (BYOK)**: 사용자의 API Key로 비용 발생
3. **모바일 최적화**: Lazy Loading 및 효율적인 데이터 구조

## 시스템 구성

```
gamlini-rag/
├── DB/                          # 원본 데이터
│   ├── auditStandards.json      # 회계감사기준 (계층형)
│   ├── legalDataLaws.json       # 법령 (외부감사법, 공인회계사법)
│   └── legalDataEthics.json     # 윤리기준
├── questions.json               # 회계감사기준 암기교재 (참고용)
├── js/data/kamData.json         # KAM 실증절차 사례 (참고용)
├── js/features/exam/data/       # 기출문제 (참고용)
│   ├── 2025_hierarchical.json
│   └── 2024_hierarchical.json
├── scripts/                     # 벡터 빌드 스크립트
│   ├── build-vector.js          # 벡터화 스크립트
│   ├── package.json             # 의존성 설정
│   └── .env                     # API Key 설정 (gitignore)
├── public/data/                 # 생성된 벡터 데이터
│   └── vectors.json             # 벡터 인덱스 (배포용)
└── js/services/                 # 클라이언트 서비스
    └── ragService.js            # RAG 검색 서비스
```

## 설치 및 설정

### 1단계: 벡터 인덱스 생성 (로컬에서 1회만 실행)

#### 1-1. 환경 설정

```bash
cd scripts

# 의존성 설치
npm install

# .env 파일 생성
cp .env.example .env
```

#### 1-2. API Key 설정

`.env` 파일에 Google Gemini API Key를 입력하세요:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

**API Key 발급 방법:**
1. https://aistudio.google.com/apikey 접속
2. Google 계정으로 로그인
3. "Create API Key" 클릭
4. 생성된 Key를 복사하여 `.env` 파일에 붙여넣기

#### 1-3. 벡터 생성 실행

```bash
npm run build
```

**실행 과정:**
1. 4개의 JSON 파일 로드
2. 데이터 정규화 (중첩 구조 평탄화)
3. Google Gemini API로 각 문서 임베딩 (768차원 벡터 생성)
4. `public/data/vectors.json` 파일 생성

**예상 소요 시간:**
- 문서 수: 약 500~1000개 (데이터에 따라 다름)
- 처리 시간: 약 5~10분
- API 비용: $0.01 ~ $0.05 (매우 저렴)

**Rate Limit 대응:**
- 배치 크기: 10개씩 묶음 처리
- 배치 간 딜레이: 1초
- 429 에러 발생 시 자동으로 5초 대기 후 재시도

### 2단계: 클라이언트 통합

생성된 `public/data/vectors.json` 파일은 Git에 커밋하여 배포하세요.

#### 2-1. HTML에 스크립트 추가

```html
<!-- RAG 서비스 로드 -->
<script src="/js/services/ragService.js"></script>
```

#### 2-2. 사용자 API Key 설정 UI

사용자가 자신의 Gemini API Key를 입력할 수 있는 UI를 제공하세요:

```javascript
// 설정 저장
function saveApiKey(apiKey) {
  localStorage.setItem('gemini_api_key', apiKey);
  alert('API Key가 저장되었습니다.');
}

// 설정 UI 예시
<input type="password" id="apiKeyInput" placeholder="Gemini API Key 입력">
<button onclick="saveApiKey(document.getElementById('apiKeyInput').value)">저장</button>
```

#### 2-3. 챗봇에 RAG 통합

```javascript
// 기존 챗봇 코드에 RAG 검색 추가
async function sendMessageWithRAG(userMessage) {
  try {
    // 1. RAG 검색 수행
    const ragResult = await window.ragService.searchAndFormat(userMessage, {
      topK: 5,
      minSimilarity: 0.3
    });

    // 2. System Prompt에 RAG 컨텍스트 추가
    const systemInstruction = ragResult.systemPrompt;
    const contextMessage = ragResult.context;

    // 3. LLM API 호출
    const fullPrompt = `${contextMessage}\n\n사용자 질문: ${userMessage}`;

    // Gemini API 호출 (기존 코드 활용)
    const response = await geminiAPI.generateContent({
      systemInstruction: systemInstruction,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }]
    });

    return response.text;

  } catch (error) {
    console.error('RAG 검색 실패:', error);

    // RAG 없이 기본 응답 (fallback)
    return await sendMessageWithoutRAG(userMessage);
  }
}
```

## API 레퍼런스

### RAGService 클래스

#### `loadVectors()`
벡터 데이터를 로드합니다 (자동 호출됨, 직접 호출 불필요).

```javascript
await window.ragService.loadVectors();
```

#### `search(query, topK, options)`
질문과 유사한 문서를 검색합니다.

**파라미터:**
- `query` (string): 사용자 질문
- `topK` (number): 반환할 최대 결과 수 (기본값: 5)
- `options` (object):
  - `types` (string[]): 문서 타입 필터 ['audit', 'law', 'ethics', 'exam']
  - `minSimilarity` (number): 최소 유사도 임계값 (기본값: 0.3)

**반환값:**
```javascript
[
  {
    id: "audit_200_1_0",
    text: "검색 원문",
    vector: [0.123, -0.456, ...], // 768차원
    metadata: {
      type: "audit",
      source: "회계감사기준 200",
      title: "독립된 감사인의 목적",
      content: "실제 내용"
    },
    similarity: 0.856 // 유사도 점수 (0~1)
  }
]
```

**사용 예시:**
```javascript
// 기본 검색
const results = await window.ragService.search("감사인의 독립성이란?", 5);

// 회계감사기준만 검색
const auditOnly = await window.ragService.search("감사인의 독립성", 3, {
  types: ['audit']
});

// 높은 정확도만 필터링
const highConfidence = await window.ragService.search("외부감사법", 5, {
  minSimilarity: 0.5
});
```

#### `searchAndFormat(query, options)`
검색 + 프롬프트 포맷팅을 한 번에 수행합니다.

**반환값:**
```javascript
{
  systemPrompt: "당신은 회계 감사 전문가입니다...",
  context: "[참고문서 1] (회계감사기준, 관련도 85.6%)\n...",
  results: [...], // 검색 결과 배열
  hasResults: true
}
```

**사용 예시:**
```javascript
const rag = await window.ragService.searchAndFormat("감사위험이란?");

console.log(rag.systemPrompt); // LLM System Instruction
console.log(rag.context);      // LLM에 전달할 컨텍스트
console.log(rag.hasResults);   // 검색 결과 존재 여부
```

#### `getStats()`
벡터 데이터 통계 정보를 반환합니다.

```javascript
const stats = window.ragService.getStats();
// { total: 856, byType: { audit: 423, law: 189, ethics: 178, exam: 66 } }
```

#### `isReady()`
RAG 시스템 초기화 상태를 확인합니다.

```javascript
if (window.ragService.isReady()) {
  console.log('RAG 시스템 준비 완료');
}
```

## 데이터 구조

### 정규화된 문서 포맷

모든 데이터는 다음 포맷으로 통일됩니다:

```javascript
{
  id: string,       // 유니크 ID
  text: string,     // 임베딩 대상 텍스트 (제목 + 본문)
  vector: number[], // 768차원 벡터
  metadata: {
    type: string,   // 'audit' | 'law' | 'ethics' | 'exam'
    source: string, // 출처 (예: "회계감사기준 200")
    title: string,  // 제목
    content: string // 실제 내용 (LLM에 전달)
  }
}
```

### 문서 타입 설명

| 타입 | 설명 | 출처 | 분류 |
|------|------|------|------|
| `audit` | 회계감사기준 | auditStandards.json | 공식 문서 |
| `law` | 법령 (외부감사법, 공인회계사법) | legalDataLaws.json | 공식 문서 |
| `ethics` | 윤리기준 | legalDataEthics.json | 공식 문서 |
| `study` | 회계감사기준 암기교재 | questions.json | 참고 자료 |
| `kam` | KAM 실증절차 사례 | kamData.json | 참고 자료 |
| `exam` | 기출문제 | 2025/2024_hierarchical.json | 참고 자료 |

**공식 문서** (audit, law, ethics)는 모두 동등하게 중요하며, 독립성/윤리 등의 주제는 3가지를 함께 고려합니다.

## 트러블슈팅

### 벡터 생성 오류

**증상:** `❌ GEMINI_API_KEY가 설정되지 않았습니다.`

**해결:**
```bash
cd scripts
cat .env  # API Key 확인
# GEMINI_API_KEY=your_key_here 형식인지 확인
```

---

**증상:** `429 Rate Limit` 에러

**해결:**
- 스크립트가 자동으로 5초 대기 후 재시도합니다.
- 계속 발생하면 `CONFIG.BATCH_SIZE`를 5로 줄이고 `CONFIG.DELAY_MS`를 2000으로 늘리세요.

```javascript
// build-vector.js 상단 수정
const CONFIG = {
  BATCH_SIZE: 5,   // 10 -> 5로 변경
  DELAY_MS: 2000,  // 1000 -> 2000으로 변경
  // ...
};
```

---

**증상:** JSON 파싱 오류

**해결:**
- DB 폴더의 JSON 파일 구조를 확인하세요.
- 각 파일이 UTF-8로 인코딩되었는지 확인하세요.

### 클라이언트 검색 오류

**증상:** `API Key가 설정되지 않았습니다.`

**해결:**
- 사용자가 설정 페이지에서 Gemini API Key를 입력했는지 확인하세요.
- LocalStorage 확인:
```javascript
console.log(localStorage.getItem('gemini_api_key'));
```

---

**증상:** `벡터 파일 로드 실패: 404`

**해결:**
- `public/data/vectors.json` 파일이 존재하는지 확인하세요.
- 브라우저 개발자 도구 Network 탭에서 파일 경로를 확인하세요.
- `ragService.js`의 `vectorDataPath` 경로가 올바른지 확인하세요.

---

**증상:** 검색 결과가 없음 (`hasResults: false`)

**원인:**
- 최소 유사도 임계값(`minSimilarity`)이 너무 높음
- 질문이 데이터와 관련성이 낮음

**해결:**
```javascript
// minSimilarity 낮추기
const results = await window.ragService.search("질문", 5, {
  minSimilarity: 0.2 // 0.3 -> 0.2로 변경
});
```

## 성능 최적화

### 벡터 파일 크기 최적화

생성된 `vectors.json` 파일이 너무 크면 (>5MB):

1. **불필요한 문서 제거**: 정규화 함수에서 빈 내용 필터링 강화
2. **압축 전송**: 웹서버에서 gzip 압축 활성화
3. **IndexedDB 캐싱**: 첫 로드 후 브라우저에 저장

```javascript
// 추후 IndexedDB 캐싱 예시 (선택 사항)
// Dexie.js 활용하여 구현 가능
```

### 모바일 데이터 절약

Lazy Loading이 적용되어 있어, 사용자가 첫 질문을 할 때만 벡터 파일을 로드합니다.

```javascript
// 초기 로딩 시에는 벡터 다운로드 안 함
// 사용자가 질문 입력 → 그때 로드
```

## 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 문의

문제가 발생하거나 개선 사항이 있으면 이슈를 등록해주세요.
