# GrowupGame (키우기 게임) — 프로젝트 현황 문서

> 이 파일은 지금까지 구현된 모든 기능/구조/DB 스키마를 기록한 문서입니다.
> **대화 맥락 없이 이 파일만 읽어도 프로젝트 전체를 파악할 수 있도록 작성되어 있습니다.**
> 기능이 추가/변경될 때마다 이 파일도 함께 업데이트됩니다. (아래 "문서 관리 원칙" 참고)

마지막 업데이트: 아이템 강화 시스템 추가 시점 (migration 005까지 반영)

---

## 1. 게임 개요

- **장르**: 몬스터 포획 + 육성 + 방치형(자동사냥) 웹 게임
- **컨셉**: 3속성(불/물/풀) 중 하나의 스타터 몬스터를 골라 계약하고, 100개 챕터 × 10스테이지를 돌며 몬스터를 육성/전직시키고 장비를 강화해 최종 챕터까지 진행
- **플랫폼**: 웹 브라우저 (Vite + React SPA), 반응형(모바일~데스크톱)
- **필수 요건**: 로그인/회원가입, 닉네임 중복불가, 로그인 시 이어하기, 로비 실시간 채팅

---

## 2. 기술 스택

- **프론트엔드**: Vite + React 18, 순수 CSS(`src/index.css`, 다크 판타지 테마, CSS 변수 기반, 반응형), **PWA**(`vite-plugin-pwa`, `manifest.webmanifest` + 서비스워커 자동생성, 헤더의 "⬇️ 앱 다운로드" 버튼이 `beforeinstallprompt` 이벤트를 잡아서 설치 유도 - `src/lib/usePwaInstall.js`)
- **백엔드**: Supabase (Auth + Postgres + Realtime), `@supabase/supabase-js`
- **레포**: https://github.com/dldvk9999/GrowupGame (브랜치: `master`)
- **로컬 실행**: `npm install && npm run dev` (루트에 `.env` 필요, 아래 6번 참고)

---

## 3. 파일 구조

```
GrowupGame/
├─ index.html, vite.config.js, package.json
├─ .env.example                    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SPRITE_CDN_URL
├─ src/
│  ├─ main.jsx                     # index.css import + React 마운트
│  ├─ App.jsx                      # 전체 플로우 컨트롤러 (아래 8번 참고)
│  ├─ index.css                    # 전역 반응형 스타일 (다크 테마)
│  ├─ components/
│  │  ├─ AuthScreen.jsx            # 로그인/회원가입 탭, 닉네임 실시간 중복확인
│  │  ├─ StoryIntro.jsx            # 최초 진입 시 세계관 인트로 (story.js 사용)
│  │  ├─ StarterSelect.jsx         # 스타터 3종(fire_1/water_1/grass_1) 선택
│  │  ├─ ChapterStory.jsx          # 새 챕터 진입 시 스토리 배너 (stageStory.js 사용)
│  │  ├─ BattleScreen.jsx          # 전투 화면 (자동사냥 + 스테이지 도전, 아래 9번 참고)
│  │  ├─ SkillButton.jsx           # 스킬 버튼 공용 컴포넌트 (쿨타임 링 UI, 전투화면 3곳 공유)
│  │  ├─ StageSelect.jsx           # 100챕터×10스테이지 선택 UI
│  │  ├─ Shop.jsx                  # 상점(구매) + 인벤토리(장착/강화) UI
│  │  └─ MonsterSprite.jsx         # 몬스터 이미지 렌더링 (벡터→외부이미지 자동 폴백)
│  ├─ assets/sprites/
│  │  ├─ FireStage1.jsx, WaterStage1.jsx, GrassStage1.jsx   # 스타터 1단계 SVG 벡터 일러스트
  │  ├─ FireStage2/3.jsx, WaterStage2/3.jsx, GrassStage2/3.jsx  # 2·3단계 진화 SVG 벡터 일러스트
│  │  └─ index.js                  # sprite_key → 벡터 컴포넌트 매핑 레지스트리
│  └─ lib/
│     ├─ supabaseClient.js         # Supabase 클라이언트 초기화
│     ├─ auth.js                   # 회원가입/로그인/로그아웃/닉네임 중복확인/프로필 조회
│     ├─ speciesData.js            # 9종(3속성×3진화) 클라이언트 스탯 테이블 + 진화 체인
│     ├─ speciesDbIds.js           # speciesId(문자열, 예 'fire_1') ↔ DB species_id(정수) 매핑
│     ├─ growth.js                 # 레벨업/경험치/자동진화/전직배율 계산 엔진 (핵심 로직)
│     ├─ jobAdvancement.js         # 3차 전직 시스템 (Lv.30/60/100) 데이터 + 헬퍼
│     ├─ skills.js                 # 기본 스킬 5종 정의
│     ├─ stages.js                 # 100챕터×10스테이지 절차적 생성 + 필드(자동사냥)몹 생성
│     ├─ stageStory.js             # 챕터 진입 스토리 + 스테이지별 짧은 플레이버 텍스트
│     ├─ combat.js                 # 방어력 데미지 경감 공식 (mitigateDamage), 전투화면 3곳 공유
│     ├─ story.js                  # 최초 진입 세계관 인트로 텍스트
│     ├─ monsters.js               # 몬스터 CRUD (스타터 생성/활성몬스터 조회/성장 저장) - RPC 경유
│     ├─ stageProgress.js          # 스테이지 클리어 기록/조회 - RPC 경유
│     ├─ economy.js                # 골드 지급/차감 RPC 래퍼
│     ├─ itemCatalog.js            # 4슬롯×5등급 아이템 정적 카탈로그 + 강화 확률/비용 계산
│     ├─ inventory.js              # 인벤토리 조회/구매/장착/해제 - 구매는 RPC 경유
│     ├─ enhance.js                # 아이템 강화 RPC 래퍼
│     └─ useLobbyChat.js           # 로비 실시간 채팅 훅 (Supabase Realtime 구독)
└─ supabase/migrations/
   ├─ 001_init.sql                 # 최초 스키마 전체 (아래 6번 참고)
   ├─ 002_fix_nickname_and_active_constraint.sql
   ├─ 003_inventory_and_gold.sql
   ├─ 004_security_patch.sql       # ⚠️ 가장 중요한 보안 패치
   └─ 005_item_enhancement.sql
```

---

## 4. 전체 유저 플로우 (App.jsx의 STAGE 상태머신)

```
LOADING → (세션 없음) → AUTH (로그인/회원가입)
                ↓ (세션 있음, 활성 몬스터 없음)
              STORY (세계관 인트로, 최초 1회)
                ↓
              STARTER (스타터 3종 중 택1)
                ↓
              GAME (메인 화면, 하단 탭: 전투/스테이지/상점/인벤토리/던전, 헤더: 마이페이지/설정)
                ↑↓
         CHAPTER_STORY (새 챕터 처음 진입 시에만 잠깐 표시)
```

- 로그인 시 `getActiveMonster()`로 활성 몬스터를 불러오고, `fetchClearedStageIds()`로 클리어 기록을 불러와 **가장 마지막으로 진행하던 스테이지(최고 클리어+1)부터 자동으로 이어서 시작**함. 이걸로 "로그인하면 저장된 지점부터 재개" 요건을 만족.
- 활성 몬스터가 없으면(최초 유저) STORY → STARTER 플로우로 진입.

---

## 5. 게임 시스템 상세

### 5-0. 인증 (`AuthScreen.jsx`, `auth.js`, `supabaseClient.js`)

- **자동 로그인 체크박스**: 로그인 화면에서 체크하면 세션이 `localStorage`(브라우저를 껐다 켜도 유지)에, 체크 해제하면 `sessionStorage`(탭/브라우저를 닫으면 사라짐)에 저장됨. 기본값은 체크됨(true)
- 구현은 `supabaseClient.js`에 커스텀 storage 어댑터(`customStorage`)를 넣어서, `growupgame-remember-me`라는 플래그(항상 localStorage에 기록)를 보고 실제 세션 토큰을 어디에 쓸지 그때그때 결정하는 방식. `setRememberMe(true/false)`를 로그인 시도 **직전**에 호출해야 함(그래야 `signInWithPassword`가 세션을 저장할 때 올바른 storage로 감) — `auth.js`의 `signIn()`이 이 순서를 보장함
- 새 계정 첫 방문(플래그 없음)은 기본적으로 sessionStorage 취급(브라우저 재시작 시 로그아웃) — 명시적으로 체크해야 영구 유지되는, 흔한 "로그인 유지" UX 패턴

### 5-1. 캐릭터/육성 (`growth.js`, `speciesData.js`, `jobAdvancement.js`)

- 스타터 3종: `fire_1`(이모탄) / `water_1`(아쿠파피) / `grass_1`(새프링)
- 각 속성은 3단계 진화(1→2→3차)가 있음: 예) 이모탄→이모드릴→이모라돈 (Lv.15, Lv.30에서 자동 진화)
- **레벨업**: `expToNextLevel(level) = round(20 * level^1.5)`
- **스탯 성장**: `base스탯 × (1 + (level-1)*0.12) × 전직배율`
- **3차 전직 시스템** (`jobAdvancement.js`): Lv.30/60/100에서 조건 충족(전직 가능 알림), **전직 던전(5-9-1 참고)을 클리어해야 실제 적용됨** — 레벨업만으로 자동 전직되지 않음
  - 전직배율: **1차 2.0배 / 2차 3.5배 / 3차 6.0배** (스탯에 곱연산 적용, 대폭 강화됨 — 서버 `save_monster_growth`의 스탯 상한선도 6.0배 기준으로 011에서 함께 상향)
  - 전직할 때마다 **전용 스킬 1개씩 추가 습득** (전직 스킬 3개는 계속 누적, 기본 5스킬과 별개로 유지)
  - 전직에 성공하면 **외형도 전용 그래픽으로 바뀜** (5-9-1 참고)
- **진화**와 **전직**은 별개 시스템: 진화=외형/도감상 종족 변경, 전직=같은 종족 내 강함 단계

### 5-2. 스킬 (`skillCatalog.js` + `jobAdvancement.js`)

⚠️ `skills.js`의 아래 5종은 **안전 폴백용**(장착 스킬이 0개인 예외 상황 대비)일 뿐, 실제 플레이 스킬은 상점의 스킬 뽑기(5-5, 5-8)로 획득함:
| 스킬 | 타입 | 배율/회복 | 쿨타임 |
|---|---|---|---|
| 🔥 불꽃 발톱 | damage | 1.1배 | 0.8초 |
| ☄️ 화염구 | damage | 1.7배 | 2.2초 |
| 🌋 폭염 브레스 | damage | 2.3배 | 3.6초 |
| 💥 분노의 강타 | damage | 3.0배 | 5초 |
| ✨ 재생의 불씨 | heal | 최대체력 22% | 6초 |

**뽑기 스킬 카탈로그(`skillCatalog.js`, 017)**: 등급당 **10종 × 5등급 = 총 50종**(006 시드 15종 + 017 추가 35종). 등급별로 4종 damage / 2종 heal / 1종 stun / 1종 dot / 1종 buff(atk 또는 def) / 1종 haste 구성. base(=power)는 등급마다 ×1.4 기하급수로 벌어짐(노멀 1.0 → 신화 3.84 근방), 레벨 성장식은 기존과 동일(`getEffectiveSkillValue`, 레벨100 최대 ×1.297)

**스킬 타입별 전투 로직** (`BattleScreen`/`DungeonBattle`/`JobDungeonBattle` 세 화면에 동일하게 구현, 값 해석 기준은 `skillCatalog.js` 상단 주석 참고):
- `damage`: 기존과 동일, `mitigateDamage(atk*배율, 상대방어력)`
- `heal`: 기존과 동일, 최대체력 대비 %
- `stun`: `base`=기절 지속시간(초). 적 자동공격 인터벌이 매 틱마다 `Date.now() < enemyStunnedUntil`인지 체크해서, 기절 중이면 공격을 스킵함(로그로 안내)
- `dot`: `base`=틱당 데미지 배율, `ticks`/`tickInterval`(카탈로그 고정값)만큼 `setTimeout`을 예약해서 일정 간격으로 데미지를 흘림. 시전 시점의 방어력 기준으로 틱뎀 확정(성장/버프 변동은 반영 안 됨, 단순화)
- `buff_atk`/`buff_def`: `base`=스탯 증가 배율(예 0.3=+30%), `duration`(고정)만큼 지속. `playerBuffs` state에 `{atkUntil, atkMult}`/`{defUntil, defMult}`로 저장하고, 데미지를 주고받는 매 순간 `Date.now()`와 비교해서 활성 여부 판정 후 배율 곱함
- `haste`: `base`=쿨타임 감소 비율(예 0.3=-30%), `duration`만큼 지속. 즉시 발동 중인 다른 스킬의 타이머를 되돌리진 않고, **헤이스트가 켜진 상태에서 스킬을 쓸 때마다 그 스킬의 쿨타임 자체가 줄어서 적용**되는 방식(구현 단순화 - "앞으로 쓰는 스킬들이 더 빨리 도는" 개념)
- 버프/기절 상태는 `BuffStatusRow` 컴포넌트가 HP바 아래에 배지로 표시함(⚔️공격력상승/🛡️방어력상승/⚡쿨감/💫적기절중)
- 헤이스트로 실제 쿨타임이 줄어든 경우, `SkillButton`에는 `skill.cooldown` 대신 그때 계산된 `effectiveCooldowns[skill.id]`를 넘겨서 링 애니메이션도 정확한 시간에 맞춰 돎

전직 스킬 (속성별로 다름, 전직 던전 클리어 시 해금, 전부 `damage` 타입):
- 1차(Lv.30): 배율 3.6배, 쿨타임 6.5초
- 2차(Lv.60): 배율 4.6배, 쿨타임 8초
- 3차(Lv.100): 배율 6.2배, 쿨타임 10초
- 4차(Lv.140, 021 신규): 배율 8.2배, 쿨타임 12.5초, statMultiplier 10.0배(기존 3차 6.0배에서 상향)

**전투력 표시**: `calculateCombatPower(monster)`(`combat.js`) = `atk*4.5 + def*3.2 + maxHp*0.6`(반올림). 세 전투 화면(스테이지/일반던전/전직던전) 상단 배지에 "⚔️ 나의 전투력 N"으로 항상 표시됨 — 장비 보유효과/장착 보너스까지 다 반영된 `player` 객체 기준이라 실제 체감 강함과 대략 비례함

**스킬 쿨타임 UI(`SkillButton.jsx`)**: 스킬 사용 시 버튼 테두리에 시계방향으로 채워지는 원형 링이 뜸 (`conic-gradient` + mask로 도넛 형태 구현, `requestAnimationFrame`으로 매 프레임 각도 갱신). 실제 쿨타임 종료 판정은 기존처럼 부모의 `setTimeout` 기반 `cooldowns` state가 담당하고, 링은 순수 시각효과(`cooldownStarts`에 사용 시각 기록해서 계산)라 로직에 영향 없음. `BattleScreen`/`DungeonBattle`/`JobDungeonBattle` 세 전투 화면 전부 이 컴포넌트를 공유함

### 5-3. 스테이지 시스템 (`stages.js`, `stageStory.js`)

- **100챕터 × 10스테이지 = 1000스테이지**, `stage_id`는 1~1000 순번 (`toStageIndex(chapter, stage)`)
- 각 챕터 10번째 스테이지는 **보스** (같은 챕터 잡몹보다 체력 1.9배, 공격력 1.5배)
- 챕터별 속성은 `fire→water→grass` 3개씩 순환 배정
- 몬스터 스탯은 전체 진행도(index)에 비례해 절차적으로 스케일링 (`getStageEnemy`)
- **스토리 진행**: 새 챕터 첫 진입 시 `ChapterStory` 배너 표시(`getChapterStory`), 서브스테이지 진입마다 전투 로그에 짧은 플레이버 텍스트(`getStageFlavor`) — "몬스터 잡을 때도 스토리가 계속되게" 요건 충족
- **스테이지 잠금 해제 로직**: `stage_id===1` 이거나 이전 스테이지가 클리어됨 → 오픈. 클리어한 스테이지는 언제든 자유 재도전 가능
- **스테이지 선택 UI** (`StageSelect.jsx`): 챕터를 **좌우로 스와이프하는 카드 캐러셀**로 표시. 카드에는 대표 몬스터 이미지(`MonsterSprite`), 챕터명/속성, 클리어 진행도, 짧은 스토리 요약(`getChapterStory`의 body 3줄 클램프)이 들어감. 카드를 선택하면 하단에 해당 챕터의 10개 서브스테이지 그리드가 나타남. 잠긴 챕터는 회색 처리+자물쇠 아이콘, 현재 위치엔 "현재" 뱃지.
- **난이도**: `hp = round(30 + index*5.0*(보스면 2.4)*chapterStep)`, `chapterStep = 1 + (chapter-1)*0.04` — **10스테이지(=챕터 1개) 단위로 소폭 계단식 상승**이 기존 연속 스케일링 위에 추가로 곱해짐(012에서 계수 재상향: 4.0→5.0, 보스 2.1→2.4). `atk`도 동일 구조(0.44→0.56, 보스 1.7→2.0). **방어력(`def`) 신설** — `def = round(3 + index*0.25*(보스면 1.6)*chapterStep)`, 몬스터/보스/일반던전보스/전직던전보스 전부 적용됨. 데미지 계산 시 `mitigateDamage(rawDamage, defenderDef)`(`combat.js`, `100/(100+def)` 공식)로 경감되며, **플레이어 쪽도 자기 `def`로 받는 피해가 경감**됨(예전엔 방어력이 사실상 장식 스탯이었음). 전직해서 공격력이 급격히 세져도 후반 스테이지는 몬스터 방어력 때문에 여전히 버거워지도록 의도한 밸런스 — 실제 플레이해보고 너무 세거나 약하면 `stages.js`/`dungeonStages.js`/`jobDungeon.js`의 계수 조정하면 됨. 보상도 같이 상향: `expReward = round(hp*(보스 1.5, 일반 0.85))`, `goldReward`는 기존 공식의 **5배**(서버 `calc_stage_gold`도 동일 공식 반영, 012 — def는 골드 공식에 영향 없어서 서버 쪽은 변경 불필요). 적 공격 텀은 1.9초로 단축(`BattleScreen.jsx`의 `ENEMY_ATTACK_INTERVAL`, 012에서 2.1→1.9초). 일반 던전 보스도 같은 맥락으로 난이도 상향(`dungeonStages.js`)
- **자동사냥 보상**: `hp = max(10, round(8 + chapter*2.0 + playerLevel*3.0))` — 챕터/레벨 가중치를 대폭 올려서(기존 0.6/0.8 → 2.0/3.0) **레벨이 높거나 진행 챕터가 높을수록 자동사냥 보상이 눈에 띄게 커짐**. exp/gold 둘 다 이 hp에 비례하므로 자동으로 같이 상향됨. 서버 `calc_idle_gold`도 동일 공식 반영(012)
- **자동사냥 처치 텀**: 1.5초(`BattleScreen.jsx`의 `IDLE_KILL_INTERVAL`, 021에서 3초→1.5초로 2배 단축)
- ⚠️ 난이도 상향으로 최후반 챕터(100) 보스 골드가 `add_gold` 기존 상한(100000)을 넘어설 수 있어서, 012에서 상한을 **400000**으로 재상향함

### 5-4. 전투 방식 (`BattleScreen.jsx`) — 자동사냥 vs 스테이지 도전

전투 탭은 두 가지 모드로 동작함:

1. **`idle` 모드 (기본값)**: 탭 진입 시 자동으로 시작됨. 3초(`IDLE_KILL_INTERVAL`)마다 필드 몬스터(`getIdleMonster`, 공격력 0이라 안전, 스테이지 몬스터보다 훨씬 약함)를 자동으로 처치하고 소량의 경험치/골드 획득. 사용자가 아무것도 안 눌러도 계속 진행됨.
2. **`challenge` 모드**: "⚔️ 도전하기" 버튼을 눌러야 시작. 실제 스테이지에 배정된 몬스터(`getStageEnemy`)와 진짜 전투 — HP 실시간 표시, 스킬 사용, 적 자동 반격(2.4초 텀). 승리 시 스테이지 클리어 처리 + 정식 보상, 패배 시 재도전 가능.
   - 승리 결과창에는 **"다음 스테이지로" / "스테이지 목록" / "사냥터로"** 3버튼 제공 (전투 후 방치되는 UX 문제 해결됨)

- 전투 이펙트: `<canvas>` 기반 파티클(타격 시 튀는 입자) + 화면 스크린쉐이크
- 장비 보너스(`equipmentBonus`)는 전투 중에만 스탯에 더해지고, DB에 저장되는 성장치(`grownBase`)에는 포함되지 않음 (장비를 빼도 순수 캐릭터 성장은 그대로 유지되는 구조)

### 5-5. 재화/상점/장비 (`itemCatalog.js`, `inventory.js`, `Shop.jsx`, `Inventory.jsx`, `EquipmentGacha.jsx`)

- **상점(`Shop.jsx`)은 이제 뽑기 전용**임 — 직접 구매(`buy_item`)는 완전히 폐지되고 서버에서 RPC EXECUTE 권한 자체를 회수함(014). 탭 5개: 🗡️ 무기뽑기 / 🛡️ 방어구뽑기 / 🧤 장갑뽑기 / 👢 신발뽑기 / 🎯 스킬뽑기 — 스킬뽑기(`SkillGacha.jsx`)도 이제 상점 안에 통합돼있고, 하단 게임 탭에는 더 이상 별도로 없음
- 몬스터 처치(자동사냥/스테이지 클리어 모두) 시 **골드 획득** → 이 골드로 뽑기(스킬/장비 5종 공통)
- 4개 슬롯: 무기(`weapon`, atk) / 보호구(`armor`, def) / 장갑(`gloves`, atk 보조) / 신발(`shoes`, hp)
- 5개 등급: 노멀 < 레어 < 에픽 < 전설 < 신화 (등급 오를수록 스탯 보너스 ↑) — `item_catalog`(서버)/`itemCatalog.js`(client)의 값은 그대로 유지, 가격(`price`)은 더 이상 안 쓰임(직접구매가 없으니)
- **장비 뽑기(`EquipmentGacha.jsx`, 014, 017)**: 슬롯별로 완전히 분리된 뽑기 4개. 스킬뽑기와 동일 구조(뽑기레벨 1~20, 1000회당 1레벨, 등급 확률표 동일, 1/10/100연차). 지정한 슬롯 안에서만 등급이 뽑힘(슬롯은 더 이상 랜덤 아님 — 013의 랜덤슬롯 방식에서 변경됨). **뽑기레벨도 4슬롯이 완전히 독립적**임(017) — `equipment_gacha_progress` 테이블(`user_id, slot` 복합키)에 슬롯별 누적횟수를 따로 저장, 무기만 많이 뽑아도 신발 뽑기레벨엔 영향 없음. 클라이언트는 `equipmentDrawProgress`(`{weapon,armor,gloves,shoes}`) 객체를 `App.jsx`가 로드해서 `Shop`이 현재 탭에 맞는 값만 골라 `EquipmentGacha`에 전달
- **뽑기 중복 시 자동 강화**: 이미 보유한 등급을 또 뽑으면 새 행이 안 생기고 `enhance_level`이 **+1씩** 오름(최대 +15) — `user_inventory`에 `unique(user_id, item_key)` 제약을 걸어서 원천적으로 중복 행이 생길 수 없게 함(014). **유료(골드 소모) 강화 시스템은 완전히 삭제됨** — `enhance_item` RPC도 EXECUTE 권한 회수로 차단
- 슬롯당 1개만 장착 가능 (DB 유니크 제약으로 강제, 기존 그대로)
- **인벤토리(`Inventory.jsx`)는 상점과 분리된 별도 탭** — 슬롯별(무기/보호구/장갑/신발)로 영역이 나뉘어 표시됨, 각 구역 내에서는 **등급 높은 순으로 정렬**됨(`rarityOrder` 내림차순). **장착 중인 장비는 금색 테두리로 하이라이트**됨(`.inventory-row--equipped`). 각 아이템마다 "장착 시" 보너스와 "보유효과" 보너스를 함께 보여줌. 강화 버튼은 없음(뽑기로만 오르므로)
- **보유효과**: 장착 여부와 상관없이 보유만 하고 있어도 항상 적용되는 상시 보너스. 장착 보너스의 15%(`POSSESSION_RATIO`)로 계산되고, 강화 수치가 오르면 이것도 같이 커짐(`getPossessionBonus`, `itemCatalog.js`). 전투 시 실제 적용 보너스 = 장착 보너스 + 보유한 전체 아이템의 보유효과 합산(`getTotalEquipmentBonus`, `inventory.js`) — `App.jsx`가 이걸로 `equipmentBonus`를 계산해서 각 전투 화면에 넘김
- 장비 보너스는 전투 시작 시 `withEquipment()`로 합산되어 임시 적용됨 (기존 로직 그대로)

### 5-6. 아이템 강화 (~~폐지됨, 014~~)

- ~~골드 소모 + 확률 기반 강화(`enhance_item`)~~ 시스템은 **완전히 삭제됨**(014). 지금은 **뽑기 중복 시 자동으로 +1씩 강화**되는 방식만 존재함 (5-5 참고, `enhance_level` **0~1000**(021에서 15→1000으로 대폭 상향), 스탯 +8%/레벨 누적 공식은 그대로 유지)
- ⚠️ **밸런스 유의**: `getEnhancedStatBonus`/`getPossessionBonus`가 `1 + enhanceLevel*0.08`이라 레벨1000이면 +8000%(81배)까지 커짐 — 사용자가 "상한선만 1000으로 올려달라"고 명시적으로 요청해서 공식 자체는 안 건드렸지만, 실제로 유저가 근접해서 게임이 깨질 정도로 느껴지면 `itemCatalog.js`의 `0.08` 계수를 낮추는 것도 고려할 것

### 5-7. 로비 채팅 (`useLobbyChat.js`)

- Supabase Realtime으로 `chat_messages` 테이블 구독, 최근 50개 로드 + 신규 메시지 실시간 반영
- 닉네임은 서버 트리거가 `profiles.nickname`으로 강제 덮어씀 (사칭 방지, migration 004)
- ⚠️ 현재 `useLobbyChat` 훅은 만들어져 있으나 **App.jsx / 어떤 화면에도 아직 연결되지 않음** (UI 미구현 상태, 다음 작업 후보)

---

## 6. DB 스키마 (Supabase) — migration 순서대로

**001_init.sql**
- `profiles` (id, nickname unique, level, exp, gold, stamina, ...) — auth.users 트리거로 자동 생성
- `monster_species` (도감 마스터 데이터, 9종 스타터+진화 + 보스 1종 시드)
- `owned_monsters` (유저 보유 몬스터: level, exp, hp, atk, def, species_id, is_active)
- `stage_progress` (user_id, stage_id, cleared, cleared_at) — PK(user_id, stage_id)
- `chat_messages` (로비 채팅)
- RLS 전체 활성화, `is_nickname_taken` RPC

**002**: 회원가입 트리거 기본 닉네임이 형식 제약 위반하던 버그 수정 + `owned_monsters` 유저당 활성몬스터 1개 유니크 제약

**003**: `user_inventory` 테이블 신설 + `add_gold`/`spend_gold` RPC (원자적 골드 증감)

**004_security_patch.sql** ⚠️ **가장 중요, 필수 적용**
- `profiles.gold` 등 민감 컬럼 client 직접 UPDATE 차단 (컬럼 단위 GRANT/REVOKE)
- `owned_monsters` INSERT/UPDATE 전면 차단 → `create_starter_monster()`, `save_monster_growth()` RPC로만 변경 가능 (레벨 변화량 상한 50, 스탯 상한선 공식 검증, 진화 경로 검증)
- `stage_progress` INSERT/UPDATE 차단 → `clear_stage()` RPC (실제로 열린 스테이지인지 서버 재검증)
- `user_inventory` INSERT 차단, UPDATE는 `equipped` 컬럼만 허용 → `buy_item()` RPC + `item_catalog` 테이블(서버측 가격 진실공급원) 신설
- `chat_messages` insert 트리거로 닉네임 사칭 방지
- `add_gold`에 1회 최대 20000 상한 추가

**005_item_enhancement.sql**
- `user_inventory.enhance_level` 컬럼 추가 (0~15)
- `item_catalog.rarity_order` 컬럼 추가
- `enhance_item()` RPC (서버에서 확률 판정, 골드 차감)

**006_mypage_and_skill_gacha.sql**
- `profiles`에 `nickname_edited`(닉네임 1회수정 플래그), `equipped_skills`(text[]), `total_skill_draws` 컬럼 추가
- `profiles.nickname` 직접 UPDATE 권한 완전 회수 → `update_nickname()` RPC로만 변경 가능(평생 1회)
- `handle_new_user` 트리거가 `raw_user_meta_data.nickname`(회원가입 시 전달)을 읽어 최초 닉네임으로 반영
- `skill_catalog` 테이블 신설(15개 스킬 시드) + `user_skills` 테이블 신설(중복 시 skill_level만 상승)
- `draw_skill()`, `set_skill_loadout()` RPC 신설
- `create_starter_monster()`가 기본 스킬(`basic_strike`) 자동 지급+장착하도록 갱신

**007_fix_ambiguous_column_and_batch_draw.sql**
- `draw_skill()`의 "column reference skill_key is ambiguous" 버그 수정 (RETURNS TABLE 출력 컬럼명과 테이블 컬럼명 충돌 → 테이블 별칭으로 해결)
- `draw_skill_batch(p_count)` RPC 신설 (1/10/100연차 뽑기, 골드 부족 시 그 시점까지 부분 성공)
- `add_gold` 1회 상한 20000 → 100000으로 상향 (골드 보상 5배 인상 반영)

**008_dungeon_mail_coupon.sql**
- `dungeon_attempts` 테이블 + `use_dungeon_attempt()` RPC (일일 던전 하루 3회 제한, 서울시간 기준)
- `mails` 테이블 + `sync_daily_mails()`(정기 골드우편 지연생성) + `claim_mail()` RPC
- `coupons`, `coupon_redemptions` 테이블 + `redeem_coupon()` RPC, 테스트용 예시 쿠폰 `WELCOME2026` 시드

**009_security_audit_patch.sql** ⚠️ **가장 중요, 필수 적용 (골드 무한증식 취약점 패치)**
- `add_gold`/`spend_gold` EXECUTE 권한을 `authenticated`에서 회수 (client 직접 호출 완전 차단)
- `calc_stage_gold`, `calc_idle_gold`, `calc_dungeon_gold` SQL 함수 신설 (stages.js/dungeonStages.js 공식 그대로 이식)
- `clear_stage`가 골드 지급까지 함께 처리하도록 변경 (반환값 = 지급액)
- `grant_idle_reward` RPC 신설 (자동사냥 전용, 유저당 최소 2.5초 간격 제한 포함)
- `dungeon_sessions` 테이블 신설, `use_dungeon_attempt`가 세션 생성 + `claim_dungeon_reward`가 세션당 1회만 보상 지급
- `use_dungeon_attempt`, `update_nickname`의 레이스컨디션(동시요청으로 제한 우회) 수정
- `mails`/`dungeon_attempts`/`dungeon_sessions`/`coupons`/`coupon_redemptions`/`skill_catalog`/`item_catalog`/`monster_species`에 명시적 client 쓰기권한 회수 추가

**010_sequential_dungeon_job_dungeon.sql**
- `dungeon_progress` 테이블 신설 - 던전이 자유선택형에서 **순차 진행형**으로 변경(1층부터, 깨야 다음층). `use_dungeon_attempt`가 파라미터에서 층 선택을 없애고 서버가 진행도로 직접 결정
- `owned_monsters.unlocked_job_tier` 컬럼 추가 - 전직이 레벨 자동적용에서 **전직 던전 클리어 필요**로 변경
- `job_dungeon_sessions` 테이블 + `start_job_dungeon()`/`claim_job_dungeon()` RPC (레벨조건 + 순차진행 서버검증)

**011_gacha_level_job_boost_chapter_difficulty.sql**
- `draw_skill`/`draw_skill_batch`의 뽑기레벨 산정 기준을 5회→1000회당 1레벨로 변경
- `save_monster_growth`의 스탯 상한선을 전직 최대배율 상향(1.9→6.0)에 맞춰 재조정
- `calc_stage_gold`에 챕터(10스테이지) 단위 계단식 난이도(`chapterStep`) 반영

**012_difficulty_and_idle_reward_sync.sql**
- `calc_stage_gold`/`calc_idle_gold`/`calc_dungeon_gold`를 클라이언트의 난이도 재상향/자동사냥 보상강화 공식과 동기화
- `add_gold` 1회 상한 100000 → 400000으로 재상향 (최후반 챕터 보스 골드가 기존 상한을 넘어서게 됨)

**013_equipment_gacha.sql**
- `profiles.total_equipment_draws` 컬럼 추가
- `draw_equipment()`/`draw_equipment_batch()` RPC 신설 - 스킬뽑기와 동일한 뽑기레벨/확률 구조로 슬롯+등급을 서버가 결정해서 지급 (item_key/slot을 client가 지정할 수 없어 조작 불가)

**014_shop_gacha_only.sql**
- `user_inventory` 중복 행 정리 후 `unique(user_id, item_key)` 제약 추가 (뽑기 중복 = 새 행이 아니라 자동 강화로 병합되는 구조로 전환)
- `buy_item`/`enhance_item` EXECUTE 권한 회수 (직접구매/유료강화 완전 폐지)
- `draw_equipment`/`draw_equipment_batch`를 슬롯 고정(`p_slot`) 방식으로 재작성 - 랜덤슬롯 대신 무기/방어구/장갑/신발 각각 독립된 뽑기, 중복 시 `enhance_level` +1(최대 15)

**015_dungeon_reset_time_and_skill_cost.sql**
- `use_dungeon_attempt`의 "하루" 기준을 자정→오전 8시(서울)로 변경 (`(서울시간 - 8시간)::date`로 일자 산정)
- `draw_skill`/`draw_skill_batch`의 비용을 뽑기레벨 연동 공식에서 **1회당 정가 300골드 고정**으로 변경

**016_dungeon_error_message.sql**
- `use_dungeon_attempt`의 입장권 소진 오류 메시지를 클라이언트 토스트 문구("오늘 하루 입장권을 모두 소진하셨습니다.")와 동일하게 통일

**017_mail_window_slot_gacha_skill_expansion.sql**
- `sync_daily_mails`를 "그 시각이 지나면 언제든 지급" → "정각~1시간 이내에만 지급"(`v_hour = v_slot.h`)으로 변경
- `equipment_gacha_progress` 테이블 신설 - 장비 뽑기레벨을 슬롯별로 완전히 독립 분리(기존 `profiles.total_equipment_draws` 단일 카운터 폐기, `draw_equipment`/`draw_equipment_batch`가 이 테이블 기준으로 재작성됨)
- `skill_catalog`에 `duration_ms`/`ticks`/`tick_interval_ms` 컬럼 추가, `type` 체크 제약에 `stun`/`dot`/`buff_atk`/`buff_def`/`haste` 추가
- 스킬 35종 신규 추가(등급당 3→10종, 총 50종) - 기존 15종 키는 그대로 유지(유저 보유 데이터 호환)

**018_fix_equipment_slot_ambiguous.sql / 019_fix_equipment_conflict_target_ambiguous.sql**
- `draw_equipment`/`draw_equipment_batch`의 "column reference slot is ambiguous" 버그를 두 단계에 걸쳐 완전히 수정 — 018에서 `UPDATE ... WHERE slot = ...`에 테이블 별칭 추가, 019에서 `INSERT ... ON CONFLICT (user_id, slot)`의 대상 컬럼 목록까지 `ON CONFLICT ON CONSTRAINT equipment_gacha_progress_pkey`로 바꿔서 "slot"이라는 이름이 아예 등장하지 않게 함. **RETURNS TABLE에 어떤 컬럼명을 쓰든, 그 이름을 함수 본문의 UPDATE/INSERT-ON CONFLICT 어디서든 별칭 없이 bare로 쓰면 이 버그가 재발할 수 있음 — 새 RPC 짤 때마다 유의**

**020_guide_missions.sql**
- `mission_state` 테이블 + `init_mission_state()`/`increment_mission_progress()`/`claim_mission_reward()` RPC 신설 (가이드 미션 시스템, 5-13 참고)
- `mails`에 "본인 소유 + claimed=true" 조건의 DELETE 정책 추가 (수령 완료한 우편 직접 삭제 가능)

**021_login_mission_enhance_cap_job_tier4.sql**
- "10분 접속 유지" 미션을 "1분 접속 유지"로 변경 (기존 진행중인 유저 행도 소급 수정 + `claim_mission_reward`의 향후 배정값도 변경)
- 장비 강화 최대치 15 → 1000으로 상향 (`user_inventory.enhance_level` 체크 제약, `draw_equipment`/`draw_equipment_batch`의 `least(15,...)` → `least(1000,...)`)
- **4차 전직(Lv.140) 추가** — `owned_monsters.unlocked_job_tier` 체크 제약 0~3→0~4, `job_dungeon_sessions.tier` 체크 제약에 4 추가, `save_monster_growth` 스탯 상한선 6.0→10.0배로 재조정, `start_job_dungeon`에 4차 레벨조건(140) 추가, `claim_mission_reward`의 온보딩 우선순위 체인에 `job_tier4` 추가

**022_security_mission_claim_cooldown.sql** ⚠️ **보안 패치, 필수 적용**
- `claim_mission_reward`에 "미션 배정 후 최소 20초 경과" 게이트 추가 — 이전엔 진행도 조작+즉시클레임 반복으로 무한 골드 파밍이 가능했음 (5-13 참고)

### 클라이언트 쓰기 권한 요약 (009 보안패치 이후 기준)

| 테이블/기능 | client 직접 write 가능? | 실제 변경 경로 |
|---|---|---|
| `profiles.gold` | ❌ | 각 액션 전용 RPC가 내부적으로만 `add_gold` 호출 (client는 `add_gold`/`spend_gold`를 직접 호출 불가, EXECUTE 권한 회수됨) |
| `profiles.nickname` | ❌ | `update_nickname` RPC (1회 제한, 레이스컨디션 수정됨) |
| `owned_monsters` | ❌ | `create_starter_monster`, `save_monster_growth` RPC |
| `stage_progress` | ❌ | `clear_stage` RPC (스테이지 클리어 + 골드 지급을 함께 원자적으로 처리) |
| `user_inventory` | equipped 컬럼만 | 생성 및 중복시 강화는 `draw_equipment`/`draw_equipment_batch` RPC (`buy_item`/`enhance_item`은 014에서 EXECUTE 권한 회수로 폐지) |
| `user_skills` | ❌ | `draw_skill`/`draw_skill_batch` RPC |
| `dungeon_attempts` | ❌ | `use_dungeon_attempt` RPC (원자적 증가로 레이스컨디션 수정됨) |
| `dungeon_sessions` | ❌ | 입장 시 `use_dungeon_attempt`가 생성, 보상은 `claim_dungeon_reward`가 세션당 1회만 지급 |
| `mails` | ❌ (delete만 본인 claimed건 가능) | `sync_daily_mails`(정기우편 생성), `claim_mail`(수령), `redeem_coupon`(쿠폰보상 발송), 직접 `DELETE`는 본인 소유+claimed=true 조건에서만 허용(020) |
| `mission_state` | ❌ | `init_mission_state`/`increment_mission_progress`/`claim_mission_reward` RPC |
| `coupons`/`coupon_redemptions` | ❌ | `redeem_coupon` RPC |
| `equipment_gacha_progress` | ❌ | `draw_equipment`/`draw_equipment_batch` RPC 내부에서만 증가 |

### 009 보안 감사에서 발견/수정한 것

1. **[치명] `add_gold` 직접 호출 가능 → 무제한 골드 획득** — `add_gold(target_user, amount)`가 신원 확인(`auth.uid()=target_user`)과 1회 상한만 검사하고, "이게 실제로 정당한 보상인지"는 전혀 검증하지 않았음. 브라우저 콘솔에서 `supabase.rpc('add_gold', {target_user: 내id, amount: 100000})`을 반복 호출하면 사실상 무한 골드 획득이 가능했음.
   → **수정**: `add_gold`/`spend_gold`의 EXECUTE 권한을 `authenticated`에서 회수해서 client가 직접 호출 자체를 못 하게 잠금. 대신 스테이지클리어/자동사냥/던전 각각의 골드 보상 공식(`calc_stage_gold`, `calc_idle_gold`, `calc_dungeon_gold`)을 SQL로 그대로 옮겨서, 각 전용 RPC가 "무슨 행동을 했는지"에 맞는 금액을 서버가 직접 계산해서 지급하도록 변경. client가 보내는 골드 숫자는 이제 어디서도 신뢰하지 않음.
2. **[중] 자동사냥 골드에 요청 속도 제한 없음** — 자동사냥은 3초마다 반복 호출되는 구조라, 스크립트로 그 텀보다 빠르게 반복 호출하면 실질적으로 무제한 파밍이 가능했음.
   → **수정**: `grant_idle_reward`에 유저별 최소 2.5초 간격 제한을 서버에 추가.
3. **[중] 던전 보상이 "입장했다는 사실"과 분리되어 있었음** — 던전은 입장만 하루 3회로 막혀있었을 뿐, 승리 보상(`addGold` 직접 호출)은 던전에 실제로 들어갔는지와 무관하게 호출 가능했음.
   → **수정**: `dungeon_sessions` 테이블을 신설해서 "입장 → 그 세션 하나당 보상 1회만 수령" 구조로 변경. `claim_dungeon_reward`는 존재하는 세션, 내 것, 아직 안 받은 것일 때만 지급.
4. **[경] 레이스컨디션 2건** — `use_dungeon_attempt`(하루 3회 체크)와 `update_nickname`(1회 수정 체크)가 "읽고 → 조건 확인 → 쓰기" 순서라서, 동시에 여러 번 요청을 날리면 그 사이 틈으로 제한을 넘길 수 있었음 (예: 던전 4회 이상 입장, 닉네임 2번 이상 변경).
   → **수정**: 둘 다 조건을 WHERE절에 포함한 단일 원자적 UPDATE로 재작성해서 동시요청에도 제한이 정확히 지켜지도록 수정.
5. **[경] 명시적 권한 회수 누락** — `mails`, `dungeon_attempts`, `coupons` 등 최근 추가한 테이블들에 RLS는 걸려있었지만, 이전 테이블들처럼 명시적 `revoke insert/update/delete`는 빠져있었음 (RLS만으로도 현재는 막혀있었지만, 이중 방어 차원에서 다른 테이블들과 동일하게 명시적으로 회수함).

### 알려진 한계 (완벽한 서버 권위 구조는 아님)

- 전투 데미지 계산/스킬 배율/장비 보너스 적용은 **클라이언트(브라우저)에서 계산**됨. 서버는 "최종 결과값(레벨/스탯/골드)"이 물리적으로 가능한 범위 안에 있는지만 사후 검증함 (상한선 방식). 즉 "있을 수 없는 큰 값"은 막지만, 그럴듯한 범위 내의 정교한 조작까지 100% 차단하진 못함.
- 완전한 서버 권위 구조로 가려면 전투 판정 자체를 서버(Edge Function 등)에서 수행해야 함 — 현재는 프로토타입 단계로 판단해 이 정도 수준에서 타협함.
- **정기 우편은 실제 cron이 아니라 "지연 생성" 방식**임 — 08/12/19시가 지난 뒤 유저가 우편함에 들어와야(`sync_daily_mails` 호출) 그 시점에 우편이 생성됨. 정각에 알림이 오거나 하는 건 아니고, 다음에 접속했을 때 이미 도착해 있는 형태. pg_cron으로 실제 예약 발송을 구현할 수도 있으나(Supabase 플랜에 따라 지원 여부 다름) 지금은 더 안정적인 지연생성 방식으로 구현함.

---

### 5-7. 마이페이지 (`MyPage.jsx`)

- 헤더의 "👤 마이페이지" 버튼(로그아웃 왼쪽)으로 진입. 하단 게임 탭에는 없음.
- 내 정보 확인: 닉네임, 이메일, 가입일, 보유 골드, 대표 몬스터 요약, 클리어 스테이지 수
- **닉네임 변경은 평생 1회만** 허용 — `profiles.nickname_edited` 플래그로 서버(RPC `update_nickname`)가 강제. 중복확인은 기존 `is_nickname_taken` RPC 재사용.
- 회원가입 시 선택한 닉네임은 `signUp()`이 `options.data.nickname`으로 넘기고, `handle_new_user` 트리거가 그 값을 그대로 반영 (이건 "1회 수정"에 포함되지 않는 최초 설정)

### 5-8. 스킬 뽑기 시스템 (`SkillGacha.jsx`, `skillCatalog.js`, `skillGacha.js`)

- 15개 스킬(5등급 × 3개, 노멀\<레어\<에픽\<전설\<신화), 등급별 배율/회복비율은 `skillCatalog.js`의 `SKILL_CATALOG` (서버 `skill_catalog` 테이블과 값 동일하게 유지해야 함)
- **뽑기 레벨**: `1 + floor(누적뽑기횟수/1000)`, 최대 20 (1000회당 1레벨, 011에서 5회→1000회로 변경). 레벨 구간별로 고등급 확률이 계단식으로 상승 (RPC `draw_skill` 내부 CASE문 참고)
- **중복 뽑기 시 새 스킬 대신 기존 스킬의 `skill_level`이 +3 상승** (최대 100) — `user_skills` 테이블은 `unique(user_id, skill_key)` 제약으로 중복 row 자체가 안 생김
- **스킬레벨 성장식**: `실효값 = base × (1 + (level-1)×0.003)` — 레벨100 최대 성장폭이 약 ×1.3에 불과해서, 등급 간 base가 ×1.4씩 벌어진 설계상 **아무리 강화해도 다음 등급의 1레벨 기본값을 못 넘음** (요건 그대로 구현)
- **스킬 편성**: 장착 슬롯 수는 활성 몬스터 레벨에 따라 1→5개로 증가 (`getSkillSlotCount`: Lv10/25/50/75가 기준점). `profiles.equipped_skills`(text[])에 저장, RPC `set_skill_loadout`이 슬롯수/보유여부/중복을 서버에서 재검증
- 뽑기 비용은 **1회당 정가 💰300** (015에서 레벨연동 공식→고정가로 변경, 뽑기레벨은 등급 확률에만 영향), 신규 유저는 스타터 생성 시 `basic_strike` 1개를 무료로 자동 지급+장착받음 (`create_starter_monster` RPC)
- **1/10/100연차 뽑기** 지원 (`draw_skill_batch` RPC) — 골드 부족하면 그 시점까지만 뽑고 부분 성공 반환
- `BattleScreen`은 이제 고정 스킬(`skills.js`의 SKILLS) 대신 **App.jsx가 계산해서 넘겨주는 `equippedSkills` prop**을 사용함. 장착 스킬이 0개인 예외 상황(마이그레이션 이전 계정 등)엔 `skills.js`의 첫 스킬로 안전 폴백함. 전직(Lv.30/60/100) 스킬은 기존처럼 이 목록에 추가로 붙음(`jobAdvancement.js`의 `getAvailableSkills`)

### 5-9. 일일 던전 (`DungeonSelect.jsx`, `DungeonBattle.jsx`, `dungeonStages.js`, `dungeon.js`)

- **경험치 던전**, **골드 던전** 두 종류, 각각 **하루 3회**만 입장 가능(서울시간 **오전 8시** 기준 초기화 - 015에서 자정→8시로 변경, `dungeon_attempts` 테이블 + `use_dungeon_attempt` RPC가 서버에서 검증)
- **순차 진행형**: 1층부터 시작, 깨야 다음 층으로 이동. 실패하면 그 층에 그대로 머무름(계속 재도전 가능, 하루 3회 한도 내에서). `dungeon_progress` 테이블(유저별 `cleared_stage`)로 진행도 추적, `use_dungeon_attempt`가 진행도 기준으로 **몇 층인지 서버가 직접 결정**(클라이언트가 층을 선택하지 않음). 10층까지 다 깨면 10층을 반복 도전 가능
- 각 던전 10층 구성, 층마다 고정 보스(`dungeonStages.js`의 `dungeonBoss(stage)`) — `hp = round(200 + stage^1.6*150)`, `atk = round(18 + stage^1.5*10)`로 스테이지 진행 몬스터보다 훨씬 강하게 잡음
- 경험치 던전은 EXP 위주(`hp*3.2`) + 골드 소량(`hp*0.6`), 골드 던전은 반대(`hp*3.2` 골드 / `hp*0.6` EXP)
- 전투는 `DungeonBattle.jsx`가 담당 — `BattleScreen`의 챌린지 모드만 떼어낸 단순화 버전(자동사냥 없음), 승리 시 `activeMonster`와 동일한 성장 저장 경로(`persistMonsterGrowth`) 사용. 골드는 `use_dungeon_attempt`가 발급한 `dungeon_sessions` 세션 id로 `claim_dungeon_reward`를 호출해 받음(세션당 1회, 009 보안패치). 클리어 시 `dungeon_progress.cleared_stage`도 같은 RPC가 함께 갱신
- 입장은 전투 시작 "전에" 소모됨(패배해도 복구 안 됨) — 실제 게임에서 흔한 방식
- 던전 탭 안의 서브탭(경험치/골드/전직) 선택 상태는 `App.jsx`의 `dungeonActiveType`으로 끌어올려져 있음 — 전투 후 목록으로 돌아와도 마지막에 보던 서브탭이 유지됨(예전엔 `DungeonSelect` 내부 state라 전투 화면으로 전환될 때마다 컴포넌트가 새로 마운트되면서 초기화되던 버그가 있었음)

### 5-9-1. 전직 던전 (`JobDungeonBattle.jsx`, `jobDungeon.js`, `jobDungeonApi.js`)

- 전직(Lv.30/60/100/**140**)은 이제 **레벨업만으로 자동 적용되지 않음**. 레벨 조건을 채우면 상단에 "✨ 전직 가능!" 배너가 뜨고(`hasPendingJobAdvancement`), **전직 던전을 클리어해야** 실제로 스탯 배율/전용 스킬/외형이 적용됨
- `owned_monsters.unlocked_job_tier`(0~4, 021에서 3→4로 확장)가 "실제 적용된" 전직 단계의 단일 진실 공급원. `jobAdvancement.js`가 "조건 충족(레벨 기준, `getEligibleTierNumber`)"과 "실제 적용(unlocked_job_tier 기준, `getAppliedTier`)"을 분리해서 관리함
- 전직 던전은 순차적으로만 진행 가능(전 단계 안 깨면 다음 단계 도전 불가, `start_job_dungeon` RPC가 레벨+이전단계 완료 여부 검증), 하루 횟수 제한은 없음
- **난이도**: 같은 레벨대 일반 던전보다 훨씬 강하게 잡음 (예: 1차 Lv.30 기준 보스 체력 2600/공격력 130, 공격 텀 1.6초로 빠름) — 기본공격만 연타해서는 못 이기고 스킬 로테이션(특히 회복기)이 필요하도록 설계. **4차(Lv.140, `JOB_DUNGEON_BOSS[4]`) 보스는 체력 28000/공격력 780/방어력 840**으로 3차 대비 대폭 강화됨
- 승리하면 경험치는 얻지만, **전직 자체(외형/스탯/스킬 적용)는 별도로 `claim_job_dungeon` RPC를 호출**해야 반영됨(`job_dungeon_sessions`로 "진짜 입장→클리어"를 서버가 검증, 세션 위조 불가)
- **외형 변경**: 전직에 성공하면 `MonsterSprite`가 진화단계 그림 대신 전직 전용 그림으로 바뀜. `getDisplaySpriteKey(speciesId, element, unlockedJobTier)`가 `unlockedJobTier>0`이면 `${element}_job${tier}` 키를 반환하고, `JobTierSprite.jsx`(공용 렌더러, 오라/날개/왕관이 단계별로 화려해짐)가 이제 12개 조합(3속성×4단계)을 커버함 — 4차는 별도 아트 없이 기존 컴포넌트가 `tier=4`를 받으면 오라가 더 커지고 3차와 동일한 왕관/할로 장식이 유지되는 방식으로 자동 확장됨

### 5-10. 설정 > 우편함 (`Settings.jsx`, `Mailbox.jsx`, `mail.js`)

- 헤더의 "⚙️ 설정" 버튼으로 진입, 내부에 우편함/쿠폰입력 서브탭
- 스토리 관련 팝업(`StoryIntro`, `ChapterStory`)은 `.center-viewport` 래퍼로 화면 중앙에 표시됨(로그인 화면과 동일한 유틸 클래스)
- **정기 골드우편**: 매일 08:00 / 12:00 / 19:00 (서울시간) 기준으로 각 10만 골드. **017부터 그 정각~1시간 이내에 접속해야만 지급됨**(놓치면 그 회차는 영구 소멸, 소급 지급 없음)
- cron 없이 **지연 생성(lazy) 방식**으로 구현함 — `sync_daily_mails()` RPC를 우편함 진입 시 호출하면, "지금이 정확히 그 시각의 시(hour) 안"일 때만 생성됨(`v_hour = v_slot.h`, 017에서 `>=`→`=`로 변경). `source_key`(예: `daily_gold_2026-07-15_08`)에 유니크 제약을 걸어 같은 시간대 중복 생성을 원천 차단
- 우편 수령은 `claim_mail` RPC가 골드 지급 + (있다면) 아이템을 `user_inventory`에 원자적으로 넣어줌
- **수령 완료한 우편은 삭제 가능** — `mails` 테이블에 "본인 소유 + `claimed=true`" 조건의 DELETE 정책 추가(RPC 없이 직접 삭제, 삭제는 아무것도 얻을 게 없는 행동이라 보안상 문제 없음). `Mailbox.jsx`의 "수령 완료" 목록에 🗑️ 삭제 버튼

### 5-13. 가이드 미션 (`missions.js`, `MissionFloatingButton.jsx`, 020)

- 화면 우하단(모바일은 하단 폭 전체)에 **항상 떠있는 플로팅 버튼**. 현재 "미션 #N", 아이콘, 라벨, 진행도(`N/M`)를 표시하고 진행바가 채워짐
- **완료되면 초록 테두리 + 살짝 커졌다작아지는 펄스 애니메이션**으로 하이라이트되고, 클릭하면 `claim_mission_reward` RPC 호출 → 골드 지급 + 다음 미션으로 자동 전환
- **일반 반복 미션 4종**이 `mission_number % 4`로 순환: `kill_monsters`(몬스터 10마리, 💰800) → `spend_gold`(골드 10000 사용, 💰1000) → `login_minutes`(**1분** 접속유지, 💰600, 021에서 10분→1분으로 변경) → `use_skills`(스킬 15회 사용, 💰700) → 다시 처음부터
- **우선순위 온보딩 미션**이 항상 먼저 끼어듦(`claim_mission_reward`가 다음 미션을 정할 때마다 재검사): 활성 몬스터가 전직 가능 레벨(30/60/100/**140**)인데 아직 그 단계로 전직을 안 했으면 `job_tier1`~`job_tier4` 미션(보상 3000~**24000**)이 최우선으로 배정되고, 전직 조건이 없으면 스킬 슬롯이 새로 열렸는데 덜 채워져 있는지(`equip_skill_slot`, 보상 1000) 확인 — 둘 다 아니면 그제서야 일반 미션으로 넘어감. 이 온보딩 미션들은 클라이언트가 보낸 진행도를 안 믿고, **완료 판정 시 서버가 `owned_monsters.unlocked_job_tier`/`profiles.equipped_skills`를 직접 재조회해서 검증**함(진행도 카운터 우회 불가)
- **진행도 갱신 방식**: `bumpMission(missionKey, amount)`가 서버 RPC(`increment_mission_progress`)를 호출 — 현재 활성 미션 키와 일치할 때만 반영되고, 1회 증가폭은 서버에서 최대 1000으로 캡 걸려있음(남용 방지). 호출 지점: 몬스터 처치(스테이지클리어/자동사냥/일반던전/전직던전 승리 4곳, `App.jsx`), 스킬 사용(3개 전투화면 `useSkill` 공통), 골드 소비(스킬뽑기/장비뽑기 성공 시 소비액만큼)
- **여러 화면에서 진행도를 올려도 플로팅 버튼이 즉시 갱신**되도록 `missions.js`에 `toast.js`와 동일한 pub-sub 버스(`subscribeMissionUpdate`)를 두고, `App.jsx`가 구독해서 자기 `mission` state를 갱신함
- "N분 접속 유지" 미션은 `App.jsx`의 1분 간격 타이머가 현재 활성 미션이 `login_minutes`일 때만 증가시킴
- 클라이언트가 진행도를 부풀려 보낼 수는 있지만(예: `bumpMission('spend_gold', 1000)`을 반복 호출), 어차피 미션 보상 자체가 소액(600~1200골드 수준, 온보딩 미션만 예외적으로 큼)이라 리스크 대비 실효성이 낮고, 온보딩 미션(가장 보상이 큰 것들)은 앞서 설명대로 서버가 실제 게임 상태로 재검증하므로 조작 불가능함
- ⚠️ **보안 패치(022)**: 처음엔 진행도 채우기+클레임 사이에 아무 시간제한이 없어서, devtools로 `bumpMission`→`claimMissionReward`를 빠르게 반복 호출하면 실제 플레이 없이 무한히 골드를 받아갈 수 있는 구멍이 있었음. `claim_mission_reward`에 **"미션이 배정된 시각(`updated_at`)으로부터 최소 20초"** 게이트를 추가해서 막음(idle 보상의 2.5초 최소 간격 제한과 동일한 설계). 진행도 자체를 빨리 채우는 건 여전히 가능하지만, 클레임 자체가 20초에 1번으로 막혀서 실질적 파밍 속도가 크게 제한됨
- **모바일 레이아웃 겹침 주의**: 플로팅 버튼이 `position:fixed`라서 콘텐츠 하단(특히 전투화면 스킬버튼 줄)을 가릴 수 있음 — `app-main`의 하단 padding을 데스크톱 110px/모바일 150px로 넉넉하게 잡아서 방지함(`index.css`). 하단에 새 UI를 추가할 때도 이 여백 고려할 것

### 5-14. 설정 > 쿠폰 입력 (`CouponRedeem.jsx`, `coupon.js`)

- `coupons` 테이블에 쿠폰코드/골드량/아이템/최대사용횟수/만료일을 직접 INSERT해서 발행 (관리용 UI는 없음, SQL로 직접 발행)
- `redeem_coupon(code)` RPC — 만료/횟수소진/중복사용(유저당 1회, `coupon_redemptions` 유니크 제약) 검증 후, 보상을 **우편함으로** 지급(바로 지급 아님, 우편함에서 수령해야 함)
- 테스트용 예시 쿠폰 `WELCOME2026`(골드 5000 + 레어 무기) 하나가 시드로 들어가 있음

### 5-15. 토스트 알림 (`toast.js`, `ToastContainer.jsx`)

- 간단한 pub-sub 이벤트버스(`showToast(message, type)`) + `App.jsx` 최상단에 마운트된 `ToastContainer`가 구독해서 화면 상단 중앙에 표시(3.2초 후 자동 소멸)
- 골드 부족 에러가 발생하는 모든 지점(`inventory.js`의 `buyItem`, `enhance.js`의 `enhanceItem`, `skillGacha.js`의 `drawSkill`/`drawSkillBatch`)에서 공통으로 토스트를 띄우도록 처리됨 — 새로운 골드 소비 기능을 추가할 때도 동일 패턴(에러 메시지에 '골드' 포함되면 `showToast(..., 'error')` 호출) 유지할 것
- ⚠️ **버튼 disabled 함정 주의**: 구매/강화/뽑기/던전입장 버튼을 "실행 불가 시 `disabled`"로 막아버리면 클릭 자체가 안 돼서 에러가 발생할 기회가 없어지고, 결과적으로 토스트도 못 뜸(실제로 이 버그가 있었음, 수정됨). 골드 소비 버튼과 던전 입장 버튼 전부 **클릭은 항상 가능하게 두고**, 핸들러 진입 시점에 조건(골드 부족/입장권 소진/레벨 부족/이전단계 미완료 등) 체크해서 `showToast`를 직접 호출 + 조기 return하는 패턴을 씀. 버튼의 시각적 "비활성처럼 보이게"는 `disabled` 대신 `.btn-unaffordable` CSS 클래스(투명도+빨간 테두리)로만 처리. 서버 RPC가 그래도 거부하는 경우(레이스컨디션 등 예외적 상황)를 대비해 `App.jsx`의 각 핸들러도 catch에서 동일하게 `showToast` 호출함(이중 방어)

### 5-16. 키보드 단축키

각 화면 컴포넌트가 자기 스코프 안에서만 `window.addEventListener('keydown', ...)`를 등록/해제하는 방식(마운트된 화면에서만 동작, 전역 단일 핸들러 아님). 입력창(`INPUT`/`TEXTAREA`)에 포커스가 있을 때는 전부 무시하도록 가드 처리됨.

| 화면 | 키 | 동작 |
|---|---|---|
| 전투(스테이지/일반던전/전직던전) | `1`~`5` | 슬롯별 스킬 즉시 사용 (버튼 모서리에 숫자 배지로 표시, `SkillButton`의 `hotkey` prop) |
| 스테이지 전투 | `Space` | 상황별: 자동사냥 중→도전 시작 / 승리→다음 스테이지로 / 패배→재도전 |
| 스테이지 전투 | `R` | 패배 시 즉시 재도전 (Space와 동일 동작, 습관적으로 R 누르는 사람 대비) |
| 일반/전직 던전 전투 | `Space` | 결과가 나온 상태에서 "던전 목록으로"(또는 전직 성공 시 "확인") |
| 상점(뽑기 5탭) | `Tab` / `Shift+Tab` | 무기→방어구→장갑→신발→스킬 순환 이동 |
| 던전 탭 | `Tab` / `Shift+Tab` | 경험치→골드→전직 던전 순환 이동 |
| 장비/스킬 뽑기 화면 | `G` / `Shift+G` / `Ctrl(⌘)+G` | 1회 / 10회 / 100회 뽑기 |
| 설정 > 우편함 | `Enter` | 미수령 우편 전체 일괄수령 (신규로 "전체 수령" 버튼도 함께 추가됨) |
| 설정 > 쿠폰 입력 | `Enter` | 입력창 포커스 상태에서 폼 제출 (원래 HTML form 기본 동작, 별도 구현 없음) |
| 마이페이지/설정 화면 | `Esc` | 전투 탭으로 복귀 (`App.jsx`의 `activeTab`을 `'battle'`로) |

`Space`/`Tab`은 브라우저 기본 동작(스크롤, 포커스 이동)과 충돌해서 각 핸들러 안에서 `e.preventDefault()` 처리함. 배틀 화면 3곳은 상태가 자주 바뀌는 특성상, 클로저 문제를 피하려고 `useRef`에 최신 상태(`mode`/`result`/`availableSkills` 등)를 매 렌더마다 담아두고 `keydown` 리스너 자체는 `useEffect(..., [])`로 1회만 등록하는 패턴을 씀 (리스너를 매 렌더 재등록하지 않기 위함).

## 7. 알려진 미구현/TODO 후보

- 로비 채팅 UI 미연결 (`useLobbyChat` 훅은 완성, 화면에 아직 안 붙임)
- 외부 이미지(실사/일러스트) 미적용 — `MonsterSprite`는 `VITE_SPRITE_CDN_URL` 세팅 시 자동으로 이미지 우선 사용하도록 이미 확장 가능 구조로 되어 있음
- 사육장(보유 몬스터 목록/도감) 화면 없음 — 현재는 활성 몬스터 1마리만 운용
- PvP, 몬스터 포획(교체) 기능 없음 (설계상 보스 처치=자동 성장 개념으로 대체됨, 애초 "포획" 요건은 스타터 선택으로 단순화됨)
- ~~2·3단계 진화 스프라이트 없음~~ → 해결됨 (9종 벡터 스프라이트 전부 완성)
- ~~마이페이지/닉네임 수정~~ → 해결됨 (닉네임 1회 수정)
- ~~스킬 커스터마이징~~ → 해결됨 (뽑기/합성/편성 시스템)

---

## 8. 로컬 개발 / 배포 참고

- `.env` 필요 (`.env.example` 참고): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Supabase 프로젝트에 `supabase/migrations/*.sql`을 **001부터 순서대로** SQL Editor에서 실행해야 함
- `npm install && npm run dev`로 로컬 확인, `npm run build`로 빌드 검증 후 커밋하는 것이 원칙
- GitHub push는 fine-grained PAT(레포 한정, Contents Read/write 권한) 사용 중

### 참고: 과거에 있었던 CSS 스크롤 버그

`html, body, #root`에 `height: 100%`(고정값)를 주면 콘텐츠가 뷰포트보다 길어질 때(예: 상점 화면) 하단이 스크롤되지 않고 잘리는 문제가 있었음. `min-height: 100%`로 바꿔서 해결함 — 비슷한 "화면 하단 짤림" 이슈 재발 시 이 부분부터 의심할 것.

---

## 9. 문서 관리 원칙

- 이후 기능이 추가/수정될 때마다 **이 `info.md`도 같은 커밋에서 함께 업데이트**함 (해당 섹션만 갱신, 전체 재작성 아님)
- 새 기능 추가 시 최소한 다음을 갱신: 관련 섹션의 표/목록, "6. DB 스키마"에 새 migration 요약 한 줄, 필요 시 "7. TODO" 항목 정리
- 이 파일은 대화 히스토리가 없는 상태에서 프로젝트를 새로 파악하기 위한 **단일 진실 공급원(single source of truth)** 역할을 하는 것이 목적이므로, 실제 코드와 어긋나지 않도록 유지하는 것을 최우선으로 함
