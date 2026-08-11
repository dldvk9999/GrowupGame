-- ============================================
-- 179: 길드 간 경쟁 랭킹 보상 신설 - 신규 콘텐츠(사용자 요청 - 리텐션 강화)
--
-- 지금까지 길드 랭킹(fetch_guild_leaderboard, 154)은 순위만 보여줄 뿐 보상이 전혀
-- 없었음(순수 자랑용). 매주 상위 10개 길드의 "전 길드원"에게 골드 보상을 우편으로
-- 지급해서, 내 길드 순위가 곧 내 보상으로 이어지는 사회적 압박(다 같이 열심히 해야
-- 우리 길드가 순위권)을 만듦.
--
-- 실제 cron 대신 다른 정기 콘텐츠들과 동일한 "지연생성" 패턴(sync_daily_mails 등,
-- security.md 참고) - 아무 유저나 로그인해서 우편함을 열면 그 시점에 "이번 주 보상을
-- 아직 안 배분했으면" 배분하고 끝냄. INSERT ... ON CONFLICT ... RETURNING으로 동시
-- 여러 유저가 트리거해도 딱 한 번만 배분되도록 원자적으로 게이트함.
--
-- 순위 기준은 fetch_guild_leaderboard와 동일(길드원 레벨 합산) - 별도 스냅샷 없이
-- "배분 시점의 현재 순위"를 그대로 씀(레벨은 내려가지 않으므로 큰 왜곡 없음).
-- ============================================

create table public.guild_ranking_reward_log (
  week_key text primary key
);
alter table public.guild_ranking_reward_log enable row level security;
create policy "guild_ranking_reward_log는 누구나 조회 가능" on public.guild_ranking_reward_log for select using (true);
revoke insert, update, delete on public.guild_ranking_reward_log from authenticated;

create or replace function public.sync_guild_ranking_rewards()
returns void as $$
declare
  v_week_key text := to_char(date_trunc('week', (now() at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day', 'YYYY-MM-DD');
  v_inserted boolean := false;
  v_rank_num integer := 0;
  v_guild record;
  v_reward integer;
  v_member record;
begin
  insert into public.guild_ranking_reward_log (week_key) values (v_week_key)
  on conflict (week_key) do nothing
  returning true into v_inserted;

  if not v_inserted then
    return; -- 이번 주 보상은 이미 다른 유저의 로그인 시점에 배분됨
  end if;

  for v_guild in
    select g.id, coalesce(sum(om.level), 0)::integer as total_level
    from public.guilds g
    left join public.guild_members gm on gm.guild_id = g.id
    left join public.owned_monsters om on om.user_id = gm.user_id and om.is_active = true
    group by g.id
    having coalesce(sum(om.level), 0) > 0 -- 텅 빈 길드는 순위 제외
    order by coalesce(sum(om.level), 0) desc
    limit 10
  loop
    v_rank_num := v_rank_num + 1;
    v_reward := case
      when v_rank_num = 1 then 30000
      when v_rank_num <= 3 then 20000
      when v_rank_num <= 5 then 12000
      else 6000
    end;

    for v_member in select user_id from public.guild_members where guild_id = v_guild.id
    loop
      insert into public.mails (user_id, title, body, gold_amount, source_key)
      values (
        v_member.user_id,
        '🏆 길드 랭킹 보상',
        '우리 길드가 이번 주 길드 랭킹 ' || v_rank_num || '위를 차지했어요! 다 같이 힘낸 결과예요.',
        v_reward,
        'guild_rank_reward_' || v_week_key || '_' || v_guild.id
      )
      on conflict (user_id, source_key) do nothing;
    end loop;
  end loop;
end;
$$ language plpgsql security definer;
