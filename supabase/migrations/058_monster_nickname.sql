-- ============================================
-- 058: 몬스터 애칭 짓기 - owned_monsters.nickname 컬럼은 001부터 존재했지만
-- 클라이언트 어디서도 쓰인 적 없는 죽은 컬럼이었음(재검토 중 발견). 마이페이지에서
-- 활성 몬스터에게 애칭을 지어줄 수 있게 연결. 정체성 부여로 애착을 높이는 흔한 패턴.
-- ============================================

create or replace function public.set_monster_nickname(p_nickname text)
returns void as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_nickname is not null and p_nickname !~ '^[a-zA-Z0-9가-힣]{1,12}$' then
    raise exception '애칭은 한글/영문/숫자 1~12자로 입력해주세요.';
  end if;

  update public.owned_monsters set nickname = p_nickname
    where user_id = auth.uid() and is_active = true;

  if not found then
    raise exception '활성 몬스터가 없습니다.';
  end if;
end;
$$ language plpgsql security definer;
