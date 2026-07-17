# 캐릭터/육성/전직

관련 파일: `growth.js`, `speciesData.js`, `speciesDbIds.js`, `jobAdvancement.js`, `monsters.js`

## 스타터/진화

- 스타터 3종: `fire_1`(이모탄) / `water_1`(아쿠파피) / `grass_1`(새프링)
- 각 속성은 3단계 진화(1→2→3차)가 있음: 예) 이모탄→이모드릴→이모라돈 (Lv.15, Lv.30에서 자동 진화)
- **진화**와 **전직**은 별개 시스템: 진화=외형/도감상 종족 변경, 전직=같은 종족 내 강함 단계
- 9종(3속성×3진화) 전부 벡터 SVG 일러스트 완성(`assets/sprites/FireStage1~3.jsx` 등)

### 몬스터 도감 (`MonsterDex.jsx`)

마이페이지 상단에 있는 3×3(속성×진화단계) 그리드. 서버에 "발견 기록"을 저장하는 게 아니라, **매번 클라이언트에서 활성 몬스터의 현재 속성/단계를 기준으로 계산**함 — 내 속성과 같고 현재 도달한 단계 이하인 칸만 스프라이트가 보이고, 나머지는 실루엣(`?`)으로 잠김 표시. 이 게임은 스타터 1종만 계약해서 진화시키는 구조라 다른 두 속성은 항상 미발견 상태로 남는 게 정상 동작임(포획 기능이 생기기 전까지는). 별도 보상은 없는 순수 수집 열람 화면.

## 레벨업/스탯 성장

- **레벨업 경험치**: `expToNextLevel(level) = round(20 * level^1.5)`
- **스탯 성장**: `base스탯 × (1 + (level-1)*0.12) × 전직배율`
- `speciesKeyToDbId`/`dbIdToSpeciesKey`(`speciesDbIds.js`)로 클라이언트 문자열 키(`fire_1` 등)와 DB `species_id`(정수)를 매핑

## 전직 시스템 (1~5차)

- Lv.30/60/100/140/180에서 조건 충족 시 상단에 "✨ 전직 가능!" 배너가 뜨지만(`hasPendingJobAdvancement`), **레벨업만으로 자동 전직되지 않음** — 반드시 전직 던전(`stages-and-dungeons.md` 참고)을 클리어해야 실제 적용됨
- `owned_monsters.unlocked_job_tier`(0~5)가 "실제 적용된" 전직 단계의 단일 진실 공급원
- `jobAdvancement.js`가 두 개념을 분리해서 관리함:
  - `getEligibleTierNumber(element, level)`: 레벨 기준 "조건 충족" 단계 (알림용)
  - `getAppliedTier(element, unlockedJobTier)`: `unlocked_job_tier` 기준 "실제 적용" 단계 (스탯/스킬/외형에 반영되는 진짜 값)
- 전직할 때마다 **전용 스킬 1개씩 추가 습득**(누적, 기본 뽑기 스킬과 별개로 유지)
- 전직에 성공하면 **외형도 전용 그래픽으로 바뀜** (아래 "외형 변경" 참고)

### 전직 단계별 수치

| 단계 | 필요 레벨 | statMultiplier | 전용 스킬 배율 | 전용 스킬 쿨타임 |
|---|---|---|---|---|
| 1차 | 30 | 2.0배 | 3.6배 | 6.5초 |
| 2차 | 60 | 3.5배 | 4.6배 | 8초 |
| 3차 | 100 | 6.0배 | 6.2배 | 10초 |
| 4차 | 140 | 10.0배 | 8.2배 | 12.5초 |
| 5차 | 180 | 16.0배 | 10.6배 | 15.5초 |

- statMultiplier는 `growth.js`의 레벨 성장 보정에 **곱연산**으로 추가 적용됨
- 서버 `save_monster_growth` RPC의 스탯 상한선 공식도 이 최대값(16.0배)에 맞춰 매 단계 확장마다 함께 상향해왔음(migration 011/021/029)
- 전직 스킬은 전부 `damage` 타입, 속성별로 다른 이름/아이콘 사용 (`jobAdvancement.js`의 `JOB_TIERS` 참고)

### 외형 변경

- `getDisplaySpriteKey(speciesId, element, unlockedJobTier)`가 `unlockedJobTier > 0`이면 `${element}_job${tier}` 키를 반환해서, 진화단계 그림 대신 전직 전용 그림이 표시됨
- `JobTierSprite.jsx`(공용 렌더러)가 오라 크기/날개/왕관을 단계별로 화려하게 렌더링 — tier가 오를수록 오라 반지름이 커지고(tier≥2에서 날개, tier≥3에서 왕관+할로 추가), **4~5차도 별도 아트 없이 기존 컴포넌트가 tier 값만 받아서 자동으로 더 화려하게 확장됨**(오라만 더 커지고 3차와 동일한 왕관/할로 장식 유지)
- `assets/sprites/index.jsx`에 3속성×5단계 = 15개 스프라이트 키 전부 등록됨

## 전직 던전과의 관계

- 전직 던전 클리어(`claim_job_dungeon` RPC)가 `owned_monsters.unlocked_job_tier`를 실제로 올리는 유일한 경로
- 자세한 던전 난이도/보스 스탯/입장 규칙은 [`stages-and-dungeons.md`](./stages-and-dungeons.md)의 "전직 던전" 섹션 참고
