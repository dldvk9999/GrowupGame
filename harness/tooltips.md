# 설명 텍스트 툴팁화 (신규, 사용자 요청)

관련 파일: `components/InfoTooltip.jsx`, 그리고 이걸 적용한 화면들(아래 목록)

## 개요

각 탭/화면 상단에 늘 펼쳐져 있던 안내 문구들을 "ⓘ" 아이콘 뒤로 숨기는 공용 컴포넌트. 화면을 덜 복잡하게 보이도록 하면서도, 설명이 필요하면 언제든 다시 볼 수 있게 함.

- **PC**: 아이콘에 마우스를 올리면 팝업이 뜸(`onMouseEnter`/`onMouseLeave`)
- **모바일**: 아이콘을 탭하면 열림. 팝업 안의 ✕ 닫기 버튼이나 팝업 바깥(`.info-tooltip-backdrop`, `position: fixed; inset: 0`)을 탭하면 닫힘 — 터치 환경엔 호버가 없어서 명시적 열기/닫기가 필요하다는 사용자 요청 반영
- 둘 다 같은 `open` state로 동작(호버로 켜지든 클릭으로 켜지든 동일) — 데스크톱에서 클릭해도 토글되고, 모바일에서 클릭하면 열리는 식으로 자연스럽게 겹쳐 동작함
- ⚠️ **모바일 "두 번 눌러야 열림" 버그 수정(사용자 제보)**: 처음엔 `onMouseEnter`(호버로 열기)와 `onClick`(탭으로 토글)을 wrapper와 버튼에 각각 걸어뒀는데, 터치 기기는 탭 하나에 `mouseenter → click` 합성 이벤트를 순서대로 발생시켜서 `setOpen(true)`(mouseenter) 직후 같은 틱에 `setOpen(o => !o)`(click)가 그걸 다시 꺼버림(React가 두 setOpen 호출을 배치 처리해 최종값이 false로 덮어써짐) — 결과적으로 첫 탭은 항상 "안 열린 것처럼" 보였음. `window.matchMedia('(hover: hover)')`로 호버를 지원하는 기기(PC)에서만 `onMouseEnter`/`onMouseLeave`를 아예 등록하고, 호버 미지원 기기(터치)에서는 클릭 시 무조건 "열기"로 처리하도록 수정 — 두 이벤트가 애초에 충돌할 여지를 원천 차단
- 사용법: `<InfoTooltip text="설명 문구" />` 하나만 붙이면 됨(트리거를 커스텀하고 싶으면 `children`으로 아이콘 대신 다른 요소도 가능)

## 어떤 텍스트를 옮겼는지 (설계 원칙)

**순수 "설명"(고정된 규칙/원리 설명) 텍스트만 툴팁으로 옮기고, 실시간으로 바뀌는 상태 정보는 화면에 그대로 남겨둠**:

- ✅ 툴팁으로 옮김: "1층부터 순서대로 깨야 다음 층으로...", "루비 던전은 레벨에 맞춰 난이도가 자동으로...", "전투력이 비슷한 유저와 매칭돼요..." 같은 고정 규칙 설명
- ❌ 그대로 둠: 남은 입장 횟수, 리셋까지 남은 시간, 보유 골드/루비, 파견 슬롯 현황, PvP 다음 갱신 타이머 등 **매 순간 바뀌는 실시간 상태값** — 이런 것까지 다 숨기면 오히려 사용성이 떨어진다고 판단
- ❌ 그대로 둔 예외: `GameGuide.jsx`(설정 > 게임가이드) — 이 화면 자체가 "설명서" 페이지라 다르게 취급함, 본문을 전부 툴팁 뒤로 숨기면 오히려 안 읽힘. `AttendanceModal.jsx` — 이미 모달(명시적 닫기 버튼 있는 팝업) 안이라 그 안에서 또 별도 툴팁을 두는 건 이중 처리로 판단해 생략. `Mailbox.jsx`의 우편 수령 가능 시간대 안내 — 매번 확인해야 하는 실행 가능한 정보라 유지

## 적용된 화면 목록

- `DungeonSelect.jsx` — 경험치/골드던전, 전직던전, 루비던전, 월드보스, 무한의 탑, 파견 (6개 패널)
- `EquipmentGacha.jsx`, `SkillGacha.jsx`, `RelicGacha.jsx` (3개 뽑기 화면)
- `SkillLoadout.jsx` — 편성/전직강화 두 탭
- `Friends.jsx`, `Achievements.jsx`, `Inventory.jsx`(장비/코스튬), `MyPage.jsx`(추천인 등록, 계정 관리)
- `PvPArena.jsx`, `PvPShop.jsx`, `StageSelect.jsx`, `CouponRedeem.jsx`, `LobbyChat.jsx`

## 알려진 범위 (아직 미적용)

시간 관계상 아래는 손대지 않음 — 대부분 이미 짧은 한 줄이거나(추가로 숨길 실익이 적음), 로딩 상태 메시지("불러오는 중...")처럼 애초에 "설명"이 아닌 것들:
- `Leaderboard.jsx`, `Mailbox.jsx`, `PatchNotes.jsx`, `KeybindSettings.jsx`, `WelcomeModal.jsx`의 각 로딩/짧은 안내 문구
- `GameGuide.jsx` 본문(의도적 제외, 위 참고)
