-- ============================================
-- 025: 로비채팅 realtime publication 등록 + PvP 승리보상 소폭 하향
-- (가이드 미션 완료판정 버그는 클라이언트 수정만으로 해결됨, SQL 변경 불필요)
-- Supabase SQL Editor에 순서대로 실행 (001~024 먼저 적용되어 있어야 함)
-- ============================================

-- ============================================
-- 1. chat_messages를 realtime publication에 등록
--    (이게 빠져있으면 INSERT 자체는 성공하지만 구독자들 화면에 실시간으로 안 뜸 -
--     "메시지를 보내도 전송이 안 되는 것처럼 보이는" 현상의 원인)
-- ============================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- ============================================
-- 2. PvP 승리 보상 소폭 하향 (기존 대비 대략 30% 감소)
-- ============================================
create or replace function public.start_pvp_battle()
returns table(
  result text, opponent_name text, opponent_is_real boolean,
  my_power integer, opponent_power integer, reward integer, currency_balance integer
) as $$
declare
  v_my_monster record;
  v_my_stats record;
  v_my_power integer;
  v_last_battle timestamptz;
  v_opp_row record;
  v_opp_stats record;
  v_opp_power integer;
  v_opp_name text;
  v_opp_is_real boolean;
  v_opp_user_id uuid;
  v_my_roll numeric;
  v_opp_roll numeric;
  v_result text;
  v_reward integer;
  v_synthetic_names text[] := array['그림자 전사', '환영의 검사', '유령 기사', '미지의 도전자', '수련용 인형', '떠돌이 검객', '가면의 결투가'];
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select last_pvp_battle_at into v_last_battle from public.profiles where id = auth.uid();
  if v_last_battle is not null and now() - v_last_battle < interval '20 seconds' then
    raise exception '너무 빠릅니다. 잠시 후 다시 시도해주세요.';
  end if;

  select * into v_my_monster from public.owned_monsters where user_id = auth.uid() and is_active = true;
  if v_my_monster is null then
    raise exception '활성 몬스터가 없습니다.';
  end if;

  select * into v_my_stats from public.calc_monster_stats(v_my_monster.species_id, v_my_monster.level, v_my_monster.unlocked_job_tier);
  v_my_power := public.calc_combat_power(v_my_stats.atk, v_my_stats.def, v_my_stats.max_hp);

  select om.user_id, om.species_id, om.level, om.unlocked_job_tier, p.nickname
    into v_opp_row
  from public.owned_monsters om
  join public.profiles p on p.id = om.user_id
  where om.is_active = true and om.user_id <> auth.uid()
  order by random()
  limit 1;

  if v_opp_row.user_id is not null then
    select * into v_opp_stats from public.calc_monster_stats(v_opp_row.species_id, v_opp_row.level, v_opp_row.unlocked_job_tier);
    v_opp_power := public.calc_combat_power(v_opp_stats.atk, v_opp_stats.def, v_opp_stats.max_hp);
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

  if v_my_roll >= v_opp_roll then
    v_result := 'win';
    -- 기존: greatest(30, 30 + opp_power/50.0) → 대략 30% 하향
    v_reward := greatest(20, round(20 + v_opp_power / 65.0));
    update public.profiles
      set pvp_currency = pvp_currency + v_reward, pvp_wins = pvp_wins + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  else
    v_result := 'lose';
    v_reward := 0;
    update public.profiles
      set pvp_losses = pvp_losses + 1, last_pvp_battle_at = now()
      where id = auth.uid();
  end if;

  insert into public.pvp_battle_log (user_id, opponent_user_id, opponent_name, opponent_is_real, my_power, opponent_power, result, reward)
  values (auth.uid(), v_opp_user_id, v_opp_name, v_opp_is_real, v_my_power, v_opp_power, v_result, v_reward);

  return query select v_result, v_opp_name, v_opp_is_real, v_my_power, v_opp_power, v_reward,
    (select pvp_currency from public.profiles where id = auth.uid());
end;
$$ language plpgsql security definer;
