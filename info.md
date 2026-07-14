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

- **프론트엔드**: Vite + React 18, 순수 CSS(`src/index.css`, 다크 판타지 테마, CSS 변수 기반, 반응형)
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
│  │  ├─ StageSelect.jsx           # 100챕터×10스테이지 선택 UI
│  │  ├─ Shop.jsx                  # 상점(구매) + 인벤토리(장착/강화) UI
│  │  └─ MonsterSprite.jsx         # 몬스터 이미지 렌더링 (벡터→외부이미지 자동 폴백)
│  ├─ assets/sprites/
│  │  ├─ FireStage1.jsx, WaterStage1.jsx, GrassStage1.jsx   # 스타터 1단계 SVG 벡터 일러스트
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
              GAME (메인 화면, 탭 3개: 전투/스테이지/상점)
                ↑↓
         CHAPTER_STORY (새 챕터 처음 진입 시에만 잠깐 표시)
```

- 로그인 시 `getActiveMonster()`로 활성 몬스터를 불러오고, `fetchClearedStageIds()`로 클리어 기록을 불러와 **가장 마지막으로 진행하던 스테이지(최고 클리어+1)부터 자동으로 이어서 시작**함. 이걸로 "로그인하면 저장된 지점부터 재개" 요건을 만족.
- 활성 몬스터가 없으면(최초 유저) STORY → STARTER 플로우로 진입.

---

## 5. 게임 시스템 상세

### 5-1. 캐릭터/육성 (`growth.js`, `speciesData.js`, `jobAdvancement.js`)

- 스타터 3종: `fire_1`(이모탄) / `water_1`(아쿠파피) / `grass_1`(새프링)
- 각 속성은 3단계 진화(1→2→3차)가 있음: 예) 이모탄→이모드릴→이모라돈 (Lv.15, Lv.30에서 자동 진화)
- **레벨업**: `expToNextLevel(level) = round(20 * level^1.5)`
- **스탯 성장**: `base스탯 × (1 + (level-1)*0.12) × 전직배율`
- **3차 전직 시스템** (`jobAdvancement.js`): Lv.30/60/100에서 자동 전직
  - 전직배율: 1차 1.25배 / 2차 1.55배 / 3차 1.9배 (스탯에 곱연산 적용)
  - 전직할 때마다 **전용 스킬 1개씩 추가 습득** (전직 스킬 3개는 계속 누적, 기본 5스킬과 별개로 유지)
- **진화**와 **전직**은 별개 시스템: 진화=외형/도감상 종족 변경, 전직=같은 종족 내 강함 단계

### 5-2. 스킬 (`skills.js` + `jobAdvancement.js`)

기본 5종 (모든 속성 공통, multiplier는 자기 공격력 기준):
| 스킬 | 타입 | 배율/회복 | 쿨타임 |
|---|---|---|---|
| 🔥 불꽃 발톱 | damage | 1.1배 | 0.8초 |
| ☄️ 화염구 | damage | 1.7배 | 2.2초 |
| 🌋 폭염 브레스 | damage | 2.3배 | 3.6초 |
| 💥 분노의 강타 | damage | 3.0배 | 5초 |
| ✨ 재생의 불씨 | heal | 최대체력 22% | 6초 |

전직 스킬 (속성별로 다름, 전직 시 해금):
- 1차(Lv.30): 배율 3.6배, 쿨타임 6.5초
- 2차(Lv.60): 배율 4.6배, 쿨타임 8초
- 3차(Lv.100): 배율 6.2배, 쿨타임 10초

### 5-3. 스테이지 시스템 (`stages.js`, `stageStory.js`)

- **100챕터 × 10스테이지 = 1000스테이지**, `stage_id`는 1~1000 순번 (`toStageIndex(chapter, stage)`)
- 각 챕터 10번째 스테이지는 **보스** (같은 챕터 잡몹보다 체력 1.9배, 공격력 1.5배)
- 챕터별 속성은 `fire→water→grass` 3개씩 순환 배정
- 몬스터 스탯은 전체 진행도(index)에 비례해 절차적으로 스케일링 (`getStageEnemy`)
- **스토리 진행**: 새 챕터 첫 진입 시 `ChapterStory` 배너 표시(`getChapterStory`), 서브스테이지 진입마다 전투 로그에 짧은 플레이버 텍스트(`getStageFlavor`) — "몬스터 잡을 때도 스토리가 계속되게" 요건 충족
- **스테이지 잠금 해제 로직**: `stage_id===1` 이거나 이전 스테이지가 클리어됨 → 오픈. 클리어한 스테이지는 언제든 자유 재도전 가능 (`StageSelect.jsx`)

### 5-4. 전투 방식 (`BattleScreen.jsx`) — 자동사냥 vs 스테이지 도전

전투 탭은 두 가지 모드로 동작함:

1. **`idle` 모드 (기본값)**: 탭 진입 시 자동으로 시작됨. 3초(`IDLE_KILL_INTERVAL`)마다 필드 몬스터(`getIdleMonster`, 공격력 0이라 안전, 스테이지 몬스터보다 훨씬 약함)를 자동으로 처치하고 소량의 경험치/골드 획득. 사용자가 아무것도 안 눌러도 계속 진행됨.
2. **`challenge` 모드**: "⚔️ 도전하기" 버튼을 눌러야 시작. 실제 스테이지에 배정된 몬스터(`getStageEnemy`)와 진짜 전투 — HP 실시간 표시, 스킬 사용, 적 자동 반격(2.4초 텀). 승리 시 스테이지 클리어 처리 + 정식 보상, 패배 시 재도전 가능.
   - 승리 결과창에는 **"다음 스테이지로" / "스테이지 목록" / "사냥터로"** 3버튼 제공 (전투 후 방치되는 UX 문제 해결됨)

- 전투 이펙트: `<canvas>` 기반 파티클(타격 시 튀는 입자) + 화면 스크린쉐이크
- 장비 보너스(`equipmentBonus`)는 전투 중에만 스탯에 더해지고, DB에 저장되는 성장치(`grownBase`)에는 포함되지 않음 (장비를 빼도 순수 캐릭터 성장은 그대로 유지되는 구조)

### 5-5. 재화/상점/장비 (`itemCatalog.js`, `inventory.js`, `Shop.jsx`)

- 몬스터 처치(자동사냥/스테이지 클리어 모두) 시 **골드 획득**
- 4개 슬롯: 무기(`weapon`, atk) / 보호구(`armor`, def) / 장갑(`gloves`, atk 보조) / 신발(`shoes`, hp)
- 5개 등급: 노멀 < 레어 < 에픽 < 전설 < 신화 (등급 오를수록 스탯 보너스 ↑, 가격 ↑)
- 슬롯당 1개만 장착 가능 (DB 유니크 제약으로 강제)
- 장비 보너스는 전투 시작 시 `withEquipment()`로 합산되어 임시 적용됨

### 5-6. 아이템 강화 (`itemCatalog.js`의 `estimateEnhance`, `enhance.js`, migration 005)

- +0 ~ +15까지 강화 가능
- **등급별 기본 성공률**: 노멀 90% / 레어 80% / 에픽 65% / 전설 45% / 신화 25%
- 강화할 때마다 성공률에 `×0.92`씩 곱해서 계속 낮아짐 (최저 5% 보장)
- 강화 비용도 강화수치 오를수록 같이 상승
- 강화 1당 스탯 **+8% 누적** 보너스
- **실패해도 아이템은 유지됨** (파괴/하락 없음), 시도 비용만 소모
- 성공/실패 판정은 **서버(RPC `enhance_item`, `random()`)에서 처리** — 클라이언트 조작 불가

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

### 클라이언트 쓰기 권한 요약 (보안 패치 이후 기준)

| 테이블 | client 직접 write 가능? | 실제 변경 경로 |
|---|---|---|
| `profiles` | nickname만 | gold는 `add_gold`/`spend_gold`/`buy_item`/`enhance_item` RPC |
| `owned_monsters` | ❌ | `create_starter_monster`, `save_monster_growth` RPC |
| `stage_progress` | ❌ | `clear_stage` RPC |
| `user_inventory` | equipped 컬럼만 | 생성은 `buy_item`, 강화는 `enhance_item` RPC |
| `chat_messages` | insert 가능(닉네임은 트리거가 덮어씀) | - |

### 알려진 한계 (완벽한 서버 권위 구조는 아님)

- 전투 데미지 계산/스킬 배율/장비 보너스 적용은 **클라이언트(브라우저)에서 계산**됨. 서버는 "최종 결과값(레벨/스탯/골드)"이 물리적으로 가능한 범위 안에 있는지만 사후 검증함 (상한선 방식). 즉 "있을 수 없는 큰 값"은 막지만, 그럴듯한 범위 내의 정교한 조작까지 100% 차단하진 못함.
- 완전한 서버 권위 구조로 가려면 전투 판정 자체를 서버(Edge Function 등)에서 수행해야 함 — 현재는 프로토타입 단계로 판단해 이 정도 수준에서 타협함.

---

## 7. 알려진 미구현/TODO 후보

- 로비 채팅 UI 미연결 (`useLobbyChat` 훅은 완성, 화면에 아직 안 붙임)
- 2차/3차 진화 몬스터의 SVG 벡터 스프라이트 없음 (스타터 1단계만 있음, 진화 시 `MonsterSprite`가 자동으로 "?" 플레이스홀더로 폴백됨 — 깨지진 않지만 비주얼 없음)
- 외부 이미지(실사/일러스트) 미적용 — `MonsterSprite`는 `VITE_SPRITE_CDN_URL` 세팅 시 자동으로 이미지 우선 사용하도록 이미 확장 가능 구조로 되어 있음
- 사육장(보유 몬스터 목록/도감) 화면 없음 — 현재는 활성 몬스터 1마리만 운용
- PvP, 몬스터 포획(교체) 기능 없음 (설계상 보스 처치=자동 성장 개념으로 대체됨, 애초 "포획" 요건은 스타터 선택으로 단순화됨)

---

## 8. 로컬 개발 / 배포 참고

- `.env` 필요 (`.env.example` 참고): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Supabase 프로젝트에 `supabase/migrations/*.sql`을 **001부터 순서대로** SQL Editor에서 실행해야 함
- `npm install && npm run dev`로 로컬 확인, `npm run build`로 빌드 검증 후 커밋하는 것이 원칙
- GitHub push는 fine-grained PAT(레포 한정, Contents Read/write 권한) 사용 중

---

## 9. 문서 관리 원칙

- 이후 기능이 추가/수정될 때마다 **이 `info.md`도 같은 커밋에서 함께 업데이트**함 (해당 섹션만 갱신, 전체 재작성 아님)
- 새 기능 추가 시 최소한 다음을 갱신: 관련 섹션의 표/목록, "6. DB 스키마"에 새 migration 요약 한 줄, 필요 시 "7. TODO" 항목 정리
- 이 파일은 대화 히스토리가 없는 상태에서 프로젝트를 새로 파악하기 위한 **단일 진실 공급원(single source of truth)** 역할을 하는 것이 목적이므로, 실제 코드와 어긋나지 않도록 유지하는 것을 최우선으로 함
