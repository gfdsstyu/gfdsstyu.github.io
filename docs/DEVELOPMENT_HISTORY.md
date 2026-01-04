# 개발 기록 (Development History)

## 프로젝트 개요
**프로젝트명:** KICPA Audit Standard Study (GAMLINI)
**저장소:** gfdsstyu.github.io
**라이선스:** CC BY-NC-SA 4.0 (Attribution-NonCommercial-ShareAlike)

## 개발 통계

### 전체 통계
- **총 커밋 수:** 132개
- **개발 기간:** 2025년 11월 (진행 중)
- **주요 기여자:**
  - Claude (AI Assistant): 68 커밋 (51.3%)
  - Goalapaduck: 65 커밋 (48.7%)

### 프로젝트 구조
```
gfdsstyu.github.io/
├── index.html              # 메인 애플리케이션
├── questions.json          # 문제 데이터 (433KB)
├── styles.css              # 스타일시트
├── js/
│   ├── app.js             # 애플리케이션 진입점
│   ├── config/            # 설정 파일
│   ├── core/              # 핵심 모듈 (eventBus, dataManager, storageManager, stateManager)
│   ├── engine/            # 추천 엔진
│   ├── features/          # 기능 모듈
│   │   ├── achievements/  # 업적 시스템
│   │   ├── calendar/      # 캘린더
│   │   ├── explorer/      # 탐색기
│   │   ├── filter/        # 필터
│   │   ├── flashcard/     # 플래시카드
│   │   ├── quiz/          # 퀴즈 (grading, navigation)
│   │   ├── report/        # 리포트 (분석, 차트)
│   │   ├── review/        # 복습 (HLR 데이터셋, 난이도 추적)
│   │   ├── settings/      # 설정
│   │   ├── stt/           # 음성인식 (STT)
│   │   └── summary/       # 요약
│   ├── services/          # 외부 서비스 (Gemini API, Google STT API, Web Speech API)
│   ├── state/             # 상태 관리
│   ├── ui/                # UI 컴포넌트
│   └── utils/             # 유틸리티
└── docs/
    ├── GAMLINI_2.0_DETAILED_DEVELOPMENT_PLAN.md
    ├── REFACTORING_PLAN.md
    └── PR_TEMPLATE.md
```

---

## 주요 개발 이력

### 2025년 11월 16일
**업적 시스템 대폭 확장**
- 25개의 새로운 업적 타입 추가 (모든 티어)
- 광범위한 업적 시스템 구현
- 볼륨 업적 티어 재구조화
- avg_90, avg_95 업적에 완료 요구사항 추가
- 챕터 9 이름 업데이트 (IT 환경 및 서비스 조직 TOC 포함)

**설정 및 데이터 업데이트**
- config.js 업데이트
- analysis.js 업데이트
- questions.json 데이터 업데이트

### 2025년 11월 15일
**딥러닝 리포트 기능 강화**
- Tab 4 (일일 학습 기록) 추가
- PDF 내보내기에 Tab 4 옵션 추가 (기본 비활성화)
- AI 코칭을 토글 뷰로 변경 (다크모드 개선)
- 코칭 팁 가독성 향상 (일관된 라이트 배경)
- Part 구분자 가시성 개선
- 패스워드 입력을 form으로 감싸 브라우저 경고 제거
- 라이트 모드 텍스트 가시성 개선 및 리포트 탭 색상 통일

**HLR-FSRS 하이브리드 시스템 구현**
- 하이브리드 HLR-FSRS 난이도 추적 시스템 구현

**모바일 최적화**
- 모바일용 API 키 검증 수정 (ensureApiKeyGate)
- 리포트 AI 분석에서 API 키 접근 수정

**데이터 업데이트**
- questions.json 지속적 업데이트

### 2025년 11월 12일
**UI/UX 개선**
- 캘린더 그리드 간격 조정 (시각 디자인 개선)
- 라이트 모드에서 채점 결과 제목 텍스트 대비 개선
- 캘린더 타일 간격 축소 (컴팩트화)
- AI 채점 박스에서 유사도 점수 위 간격 축소
- 차트 범례에서 골든/데드 크로스 숨김

**데이터 업데이트**
- questions.json 업데이트

### 2025년 11월 11일
**음성 입력 (STT) 기능 통합 - 대규모 개발**

이 날은 STT 기능 통합을 위한 집중 개발이 이루어진 날로, 총 40개 이상의 커밋이 발생했습니다.

**주요 기능 구현:**
- 음성 텍스트 변환 (Speech-to-Text) 기능 추가
- Google STT API 통합
- Web Speech API 실시간 스트리밍 STT 추가
- 음성 입력 버튼 UI/UX 개선
  - 텍스트 영역 우하단 배치
  - 아이콘 전용 미니멀 디자인
  - 실시간 타이머 및 60초 자동 정지 기능

**iOS 호환성 개선 (반복적 디버깅):**
- iOS Chrome에서의 STT 호환성 개선
- WAV 오디오 변환 추가 (iOS Google STT 호환성)
- MP4 형식 감지 개선
- WebM duration 메타데이터 버그 해결을 위한 MP4 포맷 사용
- Opus 코덱 처리 (MP4/WebM)
- OGG_OPUS 인코딩 추가

**성능 최적화:**
- AudioContext duration 체크 제거 (처리 속도 개선)
- timeslice 제거 (re-muxing 오버헤드 제거)
- 인코딩 파라미터 최적화

**타임아웃 튜닝 (반복적 테스트 및 조정):**
- 60s → 57s → 50s → 55s → 45s → 30s → 27s → 55s → 27s
- 최종: 27초 타임아웃 (25초 성공, 30초 실패 테스트 기반)
- Google STT API 길이 제한 준수
- 오디오 duration 검증 추가

**에러 처리 및 디버깅:**
- 상세한 로깅 추가
- CORS 에러 핸들링
- iOS 감지 및 에러 로깅 강화
- Naver Clova STT 제거 (Google STT만 사용)

**UI 배치 개선:**
- 음성 입력 버튼을 채점 버튼과 같은 행에 배치
- 텍스트 영역 우하단으로 최종 이동

**총 PR 수:** 약 20개 (대부분 claude/integrate-stt-voice-input 브랜치)

### 2025년 11월 10일
**업적 시스템 확장**
- 신규 업적 10개 추가 및 구현
- 히든 업적 '정상 직전' (D-1) 추가
- 챕터별 마스터 업적에 1회독 완료 조건 추가

**UI/UX 기능 추가**
- 플래시카드 물음 부분 토글 기능 추가
- 스크롤 시 상단바 자동 숨김/표시 기능 추가
- 학습 범위 필터 및 단원 네비게이터 접기/펼치기 기능 추가

**리포트 및 PDF 기능 개선**
- 스냅샷 불러오기 후 오답노트 버튼 작동 수정
- PDF 탭 선택 및 오답노트 버튼 수정
- 차트 탭 PDF 내보내기 개선
- PDF 옵션 모달을 리포트 모달 위에 확실히 표시되도록 개선

**브랜치 병합**
- main 브랜치 병합 (STT 기능 통합)

**문서화**
- README.html 업데이트

### 2025년 11월 9일
**프로젝트 관리 개선**
- PR 템플릿 생성 (PR_TEMPLATE.md)
- 코드 리팩토링 (Global Bridge Phase 5)

---

## 기술 스택 분석

### 프론트엔드
- **HTML5/CSS3**: 메인 UI
- **Tailwind CSS**: 유틸리티 우선 CSS 프레임워크
- **Vanilla JavaScript**: 모듈화된 JavaScript 아키텍처

### 주요 기능 모듈
1. **Core System**
   - Event Bus (이벤트 기반 아키텍처)
   - Data Manager (데이터 관리)
   - Storage Manager (로컬 스토리지 관리)
   - State Manager (상태 관리)

2. **Learning Features**
   - Quiz System (문제 풀이)
   - Flashcard System (플래시카드)
   - Review System with HLR-FSRS (복습 시스템)
   - Achievements System (업적 시스템)

3. **Analysis & Reporting**
   - Deep Learning Report (딥러닝 리포트)
   - Charts & Visualization (차트 및 시각화)
   - AI-powered Analysis (AI 분석)
   - PDF Export (PDF 내보내기)

4. **AI Integration**
   - Gemini API (AI 채점 및 분석)
   - Google STT API (음성 인식)
   - Web Speech API (실시간 음성 인식)

5. **UI/UX**
   - Calendar View (캘린더 뷰)
   - Explorer (탐색기)
   - Filter System (필터 시스템)
   - Dark/Light Mode (다크/라이트 모드)
   - Responsive Design (반응형 디자인)

---

## 주요 개발 패턴

### 반복적 개선 (Iterative Refinement)
특히 STT 기능 구현에서 명확하게 드러난 개발 패턴:
- iOS 호환성 문제 해결을 위한 반복적 디버깅
- 타임아웃 값 최적화를 위한 실험적 접근
- 오디오 포맷 및 코덱 선택 최적화

### 기능 중심 모듈화 (Feature-based Modularity)
- 각 기능이 독립적인 모듈로 분리
- Core 시스템과 Features 시스템의 명확한 분리
- 서비스 레이어 분리 (Gemini, Google STT, Web Speech)

### 사용자 경험 우선 (UX-first Approach)
- 지속적인 UI/UX 개선 (간격, 색상, 가시성)
- 접근성 개선 (다크/라이트 모드)
- 모바일 최적화

---

## Pull Request 통계

### 주요 브랜치
- `claude/deep-learning-report-charts-*`: 딥러닝 리포트 및 차트 기능
- `claude/integrate-stt-voice-input-*`: STT 음성 입력 통합
- `claude/hybrid-hlr-fsrs-difficulty-*`: HLR-FSRS 하이브리드 시스템
- `claude/gamlini-2-0-ux-enhancement-*`: UX 개선
- `claude/add-completion-achievement-conditions-*`: 업적 조건 추가
- `gfdsstyu-patch-*`: 직접 패치

### 병합된 PR 수
- 총 166개 이상의 Pull Request가 병합됨
- 평균적으로 하루 10개 이상의 PR 병합 (활발한 개발 기간 기준)

---

## 주요 마일스톤

### Phase 1: 기초 시스템 구축
- 퀴즈 시스템 기본 구현
- 데이터 관리 시스템 구축
- 플래시카드 기능 추가

### Phase 2: AI 통합 및 분석 기능
- Gemini API 통합 (AI 채점)
- 딥러닝 리포트 시스템 구축
- 차트 및 시각화 추가

### Phase 3: 음성 인식 기능 (STT)
- Google STT API 통합
- Web Speech API 추가
- iOS 호환성 개선
- 실시간 음성 입력 UI 구현

### Phase 4: 업적 및 동기부여 시스템
- 업적 시스템 구축
- 25개 이상의 업적 타입 추가
- 히든 업적 구현
- 챕터별 마스터 시스템

### Phase 5: UX 최적화 및 고급 기능
- HLR-FSRS 하이브리드 복습 시스템
- PDF 내보내기 기능
- 다크/라이트 모드 완성도 향상
- 모바일 최적화

---

## 개발 인사이트

### 성공 요인
1. **모듈화된 아키텍처**: 기능 추가 및 수정이 용이
2. **반복적 개선**: 실제 사용 피드백을 바탕으로 지속적 개선
3. **AI 협업**: Claude AI와 개발자의 효과적인 협업
4. **사용자 중심**: UX/UI에 대한 지속적인 관심과 개선

### 도전 과제
1. **플랫폼 호환성**: 특히 iOS에서의 STT 기능 구현
2. **API 제약사항**: Google STT API의 길이 제한 등
3. **성능 최적화**: 대용량 데이터 (questions.json 433KB) 처리

### 향후 계획
- 지속적인 UX 개선
- 추가 AI 기능 통합
- 성능 최적화
- 새로운 학습 기능 추가

---

## 라이선스
CC BY-NC-SA 4.0 (Attribution-NonCommercial-ShareAlike)

---

**Last Updated:** 2025-11-16
**Document Version:** 1.0
