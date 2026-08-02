# 코드 리팩토링 (사용자 요청 - 아토믹디자인/재사용/200줄 제한)

## 요청 원문 요약
전체 코드 스캔 → 재사용 가능한 컴포넌트 추출, 상수 별도 export, 파일당 200줄 제한, 아토믹디자인(atoms/molecules/organisms) 적용.

## 왜 한 번에 다 못 하는지
전체 소스가 약 15,000줄(100개 이상 파일)이고, 자동화된 테스트가 없어서 `npm run build`(문법/임포트 오류만 잡음)만으로는 실제 게임플레이 동작까지 검증이 안 됨. 라이브 서비스 중인 게임을 한 번의 대규모 리팩토링으로 갈아엎으면 조용히 깨지는 부분을 알아챌 방법이 없어서, **기능 하나씩 "자기완결적인지/완전히 동일한지 먼저 확인 → 안전하게 추출 → `npm run build` 검증 → 커밋"** 순서로 단계적으로 진행 중.

## 진행 요약

| 단계 | 대상 | 방법 | 결과 |
|---|---|---|---|
| 1 | 전투화면 9개 공통 이펙트/표시 컴포넌트 | `md5sum`으로 완전 동일함 확인 후 추출 | `useBattleFx`, `atoms/HpBar`, `atoms/ExpBar`, `molecules/BuffStatusRow`, `ELEMENT_COLORS` 신설 |
| 2 | 전투화면 키보드 단축키 | 동일 로직만 선별 추출(다른 동작은 제외) | `useBattleHotkeys` 신설(7개 파일 적용) |
| 3 | `DungeonSelect.jsx`(996줄) | 이미 분리돼있던 패널 함수 10개를 파일만 이동(로직 무변경) | `components/organisms/` 10개 파일, `DungeonSelect.jsx` 996→182줄 |
| 4 | `App.jsx`(1,494줄) | 자기완결적인 던전형 기능 9개를 커스텀 훅으로 추출 | `hooks/` 9개 파일 신설, `App.jsx` 1,494→1,186줄 |

전 단계 `npm run build` 통과. 3단계는 빌드 번들 바이트 크기가 리팩토링 전후 완전히 동일(752.47kB)함을 확인해서 "로직 무변경"을 기계적으로 증명함.

## 1단계 — 전투화면 9개 공통 로직 추출

`BattleScreen`/`DungeonBattle`/`JobDungeonBattle`/`RubyDungeonBattle`/`StreakDungeonBattle`/`EliteTrialBattle`/`SealedDungeonBattle`/`WorldBossBattle`/`GuildRaidBattle` 9개 파일이 매번 복사-붙여넣기로 만들어져서 바이트 단위로 동일한 코드가 반복되고 있었음.

- **`src/hooks/useBattleFx.js`** — 캔버스 파티클 + 화면 흔들림(`shake`) 로직
- **`src/components/atoms/HpBar.jsx`** — 체력바(월드보스/길드레이드의 `toLocaleString()` 포맷 차이는 `formatNumbers` prop으로 흡수)
- **`src/components/atoms/ExpBar.jsx`** — 경험치바
- **`src/components/molecules/BuffStatusRow.jsx`** — 버프/기절 상태 표시줄
- **`src/lib/elements.js`에 `ELEMENT_COLORS` 상수 추가**

9개 파일 합계 약 3,505줄 → 약 3,020줄.

## 2단계 — 키보드 단축키 처리 통합

- **`src/hooks/useBattleHotkeys.js`** — 숫자키(1~9)/전직스킬 단축키/Space로 결과화면 나가기. 7개 파일에 동일하게 있던 걸 통합
- `BattleScreen.jsx`(자동사냥/도전 듀얼모드 + R키 재도전)와 `StreakDungeonBattle.jsx`(수령/이어가기 선택이라 Space 나가기 자체가 없음)는 동작이 실제로 달라서 의도적으로 제외

## 3단계 — `DungeonSelect.jsx`(996줄) 패널별 분리

이미 `function XxxPanel({ ... }) { ... }` 형태로 분리돼있던 패널 10개를 파일만 옮기는 완전히 기계적인 작업(로직 변경 없음, 리스크 최소).

- **`src/components/organisms/`**(아토믹디자인 organism 계층) — `ProgressiveDungeon`/`RubyDungeonPanel`/`StreakDungeonPanel`/`SealedDungeonPanel`/`EliteTrialPanel`/`JobDungeonPanel`/`WorldBossPanel`/`GuildRaidPanel`/`TowerPanel`/`ExpeditionPanel` (전부 200줄 이하, 최대 143줄)
- **`src/lib/formatTime.js`** — `formatRemaining` 유틸 분리
- `DungeonSelect.jsx` 996줄 → 182줄

### harness 문서 대조 검증 (사용자 요청)
`sealed-dungeon.md`/`character-and-growth.md`/`streak-dungeon.md`에 적힌 안내 문구(`InfoTooltip`)와 조건 분기가 분리된 `organisms/*.jsx` 파일에 그대로 남아있음을 직접 대조 확인 — 불일치 0건.

## 4단계 — `App.jsx`(1,494줄) 커스텀 훅 분해

`DungeonSelect.jsx`처럼 파일만 옮기는 기계적 작업이 불가능해서(상태 74개+함수 36개가 렌더링 전반에 얽혀있음), 기능별로 "완전히 자기완결적인지(다른 기능과 공유하는 state가 없는지) 먼저 `grep`으로 확인 → 커스텀 훅으로 추출 → 초기 로드 `Promise.all`/로그아웃 리셋 블록 등 외부 참조는 훅의 setter 반환값으로 연결 → build 검증" 순서로 진행.

완료한 9개 훅(전부 `src/hooks/`):
- **`useEliteTrial.js`** — 정예의 시련(상태 4 + 핸들러 2)
- **`useSealedDungeon.js`** — 봉인된 던전(상태 5 + 핸들러 2, 외부 상태 의존 전혀 없음)
- **`useGuildRaid.js`** — 길드 레이드(상태 5 + 함수 3)
- **`useRubyDungeon.js`** — 루비 던전(상태 4 + 핸들러 2)
- **`useStreakDungeon.js`** — 연승 던전(상태 5 + 핸들러 5, 수령/이어가기/포기 3갈래라 가장 복잡)
- **`useWorldBoss.js`** — 월드보스(상태 6 + 함수 3)
- **`useJobDungeon.js`** — 전직 던전(상태 3 + 핸들러 2)
- **`useTower.js`** — 무한의 탑(상태 4 + 핸들러 2)
- **`useExpGoldDungeon.js`** — 경험치/골드 던전(상태 5 + 핸들러 2, 콤보/정예/행운/골든타임/요일보너스 5가지 토스트 분기 포함)

`App.jsx` **1,494줄 → 1,186줄** (약 21% 감소).

### 작업 중 발견/수정한 것들
- ⚠️ **오래된 버그**: 월드보스 처치 토스트가 "용의 버프 20배"로 남아있었음(144에서 실제 배율은 이미 2배로 하향됐는데 문구만 안 고쳐짐) — "2배"로 수정, `world-boss.md`에도 반영
- ⚠️ **자체 실수(빌드가 즉시 잡아줌)**: `useTower` 훅 호출을 `setHasUnreadMail` 선언보다 앞에 배치해서 "선언 전 사용"(temporal dead zone) 오류가 날 뻔했음 — `npm run build`가 바로 실패시켜서 위치를 옮겨 수정. 매 단계 build 검증을 거르지 않는 이유를 보여준 사례

### 여기서 멈춘 이유
남은 13개 함수(`handleSession`/`handlePickStarter`/`handleSelectStage`/`handleClear`/`handleIdleGain`/`handleAdvance`/`handleLogout`/`handleClaimMission` 등)는 전부 **인증/스타터선택/스테이지진행/미션 같은 게임 전체의 핵심 흐름**이라, 지금까지 뽑아낸 "던전 하나"처럼 깔끔하게 분리되는 독립적인 기능이 아님. 예를 들어 `handleClear`(스테이지 클리어) 하나만 봐도 `activeMonster`/`clearedStageIds`/`currentStageIndex`/`pendingStoryContent`/미션/업적 통계 등 최소 6~7개의 서로 다른 상태와 얽혀있어서, 억지로 훅으로 뽑아내려면 사실상 앱 전체 상태관리를 다시 설계해야 함 — "자기완결적임을 먼저 확인하고 안전할 때만 추출"이라는 원칙을 지키기 위해 여기서 멈춤.

## 아직 남은 것 (다음 세션 과제)

- `App.jsx`(1,186줄) — 핵심 게임루프 상태관리 재설계가 필요해서 리스크가 가장 큼
- 전투화면 9개(200~340줄대) — `useSkill` 로직 통합 보류 중(파일마다 실제 동작 차이 발견: 전직스킬 강화 반영 여부, 이펙트 화려함 정도)
- `PvP.jsx` 등 아직 안 살펴본 대형 컴포넌트들
- 아토믹디자인 `templates` 계층 미착수(현재 `organisms`까지만 도입)

각 단계마다 "동일성/자기완결성 먼저 확인 → 안전하게 추출 → build 검증 → 커밋" 원칙 유지.
