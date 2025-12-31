# RAG 시스템 사용 예시

## 빠른 시작 가이드

### 1단계: 벡터 인덱스 생성 (개발자가 1회만 실행)

```bash
# 1. scripts 폴더로 이동
cd scripts

# 2. 패키지 설치
npm install

# 3. .env 파일 생성
cp .env.example .env

# 4. .env 파일 편집하여 API Key 입력
# GEMINI_API_KEY=your_actual_key_here

# 5. 벡터 생성 실행
npm run build
```

**결과물:** `public/data/vectors.json` 파일이 생성됩니다.

---

### 2단계: 웹사이트에 통합

#### HTML에 스크립트 추가

```html
<!DOCTYPE html>
<html>
<head>
  <title>Gamlini AI Tutor</title>
</head>
<body>
  <!-- 기존 UI -->
  <div id="chat-container"></div>

  <!-- RAG 서비스 로드 -->
  <script src="/js/services/ragService.js"></script>

  <!-- 챗봇 로직 -->
  <script>
    // RAG 사용 예시는 아래 참조
  </script>
</body>
</html>
```

---

## 사용 예시 코드

### 예시 1: 기본 검색

```javascript
async function basicSearch() {
  const userQuestion = "감사인의 독립성이란 무엇인가요?";

  try {
    // RAG 검색 수행
    const results = await window.ragService.search(userQuestion, 5);

    console.log(`검색 결과: ${results.length}개`);

    results.forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.metadata.title}`);
      console.log(`유사도: ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`출처: ${result.metadata.source}`);
      console.log(`내용: ${result.metadata.content.substring(0, 100)}...`);
    });

  } catch (error) {
    console.error('검색 실패:', error.message);
  }
}
```

---

### 예시 2: 챗봇에 RAG 통합

```javascript
async function sendMessageWithRAG(userMessage) {
  try {
    // 1. RAG 검색 및 프롬프트 생성
    const ragData = await window.ragService.searchAndFormat(userMessage, {
      topK: 5,
      minSimilarity: 0.3
    });

    // 2. 검색 결과가 있으면 컨텍스트 추가
    let finalPrompt = userMessage;

    if (ragData.hasResults) {
      console.log(`✅ RAG 컨텍스트 추가: ${ragData.results.length}개 문서`);
      finalPrompt = `${ragData.context}\n\n사용자 질문: ${userMessage}`;
    } else {
      console.log('⚠️  관련 문서 없음. 기본 응답 모드.');
    }

    // 3. Gemini API 호출
    const apiKey = localStorage.getItem('gemini_api_key');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: ragData.systemPrompt }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: finalPrompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();
    const answer = data.candidates[0].content.parts[0].text;

    // 4. 답변 표시
    displayMessage('AI', answer);

    // 5. 참고 문서 출처 표시 (선택사항)
    if (ragData.hasResults) {
      displaySources(ragData.results);
    }

  } catch (error) {
    console.error('메시지 전송 실패:', error);
    displayMessage('System', `오류 발생: ${error.message}`);
  }
}

// UI 헬퍼 함수
function displayMessage(sender, message) {
  const chatContainer = document.getElementById('chat-container');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender.toLowerCase()}`;
  messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatContainer.appendChild(messageElement);
}

function displaySources(results) {
  const chatContainer = document.getElementById('chat-container');
  const sourcesElement = document.createElement('div');
  sourcesElement.className = 'sources';
  sourcesElement.innerHTML = '<strong>📚 참고 문서:</strong>';

  results.forEach((result, index) => {
    const source = document.createElement('div');
    source.className = 'source-item';
    source.innerHTML = `${index + 1}. ${result.metadata.source} - ${result.metadata.title} (${(result.similarity * 100).toFixed(1)}%)`;
    sourcesElement.appendChild(source);
  });

  chatContainer.appendChild(sourcesElement);
}
```

---

### 예시 3: 문서 타입별 검색

```javascript
// 회계감사기준만 검색
async function searchAuditStandards(question) {
  const results = await window.ragService.search(question, 5, {
    types: ['audit'],
    minSimilarity: 0.4
  });

  console.log('회계감사기준 검색 결과:', results);
}

// 법령만 검색 (외부감사법, 공인회계사법)
async function searchLaws(question) {
  const results = await window.ragService.search(question, 5, {
    types: ['law'],
    minSimilarity: 0.4
  });

  console.log('법령 검색 결과:', results);
}

// 윤리기준만 검색
async function searchEthics(question) {
  const results = await window.ragService.search(question, 5, {
    types: ['ethics'],
    minSimilarity: 0.4
  });

  console.log('윤리기준 검색 결과:', results);
}

// KAM 실증절차 사례만 검색
async function searchKAM(question) {
  const results = await window.ragService.search(question, 5, {
    types: ['kam'],
    minSimilarity: 0.4
  });

  console.log('KAM 사례 검색 결과:', results);
}

// 기출문제만 검색
async function searchExamOnly(question) {
  const results = await window.ragService.search(question, 5, {
    types: ['exam'],
    minSimilarity: 0.3
  });

  console.log('기출문제 검색 결과:', results);
}

// 공식 문서만 검색 (참고자료 제외)
async function searchOfficialOnly(question) {
  const results = await window.ragService.search(question, 5, {
    types: ['audit', 'law', 'ethics'],
    minSimilarity: 0.4
  });

  console.log('공식 문서만 검색 결과:', results);
}
```

---

### 예시 4: RAG 통계 정보 표시

```javascript
function showRAGStats() {
  const stats = window.ragService.getStats();

  if (!stats) {
    console.log('RAG 시스템이 아직 초기화되지 않았습니다.');
    return;
  }

  console.log('=== RAG 시스템 통계 ===');
  console.log(`총 문서 수: ${stats.total}개`);
  console.log('\n문서 타입별:');
  console.log(`  - 회계감사기준: ${stats.byType.audit || 0}개`);
  console.log(`  - 법령 (외부감사법, 공인회계사법): ${stats.byType.law || 0}개`);
  console.log(`  - 윤리기준: ${stats.byType.ethics || 0}개`);
  console.log(`  - 회계감사기준 암기교재: ${stats.byType.study || 0}개`);
  console.log(`  - KAM 실증절차 사례: ${stats.byType.kam || 0}개`);
  console.log(`  - 기출문제: ${stats.byType.exam || 0}개`);
}

// 페이지 로드 시 통계 표시
window.addEventListener('load', () => {
  // RAG 초기화 후 통계 표시
  setTimeout(() => {
    if (window.ragService.isReady()) {
      showRAGStats();
    }
  }, 2000);
});
```

---

### 예시 5: 설정 페이지 구현

```html
<!DOCTYPE html>
<html>
<head>
  <title>설정 - Gamlini</title>
  <style>
    .settings-container {
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }

    .setting-item {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-weight: bold;
      margin-bottom: 5px;
    }

    input[type="password"],
    input[type="text"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    button {
      padding: 10px 20px;
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    button:hover {
      background-color: #45a049;
    }

    .status-message {
      margin-top: 10px;
      padding: 10px;
      border-radius: 4px;
    }

    .success {
      background-color: #d4edda;
      color: #155724;
    }

    .error {
      background-color: #f8d7da;
      color: #721c24;
    }
  </style>
</head>
<body>
  <div class="settings-container">
    <h1>⚙️ 설정</h1>

    <div class="setting-item">
      <label for="apiKey">Google Gemini API Key</label>
      <input
        type="password"
        id="apiKey"
        placeholder="AI...로 시작하는 API Key 입력"
        value=""
      >
      <p style="font-size: 12px; color: #666;">
        API Key는 <a href="https://aistudio.google.com/apikey" target="_blank">여기</a>에서 무료로 발급받을 수 있습니다.
      </p>
    </div>

    <button onclick="saveSettings()">💾 저장</button>
    <button onclick="testApiKey()">🧪 연결 테스트</button>

    <div id="statusMessage"></div>
  </div>

  <script>
    // 페이지 로드 시 저장된 설정 불러오기
    window.addEventListener('load', () => {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) {
        document.getElementById('apiKey').value = savedKey;
      }
    });

    // 설정 저장
    function saveSettings() {
      const apiKey = document.getElementById('apiKey').value.trim();

      if (!apiKey) {
        showStatus('API Key를 입력해주세요.', 'error');
        return;
      }

      if (!apiKey.startsWith('AI')) {
        showStatus('올바른 API Key 형식이 아닙니다. (AI로 시작해야 함)', 'error');
        return;
      }

      localStorage.setItem('gemini_api_key', apiKey);
      showStatus('✅ 설정이 저장되었습니다!', 'success');
    }

    // API Key 연결 테스트
    async function testApiKey() {
      const apiKey = localStorage.getItem('gemini_api_key');

      if (!apiKey) {
        showStatus('먼저 API Key를 저장해주세요.', 'error');
        return;
      }

      showStatus('⏳ 연결 테스트 중...', 'info');

      try {
        // 간단한 임베딩 테스트
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: { parts: [{ text: 'test' }] }
            })
          }
        );

        if (response.ok) {
          showStatus('✅ API Key 연결 성공!', 'success');
        } else {
          const error = await response.json();
          showStatus(`❌ 연결 실패: ${error.error?.message || '알 수 없는 오류'}`, 'error');
        }

      } catch (error) {
        showStatus(`❌ 연결 실패: ${error.message}`, 'error');
      }
    }

    // 상태 메시지 표시
    function showStatus(message, type) {
      const statusElement = document.getElementById('statusMessage');
      statusElement.className = `status-message ${type}`;
      statusElement.textContent = message;
      statusElement.style.display = 'block';

      // 5초 후 자동 숨김
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 5000);
    }
  </script>
</body>
</html>
```

---

### 예시 6: 오류 처리 패턴

```javascript
async function robustRAGSearch(question) {
  try {
    // RAG 검색 시도
    const ragData = await window.ragService.searchAndFormat(question);

    return {
      success: true,
      data: ragData
    };

  } catch (error) {
    console.error('RAG 검색 오류:', error);

    // 오류 타입별 처리
    if (error.message.includes('API Key')) {
      // API Key 오류 → 설정 페이지로 안내
      return {
        success: false,
        error: 'API Key가 설정되지 않았습니다.',
        action: 'redirect_to_settings'
      };

    } else if (error.message.includes('벡터 파일')) {
      // 벡터 파일 로드 실패 → RAG 없이 진행
      console.warn('RAG 없이 기본 모드로 진행합니다.');
      return {
        success: false,
        error: '참고 자료를 불러올 수 없습니다.',
        action: 'proceed_without_rag'
      };

    } else if (error.message.includes('429')) {
      // Rate Limit → 잠시 후 재시도 안내
      return {
        success: false,
        error: 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        action: 'retry_later'
      };

    } else {
      // 기타 오류
      return {
        success: false,
        error: `검색 중 오류가 발생했습니다: ${error.message}`,
        action: 'show_error'
      };
    }
  }
}

// 사용 예시
async function handleUserQuestion(question) {
  const result = await robustRAGSearch(question);

  if (result.success) {
    // RAG 검색 성공 → LLM 호출
    await sendToLLM(question, result.data);

  } else {
    // RAG 검색 실패 → 액션별 처리
    switch (result.action) {
      case 'redirect_to_settings':
        alert('API Key를 설정해주세요.');
        window.location.href = '/settings.html';
        break;

      case 'proceed_without_rag':
        // RAG 없이 LLM 호출
        await sendToLLMWithoutRAG(question);
        break;

      case 'retry_later':
        alert(result.error);
        break;

      default:
        alert(result.error);
    }
  }
}
```

---

## 실전 팁

### 1. 검색 품질 향상

```javascript
// 유사도 임계값 조정
const highQuality = await window.ragService.search(question, 3, {
  minSimilarity: 0.6  // 높은 품질만
});

const broadSearch = await window.ragService.search(question, 10, {
  minSimilarity: 0.2  // 넓은 범위
});
```

### 2. 성능 최적화

```javascript
// RAG 초기화 상태 확인 후 사용
if (!window.ragService.isReady()) {
  console.log('RAG 초기화 중...');
  await window.ragService.loadVectors();
}

const results = await window.ragService.search(question);
```

### 3. 디버깅

```javascript
// 브라우저 콘솔에서
window.ragService.getStats();  // 통계 확인
window.ragService.isReady();   // 초기화 상태
localStorage.getItem('gemini_api_key');  // API Key 확인
```

---

## 다음 단계

1. ✅ 벡터 생성 완료
2. ✅ 웹사이트 통합 완료
3. 🚀 **사용자에게 배포**
4. 📊 사용 로그 분석 및 개선

---

문제가 발생하면 `README_RAG.md`의 트러블슈팅 섹션을 참조하세요!
