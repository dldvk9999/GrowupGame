-- ============================================
-- 161: [긴급/치명적] 길드 레이드(158) 미클리어 주간보상 지급 로직 버그 수정
--
-- 발견 경위: 78차 정기 보안점검 중 155~160 신규 6개 마이그레이션의 add_gold 호출부를
-- 전수 재검토하다가, sync_guild_raid()가 이미 월드보스가 110에서 겪었던 것과 정확히
-- 동일한 버그를 그대로 가지고 있는 걸 발견함. 원인은 158을 작성할 때 world-boss 최신
-- (110/144, 우편 단일경로로 이미 고쳐진) 버전이 아니라 더 오래된(033, 고쳐지기 전)
-- sync_world_boss() 패턴을 참고 모델로 삼았기 때문 - "항상 최신 버전을 기준으로 참고할
-- 것"이라는 기존 교훈(security.md)을 이번에 스스로 어긴 사례.
--
-- 버그 1 [치명적] 크래시: `add_gold(target_user, amount)`(003/030)는 `auth.uid() <>
-- target_user`면 즉시 `raise exception 'not authorized'`로 막음(009). sync_guild_raid의
-- 미클리어 주간보상 루프는 "새로 입장을 시도한 사람"(auth.uid()) 기준으로 실행되면서
-- **다른 기여자들**의 user_id로 add_gold를 호출하므로, 지난주 기여자가 2명 이상이면(길드
-- 레이드는 설계상 여러 명이 같이 깎는 콘텐츠라 사실상 항상 발생) 첫 타인 기여자에서
-- 바로 예외가 터져 **트랜잭션 전체가 롤백**됨 - 새 주 `guild_raid_state` 행 생성 자체가
-- (루프 이후에 insert가 있어서) 막혀서, 그 길드는 이후 영구히 새 레이드를 시작할 수
-- 없는 상태(`enter_guild_raid` 호출마다 계속 같은 예외로 실패)에 빠질 수 있었음.
--
-- 버그 2 [경미] 이중지급: 설령 기여자가 1명뿐이라 크래시를 피하더라도, add_gold로 즉시
-- 지급 + 같은 금액을 gold_amount로 담은 우편도 같이 보내서, 우편을 나중에 열어보면
-- 똑같은 보상을 한 번 더 받을 수 있었음.
--
-- 수정: report_guild_raid_damage(클리어 시 보상)는 애초에 우편 단일경로로 올바르게
-- 작성돼있었음(add_gold 호출 없음, 이번 점검에서 재확인) - sync_guild_raid만 add_gold
-- 직접 호출을 제거하고 우편 발송(클레임 시 1회 지급)만 남김. 반환타입 그대로라
-- DROP FUNCTION 불필요.
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
      -- (수정) 아래 perform add_gold 직접호출 제거 - 우편(claim_mail)이 지급을 전담
      -- (월드보스 110의 수정과 완전히 동일한 패턴)
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
  values (p_guild_id, v_week, 15000000, 15000000, 3500, 1000);
end;
$$ language plpgsql security definer;
