-- ============================================
-- 131: 유물 장착 슬롯 3개 -> 5개로 확장 - 사용자 요청
-- 반환타입(void) 그대로라 DROP FUNCTION 불필요.
-- ============================================

create or replace function public.set_relic_loadout(p_relic_keys text[])
returns void as $$
declare
  v_count integer;
  v_owned_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  v_count := coalesce(array_length(p_relic_keys, 1), 0);
  if v_count > 5 then
    raise exception '유물은 최대 5개까지만 장착할 수 있어요.';
  end if;
  if v_count <> (select count(distinct k) from unnest(p_relic_keys) as k) then
    raise exception '같은 유물을 두 번 넣을 수 없어요.';
  end if;

  if v_count > 0 then
    select count(*) into v_owned_count from public.user_relics ur
      where ur.user_id = auth.uid() and ur.relic_key = any(p_relic_keys);
    if v_owned_count <> v_count then
      raise exception '보유하지 않은 유물은 장착할 수 없어요.';
    end if;
  end if;

  update public.user_relics ur set equipped = (ur.relic_key = any(p_relic_keys))
    where ur.user_id = auth.uid() and (ur.equipped = true or ur.relic_key = any(p_relic_keys));
end;
$$ language plpgsql security definer;
