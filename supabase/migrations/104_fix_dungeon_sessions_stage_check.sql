-- ============================================
-- 104: 버그 수정 - 던전 세션 stage 체크 제약이 500층 확장(079) 때 안 바뀜
-- (사용자 제보: "경험치 던전 도전하기" 클릭 시
--  new row for relation "dungeon_sessions" violates check constraint "dungeon_sessions_stage_check")
--
-- 원인: 009에서 dungeon_sessions.stage에 `check (stage between 1 and 10)`을 걸어뒀는데,
-- 079가 던전 최고 층수를 10 -> 500으로 올리면서 use_dungeon_attempt() 함수 로직만
-- 고치고 이 테이블 제약조건은 그대로 남겨둠. 그 결과 진행 층수(cleared_stage+1)가
-- 11층 이상인 유저는 세션 INSERT 자체가 거부되어 던전 입장이 완전히 막혀 있었음.
-- ============================================

alter table public.dungeon_sessions drop constraint if exists dungeon_sessions_stage_check;
alter table public.dungeon_sessions add constraint dungeon_sessions_stage_check check (stage between 1 and 500);
