# 코드 리팩토링 (사용자 요청 - 아토믹디자인/재사용/200줄 제한)

## 요청 원문 요약
전체 코드 스캔 → 재사용 가능한 컴포넌트 추출, 상수 별도 export, 파일당 200줄 제한, 아토믹디자인(atoms/molecules/organisms) 적용.

## 왜 한 번에 다 못 하는지
전체 소스가 약 15,000줄(100개 이상 파일)이고, `App.jsx`(1,494줄)/`DungeonSelect.jsx`(996줄) 같은 초대형 파일까지 전부 200줄 이하로 쪼개고 아토믹디자인으로 재배치하려면 앱 전체의 상태관리 구조 자체를 다시 짜야 함. 이 프로젝트엔 자동화된 테스트가 없고 `npm run build`는 문법/임포트 오류만 잡아줄 뿐 실제 게임플레이 동작까지 검증해주지 않음 — 라이브 서비스 중인 게임을 한 번의 대규모 리팩토링으로 통째로 갈아엎으면 조용히 깨지는 부분이 생겨도 알아챌 방법이 없음. 그래서 **단계적으로, 매 단계마다 `npm run build`로 검증하면서** 진행하기로 함.

## 1단계 완료 (이번 세션) — 전투화면 9개의 완전 중복 로직 추출

`BattleScreen`/`DungeonBattle`/`JobDungeonBattle`/`RubyDungeonBattle`/`StreakDungeonBattle`/`EliteTrialBattle`/`SealedDungeonBattle`/`WorldBossBattle`/`GuildRaidBattle` 9개 파일이 전투 하나 만들 때마다 서로 복사-붙여넣기로 만들어져 왔음(이 세션에서만도 여러 번 그렇게 함) — 그래서 **바이트 단위로 완전히 동일한 코드**가 파일마다 반복되고 있었음. 이걸 다음처럼 뽑아냄:

- **`src/hooks/useBattleFx.js`**(신규) — 캔버스 파티클 이펙트 + 화면 흔들림(`shake`) 로직. 9개 파일에서 `md5sum`으로 완전 동일함을 먼저 확인하고 통합(behavior 변경 없음 보장). `const { canvasRef, shake, spawnParticles, triggerShake } = useBattleFx();` 한 줄로 대체
- **`src/components/atoms/HpBar.jsx`**(신규, atom) — 체력바. 월드보스/길드레이드만 `toLocaleString()` 포맷이 달랐던 것도 `formatNumbers` prop 하나로 통합
- **`src/components/atoms/ExpBar.jsx`**(신규, atom) — 경험치바(경험치를 안 주는 봉인된 던전 제외 6개 파일에서 사용)
- **`src/components/molecules/BuffStatusRow.jsx`**(신규, molecule — 여러 상태 배지를 조합) — 버프/기절 상태 표시줄
- **`src/lib/elements.js`에 `ELEMENT_COLORS` 상수 추가** — 9개 파일에 중복 정의돼있던 속성별 UI 색상을 하나로

**검증 방법**: 추출 전 `md5sum`으로 각 파일의 대상 블록이 정말 동일한지 먼저 확인 → 동일하면 그대로 훅/컴포넌트로 옮기고 호출부만 교체(로직 변경 없음, 순수 구조 개선) → 매 단계 `npm run build` 통과 확인.

**성과**: 9개 파일 합계 약 3,505줄 → 약 3,020줄(약 490줄 감소, 신규 공용 파일 4개 약 130줄 추가로 순감소는 이보다 큼). 번들 크기도 약간 감소(중복 코드 제거 효과).

## 2단계 완료 (이번 세션) — 키보드 단축키 처리 통합

- **`src/hooks/useBattleHotkeys.js`**(신규) — 숫자키(1~9)/전직스킬 단축키/Space로 결과화면 나가기 처리. 7개 파일(`DungeonBattle`/`JobDungeonBattle`/`RubyDungeonBattle`/`EliteTrialBattle`/`SealedDungeonBattle`/`WorldBossBattle`/`GuildRaidBattle`)에서 사실상 동일했던 걸 통합
- **`BattleScreen.jsx`(자동사냥/도전 듀얼모드 + R키 재도전)와 `StreakDungeonBattle.jsx`(승리 시 나가기 대신 수령/이어가기 선택이라 Space 나가기 자체가 없음)는 동작이 실제로 달라서 의도적으로 제외** — 억지로 통합하면 동작이 바뀌어버릴 위험이 있어 정확히 동일한 부분만 추출하는 원칙을 지킴
- 사용하지 않게 된 `useRef` import도 3개 파일(`RubyDungeonBattle`/`EliteTrialBattle`/`SealedDungeonBattle`)에서 같이 정리
- 7개 파일 합계 추가로 약 150줄 감소, `npm run build` 통과

## 다음 단계 (아직 안 함, 순서대로 진행 예정)

1. **`useSkill` 로직 통합** — 보류. 실제로 파일마다 미묘하게 다른 동작이 있음을 확인함(전직스킬 강화 반영 여부가 패턴별로 다르고, 전직스킬 이펙트 화려함 정도도 다름) — 억지로 통합하면 게임플레이가 바뀌어버릴 위험이 있어서, "완전히 동일한 것만 추출한다"는 원칙에 따라 더 신중한 설계가 필요할 때까지 보류
2. **`App.jsx`(1,494줄) 분해** — 다음 작업 대상
3. **아토믹디자인 전면 재배치** — `organisms`/`templates` 폴더까지 구성해서 기존 `components/` 평면 구조를 계층화 (`organisms/`는 3단계에서 이미 시작함)

각 단계마다 이번처럼 "동일성 먼저 확인 → 안전하게 추출 → build 검증 → 커밋" 순서로 진행할 예정. **App.jsx 리팩토링이 끝나면 harness/ 폴더의 기능별 문서와 대조해서 실제 동작이 문서와 일치하는지 최종 점검할 예정.**

## 3단계 완료 (이번 세션) — `DungeonSelect.jsx`(996줄) 패널별 분리

`DungeonSelect.jsx`는 사실 하나의 오케스트레이터 컴포넌트 + 서로 독립적인 패널 컴포넌트 10개가 한 파일에 그대로 뭉쳐있던 구조였음(각 패널이 이미 `function XxxPanel({ ... }) { ... }` 형태로 명확히 분리돼있어서, **로직을 전혀 안 건드리고 파일만 나누는 완전히 기계적인 작업**이라 리스크가 매우 낮았음).

- **`src/components/organisms/`**(신규 폴더, 아토믹디자인 organism 계층) — `ProgressiveDungeon`/`RubyDungeonPanel`/`StreakDungeonPanel`/`SealedDungeonPanel`/`EliteTrialPanel`/`JobDungeonPanel`/`WorldBossPanel`/`GuildRaidPanel`/`TowerPanel`/`ExpeditionPanel` 10개 파일로 분리(전부 200줄 이하, 최대 143줄)
- **`src/lib/formatTime.js`**(신규) — `ExpeditionPanel`에서만 쓰던 `formatRemaining` 순수 함수를 재사용 가능한 유틸로 분리
- `DungeonSelect.jsx`는 **996줄 → 182줄**로 감소, 탭 전환 + 각 패널에 props 전달만 담당하는 순수 오케스트레이터로 정리됨
- 빌드 결과물(번들 크기)이 리팩토링 전후로 **완전히 동일**(752.47kB)함을 확인 — 로직이 한 글자도 안 바뀌었다는 강력한 방증
