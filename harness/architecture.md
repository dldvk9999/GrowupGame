# 아키텍처 (폴더 구조 & 파일 배치 기준)

> ⚠️ **작업 규칙**: 새 파일(컴포넌트/훅/유틸)을 만들기 전에는 반드시 이 문서를 먼저 읽고, 아래 "새 파일 만들 때 체크리스트"에 따라 어느 폴더에 어떤 이름으로 만들지 판단할 것. 이 문서와 실제 코드가 어긋나기 시작하면 문서로서 의미가 없어지므로, 폴더 구조를 바꾸는 리팩토링을 할 때마다 이 문서도 같은 커밋에서 갱신할 것(`dev-guide.md`의 "문서 관리 원칙"과 동일한 취지).

## 왜 이 문서가 생겼는지

`harness/refactoring.md`(리팩토링 진행 로그)에서 여러 세션에 걸쳐 `App.jsx`(1,494줄)/`DungeonSelect.jsx`(996줄)를 분해하고 아토믹디자인 폴더(`atoms`/`molecules`/`organisms`)를 도입했는데, "그래서 새 파일을 만들 때 어디에 뭘 만들어야 하는지" 기준이 리팩토링 로그에만 흩어져있고 정리된 참고 문서가 없었음(사용자 요청으로 이 문서를 신설함). `refactoring.md`는 "지금까지 뭘 했는지"에 대한 로그고, 이 문서는 "앞으로 어떻게 할지"에 대한 규칙이라는 점에서 역할이 다름.

## 폴더 구조 전체

```
src/
├─ App.jsx                  # 최상위 컴포넌트(1,186줄, 리팩토링 4단계까지 진행) - 인증/스테이지진행/미션 등
│                              핵심 게임 흐름 + 각 기능 훅(hooks/) 호출 + 전체 라우팅/렌더링 조립
├─ main.jsx                 # 진입점(ReactDOM.render)
├─ index.css                # 전역 스타일(디자인 토큰, 공용 클래스)
│
├─ components/               # React 컴포넌트
│  ├─ atoms/                 # 아토믹디자인: 원자 - 가장 작은 순수 표시 단위
│  ├─ molecules/              # 아토믹디자인: 분자 - atom 여러 개를 조합한 작은 단위
│  ├─ organisms/              # 아토믹디자인: 유기체 - 자체 데이터fetch/상태를 가진 완결형 UI 블록
│  └─ *.jsx (평면, 55개)       # "페이지/화면" 급 컴포넌트 - 레거시 위치(아래 "레거시 부채" 참고)
│
├─ hooks/                    # React 커스텀 훅(use로 시작, 렌더링 없이 상태+로직만)
├─ lib/                      # 순수 로직 - React를 몰라도 되는 것들(계산식, Supabase RPC 래퍼, 상수)
└─ assets/                   # 정적 리소스(스프라이트 이미지 등)
```

파일 개수(대략, 계속 바뀜): `components/*.jsx` 평면 55개, `components/atoms/` 2개, `components/molecules/` 1개, `components/organisms/` 10개, `hooks/` 14개, `lib/` 76개.

## 폴더별 분류 기준

### `components/atoms/` — 원자
- **조건**: (1) 자체 데이터fetch/API 호출이 전혀 없음(순수하게 props만 받음), (2) 다른 컴포넌트 안에 끼워 넣는 용도로 2곳 이상에서 재사용됨, (3) 대략 50줄 이하
- **예시**: `HpBar.jsx`(체력바), `ExpBar.jsx`(경험치바)
- **예시가 아닌 것**: `SkillButton.jsx`(현재 `components/` 평면에 있음, 재사용되지만 쿨타임 애니메이션 로직이 있어 molecule에 가까움 — 아직 미분류, 레거시 부채 항목 참고)

### `components/molecules/` — 분자
- **조건**: atom 여러 개를 조합하거나, 약간의 판단 로직(if 분기 등)은 있지만 여전히 데이터fetch는 없음
- **예시**: `BuffStatusRow.jsx`(버프/기절 상태 배지 여러 개를 조합해서 보여줌)

### `components/organisms/` — 유기체
- **조건**: (1) 자체적으로 `useState`/`useEffect`로 데이터를 fetch하거나 복잡한 상태를 가짐, (2) 특정 화면(던전 탭, 모달 등) 안에서 하나의 완결된 기능 블록 역할을 함, (3) 다른 화면에서 그대로 재사용되진 않아도 됨(범용성보다 "완결성"이 기준)
- **예시**: `organisms/StreakDungeonPanel.jsx` 등 `DungeonSelect.jsx`에서 분리된 10개 던전 패널 — 각각 자기 던전의 리더보드/입장 버튼을 스스로 fetch해서 그림
- **판단 팁**: "이 파일이 다른 화면에서도 통째로 재사용될 일이 있는가?"가 아니라 "이 파일이 하나의 독립된 기능 덩어리인가?"로 판단할 것

### `components/*.jsx` (평면) — 페이지/화면급 컴포넌트 (레거시 위치)
- **현재 기준**: 탭 전체를 차지하는 화면(`MyPage.jsx`, `Shop.jsx`, `PvP.jsx`, `Achievements.jsx`, `Inventory.jsx`, `Mailbox.jsx` 등), 전투화면(`BattleScreen.jsx` 등 9개), 모달(`AttendanceModal.jsx`, `WelcomeModal.jsx` 등)이 전부 이 평면 폴더에 있음
- 아토믹디자인 관점에선 이 계층이 "templates/pages"에 해당하지만, **아직 `templates/`나 `pages/` 폴더를 새로 만들지 않았음**(리팩토링 미완료 상태, 아래 "레거시 부채" 참고) — 지금 당장은 이 위치가 정상적인 배치임

### `hooks/` — 커스텀 훅
- **조건**: `use`로 시작, React 상태(`useState`/`useEffect`)를 관리하지만 **JSX를 반환하지 않음**(렌더링 없음)
- **두 가지 하위 유형**:
  1. **기능 단위 상태관리 훅**(`App.jsx`에서 분리): `useEliteTrial.js`, `useStreakDungeon.js` 등 — 특정 기능의 상태+핸들러를 통째로 캡슐화. 대체로 `setActiveMonster`/`setProfile`처럼 여러 기능이 공유하는 최상위 상태는 파라미터로 받고, 그 기능만의 상태는 훅이 직접 소유함
  2. **범용 유틸 훅**: `useBattleFx.js`(캔버스 파티클), `useBattleHotkeys.js`(키보드 단축키), `usePwaInstall.js`, `useLobbyChat.js`, `useGuildChat.js` — 여러 컴포넌트에서 재사용
- ⚠️ **과거 실수**: `useGuildChat.js`/`useLobbyChat.js`/`usePwaInstall.js`가 한동안 `lib/`에 잘못 들어가 있었음(이 문서를 쓰면서 발견해서 `hooks/`로 이동함) — `lib/`에 `use`로 시작하는 파일이 보이면 잘못된 위치일 가능성이 높음

### `lib/` — 순수 로직
- **조건**: React를 전혀 몰라도 되는 코드 — 순수 계산식(`combat.js`, `growth.js`, `elements.js`), Supabase RPC 호출 래퍼(`streakDungeon.js`, `guildRaid.js` 등 기능별로 1파일), 상수/카탈로그(`skillCatalog.js`, `itemCatalog.js`), 포맷 유틸(`formatTime.js`)
- **명명 규칙**: 기능 하나당 파일 하나가 원칙(`streakDungeon.js`, `sealedDungeon.js`, `eliteTrial.js`처럼 던전 하나당 lib 파일 하나 + 필요하면 같은 이름의 `hooks/useXxx.js` 세트로 짝을 이룸)

## 새 파일 만들 때 체크리스트

새 컴포넌트/훅/유틸을 만들어야 할 때, 아래 순서로 스스로 물어볼 것:

1. **React를 안 쓰는 순수 로직(계산식/API호출/상수)인가?** → `lib/`. 기능 하나에 관련된 거면 `lib/기능이름.js` 하나로(예: `lib/newDungeon.js`)
2. **JSX를 반환하지 않고 상태/로직만 있는가?** (`use`로 시작) → `hooks/`. 특정 기능 전용이면 `hooks/use기능이름.js`, 여러 곳에서 쓰는 범용이면 이름을 범용적으로(`useXxxFx.js`, `useXxxHotkeys.js` 식)
3. **자체 데이터 fetch나 복잡한 상태 없이, 순수하게 props만 받아서 그리는가?**
   - 다른 atom들의 조합 없이 그 자체로 끝나면 → `components/atoms/`
   - atom 여러 개를 조합하거나 약간의 분기가 있으면 → `components/molecules/`
4. **자체적으로 데이터를 fetch하거나 상태를 갖는 하나의 완결된 기능 블록인가?**(예: 새 던전의 입장 패널, 새 모달) → `components/organisms/`
5. **탭 전체를 차지하는 화면이거나 전투화면인가?** → `components/`(평면, 레거시 위치 — `templates/`가 아직 없어서 임시로 여기 둠. 나중에 `templates/`가 생기면 그때 옮길 것이지, 지금 새 파일 하나 때문에 새 폴더 체계를 혼자 만들지 말 것)
6. **이름 규칙**: 컴포넌트는 `PascalCase.jsx`, 훅은 `useCamelCase.js`, lib는 `camelCase.js`. 새 던전/기능을 추가할 때는 `lib/기능이름.js`(RPC 래퍼) + `hooks/use기능이름.js`(App.jsx에서 쓸 상태훅, 필요시) + `components/organisms/기능이름Panel.jsx`(진입 패널) + 필요하면 `components/기능이름Battle.jsx`(전투화면, 기존 8~9개 전투화면과 동일 패턴 — `useBattleFx`/`useBattleHotkeys`/`atoms/HpBar`/`atoms/ExpBar`/`molecules/BuffStatusRow`를 반드시 재사용할 것, 새로 안 만들 것)처럼 세트로 만드는 게 이 코드베이스의 기존 패턴임

## 레거시 부채 (알고 있지만 아직 안 고친 것들)

`harness/refactoring.md`에 상세 로그가 있음 — 여기는 "지금 새 파일을 어디 둘지 판단할 때 헷갈리지 않게" 요약만:

- **`App.jsx`가 여전히 1,186줄**: 인증/스타터선택/스테이지진행/미션 등 핵심 게임 흐름은 아직 분해 안 됨(상태가 서로 너무 얽혀있어서 리스크가 큼). 새로 추가하는 기능이 이 핵심 흐름과 무관하고 독립적인 던전/모달류라면, `App.jsx`에 새 상태를 늘어놓지 말고 처음부터 `hooks/use기능이름.js`로 만들 것
- **전투화면 9개(200~340줄대)가 아직 atoms/molecules로 완전히 안 쪼개짐**: `useSkill`(스킬 사용 로직)이 파일마다 미묘하게 달라서(전직스킬 강화 반영 여부 등) 통합을 보류 중. 새 전투화면을 또 만들어야 한다면, 기존 9개 중 가장 비슷한 걸 베이스로 복제하되 최소한 `useBattleFx`/`useBattleHotkeys`/`atoms`/`molecules`는 반드시 재사용할 것(또 복붙해서 새로 만들지 말 것)
- **`components/` 평면 55개가 아직 `templates`/`pages`로 안 나뉨**: 지금 당장 새 파일 하나 추가한다고 이 구조를 혼자 바꾸지 말 것 — 전체 재배치는 별도 작업으로 남겨둠
- **`itemCatalog.js`/`skillCatalog.js`처럼 카탈로그성 lib 파일이 상당히 큼**: 새 아이템/스킬을 추가할 때 파일을 쪼갤지는 아직 정해진 기준이 없음(당장 급하지 않음)
