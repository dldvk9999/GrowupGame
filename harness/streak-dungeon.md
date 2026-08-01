# 연승의 던전 (migration 155/156, 신규 콘텐츠, 사용자 요청)

관련 파일: `StreakDungeonBattle.jsx`, `lib/streakDungeon.js`, `DungeonSelect.jsx`(`StreakDungeonPanel`), migration 155/156

## 개요

최신 방치형/캐주얼 RPG 시장에서 흔한 **"위험-보상 뱅킹"**(banked risk & reward) 구조를 적용한 신규 던전. 루비 던전(142)처럼 "매번 새 세션으로 보스 1마리와 싸우는" 단발성 구조를 베이스로 하되, **이기면 그 자리에서 선택해야 함**:

- **💰 지금 수령하기**: 지금까지의 연승을 확정하고 골드를 받음(연승 종료)
- **🔥 이어서 도전하기**: 다음 연승으로 진행. 상대는 훨씬 강해지지만 보상도 더 커짐. **단, 지면 이번 판 보상이 전부 사라짐**

기존 던전들과의 근본적 차이는 "승리해도 계속 걸지 말지 스스로 선택해야 하는 유일한 던전"이라는 점 — 손실회피 편향(loss aversion)을 이용한 긴장감이 핵심 리텐션 장치.

## 서버 설계

- `streak_dungeon_attempts(user_id, attempt_date, count)` — 하루 3회 **새로 시작**만 소모(기존 던전과 동일한 Asia/Seoul 08:00 리셋 패턴). "이어서 도전"은 추가 입장권을 쓰지 않음
- `streak_dungeon_sessions(id, user_id, owned_monster_id, streak, status, created_at, last_action_at)` — `status in ('active','banked','forfeited')`. **유저당 active 세션은 최대 1개만 허용**(부분 유니크 인덱스 `where status = 'active'`로 스키마 자체에서 강제) — 무한의 탑이 072→073에서 뒤늦게 겪었던 "중복 미클레임 세션 파밍" 클래스의 취약점을 처음부터 스키마 레벨에서 원천 차단
- `streak_dungeon_best(user_id pk, best_streak, achieved_at)` — 역대 최고 연승 기록. **뱅킹 여부와 무관하게, 승리해서 도달한 연승 수 자체가 `continue_streak_dungeon` 호출 시점에 기록됨** — "돈은 안 받았지만 그 층까지는 확실히 이겼다"는 걸 랭킹/업적에 인정하는 설계

### 핵심 함수

- `start_streak_dungeon()` — 이미 active 세션이 있으면 거부(먼저 이어가거나 포기해야 함), 하루 3회 제한 체크 후 streak=1로 새 세션 발급
- `continue_streak_dungeon(p_session_id)` — streak+1, **보상은 아직 지급 안 함**(다음 라운드 보스 정보만 갱신), `streak_dungeon_best` 갱신
- `bank_streak_dungeon(p_session_id)` — 현재 streak 기준 골드를 `calc_streak_dungeon_gold`로 계산해 확정 지급, 세션을 `banked`로 종료
- `forfeit_streak_dungeon(p_session_id)` — 패배 시 세션을 `forfeited`로 종료(보상 없음, 이미 도달했던 연승 기록 자체는 `continue` 시점에 이미 남아있어 소멸 안 됨)
- `fetch_my_active_streak_dungeon()` — 새로고침/재접속 시 진행 중이던 세션 복원용(방치형/모바일 특성상 앱이 자주 끊기므로, 로그인 시 자동 재개되도록 App.jsx 초기 로드에 포함시킴)
- 다른 일일 던전들과 동일하게 **"세션 생성/직전 액션 후 최소 1초"** 안티치트 게이트를 `continue`/`bank` 둘 다에 적용(부분적 완화책, [`security.md`](./security.md)와 동일한 신뢰 모델)

### 공식

```
calc_streak_dungeon_boss(level, streak):
  hp  = round(700 + level^1.35*18 + streak^1.75*260)
  atk = round(45  + level^1.15*3.6 + streak^1.55*17)
  def = round(30  + level^1.05*2.6 + streak^1.45*11)

calc_streak_dungeon_gold(level, streak):
  base = 220 + level^1.25*6
  gold = least(2000000, round(base * 1.3^(streak-1)))   -- 연승마다 1.3배 복리, 200만 상한(164에서 100만->200만 상향)
```

- 연승 지수(1.75/1.55/1.45)가 레벨 지수보다 훨씬 가파르게 설계돼 있어, "레벨이 높아서 편하다"보다 "이번 판을 얼마나 밀어붙였는가"가 난이도를 지배함
- 골드는 200만 상한 클램프가 있어(migration 164에서 사용자 요청으로 100만->200만 상향, 다른 던전들의 100만 클램프와는 별도 상수) 레벨/연승에 따라 대략 연승 20~33 부근에서 상한에 도달함 — 상한 도달 이후엔 "더 벌기"보다 "랭킹 기록 경신"이 계속하는 이유가 됨(의도된 설계)
- `bank_streak_dungeon`도 방어적으로 `least(2000000, ...)`를 한 번 더 감싸서 클램프(다른 던전들의 "최종 클램프 누락" 실수 클래스를 사전 방지, [`stages-and-dungeons.md`](./stages-and-dungeons.md)의 121 사례와 동일한 습관)

### 배포 전 시뮬레이션 검증

레벨(1/30/100/250/500) × 연승(1/5/10/20/30/50/100) 조합 35개를 Node로 직접 계산해 HP/ATK/DEF/골드가 전부 양수·정상범위이며 클램프(현재 200만)가 모든 조합에서 정확히 작동함을 확인. `calc_streak_dungeon_gold`가 `least()`를 정수 캐스팅 **이전에** 적용하는 순서라(`numeric`으로 계산 후 클램프 후 `::integer` 캐스트), 이론상 극단적으로 큰 streak 값에서도 int4 오버플로 없이 항상 안전하게 클램프됨을 코드 검토로 확인(반면 `streak` 컬럼 자체는 `integer + 1` 누적이라, 이론상 약 21억에 도달하면 오버플로 가능 — 안티치트 게이트가 초당 1회로 제한하므로 도달까지 68년 이상 걸려 현실적 위험 없음, `todo.md`에 저위험 항목으로만 기록).

## 클라이언트 설계

- `StreakDungeonBattle.jsx`는 `RubyDungeonBattle.jsx`를 베이스로 새로 작성(검증된 컴포넌트를 직접 건드리지 않고 복사 후 승리 화면만 교체하는 방식 — 142의 루비던전이 전직던전을 베이스로 했던 것과 동일한 접근)
- 승리 화면에 "지금 수령"/"이어서 도전" 두 버튼 + 두 경우의 예상 골드를 각각 표시(`previewStreakDungeonGold`, 클라이언트 미리보기용 공식 미러 — 실제 지급액은 항상 서버가 최종 계산)
- "이어서 도전" 성공 시 부모(App.jsx)가 `streak` state만 갱신 → `key` prop이 바뀌며 컴포넌트가 통째로 리마운트되어 다음 라운드 보스로 새로 시작(체력 풀로 리셋, 기존 던전들의 "라운드마다 새 세션" 관례와 동일)
- 패배 화면은 "던전 목록으로" 버튼 하나만 있고, 클릭 시 `forfeit_streak_dungeon` 호출 후(실패해도 무시하고) 항상 화면을 닫음 — 네트워크 문제로 사용자가 화면에 갇히는 상황 방지
- `App.jsx` 초기 로드 시 `fetchMyActiveStreakDungeon()`으로 진행 중이던 세션을 자동 복원(신규 콘텐츠라 처음부터 이 케이스를 고려해 설계)

## 랭킹 & 업적

- `fetch_streak_dungeon_leaderboard()`/`fetch_my_streak_dungeon_rank()` — 무한의 탑 랭킹(071)과 완전히 동일한 패턴(TOP20 + 20위 밖 별도 표시)
- 마일스톤 업적 3종(migration 156): `streak_10`(4,000골드) / `streak_25`(18,000골드) / `streak_50`(70,000골드, 엔드게임 자랑거리) — `check_achievement_eligibility`/`claim_all_achievements`에 CASE/배열만 추가, 반환 컬럼 그대로라 DROP FUNCTION 불필요. diff로 기존 198개 분기 순수 보존 확인([`attendance-and-achievements.md`](./attendance-and-achievements.md))

## 알려진 제한 (낮은 우선순위)

- 승리 직후 클라이언트가 `persistMonsterGrowth`(레벨/경험치 저장)를 **비동기로 fire-and-forget** 호출하는 동안 사용자가 곧바로 "수령"을 누르면, 서버가 참조하는 `owned_monsters.level`이 아주 드물게 화면에 표시된 최신 레벨보다 한 틱 뒤처져 있을 수 있음(골드 계산에 레벨이 관여하므로 이론상 미세한 오차 가능). 1초 안티치트 게이트가 사실상 이 저장 시간을 충분히 커버해 실사용에서 체감되긴 어렵다고 판단 — 발생 빈도가 보이면 재검토
