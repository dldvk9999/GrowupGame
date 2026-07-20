-- ============================================
-- 107: PvP 실제 유저 상대 보상 강화 - 신규 콘텐츠(사용자 요청)
-- 가상 캐릭터(매칭 실패 시 대체 상대)만 상대하면 사실상 리스크 없는 승률 파밍이라,
-- "진짜 사람과 붙는" 쪽에 확실한 인센티브를 줘서 실유저 매칭을 더 반기게 만드는 목적.
--
-- - 상대가 실제 유저(opponent_is_real)일 때: 승리 시 기존 보상의 3배, 패배해도 기존
--   승리 보상만큼(1배) 그대로 지급 - "쳐도 남는 게 있다"로 대전 진입장벽을 낮춤
-- - 상대가 가상 캐릭터일 때는 기존 그대로(승리만 1배, 패배 0)
--
-- 반환 컬럼 구성이 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.start_pvp_battle()
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
  v_opp_is_real boolean;
  v_opp_user_id uuid;
  v_my_roll numeric;
  v_opp_roll numeric;
  v_result text;
  v_base_reward integer;
  v_reward integer;
  v_synthetic_names text[] := array['그림자 전사', '환영의 검사', '유령 기사', '미지의 도전자', '수련용 인형', '떠돌이 검객', '가면의 결투가'];
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
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

  select om.user_id, om.species_id, om.level, om.unlocked_job_tier, p.nickname
    into v_opp_row
  from public.owned_monsters om
  join public.profiles p on p.id = om.user_id
  where om.is_active = true and om.user_id <> auth.uid()
  order by random()
  limit 1;

  if v_opp_row.user_id is not null then
    select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
    select * into v_opp_bonus from public.calc_equipped_stat_bonus(v_opp_row.user_id);
    v_opp_power := public.calc_combat_power(
      v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0),
      v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0),
      v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0)
    );
    if v_opp_power < v_my_power * 0.75 or v_opp_power > v_my_power * 1.25 then
      v_opp_row := null;
    end if;
  end if;

  if v_opp_row.user_id is null then
    v_opp_power := round(v_my_power * (0.9 + random() * 0.2));
    v_opp_name := v_synthetic_names[1 + floor(random() * array_length(v_synthetic_names, 1))::int];
    v_opp_is_real := false;
    v_opp_user_id := null;
  else
    v_opp_name := coalesce(v_opp_row.nickname, '익명의 도전자');
    v_opp_is_real := true;
    v_opp_user_id := v_opp_row.user_id;
  end if;

  v_my_roll := v_my_power * (0.85 + random() * 0.3);
  v_opp_roll := v_opp_power * (0.85 + random() * 0.3);
  v_base_reward := greatest(20, round(20 + v_opp_power / 65.0));

  if v_my_roll >= v_opp_roll then
    v_result := 'win';
    v_reward := case when v_opp_is_real then v_base_reward * 3 else v_base_reward end;
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  else
    v_result := 'lose';
    -- 실제 유저를 상대로 진 경우엔 위로 보상으로 기존 승리 보상(1배)만큼 지급, 가상 상대는 기존대로 0
    v_reward := case when v_opp_is_real then v_base_reward else 0 end;
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_losses = pvp_losses + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  end if;

  insert into public.pvp_battle_log (user_id, opponent_user_id, opponent_name, opponent_is_real, my_power, opponent_power, result, reward)
  values (auth.uid(), v_opp_user_id, v_opp_name, v_opp_is_real, v_my_power, v_opp_power, v_result, v_reward);

  return query select v_result, v_opp_name, v_opp_is_real, v_my_power, v_opp_power, v_reward,
    (select pvp_currency from public.profiles where id = auth.uid());
end;
$$ language plpgsql security definer;
