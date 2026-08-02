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

## 다음 단계 (아직 안 함, 순서대로 진행 예정)

1. **`useSkill` 로직 통합** — 9개 파일에 남은 가장 큰 중복(스킬 타입별 damage/heal/stun/dot/buff_atk/buff_def/haste 분기, 파일당 약 70~90줄). 파일마다 `effMultiplier` 계산 방식이 살짝 다름(전직스킬 강화 반영 여부) — 이 차이를 훅 파라미터로 흡수할 수 있는지 설계 필요
2. **키보드 입력 처리 effect 통합** — 이것도 9개 파일에 거의 동일하게 중복
3. **각 전투화면을 200줄 이하로** — 위 1/2단계가 끝나도 파일마다 고유한 부분(보스 소스, 보상 클레임 방식, 결과 화면 문구)이 남아있어서 순수하게 얇은 래퍼 컴포넌트 + 커스텀 훅 조합으로 재설계해야 함
4. **`App.jsx`(1,494줄) 분해** — 던전별/화면별 상태를 커스텀 훅(`useDungeonState`, `useGuildState` 등)으로 뽑아내는 대규모 작업. 리스크가 가장 큼(전체 앱의 상태관리 중심축)
5. **`DungeonSelect.jsx`(996줄) 분해** — 던전 종류별 패널(`StreakDungeonPanel`, `SealedDungeonPanel` 등)이 이미 한 파일에 다 들어있음 — 각각 별도 파일로 분리
6. **아토믹디자인 전면 재배치** — `organisms`/`templates` 폴더까지 구성해서 기존 `components/` 평면 구조를 계층화

각 단계마다 이번처럼 "동일성 먼저 확인 → 안전하게 추출 → build 검증 → 커밋" 순서로 진행할 예정.
