# 감린이 v4 개발 방향서 (초안)

## 왜 v4인가?
- v3.x는 단일 파일 거대 스크립트와 로컬스토리지 스키마 이슈로 유지보수 비용이 급증했습니다.
- v4는 **state/engine/main(ports)** 3층으로 나누고, 점진적 마이그레이션(legacy stub) 전략을 채택합니다.

## 설계 원칙
1) **안전한 진화**: 기존 사용자 데이터 보존, 점진적 교체
2) **모듈성**: 상태/엔진/포트 분리, 테스트 용이
3) **접근성 & 다크모드**: 시스템/라이트/다크 모드 + a11y 강제
4) **외부 모델 의존 최소화**: 모델 교체가 쉬운 어댑터

## 구조
```
/
├─ main.v4.js        # 엔트리. 포트/이벤트 바인딩
├─ lib/state.js      # 전역 상태(스키마 버전 포함)
├─ lib/engine.js     # 순수 로직(채점/힌트 파이프라인 래퍼)
├─ legacy/v3-stub.js # v3에서 v4로 포워딩
└─ docs/ROADMAP_v4.md
```

## 단계별 마이그레이션
- **Phase 0**: 레포 준비(PR 템플릿/로드맵/문서)
- **Phase 1**: v4 shell 배치(main/state/engine 빈 껍데기) + v3 stub
- **Phase 2**: 채점/힌트 API 어댑터 분리, 에러 핸들링 개선
- **Phase 3**: UI 쪼개기(컴포넌트화), 접근성 보강 테스트

## 브레킹 체인지 가이드
- localStorage 키 네임스페이스 `gamlini.v4.*`로 격리
- 스키마 마이그레이션 유틸 제공(migrateV3toV4)

## TODO (요약)
- [ ] index.html에 `<script type=module src="/legacy/v3-stub.js">` 주입
- [ ] README.html 링크 보정 및 다크모드 a11y 핫픽스 CSS 분리

