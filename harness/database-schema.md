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

**030_stage_difficulty_boost_and_gold_cap.sql**
- 스테이지 난이도 대폭 상향 + "5스테이지/10스테이지마다" 이중 계단식 상승 추가 (`chapterStep` 0.04→0.05, `midChapterStep` 신설) — 자세한 공식은 [`stages-and-dungeons.md`](./stages-and-dungeons.md)
- `calc_stage_gold`를 새 난이도 공식과 동기화, `add_gold` 1회 상한 400000→**1,000,000**으로 재상향(최후반 보스 골드가 약 69만까지 치솟음)

**031_pvp_shop_10_slots.sql**
- PvP 상점 진열대 30개 → **10개**로 축소
- 등급별 확률을 더 뚜렷하게 재조정(노멀45%/레어27%/에픽16%/전설8%/신화4%, 이전엔 40/28/18/10/4)

**032_pvp_shop_cleanup_old_periods.sql** — 버그 수정
- `sync_pvp_shop`이 새 시간대 진열대 생성 직전에 예전 시간대 데이터를 삭제하도록 변경 — 이전엔 매시간 추가만 하고 안 지워서, 시간이 지날수록 지난 진열대까지 계속 섞여서 표시되던 문제가 있었음. 클라이언트(`fetchPvpShop`)도 최신 `period_key`만 필터링하도록 이중 방어 추가

**033_world_boss_system.sql**
- `profiles.dragon_buff_until` 컬럼 추가 (용의 버프 만료시각)
- `world_boss_state`(주간 공유체력, 일요일 리셋), `world_boss_attempts`(하루3회), `world_boss_contributions`(유저별 주간 누적 데미지) 테이블 신설
- `sync_world_boss()`(지연생성+미클리어 정산), `get_world_boss_state()`, `fetch_my_world_boss_progress()`, `enter_world_boss()`, `report_world_boss_damage()` RPC 신설 — 자세한 내용은 [`world-boss.md`](./world-boss.md)

**034_fix_world_boss_week_key_ambiguous.sql** — 버그 수정
- `enter_world_boss`의 "column reference week_key is ambiguous" 수정 (또 그 패턴, `security.md` 참고)

**035_world_boss_mail_rewards_and_atk_boost.sql**
- 월드보스 클리어 시에도 기여자 전원에게 골드 보상을 우편으로 발송하도록 추가(기존엔 용의 버프만 즉시 지급, 골드는 미클리어 때만 있었음)
- 월드보스 공격력 4500→7000 상향, **이미 생성돼있는(진행 중인) 이번 주 데이터에도 즉시 반영**

**036_security_world_boss_session_verification.sql** ⚠️ **보안 패치, 필수 적용 (치명적 취약점)**
- `world_boss_sessions` 테이블 신설, `enter_world_boss`/`report_world_boss_damage`를 세션 검증 구조로 재작성 — 이전엔 입장(하루3회 제한)과 데미지 보고 사이에 아무 연결고리가 없어서, `report_world_boss_damage`를 devtools로 무한 반복 호출하면 하루 3회 제한을 완전히 무시하고 보스 체력을 순식간에 소진시킬 수 있었음(자세한 내용은 [`security.md`](./security.md))

**037_security_reaudit_patch.sql** ⚠️ **보안 패치, 필수 적용 (치명적 취약점 포함, 프로젝트 전체 재점검)**
- `grant_idle_reward`가 chapter/player_level을 client가 보낸 값 그대로 신뢰하던 문제 수정 — 서버가 `owned_monsters`/`stage_progress`에서 직접 계산하도록 변경(무제한 골드 파밍 가능했던 치명적 취약점)
- `claim_dungeon_reward`/`claim_job_dungeon`에 "세션 생성 후 최소 시간 경과" 게이트 추가(각 2초/3초) — 전투 없이 세션만 발급받고 바로 클레임해서 보상을 받던 문제의 부분적 완화(완전한 해결은 아님, [`security.md`](./security.md) 알려진 한계 참고)
- `claim_mail`에 `for update` 락 추가(레이스컨디션으로 골드 이중지급 방지) + 이미 보유한 아이템이 든 우편을 받으면 통째로 실패하던 버그를 `ON CONFLICT DO UPDATE`(강화 병합)로 수정
- `redeem_coupon`의 `max_uses` 체크를 원자적 UPDATE로 재작성(동시요청 시 소량 초과 가능하던 레이스컨디션 수정)

**038_pvp_cooldown_shorten.sql**
- `start_pvp_battle`의 재대전 쿨다운 20초 → **2초**로 단축(다른 RPC들의 최소 간격 게이트와 동일 수준, 사실상 즉시 재대전 가능). 완전 제거는 예전 무한 파밍 취약점을 다시 여는 것이라 최소한의 게이트만 남김

**039_skill_level_cap_1000.sql**
- `user_skills.skill_level` 체크 제약 1~100 → **1~1000**으로 상향, `draw_skill`/`draw_skill_batch`의 중복 뽑기 시 레벨 상한도 동일하게 조정. 성장 수식(`getEffectiveSkillValue`)은 그대로 유지 — 레벨1000 최대 성장폭이 ×1.297→×3.297까지 커지는 것은 의도된 변경

**040_normal_monster_boost.sql**
- 일반(비보스) 스테이지 몬스터 hp/atk/def **1.8배** 추가 상향, `calc_stage_gold`도 동기화(보스는 변경 없음) — 실측 결과 후반 챕터로 갈수록 전직/장비 강화 대비 일반 몹만 상대적으로 너무 쉬워지는 문제 대응

**041_skill_slot_limit_10.sql**
- 스킬 편성 슬롯 최대치 5 → **10**으로 확장, `set_skill_loadout`의 레벨 구간을 Lv.100/130/160/190/220까지 연장(기존 10/25/50/75 페이스 그대로 이어감). 클라이언트 `getSkillSlotCount`와 동기화

**042_pvp_costume_equip.sql**
- `profiles.equipped_costumes`(text[]) 신설 + `set_costume_loadout` RPC — PvP 코스튬을 "보유"만이 아니라 슬롯별로 실제 "착용"할 수 있게 됨(서버가 보유여부/슬롯당 1개 제한 검증). 인벤토리 탭에 "코스튬" 서브탭 추가, 착용하면 캐릭터 스프라이트 주위에 등급색 배지로 표시됨(자세한 내용은 [`pvp.md`](./pvp.md))

**043_dynamic_spend_gold_mission.sql**
- `claim_mission_reward`가 다음 `spend_gold` 미션 목표치를 10000 고정 대신 **스킬+장비 종합 뽑기레벨**(1~20, 045에서 1~50으로 확장됨)에 따라 10만~50만 골드로 동적 상향(10만 단위 계단식), 보상도 목표치의 1%로 같이 스케일링. 자세한 내용은 [`guide-missions.md`](./guide-missions.md)

**044_fix_equipment_gacha_progress_column.sql** — 버그 수정
- 043이 `equipment_gacha_progress` 조회 시 실제 컬럼명(`total_draws`) 대신 존재하지 않는 `draws`를 참조해서, 가이드미션 완료 클레임 시 `column "draws" does not exist` 에러로 `claim_mission_reward` 전체가 실패하던 문제 수정

**045_gacha_level_cap_50_skill_cost.sql**
- 스킬/장비 4슬롯 전 뽑기레벨 최대치 **20 → 50**으로 확장, 확률 구간 경계도 비례 확장(8/18/28/38/48)
- 스킬뽑기 비용을 300 고정에서 **300+(lv-1)×90** 동적 산정으로 변경(장비뽑기 `100+(lv-1)×30`과 동일 패턴, lv1=300/lv50=4710골드)
- `claim_mission_reward`의 종합 뽑기레벨 상한도 50으로 동기화, spend_gold 경계값도 50레벨 기준(8/20/30/43)으로 재조정

**046_attendance_check.sql**
- 신규 테이블 `attendance_state` + `claim_attendance()` RPC — 7일 주기 출석체크 시스템. 자세한 내용은 [`attendance-and-achievements.md`](./attendance-and-achievements.md)

**047_achievements.sql**
- 신규 테이블 `achievement_claims` + `claim_achievement(p_achievement_key)` RPC — 레벨/전직/스테이지클리어/뽑기횟수/PvP승수/출석 기준 20개 업적, 서버가 실제 게임 상태로 재검증 후 지급. 자세한 내용은 [`attendance-and-achievements.md`](./attendance-and-achievements.md)

**048_leaderboard.sql**
- `fetch_leaderboard()` / `fetch_my_rank()` RPC — 전투력 기준 전체 유저 랭킹(상위 50명), 기존 PvP 전투력 계산 함수(`calc_monster_stats`/`calc_combat_power`) 재사용. 읽기 전용, 새 테이블 없음. 자세한 내용은 [`social-chat.md`](./social-chat.md)

**049_daily_free_draw.sql**
- 신규 테이블 `daily_free_draw_state` + `claim_daily_free_draw(p_type, p_slot)` RPC — 하루 1회 스킬/장비 뽑기 중 하나를 무료로. 기존 `draw_skill`/`draw_equipment`를 그대로 호출한 뒤 잔액을 호출 전 상태로 되돌리는 방식으로 구현(확률 로직 중복 없음). 자세한 내용은 [`skills.md`](./skills.md#일일-무료-뽑기-migration-049)

**050_titles.sql**
- `profiles.equipped_title` 신설 + `set_equipped_title(p_achievement_key)` RPC — 상위 업적 6종 달성 시 칭호 해금, 닉네임 옆에 장착 가능. `fetch_leaderboard()`도 칭호를 같이 반환하도록 재정의. 자세한 내용은 [`attendance-and-achievements.md`](./attendance-and-achievements.md)

**051_pvp_leaderboard_equipment_bonus.sql**
- `calc_equipped_stat_bonus(user_id)` 신설 — `itemCatalog.js`의 장비 스탯 공식을 SQL로 포팅해서 장착 장비 4슬롯 보너스를 계산. `start_pvp_battle`/`fetch_leaderboard`/`fetch_my_rank`/`fetch_my_combat_power` 전부 이 보너스를 포함하도록 재정의 — 기존엔 강화 장비를 낀 유저와 안 낀 유저가 PvP/랭킹에서 똑같이 취급되던 불공정 문제 수정. 자세한 내용은 [`pvp.md`](./pvp.md)

**052_starter_welcome_pack.sql**
- `create_starter_monster()`에 신규 유저 환영 우편(골드3000+레어무기) 자동 지급 추가, 반환타입 그대로라 DROP 불필요. 기존 `mails.source_key` unique 제약으로 중복 방지. 자세한 내용은 [`mailbox-and-coupons.md`](./mailbox-and-coupons.md)

**053_achievements_early_game.sql**
- `claim_achievement`에 업적 2종 추가: PvP 첫 승(`pvp_win_1`), 월드보스 첫 참여(`world_boss_participate`, `world_boss_contributions` 전체 주 대상 exists 체크). 자세한 내용은 [`attendance-and-achievements.md`](./attendance-and-achievements.md)

**054_update_event_coupon.sql**
- `UPDATE2026` 쿠폰 시딩(골드8000+레어장갑, 무제한 사용, 2026-12-31 만료) — 출석체크/업적/랭킹/무료뽑기/칭호 출시 기념

**055_gacha_lucky_bonus.sql**
- `draw_skill`/`draw_skill_batch`/`draw_equipment`/`draw_equipment_batch` 재정의 — 중복(강화) 시 10% 확률로 강화량 2배("럭키 보너스"). 반환 컬럼 구성은 그대로라 DROP 불필요, 클라이언트 수정 없음. 자세한 내용은 [`skills.md`](./skills.md)

**056_fix_attendance_ambiguous_column.sql** — 버그 수정
- `claim_attendance()`의 `UPDATE ... SET total_claim_count = total_claim_count + 1`이 RETURNS TABLE의 동명 OUT 파라미터와 충돌해서 "column reference is ambiguous" 에러로 출석체크가 아예 안 되던 문제 수정(테이블 별칭 명시). 자세한 내용은 [`attendance-and-achievements.md`](./attendance-and-achievements.md)

**057_equipment_set_bonus.sql**
- `calc_equipped_stat_bonus` 재정의 — 4슬롯을 전부 같은 등급으로 장착하면 최종 스탯 +5% 세트 효과 추가. 클라이언트(`lib/inventory.js`)와 서버 양쪽에 동일 로직 포팅해서 PvP/랭킹에도 정확히 반영됨. 반환타입 그대로라 DROP 불필요. 자세한 내용은 [`equipment.md`](./equipment.md)

**058_monster_nickname.sql**
- `set_monster_nickname(p_nickname)` RPC 신설 — 001부터 있었지만 미사용이던 `owned_monsters.nickname` 컬럼을 마이페이지 애칭 기능으로 연결. 자세한 내용은 [`character-and-growth.md`](./character-and-growth.md)

**059_full_set_achievement.sql**
- `claim_achievement`에 업적 1종 추가: "완벽한 세트"(`full_set_equipped`, 057 세트효과 판정 로직 재사용). 자세한 내용은 [`attendance-and-achievements.md`](./attendance-and-achievements.md)

**060_full_set_title.sql**
- `set_equipped_title`에 "완벽한 세트" 업적용 칭호 "완벽주의자" 추가

**061_costume_collector_achievement.sql**
- `claim_achievement`에 업적 1종 추가: "코스튬 수집가"(`costume_collector`, PvP 코스튬 5종 이상). 자세한 내용은 [`attendance-and-achievements.md`](./attendance-and-achievements.md)

**062_golden_monster_event.sql** — 신규 콘텐츠
- `grant_idle_reward` 재정의(반환타입 `integer`→`table(gold,is_golden)`, DROP FUNCTION 선행) — 자동사냥 처치마다 서버가 5% 확률로 "황금 몬스터" 판정해서 골드 3배 지급. 자세한 내용은 [`stages-and-dungeons.md`](./stages-and-dungeons.md)

**063_chapter_clear_bonus.sql** — 신규 콘텐츠
- `clear_stage` 재정의(반환타입 그대로, DROP 불필요) — 챕터 보스를 처음 클리어하면 `챕터×5000` 골드 축하 우편 자동 발송. 자세한 내용은 [`stages-and-dungeons.md`](./stages-and-dungeons.md)

**064_dungeon_full_clear_bonus.sql** — 신규 콘텐츠
- `claim_dungeon_reward` 재정의(반환타입 그대로, DROP 불필요) — 경험치/골드 던전 각각 처음 10층 완주 시 골드 2만 축하 우편 자동 발송. 자세한 내용은 [`stages-and-dungeons.md`](./stages-and-dungeons.md)

**065_referral_system.sql** — 신규 콘텐츠
- `profiles.referred_by` 신설 + `set_referrer(p_referrer_nickname)` RPC — 가입 24시간 이내 1회 추천인 등록. `claim_achievement` 재정의(반환타입 그대로)로 레벨10 달성 시 추천인 보너스 지급 로직 추가. 자세한 내용은 [`referral-system.md`](./referral-system.md)

**066_achievement_leaderboard.sql** — 신규 콘텐츠
- `fetch_achievement_leaderboard`/`fetch_my_achievement_rank` 신설 — 업적 달성 개수 기준 별도 랭킹(전투력 무관). 자세한 내용은 [`attendance-and-achievements.md`](./attendance-and-achievements.md)

**067_design_refresh_coupon.sql**
- `REFRESH2026` 쿠폰 시딩(골드10000+에픽방어구, 무제한 사용, 2027-03-31 만료) — 디자인 리프레시/친구추천/업적랭킹 등 신규 콘텐츠 기념

**068_element_popularity.sql** — 신규 콘텐츠
- `fetch_element_popularity()` 신설 — 전체 유저의 계약 속성 비율(%) 집계, 개인정보 없음. 자세한 내용은 [`character-and-growth.md`](./character-and-growth.md)

**069_attendance_milestones.sql** — 신규 콘텐츠
- `claim_achievement`에 업적 2종 추가: 출석 100회/200회 마일스톤. `claim_attendance`는 안 건드리고 이미 검증된 `claim_achievement` 패턴만 재사용. diff로 기존 26개 CASE 보존 확인

**070_founder_title.sql** — 신규 콘텐츠
- `claim_achievement`/`set_equipped_title`에 "얼리버드"(founder) 업적+칭호 추가 — 2026-08-01 이전 가입자 전용. 둘 다 반환타입 그대로라 DROP 불필요, 27개 업적키 diff 재검증 완료

**071_endless_tower.sql** — 신규 던전 콘텐츠
- `tower_progress`/`tower_attempts`/`tower_sessions` 신설(기존 dungeon_* 테이블과 완전 독립) — 상한 없이 계속 올라가는 도전 모드. `enter_tower`/`claim_tower_floor`/`fetch_tower_leaderboard`/`fetch_my_tower_rank`/`calc_tower_gold` 신설. 자세한 내용은 [`endless-tower.md`](./endless-tower.md)

**072_tower_unlimited_and_reward_boost.sql** — 사용자 피드백 반영
- `enter_tower` 재정의 — 하루 3회 입장 제한 완전 제거(무제한). `calc_tower_gold` 재정의 — 보상 배율 1.1→1.6(45% 상향), 100만 상한 유지. 둘 다 반환타입 그대로라 DROP 불필요

**073_tower_prevent_duplicate_sessions.sql** — 보안 수정
- `enter_tower` 재정의 — 072의 무제한 전환으로 새로 생긴 "중복 미클레임 세션으로 같은 층수 골드 반복 수령" 파밍 경로를 멱등성 체크로 차단. 자세한 내용은 [`endless-tower.md`](./endless-tower.md)

**074_tower_achievements.sql** — 신규 콘텐츠
- `claim_achievement`에 업적 2종 추가: 무한의 탑 10층/30층 돌파. 반환타입 그대로라 DROP 불필요, 29개 업적키 diff 재검증 완료

**075_tower_milestone_bonus.sql** — 신규 콘텐츠
- `claim_tower_floor` 재정의(반환타입 그대로, DROP 불필요) — 10층 단위 신기록 돌파 시 층수×800(100만 상한) 골드 축하 우편 자동 발송. 자세한 내용은 [`endless-tower.md`](./endless-tower.md)

**076_tower_launch_coupon.sql**
- `TOWER2026` 쿠폰 시딩(골드15000+에픽무기, 무제한 사용, 2027-06-30 만료) — 무한의 탑 출시 기념

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
| `tower_progress` | ❌ | `claim_tower_floor` RPC만 갱신 |
| `tower_attempts` | ❌ | `enter_tower` RPC (원자적 증가) |
| `tower_sessions` | ❌ | `enter_tower`가 발급, `claim_tower_floor`가 소모(claimed=true) 처리 |
| `mails` | ❌ (delete만 본인 claimed건 가능) | `sync_daily_mails`(정기우편 생성), `claim_mail`(수령), `redeem_coupon`(쿠폰보상 발송), 직접 `DELETE`는 본인 소유+claimed=true 조건에서만 허용 |
| `mission_state` | ❌ | `init_mission_state`/`increment_mission_progress`/`claim_mission_reward` RPC |
| `pvp_battle_log` | ❌ | `start_pvp_battle` RPC 내부에서만 기록 |
| `pvp_shop_listings` | ❌ (누구나 조회는 가능) | `sync_pvp_shop` RPC 내부에서만 생성 |
| `pvp_costume_inventory` | ❌ | `buy_pvp_costume` RPC |
| `attendance_state` | ❌ | `claim_attendance` RPC (046) |
| `achievement_claims` | ❌ | `claim_achievement` RPC (047) |
| `daily_free_draw_state` | ❌ | `claim_daily_free_draw` RPC (049) |
| `profiles.equipped_costumes` | ❌ | `set_costume_loadout` RPC (본인 보유 코스튬인지, 슬롯당 1개인지 서버 검증, 042) |
| `coupons`/`coupon_redemptions` | ❌ | `redeem_coupon` RPC |
| `equipment_gacha_progress` | ❌ | `draw_equipment`/`draw_equipment_batch` RPC 내부에서만 증가 |
| `world_boss_state` | ❌ (누구나 조회는 가능) | `sync_world_boss` RPC 내부에서만 생성/갱신 |
| `world_boss_attempts` | ❌ | `enter_world_boss` RPC (원자적 증가) |
| `world_boss_sessions` | ❌ | `enter_world_boss`가 발급, `report_world_boss_damage`가 소모(claimed=true) 처리 |
| `world_boss_contributions` | ❌ (누구나 조회는 가능) | `report_world_boss_damage` RPC 내부에서만 누적 |
| `chat_messages` | insert 가능(닉네임은 트리거가 덮어씀, 속도제한 트리거 있음) | - |
