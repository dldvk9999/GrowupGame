-- ============================================
-- 146: 이번 주 월드보스 체력을 즉시 1억으로 갱신 - 사용자 재제보("왜 안바뀐거야")
--
-- 144에서 sync_world_boss()의 "신규 주차 생성" 로직만 100M으로 바꿨는데, 이미 생성돼있는
-- "이번 주" world_boss_state 행은 그 함수가 손대지 않아서(신규 주차에만 INSERT함) 계속
-- 옛날 3000만 체력 그대로였음 - 다음 주 일요일 리셋 전까지는 사용자가 아무리 다시 봐도
-- 안 바뀌었을 것. 아직 이번 주 보스가 안 잡혔다면(cleared=false), 현재 입힌 피해량
-- (max_hp - current_hp)은 그대로 보존한 채 max_hp만 1억으로 올리고 current_hp도
-- 같은 차이만큼 늘려서 "지금까지 깎은 만큼은 유지"되게 함.
-- ============================================

update public.world_boss_state
set
  current_hp = 100000000 - (max_hp - current_hp),
  max_hp = 100000000
where cleared = false
  and week_key = (select max(week_key) from public.world_boss_state);
