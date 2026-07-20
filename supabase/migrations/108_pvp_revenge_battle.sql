-- ============================================
-- 108: PvP 복수전(리벤지) - 신규 콘텐츠
-- 107에서 실유저 대전 보상을 대폭 강화했으니(승 3배/패도 위로보상), 자연스럽게
-- "그 상대 다시 붙어보고 싶다"는 동기가 생김 - 최근 전적에서 특정 실유저를 지목해
-- 바로 재도전할 수 있게 함. 상대는 항상 실제 유저이므로 107 보상 규칙이 그대로 적용됨.
--
-- start_pvp_battle과 거의 동일한 로직이지만 상대를 무작위 매칭 대신 p_opponent_id로 고정.
-- ============================================

create or replace function public.start_pvp_revenge_battle(p_opponent_id uuid)
returns table(
  result text, opponent_name text, opponent_is_real boolean,
  my_power integer, opponent_power integer, reward integer, currency_balance integer
) as $$
declare
  v_my_monster record;
  v_my_stats record;
  v_my_bonus record;
  v_my_power integer;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_bonus record;
  v_opp_power integer;
  v_opp_name text;
  v_my_roll numeric;
  v_opp_roll numeric;
  v_result text;
  v_base_reward integer;
  v_reward integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_opponent_id = auth.uid() then
    raise exception '자기 자신에게는 도전할 수 없습니다.';
  end if;

  select last_pvp_battle_at into v_last_battle from public.profiles where id = auth.uid();
  if v_last_battle is not null and now() - v_last_battle < interval '2 seconds' then
    raise exception '너무 빠릅니다. 잠시 후 다시 시도해주세요.';
  end if;

  select * into v_my_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_my_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  select * into v_my_stats from public.calc_monster_stats(v_my_monster.species_id, v_my_monster.level, v_my_monster.unlocked_job_tier);
  select * into v_my_bonus from public.calc_equipped_stat_bonus(auth.uid());
  v_my_power := public.calc_combat_power(
    v_my_stats.atk + coalesce(v_my_bonus.bonus_atk, 0),
    v_my_stats.def + coalesce(v_my_bonus.bonus_def, 0),
    v_my_stats.max_hp + coalesce(v_my_bonus.bonus_hp, 0)
  );

  -- 지목한 상대가 지금도 활성 몬스터를 유지 중인지 실시간으로 다시 조회(캐시된 옛 전적 스탯을 믿지 않음)
  select om.user_id, om.species_id, om.level, om.unlocked_job_tier, p.nickname
    into v_opp_row
  from public.owned_monsters om
  join public.profiles p on p.id = om.user_id
  where om.is_active = true and om.user_id = p_opponent_id;

  if v_opp_row.user_id is null then
    raise exception '상대를 찾을 수 없어요. 이미 몬스터를 바꿨을 수 있어요.';
  end if;

  select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
  select * into v_opp_bonus from public.calc_equipped_stat_bonus(v_opp_row.user_id);
  v_opp_power := public.calc_combat_power(
    v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0),
    v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0),
    v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0)
  );
  v_opp_name := coalesce(v_opp_row.nickname, '익명의 도전자');

  v_my_roll := v_my_power * (0.85 + random() * 0.3);
  v_opp_roll := v_opp_power * (0.85 + random() * 0.3);
  v_base_reward := greatest(20, round(20 + v_opp_power / 65.0));

  -- 복수전 상대는 항상 실제 유저이므로 107과 동일하게 승 3배/패도 위로보상 적용
  if v_my_roll >= v_opp_roll then
    v_result := 'win';
    v_reward := v_base_reward * 3;
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  else
    v_result := 'lose';
    v_reward := v_base_reward;
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_losses = pvp_losses + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  end if;

  insert into public.pvp_battle_log (user_id, opponent_user_id, opponent_name, opponent_is_real, my_power, opponent_power, result, reward)
  values (auth.uid(), v_opp_row.user_id, v_opp_name, true, v_my_power, v_opp_power, v_result, v_reward);

  return query select v_result, v_opp_name, true, v_my_power, v_opp_power, v_reward,
    (select pvp_currency from public.profiles where id = auth.uid());
end;
$$ language plpgsql security definer;
