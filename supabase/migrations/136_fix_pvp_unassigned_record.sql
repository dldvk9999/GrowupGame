-- ============================================
-- 136: PvP "record v_opp_row is not assigned yet" 오류 수정 - 사용자 제보
--
-- 원인: `select ... into v_opp_row from ... limit 1`이 0행을 반환하면(도전 가능한
-- 다른 유저가 아예 없는 경우 등) v_opp_row는 "할당된 적 없음" 상태로 남는데,
-- 바로 다음 줄에서 `if v_opp_row.user_id is not null then`처럼 필드를 참조하면
-- PL/pgSQL이 "record v_opp_row is not assigned yet" 예외를 던짐 - NULL이 아니라
-- 아예 크래시임. `v_opp_row := null`로 명시적으로 지운 뒤에 필드를 읽는 건 안전하지만
-- (그건 "NULL로 할당된 상태"라 문제없음), 처음 select...into가 아예 0행이면 이
-- "명시적으로 null 대입"조차 거치지 않은 상태라 안전하지 않았음.
--
-- 수정: 두 함수 모두 select...into 직후 `if not found then v_opp_row := null; end if;`를
-- 추가해서, 0행이었던 경우에도 항상 "명시적으로 NULL 할당된 상태"로 통일시킴.
-- start_pvp_revenge_battle은 상대가 존재하지 않을 때(몬스터 교체 등)마다 이 오류가
-- 났을 것이므로, 사실상 "상대를 찾을 수 없어요" 안내 메시지가 한 번도 정상적으로
-- 뜬 적이 없었을 가능성이 높음(항상 크래시로 대체됐을 것).
--
-- 반환타입 둘 다 그대로라 DROP FUNCTION 불필요.
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
  v_my_relic record;
  v_my_power integer;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_bonus record;
  v_opp_relic record;
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
  select * into v_my_relic from public.calc_relic_bonus(auth.uid());
  v_my_power := public.calc_combat_power(
    round((v_my_stats.atk + coalesce(v_my_bonus.bonus_atk, 0) + coalesce(v_my_relic.bonus_atk, 0)) * (1 + coalesce(v_my_relic.pct_atk, 0) / 100))::integer,
    round((v_my_stats.def + coalesce(v_my_bonus.bonus_def, 0) + coalesce(v_my_relic.bonus_def, 0)) * (1 + coalesce(v_my_relic.pct_def, 0) / 100))::integer,
    round((v_my_stats.max_hp + coalesce(v_my_bonus.bonus_hp, 0) + coalesce(v_my_relic.bonus_hp, 0)) * (1 + coalesce(v_my_relic.pct_hp, 0) / 100))::integer
  );

  select om.user_id, om.species_id, om.level, om.unlocked_job_tier, p.nickname
    into v_opp_row
  from public.owned_monsters om
  join public.profiles p on p.id = om.user_id
  where om.is_active = true and om.user_id <> auth.uid()
  order by random()
  limit 1;
  if not found then
    v_opp_row := null; -- (수정) 0행이어도 명시적으로 NULL 할당 상태로 만들어 이후 필드 참조를 안전하게 함
  end if;

  if v_opp_row.user_id is not null then
    select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
    select * into v_opp_bonus from public.calc_equipped_stat_bonus(v_opp_row.user_id);
    select * into v_opp_relic from public.calc_relic_bonus(v_opp_row.user_id);
    v_opp_power := public.calc_combat_power(
      round((v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0) + coalesce(v_opp_relic.bonus_atk, 0)) * (1 + coalesce(v_opp_relic.pct_atk, 0) / 100))::integer,
      round((v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0) + coalesce(v_opp_relic.bonus_def, 0)) * (1 + coalesce(v_opp_relic.pct_def, 0) / 100))::integer,
      round((v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0) + coalesce(v_opp_relic.bonus_hp, 0)) * (1 + coalesce(v_opp_relic.pct_hp, 0) / 100))::integer
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
  else
    v_result := 'lose';
    v_reward := case when v_opp_is_real then v_base_reward else 0 end;
  end if;

  v_reward := least(v_reward, 900000);

  if v_result = 'win' then
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  else
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

create or replace function public.start_pvp_revenge_battle(p_opponent_id uuid)
returns table(
  result text, opponent_name text, opponent_is_real boolean,
  my_power integer, opponent_power integer, reward integer, currency_balance integer
) as $$
declare
  v_my_monster record;
  v_my_stats record;
  v_my_bonus record;
  v_my_relic record;
  v_my_power integer;
  v_my_nickname text;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_bonus record;
  v_opp_relic record;
  v_opp_power integer;
  v_opp_name text;
  v_my_roll numeric;
  v_opp_roll numeric;
  v_result text;
  v_base_reward integer;
  v_reward integer;
  v_notify_gold integer;
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

  select nickname into v_my_nickname from public.profiles where id = auth.uid();

  select * into v_my_stats from public.calc_monster_stats(v_my_monster.species_id, v_my_monster.level, v_my_monster.unlocked_job_tier);
  select * into v_my_bonus from public.calc_equipped_stat_bonus(auth.uid());
  select * into v_my_relic from public.calc_relic_bonus(auth.uid());
  v_my_power := public.calc_combat_power(
    round((v_my_stats.atk + coalesce(v_my_bonus.bonus_atk, 0) + coalesce(v_my_relic.bonus_atk, 0)) * (1 + coalesce(v_my_relic.pct_atk, 0) / 100))::integer,
    round((v_my_stats.def + coalesce(v_my_bonus.bonus_def, 0) + coalesce(v_my_relic.bonus_def, 0)) * (1 + coalesce(v_my_relic.pct_def, 0) / 100))::integer,
    round((v_my_stats.max_hp + coalesce(v_my_bonus.bonus_hp, 0) + coalesce(v_my_relic.bonus_hp, 0)) * (1 + coalesce(v_my_relic.pct_hp, 0) / 100))::integer
  );

  select om.user_id, om.species_id, om.level, om.unlocked_job_tier, p.nickname
    into v_opp_row
  from public.owned_monsters om
  join public.profiles p on p.id = om.user_id
  where om.is_active = true and om.user_id = p_opponent_id;
  if not found then
    v_opp_row := null; -- (수정) 0행이어도 명시적으로 NULL 할당 상태로 만들어 이후 필드 참조를 안전하게 함
  end if;

  if v_opp_row.user_id is null then
    raise exception '상대를 찾을 수 없어요. 이미 몬스터를 바꿨을 수 있어요.';
  end if;

  select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
  select * into v_opp_bonus from public.calc_equipped_stat_bonus(v_opp_row.user_id);
  select * into v_opp_relic from public.calc_relic_bonus(v_opp_row.user_id);
  v_opp_power := public.calc_combat_power(
    round((v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0) + coalesce(v_opp_relic.bonus_atk, 0)) * (1 + coalesce(v_opp_relic.pct_atk, 0) / 100))::integer,
    round((v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0) + coalesce(v_opp_relic.bonus_def, 0)) * (1 + coalesce(v_opp_relic.pct_def, 0) / 100))::integer,
    round((v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0) + coalesce(v_opp_relic.bonus_hp, 0)) * (1 + coalesce(v_opp_relic.pct_hp, 0) / 100))::integer
  );
  v_opp_name := coalesce(v_opp_row.nickname, '익명의 도전자');

  v_my_roll := v_my_power * (0.85 + random() * 0.3);
  v_opp_roll := v_opp_power * (0.85 + random() * 0.3);
  v_base_reward := greatest(20, round(20 + v_opp_power / 65.0));

  if v_my_roll >= v_opp_roll then
    v_result := 'win';
    v_reward := v_base_reward * 3;
  else
    v_result := 'lose';
    v_reward := v_base_reward;
  end if;

  v_reward := least(v_reward, 900000);

  if v_result = 'win' then
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1,
        pvp_revenge_wins = pvp_revenge_wins + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  else
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_losses = pvp_losses + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  end if;

  insert into public.pvp_battle_log (user_id, opponent_user_id, opponent_name, opponent_is_real, my_power, opponent_power, result, reward)
  values (auth.uid(), v_opp_row.user_id, v_opp_name, true, v_my_power, v_opp_power, v_result, v_reward);

  v_notify_gold := greatest(10, round(v_base_reward * 0.3));
  insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
  values (
    v_opp_row.user_id,
    case when v_result = 'win' then '⚔️ 복수전 도전을 받았어요!' else '🛡️ 복수전을 막아냈어요!' end,
    coalesce(v_my_nickname, '누군가') || '님이 복수전을 걸어와 ' ||
      case when v_result = 'win' then '패배했어요. 다시 도전해서 되갚아주세요!' else '승리했어요! 계속 방어에 성공하고 있어요.' end,
    v_notify_gold,
    null,
    'pvp_revenged_' || gen_random_uuid()::text
  );

  return query select v_result, v_opp_name, true, v_my_power, v_opp_power, v_reward,
    (select pvp_currency from public.profiles where id = auth.uid());
end;
$$ language plpgsql security definer;
