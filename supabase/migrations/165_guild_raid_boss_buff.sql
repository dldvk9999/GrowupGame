-- ============================================
-- 165: 길드 레이드 보스 체력 1500만 -> 5000만, 방어력 1000 -> 10000(10배) 상향 (사용자 요청)
-- sync_guild_raid의 신규 주차 생성 insert 상수만 교체(161 기준으로 이어받음).
-- 반환타입 없음(void)이라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.sync_guild_raid(p_guild_id uuid)
returns void as $$
declare
  v_week text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_prev_state public.guild_raid_state;
  v_contrib record;
  v_reward integer;
begin
  if exists (select 1 from public.guild_raid_state where guild_id = p_guild_id and week_key = v_week) then
    return;
  end if;

  select * into v_prev_state from public.guild_raid_state
    where guild_id = p_guild_id order by week_key desc limit 1;
  if v_prev_state is not null and not v_prev_state.cleared then
    for v_contrib in
      select * from public.guild_raid_contributions
      where guild_id = p_guild_id and week_key = v_prev_state.week_key and total_damage > 0
    loop
      v_reward := least(80000, greatest(100, round(v_contrib.total_damage / 150.0)));
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

  -- (수정) 체력 1500만 -> 5000만, 방어력 1000 -> 10000(10배) 상향. 공격력은 그대로.
  insert into public.guild_raid_state (guild_id, week_key, max_hp, current_hp, atk, def)
  values (p_guild_id, v_week, 50000000, 50000000, 3500, 10000);
end;
$$ language plpgsql security definer;
