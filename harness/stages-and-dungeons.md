# 스테이지 & 던전

관련 파일: `stages.js`, `stageStory.js`, `StageSelect.jsx`, `dungeonStages.js`, `dungeon.js`, `DungeonSelect.jsx`, `DungeonBattle.jsx`, `jobDungeon.js`, `jobDungeonApi.js`, `JobDungeonBattle.jsx`

> 던전 탭에는 경험치/골드/전직 던전 외에 **월드보스** 서브탭도 있음 — 전체 유저 공용 주간 레이드 콘텐츠라 별도 문서 [`world-boss.md`](./world-boss.md)에 정리함.

## 스테이지 시스템

- **100챕터 × 10스테이지 = 1000스테이지**, `stage_id`는 1~1000 순번(`toStageIndex(chapter, stage)`)
- 각 챕터 10번째 스테이지는 **보스**(같은 챕터 잡몹보다 체력/공격력 배율 ↑)
- 챕터별 속성은 `fire→water→grass` 3개씩 순환 배정
- 몬스터 스탯은 전체 진행도(index)에 비례해 절차적으로 스케일링(`getStageEnemy`)
- **스토리 진행**: 새 챕터 첫 진입 시 `ChapterStory` 배너 표시(`getChapterStory`, 화면 중앙), 서브스테이지 진입마다 전투 로그에 짧은 플레이버 텍스트(`getStageFlavor`)
- **스테이지 잠금 해제**: `stage_id===1` 이거나 이전 스테이지가 클리어됨 → 오픈. 클리어한 스테이지는 언제든 자유 재도전 가능
- **스테이지 선택 UI**(`StageSelect.jsx`): 챕터를 좌우로 스와이프하는 카드 캐러셀로 표시. 카드에는 대표 몬스터 이미지, 챕터명/속성, 클리어 진행도, 짧은 스토리 요약이 들어감. 카드를 선택하면 하단에 해당 챕터의 10개 서브스테이지 그리드가 나타남. 잠긴 챕터는 회색 처리+자물쇠 아이콘, 현재 위치엔 "현재" 뱃지.

### 난이도 공식

```
index = (chapter-1)*10 + stage
isBoss = (stage === 10)
chapterStep = 1 + (chapter-1)*0.05              // 챕터(10스테이지) 단위 계단식 상승
midChapterStep = stage >= 5 ? 1.15 : 1          // 같은 챕터 안에서도 5번째 스테이지부터 한 단계 더 상승
stepMultiplier = chapterStep * midChapterStep
hp  = round((30 + index*7.5*(isBoss?3.0:1)) * stepMultiplier)
atk = round((4 + index*0.85*(isBoss?2.6:1)) * stepMultiplier)
def = round((3 + index*0.4*(isBoss?2.2:1)) * stepMultiplier)
```

- migration 030에서 **대폭 상향**됨(전직을 거듭할수록 스테이지가 너무 쉬워진다는 피드백 반영) — 기존 대비 계수 자체가 커졌고, **5스테이지째부터 챕터 내에서도 한 번 더 강해지는 계단**(`midChapterStep`)이 추가됨. 챕터가 바뀔 때(10스테이지)도 `chapterStep`이 그대로 한 단계 더 오름 — 즉 "5마다 한 번, 10마다 한 번 더" 체감되는 이중 계단 구조
- `def`는 방어력 신설 시(스탯 밸런스 조정) 추가된 것으로, 몬스터/보스/일반던전보스/전직던전보스 전부 적용됨
- 데미지 계산은 [`combat.md`](./combat.md)의 `mitigateDamage` 공식으로 경감됨
- 적 공격 텀은 **1.9초**(`BattleScreen.jsx`의 `ENEMY_ATTACK_INTERVAL`)
- ⚠️ 이 상향으로 최후반(챕터100/스테이지10) 보스 골드 보상이 약 69만 골드까지 치솟아서, `add_gold` 1회 상한도 400000→**1,000,000**으로 재상향함(migration 030)
- 실제 플레이해보고 너무 세거나 약하면 `stages.js`/`dungeonStages.js`/`jobDungeon.js`의 계수를 조정하면 됨

### 보상 공식

```
expReward  = round(hp * (isBoss ? 1.5 : 0.85))
goldReward = (round(hp * (isBoss ? 0.9 : 0.4)) + stage*2) * 5
```

서버 `calc_stage_gold`도 동일 공식을 SQL로 그대로 반영(골드는 서버가 최종 계산, `def`는 골드 공식에 영향 없음).

### 자동사냥 보상

```
hp = max(10, round(8 + chapter*2.0 + playerLevel*3.0))
expReward  = max(2, round(hp*0.25))
goldReward = max(5, round(hp*0.15)*5*8)
```

- 챕터/레벨 가중치를 대폭 올려서(기존 0.6/0.8 → 2.0/3.0) **레벨이 높거나 진행 챕터가 높을수록 자동사냥 보상이 눈에 띄게 커짐**
- 자동사냥 처치 텀은 **1.5초**
- 서버 `calc_idle_gold`도 동일 공식 반영

⚠️ 난이도 상향으로 최후반 챕터(100) 보스 골드가 `add_gold` 기존 상한(100000)을 넘어설 수 있어서, 상한을 **400000**으로 재상향함(migration 012).

## 일일 던전 (경험치/골드)

`DungeonSelect.jsx`, `DungeonBattle.jsx`, `dungeonStages.js`, `dungeon.js`:

- **경험치 던전**, **골드 던전** 두 종류, 각각 **하루 3회**만 입장 가능(서울시간 **오전 8시** 기준 초기화, `dungeon_attempts` 테이블 + `use_dungeon_attempt` RPC가 서버에서 검증)
- **순차 진행형**: 1층부터 시작, 깨야 다음 층으로 이동. 실패하면 그 층에 그대로 머무름(계속 재도전 가능, 하루 3회 한도 내에서). `dungeon_progress` 테이블(유저별 `cleared_stage`)로 진행도 추적, `use_dungeon_attempt`가 진행도 기준으로 **몇 층인지 서버가 직접 결정**(클라이언트가 층을 선택하지 않음). 10층까지 다 깨면 10층을 반복 도전 가능
- 각 던전 10층 구성, 층마다 고정 보스(`dungeonBoss(stage)`):
  ```
  hp  = round(220 + stage^1.6 * 185)
  atk = round(20 + stage^1.5 * 13)
  def = round(15 + stage^1.4 * 9)
  ```
- 경험치 던전은 EXP 위주(`hp*3.2`) + 골드 소량(`hp*0.6`), 골드 던전은 반대
- 전투는 `DungeonBattle.jsx`가 담당 — `BattleScreen`의 챌린지 모드만 떼어낸 단순화 버전(자동사냥 없음), 승리 시 `activeMonster`와 동일한 성장 저장 경로(`persistMonsterGrowth`) 사용
- 골드는 `use_dungeon_attempt`가 발급한 `dungeon_sessions` 세션 id로 `claim_dungeon_reward`를 호출해 받음(세션당 1회만 지급, 보안 이력은 [`security.md`](./security.md)). 클리어 시 `dungeon_progress.cleared_stage`도 같은 RPC가 함께 갱신
- 입장은 전투 시작 "전에" 소모됨(패배해도 복구 안 됨)
- 던전 탭 안의 서브탭(경험치/골드/전직) 선택 상태는 `App.jsx`의 `dungeonActiveType`으로 끌어올려져 있음 — 전투 후 목록으로 돌아와도 마지막에 보던 서브탭이 유지됨
- `Tab`/`Shift+Tab` 키보드 단축키로 경험치→골드→전직 던전 순환 이동 가능

## 전직 던전

`JobDungeonBattle.jsx`, `jobDungeon.js`, `jobDungeonApi.js`:

- 전직(Lv.30/60/100/140/180)은 레벨업만으로 자동 적용되지 않고 **전직 던전을 클리어해야** 실제로 스탯 배율/전용 스킬/외형이 적용됨(자세한 전직 시스템은 [`character-and-growth.md`](./character-and-growth.md))
- 전직 던전은 순차적으로만 진행 가능(전 단계 안 깨면 다음 단계 도전 불가, `start_job_dungeon` RPC가 레벨+이전단계 완료 여부 검증), **하루 횟수 제한은 없음**(일일 던전과 다름)
- 승리하면 경험치는 얻지만, **전직 자체(외형/스탯/스킬 적용)는 별도로 `claim_job_dungeon` RPC를 호출**해야 반영됨(`job_dungeon_sessions`로 "진짜 입장→클리어"를 서버가 검증, 세션 위조 불가)

### 전직 던전 보스 스탯

| 단계 | 필요 레벨 | 체력 | 공격력 | 방어력 |
|---|---|---|---|---|
| 1차 | 30 | 2,600 | 130 | 90 |
| 2차 | 60 | 6,200 | 260 | 220 |
| 3차 | 100 | 13,000 | 430 | 420 |
| 4차 | 140 | 28,000 | 780 | 840 |
| 5차 | 180 | 58,000 | 1,450 | 1,680 |

- 같은 레벨대 일반 던전보다 훨씬 강하게 잡음 — 기본공격만 연타해서는 못 이기고 스킬 로테이션(특히 회복기)이 필요하도록 설계
- 승리 시 경험치 보상도 있음(`getJobDungeonBoss`에서 `expReward` 계산)
