# 알려진 미구현/TODO 후보

- ~~로비 채팅 UI 미연결~~ → 해결됨(`LobbyChat.jsx` 연결, [`social-chat.md`](./social-chat.md))
- 외부 이미지(실사/일러스트) 미적용 — `MonsterSprite`는 `VITE_SPRITE_CDN_URL` 세팅 시 자동으로 이미지 우선 사용하도록 이미 확장 가능 구조로 되어 있음
- 사육장(보유 몬스터 목록) 화면 없음 — 현재는 활성 몬스터 1마리만 운용(설계상 의도된 제약). ~~도감~~ → **부분 해결**: 마이페이지에 `MonsterDex.jsx`(9종 진화 트리 발견 현황) 추가함. 다만 "발견"이 서버에 기록되는 게 아니라 현재 활성 몬스터의 속성/단계로 매번 계산되는 방식이라, 나중에 몬스터 포획/전환 기능이 생기면 실제 "만나본 종" 기록 테이블로 바꿔야 함
- ~~PvP~~ → 해결됨(비동기 매칭 전투, [`pvp.md`](./pvp.md)). 몬스터 포획(교체) 기능은 여전히 없음(설계상 보스 처치=자동 성장 개념으로 대체됨, 애초 "포획" 요건은 스타터 선택으로 단순화됨)
- ~~장비/코스튬이 캐릭터 스프라이트에 시각적으로 반영되지 않음~~ → **코스튬은 해결됨**(042, 슬롯별 등급색 배지 오버레이로 시각화 + 인벤토리 안 "코스튬" 서브탭에서 착용/해제, [`pvp.md`](./pvp.md) 참고). 장비(무기/방어구 등 일반 장비)는 여전히 스프라이트에 미반영
- ~~PvP 전투력 계산에 장비/스킬 보너스 미포함~~ → **장비는 해결됨**(051, `calc_equipped_stat_bonus`로 장착 장비 4슬롯 보너스를 PvP/랭킹/`fetch_my_combat_power` 전부에 반영). **스킬 보유효과는 여전히 미반영** — 스킬 카탈로그가 50종이라 SQL에 포팅하려면 계산식(등급별 base + 레벨 보정)을 통째로 옮겨야 해서 범위가 더 큼. 스킬 비중이 더 커지면 다음 후보로 검토
- ~~2·3단계 진화 스프라이트 없음~~ → 해결됨(9종 벡터 스프라이트 전부 완성)
- ~~마이페이지/닉네임 수정~~ → 해결됨(닉네임 1회 수정)
- ~~스킬 커스터마이징~~ → 해결됨(뽑기/합성/편성 시스템)
- ~~로그아웃 시 상태 초기화가 일부만 됨~~ → **해결됨** — `handleSession(null)` 분기가 이제 게임 데이터 state(`profile`/`activeMonster`/`clearedStageIds`/`inventory`/`equipmentDrawProgress`/`userSkills`/`dungeonAttempts`/`dungeonProgress`/`dungeonBattle`/`jobDungeonBattle`/`worldBoss`/`worldBossProgress`/`worldBossSession`/`mission`/`hasUnreadMail`/`attendanceState`/`loginAt`/`currentStageIndex`/`activeTab` 등)를 전부 초기값으로 리셋함. 순수 UI 트랜지언트 플래그(로딩중/에러메시지 등)는 다음 액션에서 자연히 덮어써지므로 리셋 대상에서 제외함
