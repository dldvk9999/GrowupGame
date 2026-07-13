-- ============================================
-- 002: 닉네임 트리거 버그 수정 + 활성 몬스터 유니크 제약
-- Supabase SQL Editor에 그대로 붙여넣고 실행
-- ============================================

-- 1. 회원가입 트리거가 만드는 기본 닉네임이 nickname_format 제약(한글/영문/숫자만,
--    언더스코어 불가, 2~12자)을 위반해서 회원가입 자체가 실패하던 버그 수정.
--    'user_xxxxxxxx' (언더스코어 포함, 13자) → 'u' + uuid 8자리 (언더스코어 없음, 9자)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, 'u' || substr(replace(new.id::text, '-', ''), 1, 8));
  return new;
end;
$$ language plpgsql security definer;

-- 2. 유저당 활성(is_active=true) 몬스터가 동시에 여러 마리 생기는 것 방지.
--    로그인 시 "저번에 하던 몬스터"를 정확히 하나로 특정하기 위한 안전장치.
create unique index if not exists owned_monsters_one_active_per_user
  on public.owned_monsters (user_id)
  where is_active;
