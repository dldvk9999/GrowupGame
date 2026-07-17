# 스킬 시스템

관련 파일: `skillCatalog.js`, `skills.js`, `skillGacha.js`, `SkillGacha.jsx`, `SkillButton.jsx`, `jobAdvancement.js`

## 폴백용 기본 스킬 (실제 플레이엔 안 쓰임)

⚠️ `skills.js`의 아래 5종은 **안전 폴백용**(장착 스킬이 0개인 예외 상황 대비)일 뿐, 실제 플레이 스킬은 상점의 스킬 뽑기로 획득함:

| 스킬 | 타입 | 배율/회복 | 쿨타임 |
|---|---|---|---|
| 🔥 불꽃 발톱 | damage | 1.1배 | 0.8초 |
| ☄️ 화염구 | damage | 1.7배 | 2.2초 |
| 🌋 폭염 브레스 | damage | 2.3배 | 3.6초 |
| 💥 분노의 강타 | damage | 3.0배 | 5초 |
| ✨ 재생의 불씨 | heal | 최대체력 22% | 6초 |

## 뽑기 스킬 카탈로그 (50종)

`skillCatalog.js`의 `SKILL_CATALOG` — 등급당 **10종 × 5등급 = 총 50종**(migration 006 시드 15종 + 017 추가 35종). 서버 `skill_catalog` 테이블과 값이 반드시 동일하게 유지되어야 함.

등급별 구성: 4종 damage / 2종 heal / 1종 stun / 1종 dot / 1종 buff(atk 또는 def) / 1종 haste

- **base(=power)**는 등급마다 ×1.4 기하급수로 벌어짐(노멀 1.0 → 신화 3.84 근방)
- **스킬레벨 성장식**: `실효값 = base × (1 + (level-1)×0.003)` — 원래 레벨100 상한일 때는 최대 성장폭이 약 ×1.3에 불과해서, 등급 간 base가 ×1.4씩 벌어진 설계상 아무리 강화해도 다음 등급의 1레벨 기본값을 못 넘도록 의도했었음. **migration 039에서 레벨 상한을 1000으로 올리면서 수식은 그대로 유지** — 레벨1000 최대 성장폭은 약 ×3.3까지 커져서 다음 등급 기본값을 넘어설 수 있음(의도된 변경)
- **중복 뽑기 시 새 스킬 대신 기존 스킬의 `skill_level`이 +3 상승**(최대 **1000**, 039에서 100→1000으로 상향) — `user_skills` 테이블은 `unique(user_id, skill_key)` 제약으로 중복 row 자체가 안 생김

## 스킬 타입별 전투 로직

`BattleScreen`/`DungeonBattle`/`JobDungeonBattle` 세 화면에 동일하게 구현. 값 해석 기준은 `skillCatalog.js` 상단 주석 참고:

- **`damage`**: 기존과 동일, `mitigateDamage(atk*배율, 상대방어력)`
- **`heal`**: 기존과 동일, 최대체력 대비 %
- **`stun`**: `base` = 기절 지속시간(초). 적 자동공격 인터벌이 매 틱마다 `Date.now() < enemyStunnedUntil`인지 체크해서, 기절 중이면 공격을 스킵함(로그로 안내)
- **`dot`**: `base` = 틱당 데미지 배율, `ticks`/`tickInterval`(카탈로그 고정값)만큼 `setTimeout`을 예약해서 일정 간격으로 데미지를 흘림. 시전 시점의 방어력 기준으로 틱뎀 확정(성장/버프 변동은 반영 안 됨, 단순화)
- **`buff_atk`/`buff_def`**: `base` = 스탯 증가 배율(예 0.3=+30%), `duration`(고정)만큼 지속. `playerBuffs` state에 `{atkUntil, atkMult}`/`{defUntil, defMult}`로 저장하고, 데미지를 주고받는 매 순간 `Date.now()`와 비교해서 활성 여부 판정 후 배율 곱함
- **`haste`**: `base` = 쿨타임 감소 비율(예 0.3=-30%), `duration`만큼 지속. 즉시 발동 중인 다른 스킬의 타이머를 되돌리진 않고, **헤이스트가 켜진 상태에서 스킬을 쓸 때마다 그 스킬의 쿨타임 자체가 줄어서 적용**되는 방식(구현 단순화 - "앞으로 쓰는 스킬들이 더 빨리 도는" 개념)

부가 UI:
- 버프/기절 상태는 `BuffStatusRow` 컴포넌트가 HP바 아래에 배지로 표시함(⚔️공격력상승/🛡️방어력상승/💫적기절중). 헤이스트(쿨타임 감소)는 HP바 아래 배지는 없애고 캐릭터 위 아이콘으로만 표시함(아래 참고, 배지가 중복 정보라 정리함)
- 헤이스트로 실제 쿨타임이 줄어든 경우, `SkillButton`에는 `skill.cooldown` 대신 그때 계산된 `effectiveCooldowns[skill.id]`를 넘겨서 링 애니메이션도 정확한 시간에 맞춰 돎
- **캐릭터 위 상태 아이콘**: 헤이스트(⚡, 지속시간 동안 빙글빙글 회전)와 회복(💚, 사용 시 1.3초짜리 팝업 애니메이션) 스킬은 HP바 아래 배지뿐 아니라 **플레이어 스프라이트 바로 위**에도 아이콘이 뜨도록 4개 전투화면(스테이지/일반던전/전직던전/월드보스) 전부에 `player-status-fx` 오버레이를 추가함 — 캐릭터를 안 보고 로그/배지만 봐도 알 수 있던 것을, 캐릭터 쪽만 봐도 바로 알 수 있게 보강
- **전직(각성) 스킬 전용 강화 이펙트**: `getJobSkillTier(skillId)`(`jobAdvancement.js`)로 지금 쓴 스킬이 `${element}_job${1~5}` 패턴의 전직 스킬인지 판별하고, 맞으면 **차수가 높을수록 파티클 개수·크기가 커지고**(`spawnParticles`에 `sizeMult` 파라미터 추가), **3차 이상부터는 타격 순간 화면 전체에 등급별 색상의 짧은 플래시**(`job-skill-flash`, `mix-blend-mode: screen`)가 번쩍임. 1차~5차 색상은 각각 노랑→주황→빨강→핑크→보라로 점점 화려해짐

## 전직 스킬

전직 던전 클리어 시 해금, 속성별로 다름, 전부 `damage` 타입. 상세 수치는 [`character-and-growth.md`](./character-and-growth.md)의 전직 단계표 참고.

## 스킬 편성

- **뽑기 화면과 완전히 분리된 별도 탭**(상점 안 "🧩 스킬 편성", `SkillLoadout.jsx`) — 원래는 스킬 뽑기 화면 하단에 같이 있었지만, 보유 스킬이 많아지면서 편성 UI만 따로 뺌
- 편성 슬롯 + 저장 버튼 영역이 **`position: sticky`로 화면 상단에 고정**됨(`loadout-sticky-bar`) — 스킬 목록이 길어서 아래로 스크롤해도 슬롯이 항상 보이고 바로 편성/저장할 수 있음. 헤더(`app-header`)도 이미 sticky라서, 로딩바가 헤더에 바로 딱 붙지 않도록 `top` 값을 "헤더 높이 + 15px"로 잡음(데스크톱 84px, 모바일 76px — 헤더 padding/버튼 높이 기준 추정치라 실제 렌더 결과 보고 미세조정 가능)
- 편성바 상단의 토글 버튼(`▲ 접기` / `▼ 펼치기`)으로 **슬롯 영역 자체를 접었다 펼 수 있음**(`collapsed` state) — 접으면 "편성 슬롯 (N/M)" 요약 한 줄만 남고 슬롯/안내문구/저장버튼이 다 숨겨져서, 스크롤 공간을 아낄 수 있음
- 장착 슬롯 수는 활성 몬스터 레벨에 따라 1→5개로 증가 (`getSkillSlotCount`: Lv10/25/50/75가 기준점)
- `profiles.equipped_skills`(text[])에 저장, RPC `set_skill_loadout`이 슬롯수/보유여부/중복을 서버에서 재검증
- `BattleScreen`은 고정 스킬(`skills.js`의 SKILLS) 대신 **App.jsx가 계산해서 넘겨주는 `equippedSkills` prop**을 사용함. 장착 스킬이 0개인 예외 상황(마이그레이션 이전 계정 등)엔 `skills.js`의 첫 스킬로 안전 폴백함. 전직 스킬은 `jobAdvancement.js`의 `getAvailableSkills`가 이 목록에 추가로 붙여줌

## 뽑기 비용/레벨

- 뽑기 비용은 **1회당 정가 💰300** (migration 015에서 레벨연동 공식→고정가로 변경, 뽑기레벨은 등급 확률에만 영향)
- **뽑기 레벨**: `1 + floor(누적뽑기횟수/1000)`, 최대 20 (1000회당 1레벨, 011에서 5회→1000회로 변경). 레벨 구간별로 고등급 확률이 계단식으로 상승(RPC `draw_skill` 내부 CASE문 참고)
- **1/10/100연차 뽑기** 지원(`draw_skill_batch` RPC) — 골드 부족하면 그 시점까지만 뽑고 부분 성공 반환
- 신규 유저는 스타터 생성 시 `basic_strike` 1개를 무료로 자동 지급+장착받음(`create_starter_monster` RPC)
- `G`/`Shift+G`/`Ctrl+G` 키보드 단축키로 1/10/100회 뽑기 가능 (자세한 내용은 [`ui-and-ux.md`](./ui-and-ux.md))
- ⚠️ **버그 수정 이력**: 뽑을 때마다 서버는 `profiles.total_skill_draws`를 정상적으로 증가시키는데, **클라이언트가 뽑은 뒤 그 값을 다시 안 불러와서** 뽑기레벨/진행바가 새로고침 전까지 그대로 멈춰있던 버그가 있었음(장비뽑기 쪽은 `refreshInventory`가 `equipmentDrawProgress`까지 같이 재조회하도록 이미 고쳐져 있었는데, 스킬뽑기의 `refreshSkills`는 `user_skills`만 재조회하고 `profile`은 빠뜨렸던 게 원인). `App.jsx`의 `refreshSkills`가 `fetchUserSkills`와 `getMyProfile`을 함께 호출해서 `profile.total_skill_draws`까지 갱신하도록 수정함

## 스킬 보유효과

`getSkillPossessionBonus`/`sumSkillPossessionBonus`(`skillCatalog.js`) — 장비처럼 스킬도 **보유만 하고 있으면(장착 여부 무관) 상시 공격력 보너스**를 줌.

- 등급별 기준치: 노멀 2 / 레어 4 / 에픽 8 / 전설 16 / 신화 32
- `1 + (스킬레벨-1)*0.01`을 곱해서 스킬레벨이 오를수록도 같이 커짐
- `App.jsx`가 `sumSkillPossessionBonus(userSkills)`로 보유 스킬 전체 합산치를 계산해서 장비 보너스(`equipmentBonus.atk`)에 더해 전투에 반영함 — 즉 실제 전투력에는 "장착 보너스 + 장비 보유효과 + 스킬 보유효과"가 전부 누적됨
- 스킬 뽑기 화면에 개별 스킬 카드마다, 그리고 전체 합계도 표시됨

## 스킬 아이콘 관련 버그 노트

⚠️ 스킬 아이콘 일부가 특정 기기/브라우저에서 X박스(글자 없음)로 보이는 문제가 있었음 — `stone_throw`(🪨)와 `phoenix_feather`(🪶)가 Unicode 13.0(2020년) 이모지라 오래된 폰트/OS에서 지원이 안 될 수 있었음. 각각 🔨/💖(둘 다 훨씬 오래되고 보편적인 이모지)로 교체함. 추가로 `index.css`의 기본 `font-family`에 `Apple Color Emoji`/`Segoe UI Emoji`/`Noto Color Emoji` 등 이모지 전용 폰트를 폴백으로 추가해서, 특정 이모지가 본문 폰트에 없어도 브라우저가 시스템 이모지 폰트로 대체 렌더링하도록 시스템적으로 보강함.

**새 스킬/아이템에 이모지 아이콘을 넣을 땐 너무 최신(대략 2019년 이후) 이모지는 피할 것.**
