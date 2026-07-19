# 전투 시스템

관련 파일: `BattleScreen.jsx`, `combat.js`, `SkillButton.jsx`

## 두 가지 모드

1. **`idle` 모드 (기본값)**: 탭 진입 시 자동 시작. **1.5초**(`IDLE_KILL_INTERVAL`, 021에서 3초→1.5초로 단축)마다 필드 몬스터(`getIdleMonster`, 공격력 0이라 안전, 스테이지 몬스터보다 훨씬 약함)를 자동 처치하고 소량 경험치/골드 획득. 아무것도 안 눌러도 계속 진행됨
2. **`challenge` 모드**: "⚔️ 도전하기" 버튼으로 시작. 실제 스테이지 몬스터(`getStageEnemy`)와 진짜 전투 — HP 실시간 표시, 스킬 사용, 적 자동 반격(1.9초 텀). 승리 시 스테이지 클리어+정식 보상, 패배 시 재도전 가능
   - 승리 결과창: **"다음 스테이지로" / "스테이지 목록" / "사냥터로"** 3버튼

- 전투 이펙트: `<canvas>` 기반 파티클(타격 시 튀는 입자) + 화면 스크린쉐이크

## 데미지/방어력 공식

`combat.js`의 `mitigateDamage(rawDamage, defenderDef)`:

```
경감후_데미지 = round(max(1, rawDamage * 100 / (100 + defenderDef)))
```

- 몬스터/보스/던전보스/전직던전보스 전부 `def` 스탯을 갖고 이 공식으로 데미지에 반영됨
- **플레이어도 자기 `def`로 받는 피해가 경감됨** — 예전엔 방어력이 사실상 장식 스탯이었으나 지금은 실제로 작동
- 전직해서 공격력이 급격히 세져도 후반 스테이지는 몬스터 방어력 때문에 여전히 버거워지도록 의도된 밸런스

스테이지 몬스터 방어력 공식(자세한 스탯 성장은 [`stages-and-dungeons.md`](./stages-and-dungeons.md)):
```
def = round(3 + index*0.25*(보스면 1.6)*chapterStep)
```

## 전투력 계산

`combat.js`의 `calculateCombatPower(monster)`:

```
전투력 = round(atk*4.5 + def*3.2 + maxHp*0.6)
```

- 세 전투 화면(스테이지/일반던전/전직던전) 상단에 "⚔️ 나의 전투력 N"으로 항상 표시
- 장비 보유효과/장착 보너스, 스킬 보유효과까지 반영된 `player` 객체 기준이라 실제 체감 강함과 대략 비례
- PvP도 유사한 공식(`calc_combat_power`, 서버 SQL)을 쓰지만 **장비/스킬 보너스는 미포함** — [`pvp.md`](./pvp.md)

## 스킬 쿨타임 UI

`SkillButton.jsx`:

- 스킬 사용 시 버튼 테두리에 시계방향으로 채워지는 원형 링(`conic-gradient` + mask로 도넛 형태, `requestAnimationFrame`으로 매 프레임 갱신)
- 실제 쿨타임 종료 판정은 부모의 `setTimeout` 기반 `cooldowns` state가 담당, 링은 순수 시각효과(`cooldownStarts`에 사용 시각 기록해서 계산)라 로직에 영향 없음
- `BattleScreen`/`DungeonBattle`/`JobDungeonBattle` 세 전투 화면이 이 컴포넌트를 공유
- 헤이스트로 실제 쿨타임이 줄면 `skill.cooldown` 대신 `effectiveCooldowns[skill.id]`를 넘겨서 링도 정확한 시간에 맞춰 돎([`skills.md`](./skills.md))
- 버튼 모서리에 `1`~`9` 숫자 배지, 동일 숫자키로 즉시 사용 가능([`ui-and-ux.md`](./ui-and-ux.md))

## 키보드 단축키 (전투 관련)

| 키 | 동작 |
|---|---|
| `1`~`9` | 슬롯별 스킬 즉시 사용 |
| `Space` (스테이지) | 상황별: 자동사냥 중→도전 시작 / 승리→다음 스테이지로 / 패배→재도전 |
| `R` (스테이지, 패배 시) | 즉시 재도전 |
| `Space` (던전 결과창) | "던전 목록으로"(또는 전직 성공 시 "확인") |

전체 단축키 목록은 [`ui-and-ux.md`](./ui-and-ux.md) 참고.
