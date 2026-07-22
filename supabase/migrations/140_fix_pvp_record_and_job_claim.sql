-- ============================================
-- 140: PvP "record is not assigned yet" 재수정 + 전직 완료 실패 버그 수정 - 사용자 제보
--
-- [1] PvP 재수정: 136에서 "select...into 직후 if not found then v_x := null"로 고쳤는데도
-- 사용자가 같은 에러를 다시 겪음. 원인 재분석 결과, **record 타입 변수는 NULL을 대입해도
-- "구조(어떤 필드가 있는지)"가 정해지지 않은 상태라 필드 접근 시 여전히 예외가 남**(136의
-- 수정은 근본적으로 부족했음 - v_x := null이 "필드 접근 가능한 상태"를 보장하지 못함).
-- 이번엔 record 필드를 아예 직접 참조하지 않고, 별도 boolean(v_found_opponent)만으로
-- 판단하도록 완전히 재작성함 - 이러면 record의 "할당 상태"와 무관하게 항상 안전함.
--
-- [2] 전직 완료 실패: claim_job_dungeon의 "세션 생성 후 최소 3초" 안티치트 게이트가
-- 1차 전직(레벨30 요구)처럼 낮은 난이도 던전에서, 오버레벨 유저가 스킬 한두 번으로
-- 순식간에 이겨버리면 3초를 못 채워서 예외가 났는데, 클라이언트(App.jsx handleJobDungeonWin)가
-- 이 예외를 console.error로만 삼키고 사용자에게 아무 안내도 안 해서 "전직이 그냥 안 된다"는
-- 현상으로 보였음. 게이트를 3초->1초로 완화(정상적인 빠른 승리는 통과, 즉시클레임 같은
-- 명백한 어뷰징은 여전히 차단)하고, 클라이언트도 실패 시 토스트로 알리도록 별도 수정.
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
  v_found_opponent boolean := false;
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
  v_found_opponent := found; -- (재수정) record 필드를 직접 참조하지 않고 별도 boolean만 사용

  if v_found_opponent then
    select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
    select * into v_opp_bonus from public.calc_equipped_stat_bonus(v_opp_row.user_id);
    select * into v_opp_relic from public.calc_relic_bonus(v_opp_row.user_id);
    v_opp_power := public.calc_combat_power(
      round((v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0) + coalesce(v_opp_relic.bonus_atk, 0)) * (1 + coalesce(v_opp_relic.pct_atk, 0) / 100))::integer,
      round((v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0) + coalesce(v_opp_relic.bonus_def, 0)) * (1 + coalesce(v_opp_relic.pct_def, 0) / 100))::integer,
      round((v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0) + coalesce(v_opp_relic.bonus_hp, 0)) * (1 + coalesce(v_opp_relic.pct_hp, 0) / 100))::integer
    );
    if v_opp_power < v_my_power * 0.75 or v_opp_power > v_my_power * 1.25 then
      v_found_opponent := false; -- 전투력 격차가 크면 실유저 매칭 취소, 아래에서 가상 상대로 대체
    end if;
  end if;

  if not v_found_opponent then
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
  v_found_opponent boolean := false;
  v_opp_stats record;
  v_opp_bonus record;
  v_opp_relic record;
  v_opp_power integer;
  v_opp_name text;
  v_opp_user_id uuid;
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
  v_found_opponent := found; -- (재수정) record 필드를 직접 참조하지 않고 별도 boolean만 사용

  if not v_found_opponent then
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
  v_opp_user_id := v_opp_row.user_id;

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
  values (auth.uid(), v_opp_user_id, v_opp_name, true, v_my_power, v_opp_power, v_result, v_reward);

  v_notify_gold := greatest(10, round(v_base_reward * 0.3));
  insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
  values (
    v_opp_user_id,
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
  if now() - v_session.created_at < interval '1 second' then
    -- (수정) 3초 -> 1초로 완화 - 1차 전직처럼 낮은 난이도는 오버레벨 유저가 스킬 한두 번으로
    -- 순식간에 이겨서 3초를 못 채우는 경우가 실제로 있었음(사용자 제보 - "전직 완료가 안 됨")
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  update public.job_dungeon_sessions set claimed = true where id = p_session_id;
  update public.owned_monsters set unlocked_job_tier = v_session.tier where id = v_session.owned_monster_id;
end;
$$ language plpgsql security definer;
