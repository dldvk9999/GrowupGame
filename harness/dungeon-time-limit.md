# 던전/전투 제한시간 (신규, 사용자 요청)

관련 파일: `components/TimeLimitBar.jsx`, `BattleScreen.jsx`/`DungeonBattle.jsx`/`JobDungeonBattle.jsx`/`WorldBossBattle.jsx`

## 개요

사용자 요청: "모든 던전(스테이지, 경험치, 골드, 무한의탑, 전직, 월드보스)을 도전할 때 제한시간 1분으로 설정" + "1분 게이지는 눈으로 볼 수 있게 점점 줄어드는걸 꼭 표현".

- **스테이지**(`BattleScreen.jsx`), **경험치/골드/무한의탑**(`DungeonBattle.jsx` — 이 셋은 원래 같은 컴포넌트를 공유해서 한 번만 고치면 전부 적용됨), **전직**(`JobDungeonBattle.jsx`), **월드보스**(`WorldBossBattle.jsx`, 원래도 60초 제한이 있었으나 텍스트로만 "N초 남음"을 보여줬음 — 이번에 시각적 게이지를 추가함) — 총 4개 컴포넌트가 6개 던전 종류를 전부 커버함
- 1분(60000ms) 안에 이기지 못하면 자동으로 `result = 'lose'`로 전환 — **기존 HP 0으로 인한 패배와 완전히 동일한 처리 흐름**을 그대로 재사용(별도의 "시간초과 전용 화면"을 만들지 않음, 로그 문구만 "시간 초과! ~가 제한시간 안에 이기지 못했어요."로 다르게 표시). 패배 결과 패널의 "돌아가기" 버튼을 누르는 것도 기존과 동일 — 일관된 UX 유지가 목적
- 스테이지(`BattleScreen.jsx`)는 **유휴(자동사냥, idle) 모드에는 제한시간이 적용되지 않음** — `mode === 'challenge'`(실제 도전 중)일 때만 카운트다운이 돎. 자동사냥으로 스테이지를 밀 때(`autoPush`)도 매번 `startChallenge()`가 새로 호출될 때마다 타이머가 리셋됨

## `TimeLimitBar.jsx` (공용 게이지 컴포넌트)

```
<TimeLimitBar remainingMs={timeLeftMs} totalMs={TIME_LIMIT_MS} />
```
- `remainingMs/totalMs` 비율로 너비가 줄어드는 바(`transition: width 1s linear`로 부드럽게 줄어듦)
- 남은 비율이 30% 미만이면 빨간색+펄스 애니메이션으로 경고 표시(`time-limit-fill--warning`)
- 카운트다운 로직(실제 시간 계산, 타임아웃 시 패배 처리)은 각 전투 컴포넌트가 직접 관리하고, 이 컴포넌트는 순수 표시만 담당 — 화면마다 "시간 초과 시 정확히 뭘 할지"가 조금씩 달라서(예: 스테이지는 idle 모드엔 적용 안 함) 로직을 억지로 공통화하지 않음

## 구현 패턴 (4개 컴포넌트 공통)

```js
const [timeLeftMs, setTimeLeftMs] = useState(TIME_LIMIT_MS);
const startedAtRef = useRef(Date.now()); // 도전이 새로 시작될 때마다 갱신

useEffect(() => {
  if (result) return; // 이미 승패가 갈렸으면 카운트다운 중지
  const timer = setInterval(() => {
    const left = TIME_LIMIT_MS - (Date.now() - startedAtRef.current);
    setTimeLeftMs(Math.max(0, left));
    if (left <= 0) {
      clearInterval(timer);
      setResult('lose');
      setLog('시간 초과! ...');
    }
  }, 1000);
  return () => clearInterval(timer);
}, [result]);
```

- `setInterval` 기반이라 1초 단위로만 갱신되지만, 실제 만료 판정은 `Date.now()` 차이로 계산해서 탭이 백그라운드에 있다가 돌아와도(브라우저가 `setInterval`을 스로틀했더라도) 다음 틱에 정확한 값으로 보정됨
- `BattleScreen.jsx`만 `startedAtRef`를 `startChallenge()` 함수 안에서 명시적으로 재설정함(재도전마다 타이머 리셋) — 나머지 3개(`DungeonBattle`/`JobDungeonBattle`/`WorldBossBattle`)는 세션 하나당 컴포넌트가 통째로 리마운트되는 구조라 `useRef(Date.now())` 초기값 그대로도 충분함
