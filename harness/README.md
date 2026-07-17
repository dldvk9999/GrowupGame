# GrowupGame (키우기 게임) — 프로젝트 문서 (harness/)

> 이 폴더는 지금까지 구현된 모든 기능/구조/DB 스키마를 카테고리별로 나눠 기록한 문서 모음입니다.
> **대화 맥락 없이 이 폴더만 읽어도 프로젝트 전체를 파악할 수 있도록 작성되어 있습니다.**
> 기능이 추가/변경될 때마다 관련 파일이 함께 업데이트됩니다. (`dev-guide.md`의 "문서 관리 원칙" 참고)

마지막 정리: migration 054까지 반영

## 문서 목차

| 파일 | 내용 |
|---|---|
| [`character-and-growth.md`](./character-and-growth.md) | 스타터/레벨업/진화/전직(1~5차) 시스템 |
| [`skills.md`](./skills.md) | 스킬 카탈로그(50종), 스킬 타입별 전투 로직, 스킬 보유효과 |
| [`equipment.md`](./equipment.md) | 장비 뽑기(4슬롯×5등급), 강화→합성 전환, 인벤토리, 장비 보유효과 |
| [`combat.md`](./combat.md) | 전투 방식(자동사냥/스테이지도전), 데미지 공식, 방어력, 전투력 계산, 스킬 쿨타임 UI |
| [`stages-and-dungeons.md`](./stages-and-dungeons.md) | 100챕터×10스테이지, 일일 던전(경험치/골드), 전직 던전 |
| [`world-boss.md`](./world-boss.md) | 주간 공유체력 월드보스, 용의 버프 |
| [`pvp.md`](./pvp.md) | PvP 비동기 매칭전투, PvP 재화/코스튬 상점 |
| [`social-chat.md`](./social-chat.md) | 로비 실시간 채팅, 전투력 랭킹(명예의 전당) |
| [`mailbox-and-coupons.md`](./mailbox-and-coupons.md) | 정기 우편함, 쿠폰 시스템 |
| [`guide-missions.md`](./guide-missions.md) | 가이드 미션(반복형+온보딩 우선순위) |
| [`attendance-and-achievements.md`](./attendance-and-achievements.md) | 출석체크(7일 주기 보상), 업적 시스템 |
| [`account-and-settings.md`](./account-and-settings.md) | 인증(자동로그인 포함), 마이페이지, 설정 화면 |
| [`ui-and-ux.md`](./ui-and-ux.md) | 키보드 단축키, 토스트 알림, PWA, 모바일 레이아웃 주의사항 |
| [`database-schema.md`](./database-schema.md) | migration 001~029 전체 히스토리, 클라이언트 쓰기권한 요약표 |
| [`security.md`](./security.md) | 009/022/027 등 보안 감사에서 발견/수정한 취약점, 알려진 한계 |
| [`todo.md`](./todo.md) | 알려진 미구현 기능 목록 |
| [`dev-guide.md`](./dev-guide.md) | 로컬 개발/배포 방법, CI(GitHub Actions), 과거 버그 노트, 문서 관리 원칙 |

---

## 1. 게임 개요

- **장르**: 몬스터 포획 + 육성 + 방치형(자동사냥) 웹 게임
- **컨셉**: 3속성(불/물/풀) 중 하나의 스타터 몬스터를 골라 계약하고, 100개 챕터 × 10스테이지를 돌며 몬스터를 육성/전직시키고 장비를 강화해 최종 챕터까지 진행. PvP와 로비 채팅으로 다른 유저와도 상호작용.
- **플랫폼**: 웹 브라우저 (Vite + React SPA), 반응형(모바일~데스크톱), PWA로 설치 가능
- **필수 요건**: 로그인/회원가입, 닉네임 중복불가, 로그인 시 이어하기, 로비 실시간 채팅

## 2. 기술 스택

- **프론트엔드**: Vite + React 18, 순수 CSS(`src/index.css`, 다크 판타지 테마, CSS 변수 기반, 반응형), **PWA**(`vite-plugin-pwa`, `manifest.webmanifest` + 서비스워커 자동생성, 헤더의 "⬇️ 앱 다운로드" 버튼이 `beforeinstallprompt` 이벤트를 잡아서 설치 유도 - `src/lib/usePwaInstall.js`, 자세한 내용은 `ui-and-ux.md`)
- **백엔드**: Supabase (Auth + Postgres + Realtime), `@supabase/supabase-js`
- **레포**: https://github.com/dldvk9999/GrowupGame (브랜치: `master`)
- **로컬 실행**: `npm install && npm run dev` (루트에 `.env` 필요, `dev-guide.md` 참고)
- **CI**: GitHub Actions로 `supabase/migrations/**` push 시 자동 `supabase db push` (`dev-guide.md` 참고)

## 3. 파일 구조

```
GrowupGame/
├─ index.html, vite.config.js, package.json
├─ .env.example                    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SPRITE_CDN_URL
├─ .github/workflows/               # supabase-migrate.yml, supabase-repair.yml (dev-guide.md 참고)
├─ harness/                         # 이 문서 모음 (구 info.md)
├─ src/
│  ├─ main.jsx                     # index.css import + React 마운트
│  ├─ App.jsx                      # 전체 플로우 컨트롤러 (아래 4번 참고)
│  ├─ index.css                    # 전역 반응형 스타일 (다크 테마)
│  ├─ components/
│  │  ├─ AuthScreen.jsx            # 로그인/회원가입 탭, 자동로그인 체크박스, 닉네임 실시간 중복확인
│  │  ├─ StoryIntro.jsx            # 최초 진입 시 세계관 인트로 (story.js 사용)
│  │  ├─ StarterSelect.jsx         # 스타터 3종(fire_1/water_1/grass_1) 선택
│  │  ├─ ChapterStory.jsx          # 새 챕터 진입 시 스토리 배너 (stageStory.js 사용, 화면 중앙 표시)
│  │  ├─ BattleScreen.jsx          # 전투 화면 (자동사냥 + 스테이지 도전) - combat.md
│  │  ├─ DungeonSelect.jsx         # 일일/전직 던전 선택 UI - stages-and-dungeons.md
│  │  ├─ DungeonBattle.jsx         # 일일 던전 전투 화면
│  │  ├─ JobDungeonBattle.jsx      # 전직 던전 전투 화면
│  │  ├─ SkillButton.jsx           # 스킬 버튼 공용 컴포넌트 (쿨타임 링 UI, 전투화면 3곳 공유)
│  │  ├─ StageSelect.jsx           # 100챕터×10스테이지 선택 UI (챕터 카드 캐러셀)
│  │  ├─ Shop.jsx                  # 상점 - 뽑기 5탭(무기/방어구/장갑/신발/스킬) - equipment.md, skills.md
│  │  ├─ EquipmentGacha.jsx        # 슬롯 고정 장비 뽑기 화면
│  │  ├─ SkillGacha.jsx            # 스킬 뽑기 + 편성 화면
│  │  ├─ Inventory.jsx             # 인벤토리(장착/해제/합성) - equipment.md
│  │  ├─ MyPage.jsx                # 마이페이지 - account-and-settings.md
│  │  ├─ Settings.jsx              # 설정(우편함/쿠폰 서브탭) - mailbox-and-coupons.md
│  │  ├─ Mailbox.jsx               # 우편함 화면
│  │  ├─ CouponRedeem.jsx          # 쿠폰 입력 화면
│  │  ├─ MissionFloatingButton.jsx # 가이드 미션 플로팅 버튼 - guide-missions.md
│  │  ├─ PvP.jsx, PvPArena.jsx, PvPBattleScene.jsx, PvPShop.jsx  # PvP - pvp.md
│  │  ├─ WorldBossBattle.jsx       # 월드보스 전투화면(던전 탭 내부) - world-boss.md
│  │  ├─ LobbyChat.jsx             # 로비 채팅 UI - social-chat.md
│  │  ├─ ToastContainer.jsx        # 토스트 알림 - ui-and-ux.md
│  │  └─ MonsterSprite.jsx         # 몬스터 이미지 렌더링 (벡터→외부이미지 자동 폴백)
│  ├─ assets/sprites/
│  │  ├─ FireStage1~3.jsx, WaterStage1~3.jsx, GrassStage1~3.jsx  # 진화단계 SVG 벡터 일러스트(9종)
│  │  ├─ JobTierSprite.jsx         # 전직 단계 공용 렌더러 (오라/날개/왕관, tier 1~5 자동 확장)
│  │  └─ index.jsx                 # sprite_key → 컴포넌트 매핑 레지스트리 (진화9종 + 전직15종)
│  └─ lib/
│     ├─ supabaseClient.js         # Supabase 클라이언트 초기화 + 자동로그인 storage 어댑터
│     ├─ auth.js                   # 회원가입/로그인/로그아웃/닉네임 중복확인/프로필 조회
│     ├─ speciesData.js            # 9종(3속성×3진화) 클라이언트 스탯 테이블 + 진화 체인
│     ├─ speciesDbIds.js           # speciesId(문자열, 예 'fire_1') ↔ DB species_id(정수) 매핑
│     ├─ growth.js                 # 레벨업/경험치/자동진화/전직배율 계산 엔진 (핵심 로직)
│     ├─ jobAdvancement.js         # 1~5차 전직 시스템 데이터 + 헬퍼
│     ├─ jobDungeon.js, jobDungeonApi.js  # 전직 던전 보스 데이터 + RPC 연동
│     ├─ skills.js                 # 안전 폴백용 기본 스킬 5종 정의 (실제 플레이는 뽑기 스킬 사용)
│     ├─ skillCatalog.js           # 뽑기 스킬 카탈로그(50종) + 보유효과 계산
│     ├─ skillGacha.js             # 스킬 뽑기 RPC 연동
│     ├─ stages.js                 # 100챕터×10스테이지 절차적 생성 + 필드(자동사냥)몹 생성
│     ├─ stageStory.js             # 챕터 진입 스토리 + 스테이지별 짧은 플레이버 텍스트
│     ├─ dungeonStages.js, dungeon.js  # 일일 던전 데이터/RPC 연동
│     ├─ combat.js                 # 방어력 데미지 경감 공식(mitigateDamage) + 전투력 계산
│     ├─ story.js                  # 최초 진입 세계관 인트로 텍스트
│     ├─ monsters.js               # 몬스터 CRUD (스타터 생성/활성몬스터 조회/성장 저장) - RPC 경유
│     ├─ stageProgress.js          # 스테이지 클리어 기록/조회 - RPC 경유
│     ├─ economy.js                # 자동사냥 골드 지급 RPC 래퍼
│     ├─ itemCatalog.js            # 4슬롯×5등급 장비 정적 카탈로그 + 강화/보유효과 계산
│     ├─ inventory.js              # 인벤토리 조회/장착/해제/보너스 합산
│     ├─ equipmentGacha.js         # 장비 뽑기/합성 RPC 연동
│     ├─ equipmentDrawProgress.js  # 슬롯별 뽑기레벨 진행도 조회
│     ├─ mail.js, coupon.js        # 우편함/쿠폰 RPC 연동
│     ├─ missions.js               # 가이드 미션 RPC 연동 + pub-sub 버스 + 완료판정 헬퍼
│     ├─ pvp.js                    # PvP RPC 연동
│     ├─ worldBoss.js               # 월드보스 RPC 연동
│     ├─ toast.js                  # 토스트 pub-sub 버스
│     ├─ usePwaInstall.js          # PWA 설치 프롬프트 훅
│     └─ useLobbyChat.js           # 로비 실시간 채팅 훅 (Supabase Realtime 구독)
└─ supabase/migrations/
   └─ 001_init.sql ~ 029_job_tier5_and_mission_cooldown_fix.sql  # database-schema.md 참고
```

## 4. 전체 유저 플로우 (App.jsx의 STAGE 상태머신)

```
LOADING → (세션 없음) → AUTH (로그인/회원가입, 자동로그인 체크박스)
                ↓ (세션 있음, 활성 몬스터 없음)
              STORY (세계관 인트로, 최초 1회)
                ↓
              STARTER (스타터 3종 중 택1)
                ↓
              GAME (메인 화면, 하단 탭: 전투/스테이지/상점/인벤토리/던전/PvP/로비,
                     헤더: 마이페이지/설정/앱다운로드, 화면 우하단: 가이드미션 플로팅버튼)
                ↑↓
         CHAPTER_STORY (새 챕터 처음 진입 시에만 잠깐 표시, 화면 중앙)
```

- 로그인 시 `getActiveMonster()`로 활성 몬스터를 불러오고, `fetchClearedStageIds()`로 클리어 기록을 불러와 **가장 마지막으로 진행하던 스테이지(최고 클리어+1)부터 자동으로 이어서 시작**함. 이걸로 "로그인하면 저장된 지점부터 재개" 요건을 만족.
- 활성 몬스터가 없으면(최초 유저) STORY → STARTER 플로우로 진입.
- 하단 탭 목록(순서대로): ⚔️ 전투 / 🗺️ 스테이지 / 🛒 상점 / 🎒 인벤토리 / 🏰 던전(서브탭: 경험치/골드/전직/🐉월드보스) / ⚔️ PvP / 💬 로비
- 헤더: ⬇️ 앱 다운로드(설치 가능할 때만) / 💰 골드 표시 / 👤 마이페이지 / ⚙️ 설정 / 로그아웃
