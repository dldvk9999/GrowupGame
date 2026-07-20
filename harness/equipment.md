# 장비 시스템

관련 파일: `itemCatalog.js`, `inventory.js`, `equipmentGacha.js`, `equipmentDrawProgress.js`, `Shop.jsx`, `EquipmentGacha.jsx`, `Inventory.jsx`

## 개요

- **상점(`Shop.jsx`)은 뽑기 전용**임 — 직접 구매(`buy_item`)는 완전히 폐지되고 서버 RPC EXECUTE 권한 자체를 회수함(014)
- 탭 5개: 🗡️ 무기뽑기 / 🛡️ 방어구뽑기 / 🧤 장갑뽑기 / 👢 신발뽑기 / 🎯 스킬뽑기 — 스킬뽑기(`SkillGacha.jsx`)는 상점 안에 통합. **스킬 편성(`SkillLoadout.jsx`)은 041에서 하단 게임 탭의 최상위 탭으로 분리**([`skills.md`](./skills.md))
- 몬스터 처치(자동사냥/스테이지 클리어 모두) 시 **골드 획득** → 이 골드로 뽑기(스킬/장비 5종 공통)

## 슬롯/등급

- 4개 슬롯: 무기(`weapon`, atk) / 보호구(`armor`, def) / 장갑(`gloves`, atk 보조) / 신발(`shoes`, hp)
- 5개 등급: 노멀 < 레어 < 에픽 < 전설 < 신화 — `item_catalog`(서버)/`itemCatalog.js`(client)의 값은 그대로, 가격(`price`)은 더 이상 안 쓰임

## 장비 뽑기

`EquipmentGacha.jsx`, migration 014/017:

- 슬롯별로 완전히 분리된 뽑기 4개. 스킬뽑기와 동일 구조(뽑기레벨 1~**50**, 1000회당 1레벨, 등급 확률표 동일, 1/10/100연차) — 045에서 20→50 확장
- 지정한 슬롯 안에서만 등급이 뽑힘(초기 013의 랜덤슬롯 방식에서 변경됨)
- **뽑기레벨도 4슬롯이 완전히 독립적**(017) — `equipment_gacha_progress`(`user_id, slot` 복합키)에 슬롯별 누적횟수를 따로 저장
- 클라이언트는 `equipmentDrawProgress`(`{weapon,armor,gloves,shoes}`)를 `App.jsx`가 로드해서 `Shop`이 현재 탭에 맞는 값만 `EquipmentGacha`에 전달
- `G`/`Shift+G`/`Ctrl+G` 단축키로 1/10/100회 뽑기
- 상점 상단 "🎁 오늘의 무료뽑기"로 하루 1회 무료 뽑기도 가능([`skills.md`](./skills.md#일일-무료-뽑기-migration-049))
- 뽑기 결과 카드에 **▲ 장착 추천 배지** — 방금 뽑은 아이템의 스탯 보너스(`getEnhancedStatBonus`)가 현재 장착 중인 것보다 높으면 표시. 서버 호출 없이 클라이언트가 즉석 비교만 함

## 뽑기 중복 시 자동 강화

- 이미 보유한 등급을 또 뽑으면 새 행이 안 생기고 `enhance_level`이 **평소 +1**(10% 확률로 +2, "럭키 보너스" 055) 오름(최대 **+1000**, 021에서 15→1000 상향)
- `user_inventory`의 `unique(user_id, item_key)` 제약으로 같은 슬롯+등급은 유저당 정확히 1행만 존재
- **유료(골드 소모) 강화 시스템은 완전히 삭제됨** — `enhance_item` RPC도 EXECUTE 권한 회수로 차단(014)

⚠️ **밸런스 유의**: `getEnhancedStatBonus`/`getPossessionBonus`가 `1 + enhanceLevel*0.08`이라 레벨1000이면 +8000%(81배)까지 커짐 — 사용자가 "상한선만 1000으로 올려달라"고 명시적으로 요청해서 공식 자체는 안 건드렸지만, 실제로 게임이 깨질 정도로 느껴지면 `itemCatalog.js`의 `0.08` 계수를 낮추는 것도 고려할 것

## 장비 합성

`synthesize_equipment`/`synthesize_equipment_batch` RPC, migration 026/028:

- 인벤토리에서 아이템별 "합성"(1회) / "일괄합성"(가능한 만큼 반복) 버튼
- **강화수치 10을 소모**해서 **같은 슬롯 상위 등급 아이템 강화수치를 +1** 올림
- 일괄합성은 서버에서 한번에 반복 처리(왕복 여러 번 안 함), 몇 회 합성됐는지(`times`)도 반환
- 신화 등급은 더 합성 불가
- 대상 아이템이 없으면(첫 합성) 강화수치 0으로 새로 생성되고 바로 +1 적용

⚠️ **구현상 트레이드오프**: 원 요청은 "장비 10개를 합성하면 1개의 상위등급"이었지만, 이 게임은 뽑기 중복이 별도 인벤토리 행(재고)이 아니라 `enhance_level` 누적으로만 반영되는 구조(`unique(user_id, item_key)`)라 "같은 아이템 10개 보유" 개념 자체가 없음. "강화수치 10 = 모은 재료 10개"로 치환해서 매핑함 — "합성할수록 보유효과도 반영"은 상위 등급의 `enhance_level`이 실제로 오르므로 자연히 충족됨(보유효과가 `enhance_level`에 비례).

## 세트 효과 (migration 057)

4슬롯(무기/방어구/장갑/신발)을 **전부 장착**하고 **등급이 모두 같으면** 최종 장착 보너스에 **+5%**가 추가됨. 등급이 하나라도 다르거나 슬롯이 비어있으면 없음.

- **장착 보너스에만 적용**, 보유효과(`sumPossessionBonus`)에는 미적용 — "실제로 다 갖춰 입어야" 받는 혜택
- `lib/inventory.js`의 `isFullSetEquipped(equippedRarities)`가 판정, `sumEquippedBonus`가 합산 후 5% 곱연산으로 반영
- **서버(`calc_equipped_stat_bonus`, 051/057)에도 동일 로직을 SQL로 포팅**해서 PvP/랭킹/`fetch_my_combat_power`에도 정확히 반영됨 — `user_inventory_one_equipped_per_slot`(003, `where equipped` 부분 유니크 인덱스)가 "슬롯당 최대 1개"를 DB 레벨에서 보장하므로 `count(distinct slot) = 4`가 "4슬롯 전부 장착"과 동치임을 이용
- 인벤토리 장비 탭에 세트 활성화 시 "✨ 세트 효과 활성화! 최종 ATK/DEF/HP +5%" 배너. 마이페이지 능력치 상세도 `equipmentOnlyBonus`를 그대로 쓰므로 자동 반영

## 인벤토리 화면

`Inventory.jsx`, 상점과 분리된 별도 탭:

- 슬롯별(무기/보호구/장갑/신발)로 영역 구분, 구역 내에서는 **등급 높은 순 정렬**(`rarityOrder` 내림차순)
- **장착 중인 장비는 금색 테두리 하이라이트**(`.inventory-row--equipped`)
- 아이템마다 "장착 시" 보너스와 "보유효과" 보너스를 함께 표시
- **강화 진행률 바** — 강화수치 1 이상이면 이름 아래에 `강화수치/1000` 비율 게이지(순수 시각 표시, 서버 데이터 변경 없음)
- 강화 버튼은 없음(뽑기로만 오름), 대신 합성/일괄합성 버튼
- 슬롯당 1개만 장착 가능(DB 유니크 제약)

## 뽑기 결과 공유 버튼 (신규 콘텐츠)

뽑기 결과 요약 줄 우측에 "📋 결과 공유" 버튼 — 클릭하면 "🎰 무기 뽑기 10회 결과 - 레어 ×3, 에픽 ×2..." 형태의 텍스트를 클립보드에 복사(닉네임 복사 버튼과 동일한 `navigator.clipboard.writeText` + 2초 체크마크 피드백 패턴). 순수 클라이언트 기능, 서버 변경 없음. 로비 채팅에 붙여넣어 자랑하기 좋게 만든 소셜 유도 장치. 스킬 뽑기(`SkillGacha.jsx`)에도 동일하게 적용.

### 클립보드 복사 유틸 통합 (`lib/clipboard.js`, 신규 콘텐츠)

뽑기/PvP/월드보스 결과 공유 버튼과 닉네임(초대문구) 복사 버튼, 총 5곳에서 "클립보드 복사 시도 → 성공하면 클릭사운드+2초 체크마크, 실패하면 에러 토스트"라는 거의 동일한 코드가 반복되고 있어서 `copyToClipboardWithFeedback(text, errorMessage?)` 하나로 통합함. 호출부는 `if (await copyToClipboardWithFeedback(text)) { setCopied(true); setTimeout(...) }`만 남기면 됨 — "복사됨" 표시 상태 관리는 화면마다 다르므로(변수명이 제각각) 그대로 각 컴포넌트에 남겨두고, 실제 복사 로직/사운드/에러 처리만 공용화. MyPage의 닉네임 복사는 실패 시 커스텀 에러 메시지(닉네임을 직접 보여줌)가 필요해서 `errorMessage` 파라미터로 지원.

## 장비 보유효과

- 장착 여부와 상관없이 보유만 해도 항상 적용되는 상시 보너스
- 장착 보너스의 15%(`POSSESSION_RATIO`)로 계산, 강화 수치가 오르면 같이 커짐(`getPossessionBonus`)
- 전투 시 실제 적용 = 장착 보너스 + 보유한 전체 아이템의 보유효과 합산(`getTotalEquipmentBonus`) — `App.jsx`가 이걸로 `equipmentBonus`를 계산해 각 전투 화면에 넘김
- 스킬 보유효과와 합산되어 최종 전투 스탯에 반영([`skills.md`](./skills.md), [`combat.md`](./combat.md))
- 전투 시작 시 `withEquipment()`로 임시 합산됨 — DB 저장 성장치(`grownBase`)엔 미포함(장비를 빼도 순수 캐릭터 성장은 그대로)

## 최대강화 업적 (migration 091, 신규 콘텐츠)

"만렙 대장장이" — 장비 하나를 `MAX_ENHANCE_LEVEL`(1000)까지 강화하면 달성. `enhance_level >= 1000`인 행이 하나라도 있으면 인정. 진행률은 이미 로드된 `inventory`에서 최댓값 계산(새 서버 호출 없음). `claim_achievement` CASE만 추가, DROP 불필요, diff/41개 키 재검증 완료.

## 최고 강화수치 진행률 표시 (신규 콘텐츠)

인벤토리 장비 탭 상단에 "🔨 최고 강화수치 +N / +1000" 진행률 바 — 코스튬/스킬 컬렉션과 동일 CSS 패턴 재사용, "만렙 대장장이" 업적(091)과 연동. `inventory` prop에서 최댓값만 계산, 새 서버 호출 없음.
