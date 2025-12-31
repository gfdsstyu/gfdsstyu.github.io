# Gamlini 2.0 통합 가이드

> 로컬 RAG 기반 AI 감사 튜터: 기획서에서 구현까지

## 📋 목차

1. [개요](#개요)
2. [구현된 기능](#구현된-기능)
3. [통합 방법](#통합-방법)
4. [사용 방법](#사용-방법)
5. [API 문서](#api-문서)
6. [트러블슈팅](#트러블슈팅)

---

## 개요

**Gamlini 2.0**은 BYOK(Bring Your Own Key) 방식의 정적 웹 환경에서 작동하는 AI 감사 튜터입니다.

### 핵심 특징

- ✅ **로컬 RAG**: 서버 없이 `kamData.json`, `questions.json`, `KAM.json` 검색
- ✅ **Context Injection**: 현재 풀고 있는 문제의 모든 데이터를 AI에게 자동 주입
- ✅ **Preset Buttons**: 6가지 학습 전용 프리셋 버튼
- ✅ **Chat Storage**: localStorage 기반 대화 보관 및 복습
- ✅ **Side Drawer UI**: Glassmorphism 스타일의 세련된 UI

---

## 구현된 기능

### 1. RAG Service (`ragService.js`)

#### 데이터 소스
- `kamData.json`: 실증절차 DB (100+ 사례)
- `questions.json`: 기출문제 DB
- `KAM.json`: 회계감사기준서

#### 주요 메서드
```javascript
import { ragService } from './js/services/ragService.js';

// 초기화
await ragService.initialize();

// 종합 검색
const result = await ragService.searchAll('재고자산 실사', ['재고', '실사']);
console.log(result.context); // AI 프롬프트용 텍스트
console.log(result.procedures); // 실증절차 배열
console.log(result.similarQuestions); // 유사 문제 배열
console.log(result.standards); // 기준서 배열
```

---

### 2. Chat Storage Manager (`chatStorageManager.js`)

#### 대화 저장
```javascript
import { chatStorage } from './js/services/chatStorageManager.js';

// 새 대화 생성
const chat = chatStorage.createChat(
  'q_123',
  '재고자산 실사 관련 문제...',
  { topic: '감사증거', type: 'Rule' }
);

// 메시지 추가
chatStorage.addMessage(chat.id, 'user', '이 문제 설명해주세요');
chatStorage.addMessage(chat.id, 'assistant', '재고자산 실사는...');

// 저장
chatStorage.saveChat(chat);
```

#### 대화 조회
```javascript
// 모든 대화
const allChats = chatStorage.loadAllChats();

// 검색
const results = chatStorage.searchChats('재고자산');

// 즐겨찾기
const favorites = chatStorage.getFavorites();
```

---

### 3. Enhanced AI Tutor (`examAiTutor.js`)

#### 기존 기능 유지
- ✅ 문제별 컨텍스트 자동 주입
- ✅ Gemini Chat API 연동
- ✅ Quick Questions

#### 새로운 기능 (Gamlini 2.0)

##### RAG Context 자동 주입
```javascript
const session = getAiTutorSession(questionId, questionData, userAnswer, feedback, examCase);

// RAG 활성화 (기본값)
const response = await session.askQuestion(
  '이 문제 설명해주세요',
  apiKey,
  'gemini-2.5-flash',
  true // enableRAG
);
```

##### Context Injection Presets
```javascript
const presets = session.getContextInjectionPresets();
// [
//   { id: 'kam-original-text', icon: '📘', label: '기준서 원문', ... },
//   { id: 'trap-analysis', icon: '🔍', label: '함정 포인트', ... },
//   { id: 'case-example', icon: '✍️', label: '사례로 이해', ... },
//   { id: 'mnemonic-code', icon: '💡', label: '암기 코드', ... },
//   { id: 'reverse-scenario', icon: '❓', label: '반대 상황', ... },
//   { id: 'substantive-procedures', icon: '🔗', label: '관련 실증절차', ... }
// ]
```

##### 대화 자동 저장
```javascript
// 질문할 때마다 자동으로 localStorage에 저장됨
await session.askQuestion('질문', apiKey);

// 수동 저장도 가능
session.saveToStorage();
```

---

### 4. Side Drawer UI (`gamliniDrawer.js`)

#### 특징
- 📱 반응형 디자인 (모바일/데스크톱)
- 🎨 Glassmorphism 스타일
- ⚡ 부드러운 애니메이션
- 🔄 [현재 대화] / [학습 기록] 탭 전환

#### 사용법
```javascript
import { initializeGamliniDrawer, openGamliniDrawer } from './js/features/exam/gamliniDrawer.js';

// 1. 앱 시작 시 초기화
initializeGamliniDrawer();

// 2. 문제 풀이 화면에서 드로어 열기
openGamliniDrawer(
  questionId,
  questionData,
  userAnswer,
  feedback,
  examCase,
  apiKey
);
```

---

## 통합 방법

### Step 1: HTML에 스크립트 추가

```html
<!-- index.html 또는 exam.html -->
<script type="module">
  import { initializeGamliniDrawer } from './js/features/exam/gamliniDrawer.js';

  // 페이지 로드 시 초기화
  document.addEventListener('DOMContentLoaded', () => {
    initializeGamliniDrawer();
  });
</script>
```

### Step 2: 문제 풀이 UI에 버튼 추가

```javascript
// examResultUI.js 또는 examUI.js에서

import { openGamliniDrawer } from './js/features/exam/gamliniDrawer.js';

// "AI에게 물어보기" 버튼 생성
function createAiTutorButton(questionId, questionData, userAnswer, feedback, examCase) {
  const button = document.createElement('button');
  button.className = 'ai-tutor-btn';
  button.innerHTML = '🤖 AI에게 더 물어보기';

  button.addEventListener('click', () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      alert('Gemini API 키를 먼저 설정해주세요.');
      return;
    }

    openGamliniDrawer(questionId, questionData, userAnswer, feedback, examCase, apiKey);
  });

  return button;
}
```

### Step 3: CSS 스타일 추가 (선택)

```css
/* 버튼 스타일 예시 */
.ai-tutor-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 16px;
}

.ai-tutor-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
```

---

## 사용 방법

### 사용자 워크플로우

1. **문제 풀이 완료** → 채점 결과 확인
2. **"🤖 AI에게 더 물어보기" 버튼 클릭**
3. **드로어 열림**:
   - 상단에 현재 문제 정보 표시
   - 6가지 Preset 버튼 표시
4. **Preset 버튼 클릭** 또는 **직접 질문 입력**
5. **AI 응답 받기** (자동으로 RAG Context 주입됨)
6. **대화 자동 저장** (localStorage)
7. **[학습 기록] 탭에서 복습**

### Preset 버튼 활용법

| 버튼 | 용도 | RAG |
|------|------|-----|
| 📘 기준서 원문 | KAM.json에서 관련 조문 추출 | ✅ |
| 🔍 함정 포인트 | 오답 패턴 분석 | ❌ |
| ✍️ 사례로 이해 | kamData 실증절차와 연결 | ✅ |
| 💡 암기 코드 | 두문자 암기법 생성 | ❌ |
| ❓ 반대 상황 | 문제 변형 예시 | ❌ |
| 🔗 관련 실증절차 | kamData 자동 검색 | ✅ |

---

## API 문서

### RAG Service

#### `ragService.initialize()`
데이터 파일 로드 (kamData, questions, KAM)

#### `ragService.searchAll(questionText, customKeywords)`
종합 검색 수행

**Parameters:**
- `questionText` (string): 문제 텍스트
- `customKeywords` (array): 추가 키워드 (선택)

**Returns:**
```javascript
{
  context: string,           // AI 프롬프트용 텍스트
  procedures: Array,         // 실증절차 배열
  similarQuestions: Array,   // 유사 문제 배열
  standards: Array,          // 기준서 배열
  keywords: Array            // 추출된 키워드
}
```

---

### Chat Storage Manager

#### `chatStorage.createChat(questionId, questionText, questionData)`
새 대화 세션 생성

**Returns:** `ChatSession` 객체

#### `chatStorage.saveChat(chat)`
대화 저장

#### `chatStorage.loadAllChats()`
모든 대화 로드 (최신순)

#### `chatStorage.searchChats(query)`
대화 검색

#### `chatStorage.toggleFavorite(chatId)`
즐겨찾기 토글

---

### AI Tutor Session

#### `session.askQuestion(userQuestion, apiKey, model, enableRAG)`
AI에게 질문 전송

**Parameters:**
- `userQuestion` (string): 사용자 질문
- `apiKey` (string): Gemini API 키
- `model` (string): 모델명 (기본: 'gemini-2.5-flash')
- `enableRAG` (boolean): RAG 활성화 (기본: true)

#### `session.getContextInjectionPresets()`
Preset 버튼 목록 반환

#### `session.saveToStorage()`
대화를 Chat Storage에 저장

---

### Gamlini Drawer

#### `initializeGamliniDrawer()`
드로어 초기화 (앱 시작 시 1회)

#### `openGamliniDrawer(questionId, questionData, userAnswer, feedback, examCase, apiKey)`
드로어 열기

---

## 트러블슈팅

### Q1. RAG 검색 결과가 없어요
**A:** 데이터 파일 경로를 확인하세요.
```javascript
// ragService.js에서 경로 확인
fetch('/js/data/kamData.json') // 절대 경로
fetch('./js/data/kamData.json') // 상대 경로
```

### Q2. localStorage 용량 초과 에러
**A:** Chat Storage는 최대 100개 대화만 보관합니다. 오래된 대화는 자동 삭제됩니다.
```javascript
// 수동으로 전체 삭제
chatStorage.clearAll();
```

### Q3. 드로어가 안 보여요
**A:** CSS가 제대로 주입되었는지 확인하세요.
```javascript
// 콘솔에서 확인
document.getElementById('gamlini-drawer-styles')
```

### Q4. RAG Context가 너무 길어서 토큰 초과
**A:** `ragService.js`의 `limit` 파라미터를 줄이세요.
```javascript
// 기본값: 각 카테고리당 2개씩
searchSubstantiveProcedures(keywords, 1) // 1개로 줄이기
```

### Q5. Gemini API 호출 실패
**A:** API 키와 모델명을 확인하세요.
```javascript
// 유효한 모델명
- 'gemini-2.5-flash' (권장)
- 'gemini-2.0-flash'
- 'gemini-1.5-pro'
```

---

## 다음 단계

### 선택적 개선 사항

1. **Vector DB 연동** (예: ChromaDB in WASM)
   - 현재는 단순 키워드 매칭
   - 의미 기반 검색으로 업그레이드 가능

2. **Streaming 응답**
   - 현재는 완성된 응답만 표시
   - Gemini API의 `streamGenerateContent` 사용

3. **대화 Export**
   - PDF/Markdown 내보내기 기능
   - 기존 `examPdfExport.js`와 통합

4. **문제 하이라이트 연동**
   - AI 응답에서 기준서 번호 클릭 시
   - 해당 위치로 자동 스크롤

---

## 라이선스 및 크레딧

- **기획**: 사용자 제공 기획서
- **구현**: Claude Sonnet 4.5 (Gamlini 2.0)
- **UI 디자인**: Glassmorphism 스타일
- **데이터**: kamData.json, questions.json, KAM.json

---

**문의**: 이슈가 있으면 GitHub Issues에 등록해주세요.

🎉 **Happy Learning with Gamlini 2.0!**
