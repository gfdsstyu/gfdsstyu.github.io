# 🎯 리팩토링 실행 계획

**최종 업데이트**: 2025-01-07
**현재 진행률**: Phase 3.1 완료 (약 60% 완료)
**브랜치**: `claude/organize-refactoring-docs-011CUtMUmTAfiePDTVGJDPzL`

---

## 📍 현재 상황

### ✅ 완료된 작업
- ✅ Phase 2.1-2.5: core 및 quiz 모듈 11개 생성 완료
- ✅ Phase 2.6: 중복 함수 완전 제거 (200줄 감소)
- ✅ Phase 3.1: features/filter/ 모듈 분리 완료
- ✅ 버그 수정 11건 완료

### 🎯 다음 목표
1. **다음**: Phase 3.2-3.5 - 기능 모듈 분리 (summary, calendar, settings, import/export)
2. **나중**: Phase 4 - 추가 기능 모듈 (report, flashcard, achievements 등)
3. **최종**: Phase 5 - 이벤트 리스너 정리 및 최종 클린업

---

## 🔄 Phase 3: 기능 모듈 분리

### ✅ Phase 3.1: features/filter/ (완료)
- features/filter/filterCore.js 생성 완료
- 출처 필터링 기능 모듈화 완료

### 🔴 Phase 3.2: features/summary/ (다음 작업)
**타겟 함수**:
- updateSummary()
- updateSummaryHighlight()
- refreshPanels()

**예상 소요 시간**: 1.5시간

### Phase 3.3: features/calendar/
**타겟 함수**:
- renderCalendarMonth()
- bindCalendarDateClick()
- renderStats()
- renderStatsDateNav()

**예상 소요 시간**: 2시간

### Phase 3.4: features/settings/
**타겟 함수**:
- openApiModal() / closeApiModal()
- ensureApiKeyGate()
- openSettingsModal() / closeSettingsModal()
- 다크모드 변경 핸들러
- AI 모델 변경 핸들러

**예상 소요 시간**: 1.5시간

### Phase 3.5: services/dataImportExport.js
**타겟 함수**:
- mergeQuizScores()
- export/import/merge 이벤트 핸들러

**예상 소요 시간**: 1.5시간

---

## 📅 Phase 4: 추가 기능 모듈 (낮은 우선순위)

### Phase 4.1: features/report/
- reportCore.js, charts.js, analysis.js
- **예상 소요 시간**: 4-5시간

### Phase 4.2: features/flashcard/
- flashcardCore.js
- **예상 소요 시간**: 2-3시간

### Phase 4.3: features/achievements/
- achievementsCore.js, achievementChecks.js
- **예상 소요 시간**: 3-4시간

### Phase 4.4: features/explorer/
- explorerCore.js
- **예상 소요 시간**: 1-2시간

### Phase 4.5: features/review/
- reviewCore.js, hlrDataset.js
- **예상 소요 시간**: 2-3시간

---

## 🚀 Phase 5: 최종 정리

### Phase 5.1: 이벤트 리스너 정리
- index.html의 모든 addEventListener를 모듈로 이동
- app.js에서 초기화 함수로 통합
- **예상 소요 시간**: 2-3시간

### Phase 5.2: 전역 브릿지 제거
- window.* 노출 최소화
- 모듈 간 직접 import 사용
- **예상 소요 시간**: 3-4시간

### Phase 5.3: index.html 정리
- `<script type="module">` 내용 최소화
- 모든 로직을 모듈로 이동
- **예상 소요 시간**: 2-3시간

---

## 📊 전체 타임라인 요약

| Phase | 작업 | 소요 시간 | 누적 시간 |
|-------|------|-----------|-----------|
| 2.1-2.6 | core/quiz 모듈 + 중복 제거 | 완료 ✅ | - |
| 3.1 | filter 모듈 | 완료 ✅ | - |
| 3.2-3.5 | 기능 모듈 분리 | 6.5h | 6.5h |
| 4.x | 추가 기능 모듈 | 12-17h | 18.5-23.5h |
| 5.x | 최종 정리 | 7-10h | 25.5-33.5h |

**총 예상**: 25-33시간 (3-4일 집중 작업)

---

## ⚠️ 주의사항

### 모듈 생성 시 반드시:
1. ✅ 모듈 파일 생성 (적절한 디렉토리)
2. ✅ 함수 export (named export 사용)
3. ✅ JSDoc 주석 추가
4. ✅ app.js에 import
5. ✅ window.* 전역 노출 (필요 시)
6. ✅ index.html 중복 제거
7. ✅ 동작 테스트
8. ✅ 명확한 커밋 메시지

### 테스트 시 반드시:
- ✅ 브라우저 콘솔 에러 없음
- ✅ 해당 기능 정상 작동
- ✅ localStorage 데이터 보존
- ✅ 다른 기능에 영향 없음

### 절대 하지 말 것:
- ❌ 여러 Phase를 한 번에 작업
- ❌ 테스트 없이 커밋
- ❌ localStorage 데이터 손실 위험 작업

---

## 📈 진행 상황 추적

### Phase 2 체크리스트
- [x] 2.1-2.5: core/quiz 모듈 생성 ✅
- [x] 2.6: 중복 함수 제거 ✅

### Phase 3 체크리스트
- [x] 3.1: features/filter/ 분리 ✅
- [ ] 3.2: features/summary/ 분리
- [ ] 3.3: features/calendar/ 분리
- [ ] 3.4: features/settings/ 분리
- [ ] 3.5: services/dataImportExport 분리

### Phase 4 체크리스트
- [ ] 4.1: features/report/
- [ ] 4.2: features/flashcard/
- [ ] 4.3: features/achievements/
- [ ] 4.4: features/explorer/
- [ ] 4.5: features/review/

### Phase 5 체크리스트
- [ ] 5.1: 이벤트 리스너 정리
- [ ] 5.2: 전역 브릿지 제거
- [ ] 5.3: index.html 정리

---

**다음 작업**: Phase 3.2 (features/summary/ 분리)
