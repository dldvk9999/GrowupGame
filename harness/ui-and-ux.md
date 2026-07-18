# UI / UX 공통

관련 파일: `toast.js`, `ToastContainer.jsx`, `usePwaInstall.js`, `index.css`

## 토스트 알림

- 간단한 pub-sub 이벤트버스(`showToast(message, type)`) + `App.jsx` 최상단에 마운트된 `ToastContainer`가 구독해서 화면 상단 중앙에 표시(3.2초 후 자동 소멸)
- 골드 부족 에러가 발생하는 모든 지점(`inventory.js`, `skillGacha.js`, `equipmentGacha.js` 등)에서 공통으로 토스트를 띄우도록 처리됨 — 새로운 골드 소비 기능을 추가할 때도 동일 패턴(에러 메시지에 '골드' 포함되면 `showToast(..., 'error')` 호출) 유지할 것

### ⚠️ 버튼 disabled 함정 주의

구매/강화/뽑기/던전입장 버튼을 "실행 불가 시 `disabled`"로 막아버리면 클릭 자체가 안 돼서 에러가 발생할 기회가 없어지고, 결과적으로 토스트도 못 뜸(실제로 이 버그가 있었음, 수정됨).

골드 소비 버튼과 던전 입장 버튼 전부 **클릭은 항상 가능하게 두고**, 핸들러 진입 시점에 조건(골드 부족/입장권 소진/레벨 부족/이전단계 미완료 등) 체크해서 `showToast`를 직접 호출 + 조기 return하는 패턴을 씀. 버튼의 시각적 "비활성처럼 보이게"는 `disabled` 대신 `.btn-unaffordable` CSS 클래스(투명도+빨간 테두리)로만 처리. 서버 RPC가 그래도 거부하는 경우(레이스컨디션 등 예외적 상황)를 대비해 `App.jsx`의 각 핸들러도 catch에서 동일하게 `showToast` 호출함(이중 방어).

## 키보드 단축키

각 화면 컴포넌트가 자기 스코프 안에서만 `window.addEventListener('keydown', ...)`를 등록/해제하는 방식(마운트된 화면에서만 동작, 전역 단일 핸들러 아님). 입력창(`INPUT`/`TEXTAREA`)에 포커스가 있을 때는 전부 무시하도록 가드 처리됨.

| 화면 | 키 | 동작 |
|---|---|---|
| 전투(스테이지/일반던전/전직던전) | `1`~`9` | 슬롯별 스킬 즉시 사용 — 041에서 편성 슬롯 최대치가 5→10으로 늘었지만 숫자키 단축키는 `1`~`9`(9개)까지만 지원함, 10번째 슬롯은 버튼 클릭으로만 사용 가능 |
| 스테이지 전투 | `Space` | 상황별: 자동사냥 중→도전 시작 / 승리→다음 스테이지로 / 패배→재도전 |
| 스테이지 전투 | `R` | 패배 시 즉시 재도전 (Space와 동일 동작, 습관적으로 R 누르는 사람 대비) |
| 일반/전직 던전 전투 | `Space` | 결과가 나온 상태에서 "던전 목록으로"(또는 전직 성공 시 "확인") |
| 상점(뽑기 4탭) | `Tab` / `Shift+Tab` | 무기→방어구→장갑→신발→스킬 순환 이동 (스킬편성은 041에서 최상위 탭으로 분리돼서 이 순환에서 빠짐) |
| 던전 탭 | `Tab` / `Shift+Tab` | 경험치→골드→전직 던전 순환 이동 |
| 장비/스킬 뽑기 화면 | `G` / `Shift+G` / `Ctrl(⌘)+G` | 1회 / 10회 / 100회 뽑기 |
| 설정 > 우편함 | `Enter` | 미수령 우편 전체 일괄수령 |
| 설정 > 쿠폰 입력 | `Enter` | 입력창 포커스 상태에서 폼 제출 (원래 HTML form 기본 동작, 별도 구현 없음) |
| 마이페이지/설정 화면 | `Esc` | 전투 탭으로 복귀 (`App.jsx`의 `activeTab`을 `'battle'`로) |

`Space`/`Tab`은 브라우저 기본 동작(스크롤, 포커스 이동)과 충돌해서 각 핸들러 안에서 `e.preventDefault()` 처리함. 배틀 화면 3곳은 상태가 자주 바뀌는 특성상, 클로저 문제를 피하려고 `useRef`에 최신 상태(`mode`/`result`/`availableSkills` 등)를 매 렌더마다 담아두고 `keydown` 리스너 자체는 `useEffect(..., [])`로 1회만 등록하는 패턴을 씀(리스너를 매 렌더 재등록하지 않기 위함).

## PWA

- `vite-plugin-pwa`로 `manifest.webmanifest` + 서비스워커 자동 생성
- 헤더의 "⬇️ 앱 다운로드" 버튼이 `beforeinstallprompt` 이벤트를 잡아서 설치 유도(`usePwaInstall.js`)
- 아이콘 192/512px 두 종류, 홈 화면 추가/설치 가능(모바일 브라우저 크롬/사파리 등에서)

## 자동로그인 (설정 위치 유의)

자동로그인 체크박스 자체는 [`account-and-settings.md`](./account-and-settings.md)에서 자세히 다룸. 여기서는 UI 배치만 언급: 로그인 화면 비밀번호 입력창 아래에 위치.

## 모바일 레이아웃 겹침 주의

가이드 미션 플로팅 버튼이 `position:fixed`라서 콘텐츠 하단(특히 전투화면 스킬버튼 줄)을 가릴 수 있음 — `app-main`의 하단 padding을 데스크톱 110px/모바일 150px로 넉넉하게 잡아서 방지함(`index.css`). **하단에 새 UI를 추가할 때도 이 여백 고려할 것.**

### flex 가로 카드형 UI의 모바일 안전 패턴

`.achievement-row`처럼 아이콘+정보+버튼을 한 줄에 나열하는 flex 카드를 새로 만들 때는, 버튼 텍스트가 길어지는 경우(칭호 이름, 긴 라벨 등)를 대비해 **`flex-wrap: wrap`을 기본으로 걸어둘 것** — 좁은 화면에서 내용이 다 안 들어가면 가로 스크롤을 만드는 대신 다음 줄로 자연스럽게 넘어감. 함께 `flex: 1`인 정보 영역엔 `min-width: 0` 대신 **적당한 하한값(예: 140px)**을 줘서 너무 심하게 짜부러들지 않게 하는 게 가독성에 낫다(업적 화면, 050에서 이 패턴 적용).

## 과거에 있었던 CSS 스크롤 버그

`html, body, #root`에 `height: 100%`(고정값)를 주면 콘텐츠가 뷰포트보다 길어질 때(예: 상점 화면) 하단이 스크롤되지 않고 잘리는 문제가 있었음. `min-height: 100%`로 바꿔서 해결함 — 비슷한 "화면 하단 짤림" 이슈 재발 시 이 부분부터 의심할 것.

### `html/body/#root`에 `overflow-x: hidden`을 걸었다가 `position: sticky`가 전부 깨졌던 회귀

모바일 가로스크롤을 막으려고 `html, body, #root`에 전역으로 `overflow-x: hidden`을 추가했었는데, 이게 `.loadout-sticky-bar`(스킬 편성 화면의 편성 슬롯 영역)를 포함한 `position: sticky` 요소들을 전부 깨뜨렸음. **overflow를 하나라도 지정한 조상 요소가 있으면 그 요소가 sticky의 기준 스크롤 컨테이너가 되어버려서, 뷰포트 기준으로 붙어있어야 할 sticky가 더 이상 안 붙음**(CSS sticky positioning의 잘 알려진 함정).

→ **수정**: `html/body/#root`의 `overflow-x: hidden`을 제거함. 모바일 가로스크롤이 실제로 필요했던 곳(전투/스테이지 탭의 `.tab-nav`, 스테이지 화면의 `.chapter-carousel`)은 이미 각 요소에 로컬로 `overflow-x: auto` + `scrollbar-width: none`/`::-webkit-scrollbar { display: none }`가 걸려있어서, 전역 처리 없이도 스크롤은 되지만 스크롤바만 안 보이는 원래 의도가 그대로 유지됨.

**교훈**: 가로스크롤/오버플로우를 막고 싶을 때 `html`/`body`/`#root`처럼 최상위 조상에 `overflow-x: hidden`을 거는 건 하위에 `position: sticky`를 쓰는 요소가 하나라도 있으면 전부 깨뜨리는 광범위한 부작용이 있음. 오버플로우가 실제로 발생하는 구체적인 요소(캐러셀, 탭 네비게이션 등)에 국소적으로 `overflow-x: auto` + 스크롤바 숨김을 적용하는 쪽이 안전함.

## 스토리 팝업 중앙정렬

`StoryIntro`, `ChapterStory` 팝업은 `.center-viewport` 래퍼로 화면 중앙에 표시됨(로그인 화면과 동일한 유틸 클래스).

## 모바일 헤더 - 햄버거 메뉴

`App.jsx`의 `HeaderActions` 컴포넌트(골드/닉네임/앱다운로드/마이페이지/설정/로그아웃 버튼)를 데스크톱에선 헤더에 그대로 인라인으로, **모바일(≤640px)에선 숨기고 대신 헤더 우측에 햄버거 버튼(☰)**을 노출함.

- 햄버거 클릭 → `mobileMenuOpen` state가 true가 되며 오른쪽에서 슬라이드인되는 드로어(`mobile-menu-drawer`)가 열림 — 같은 `HeaderActions` 컴포넌트를 드로어 안에도 재사용해서 두 군데 UI가 어긋나지 않게 함(탭 이동/로그아웃 시 드로어도 같이 닫히도록 `onNavigate`/`onLogout` 콜백에서 `setMobileMenuOpen(false)`도 함께 호출)
- 반투명 백드롭(`mobile-menu-backdrop`)을 클릭해도 닫힘
- 데스크톱 화면에서는 `mobile-menu-btn`/`mobile-menu-drawer`/`mobile-menu-backdrop`이 CSS로 완전히 숨겨짐(상태값과 무관하게 `display:none`) — 리사이즈 등으로 상태가 꼬여도 데스크톱에서 드로어가 뜨는 일은 없음

## 헤더가 sticky임 (자주 잊어버리는 부분)

`.app-header`는 `position: sticky; top: 0; z-index: 10;`로 이미 고정돼 있음. 다른 화면에서 "헤더 아래 몇 px" 같은 sticky 오프셋을 계산할 때는 이 헤더가 계속 보인다는 전제로 값을 잡아야 함(스킬 편성의 `loadout-sticky-bar`가 이 패턴의 예시, [`skills.md`](./skills.md) 참고).

## 자동사냥 랜덤 대사 (신규 콘텐츠, `lib/idleFlavor.js`)

자동사냥 처치 로그가 매번 "OO 처치! 경험치+골드" 정보만 뜨면 단조로울 수 있어서, 12% 확률로 그 자리에 순수 재미용 대사(`IDLE_FLAVOR_LINES`, 12종)가 대신 뜸. 게임 로직/보상엔 전혀 영향 없는 텍스트 콘텐츠라 마이그레이션 불필요, `lib/idleFlavor.js`의 배열에 새 대사를 자유롭게 추가/수정 가능. `BattleScreen.jsx`의 자동사냥 루프에서 `maybePickIdleFlavor()` 결과가 있으면 그걸 쓰고, 없으면(88% 확률) 기존처럼 정상 처치 정보를 보여줌.

## 전반적인 디자인 톤 완화 (딱딱함 개선)

사용자 피드백으로 전체 UI가 "너무 딱딱한 느낌"이라는 지적을 받아서, 구조는 안 건드리고 시각 속성 위주로 부드럽게 다듬음:

- **디자인 토큰 확장**(`:root`): `--radius-md`를 10px→14px, `--radius-lg`를 16px→20px로 상향(전역 재사용 변수라 이 두 값만 바꿔도 광범위하게 자동 반영됨). `--radius-sm`(10px), `--shadow-soft`/`--shadow-lift`(카드용 그림자 2단계), `--ease-soft`(cubic-bezier 부드러운 이징 커브) 신규 추가
- **버튼(`.btn`) 기본 클래스**: box-shadow 추가, `hover` 시 살짝 떠오르는 효과(`translateY(-1px)` + 밝기 증가) 추가 — 이전엔 `:active`(눌렀을 때)만 반응하고 `:hover`는 아무 피드백이 없어서 데스크톱에서 밋밋했음
- **카드류**(`.auth-card`, `.story-card`, `.pvp-power-card`, `.pvp-result-card`, `.shop-card`, `.gacha-panel`, `.worldboss-hp-card`, `.patch-note-entry`, `.game-guide-section`, `.stat-breakdown-card`, `.referral-card`, `.monster-dex` 등): `box-shadow: var(--shadow-soft)` 일괄 추가, 로그인/스토리 카드는 미세한 대각선 그라데이션(`linear-gradient(165deg, ...)`)도 추가해서 완전 납작한 단색보다 입체감을 줌
- **탭 네비게이션**(`.tab-btn`, `.shop-tab`): active 상태를 단색 배경 대신 그라데이션 + 그림자로 변경, 상태 전환에 `transition` 추가
- **리스트 행**(`.achievement-row`, `.inventory-row`, `.daily-checklist-item`): hover 시 테두리 색이 부드럽게 바뀌는 전환 추가
- **진행바**(`.bar-track`/`.bar-fill`): 완전히 둥근 캡슐형(`border-radius: 999px`)으로 변경 + 안쪽 그림자로 홈 파인 느낌 + 채워지는 애니메이션을 더 느긋한 이징으로 변경
- **인풋 필드**: 포커스 시 딱딱한 2px 아웃라인 대신 부드러운 glow(box-shadow 링) 효과로 변경

이 변경들은 전부 기존 클래스명/구조를 그대로 유지한 채 시각 속성만 조정한 것이라(색상 자체는 거의 그대로 유지, 컴포넌트 마크업 변경 없음), 회귀 위험이 낮음 — 빌드 후 CSS 중괄호 균형 검증 + 정적 HTML 프리뷰를 Playwright로 렌더링해서 그라데이션 색상이 픽셀 단위로 정확한지 확인함(이 샌드박스 환경엔 Supabase 자격증명이 없어서 실제 로그인 후 화면까지는 렌더링 확인이 어려웠음 — 실제 배포본에서 사용자가 직접 확인 필요).
