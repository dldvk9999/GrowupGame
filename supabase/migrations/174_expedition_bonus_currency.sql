-- ============================================
-- 174: 파견 - 파견 길이에 비례해 골드 외 재화(루비/봉인의 파편)도 랜덤 확률로 보너스
-- 지급 - 신규 콘텐츠(사용자 요청)
--
-- 인플레이션 방지: (1) 짧은 파견은 아예 확률 0(너무 짧아서 보너스 줄 정도가 아님),
-- (2) 중간/긴 파견도 각 5%/20%로 확률 자체를 낮게 잡고, (3) 지급량도 1~3개 수준의
-- 소량으로 고정(루비는 이미 job skill 강화/유물뽑기에 쓰이는 통제된 재화, 봉인의
-- 파편은 순수 수집/랭킹용이라 전투력에 영향 없음 - 둘 다 원래도 "적당히 통제된"
-- 재화라서 이번 보너스도 그 통제 수준을 유지하도록 소량만 얹음).
-- ============================================

drop function if exists public.claim_expedition(uuid);

create or replace function public.claim_expedition(p_expedition_id uuid)
returns table(gold integer, tier text, bonus_currency text, bonus_amount integer) as $$
declare
  v_exp public.expeditions;
  v_level integer;
  v_chapter integer;
  v_hours numeric;
  v_gold integer;
  v_bonus_currency text;
  v_bonus_amount integer := 0;
  v_roll numeric;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_exp from public.expeditions where id = p_expedition_id and user_id = auth.uid() for update;
  if v_exp.id is null or v_exp.claimed = true then
    raise exception '진행 중인 파견이 없어요.';
  end if;
  if now() - v_exp.started_at < (v_exp.duration_seconds || ' seconds')::interval then
    raise exception '아직 파견이 끝나지 않았어요.';
  end if;

  select level into v_level from public.owned_monsters
    where user_id = auth.uid() and is_active = true;
  if v_level is null then
    update public.expeditions set claimed = true where id = p_expedition_id;
    return query select 0, v_exp.tier, null::text, 0;
    return;
  end if;

  select coalesce(max(ceil(stage_id / 10.0)), 1) into v_chapter
    from public.stage_progress
    where user_id = auth.uid() and cleared = true;

  v_hours := v_exp.duration_seconds / 3600.0;
  v_gold := round(public.calc_expedition_gold_per_hour(v_chapter, v_level) * v_hours);
  v_gold := least(v_gold, 1000000);

  -- (신규) 파견 길이에 비례한 보너스 재화 - 짧은 파견은 확률 0, 중간 5%, 긴 파견 20%
  v_roll := random();
  if v_exp.tier = 'medium' and v_roll < 0.05 then
    if random() < 0.5 then
      v_bonus_currency := 'ruby'; v_bonus_amount := 1;
    else
      v_bonus_currency := 'seal_fragment'; v_bonus_amount := 1;
    end if;
  elsif v_exp.tier = 'long' and v_roll < 0.20 then
    if random() < 0.5 then
      v_bonus_currency := 'ruby'; v_bonus_amount := 1 + floor(random() * 3)::integer; -- 1~3
    else
      v_bonus_currency := 'seal_fragment'; v_bonus_amount := 1 + floor(random() * 2)::integer; -- 1~2
    end if;
  end if;

  update public.expeditions set claimed = true where id = p_expedition_id;
  perform public.add_gold(auth.uid(), v_gold);

  if v_bonus_currency = 'ruby' then
    update public.profiles set rubies = rubies + v_bonus_amount where id = auth.uid();
  elsif v_bonus_currency = 'seal_fragment' then
    update public.profiles set seal_fragments = seal_fragments + v_bonus_amount where id = auth.uid();
  end if;

  return query select v_gold, v_exp.tier, v_bonus_currency, v_bonus_amount;
end;
$$ language plpgsql security definer;
