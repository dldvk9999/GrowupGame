-- ============================================
-- 164: 연승 던전 최대 골드 상한 100만 -> 200만 상향 (사용자 요청)
-- calc_streak_dungeon_gold 내부 클램프와 bank_streak_dungeon의 방어적 재클램프
-- 둘 다 상수만 교체. 반환타입 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.calc_streak_dungeon_gold(p_level integer, p_streak integer)
returns integer as $$
declare
  v_level integer := greatest(1, p_level);
  v_streak integer := greatest(1, p_streak);
  v_base numeric;
  v_gold numeric;
begin
  v_base := 220 + power(v_level, 1.25) * 6;
  v_gold := v_base * power(1.3, v_streak - 1);
  return least(2000000, round(v_gold))::integer; -- (수정) 100만 -> 200만 상한
end;
$$ language plpgsql immutable;

create or replace function public.bank_streak_dungeon(p_session_id uuid)
returns table(gold integer, final_streak integer) as $$
declare
  v_session record;
  v_level integer;
  v_gold integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_session from public.streak_dungeon_sessions
    where id = p_session_id and user_id = auth.uid()
    for update;

  if v_session is null or v_session.status <> 'active' then
    raise exception '유효하지 않은 연승 던전 세션입니다.';
  end if;
  if now() - v_session.last_action_at < interval '1 second' then
    raise exception '너무 빠릅니다. 실제로 전투를 진행해주세요.';
  end if;

  select level into v_level from public.owned_monsters where id = v_session.owned_monster_id;
  v_gold := least(2000000, public.calc_streak_dungeon_gold(coalesce(v_level, 1), v_session.streak)); -- (수정) 100만 -> 200만

  update public.streak_dungeon_sessions set status = 'banked', last_action_at = now() where id = p_session_id;
  perform public.add_gold(auth.uid(), v_gold);

  gold := v_gold;
  final_streak := v_session.streak;
  return next;
end;
$$ language plpgsql security definer;
