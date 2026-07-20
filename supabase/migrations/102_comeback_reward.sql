-- ============================================
-- 102: 복귀 유저(윈백) 보상 - 신규 콘텐츠
-- 모바일 게임의 대표적인 리텐션 장치. 일정 기간 접속하지 않았던 유저가
-- 다시 로그인하면 "돌아온 걸 환영" 보너스를 축하 우편으로 발송함
-- (068_tower_milestone_bonus 등과 동일한 "mails + source_key unique" 설계 패턴).
--
-- profiles.last_login_at이 001부터 없었으므로 신규 컬럼 추가.
-- 기존 유저는 컬럼 추가 시점에 now()로 채워져서, 배포 직후엔 아무도 즉시 보상을
-- 받지 않고(기준일이 "지금"이 됨) 다음에 실제로 며칠 쉬어야 자연스럽게 트리거됨.
-- ============================================

alter table public.profiles
  add column if not exists last_login_at timestamptz not null default now();

create or replace function public.record_login_and_grant_comeback_reward()
returns table(granted boolean, days_away integer, gold_reward integer)
as $$
declare
  v_prev timestamptz;
  v_days integer;
  v_gold integer := 0;
  v_granted boolean := false;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select p.last_login_at into v_prev from public.profiles p where p.id = auth.uid() for update;
  if v_prev is null then
    v_prev := now();
  end if;

  v_days := floor(extract(epoch from (now() - v_prev)) / 86400)::integer;

  -- 3일 이상 쉬었다가 돌아온 경우에만 지급. 쉰 기간에 비례하되 상한을 둠(장기 이탈자 배려 + 어뷰징 방지).
  if v_days >= 3 then
    v_gold := least(50000, greatest(5000, v_days * 1500));
    insert into public.mails (user_id, title, body, gold_amount, item_key, source_key)
    values (
      auth.uid(),
      '🎉 돌아오신 걸 환영해요!',
      v_days || '일 만에 돌아오셨네요. 반가운 마음을 담아 보너스를 준비했어요. 오늘부터 다시 신나게 키워봐요!',
      v_gold,
      null,
      'comeback_' || to_char(now(), 'YYYYMMDD')
    )
    on conflict (user_id, source_key) do nothing;
    v_granted := true;
  end if;

  update public.profiles set last_login_at = now() where id = auth.uid();

  return query select v_granted, v_days, v_gold;
end;
$$ language plpgsql security definer;
