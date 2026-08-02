import { useEffect, useState, useCallback } from 'react';
import MonsterSprite from './MonsterSprite';
import SkillButton from './SkillButton';
import { getDisplaySpriteKey, getAvailableSkills, getJobSkillTier, buildInitialJobSkillCooldowns } from '../lib/jobAdvancement';
import { mitigateDamage, calculateCombatPower } from '../lib/combat';
import { getElementMultiplier, ELEMENT_COLORS } from '../lib/elements';
import { hasFullSealCostumeSet, SEAL_SET_DAMAGE_MULTIPLIER } from '../lib/sealCostumeCatalog';
import { bumpMission } from '../lib/missions';
import { playAttackSound, playHealSound, playBuffSound, playVictorySound } from '../lib/audio';
import { getJobSkillKeybinds, getKeyForJobTier } from '../lib/keybinds';
import { getEnhancedJobSkillMultiplier } from '../lib/jobSkillEnhance';
import { claimSealedDungeonReward } from '../lib/sealedDungeon';
import { showToast } from '../lib/toast';
import { useBattleFx } from '../hooks/useBattleFx';
import { useBattleHotkeys } from '../hooks/useBattleHotkeys';
import HpBar from './atoms/HpBar';
import BuffStatusRow from './molecules/BuffStatusRow';

const ENEMY_ATTACK_INTERVAL = 1500;

function withEquipment(monster, bonus) {
  const b = bonus ?? { atk: 0, def: 0, hp: 0 };
  return {
    ...monster,
    atk: monster.atk + b.atk,
    def: monster.def + b.def,
    maxHp: monster.maxHp + b.hp,
    hp: monster.maxHp + b.hp,
  };
}

/**
 * props
 * - initialMonster, equipmentBonus, equippedSkills, equippedCostumes, jobSkillEnhancements
 * - sessionId, sealedBoss: sealedDungeon.js의 getSealedDungeonBoss() 결과
 * - onClaimed(fragmentsEarned, totalFragments): 승리 + 보상수령 성공 시
 * - onExit()
 *
 * 다른 단발성 던전(루비 던전)과 결정적으로 다른 점: 승리해도 applyExpGain을 전혀
 * 호출하지 않음 - 경험치/레벨이 이 던전으로는 절대 오르지 않음(의도된 설계, 오직
 * "봉인의 파편"만 지급해 성장 속도에 아무 영향을 주지 않음).
 */
export default function SealedDungeonBattle({
  initialMonster, equipmentBonus, equippedSkills, equippedCostumes, jobSkillEnhancements,
  sessionId, sealedBoss, onClaimed, onExit,
}) {
  const availableSkills = getAvailableSkills(equippedSkills ?? [], initialMonster.element, initialMonster.unlockedJobTier ?? 0);
  const [player, setPlayer] = useState(() => withEquipment(initialMonster, equipmentBonus));
  const [enemy, setEnemy] = useState(() => ({ ...sealedBoss }));
  const [initialJobCooldowns] = useState(() => buildInitialJobSkillCooldowns(availableSkills));
  const [cooldowns, setCooldowns] = useState(() => initialJobCooldowns.cooldowns);
  const [cooldownStarts, setCooldownStarts] = useState(() => initialJobCooldowns.cooldownStarts);
  const [effectiveCooldowns, setEffectiveCooldowns] = useState(() => initialJobCooldowns.effectiveCooldowns);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState(null); // { fragmentsEarned, totalFragments } | null

  useEffect(() => {
    const timers = Object.entries(initialJobCooldowns.effectiveCooldowns).map(([skillId, delay]) =>
      setTimeout(() => setCooldowns((prev) => ({ ...prev, [skillId]: false })), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [enemyStunnedUntil, setEnemyStunnedUntil] = useState(0);
  const [playerBuffs, setPlayerBuffs] = useState({ atkUntil: 0, atkMult: 1, defUntil: 0, defMult: 1, hasteUntil: 0, hasteReduction: 0 });
  const [log, setLog] = useState(`${sealedBoss.name} 등장! 이겨도 경험치는 없지만, 봉인의 파편을 얻을 수 있어요.`);
  const [result, setResult] = useState(null);
  const [jobKeybinds] = useState(() => getJobSkillKeybinds());
  const [screenFlash, setScreenFlash] = useState(null);
  const [showHealFx, setShowHealFx] = useState(false);

  const { canvasRef, shake, spawnParticles, triggerShake } = useBattleFx();
  // (신규, 사용자 요청) 봉인 코스튬 4종 전부 장착 시 데미지 250% 증폭(3.5배)
  const sealSetMult = hasFullSealCostumeSet(equippedCostumes) ? SEAL_SET_DAMAGE_MULTIPLIER : 1;

  const damageEnemy = useCallback((amount) => {
    setEnemy((prev) => ({ ...prev, hp: Math.max(prev.hp - amount, 0) }));
    spawnParticles(0.8, 0.35, '#c9a4ff');
    triggerShake();
  }, [spawnParticles, triggerShake]);

  const damagePlayer = useCallback((amount) => {
    setPlayer((prev) => ({ ...prev, hp: Math.max(prev.hp - amount, 0) }));
    spawnParticles(0.2, 0.7, ELEMENT_COLORS[player.element]);
    triggerShake();
  }, [spawnParticles, triggerShake, player.element]);

  // 승리해도 applyExpGain 호출 없음 - player state는 전투 내 HP 변화만 반영하고 그대로 둠
  useEffect(() => {
    if (result) return;
    if (enemy.hp <= 0) {
      setResult('win');
      setLog(`${enemy.name} 처치! 봉인의 파편을 받는 중...`);
      playVictorySound();
    } else if (player.hp <= 0) {
      setResult('lose');
      setLog(`${player.name}가 쓰러졌다... 열쇠는 이미 소모됐지만, 내일 다시 도전해보세요.`);
    }
  }, [enemy.hp, player.hp, result]); // eslint-disable-line react-hooks/exhaustive-deps

  // 승리 시 자동으로 서버에 보상 요청(다른 단발성 던전은 "확인" 버튼으로 넘어가지만, 여긴
  // 골드처럼 즉시 잔액에 반영할 필요가 없어 결과 화면에서 바로 파편 개수를 보여주는 편이 자연스러움)
  useEffect(() => {
    if (result !== 'win' || claiming || claimResult) return;
    setClaiming(true);
    const timer = setTimeout(() => {
      claimSealedDungeonReward(sessionId)
        .then((res) => {
          setClaimResult(res);
          onClaimed?.(res.fragmentsEarned, res.totalFragments);
        })
        .catch((err) => {
          showToast(err.message ?? '보상 반영에 실패했어요.', 'error');
        })
        .finally(() => setClaiming(false));
    }, 1000); // 서버의 "세션 생성 후 최소 1초" 게이트를 확실히 통과하도록 살짝 대기
    return () => clearTimeout(timer);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => {
      if (Date.now() < enemyStunnedUntil) {
        setLog(`${enemy.name}은(는) 기절해서 움직이지 못한다!`);
        return;
      }
      setLog(`${enemy.name}의 공격!`);
      const defBuffActive = Date.now() < playerBuffs.defUntil;
      const effDef = player.def * (defBuffActive ? playerBuffs.defMult : 1);
      damagePlayer(mitigateDamage(enemy.atk, effDef, getElementMultiplier(enemy.element, player.element)));
    }, ENEMY_ATTACK_INTERVAL);
    return () => clearInterval(timer);
  }, [enemy.atk, enemy.name, result, damagePlayer, player.def, enemyStunnedUntil, playerBuffs]);

  function useSkill(skill) {
    if (result || cooldowns[skill.id]) return;
    const now = Date.now();
    const atkBuffActive = now < playerBuffs.atkUntil;
    const effAtk = player.atk * (atkBuffActive ? playerBuffs.atkMult : 1);
    const effMultiplier = getEnhancedJobSkillMultiplier(skill, jobSkillEnhancements);

    const jobTier = getJobSkillTier(skill.id);
    if (skill.type === 'damage') {
      const dmg = mitigateDamage(effAtk * effMultiplier, enemy.def, getElementMultiplier(skill.element, enemy.element) * sealSetMult);
      setLog(`${player.name}의 ${skill.name}!`);
      playAttackSound();
      damageEnemy(dmg);
      if (jobTier > 0) {
        const jobColors = ['#ffd24a', '#ff9a3c', '#ff5a5a', '#ff4ad9', '#c94aff'];
        const colorIdx = Math.min(jobTier, 5) - 1;
        spawnParticles(0.8, 0.35, jobColors[colorIdx], 22 + jobTier * 10, 1 + jobTier * 0.2);
        if (jobTier >= 3) {
          setScreenFlash(jobColors[colorIdx]);
          setTimeout(() => setScreenFlash(null), 260 + jobTier * 20);
        }
      }
    } else if (skill.type === 'heal') {
      const healAmount = Math.round(player.maxHp * effMultiplier);
      setPlayer((prev) => ({ ...prev, hp: Math.min(prev.hp + healAmount, prev.maxHp) }));
      setLog(`${player.name}의 ${skill.name}! 체력 +${healAmount}`);
      playHealSound();
      spawnParticles(0.2, 0.7, '#8fffb0');
      setShowHealFx(true);
      setTimeout(() => setShowHealFx(false), 1300);
    } else if (skill.type === 'stun') {
      const stunMs = Math.round(effMultiplier * 1000);
      setEnemyStunnedUntil(now + stunMs);
      setLog(`${player.name}의 ${skill.name}! 적을 ${(stunMs / 1000).toFixed(1)}초간 기절시켰다!`);
      spawnParticles(0.8, 0.35, '#ffe680');
    } else if (skill.type === 'dot') {
      const perTick = mitigateDamage(effAtk * effMultiplier, enemy.def, getElementMultiplier(skill.element, enemy.element) * sealSetMult);
      const ticks = skill.ticks ?? 4;
      const tickInterval = skill.tickInterval ?? 1500;
      setLog(`${player.name}의 ${skill.name}! 지속 피해 시작`);
      for (let t = 1; t <= ticks; t++) {
        setTimeout(() => damageEnemy(perTick), t * tickInterval);
      }
    } else if (skill.type === 'buff_atk') {
      setPlayerBuffs((prev) => ({ ...prev, atkUntil: now + skill.duration, atkMult: 1 + effMultiplier }));
      setLog(`${player.name}의 ${skill.name}! 공격력이 상승했다!`);
      playBuffSound();
      spawnParticles(0.2, 0.7, '#ff8a4a');
    } else if (skill.type === 'buff_def') {
      setPlayerBuffs((prev) => ({ ...prev, defUntil: now + skill.duration, defMult: 1 + effMultiplier }));
      setLog(`${player.name}의 ${skill.name}! 방어력이 상승했다!`);
      playBuffSound();
      spawnParticles(0.2, 0.7, '#4aa8ff');
    } else if (skill.type === 'haste') {
      setPlayerBuffs((prev) => ({ ...prev, hasteUntil: now + skill.duration, hasteReduction: effMultiplier }));
      setTimeout(() => setPlayerBuffs((prev) => ({ ...prev })), skill.duration);
      setLog(`${player.name}의 ${skill.name}! 재사용 대기시간이 감소한다!`);
      playBuffSound();
      spawnParticles(0.2, 0.7, '#c9ff4a');
    }

    bumpMission('use_skills', 1);
    const hasteActive = now < playerBuffs.hasteUntil;
    const effectiveCooldown = hasteActive ? Math.round(skill.cooldown * (1 - playerBuffs.hasteReduction)) : skill.cooldown;
    setCooldowns((prev) => ({ ...prev, [skill.id]: true }));
    setCooldownStarts((prev) => ({ ...prev, [skill.id]: now }));
    setEffectiveCooldowns((prev) => ({ ...prev, [skill.id]: effectiveCooldown }));
    setTimeout(() => setCooldowns((prev) => ({ ...prev, [skill.id]: false })), effectiveCooldown);
  }

  useBattleHotkeys({ result, availableSkills, useSkill, onExit, jobKeybinds });

  return (
    <div className={`battle-screen ${shake ? 'shake' : ''}`}>
      <div className="stage-badge">
        🗝️ 봉인된 던전 (경험치 없음)
        <span className="combat-power-badge">⚔️ 나의 전투력 {calculateCombatPower(player).toLocaleString()}</span>
      </div>

      <div className="arena">
        <canvas ref={canvasRef} className="arena-fx" />
        <div className="fighter-slot fighter-slot--player">
          <MonsterSprite speciesKey={getDisplaySpriteKey(player.speciesId, player.element, player.unlockedJobTier ?? 0)} size={110} alt={player.name} costumeKeys={equippedCostumes} />
          {(Date.now() < playerBuffs.hasteUntil || showHealFx) && (
            <div className="player-status-fx">
              {Date.now() < playerBuffs.hasteUntil && <span className="status-fx-icon status-fx-haste" title="쿨타임 감소 중">⚡</span>}
              {showHealFx && <span className="status-fx-icon status-fx-heal" title="회복!">💚</span>}
            </div>
          )}
        </div>
        {screenFlash && <div className="job-skill-flash" style={{ background: screenFlash }} />}
        <div className="fighter-slot fighter-slot--enemy">
          <span style={{ fontSize: 64 }}>{enemy.icon}</span>
        </div>
      </div>

      <div className="hud-row">
        <HpBar label={`${player.name} Lv.${player.level}`} hp={player.hp} maxHp={player.maxHp} color={ELEMENT_COLORS[player.element]} />
        <HpBar label={enemy.name} hp={enemy.hp} maxHp={enemy.maxHp} color="#c9a4ff" />
      </div>

      <BuffStatusRow buffs={playerBuffs} enemyStunnedUntil={enemyStunnedUntil} />

      <p className="battle-log">{log}</p>

      {result ? (
        <div className="result-panel">
          <p className="result-text">
            {result === 'win'
              ? (claiming ? '보상 반영 중...' : claimResult ? `🗝️ 파편 +${claimResult.fragmentsEarned} (누적 ${claimResult.totalFragments.toLocaleString()})` : '승리!')
              : '패배...'}
          </p>
          <div className="result-actions">
            <button className="btn btn-neutral" disabled={result === 'win' && claiming} onClick={onExit}>
              {result === 'win' && claiming ? '잠시만요...' : '던전 목록으로'} <span className="key-hint">Space</span>
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="skills-row">
          {availableSkills.map((skill, i) => {
            const jobTier = getJobSkillTier(skill.id);
            const hotkey = jobTier > 0
              ? getKeyForJobTier(jobKeybinds, jobTier).toUpperCase()
              : (i < 9 ? i + 1 : undefined);
            return (
            <SkillButton
              key={skill.id}
              skill={skill}
              displayCooldown={effectiveCooldowns[skill.id] ?? skill.cooldown}
              disabled={!!cooldowns[skill.id]}
              startedAt={cooldownStarts[skill.id]}
              onUse={useSkill}
              hotkey={hotkey}
            />
            );
          })}
        </div>
        <p className="keyboard-hint">숫자키 1~9로 스킬 사용, 전직스킬은 배정된 문자키(설정 &gt; 키보드 구성)</p>
        </>
      )}
    </div>
  );
}


