
-----

# 감린이 (Gamrini) - AI 기반 회계감사 학습 플랫폼 v4.0

> **"숲을 보는 감사, 흐름을 타는 암기"**
>
> 감린이는 한국공인회계사(KICPA) 2차 시험 '회계감사' 과목을 위한 지능형 학습 도우미입니다. HLR 알고리즘 기반의 스마트 복습, AI 답안 분석, 그리고 동료 학습(Social Learning) 기능을 통해 수험생의 합격을 지원합니다.

-----

## 📚 목차

1.  [프로젝트 개요](https://www.google.com/search?q=%231-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%EA%B0%9C%EC%9A%94)
2.  [기술 스택 및 아키텍처](https://www.google.com/search?q=%232-%EA%B8%B0%EC%88%A0-%EC%8A%A4%ED%83%9D-%EB%B0%8F-%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98)
3.  [핵심 기능 (Features)](https://www.google.com/search?q=%233-%ED%95%B5%EC%8B%AC-%EA%B8%B0%EB%8A%A5-features)
4.  [성능 최적화 및 리팩토링 (Phase 0\~3.5)](https://www.google.com/search?q=%234-%EC%84%B1%EB%8A%A5-%EC%B5%9C%EC%A0%81%ED%99%94-%EB%B0%8F-%EB%A6%AC%ED%8C%A9%ED%86%A0%EB%A7%81-phase-035)
5.  [향후 로드맵: UI/UX 리팩토링 (Phase 4.0)](https://www.google.com/search?q=%235-%ED%96%A5%ED%9B%84-%EB%A1%9C%EB%93%9C%EB%A7%B5-uiux-%EB%A6%AC%ED%8C%A9%ED%86%A0%EB%A7%81-phase-40)

-----

## 1\. 프로젝트 개요

본 프로젝트는 방대한 회계감사 기준서를 효율적으로 암기하고, 답안 작성 능력을 배양하기 위해 개발되었습니다. 단순 퀴즈 앱을 넘어, 학습자의 기억 상태를 추적하고 AI가 취약점을 분석해주는 \*\*All-in-One 학습 관리 시스템(LMS)\*\*을 지향합니다.

  * **버전:** v4.0 (Refactored & Optimized)
  * **핵심 가치:** 효율성(Efficiency), 메타인지(Metacognition), 연결(Connection)

-----

## 2\. 기술 스택 및 아키텍처

모듈화된 바닐라 자바스크립트(Vanilla JS)와 Firebase Serverless 아키텍처를 기반으로 구축되었습니다.

### 🛠 Front-end

  * **Core:** HTML5, CSS3, Vanilla JavaScript (ES6+ Modules)
  * **Styling:** Tailwind CSS (Built via CLI)
  * **Bundling:** Native ES Modules (No Webpack/Vite required for dev)
  * **Libraries:** Chart.js (통계 시각화), LZ-String (데이터 압축)

### ☁️ Back-end (Serverless)

  * **Database:** Firebase Firestore (NoSQL)
  * **Auth:** Firebase Authentication (Email/Google)
  * **Functions:** Firebase Extensions (Trigger Email)

### 🧠 AI & Services

  * **LLM:** Google Gemini API (답안 채점, 힌트 생성, 심층 분석)
  * **STT:** Google Cloud Speech-to-Text & Web Speech API (음성 답안 입력)

### 📂 프로젝트 구조

```
js/
├── core/           # 상태 관리(StateManager), 이벤트 버스(EventBus), 데이터 로드
├── features/       # 도메인별 기능 모듈
│   ├── quiz/       # 문제 표시, 채점 로직
│   ├── review/     # HLR 알고리즘, 난이도 추적
│   ├── report/     # 학습 리포트, 차트
│   ├── ranking/    # 랭킹 시스템
│   └── group/      # 스터디 그룹 관리
├── services/       # 외부 API 연동 (Gemini, STT)
└── ui/             # UI 렌더링 및 유틸리티
```

-----

## 3\. 핵심 기능 (Features)

### 3.1 스마트 복습 시스템 (Review System)

  * **HLR (Half-Life Regression) 알고리즘:** 망각 곡선 이론을 적용하여 최적의 복습 주기를 계산합니다.
  * **FSRS 난이도 추적:** 사용자의 체감 난이도(Easy, Medium, Hard)를 반영하여 복습 우선순위를 동적으로 조정합니다.

### 3.2 AI 학습 분석 (Deep Learning Report)

  * **자동 채점:** Gemini Pro/Flash 모델을 활용하여 서술형 답안을 채점하고 피드백을 제공합니다.
  * **취약점 진단:** 학습 데이터를 분석하여 '유형 판단 오류', '키워드 누락' 등 구체적인 약점을 진단합니다.
  * **Audit Flow Map:** 20개 단원을 6단계 감사 흐름으로 시각화하여 학습 진행 상황을 보여줍니다.

### 3.3 소셜 학습 (Social Learning)

  * **랭킹 시스템:** 전체/그룹/대학별 랭킹을 통해 선의의 경쟁을 유도합니다.
  * **스터디 그룹:** 그룹 생성, 멤버 관리, 그룹 내 통계 기능을 제공합니다.
  * **대학교 인증:** 학교 이메일(.ac.kr) 인증을 통한 대학 대항전 기능을 지원합니다.

### 3.4 사용자 편의 기능

  * **음성 입력 (STT):** 긴 답안을 타이핑하는 대신 말로 입력할 수 있습니다. (키워드 부스팅 적용)
  * **플래시카드 모드:** 퀴즈 풀이 외에 빠른 암기 확인을 위한 플래시카드 UI를 제공합니다.
  * **다크 모드:** 시스템 설정 또는 사용자 선택에 따른 테마 변경을 지원합니다.

-----

## 4\. 성능 최적화 및 리팩토링 (Phase 0\~3.5)

대규모 트래픽과 데이터 처리를 위해 지속적인 최적화를 수행했습니다.

  * **DOM 최적화 (Phase 1):** `DocumentFragment`와 메모이제이션을 도입하여 렌더링 속도를 50\~70% 개선했습니다.
  * **이벤트 위임 (Phase 1.5):** 500개 이상의 개별 리스너를 4개의 상위 위임 리스너로 통합하여 메모리 사용량을 대폭 줄였습니다.
  * **Code Splitting (Phase 2):** `Dynamic Import`를 적용하여 초기 번들 크기를 30KB 감소시켰습니다.
  * **CSS 최적화 (Phase 3):** Tailwind CDN을 로컬 빌드 방식으로 전환하고 PurgeCSS를 적용하여 CSS 크기를 3MB → 36KB로 98.8% 감축했습니다.
  * **웹 접근성 (Phase 3.5):** 모든 Form 요소에 Label 연결 및 Name 속성을 추가하여 WCAG 표준을 준수했습니다.

-----

## 5\. 향후 로드맵: UI/UX 리팩토링 (Phase 4.0)

사용자 경험을 "SaaS 대시보드"에서 **"Digital Library (문서 중심)"** 스타일로 전환하는 대규모 UI 개편을 계획 중입니다.

### 🎨 컨셉: "Digital Library & Zen Mode"

노션(Notion)과 클로드(Claude)의 디자인 언어를 차용하여, 학습 컨텐츠에 온전히 집중할 수 있는 환경을 조성합니다.

### 🗓️ 상세 개발 계획

#### Day 1: 타이포그래피 & 컬러 시스템 재정립

  * **폰트:** 본문 가독성을 위해 `이롭게 바탕체`(Serif) 도입, UI는 `Pretendard`(Sans) 적용.
  * **컬러:** 차가운 Blue/Gray 대신 따뜻한 `Stone`, `Slate` 계열의 뉴트럴 톤 적용.

#### Day 2: 플랫 디자인 (Flat Design) 전환

  * **스타일:** 과도한 그림자(`shadow-xl`)를 제거하고, 얇은 테두리(`border`) 기반의 깔끔한 카드 UI로 변경.
  * **레이아웃:** 3단 레이아웃의 간격을 조정하여 정보 밀도는 유지하되 시각적 피로도 감소.

#### Day 3: Zen Mode (집중 모드) 고도화

  * **기능:** 포커스 모드 진입 시 사이드바를 완전히 숨기고, 문제 영역을 화면 중앙으로 확장(`max-w-4xl`).
  * **애니메이션:** 모드 전환 시 부드러운 페이드/슬라이드 효과 적용.

#### Day 4: 디테일 폴리싱 (Micro-interactions)

  * **입력창:** 텍스트 박스의 테두리를 없애고 배경을 투명하게 하여 '종이에 쓰는 느낌' 구현.
  * **버튼:** 강렬한 Solid 버튼을 줄이고, Ghost/Outline 스타일 버튼으로 교체하여 시각적 소음 최소화.

-----

*Last Updated: 2025. 11. 22.*
*License: CC BY-NC-SA 4.0*
