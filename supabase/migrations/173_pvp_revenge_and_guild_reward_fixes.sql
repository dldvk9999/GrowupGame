-- ============================================
-- 173: [긴급/치명적+중간] 80차 정기 보안점검(더 꼼꼼한 재점검 지시)에서 발견한 3개 버그 수정
--
-- 1) [심각] start_pvp_revenge_battle의 "패배 위로금"(v_notify_gold)이 실제 골드
--    (profiles.gold)로 우편 지급되는데 상한 클램프가 전혀 없었음. 상대 전투력이 클수록
--    커지는 구조(base_reward = 20 + 상대전투력/65)라, 서버 최상위 전투력 유저를 반복
--    지목하면(본인 쿨다운 2초만 지키면 됨, 대상별 제한이 없었음) 이론상 시간당 수백만
--    골드까지 뽑아낼 수 있는 무제한 파밍 벡터였음. 메인 PvP 전투(start_pvp_battle)는
--    처음부터 90만 상한이 있었는데 복수전만 빠져있었음 - 이번에 같이 맞춤.
--    수정: (a) notify_gold에 5,000 상한 (b) 같은 상대에게 5분에 한 번만 복수전 가능하도록
--    쿨다운 추가(pvp_battle_log 재사용, 새 테이블 불필요) - 이중 방어.
--
-- 2) [중간] report_guild_raid_damage/sync_guild_raid(169)의 길드레벨 보너스가 클램프를
--    적용한 "이후에" 곱해지고 있어서, 최종 보상이 의도한 상한(20만/8만)을 최대 20%
--    초과할 수 있었음 - 과거 121에서 이미 문서화된 "클램프는 모든 배율을 곱한 뒤 마지막
--    한 번만" 교훈을 이번에 재차 어긴 사례. 순서를 바로잡음.
--
-- 3개 함수 전부 반환타입/시그니처는 그대로라 DROP FUNCTION 불필요.
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
  v_my_relic record;
  v_my_skill_bonus integer;
  v_my_power integer;
  v_my_nickname text;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_bonus record;
  v_opp_relic record;
  v_opp_skill_bonus integer;
  v_opp_power integer;
  v_opp_name text;
  v_my_roll numeric;
  v_opp_roll numeric;
  v_result text;
  v_base_reward integer;
  v_reward integer;
  v_notify_gold integer;
  v_last_target_revenge timestamptz;
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

  -- (신규, 80차 점검에서 발견 - 특정 상대를 반복 지목해 우편함에 계속 골드가 담긴 우편을
  -- 꽂아넣을 수 있었던 스팸/파밍 벡터 방지) 같은 상대에게는 5분에 한 번만 복수전 가능
  select created_at into v_last_target_revenge from public.pvp_battle_log
    where user_id = auth.uid() and opponent_user_id = p_opponent_id and opponent_is_real = true
    order by created_at desc
    limit 1;
  if v_last_target_revenge is not null and now() - v_last_target_revenge < interval '5 minutes' then
    raise exception '같은 상대에게는 5분에 한 번만 복수전을 걸 수 있어요.';
  end if;

  select * into v_my_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_my_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  select nickname into v_my_nickname from public.profiles where id = auth.uid();

  select * into v_my_stats from public.calc_monster_stats(v_my_monster.species_id, v_my_monster.level, v_my_monster.unlocked_job_tier);
  select * into v_my_bonus from public.calc_equipped_stat_bonus(auth.uid());
  select * into v_my_relic from public.calc_relic_bonus(auth.uid());
  v_my_skill_bonus := public.calc_skill_possession_bonus(auth.uid());
  v_my_power := public.calc_combat_power(
    round((v_my_stats.atk + coalesce(v_my_bonus.bonus_atk, 0) + coalesce(v_my_relic.bonus_atk, 0) + v_my_skill_bonus) * (1 + coalesce(v_my_relic.pct_atk, 0) / 100))::integer,
    round((v_my_stats.def + coalesce(v_my_bonus.bonus_def, 0) + coalesce(v_my_relic.bonus_def, 0)) * (1 + coalesce(v_my_relic.pct_def, 0) / 100))::integer,
    round((v_my_stats.max_hp + coalesce(v_my_bonus.bonus_hp, 0) + coalesce(v_my_relic.bonus_hp, 0)) * (1 + coalesce(v_my_relic.pct_hp, 0) / 100))::integer
  );

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
  select * into v_opp_relic from public.calc_relic_bonus(v_opp_row.user_id);
  v_opp_skill_bonus := public.calc_skill_possession_bonus(v_opp_row.user_id);
  v_opp_power := public.calc_combat_power(
    round((v_opp_stats.atk + coalesce(v_opp_bonus.bonus_atk, 0) + coalesce(v_opp_relic.bonus_atk, 0) + v_opp_skill_bonus) * (1 + coalesce(v_opp_relic.pct_atk, 0) / 100))::integer,
    round((v_opp_stats.def + coalesce(v_opp_bonus.bonus_def, 0) + coalesce(v_opp_relic.bonus_def, 0)) * (1 + coalesce(v_opp_relic.pct_def, 0) / 100))::integer,
    round((v_opp_stats.max_hp + coalesce(v_opp_bonus.bonus_hp, 0) + coalesce(v_opp_relic.bonus_hp, 0)) * (1 + coalesce(v_opp_relic.pct_hp, 0) / 100))::integer
  );
  v_opp_name := coalesce(v_opp_row.nickname, '익명의 도전자');

  v_my_roll := v_my_power * (0.85 + random() * 0.3);
  v_opp_roll := v_opp_power * (0.85 + random() * 0.3);
  v_base_reward := greatest(20, round(20 + v_opp_power / 65.0));
  -- (수정, 80차 점검에서 발견) 메인 PvP 전투(start_pvp_battle)는 90만 상한이 있는데
  -- 복수전만 보상 클램프가 아예 없었음 - 동일하게 상한 적용
  v_base_reward := least(300000, v_base_reward);

  if v_my_roll >= v_opp_roll then
    v_result := 'win';
    v_reward := v_base_reward * 3;
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1,
        pvp_revenge_wins = pvp_revenge_wins + 1, last_pvp_battle_at = now()
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

  -- (수정, 80차 점검에서 발견 - 심각) 실제 골드(profiles.gold)로 우편 지급되는데 상한이
  -- 전혀 없었음. 상대 전투력이 클수록 커지는 구조라, 서버 최상위 전투력 유저를 반복
  -- 지목하면 이론상 무제한에 가까운 골드를 뽑아낼 수 있었던 심각한 파밍 벡터 - 소정의
  -- "위로금" 취지에 맞게 5,000골드로 상한을 걸어 원천 차단(위의 5분 쿨다운과 이중 방어)
  v_notify_gold := least(5000, greatest(10, round(v_base_reward * 0.3)));
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

create or replace function public.report_guild_raid_damage(p_session_id uuid, p_damage bigint)
returns table(new_current_hp bigint, boss_max_hp bigint, cleared_now boolean) as $$
declare
  v_session public.guild_raid_sessions;
  v_boss public.guild_raid_state;
  v_my_power integer;
  v_cap bigint;
  v_applied bigint;
  v_cleared boolean := false;
  v_contrib record;
  v_reward integer;
  v_guild_level integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_damage is null or p_damage < 0 then
    raise exception '유효하지 않은 데미지입니다.';
  end if;

  select * into v_session from public.guild_raid_sessions where id = p_session_id and user_id = auth.uid() for update;
  if v_session is null then
    raise exception '유효하지 않은 전투 세션입니다.';
  end if;
  if v_session.claimed then
    raise exception '이미 결과가 반영된 전투입니다.';
  end if;
  update public.guild_raid_sessions set claimed = true where id = p_session_id;

  select * into v_boss from public.guild_raid_state grs
    where grs.guild_id = v_session.guild_id and grs.week_key = v_session.week_key for update;
  if v_boss is null then
    raise exception '길드 레이드 보스를 찾을 수 없습니다.';
  end if;
  if v_boss.cleared then
    return query select v_boss.current_hp, v_boss.max_hp, true;
    return;
  end if;

  v_my_power := public.fetch_my_combat_power();
  v_cap := greatest(2000, v_my_power::bigint * 60);
  v_applied := least(p_damage, v_cap, v_boss.current_hp);

  update public.guild_raid_state set current_hp = current_hp - v_applied
    where guild_id = v_session.guild_id and week_key = v_session.week_key;

  insert into public.guild_raid_contributions (user_id, guild_id, week_key, total_damage)
  values (auth.uid(), v_session.guild_id, v_session.week_key, v_applied)
  on conflict (user_id, guild_id, week_key)
    do update set total_damage = public.guild_raid_contributions.total_damage + v_applied;

  -- (신규) 입힌 데미지 50당 길드 경험치 1
  perform public.grant_guild_exp(v_session.guild_id, floor(v_applied / 50.0));

  if v_boss.current_hp - v_applied <= 0 then
    v_cleared := true;
    update public.guild_raid_state set cleared = true, cleared_at = now()
      where guild_id = v_session.guild_id and week_key = v_session.week_key;

    select level into v_guild_level from public.guilds where id = v_session.guild_id;

    for v_contrib in
      select * from public.guild_raid_contributions
      where guild_id = v_session.guild_id and week_key = v_session.week_key and total_damage > 0
    loop
      -- (수정, 80차 점검에서 발견) 클램프를 곱셈보다 먼저 해서 최종값이 20만을 최대 20%
      -- 초과할 수 있었던 버그 - 배율을 전부 곱한 뒤 마지막에 한 번만 클램프하도록 순서 수정
      v_reward := greatest(300, round(v_contrib.total_damage / 100.0));
      v_reward := round(v_reward * (1 + least(20, coalesce(v_guild_level, 1)) * 0.01)); -- 길드 레벨 보너스
      v_reward := least(200000, v_reward); -- 최종 클램프(반드시 마지막)
      insert into public.mails (user_id, title, body, gold_amount, source_key)
      values (
        v_contrib.user_id,
        '길드 레이드 처치 보상',
        '길드원들과 힘을 모아 이번 주 레이드 보스를 쓰러뜨렸어요! 입힌 피해량에 비례한 골드를 받았어요.',
        v_reward,
        'guild_raid_clear_' || v_session.guild_id || '_' || v_session.week_key
      )
      on conflict (user_id, source_key) do nothing;
    end loop;
  end if;

  return query select
    greatest(0, v_boss.current_hp - v_applied),
    v_boss.max_hp,
    v_cleared;
end;
$$ language plpgsql security definer;

create or replace function public.sync_guild_raid(p_guild_id uuid)
returns void as $$
declare
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_prev_state public.guild_raid_state;
  v_contrib record;
  v_reward integer;
  v_guild_level integer;
begin
  if exists (select 1 from public.guild_raid_state where guild_id = p_guild_id and week_key = v_week) then
    return;
  end if;

  select * into v_prev_state from public.guild_raid_state
    where guild_id = p_guild_id order by week_key desc limit 1;
  if v_prev_state is not null and not v_prev_state.cleared then
    select level into v_guild_level from public.guilds where id = p_guild_id;
    for v_contrib in
      select * from public.guild_raid_contributions
      where guild_id = p_guild_id and week_key = v_prev_state.week_key and total_damage > 0
    loop
      -- (수정, 80차 점검에서 발견) 클램프를 곱셈보다 먼저 해서 최종값이 8만을 최대 20%
      -- 초과할 수 있었던 버그 - 배율을 전부 곱한 뒤 마지막에 한 번만 클램프하도록 순서 수정
      v_reward := greatest(100, round(v_contrib.total_damage / 150.0));
      v_reward := round(v_reward * (1 + least(20, coalesce(v_guild_level, 1)) * 0.01)); -- 길드 레벨 보너스
      v_reward := least(80000, v_reward); -- 최종 클램프(반드시 마지막)
      insert into public.mails (user_id, title, body, gold_amount, source_key)
      values (
        v_contrib.user_id,
        '길드 레이드 참전 보상',
        '이번 주 우리 길드 레이드 보스에게 입힌 피해량만큼 골드를 보내드려요. 다음 주엔 길드원들과 함께 꼭 처치해봐요!',
        v_reward,
        'guild_raid_reward_' || p_guild_id || '_' || v_prev_state.week_key
      )
      on conflict (user_id, source_key) do nothing;
    end loop;
  end if;

  insert into public.guild_raid_state (guild_id, week_key, max_hp, current_hp, atk, def)
  values (p_guild_id, v_week, 50000000, 50000000, 3500, 10000);
end;
$$ language plpgsql security definer;

-- ============================================
-- 3) [경미] 로비채팅/길드채팅이 client가 테이블에 직접 INSERT하는 유일한 경로인데,
--    created_at이 테이블 DEFAULT(now())일 뿐 강제 규칙이 아니라서, 클라이언트가
--    과거 시각으로 created_at을 위조해서 보내면 도배방지(rate limit, 027/170)의
--    "최근 메시지 확인" 쿼리를 항상 통과할 수 있었음(위조한 과거 메시지가 "가장 최근"으로
--    안 잡히므로). set_chat_nickname(004, 로비/길드 채팅 둘 다 재사용 중)에 created_at
--    강제 갱신을 추가해서 원천 차단 - 닉네임 위조 방지와 같은 지점에서 같이 처리.
--    반환타입(trigger) 그대로, DROP 불필요.
-- ============================================

create or replace function public.set_chat_nickname()
returns trigger as $$
begin
  select nickname into new.nickname from public.profiles where id = new.user_id;
  new.created_at := now(); -- (수정, 80차 점검) 클라이언트의 created_at 위조로 도배방지 우회 방지
  return new;
end;
$$ language plpgsql security definer;
