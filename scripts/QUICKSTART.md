# 🚀 Gamlini RAG 시스템 빠른 시작 가이드

## 📋 체크리스트

### ✅ 사전 준비사항

- [ ] Node.js 18 이상 설치됨
- [ ] Google Gemini API Key 발급 완료 ([발급 링크](https://aistudio.google.com/apikey))
- [ ] DB 폴더에 데이터 파일 준비 완료
  - [ ] `auditStandards.json` (회계감사기준)
  - [ ] `legalDataLaws.json` (외부감사법, 공인회계사법)
  - [ ] `legalDataEthics.json` (윤리기준)
- [ ] `questions.json` 파일 준비 완료 (회계감사기준 암기교재)
- [ ] `js/data/kamData.json` 준비 완료 (KAM 실증절차 사례)
- [ ] `js/features/exam/data/` 기출문제 파일 준비 완료

---

## ⚡ 5분 안에 시작하기

### 1️⃣ 벡터 인덱스 생성 (1회만 실행)

```bash
# 터미널에서 실행
cd scripts
npm install
cp .env.example .env
```

`.env` 파일을 열어서 API Key를 입력하세요:

```env
GEMINI_API_KEY=여기에_발급받은_키_붙여넣기
```

벡터 생성 실행:

```bash
npm run build
```

**예상 소요 시간:** 5~10분
**결과:** `public/data/vectors.json` 파일 생성됨

---

### 2️⃣ 웹사이트에 통합

#### HTML에 스크립트 추가

```html
<!-- 챗봇 페이지에 추가 -->
<script src="/js/services/ragService.js"></script>
```

#### 간단한 사용 예시

```javascript
// 사용자 질문에 RAG 적용
async function answerQuestion(question) {
  // 1. RAG 검색
  const rag = await window.ragService.searchAndFormat(question);

  // 2. LLM에 컨텍스트와 함께 전달
  const prompt = `${rag.context}\n\n질문: ${question}`;

  // 3. Gemini API 호출 (기존 코드 활용)
  const answer = await callGeminiAPI(prompt, rag.systemPrompt);

  return answer;
}
```

---

## 📊 작동 확인

### 브라우저 콘솔에서 테스트

```javascript
// 1. RAG 초기화 확인
window.ragService.isReady();
// → true 반환되면 정상

// 2. 통계 확인
window.ragService.getStats();
// → { total: 856, byType: {...} } 형태로 반환

// 3. 테스트 검색
const results = await window.ragService.search("감사인의 독립성", 5);
console.log(results);
```

---

## 🎯 다음 단계

### 필수 작업

1. ✅ 벡터 생성 완료
2. ✅ RAG 서비스 통합
3. ⬜ 사용자 API Key 설정 UI 추가 ([예시 보기](USAGE_EXAMPLE.md#예시-5-설정-페이지-구현))
4. ⬜ 챗봇에 RAG 로직 연결 ([예시 보기](USAGE_EXAMPLE.md#예시-2-챗봇에-rag-통합))

### 선택 작업

- 검색 결과 출처 표시 UI
- 문서 타입별 필터링 기능
- IndexedDB 캐싱 (성능 최적화)

---

## ❓ 문제 해결

### 벡터 생성 중 오류

**증상:** `GEMINI_API_KEY가 설정되지 않았습니다.`

**해결:**
```bash
cd scripts
cat .env  # API Key 확인
```

---

**증상:** `429 Rate Limit` 에러

**해결:** 스크립트가 자동으로 재시도합니다. 계속 발생하면 잠시 후 다시 실행하세요.

---

### 클라이언트 오류

**증상:** `API Key가 설정되지 않았습니다.`

**해결:** 사용자가 설정 페이지에서 자신의 API Key를 입력해야 합니다.

```javascript
// 설정 저장
localStorage.setItem('gemini_api_key', 'user_key_here');
```

---

**증상:** `벡터 파일 로드 실패: 404`

**해결:** `public/data/vectors.json` 파일이 생성되었는지 확인하세요.

```bash
ls -lh public/data/vectors.json
```

---

## 📚 더 알아보기

- [전체 가이드](README_RAG.md)
- [사용 예시 코드](USAGE_EXAMPLE.md)
- [API 레퍼런스](README_RAG.md#api-레퍼런스)

---

## 💡 핵심 포인트

1. **벡터 생성은 개발자가 1회만 실행** → 결과물을 Git에 커밋
2. **사용자는 자신의 API Key 사용** → 서버 비용 없음
3. **RAG는 자동으로 Lazy Loading** → 첫 질문 시 로드됨

---

성공적인 배포를 기원합니다! 🎉
