-- ============================================
-- 060: "완벽한 세트" 업적(059)에도 칭호를 줌 - set_equipped_title의 CASE 분기 하나만 추가.
-- 반환타입(void) 그대로라 DROP 불필요.
-- ============================================

create or replace function public.set_equipped_title(p_achievement_key text)
returns void as $$
declare
  v_title text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_achievement_key is null then
    update public.profiles set equipped_title = null where id = auth.uid();
    return;
  end if;

  if not exists (select 1 from public.achievement_claims where user_id = auth.uid() and achievement_key = p_achievement_key) then
    raise exception '아직 달성하지 않은 업적이에요.';
  end if;

  v_title := case p_achievement_key
    when 'level_180' then '정점의 지배자'
    when 'job_tier_5' then '전설의 전사'
    when 'stage_clear_1000' then '차원의 정복자'
    when 'gacha_5000' then '행운의 화신'
    when 'pvp_win_50' then '투기장의 지배자'
    when 'attendance_month' then '성실한 조련사'
    when 'full_set_equipped' then '완벽주의자'
    else null
  end;

  if v_title is null then
    raise exception '칭호가 없는 업적이에요.';
  end if;

  update public.profiles set equipped_title = v_title where id = auth.uid();
end;
$$ language plpgsql security definer;
