사용자님께서 추가해주신 \*\*글자 수 제한(50자)\*\*과 **플레이스홀더(안내 문구) 디벨롭** 요구사항을 반영하여, 더욱 구체화된 **퀴즈 메모 기능 개발 계획**을 제안해 드립니다.

핵심은 \*\*"핵심만 짧게 기록하게 유도(50자 제한)"\*\*하고, 이를 **"AI가 발전시켜주는(암기팁 반영)"** 선순환 구조를 만드는 것입니다.
사용자 요청 :quiz 문풀에 메모기능도 구현하고 싶다. 아이디어 디벨롭해줘. 일단은 아이디어를 구체화해줘.
의도: 사용자가 사용자만의 필기나 앞글자 메모해놓기
UI :채점, 암기팁 버튼 옆에/ 메모작성(최초작성시), 메모수정(다시작성시)
구현: 최초 메모작성시엔 채점시 페널티 없으나. 메모 작성된 이후 메모수정을 하면 메모 열람이 되므로 일괄감점로직 적용(프롬프트상)말고 api 에서 반환받은 점수에서 일괄로. 점수 cap 도지정.
+ 글자수제한도 50자 정도?
영향: 메모작성된 이후의 암기팁 api 호출은 사용자 메모를 참고해서 암기팁을 생성하게함.
저장은 일단은 로컬데이터로? 영향평가
-----

## 📝 퀴즈 메모 기능 상세 기획안

### 1\. 기획 의도 및 정책

  * **의도:** 장황한 필기가 아닌, **'두문자(앞글자)'나 '핵심 키워드'** 위주의 압축된 단기 기억 장치를 제공합니다.
  * **정책:**
      * **작성 시:** 페널티 없음 (순수 학습).
      * **열람/수정 시:** 이미 답을 알고 있는 상태로 간주하여 **채점 점수 상한(Cap) 60점** 적용.
      * **제한:** 최대 **50자** (핵심 요약 유도).

### 2\. 데이터 구조 (Data Structure)

기존 `questionScores` 객체에 메모 필드를 추가합니다.

```javascript
// questionScores[qid] 구조
{
  ...,
  userMemo: "성.시.범 (성격, 시기, 범위)", // 사용자 메모 (최대 50자)
  // (메모 열람 여부는 'activeMemoQuestionKey'라는 별도 전역 상태로 관리)
}
```

### 3\. UI/UX 설계 (`index.html`)

  * **버튼 배치:** `[힌트] [암기팁] [📝 메모]` 순서.
  * **메모 컨테이너:**
      * **입력창:** 50자 제한 `textarea`.
      * **플레이스홀더:** "앞글자(두문자)나 핵심 키워드만 짧게 남기세요. (예: 성.시.범). 작성된 내용은 AI 암기팁 생성 시 참고되어 더 완벽한 팁을 만들어줍니다."
      * **글자 수 카운터:** 우측 하단에 `(0/50)` 표시.

-----

## 🚀 단계별 구현 가이드

### Step 1: UI 추가 (`index.html`)

힌트/암기팁 버튼 옆에 메모 버튼을 추가하고, 글자 수 카운터가 포함된 입력 영역을 만듭니다.

```html
<div class="flex items-center gap-2">
  <button id="hint-btn" ...>힌트</button>
  <button id="memory-tip-btn" ...>암기팁</button>
  <button id="user-memo-btn" class="text-sm bg-gray-100 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md shadow hover:bg-gray-200 transition flex items-center gap-1">
    <span>📝</span> <span id="user-memo-btn-text">메모</span>
  </button>
</div>

<div id="user-memo-container" class="hidden mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg relative">
  <div class="flex justify-between items-center mb-2">
    <label class="text-sm font-bold text-yellow-800">나만의 핵심 요약</label>
    <button id="save-memo-btn" class="text-xs px-3 py-1 bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300 font-bold">저장</button>
  </div>
  <textarea 
    id="user-memo-input" 
    class="w-full p-2 text-sm border border-yellow-300 rounded bg-white focus:ring-1 focus:ring-yellow-500" 
    rows="2" 
    maxlength="50"
    placeholder="앞글자(두문자)나 핵심 키워드만 짧게 남기세요. (예: 성.시.범)&#13;&#10;작성된 내용은 AI 암기팁 생성 시 참고되어 더 완벽한 팁을 만들어줍니다."></textarea>
  <div class="text-right text-xs text-gray-400 mt-1">
    <span id="memo-char-count">0</span>/50자
  </div>
</div>
```

### Step 2: State 관리 (`js/core/stateManager.js`)

메모 열람 상태를 추적하기 위한 변수를 추가합니다.

```javascript
const state = {
  // ... 기존 상태
  activeMemoQuestionKey: null, // 현재 문제에서 메모를 열람했는지 추적 (문제ID)
};

export const getActiveMemoQuestionKey = () => state.activeMemoQuestionKey;
export const setActiveMemoQuestionKey = (key) => { state.activeMemoQuestionKey = key; };
```

### Step 3: 로직 구현 (`js/features/quiz/quizCore.js`)

메모 버튼 클릭 시 로직과 글자 수 카운팅 기능을 구현합니다.

```javascript
// 1. 글자 수 카운팅
el.userMemoInput?.addEventListener('input', (e) => {
    const len = e.target.value.length;
    const counter = document.getElementById('memo-char-count');
    if (counter) counter.textContent = len;
});

// 2. 메모 버튼 클릭 핸들러
el.userMemoBtn?.addEventListener('click', () => {
  const cqd = getCurrentQuizData();
  const cqi = getCurrentQuestionIndex();
  if (!cqd.length) return;

  const q = cqd[cqi];
  const qKey = normId(q.고유ID);
  const questionScores = getQuestionScores();
  const savedMemo = questionScores[qKey]?.userMemo || "";

  const isHidden = el.userMemoContainer.classList.contains('hidden');
  
  if (isHidden) {
    // 열기
    el.userMemoContainer.classList.remove('hidden');
    el.userMemoInput.value = savedMemo;
    document.getElementById('memo-char-count').textContent = savedMemo.length; // 카운터 초기화
    
    // [핵심] 기존 메모가 있으면 "열람"으로 간주 -> 페널티 플래그 ON
    if (savedMemo.trim().length > 0) {
        setActiveMemoQuestionKey(qKey);
        showToast("메모를 열람했습니다. (채점 시 최대 60점)", "warn");
    } else {
        // 최초 작성 시 안내
        showToast("나만의 핵심 키워드를 50자 이내로 기록하세요!", "info");
    }
  } else {
    // 닫기
    el.userMemoContainer.classList.add('hidden');
  }
});

// 3. 저장 핸들러
el.saveMemoBtn?.addEventListener('click', () => {
    // ... (기존 저장 로직) ...
    const memoContent = el.userMemoInput.value.trim();
    
    // 로컬 저장
    const questionScores = getQuestionScores();
    if (!questionScores[qKey]) questionScores[qKey] = {};
    questionScores[qKey].userMemo = memoContent;
    setQuestionScores(questionScores);
    saveQuestionScores();

    // Firestore 동기화 (records 서브컬렉션)
    if (window.AuthCore && window.AuthCore.getCurrentUser()) {
        window.SyncCore.syncToFirestore(window.AuthCore.getCurrentUser().uid, qKey);
    }
    
    showToast("메모가 저장되었습니다.", "success");
    updateMemoButtonUI(true); // 버튼 스타일 변경 (작성 -> 보기)
});
```

### Step 4: 채점 페널티 로직 (`js/features/quiz/grading.js`)

메모 열람 시 점수 상한(Cap)을 적용합니다.

```javascript
export async function handleGrade() {
  // ...
  let { score, feedback } = await callGeminiAPI(...);

  // [NEW] 페널티 로직
  const qKey = normId(q.고유ID);
  const usedMemo = (getActiveMemoQuestionKey() === qKey); // 메모 열람 여부

  let finalScore = score;
  let penaltyMsg = "";

  // 메모 열람 시: 최대 60점으로 제한 (정답을 참고한 것과 유사하게 처리)
  if (usedMemo) {
      if (finalScore > 60) {
          finalScore = 60;
          penaltyMsg += "(메모 열람으로 60점 제한) ";
      }
  }

  // ... (기존 힌트 감점 로직과 병합) ...
  
  // 최종 피드백 구성
  const finalFeedback = penaltyMsg ? `${feedback} \n\n📉 **감점 사유:** ${penaltyMsg}` : feedback;
  
  // ...
}
```

### Step 5: AI 암기팁 프롬프트 강화 (`js/config/config.js`)

사용자의 메모를 AI에게 제공하여 이를 활용하도록 유도합니다.

```javascript
export function createMemoryTipPrompt(question, answer, userMemo, mode) {
  let context = "";
  if (userMemo && userMemo.trim().length > 0) {
    context = `
[학습자의 메모]
"${userMemo}"

[추가 지침]
학습자가 위와 같은 키워드/두문자로 메모를 남겼습니다.
1. 이 메모가 정답을 외우는 데 효과적이라면, 이를 적극 활용하여 살을 붙여주세요.
2. 만약 부정확하거나 부족하다면, 이를 수정/보완하여 더 완벽한 암기 팁으로 만들어주세요.
`;
  }

  return `[역할] 회계감사 암기 코치
...
${context}
...
[요청] 위 정답을 외우기 쉬운 2-4줄 암기 팁으로 만드세요.`;
}
```

### 4\. 저장소 및 영향 평가

  * **저장:** `questionScores`에 포함되어 `localStorage`에 우선 저장됩니다.
  * **동기화:** `syncCore.js`를 통해 Firestore의 `records` 서브컬렉션으로 동기화됩니다. 텍스트 용량이 작아(최대 50자) 성능이나 비용 이슈는 없습니다.
  * **영향:**
      * **긍정:** 사용자가 스스로 핵심을 요약(50자 제한)하는 과정에서 학습 효과가 증대되며, AI가 이를 받아 개인화된 팁을 제공하므로 만족도가 높아질 것입니다.
      * **주의:** 사용자가 "단순 오타 수정"을 하려다가 페널티를 먹는 경우 억울할 수 있습니다. 이를 위해 수정 모드 진입 시 \*\*"지금 수정하시면 메모 열람으로 간주되어 점수가 제한됩니다"\*\*라는 명확한 경고(Toast)가 필수적입니다.
###리뷰어 피드백
3. 플레이스홀더 길이 문제
htmlplaceholder="앞글자(두문자)나 핵심 키워드만 짧게 남기세요. (예: 성.시.범)&#13;&#10;작성된 내용은 AI 암기팁 생성 시 참고되어 더 완벽한 팁을 만들어줍니다."
문제점: 플레이스홀더가 너무 길어서 모바일에서 읽기 어려울 수 있습니다.
제안: 간결하게 수정
htmlplaceholder="예: 성.시.범 (AI 암기팁에 반영됨)"
4. StateManager 추가 필요
문서의 Step 2에서 stateManager.js에 추가해야 할 것들:
javascript// js/core/stateManager.js에 추가 필요
let activeMemoQuestionKey = null;

export const getActiveMemoQuestionKey = () => activeMemoQuestionKey;
export const setActiveMemoQuestionKey = (key) => { activeMemoQuestionKey = key; };
5. AI 프롬프트 개선
config.js의 프롬프트에서 사용자 메모가 부정확할 경우 수정하라고 했는데, 이러면 사용자가 혼란스러울 수 있습니다.
제안:
javascript// 더 명확한 지시
if (userMemo && userMemo.trim().length > 0) {
  context = `
[학습자의 메모 키워드]
"${userMemo}"

[지침]
- 학습자가 이미 위 키워드를 암기 단서로 사용 중입니다.
- 이 키워드를 **중심으로** 암기팁을 구성해주세요.
- 키워드가 정답과 맞지 않으면, 올바른 연결고리를 **추가**로 제안해주세요.
`;
}
