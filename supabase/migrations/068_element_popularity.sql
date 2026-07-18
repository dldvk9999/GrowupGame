-- ============================================
-- 068: 인기 속성 통계 (신규 콘텐츠) - owned_monsters가 "본인만 조회" RLS라
-- 전체 집계는 security definer RPC로 대신 계산. 개인 식별정보 없이 속성별 비율만 노출.
-- ============================================

create or replace function public.fetch_element_popularity()
returns table(element text, user_count integer, percentage numeric) as $$
declare
  v_total integer;
begin
  select count(*) into v_total from public.owned_monsters where is_active = true;
  if v_total = 0 then
    return;
  end if;

  return query
  select
    ms.element,
    count(*)::integer as user_count,
    round(count(*) * 100.0 / v_total, 1) as percentage
  from public.owned_monsters om
  join public.monster_species ms on ms.id = om.species_id
  where om.is_active = true
  group by ms.element
  order by count(*) desc;
end;
$$ language plpgsql stable security definer;
