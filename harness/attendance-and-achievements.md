# 출석체크 & 업적 시스템

## 출석체크 (migration 046)

모바일 게임의 대표적인 재방문 유도 장치. 헤더의 "📅 출석체크" 버튼을 매일 누르면 골드를 받음.

### 데이터 구조

- `attendance_state`(user_id PK): `cycle_day`(0~7, 마지막으로 받은 날), `last_claim_date`(date, 서버 UTC), `total_claim_count`
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

7일차를 받으면 다음 클레임은 다시 1일차부터(무한 반복).

### 스트릭 규칙

`claim_attendance()`가 `last_claim_date`와 오늘(서버 UTC)을 비교:
- **오늘 이미 받음** → 에러
- **어제 받음(연속)** → `cycle_day + 1`(7 넘으면 1로 순환)
- **그 외(건너뜀 또는 첫 클레임)** → `cycle_day = 1`로 리셋. 첫 클레임은 "스트릭 끊김"으로 취급 안 함

스트릭이 끊겨도 이미 받은 보상은 회수 안 함 — 처벌보다 재방문 유도가 목적.

**알려진 단순화**: 날짜 판정이 서버(UTC) 기준이라, 한국시간 자정 근처(오후 9시~자정)엔 체감 날짜와 서버 판정 날짜가 다를 수 있음. 크리티컬하진 않지만(하루 1번 개념은 유지됨) 정밀 처리가 필요해지면 `last_claim_date`를 KST 기준으로 개선 필요.

### 클라이언트

- `attendance.js`: `fetchAttendanceState`, `claimAttendance`, `hasClaimedToday`
- `AttendanceModal.jsx`: 7일 캘린더 그리드 모달. 받은 날은 흐리게+체크, 다음 받을 날은 초록 테두리, 7일차는 2칸 보너스 카드
- 헤더 "📅 출석체크" 버튼(데스크톱+모바일)에 오늘 미수령 시 빨간 점(`.mail-unread-dot` 재사용)

### 배포 후 실사용 중 발견된 버그: "column reference total_claim_count is ambiguous" (056)

046 배포 후 실제 클릭 시 이 에러가 남. 원인은 `claim_attendance()`가 `RETURNS TABLE(..., total_claim_count integer)`로 선언돼있어 OUT 파라미터가 생기는데, `UPDATE ... SET total_claim_count = total_claim_count + 1`처럼 **별칭 없이** 쓰면 우변이 그 변수인지 컬럼인지 PostgreSQL이 판단 못 해 실패함(harness에 이미 기록된 "column reference X is ambiguous" 패턴 재발).

→ **수정(056)**: `attendance_state as att` 별칭을 붙여 `att.total_claim_count + 1`로 명시, `RETURNING * into v_updated`로 갱신 결과를 바로 반환. 반환 컬럼 그대로라 DROP 불필요.

**교훈**: `RETURNS TABLE(...)` 컬럼명과 대상 테이블 컬럼명이 겹치면(`total_claim_count`), 본문의 모든 UPDATE/INSERT에 반드시 별칭을 명시할 것 — 여러 번 겪은 패턴인데도 급하게 짜다 또 놓침. **RETURNS TABLE 컬럼명이 대상 테이블과 하나라도 겹치면, 본문의 모든 UPDATE/INSERT에 무조건 별칭을 붙이는 습관화 필요.**

### 출석체크 UI 표시 버그(자체 시뮬레이션으로 발견/수정)

배포 전 로직 시뮬레이션 중 `AttendanceModal`의 "며칠차까지 체크 표시" 계산에서 두 버그 발견:

1. **당일 미클레임 상태에서 마지막으로 받은 날 칸이 "미수령"처럼 보이던 문제** — `cycle_day`는 "마지막으로 받은 날"인데, `alreadyClaimedToday`가 false면 그 칸까지 체크 표시를 안 해버려 건너뛴 것처럼 오해될 수 있었음. `claimed = day <= displayCycleDay`로 단순화
2. **스트릭이 끊길 예정인데 이어지는 것처럼 미리 보여주던 문제** — 클라이언트가 서버와 동일한 규칙(어제 받았으면 이어짐, 아니면 리셋)으로 미리 계산하지 않아 실제론 1일차로 리셋될 상황인데 이어지는 것처럼 표시됨. `willContinueStreak`를 클라이언트에서 미리 계산해 `nextDay`/`displayCycleDay`에 반영

두 버그 모두 서버 RPC(실제 지급)엔 영향 없었음(표시 전용) — 서버는 항상 정확히 판정하므로 최악의 경우 "화면이 잘못 보였다가 클릭하면 정정"되는 정도지만, 혼란 방지를 위해 배포 전 수정함.

## 업적 시스템 (migration 047)

레벨/전직/스테이지클리어/뽑기횟수/PvP승수/출석 등 장기 목표로 플레이 동기를 부여하는 장치. 설정 탭 안 "🏆 업적" 서브탭.

### 수령 가능 알림점 (신규, 사용자 요청)

우편함(`hasUnreadMail`)/패치노트(`hasNewPatchNote`)와 동일한 빨간 점 패턴을 업적에도 적용 — 수령 가능한(조건 달성했지만 아직 안 받은) 업적이 하나라도 있으면 헤더의 "⚙️ 설정" 버튼과 설정 화면 안 "🏆 업적" 탭 버튼 둘 다에 점이 뜸.

- `App.jsx`가 `achievementStats` 객체를 (기존엔 `<Settings>` 호출부에 인라인으로만 있던 걸) **컴포넌트 최상위 변수로 끌어올려서** 헤더 알림점 계산에도 재사용 — `ACHIEVEMENT_CATALOG.some(a => !claimedKeys.has(a.key) && stats[a.stat] >= a.target)`로 판정
- `claimedAchievementKeys`를 로그인 시 `fetchClaimedAchievements(userId)`로 별도 조회해서 App.jsx에도 보관(기존엔 `Achievements.jsx`만 갖고 있었음) — 업적을 수령하면 `Achievements.jsx`의 `handleClaim`이 `onClaim` 콜백으로 App.jsx에 알려서 그 자리에서 바로 점이 사라짐(다음 로그인까지 기다릴 필요 없음)
- 순수 표시용 계산이라 서버 호출 추가 없음(이미 로드돼있는 `achievementStats`/`claimedAchievementKeys` 조합만 사용)

### 검증 방식

미션 시스템(`claim_mission_reward`)과 동일한 철학 — **클라이언트가 진행도를 신고하지 않고, 서버가 실제 게임 상태를 직접 조회해 조건 충족을 재검증**한 뒤에만 지급. `claim_achievement(p_achievement_key)` 안에 업적 키별 CASE 검증 쿼리가 있고, 통과하면 `add_gold` + `achievement_claims`에 기록(중복 방지, PK가 `(user_id, achievement_key)`).

### 카탈로그 (client, `src/lib/achievements.js`)

`ACHIEVEMENT_CATALOG`는 정적 배열로 업적을 9개 카테고리(성장/전직/스테이지/뽑기/PvP/월드보스/장비/출석/특별)로 분류함. 서버 CASE 분기와 `achievement_key`로 1:1 매칭되므로, **새 업적 추가 시 반드시 카탈로그와 `claim_achievement` 양쪽을 같이 수정**해야 함(한쪽만 고치면 UI엔 보이는데 서버가 거부하거나, 서버는 허용하는데 UI에 안 뜨는 불일치 발생).

| 카테고리 | 업적 예시 | 기준 |
|---|---|---|
| 🌱 성장 | 레벨 10/30/60/100/140/180 | 활성 몬스터 레벨 |
| 🎖️ 전직 | 1차/3차/5차/10차(128, 최종) 전직 | `unlocked_job_tier` |
| 🗺️ 스테이지 | 10/100/500/1000개 클리어 | `stage_progress`에서 `cleared=true` 카운트 |
| 🎰 뽑기 | 통산 100/1000/5000회 | 스킬(`total_skill_draws`) + 장비 4슬롯 합산 |
| 🥊 PvP | 첫 승/10승/50승/100승/복수전10승 | `pvp_wins`(053에서 첫 승 추가), `pvp_revenge_wins`(113) |
| 🐉 월드보스 | 첫 참여 | `world_boss_contributions`에 피해량 1 이상인 행(전체 주 대상, 053) |
| 🎽 장비 | 완벽한 세트 | 4슬롯 전부 같은 등급 장착(057 세트효과 로직 재사용, 059) |
| 📅 출석 | 통산 7/30/100/200/365회(069에서 100/200, 093에서 365 추가) | `attendance_state.total_claim_count` |
| 🌟 특별 | 누적 골드 획득 1M/50M/500M(114, 신규) | `profiles.lifetime_gold_earned`(114에서 `add_gold` 내부에 자체 누적) |

### 프로그레스 표시 최적화

업적 화면을 열 때마다 서버 재조회하지 않고, **`App.jsx`가 이미 들고 있는 값들을 `achievementStats`로 묶어서 그대로 내려줌** — 별도 API 없이 프로그레스바를 그림. 최종 수령 가능 여부는 어차피 서버가 재검증하므로 이 계산은 순수 표시용.

수령한 업적 목록(`achievement_claims`)만 최초 진입 시 별도 조회해 완료 뱃지 표시. 카테고리 헤더 옆에 "N/M"도 함께 표시(클라이언트 필터링만, 추가 조회 없음).

### 누적 골드 획득(lifetime) 추적 — migration 114, 신규 콘텐츠

기존 "재산" 랭킹/업적은 전부 `profiles.gold`(현재 보유액) 기준이라, 강화/합성/뽑기로 다 써버리면 그동안 열심히 번 기록이 사라지는 느낌이었음. `add_gold`는 골드가 지급되는 거의 모든 경로(자동사냥/스테이지/던전/업적/출석/PvP/월드보스/우편 클레임 등)가 공통으로 거치는 단일 지점이라, 여기에 `profiles.lifetime_gold_earned` 누적을 같이 넣어서 한 곳만 고쳐도 전부 자동 반영되게 함.

- **소급 집계 안 됨**: 102(`last_login_at`) 등 다른 신규 컬럼들과 동일하게, 배포 시점 이전에 지급된 골드는 반영 안 되고 0부터 새로 쌓임(의도된 동작)
- 이 지표를 기준으로 "🌟 특별" 카테고리에 업적 3종(100만/5000만/5억) 추가 — 다 써버려도 사라지지 않는 "진짜 성장 기록"이라는 차별점을 둠
- ⚠️ **아이콘 버그 수정(사용자 제보)**: "동전 모으기"(`lifetime_gold_1m`) 아이콘으로 썼던 🪙(Unicode 12.0, 비교적 최근 추가된 이모지)가 일부 기기/폰트에서 엑스박스로 깨져 보임 — 더 오래되고 널리 지원되는 💵로 교체(🎟️ 티켓 이모지 사건과 같은 클래스의 문제, security.md 참고할 것 없이 이번엔 애초에 최근 유니코드 버전 이모지를 피하는 방향으로 대응)
- `add_gold`는 반환타입(`void`) 그대로, `claim_achievement`도 반환타입(`integer`) 그대로라 둘 다 DROP FUNCTION 불필요
- ⚠️ **버그 수정 이력(115, 배포 직후 자체 재검토로 발견)**: 일일 무료뽑기(101)가 "뽑기 비용 실패 방지용 임시 버퍼 10만 골드를 `add_gold`로 지급했다가 뽑기 직후 시작 잔액으로 정확히 리셋"하는 트릭을 쓰는데, 114에서 `add_gold`에 `lifetime_gold_earned` 누적을 넣으면서 이 "결국 사라지는 임시 버퍼"까지 진짜로 번 골드처럼 매번 누적돼버리는 부작용이 생김(유저가 매일 5종 다 돌리면 실제 순증감 0인데 지표는 하루 최대 50만씩 허수로 불어남). `claim_daily_free_draw`의 버퍼 지급만 `add_gold` 대신 `profiles.gold` 직접 UPDATE로 바꿔서 해결 — 전체 마이그레이션에서 이 "지급 후 리셋" 패턴을 쓰는 곳이 이 함수 하나뿐임을 grep으로 확인해 다른 오염 지점은 없음

### 배포 전 자체검토로 발견한 버그: 월드보스 참여 업적이 영구 잠길 뻔함

053에서 "월드보스 첫 참여" 업적 추가 시 처음엔 진행도 표시에 `myWeekDamage`(이번 주 피해량)를 그대로 씀. 이 값은 **매주 리셋**되므로, 과거 주에 참여했지만 이번 주는 아직인 유저는 `0`이라 미달성으로 판단돼 **수령 버튼이 계속 비활성화**되는 문제.

→ **수정**: 전체 주 대상으로 "피해량 1 이상인 행이 하나라도 있는지"를 조회하는 `hasEverParticipatedInWorldBoss()`(RLS 공개라 RPC 불필요, [`world-boss.md`](./world-boss.md))를 추가해 로그인 시 확인하고, 방금 싸운 `myWeekDamage>0`도 OR로 더해 즉시 반영.

## 칭호(타이틀) 시스템 (migration 050)

일부 상위 업적은 달성하면 **칭호**를 주고 닉네임 옆에 장착해 헤더/랭킹에 자랑할 수 있음("플렉스" 요소로 재방문 유인 강화).

### 칭호를 주는 업적

| 업적 | 칭호 |
|---|---|
| `level_180` | 정점의 지배자 |
| `job_tier_5` | 전설의 전사 |
| `job_tier_10` | 조율자의 계승자 |
| `stage_clear_1000` | 차원의 정복자 |
| `gacha_5000` | 행운의 화신 |
| `pvp_win_50` | 투기장의 지배자 |
| `attendance_month` | 성실한 조련사 |
| `full_set_equipped` | 완벽주의자(060) |

모든 업적이 칭호를 주진 않음(위 목록만), 나머지는 골드 보상만.

### 구현

- `profiles.equipped_title`(text, nullable) — `set_equipped_title(p_achievement_key)`로만 변경 가능(직접 UPDATE 불가, 004의 컬럼단위 revoke 패턴)
- RPC가 **해당 업적을 실제로 수령했는지 재검증**한 뒤에만 세팅
- 칭호-업적 매핑은 서버 CASE문과 클라이언트 `TITLE_BY_ACHIEVEMENT` 양쪽에 동일 정의 — **새 칭호 추가 시 반드시 양쪽 다 수정**
- 업적 화면에서 칭호가 있는 완료 업적에 "장착"/"해제" 버튼
- `fetch_leaderboard()`(048)도 050에서 `equipped_title`을 함께 반환하도록 재정의해서 랭킹에도 칭호가 보임
- 헤더 닉네임 앞에 `[칭호]` 금색 텍스트(`app-title-badge`)

## 오늘의 할 일 체크리스트 (`DailyChecklist.jsx`)

게임 화면 상단, 탭 네비게이션 바로 위 위젯. 출석체크·무료뽑기·월드보스 도전·가이드미션의 오늘자 완료 여부를 보여주고, 미완료 클릭 시 해당 화면으로 이동. **다 완료하면 위젯 자체가 사라짐**.

- 새 서버 호출 없음 — 이미 로드된 `attendanceState`/`freeDrawUsedToday`/`missionCompleted`/`worldBossProgress`를 조합만 함
- "월드보스 도전"은 `attemptsUsed > 0`(참여 여부만, 클리어 여부 아님 — 공용 보스라 개인 클리어 개념 없음)
- 클릭 시 `dungeonActiveType`을 `'worldboss'`로 세팅해 정확히 월드보스 화면으로 이동
- `freeDrawUsedToday`는 이 위젯을 만들며 처음 `App.jsx` 최상위 state로 끌어올림(049 당시엔 `Shop.jsx` 로컬 state였음)

### 코스튬 수집가 업적 (061)

PvP 코스튬 5종 이상 보유 시 달성. `pvp_costume_inventory` 개수를 서버가 직접 세서 검증. 진행도는 로그인 시점 `fetchMyCostumes()` 개수를 그대로 씀(구매 즉시 반영은 안 되지만 실제 수령은 서버가 항상 재검증).

**난이도 참고**: PvP 재화는 `20 + 상대전투력/65`(023)라 초반 유저는 노멀 코스튬(3000~3600) 하나에도 승리 수십~백여 회 필요 — 다른 장기 업적들과 비슷한 목표로 설계된 것(코스튬은 스탯 무관 순수 수집이라 장기 목표가 자연스러움).

### 칭호 미리보기 (목표 의식 강화)

칭호를 주는 업적인데 아직 못 딴 경우, 설명 아래에 "🎖️ 칭호 "OO" 획득 가능"을 미리 보여줌(이전엔 완료 업적에만 칭호 정보가 있어 못 딴 유저는 몰랐음). `TITLE_BY_ACHIEVEMENT` 재사용, 추가 조회 없음.

## 업적 달성 개수 랭킹 (migration 066, 신규 콘텐츠)

업적 화면에 "🏅 업적 랭킹 보기" 토글로 업적 최다 달성 TOP20을 볼 수 있음. 전투력 랭킹(048/051)과 별개 경쟁 축 — 과금/그라인딩보다 "꾸준함"을 반영하는 지표.

- `achievement_claims`가 "본인만 조회" RLS라 클라이언트 직접 집계 불가 → security definer(`fetch_achievement_leaderboard`)가 전체 집계
- `primary key (user_id, achievement_key)`가 중복 카운트를 원천 차단
- 20위 밖이면 `fetch_my_achievement_rank()`로 별도 표시
- UI는 월드보스 기여자 목록과 동일한 `.worldboss-contributor-row` 재사용 — 긴 닉네임+칭호 조합 모바일 넘침 재검증

## 얼리버드(founder) 업적/칭호 (migration 070, 신규 콘텐츠)

2026-08-01 이전 가입자 전용 특별 업적. `profiles.created_at`이 기준일 이전이면 자동 자격(별도 상태 추가 없이 기존 컬럼만 확인). 칭호("얼리버드")도 함께 부여.

- `claim_achievement`/`set_equipped_title` 둘 다 CASE만 추가, 반환타입 그대로라 DROP 불필요
- 배포 시점(2026-07-18)이 기준일보다 2주 앞서 초기 유저들을 커버하도록 설계
- 기존 8개와 별개로 `special`(🌟 특별) 카테고리 신설
- 27개 업적 키 diff 완전 일치 재검증 완료

### 가이드미션 완료해도 체크리스트에 미완료로 뜨는 버그 수정 (사용자 제보)

**증상**: 가이드 미션을 완료하고 보상까지 수령했는데 "오늘의 할 일"에서 여전히 미완료로 표시.

**원인**: 미션 보상 수령(`claim_mission_reward`) 시 서버가 **곧바로 다음 미션을 새로 배정**함(4종 순환). `DailyChecklist`는 "지금 배정된 미션이 완료 상태인지"만 봐서, 보상을 받자마자 새(미완료) 미션으로 교체되며 다시 `false`가 됨 — "오늘 완료했다"는 사실이 다음 미션으로 넘어가는 순간 사라지는 구조.

**수정(1차)**: `hasClaimedMissionToday` state를 추가해 수령 순간(`handleClaimMission`) `true`로 세팅, 체크리스트엔 `missionCompleted || hasClaimedMissionToday`를 전달. 로그인/로그아웃 시점 양쪽에서 `false`로 초기화.

**⚠️ 1차 수정으로도 재발(사용자 재제보) — 진짜 근본 원인은 따로 있었음**: `handleSession`이 백그라운드 복귀나 토큰 갱신 시에도 다시 호출되는데, 이때마다 `setHasClaimedMissionToday(false)`가 함께 호출돼 매번 리셋됨 — "로그인 시점 초기화"가 실제론 "세션이 조금이라도 갱신될 때마다" 실행되고 있었음.

**2차 해결**: [`ui-and-ux.md`](./ui-and-ux.md)의 탭 유지 버그 수정(`sessionRef`로 "같은 유저 세션 재확인" 판별)이 이 문제도 함께 해결 — 별도 코드 변경 없이 자동 해결. **교훈**: 겉보기엔 다른 두 버그 제보가 사실 같은 근본 원인(세션 갱신 시 무차별 초기화)의 증상이었음.

**⚠️ 2차 해결로도 재발(사용자 3차 제보) — "페이지 새로고침"은 애초에 다른 종류의 이벤트였음**: `sessionRef` 판별은 "같은 앱 인스턴스 안 세션 갱신"(백그라운드 복귀, 토큰 리프레시)만 커버했는데, **진짜 새로고침(F5)은 앱이 처음부터 완전히 재실행**되어 `sessionRef.current`도 초기값(`null`)으로 시작함 — 새로고침이 "최초 로그인"과 동일 취급돼 매번 리셋됨. `hasClaimedMissionToday`가 **순수 React 메모리 state였고 어디에도 영속 저장 안 됐던 것**이 근본 원인.

**최종 해결**: `lib/missionClaimPersist.js`로 `hasClaimedMissionToday`를 **localStorage에 유저ID+오늘날짜로 영속화**(`dailyQuote.js`/`loginStreak.js`와 동일 패턴). 로그인 시 `hasClaimedMissionTodayPersisted(userId)`로 복원, 수령 성공 시 `markMissionClaimedToday(userId)`로 기록. 헤드리스 브라우저로 4가지 시나리오(최초/새로고침시뮬/유저분리/날짜경과리셋) 검증. **교훈**: React state만으론 "오늘 있었던 일"을 정확히 표현할 수 없음 — 새로고침에도 살아남아야 하는 값은 처음부터 로컬 저장소 기반으로 설계할 것.

## 업적 랭킹 토글 여백 조정 (사용자 피드백)

버튼+목록을 하나의 `<div>`로 묶어 바깥에만 여백을 주도록 변경(`Achievements.jsx`). 내부(버튼-목록 사이)는 완전히 붙음.

## 전투력 마일스톤 업적 (migration 083, 신규 콘텐츠)

"강자의 서막"(1만) / "압도적인 힘"(10만) / "종말의 위용"(100만, 칭호 포함) — "전투력" 자체를 목표로 하는 항목이 빠져있던 걸 채움.

- PvP 랭킹과 동일한 서버 함수 `fetch_my_combat_power()`(051)를 재사용해서 조작 방지
- 진행률 표시는 `Achievements.jsx`가 자체적으로 `fetchMyCombatPower()`를 조회해 병합(App.jsx는 원래 미보유)
- CASE만 추가, DROP 불필요, diff/33개 키 재검증 완료

## 칭호 갤러리 (신규 콘텐츠)

업적 화면 최상단에 전체 10종 칭호를 보여줌 — 해금은 이름 그대로, 미해금은 "🔒 ???"(N/10 카운트). 장착 중인 칭호는 금색 강조. 이미 있는 `claimedKeys`와 `TITLE_BY_ACHIEVEMENT`만 조합한 순수 클라이언트 UI, 새 서버 호출 없음. 10개 칩 모바일 넘침 재검증 완료.

⚠️ **버그 수정(사용자 제보)**: 처음엔 이 갤러리가 순수 `<span>` 미리보기라 클릭해도 아무 반응이 없었음 — 실제 칭호 장착/해제는 아래 업적 목록에서 해당 업적을 찾아 개별 버튼을 눌러야만 가능했음(설정 > 칭호 갤러리에서 바로 고를 수 있을 거라 기대하는 사용자 입장에서 혼란). 갤러리 칩을 `<button>`으로 바꿔서 해금된 칭호를 클릭하면(이미 있던 `handleSetTitle`을 그대로 재사용) 바로 장착/해제되도록 수정 — 서버 RPC(`set_equipped_title`) 변경 없이 클라이언트 이벤트 배선만 고침.

## 친구 추천 마일스톤 업적 (migration 089, 신규 콘텐츠)

"작은 씨앗"(5명)/"전도사"(20명, 칭호 포함) — 추천 시스템(065)/랭킹(084)은 있는데 관련 업적이 빠져있던 걸 채움. `referred_by` 직접 count(기존 `fetchMyReferralCount`와 동일 패턴). `Achievements.jsx`가 자체 조회해 병합. CASE만 추가, DROP 불필요, diff/38개 키 재검증 완료.

## 업적 카테고리 접기/펼치기 (신규 콘텐츠, UX 개선)

업적이 44개까지 늘며 스크롤이 길어져서 카테고리별 접기/펼치기 추가. **기본값**: 전부 달성한 카테고리는 접힘, 남은 게 있으면 펼침. 헤더를 한 번이라도 클릭하면 이후엔 자동판정 대신 사용자 선택이 우선(`manuallyToggledCategories`). 순수 클라이언트, 서버 호출 없음.

## 출석체크 모달에 마일스톤 진행률 안내 추가 (신규 콘텐츠)

모달 상단에 "🏅 누적 출석 N회 — 다음 업적까지 M회 남음" 표시(7/30/100/200/365 마일스톤 연동). 이미 있는 `total_claim_count`만 계산, 새 서버 호출 없음.
