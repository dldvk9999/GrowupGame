# 랭킹 유저 상세 프로필 팝업 (migration 166/167, 신규 콘텐츠, 사용자 요청)

관련 파일: `PublicProfileModal.jsx`, `lib/publicProfile.js`, migration 166/167

## 개요

랭킹에서 유저 행을 클릭하면 그 사람의 상세 스펙(장비/강화수치/레벨/전투력/코스튬/던전 클리어 정보/전직 단계/소속 길드)을 팝업으로 보여주는 기능. 골드/이메일 등 민감정보는 전혀 포함하지 않고, 이미 여러 리더보드에서 공개적으로 노출해온 것과 같은 급의 정보만 반환함.

## 서버 설계

### `fetch_public_profile(p_user_id uuid)` (166)

`fetch_my_combat_power`(120)가 이미 하던 계산(`calc_monster_stats`/`calc_equipped_stat_bonus`/`calc_relic_bonus`)을 그대로 재사용 — 이 세 함수가 전부 `p_user_id`로 파라미터화돼있어서(051/119/127) `auth.uid()` 대신 임의의 `p_user_id`를 넣기만 하면 "남의 전투력"이 그대로 계산됨. 장비는 `user_inventory`에서 `equipped = true`인 행만 `jsonb_agg`로 묶어서(슬롯/아이템키/강화레벨) 반환, 던전 클리어 정보는 `dungeon_progress`/`tower_progress`를 직접 조회.

### 랭킹 9종에 `user_id` 노출 추가 (167)

**핵심 전제조건**: 팝업을 열려면 클릭한 행의 대상 `user_id`가 있어야 하는데, 조사해보니 기존 랭킹 함수 전부(`fetch_leaderboard`/`fetch_achievement_leaderboard`/`fetch_tower_leaderboard`/`fetch_referral_leaderboard`/`fetch_gold_leaderboard`/`fetch_pvp_leaderboard`/`fetch_streak_dungeon_leaderboard`/`fetch_seal_leaderboard`/`fetch_guild_raid_contributors`)가 `is_me`라는 boolean 비교 결과만 반환하고 실제 uuid는 한 번도 클라이언트로 내려준 적이 없었음. 9개 함수 전부 반환 컬럼에 `user_id`만 추가(계산/정렬/limit 로직은 전혀 안 건드림, diff로 표본 검증). 전부 반환 컬럼이 바뀌므로 DROP FUNCTION 포함.

월드보스 기여자 목록(`fetchWorldBossTopContributors`)만 예외 — 서버 함수가 아니라 클라이언트가 `world_boss_contributions` 테이블을 PostgREST로 직접 조회하는 구조(RLS가 "누구나 조회 가능")라, `select` 절에 `user_id`만 추가하고 매핑 결과에 `userId` 필드를 얹는 것으로 끝(서버 마이그레이션 불필요).

## 클라이언트 설계

- `PublicProfileModal.jsx` — `modal-backdrop`(기존 스토리 팝업과 동일 클래스) 위에 `story-popup-card`를 얹는 익숙한 팝업 패턴. 로딩중(`undefined`)/에러(`null`)/정상 3단계 상태 구분
- 장비/코스튬 목록은 `Inventory.jsx`와 동일한 `.inventory-row`/`.enhance-badge` 클래스를 재사용해서 시각적 일관성 유지
- 몬스터 스프라이트는 `getDisplaySpriteKey(speciesId, element, unlockedJobTier)`로 계산 — 서버가 `species_id`/`element`/`unlocked_job_tier`를 전부 내려주므로 클라이언트 쪽 별도 조회 없이 바로 렌더링 가능
- **연결된 화면 9곳**: `Leaderboard.jsx`의 전투력/업적/무한의탑/PvP/친구추천/재산 6개 탭(전투력은 `PowerLeaderboard`, 나머지 5개는 `SimpleLeaderboard` 공용 컴포넌트라 한 번만 고치면 5개 전부 커버됨) + `DungeonSelect.jsx` 안의 연승던전/봉인던전/월드보스/길드레이드/무한의탑(던전 탭 내부) 랭킹까지 총 11개 리더보드 화면 전부에 클릭 연결
- 각 화면이 자체적으로 `selectedUserId` state를 들고 있다가 클릭 시 `PublicProfileModal`을 렌더링하는 구조(전역 상태로 끌어올리지 않음 — 화면마다 독립적으로 열고 닫혀도 자연스러움)
- 행에 `user_id`가 없는 경우(구버전 캐시 등 방어적 처리) `cursor: default`로 두고 클릭 무시

## 알려진 제한

- 프로필 팝업은 "지금 이 순간의 스펙"만 보여줌 — 과거 시점 스냅샷이나 변경 이력은 없음
- 몬스터가 없는 유저(이론상 불가능하지만 방어적으로 처리)는 "활성 몬스터가 없어요" 안내만 뜨고 장비/코스튬 등은 표시 안 됨
