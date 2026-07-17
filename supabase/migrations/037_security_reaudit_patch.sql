-- ============================================
-- 037: 보안 재점검 종합 패치
-- 프로젝트 전체를 처음부터 다시 훑어서 찾은 문제들을 한번에 수정함.
-- Supabase SQL Editor에 순서대로 실행 (001~036 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. [치명적] grant_idle_reward가 chapter/player_level을 클라이언트가 보내는 값 그대로 믿고 있었음
--    → devtools에서 grant_idle_reward(100, 999) 같은 식으로 과장된 값을 2.5초마다 반복 호출하면
--      실제 진행도와 무관하게 대량의 골드를 무제한으로 파밍할 수 있었음.
--    → chapter/level 둘 다 서버가 실제 DB(owned_monsters, stage_progress)에서 직접 계산하도록 변경.
--      클라이언트가 보내는 파라미터는 완전히 무시함(함수 시그니처만 유지해서 하위 호환).
-- ============================================
create or replace function public.grant_idle_reward(p_chapter integer, p_player_level integer)
returns integer as $$
declare
  v_last timestamptz;
  v_gold integer;
  v_level integer;
  v_chapter integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select last_idle_reward_at into v_last from public.profiles where id = auth.uid() for update;
  if v_last is not null and now() - v_last < interval '2.5 seconds' then
    raise exception '너무 빠른 요청입니다.';
  end if;

  select level into v_level from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_level is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  select coalesce(max(ceil(stage_id / 10.0)), 1) into v_chapter
    from public.stage_progress
    where user_id = auth.uid() and cleared = true;

  v_gold := public.calc_idle_gold(v_chapter, v_level);
  update public.profiles set last_idle_reward_at = now() where id = auth.uid();
  perform public.add_gold(auth.uid(), v_gold);
  return v_gold;
end;
$$ language plpgsql security definer;

-- ============================================
-- 2. [중요] claim_dungeon_reward / claim_job_dungeon이 "실제로 전투에서 이겼는지"를
--    전혀 검증하지 않고, 세션 존재+미사용 여부만 확인하고 있었음.
--    → use_dungeon_attempt/start_job_dungeon으로 세션만 발급받은 뒤, 전투를 아예 치르지 않고
--      바로 claim을 호출해도 보상이 그대로 지급됐음. 특히 전직 던전은 하루 입장횟수 제한조차
--      없어서, 레벨 조건만 채우면 전투 없이 1~5차 전직을 전부 즉시 완료할 수 있었음.
--    → 완벽한 서버측 전투 재현은 범위를 벗어나므로(known limitation, security.md 참고),
--      최소한의 안전장치로 "세션 생성 후 최소 시간 경과" 게이트를 추가함 - 최소한 devtools로
--      입장 직후 바로 클레임하는 가장 단순한 공격은 막음. 근본적으로는 이후 전투 결과를
--      서버가 직접 검증하는 구조로 개선이 필요함(TODO로 남김).
-- ============================================
create or replace function public.claim_dungeon_reward(p_session_id uuid)
returns integer as $$
declare
  v_session public.dungeon_sessions;
  v_gold integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 던전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 보상을 받은 던전입니다.';
  end if;
  if now() - v_session.created_at < interval '2 seconds' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  update public.dungeon_sessions set claimed = true where id = p_session_id;

  insert into public.dungeon_progress (user_id, dungeon_type, cleared_stage)
  values (auth.uid(), v_session.dungeon_type, v_session.stage)
  on conflict (user_id, dungeon_type) do update
    set cleared_stage = greatest(public.dungeon_progress.cleared_stage, v_session.stage);

  v_gold := public.calc_dungeon_gold(v_session.dungeon_type, v_session.stage);
  perform public.add_gold(auth.uid(), v_gold);
  return v_gold;
end;
$$ language plpgsql security definer;

create or replace function public.claim_job_dungeon(p_session_id uuid)
returns void as $$
declare
  v_session public.job_dungeon_sessions;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.job_dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null then
    raise exception '유효하지 않은 전직 던전 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 완료한 전직입니다.';
  end if;
  if now() - v_session.created_at < interval '3 seconds' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  update public.job_dungeon_sessions set claimed = true where id = p_session_id;
  update public.owned_monsters set unlocked_job_tier = v_session.tier where id = v_session.owned_monster_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- 3. [중간] claim_mail 레이스컨디션 + 아이템 중복소유 시 클레임 전체 실패 버그
--    - select에 for update가 없어서, 같은 우편을 동시에 두 번 클레임 요청하면 골드가 두 번 지급될 수 있었음
--    - user_inventory에 unique(user_id, item_key) 제약이 있는데(014), 이미 보유한 아이템이 든
--      우편(예: WELCOME2026 쿠폰의 레어 무기)을 이미 그 아이템을 가진 유저가 받으면
--      INSERT가 유니크 제약 위반으로 실패해서 트랜잭션 전체(골드 포함)가 롤백되고 있었음
-- ============================================
create or replace function public.claim_mail(p_mail_id uuid)
returns void as $$
declare
  v_mail public.mails;
  v_item record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_mail from public.mails where id = p_mail_id and user_id = auth.uid() for update;
  if v_mail is null then
    raise exception '우편을 찾을 수 없습니다.';
  end if;
  if v_mail.claimed then
    raise exception '이미 수령한 우편입니다.';
  end if;

  update public.mails set claimed = true where id = p_mail_id;

  if v_mail.gold_amount > 0 then
    update public.profiles set gold = gold + v_mail.gold_amount where id = auth.uid();
  end if;

  if v_mail.item_key is not null then
    select * into v_item from public.item_catalog where item_key = v_mail.item_key;
    if v_item is not null then
      insert into public.user_inventory (user_id, item_key, slot, equipped)
      values (auth.uid(), v_item.item_key, v_item.slot, false)
      on conflict (user_id, item_key) do update
        set enhance_level = least(1000, public.user_inventory.enhance_level + 1);
    end if;
  end if;
end;
$$ language plpgsql security definer;

-- ============================================
-- 4. [경미] redeem_coupon의 max_uses 체크가 읽고-쓰기 분리라 동시 요청 시 소량 초과 가능
--    → 원자적 UPDATE...WHERE로 재작성
-- ============================================
create or replace function public.redeem_coupon(p_code text)
returns void as $$
declare
  v_coupon record;
  v_updated record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_coupon from public.coupons where code = upper(trim(p_code));
  if v_coupon is null then
    raise exception '존재하지 않는 쿠폰입니다.';
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    raise exception '기간이 만료된 쿠폰입니다.';
  end if;

  update public.coupons
    set used_count = used_count + 1
    where code = v_coupon.code
      and (max_uses is null or used_count < max_uses)
    returning * into v_updated;

  if v_updated is null then
    raise exception '사용 횟수가 모두 소진된 쿠폰입니다.';
  end if;

  begin
    insert into public.coupon_redemptions (coupon_code, user_id) values (v_coupon.code, auth.uid());
  exception when unique_violation then
    update public.coupons set used_count = used_count - 1 where code = v_coupon.code;
    raise exception '이미 사용한 쿠폰입니다.';
  end;

  insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
  values (
    auth.uid(),
    '쿠폰 보상',
    '쿠폰 "' || v_coupon.code || '" 사용 보상입니다.',
    v_coupon.gold_amount,
    v_coupon.item_key,
    'coupon_' || v_coupon.code || '_' || auth.uid()::text
  );
end;
$$ language plpgsql security definer;
