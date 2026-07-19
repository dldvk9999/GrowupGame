# 출석체크 & 업적 시스템

## 출석체크 (migration 046)

모바일 게임의 대표적인 재방문 유도 장치. 매일 접속해서 헤더의 "📅 출석체크" 버튼을 누르면 골드를 받는다.

### 데이터 구조

- `attendance_state`(user_id PK): `cycle_day`(0~7, 마지막으로 받은 날), `last_claim_date`(date, 서버 UTC 기준), `total_claim_count`
- client select만 허용, insert/update는 전부 `claim_attendance()` RPC(security definer) 경유

### 7일 주기 보상

| 일차 | 보상 |
|---|---|
| 1 | 💰500 |
| 2 | 💰800 |
| 3 | 💰1,200 |
| 4 | 💰1,800 |
| 5 | 💰2,500 |
| 6 | 💰3,500 |
| 7 (보너스) | 💰8,000 |

7일차를 받으면 다음 클레임은 다시 1일차부터 시작(무한 반복).

### 스트릭 규칙

`claim_attendance()`가 `last_claim_date`와 오늘 날짜(`current_date`, 서버 UTC)를 비교:
- **오늘 이미 받음** → 에러(`오늘은 이미 출석체크를 했어요.`)
- **어제 받음(연속)** → `cycle_day + 1`(7 넘으면 1로 순환)
- **그 외(하루 이상 건너뜀, 또는 첫 클레임)** → `cycle_day = 1`로 리셋. 첫 클레임(`last_claim_date is null`)은 "스트릭이 끊긴 것"으로 취급하지 않음(`streak_broken = false`)

스트릭이 끊겨도 이미 받은 보상은 회수하지 않음 — 처벌보다 재방문 유도가 목적이라 끊겨도 부담 없이 다시 시작하게 설계함.

**알려진 단순화**: 날짜 판정이 서버(UTC) 기준이라, 한국 시간(UTC+9) 자정 근처(오후 9시~자정)에 접속하면 실제 체감 날짜와 서버 판정 날짜가 다를 수 있음(예: 한국시간 밤 11시는 아직 UTC로는 전날 오후 2시). 크리티컬한 문제는 아니지만(어차피 "하루에 한 번" 개념이 유지됨) 정밀한 타임존 처리가 필요해지면 `last_claim_date`를 KST 기준으로 계산하도록 개선 필요.

### 클라이언트

- `src/lib/attendance.js`: `fetchAttendanceState`, `claimAttendance`, `hasClaimedToday`(로컬에서 오늘 날짜와 `last_claim_date` 비교)
- `src/components/AttendanceModal.jsx`: 7일 캘린더 그리드 모달. 이미 받은 날은 흐리게+체크, 다음 받을 날은 초록 테두리로 하이라이트, 7일차는 2칸 차지하는 보너스 카드로 강조
- 헤더의 "📅 출석체크" 버튼(데스크톱 헤더 + 모바일 드로워 양쪽)에 오늘 미수령 시 빨간 점 뱃지(`.mail-unread-dot` 재사용) — 우편함 뱃지와 동일한 시각 언어로 통일

### 배포 후 실사용 중 발견된 버그: "column reference total_claim_count is ambiguous" (056)

046 배포 이후 실제로 출석체크 버튼을 눌러보니 이 에러가 났음. 원인은 `claim_attendance()`가 `RETURNS TABLE(..., total_claim_count integer)`로 선언돼있어서 PL/pgSQL이 `total_claim_count`라는 OUT 파라미터(변수)를 암묵적으로 만드는데, `UPDATE ... SET total_claim_count = total_claim_count + 1`처럼 **테이블 별칭 없이** 쓰면 우변의 `total_claim_count`가 그 변수를 가리키는지 `attendance_state.total_claim_count` 컬럼을 가리키는지 PostgreSQL이 판단하지 못해서 실패함(harness/security.md·dev-guide.md에 있는 "column reference X is ambiguous" 버그 패턴과 동일 원인, 다른 여러 RPC에서 이미 여러 번 겪었던 실수인데 이번에 또 반복함).

→ **수정(056)**: UPDATE에 `attendance_state as att` 별칭을 붙이고 `att.total_claim_count + 1`로 명시적으로 한정, `RETURNING * into v_updated`로 갱신 결과를 바로 받아서 반환하도록 재작성. 반환 컬럼 구성은 그대로라 DROP FUNCTION 불필요.

**교훈**: 함수의 `RETURNS TABLE(...)` 컬럼명과 그 함수가 다루는 테이블의 컬럼명이 같으면(이번처럼 `total_claim_count`), 그 함수 본문 안의 모든 UPDATE/INSERT에서 반드시 테이블 별칭으로 명시 한정할 것 — 이 프로젝트에서 이미 여러 번(009 등) 겪은 패턴인데도 새 함수를 급하게 짤 때 또 놓쳤음. **새 RPC를 작성할 때 RETURNS TABLE의 컬럼명이 대상 테이블 컬럼명과 겹치는 게 하나라도 있으면, 본문의 모든 UPDATE/INSERT에 무조건 별칭을 붙이는 습관화가 필요함.**

### 출석체크 UI 표시 버그(자체 시뮬레이션으로 발견/수정)

배포 전 로직 시뮬레이션 과정에서 `AttendanceModal`의 "며칠차까지 체크 표시할지" 계산에 두 가지 버그를 발견해서 고쳤음:

1. **당일 미클레임 상태에서 마지막으로 받은 날짜 칸이 "미수령"처럼 보이던 문제** — `cycle_day`는 "마지막으로 받은 날"인데, 초기 구현은 `alreadyClaimedToday`가 false면 그 날짜 칸까지 체크 표시를 안 해버려서(예: 3일차를 어제 받고 오늘 아직 안 왔으면 3일차 칸이 미체크로 보임) 마치 그 날을 건너뛴 것처럼 오해를 살 수 있었음. `claimed = day <= displayCycleDay`로 단순화해서 해결.
2. **스트릭이 끊길 예정인데 클라이언트가 이어지는 것처럼 미리 보여주던 문제** — 클라이언트가 `last_claim_date`(마지막 출석일)를 기준으로 "이어질지/끊길지"를 서버(`claim_attendance`)와 동일한 규칙(어제 받았으면 이어짐, 아니면 리셋)으로 미리 계산하지 않고 있어서, 실제로는 클릭 시 1일차로 리셋될 상황인데도 화면엔 "다음 날짜로 이어지는 것"처럼 표시되는 경우가 있었음. `willContinueStreak`를 클라이언트에서 미리 계산해서 `nextDay`/`displayCycleDay` 둘 다 이 예측을 반영하도록 수정.

두 버그 모두 실제 보상 지급 로직(서버 RPC)에는 영향이 없었음(표시 전용 버그) — 서버는 항상 정확하게 판정하므로 최악의 경우에도 "화면에 잘못 보였다가 클릭하면 서버가 정정"되는 정도였지만, 사용자 혼란을 막기 위해 배포 전에 수정함.

## 업적 시스템 (migration 047)

레벨/전직/스테이지클리어/뽑기횟수/PvP승수/출석 등 장기 목표를 제시해서 플레이 동기를 계속 부여하는 장치. 설정 탭 안에 "🏆 업적" 서브탭으로 들어감.

### 검증 방식

미션 시스템(`claim_mission_reward`)과 동일한 철학 — **클라이언트가 진행도를 자체 신고하지 않고, 서버가 실제 게임 상태(레벨/전직단계/클리어한 스테이지 수/뽑기 횟수/PvP 승수/출석 통산 횟수)를 직접 조회해서 조건 충족 여부를 재검증**한 뒤에만 보상을 지급함. `claim_achievement(p_achievement_key)` RPC 안에 업적 키별로 CASE 분기된 검증 쿼리가 있고, 통과하면 `add_gold` + `achievement_claims`에 기록(중복 수령 방지, PK가 `(user_id, achievement_key)`).

### 카탈로그 (client, `src/lib/achievements.js`)

`ACHIEVEMENT_CATALOG`는 정적 배열로 33개 업적을 9개 카테고리(성장/전직/스테이지/뽑기/PvP/월드보스/장비/출석/특별)로 분류함. 서버 RPC의 CASE 분기와 `achievement_key`로 1:1 매칭되므로, **새 업적을 추가할 때는 반드시 카탈로그와 `claim_achievement` RPC 양쪽을 같이 수정**해야 함(한쪽만 고치면 클라 UI엔 보이는데 서버가 거부하거나, 서버는 허용하는데 UI에 안 뜨는 불일치가 생김).

| 카테고리 | 업적 예시 | 기준 |
|---|---|---|
| 🌱 성장 | 레벨 10/30/60/100/140/180 | 활성 몬스터 레벨 |
| 🎖️ 전직 | 1차/3차/5차 전직 | `unlocked_job_tier` |
| 🗺️ 스테이지 | 10/100/500/1000개 클리어 | `stage_progress`에서 `cleared=true` 카운트 |
| 🎰 뽑기 | 통산 100/1000/5000회 | 스킬(`total_skill_draws`) + 장비 4슬롯(`equipment_gacha_progress.total_draws`) 합산 |
| 🥊 PvP | 첫 승/10승/50승 | `profiles.pvp_wins` (053에서 첫 승 추가) |
| 🐉 월드보스 | 첫 참여 | `world_boss_contributions`에 피해량 1 이상인 행이 있는지(전체 주 대상, 053에서 추가) |
| 🎽 장비 | 완벽한 세트 | 4슬롯 전부 같은 등급으로 장착(`057`의 세트효과 판정 로직 재사용, 059에서 추가) |
| 📅 출석 | 통산 7회/30회/100회/200회/365회 (069에서 100/200, 093에서 365 추가) | `attendance_state.total_claim_count` |

### 프로그레스 표시 최적화

업적 화면을 열 때마다 서버에 진행도를 새로 조회하지 않고, **App.jsx가 이미 들고 있는 값들(활성 몬스터 레벨/전직단계, `clearedStageIds.size`, `profile.total_skill_draws` + `equipmentDrawProgress` 합산, `profile.pvp_wins`, `attendanceState.total_claim_count`)을 `achievementStats`로 묶어서 그대로 내려줌** — 별도 API 호출 없이 프로그레스바를 그림. 실제 수령 가능 여부의 최종 판단은 어차피 서버가 재검증하므로, 이 클라이언트 계산은 순수 표시용이고 약간의 지연/오차가 있어도 보안엔 영향 없음.

수령한 업적 목록(`achievement_claims`)만 로그인 후 최초 진입 시 별도로 조회해서 완료 뱃지를 표시함. 각 카테고리 헤더 옆에도 "N/M" 형태로 그 카테고리 안에서 몇 개를 완료했는지 같이 보여줌(클라이언트에서 카탈로그 필터링만으로 계산, 추가 조회 없음).

### 배포 전 자체검토로 발견한 버그: 월드보스 참여 업적이 영구 잠길 뻔함

053에서 "월드보스 첫 참여" 업적을 추가하면서, 처음엔 진행도 표시에 `worldBossProgress.myWeekDamage`(이번 주 피해량)를 그대로 썼음. 그런데 이 값은 **매주 리셋**되기 때문에, 과거 주에 월드보스에 참여했지만 이번 주는 아직 도전 안 한 유저는 `myWeekDamage=0`이라 클라이언트가 "미달성"으로 판단해서 **수령 버튼이 계속 비활성화**되는 문제가 있었음(서버는 전체 주 기준으로 정확히 판정하니 실제로는 수령 자격이 있는데도 버튼을 못 눌러서 사실상 영구히 막히는 셈).

→ **수정**: `world_boss_contributions` 전체 주를 대상으로 "피해량 1 이상인 행이 하나라도 있는지"를 별도로 조회하는 `hasEverParticipatedInWorldBoss()`를 추가(RLS가 "누구나 조회 가능"이라 RPC 없이 직접 조회 가능, `world-boss.md` 참고)해서 로그인 시점에 한 번 확인하고, 여기에 이번 세션 중 방금 싸운 `myWeekDamage>0`도 OR 조건으로 더해 즉시 반영되게 함.

## 칭호(타이틀) 시스템 (migration 050)

일부 상위 업적은 달성하면 **칭호**를 주고, 그 칭호를 닉네임 옆에 장착해서 헤더/랭킹에 자랑할 수 있음(다른 유저에게 보이는 "플렉스" 요소로 업적 시스템의 재방문 유인을 강화).

### 칭호를 주는 업적

| 업적 | 칭호 |
|---|---|
| `level_180` | 정점의 지배자 |
| `job_tier_5` | 전설의 전사 |
| `stage_clear_1000` | 차원의 정복자 |
| `gacha_5000` | 행운의 화신 |
| `pvp_win_50` | 투기장의 지배자 |
| `attendance_month` | 성실한 조련사 |
| `full_set_equipped` | 완벽주의자 (060에서 추가) |

모든 업적이 칭호를 주는 건 아니고(위 6개만), 나머지 업적은 골드 보상만 있음.

### 구현

- `profiles.equipped_title`(text, nullable) — `set_equipped_title(p_achievement_key)` RPC로만 변경 가능(직접 UPDATE 불가, 004의 컬럼단위 revoke 패턴 그대로 적용됨)
- RPC가 **해당 업적을 실제로 수령했는지(`achievement_claims`에 있는지) 재검증**한 뒤에만 칭호를 세팅함 — 클라이언트가 임의 문자열을 칭호로 박아넣는 것 방지
- 칭호-업적 매핑은 서버 RPC의 CASE문과 클라이언트 `TITLE_BY_ACHIEVEMENT`(`src/lib/achievements.js`) 양쪽에 동일하게 정의되어 있음 — **새 칭호를 추가할 때는 반드시 양쪽 다 수정**해야 함(업적 카탈로그와 동일한 동기화 주의사항)
- 업적 화면에서 칭호가 있는 완료된 업적에 "장착"/"해제" 버튼이 뜸(이미 장착 중이면 버튼이 "칭호 해제"로 바뀜)
- `fetch_leaderboard()`(048)도 050에서 `equipped_title`을 함께 반환하도록 재정의해서, 랭킹 화면에도 다른 유저의 칭호가 그대로 보임
- 헤더 닉네임 앞에 `[칭호]` 형태로 금색 텍스트 표시(`app-title-badge` 클래스, 랭킹 화면과 동일한 스타일 재사용)

## 오늘의 할 일 체크리스트 (`DailyChecklist.jsx`)

게임 화면(전투/스테이지 등) 상단, 탭 네비게이션 바로 위에 뜨는 작은 위젯. 출석체크·무료뽑기·월드보스 도전·가이드미션 4가지의 오늘자 완료 여부를 한눈에 보여주고, 미완료 항목을 클릭하면 바로 해당 화면(출석체크 모달/상점/던전 탭의 월드보스 서브탭)으로 이동함. **4개 다 완료하면 위젯 자체가 사라져서** 화면을 불필요하게 가리지 않음.

- 새 서버 호출 없음 — `App.jsx`가 이미 로그인 시점에 로드해둔 `attendanceState`/`freeDrawUsedToday`/`missionCompleted`/`worldBossProgress`를 그대로 조합만 함
- "월드보스 도전"은 `worldBossProgress.attemptsUsed > 0`(오늘 한 번이라도 도전했는지)로 판정 — 클리어 여부가 아니라 "참여했는지"만 봄(어차피 공용 보스라 개인 클리어 개념이 없음)
- 클릭하면 `App.jsx`가 이미 갖고 있던 `dungeonActiveType`(던전 탭 내부 서브탭 controlled state)을 `'worldboss'`로 직접 세팅해서, 던전 탭의 기본 서브탭이 아니라 정확히 월드보스 화면으로 한 번에 이동함
- `freeDrawUsedToday`는 이 위젯을 만들면서 처음으로 `App.jsx` 최상위 state로 끌어올림(049 배포 당시엔 `Shop.jsx`가 자체적으로 로컬 state로만 관리했었음) — 로그인 시점 `Promise.all`에 포함시켜서 로그아웃 시 초기화 목록에도 추가함

### 코스튬 수집가 업적 (061)

PvP 코스튬 5종 이상 보유하면 달성. `pvp_costume_inventory` 개수를 서버가 직접 세서 검증(`claim_achievement`의 `costume_collector` 분기). 진행도 표시는 `App.jsx`가 로그인 시점에 `fetchMyCostumes()`로 조회한 개수를 그대로 씀 — PvP 상점에서 새로 사도 다음 로그인까지는 즉시 반영 안 되지만(다른 몇몇 스탯과 동일한 지연 패턴), 실제 수령 가능 여부는 서버가 항상 최신 상태로 재검증하므로 문제없음.

**난이도 참고**: PvP 재화 획득은 `20 + 상대전투력/65`(023)라 초반 유저는 노멀 코스튬(3000~3600) 하나 사는 데도 승리 수십~백여 회가 필요할 수 있음 — "코스튬 수집가"(5종)는 다른 장기 업적들(스테이지 1000클리어, 뽑기 5000회 등)과 비슷하게 오래 걸리는 목표로 설계된 것이라 문제로 보지 않았음(코스튬은 스탯 영향 없는 순수 수집이라 장기 목표가 자연스러움).

### 칭호 미리보기 (목표 의식 강화)

칭호를 주는 업적인데 아직 안 딴 경우, 설명 아래에 "🎖️ 칭호 "OO" 획득 가능"을 미리 보여줌(이전엔 완료한 업적에만 칭호 정보가 표시돼서, 아직 못 딴 유저는 그 업적이 칭호를 주는지조차 몰랐음). `TITLE_BY_ACHIEVEMENT` 매핑을 그대로 재사용, 추가 조회 없음.

## 업적 달성 개수 랭킹 (migration 066, 신규 콘텐츠)

업적 화면에 "🏅 업적 랭킹 보기" 토글을 추가해서, 업적을 가장 많이 달성한 유저 TOP20을 볼 수 있음. 전투력 랭킹(048/051)과는 완전히 별개의 경쟁 축 — 課금/그라인딩보다 "꾸준함과 다양한 콘텐츠 완주"를 반영하는 지표라 전투력이 낮아도 상위권에 들 수 있음.

- `achievement_claims`가 "본인만 조회" RLS라 클라이언트가 직접 집계 불가능해서, `fetch_leaderboard`와 동일한 패턴으로 security definer RPC(`fetch_achievement_leaderboard`)가 전체 유저를 집계함
- `achievement_claims`의 `primary key (user_id, achievement_key)`가 중복 카운트를 원천 차단하므로 집계가 항상 정확함
- 20위 밖이면 `fetch_my_achievement_rank()`로 내 순위만 별도 표시(랭킹/월드보스와 동일한 아이디어)
- UI는 월드보스 기여자 목록과 동일한 `.worldboss-contributor-row` 클래스를 재사용(닉네임 `ellipsis` 처리가 이미 되어있어 안전) — 재사용 전에 긴 닉네임+칭호 조합으로 모바일 넘침 여부를 Playwright로 재검증함(방금 발견한 인벤토리 버그를 계기로 습관화)

## 얼리버드(founder) 업적/칭호 (migration 070, 신규 콘텐츠)

2026-08-01 이전에 가입한 유저 전용 특별 업적. `profiles.created_at`이 기준일 이전이면 자동으로 달성 자격이 생김(별도 서버 상태 추가 없이 이미 있는 가입일 컬럼만 확인). 칭호("얼리버드")도 함께 부여됨.

- `claim_achievement`/`set_equipped_title` 둘 다 CASE 분기만 추가하는 재정의, 반환타입(integer/void) 그대로라 DROP FUNCTION 불필요
- 배포 시점(2026-07-18)이 기준일(2026-08-01)보다 2주 앞서 있어서, 이 기간에 가입한 초기 유저들을 의미있게 커버하도록 설계함
- 카테고리는 기존 8개(성장/전직/스테이지/뽑기/PvP/월드보스/장비/출석)와 별개로 `special`(🌟 특별) 신설
- 클라이언트/서버 27개 업적 키 diff로 완전 일치 재검증 완료

### 가이드미션 완료해도 체크리스트에 미완료로 뜨는 버그 수정 (사용자 제보)

**증상**: 가이드 미션을 완료하고 보상까지 수령했는데, "오늘의 할 일" 체크리스트에서는 여전히 미완료로 표시됨.

**원인**: 미션 보상을 수령(`claim_mission_reward`)하면 서버가 **곧바로 다음 미션을 새로 배정**함(가이드 미션은 4종이 계속 순환하는 구조). `DailyChecklist`는 "지금 이 순간 배정된 미션이 완료 상태인지"(`missionCompleted`, `isMissionComplete(mission, ...)`)만 보고 있었는데, 보상을 받자마자 `mission`이 새(아직 미완료인) 미션으로 교체되면서 `missionCompleted`가 다시 `false`가 되어버림 — "오늘 미션을 완료했었다"는 사실 자체가 다음 미션으로 넘어가는 순간 사라지는 구조였음.

**수정(1차)**: `App.jsx`에 `hasClaimedMissionToday` state를 추가해서, 미션 보상을 실제로 수령하는 순간(`handleClaimMission`) `true`로 세팅. 체크리스트에는 `missionCompleted || hasClaimedMissionToday`를 전달해서, 다음 미션이 배정돼도 "오늘 이미 한 번 완료했다"는 사실이 유지되도록 함. 로그인 시점과 로그아웃 시점 양쪽에서 `false`로 초기화(하루가 지나 재접속하는 경우, 다른 계정으로 전환하는 경우 모두 깨끗하게 리셋됨).

**⚠️ 1차 수정으로도 재발함(사용자 재제보) — 진짜 근본 원인은 따로 있었음**: `handleSession`이 앱을 백그라운드로 보냈다가 복귀하거나 토큰이 자동 갱신될 때도 다시 호출되는데, 이때마다 (탭 유지 버그와 동일한 원인으로) `setHasClaimedMissionToday(false)`가 함께 호출되어 매번 리셋되고 있었음 — "로그인 시점 초기화" 로직이 실제로는 "세션이 조금이라도 갱신될 때마다" 실행되고 있었던 것. 즉 미션을 완료한 뒤 앱을 잠깐이라도 백그라운드로 보냈다가 돌아오면 `hasClaimedMissionToday`가 다시 `false`로 리셋되어 체크리스트가 미완료로 되돌아갔음.

**최종 해결**: [`ui-and-ux.md`](./ui-and-ux.md)의 "탭 전환/백그라운드 복귀 시 마지막 탭이 유지 안 되던 버그" 수정(`sessionRef`로 "같은 유저의 세션 재확인"을 판별해서 리셋 로직 전체를 건너뜀)이 이 문제도 함께 해결함 — 더 이상 세션 갱신만으로는 `hasClaimedMissionToday`가 리셋되지 않으므로, 별도 코드 변경 없이 자동으로 고쳐짐. **교훈**: 겉보기엔 다른 두 버그 제보(탭 리셋, 미션 재완료 표시)가 사실은 같은 근본 원인(세션 갱신 시 무차별 초기화)에서 나온 증상이었음 — 비슷한 시점에 리셋되는 여러 state가 있다면 그 초기화 로직 자체를 먼저 의심해볼 필요가 있음.

## 업적 랭킹 토글 여백 조정 (사용자 피드백)

"업적 랭킹 보기" 버튼과 그 아래 목록 사이에 불필요한 간격이 있던 걸, 버튼+목록 전체를 하나의 `<div>`로 묶어서 그 묶음의 바깥(위/아래)에만 여백을 주도록 변경(`Achievements.jsx`). 내부(버튼-목록 사이)는 완전히 붙게 됨.

## 전투력 마일스톤 업적 (migration 083, 신규 콘텐츠)

"강자의 서막"(전투력 10,000) / "압도적인 힘"(전투력 100,000) / "종말의 위용"(전투력 1,000,000, 칭호 포함) — 이전까지 업적 카테고리에 "전투력" 자체를 목표로 하는 항목이 빠져있던 걸 채움.

- 조작 방지를 위해 클라이언트가 계산한 값을 믿지 않고, **PvP 랭킹과 동일한 서버 함수 `fetch_my_combat_power()`**(장비 보너스 포함, 051)를 `claim_achievement` 안에서 직접 호출해서 검증함 — 새 계산 로직을 만들지 않고 이미 검증된 함수를 재사용
- 화면 표시(진행률 프로그레스바)용으로는 `Achievements.jsx`가 자체적으로 `fetchMyCombatPower()`를 조회해서 `stats`에 병합함(App.jsx는 원래 전투력을 안 들고 있어서, 이 화면에서만 별도로 조회 — 실제 판정은 어차피 서버가 다시 하므로 여기 값은 순수 표시용)
- `claim_achievement`/`set_equipped_title` CASE만 추가, 반환타입 그대로라 DROP 불필요, diff/33개 키 재검증 완료

## 칭호 갤러리 (신규 콘텐츠)

업적 화면 최상단에 전체 10종 칭호를 한눈에 보여주는 갤러리 추가 — 해금한 칭호는 이름 그대로, 미해금은 "🔒 ???"로 표시해서 "얼마나 모았는지"와 "얼마나 남았는지"를 동시에 보여줌(N/10 카운트 포함). 현재 장착 중인 칭호는 금색으로 강조. 이미 있는 `claimedKeys`(업적 화면이 이미 조회해둔 값)와 `TITLE_BY_ACHIEVEMENT` 매핑만 조합한 순수 클라이언트 UI라 새 서버 호출 없음. 10개 칩 조합으로 모바일 넘침 재검증 완료.

## 친구 추천 마일스톤 업적 (migration 089, 신규 콘텐츠)

"작은 씨앗"(5명 추천)/"전도사"(20명 추천, 칭호 포함) — 친구 추천 시스템(065)/추천 랭킹(084)이 있었는데 정작 이걸 목표로 하는 업적이 빠져있던 걸 채움. `profiles.referred_by`를 직접 count해서 검증(기존 `fetchMyReferralCount` 클라이언트 함수와 동일한 쿼리 패턴). `Achievements.jsx`가 자체적으로 `fetchMyReferralCount()`를 조회해서 진행률 표시에 병합(전투력과 동일한 패턴 — App.jsx는 이 값을 원래 안 들고 있어서 여기서만 추가 조회). `claim_achievement`/`set_equipped_title` CASE만 추가, 반환타입 그대로라 DROP 불필요, diff/38개 키 재검증 완료.
