# DB 스키마 (Supabase) — migration 순서대로

전체 SQL 파일은 `supabase/migrations/`에 있음. 적용은 **001부터 순서대로** (`dev-guide.md` 참고, GitHub Actions로 자동화되어 있음).

## 마이그레이션 요약

**001_init.sql**
- `profiles` (id, nickname unique, level, exp, gold, stamina, ...) — auth.users 트리거로 자동 생성
- `monster_species` (도감 마스터 데이터, 9종 스타터+진화 + 보스 1종 시드)
- `owned_monsters` (유저 보유 몬스터: level, exp, hp, atk, def, species_id, is_active)
- `stage_progress` (user_id, stage_id, cleared, cleared_at) — PK(user_id, stage_id)
- `chat_messages` (로비 채팅)
- RLS 전체 활성화, `is_nickname_taken` RPC

**002**: 회원가입 트리거 기본 닉네임이 형식 제약 위반하던 버그 수정 + `owned_monsters` 유저당 활성몬스터 1개 유니크 제약

**003**: `user_inventory` 테이블 신설 + `add_gold`/`spend_gold` RPC (원자적 골드 증감)

**004_security_patch.sql** ⚠️ **가장 중요, 필수 적용**
- `profiles.gold` 등 민감 컬럼 client 직접 UPDATE 차단 (컬럼 단위 GRANT/REVOKE)
- `owned_monsters` INSERT/UPDATE 전면 차단 → `create_starter_monster()`, `save_monster_growth()` RPC로만 변경 가능 (레벨 변화량 상한 50, 스탯 상한선 공식 검증, 진화 경로 검증)
- `stage_progress` INSERT/UPDATE 차단 → `clear_stage()` RPC (실제로 열린 스테이지인지 서버 재검증)
- `user_inventory` INSERT 차단, UPDATE는 `equipped` 컬럼만 허용 → `buy_item()` RPC + `item_catalog` 테이블(서버측 가격 진실공급원) 신설
- `chat_messages` insert 트리거로 닉네임 사칭 방지
- `add_gold`에 1회 최대 20000 상한 추가

**005_item_enhancement.sql**
- `user_inventory.enhance_level` 컬럼 추가 (0~15)
- `item_catalog.rarity_order` 컬럼 추가
- `enhance_item()` RPC (서버에서 확률 판정, 골드 차감) — ⚠️ **이후 014에서 완전히 폐지됨**

**006_mypage_and_skill_gacha.sql**
- `profiles`에 `nickname_edited`(닉네임 1회수정 플래그), `equipped_skills`(text[]), `total_skill_draws` 컬럼 추가
- `profiles.nickname` 직접 UPDATE 권한 완전 회수 → `update_nickname()` RPC로만 변경 가능(평생 1회)
- `handle_new_user` 트리거가 `raw_user_meta_data.nickname`(회원가입 시 전달)을 읽어 최초 닉네임으로 반영
- `skill_catalog` 테이블 신설(15개 스킬 시드) + `user_skills` 테이블 신설(중복 시 skill_level만 상승)
- `draw_skill()`, `set_skill_loadout()` RPC 신설
- `create_starter_monster()`가 기본 스킬(`basic_strike`) 자동 지급+장착하도록 갱신

**007_fix_ambiguous_column_and_batch_draw.sql**
- `draw_skill()`의 "column reference skill_key is ambiguous" 버그 수정 (RETURNS TABLE 출력 컬럼명과 테이블 컬럼명 충돌 → 테이블 별칭으로 해결)
- `draw_skill_batch(p_count)` RPC 신설 (1/10/100연차 뽑기, 골드 부족 시 그 시점까지 부분 성공)
- `add_gold` 1회 상한 20000 → 100000으로 상향 (골드 보상 5배 인상 반영)

**008_dungeon_mail_coupon.sql**
- `dungeon_attempts` 테이블 + `use_dungeon_attempt()` RPC (일일 던전 하루 3회 제한, 서울시간 기준)
- `mails` 테이블 + `sync_daily_mails()`(정기 골드우편 지연생성) + `claim_mail()` RPC
- `coupons`, `coupon_redemptions` 테이블 + `redeem_coupon()` RPC, 테스트용 예시 쿠폰 `WELCOME2026` 시드

**009_security_audit_patch.sql** ⚠️ **가장 중요, 필수 적용 (골드 무한증식 취약점 패치)**
- `add_gold`/`spend_gold` EXECUTE 권한을 `authenticated`에서 회수 (client 직접 호출 완전 차단)
- `calc_stage_gold`, `calc_idle_gold`, `calc_dungeon_gold` SQL 함수 신설 (stages.js/dungeonStages.js 공식 그대로 이식)
- `clear_stage`가 골드 지급까지 함께 처리하도록 변경 (반환값 = 지급액)
- `grant_idle_reward` RPC 신설 (자동사냥 전용, 유저별 최소 2.5초 간격 제한 포함)
- `dungeon_sessions` 테이블 신설, `use_dungeon_attempt`가 세션 생성 + `claim_dungeon_reward`가 세션당 1회만 보상 지급
- `use_dungeon_attempt`, `update_nickname`의 레이스컨디션(동시요청으로 제한 우회) 수정
- `mails`/`dungeon_attempts`/`dungeon_sessions`/`coupons`/`coupon_redemptions`/`skill_catalog`/`item_catalog`/`monster_species`에 명시적 client 쓰기권한 회수 추가
- 자세한 취약점 설명은 [`security.md`](./security.md) 참고

**010_sequential_dungeon_job_dungeon.sql**
- `dungeon_progress` 테이블 신설 - 던전이 자유선택형에서 **순차 진행형**으로 변경(1층부터, 깨야 다음층). `use_dungeon_attempt`가 파라미터에서 층 선택을 없애고 서버가 진행도로 직접 결정
- `owned_monsters.unlocked_job_tier` 컬럼 추가 - 전직이 레벨 자동적용에서 **전직 던전 클리어 필요**로 변경
- `job_dungeon_sessions` 테이블 + `start_job_dungeon()`/`claim_job_dungeon()` RPC (레벨조건 + 순차진행 서버검증)

**011_gacha_level_job_boost_chapter_difficulty.sql**
- `draw_skill`/`draw_skill_batch`의 뽑기레벨 산정 기준을 5회→1000회당 1레벨로 변경
- `save_monster_growth`의 스탯 상한선을 전직 최대배율 상향(1.9→6.0)에 맞춰 재조정
- `calc_stage_gold`에 챕터(10스테이지) 단위 계단식 난이도(`chapterStep`) 반영

**012_difficulty_and_idle_reward_sync.sql**
- `calc_stage_gold`/`calc_idle_gold`/`calc_dungeon_gold`를 클라이언트의 난이도 재상향/자동사냥 보상강화 공식과 동기화
- `add_gold` 1회 상한 100000 → 400000으로 재상향 (최후반 챕터 보스 골드가 기존 상한을 넘어서게 됨)

**013_equipment_gacha.sql**
- `profiles.total_equipment_draws` 컬럼 추가
- `draw_equipment()`/`draw_equipment_batch()` RPC 신설 - 스킬뽑기와 동일한 뽑기레벨/확률 구조로 슬롯+등급을 서버가 결정해서 지급 (item_key/slot을 client가 지정할 수 없어 조작 불가)

**014_shop_gacha_only.sql**
- `user_inventory` 중복 행 정리 후 `unique(user_id, item_key)` 제약 추가 (뽑기 중복 = 새 행이 아니라 자동 강화로 병합되는 구조로 전환)
- `buy_item`/`enhance_item` EXECUTE 권한 회수 (직접구매/유료강화 완전 폐지)
- `draw_equipment`/`draw_equipment_batch`를 슬롯 고정(`p_slot`) 방식으로 재작성 - 랜덤슬롯 대신 무기/방어구/장갑/신발 각각 독립된 뽑기, 중복 시 `enhance_level` +1(최대 15)

**015_dungeon_reset_time_and_skill_cost.sql**
- `use_dungeon_attempt`의 "하루" 기준을 자정→오전 8시(서울)로 변경 (`(서울시간 - 8시간)::date`로 일자 산정)
- `draw_skill`/`draw_skill_batch`의 비용을 뽑기레벨 연동 공식에서 **1회당 정가 300골드 고정**으로 변경

**016_dungeon_error_message.sql**
- `use_dungeon_attempt`의 입장권 소진 오류 메시지를 클라이언트 토스트 문구("오늘 하루 입장권을 모두 소진하셨습니다.")와 동일하게 통일

**017_mail_window_slot_gacha_skill_expansion.sql**
- `sync_daily_mails`를 "그 시각이 지나면 언제든 지급" → "정각~1시간 이내에만 지급"(`v_hour = v_slot.h`)으로 변경
- `equipment_gacha_progress` 테이블 신설 - 장비 뽑기레벨을 슬롯별로 완전히 독립 분리(기존 `profiles.total_equipment_draws` 단일 카운터 폐기, `draw_equipment`/`draw_equipment_batch`가 이 테이블 기준으로 재작성됨)
- `skill_catalog`에 `duration_ms`/`ticks`/`tick_interval_ms` 컬럼 추가, `type` 체크 제약에 `stun`/`dot`/`buff_atk`/`buff_def`/`haste` 추가
- 스킬 35종 신규 추가(등급당 3→10종, 총 50종) - 기존 15종 키는 그대로 유지(유저 보유 데이터 호환)

**018_fix_equipment_slot_ambiguous.sql / 019_fix_equipment_conflict_target_ambiguous.sql**
- `draw_equipment`/`draw_equipment_batch`의 "column reference slot is ambiguous" 버그를 두 단계에 걸쳐 완전히 수정 — 018에서 `UPDATE ... WHERE slot = ...`에 테이블 별칭 추가, 019에서 `INSERT ... ON CONFLICT (user_id, slot)`의 대상 컬럼 목록까지 `ON CONFLICT ON CONSTRAINT equipment_gacha_progress_pkey`로 바꿔서 "slot"이라는 이름이 아예 등장하지 않게 함.
- ⚠️ **RETURNS TABLE에 어떤 컬럼명을 쓰든, 그 이름을 함수 본문의 UPDATE/INSERT-ON CONFLICT 어디서든 별칭 없이 bare로 쓰면 이 버그가 재발할 수 있음 — 새 RPC 짤 때마다 유의**

**020_guide_missions.sql**
- `mission_state` 테이블 + `init_mission_state()`/`increment_mission_progress()`/`claim_mission_reward()` RPC 신설 (가이드 미션 시스템, [`guide-missions.md`](./guide-missions.md) 참고)
- `mails`에 "본인 소유 + claimed=true" 조건의 DELETE 정책 추가 (수령 완료한 우편 직접 삭제 가능)

**021_login_mission_enhance_cap_job_tier4.sql**
- "10분 접속 유지" 미션을 "1분 접속 유지"로 변경 (기존 진행중인 유저 행도 소급 수정 + `claim_mission_reward`의 향후 배정값도 변경)
- 장비 강화 최대치 15 → 1000으로 상향 (`user_inventory.enhance_level` 체크 제약, `draw_equipment`/`draw_equipment_batch`의 `least(15,...)` → `least(1000,...)`)
- **4차 전직(Lv.140) 추가** — `owned_monsters.unlocked_job_tier` 체크 제약 0~3→0~4, `job_dungeon_sessions.tier` 체크 제약에 4 추가, `save_monster_growth` 스탯 상한선 6.0→10.0배로 재조정, `start_job_dungeon`에 4차 레벨조건(140) 추가, `claim_mission_reward`의 온보딩 우선순위 체인에 `job_tier4` 추가

**022_security_mission_claim_cooldown.sql** ⚠️ **보안 패치, 필수 적용**
- `claim_mission_reward`에 "미션 배정 후 최소 20초 경과" 게이트 추가 — 이전엔 진행도 조작+즉시클레임 반복으로 무한 골드 파밍이 가능했음

**023_pvp_system.sql**
- `profiles`에 `pvp_currency`/`pvp_wins`/`pvp_losses`/`last_pvp_battle_at` 컬럼 추가
- `calc_monster_stats()`(종족+레벨+전직배율로 만피 기준 스탯 재계산), `calc_combat_power()` SQL 함수 신설
- `pvp_battle_log` 테이블 + `start_pvp_battle()` RPC (매칭+전투판정+보상까지 한번에, 20초 쿨다운), `fetch_my_combat_power()` RPC
- `pvp_shop_listings`(공용 진열대, 매시 정각 lazy 갱신) + `pvp_costume_inventory`(보유 코스튬) 테이블, `sync_pvp_shop()`/`buy_pvp_costume()` RPC

**024**: 023 배포 중 `calc_combat_power`가 `language sql`인데 몸통을 `begin/return/end`(plpgsql 문법)로 써서 문법 오류 났던 걸 수정(023 파일 자체를 고쳐서 재배포, 별도 024 파일 없음 — `supabase db push`가 실패한 마이그레이션은 트랜잭션 롤백하기 때문에 023을 통째로 다시 실행해도 안전)

**025_chat_realtime_pvp_reward_tune.sql**
- `chat_messages`를 `supabase_realtime` publication에 등록 (누락돼있어서 메시지 전송은 성공해도 화면에 실시간 반영이 안 되던 버그 수정)
- `start_pvp_battle`의 승리 보상 공식을 약 30% 하향(`max(30,30+opp/50)` → `max(20,20+opp/65)`)

**026_equipment_synthesis.sql**
- `synthesize_equipment(p_item_key)` RPC 신설 - 강화수치 10 소모 → 상위 등급 강화수치 +1

**027_chat_rate_limit.sql** ⚠️ **보안 패치**
- `chat_rate_limit_guard` 트리거 추가 - 로비채팅 전송 속도를 본인 기준 최소 2초 간격으로 제한(이전엔 무제한 도배 가능했음)

**028_equipment_synthesis_batch.sql**
- `synthesize_equipment_batch(p_item_key)` RPC 신설 - 가능한 만큼 한번에 반복 합성(왕복 여러 번 안 함), 몇 회 합성됐는지도 반환

**029_job_tier5_and_mission_cooldown_fix.sql**
- `mission_state.assigned_at` 컬럼 추가, `claim_mission_reward`의 20초 쿨다운 기준을 `updated_at`→`assigned_at`으로 변경(오탐 버그 수정)
- **5차 전직(Lv.180) 추가** — `owned_monsters.unlocked_job_tier` 체크 제약 0~4→0~5, `job_dungeon_sessions.tier` 체크 제약에 5 추가, `save_monster_growth`/`calc_monster_stats` 상한선 10.0→16.0배로 재조정, `start_job_dungeon`에 5차 레벨조건(180) 추가, `claim_mission_reward`의 온보딩 우선순위 체인에 `job_tier5` 추가

## 클라이언트 쓰기 권한 요약 (009 보안패치 이후 기준)

| 테이블/기능 | client 직접 write 가능? | 실제 변경 경로 |
|---|---|---|
| `profiles.gold` | ❌ | 각 액션 전용 RPC가 내부적으로만 `add_gold` 호출 (client는 `add_gold`/`spend_gold`를 직접 호출 불가, EXECUTE 권한 회수됨) |
| `profiles.nickname` | ❌ | `update_nickname` RPC (1회 제한, 레이스컨디션 수정됨) |
| `owned_monsters` | ❌ | `create_starter_monster`, `save_monster_growth` RPC |
| `stage_progress` | ❌ | `clear_stage` RPC (스테이지 클리어 + 골드 지급을 함께 원자적으로 처리) |
| `user_inventory` | equipped 컬럼만 | 생성 및 중복시 강화는 `draw_equipment`/`draw_equipment_batch` RPC (`buy_item`/`enhance_item`은 014에서 EXECUTE 권한 회수로 폐지), 합성은 `synthesize_equipment`/`synthesize_equipment_batch` RPC |
| `user_skills` | ❌ | `draw_skill`/`draw_skill_batch` RPC |
| `dungeon_attempts` | ❌ | `use_dungeon_attempt` RPC (원자적 증가로 레이스컨디션 수정됨) |
| `dungeon_sessions` | ❌ | 입장 시 `use_dungeon_attempt`가 생성, 보상은 `claim_dungeon_reward`가 세션당 1회만 지급 |
| `mails` | ❌ (delete만 본인 claimed건 가능) | `sync_daily_mails`(정기우편 생성), `claim_mail`(수령), `redeem_coupon`(쿠폰보상 발송), 직접 `DELETE`는 본인 소유+claimed=true 조건에서만 허용 |
| `mission_state` | ❌ | `init_mission_state`/`increment_mission_progress`/`claim_mission_reward` RPC |
| `pvp_battle_log` | ❌ | `start_pvp_battle` RPC 내부에서만 기록 |
| `pvp_shop_listings` | ❌ (누구나 조회는 가능) | `sync_pvp_shop` RPC 내부에서만 생성 |
| `pvp_costume_inventory` | ❌ | `buy_pvp_costume` RPC |
| `coupons`/`coupon_redemptions` | ❌ | `redeem_coupon` RPC |
| `equipment_gacha_progress` | ❌ | `draw_equipment`/`draw_equipment_batch` RPC 내부에서만 증가 |
| `chat_messages` | insert 가능(닉네임은 트리거가 덮어씀, 속도제한 트리거 있음) | - |
