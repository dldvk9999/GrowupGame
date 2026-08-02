import { useEffect, useState, useCallback } from 'react';
import MonsterSprite from './MonsterSprite';
import SkillButton from './SkillButton';
import { getDisplaySpriteKey, getAvailableSkills, getJobSkillTier, buildInitialJobSkillCooldowns } from '../lib/jobAdvancement';
import { applyExpGain, expToNextLevel } from '../lib/growth';
import { mitigateDamage, calculateCombatPower } from '../lib/combat';
import { getElementMultiplier, ELEMENT_COLORS } from '../lib/elements';
import { bumpMission } from '../lib/missions';
import { playAttackSound, playHealSound, playBuffSound, playVictorySound } from '../lib/audio';
import { getJobSkillKeybinds, getKeyForJobTier } from '../lib/keybinds';
import { getEnhancedJobSkillMultiplier } from '../lib/jobSkillEnhance';
import { useBattleFx } from '../hooks/useBattleFx';
import { useBattleHotkeys } from '../hooks/useBattleHotkeys';
import HpBar from './atoms/HpBar';
import ExpBar from './atoms/ExpBar';
import BuffStatusRow from './molecules/BuffStatusRow';

const ENEMY_ATTACK_INTERVAL = 1600;

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
 * - initialMonster, equipmentBonus, equippedSkills, jobSkillEnhancements
 * - eliteBoss: eliteTrial.js의 getEliteTrialBoss() 결과
 * - onWin(grownBaseMonster): 승리 시 (경험치는 여기서 이미 반영, 저장은 상위에서 처리)
 * - onExit()
 */
export default function EliteTrialBattle({ initialMonster, equipmentBonus, equippedSkills, equippedCostumes, jobSkillEnhancements, eliteBoss, onWin, onExit }) {
  const availableSkills = getAvailableSkills(equippedSkills ?? [], initialMonster.element, initialMonster.unlockedJobTier ?? 0);
  const [player, setPlayer] = useState(() => withEquipment(initialMonster, equipmentBonus));
  const [enemy, setEnemy] = useState(() => ({ ...eliteBoss }));
  const [initialJobCooldowns] = useState(() => buildInitialJobSkillCooldowns(availableSkills));
  const [cooldowns, setCooldowns] = useState(() => initialJobCooldowns.cooldowns);
  const [cooldownStarts, setCooldownStarts] = useState(() => initialJobCooldowns.cooldownStarts);
  const [effectiveCooldowns, setEffectiveCooldowns] = useState(() => initialJobCooldowns.effectiveCooldowns);

  useEffect(() => {
    const timers = Object.entries(initialJobCooldowns.effectiveCooldowns).map(([skillId, delay]) =>
      setTimeout(() => setCooldowns((prev) => ({ ...prev, [skillId]: false })), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [enemyStunnedUntil, setEnemyStunnedUntil] = useState(0);
  const [playerBuffs, setPlayerBuffs] = useState({ atkUntil: 0, atkMult: 1, defUntil: 0, defMult: 1, hasteUntil: 0, hasteReduction: 0 });
  const [log, setLog] = useState(`${eliteBoss.name} 등장! 승리하면 정예 경험치를 얻어요.`);
  const [result, setResult] = useState(null);
  const [jobKeybinds] = useState(() => getJobSkillKeybinds());
  const [screenFlash, setScreenFlash] = useState(null);
  const [showHealFx, setShowHealFx] = useState(false);

  const { canvasRef, shake, spawnParticles, triggerShake } = useBattleFx();

  const damageEnemy = useCallback((amount) => {
    setEnemy((prev) => ({ ...prev, hp: Math.max(prev.hp - amount, 0) }));
    spawnParticles(0.8, 0.35, '#ff4d6d');
    triggerShake();
  }, [spawnParticles, triggerShake]);

  const damagePlayer = useCallback((amount) => {
    setPlayer((prev) => ({ ...prev, hp: Math.max(prev.hp - amount, 0) }));
    spawnParticles(0.2, 0.7, ELEMENT_COLORS[player.element]);
    triggerShake();
  }, [spawnParticles, triggerShake, player.element]);

  useEffect(() => {
    if (result) return;
    if (enemy.hp <= 0) {
      setResult('win');
      const base = {
        ...player,
        atk: player.atk - (equipmentBonus?.atk ?? 0),
        def: player.def - (equipmentBonus?.def ?? 0),
        maxHp: player.maxHp - (equipmentBonus?.hp ?? 0),
      };
      const grownBase = applyExpGain(base, eliteBoss.expReward);
      setPlayer(withEquipment(grownBase, equipmentBonus));
      setLog(`${enemy.name} 처치! 정예 경험치 획득!`);
      playVictorySound();
      onWin?.(grownBase);
    } else if (player.hp <= 0) {
      setResult('lose');
      setLog(`${player.name}가 쓰러졌다... 다시 도전해보세요.`);
    }
  }, [enemy.hp, player.hp, result]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // 전직스킬 강화 반영(신규, 사용자 요청) - 일반 스킬은 배율 그대로, 전직스킬만 강화레벨만큼 배율 보정
    const effMultiplier = getEnhancedJobSkillMultiplier(skill, jobSkillEnhancements);

    const jobTier = getJobSkillTier(skill.id);
    if (skill.type === 'damage') {
      const dmg = mitigateDamage(effAtk * effMultiplier, enemy.def, getElementMultiplier(skill.element, enemy.element));
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
      const perTick = mitigateDamage(effAtk * effMultiplier, enemy.def, getElementMultiplier(skill.element, enemy.element));
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
        💠 정예의 시련
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
        <HpBar label={enemy.name} hp={enemy.hp} maxHp={enemy.maxHp} color="#ff4d6d" />
      </div>

      <BuffStatusRow buffs={playerBuffs} enemyStunnedUntil={enemyStunnedUntil} />

      <ExpBar level={player.level} exp={player.exp} />

      <p className="battle-log">{log}</p>

      {result ? (
        <div className="result-panel">
          <p className="result-text">{result === 'win' ? '승리! 💠' : '패배...'}</p>
          <div className="result-actions">
            <button className="btn btn-neutral" onClick={onExit}>
              {result === 'win' ? '확인' : '던전 목록으로'} <span className="key-hint">Space</span>
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



