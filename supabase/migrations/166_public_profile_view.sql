-- ============================================
-- 166: 타인 프로필 상세조회(랭킹에서 유저 클릭 시 팝업용) - 신규 콘텐츠(사용자 요청)
-- 지금까지 모든 랭킹(월드보스/연승던전/길드레이드/봉인던전/PvP/골드/추천인 등)은
-- 닉네임/칭호/수치 하나 정도만 보여줬음 - 이번엔 "이 사람 스펙이 궁금하다"를 위한
-- 종합 조회 함수 하나를 신설함. calc_equipped_stat_bonus/calc_relic_bonus/
-- calc_monster_stats가 전부 p_user_id로 파라미터화돼있어(051/119/127) auth.uid()에
-- 얽매이지 않고 재사용 가능 - fetch_my_combat_power(120)와 동일한 계산을 "남의 것"으로
-- 그대로 돌리기만 하면 됨.
--
-- 민감정보(골드/이메일 등)는 전혀 포함하지 않고, 이미 여러 리더보드에서 공개적으로
-- 노출해온 것과 같은 급의 정보(닉네임/레벨/전투력/장비/코스튬/진행도)만 반환함.
-- ============================================

create or replace function public.fetch_public_profile(p_user_id uuid)
returns table(
  nickname text,
  equipped_title text,
  monster_name text,
  species_id integer,
  element text,
  level integer,
  exp integer,
  unlocked_job_tier integer,
  combat_power integer,
  equipped_items jsonb,
  equipped_costumes text[],
  exp_dungeon_cleared integer,
  gold_dungeon_cleared integer,
  tower_highest_floor integer,
  guild_name text,
  guild_tag text
) as $$
declare
  v_profile public.profiles;
  v_monster public.owned_monsters;
  v_stats record;
  v_bonus record;
  v_relic record;
  v_atk numeric;
  v_def numeric;
  v_hp numeric;
  v_power integer;
  v_items jsonb;
  v_exp_cleared integer;
  v_gold_cleared integer;
  v_tower_floor integer;
  v_guild record;
  v_element text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile is null then
    raise exception '존재하지 않는 유저입니다.';
  end if;

  select * into v_monster from public.owned_monsters where user_id = p_user_id and is_active = true;
  if v_monster is not null then
    select ms.element into v_element from public.monster_species ms where ms.id = v_monster.species_id;
  end if;

  if v_monster is not null then
    select * into v_stats from public.calc_monster_stats(v_monster.species_id, v_monster.level, v_monster.unlocked_job_tier);
    select * into v_bonus from public.calc_equipped_stat_bonus(p_user_id);
    select * into v_relic from public.calc_relic_bonus(p_user_id);
    v_atk := (v_stats.atk + coalesce(v_bonus.bonus_atk, 0) + coalesce(v_relic.bonus_atk, 0)) * (1 + coalesce(v_relic.pct_atk, 0) / 100);
    v_def := (v_stats.def + coalesce(v_bonus.bonus_def, 0) + coalesce(v_relic.bonus_def, 0)) * (1 + coalesce(v_relic.pct_def, 0) / 100);
    v_hp := (v_stats.max_hp + coalesce(v_bonus.bonus_hp, 0) + coalesce(v_relic.bonus_hp, 0)) * (1 + coalesce(v_relic.pct_hp, 0) / 100);
    v_power := public.calc_combat_power(round(v_atk)::integer, round(v_def)::integer, round(v_hp)::integer);
  else
    v_power := 0;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('slot', ui.slot, 'item_key', ui.item_key, 'enhance_level', ui.enhance_level) order by ui.slot), '[]'::jsonb)
    into v_items
    from public.user_inventory ui
    where ui.user_id = p_user_id and ui.equipped = true;

  select cleared_stage into v_exp_cleared from public.dungeon_progress where user_id = p_user_id and dungeon_type = 'exp';
  select cleared_stage into v_gold_cleared from public.dungeon_progress where user_id = p_user_id and dungeon_type = 'gold';
  select highest_floor into v_tower_floor from public.tower_progress where user_id = p_user_id;

  select g.name, g.tag into v_guild from public.guild_members gm join public.guilds g on g.id = gm.guild_id where gm.user_id = p_user_id;

  nickname := v_profile.nickname;
  equipped_title := v_profile.equipped_title;
  monster_name := v_monster.nickname;
  species_id := v_monster.species_id;
  element := v_element;
  level := coalesce(v_monster.level, 0);
  exp := coalesce(v_monster.exp, 0);
  unlocked_job_tier := coalesce(v_monster.unlocked_job_tier, 0);
  combat_power := v_power;
  equipped_items := v_items;
  equipped_costumes := coalesce(v_profile.equipped_costumes, '{}');
  exp_dungeon_cleared := coalesce(v_exp_cleared, 0);
  gold_dungeon_cleared := coalesce(v_gold_cleared, 0);
  tower_highest_floor := coalesce(v_tower_floor, 0);
  guild_name := v_guild.name;
  guild_tag := v_guild.tag;
  return next;
end;
$$ language plpgsql stable security definer;
