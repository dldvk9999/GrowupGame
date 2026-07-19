# 스테이지 & 던전

관련 파일: `stages.js`, `stageStory.js`, `StageSelect.jsx`, `dungeonStages.js`, `dungeon.js`, `DungeonSelect.jsx`, `DungeonBattle.jsx`, `jobDungeon.js`, `jobDungeonApi.js`, `JobDungeonBattle.jsx`

> 던전 탭에는 경험치/골드/전직 던전 외에 **월드보스** 서브탭도 있음 — 전체 유저 공용 주간 레이드 콘텐츠라 별도 문서 [`world-boss.md`](./world-boss.md)에 정리함.

## 스테이지 시스템

- **100챕터 × 10스테이지 = 1000스테이지**, `stage_id`는 1~1000 순번(`toStageIndex(chapter, stage)`)
- 각 챕터 10번째 스테이지는 **보스**(같은 챕터 잡몹보다 체력/공격력 배율 ↑)
- 챕터별 속성은 `fire→water→grass` 3개씩 순환 배정. 선택한 챕터 패널에 속성 배지가 뜨는데, 원래 "화속성/수속성/초속성" 텍스트를 22px 원형 배지에 넣었더니 좁아서 개행이 어색하게 깨지는 문제가 있었음 — 텍스트 대신 아이콘(🔥/💧/🌿)으로 교체해서 해결(`StageSelect.jsx`의 `ELEMENT_ICON`)
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
- migration 040에서 **일반(비보스) 몹만 추가로 1.8배 상향**됨(`NORMAL_MONSTER_BOOST`) — 실측 결과 보스 배율(hp×3.0/atk×2.6)에 비해 일반 몹이 상대적으로 너무 물렁해서(고레벨·고전직·강화 장비 기준으로도 스킬 1방에 끝나고 받는 피해도 미미) 보스는 그대로 두고 일반 몹만 별도로 올림. 서버 `calc_stage_gold`도 동일 배율로 동기화
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
- ⚠️ **버그 수정 이력(037)**: `grant_idle_reward(p_chapter, p_player_level)`가 이 두 파라미터를 client가 보낸 값 그대로 신뢰해서, devtools로 과장된 값을 반복 호출하면 실제 진행도와 무관하게 골드를 무제한 파밍할 수 있었음. 서버가 `owned_monsters`(실제 레벨)/`stage_progress`(실제 클리어한 최고 챕터)에서 직접 계산하도록 수정 — 함수 시그니처는 그대로라 클라이언트 코드 변경은 불필요했음
- **🌟 황금 몬스터 이벤트 (migration 062, 신규 콘텐츠)**: 자동사냥 처치마다 서버가 자체적으로 5% 확률(`random() < 0.05`)을 판정해서, 당첨되면 그 처치의 골드 보상이 **3배**로 지급됨. 서버가 스스로 랜덤 판정하고 결과(`is_golden`)만 반환하는 구조라 클라이언트가 조작할 수 없음(2.5초 최소 간격 쿨다운과 결합해서 평균 약 50초에 1회꼴로 발생). 당첨되면 "🌟 황금 몬스터 발견! 골드 3배 획득" 토스트가 뜸. `grant_idle_reward`의 반환 타입이 `integer` → `table(gold, is_golden)`로 바뀌어서 `DROP FUNCTION` 선행 필요했음(062에 포함)

⚠️ 난이도 상향으로 최후반 챕터(100) 보스 골드가 `add_gold` 기존 상한(100000)을 넘어설 수 있어서, 상한을 **400000**으로 재상향함(migration 012).

## 일일 던전 (경험치/골드)

`DungeonSelect.jsx`, `DungeonBattle.jsx`, `dungeonStages.js`, `dungeon.js`:

- **경험치 던전**, **골드 던전** 두 종류, 각각 **하루 3회**만 입장 가능(서울시간 **오전 8시** 기준 초기화, `dungeon_attempts` 테이블 + `use_dungeon_attempt` RPC가 서버에서 검증). 화면 안내문에 다음 초기화까지 **실시간 카운트다운**(`useCountdownToDaily8AM`, `lib/countdown.js`)이 표시됨 — UTC 서버시각을 KST(UTC+9, 정수 오프셋)로 환산해서 계산하므로 타임존 라이브러리 없이도 정확함
- **순차 진행형**: 1층부터 시작, 깨야 다음 층으로 이동. 실패하면 그 층에 그대로 머무름(계속 재도전 가능, 하루 3회 한도 내에서). `dungeon_progress` 테이블(유저별 `cleared_stage`)로 진행도 추적, `use_dungeon_attempt`가 진행도 기준으로 **몇 층인지 서버가 직접 결정**(클라이언트가 층을 선택하지 않음). 최고층까지 다 깨면 최고층을 반복 도전 가능
- **최고층 500층**(사용자 피드백으로 079에서 10→500 상향, `use_dungeon_attempt`의 하드코딩된 상한값 변경). **500층 상향 작업 중 재검증하다 발견/함께 수정한 것**:
  - `calc_dungeon_gold`에 상한 클램프가 없어서 약 103층부터 `add_gold`의 100만 상한을 초과하기 시작해(500층에선 약 1230만) 골드 지급 자체가 실패하는 치명적 버그가 될 뻔했음 → 080에서 `least(1000000, ...)` 클램프 추가
  - 경험치도 500층에서 1230만까지 치솟아(레벨250 필요경험치의 150배 이상) 한 번의 클리어로 극단적인 레벨업 폭주가 생길 뻔했음 → 클라이언트(`dungeonStages.js`)에 20만 상한 클램프 추가(경험치는 서버 검증 없이 클라이언트가 계산해서 저장하는 구조라 여기서 클램프)
  - 진행률 표시(`dungeon-progress-track`)가 원래 "1층~최고층까지 점 하나씩" 렌더링하는 방식이었는데, 500개를 그대로 그리면 심각한 성능/UX 문제가 생겨서 진행바(퍼센트) 형태로 교체
- 각 던전 500층 구성, 층마다 고정 보스(`dungeonBoss(stage)`):
  ```
  hp  = round(220 + stage^1.6 * 185)
  atk = round(20 + stage^1.5 * 13)
  def = round(15 + stage^1.4 * 9)
  ```
- 경험치 던전은 EXP 위주(`hp*3.2`) + 골드 소량(`hp*0.6`), 골드 던전은 반대
- 전투는 `DungeonBattle.jsx`가 담당 — `BattleScreen`의 챌린지 모드만 떼어낸 단순화 버전(자동사냥 없음), 승리 시 `activeMonster`와 동일한 성장 저장 경로(`persistMonsterGrowth`) 사용
- 골드는 `use_dungeon_attempt`가 발급한 `dungeon_sessions` 세션 id로 `claim_dungeon_reward`를 호출해 받음(세션당 1회만 지급, 보안 이력은 [`security.md`](./security.md)). 클리어 시 `dungeon_progress.cleared_stage`도 같은 RPC가 함께 갱신
- ⚠️ `claim_dungeon_reward`는 "세션 생성 후 최소 2초"가 지나야 클레임 가능함(037 보안패치) — 다만 이건 "전투를 실제로 이겼는지" 자체를 검증하는 건 아니고, devtools로 입장 직후 바로 클레임하는 가장 단순한 우회만 막는 부분적 완화책임. 자세한 내용/한계는 [`security.md`](./security.md)
- 입장은 전투 시작 "전에" 소모됨(패배해도 복구 안 됨)
- 던전 탭 안의 서브탭(경험치/골드/전직) 선택 상태는 `App.jsx`의 `dungeonActiveType`으로 끌어올려져 있음 — 전투 후 목록으로 돌아와도 마지막에 보던 서브탭이 유지됨
- `Tab`/`Shift+Tab` 키보드 단축키로 경험치→골드→전직 던전 순환 이동 가능

## 전직 던전

`JobDungeonBattle.jsx`, `jobDungeon.js`, `jobDungeonApi.js`:

- 전직(Lv.30/60/100/140/180)은 레벨업만으로 자동 적용되지 않고 **전직 던전을 클리어해야** 실제로 스탯 배율/전용 스킬/외형이 적용됨(자세한 전직 시스템은 [`character-and-growth.md`](./character-and-growth.md))
- 전직 던전은 순차적으로만 진행 가능(전 단계 안 깨면 다음 단계 도전 불가, `start_job_dungeon` RPC가 레벨+이전단계 완료 여부 검증), **하루 횟수 제한은 없음**(일일 던전과 다름)
- 승리하면 경험치는 얻지만, **전직 자체(외형/스탯/스킬 적용)는 별도로 `claim_job_dungeon` RPC를 호출**해야 반영됨(`job_dungeon_sessions`로 "진짜 입장→클리어"를 서버가 검증, 세션 위조 불가)
- ⚠️ "세션 생성 후 최소 3초"가 지나야 `claim_job_dungeon` 클레임 가능함(037 보안패치) — 전직 던전은 하루 입장 횟수 제한이 없어서, 이 시간 게이트가 없으면 레벨 조건만 채우고 전투 없이 1~5차 전직을 전부 즉시 완료할 수 있었음. 다만 이것도 "실제로 이겼는지"를 완전히 검증하는 건 아닌 부분적 완화책([`security.md`](./security.md) 알려진 한계 참고)

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

## 챕터 클리어 축하 보너스 (migration 063, 신규 콘텐츠)

각 챕터의 마지막 스테이지(10번째, 보스)를 **처음** 클리어하면 `챕터번호 × 5000` 골드가 축하 우편으로 자동 발송됨(예: 챕터10 클리어 시 5만골드, 챕터100 클리어 시 50만골드 — 최대치도 `add_gold` 상한 100만 이내로 안전).

- `clear_stage(p_stage_id)`가 `insert ... on conflict do update`로 진행도를 기록하기 **직전에** 기존 `cleared` 상태를 먼저 조회해서 "이번이 처음 클리어인지" 판정 — 이미 깬 보스를 재도전(반복 클리어)해도 보너스가 또 나가지 않음
- `mails.source_key`를 `'chapter_clear_' || 챕터번호`로 유니크하게 만들어서 이중 안전장치(재도전으로 어쩌다 판정이 잘못돼도 우편 유니크 제약이 중복 지급을 막음)
- 함수 반환값(`integer`, 기존 스테이지 클리어 골드)은 그대로라 `DROP FUNCTION` 불필요 — 챕터 보너스는 반환값과 무관하게 별도 우편으로만 지급됨
- 클라이언트(`App.jsx`의 `handleClear`)는 `clearedStageIds`에 아직 없던 스테이지 + 10의 배수인 스테이지 조합으로 "챕터 보스 첫 클리어"를 낙관적으로 판단해서 즉시 우편 뱃지를 띄우고 축하 토스트를 보여줌(정확한 값은 우편함 진입 시 항상 다시 확인되므로, 클라이언트 판단이 살짝 틀려도 실제 지급 여부엔 영향 없음)

## 던전 10층 완주 축하 보너스 (migration 064, 신규 콘텐츠)

경험치/골드 던전을 각각 처음 10층까지 완주하면 골드 20,000 축하 우편이 자동 발송됨. 챕터 클리어 보너스(063)와 동일한 설계 패턴:

- `claim_dungeon_reward`가 진행도 갱신 직전에 기존 `cleared_stage`를 조회해서 "이번이 처음 10층 완주인지" 판정(이미 10층을 찍은 뒤 반복 도전하는 경우엔 보너스 없음)
- `mails.source_key`(`dungeon_full_clear_exp`/`dungeon_full_clear_gold`)로 이중 안전장치
- 037에서 이미 고쳐진 핵심 보안 로직(세션 검증, 2초 최소경과 체크)은 diff로 그대로 유지됨을 확인 후 배포
