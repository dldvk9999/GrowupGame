import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import MonsterSprite from './MonsterSprite';
import SkillButton from './SkillButton';
import { getDisplaySpriteKey, getJobSkillTier, buildInitialJobSkillCooldowns } from '../lib/jobAdvancement';
import { applyExpGain, expToNextLevel } from '../lib/growth';
import { getAvailableSkills } from '../lib/jobAdvancement';
import { getStageEnemy, getIdleMonster, getChapterName } from '../lib/stages';
import { getStageFlavor } from '../lib/stageStory';
import { mitigateDamage, calculateCombatPower } from '../lib/combat';
import { bumpMission } from '../lib/missions';
import { maybePickIdleFlavor } from '../lib/idleFlavor';
import { playAttackSound, playHealSound, playBuffSound, playVictorySound, playLevelUpSound } from '../lib/audio';

const ELEMENT_COLORS = { fire: '#ff5a1f', water: '#3aa8e0', grass: '#5cb83c' };
const ENEMY_ATTACK_INTERVAL = 1900; // ms, 스테이지 도전 중 적 공격 텀 (난이도 재상향)
const IDLE_KILL_INTERVAL = 1500; // ms, 자동 사냥 처치 텀 (2배 상향)

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

/** 장비 보너스가 낀 상태에서 경험치를 적용하고, base(순수)/effective(장비포함) 둘 다 반환 */
function growPlayer(effectivePlayer, exp, equipmentBonus) {
  const b = equipmentBonus ?? { atk: 0, def: 0, hp: 0 };
  const base = {
    ...effectivePlayer,
    atk: effectivePlayer.atk - b.atk,
    def: effectivePlayer.def - b.def,
    maxHp: effectivePlayer.maxHp - b.hp,
  };
  const grownBase = applyExpGain(base, exp);
  const grownEffective = withEquipment(grownBase, equipmentBonus);
  return { grownBase, grownEffective };
}

/**
 * props
 * - initialMonster: growth.js 형태 몬스터 (장비 보너스 미포함 base 스탯)
 * - chapter, stage: 현재 스테이지 좌표
 * - equipmentBonus: { atk, def, hp }
 * - equippedSkills: 뽑기로 획득해 편성한 스킬 객체 배열 (skillCatalog.js의 resolveLoadout 결과)
 * - onClear(grownBaseMonster, goldReward): 스테이지 클리어 시 (DB 저장은 상위에서)
 * - onIdleGain(grownBaseMonster, goldReward): 자동 사냥으로 몬스터 처치 시
 * - onAdvance(): "다음 스테이지로" 버튼
 * - onGoStageList(): "스테이지 목록" 버튼
 */
export default function BattleScreen({
  initialMonster, chapter, stage, equipmentBonus, equippedSkills, equippedCostumes, relicBonus,
  onClear, onIdleGain, onAdvance, onGoStageList,
}) {
  const stageEnemyTemplate = useMemo(() => getStageEnemy(chapter, stage), [chapter, stage]);
  const flavor = useMemo(() => getStageFlavor(chapter, stage), [chapter, stage]);
  const availableSkills = useMemo(
    () => getAvailableSkills(equippedSkills ?? [], initialMonster.element, initialMonster.unlockedJobTier ?? 0),
    [equippedSkills, initialMonster.element, initialMonster.unlockedJobTier]
  );

  const [mode, setMode] = useState('idle'); // 'idle' | 'challenge'
  const [player, setPlayer] = useState(() => withEquipment(initialMonster, equipmentBonus));
  const [idleEnemy, setIdleEnemy] = useState(() => getIdleMonster(chapter, initialMonster.level));
  const [idleLog, setIdleLog] = useState('자동 사냥 중...');

  const [enemy, setEnemy] = useState(() => ({ ...stageEnemyTemplate }));
  const [cooldowns, setCooldowns] = useState({});
  const [cooldownStarts, setCooldownStarts] = useState({});
  const [effectiveCooldowns, setEffectiveCooldowns] = useState({});
  const [enemyStunnedUntil, setEnemyStunnedUntil] = useState(0);
  const [playerBuffs, setPlayerBuffs] = useState({ atkUntil: 0, atkMult: 1, defUntil: 0, defMult: 1, hasteUntil: 0, hasteReduction: 0 });
  const [log, setLog] = useState(flavor);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState(null);
  const [screenFlash, setScreenFlash] = useState(null); // 고티어 전직스킬용 화면 플래시 색상
  const [showHealFx, setShowHealFx] = useState(false); // 회복 스킬 사용 시 캐릭터 위 아이콘 표시

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const dimsRef = useRef({ w: 600, h: 220 });

  // 스테이지가 바뀌면 완전 초기화하고 자동 사냥부터 다시 시작
  useEffect(() => {
    setPlayer(withEquipment(initialMonster, equipmentBonus));
    setIdleEnemy(getIdleMonster(chapter, initialMonster.level));
    setMode('idle');
    setResult(null);
    setCooldowns({});
    setEnemyStunnedUntil(0);
    setPlayerBuffs({ atkUntil: 0, atkMult: 1, defUntil: 0, defMult: 1, hasteUntil: 0, hasteReduction: 0 });
    setLog(flavor);
  }, [chapter, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      dimsRef.current = { w: rect.width, h: rect.height };
    }
    resize();
    window.addEventListener('resize', resize);
    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 1;
        ctx.globalAlpha = Math.max(p.life / p.maxLife, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const spawnParticles = useCallback((xr, yr, color, count = 18, sizeMult = 1) => {
    const { w, h } = dimsRef.current;
    const x = w * xr, y = h * yr;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particlesRef.current.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        size: (2 + Math.random() * 3) * sizeMult, color, life: 30 + Math.random() * 20, maxLife: 50,
      });
    }
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 200);
  }, []);

  // ---------- 자동 사냥 루프 (챌린지 중이 아닐 때만) ----------
  useEffect(() => {
    if (mode !== 'idle') return;
    const timer = setInterval(() => {
      spawnParticles(0.75, 0.4, ELEMENT_COLORS[idleEnemy.element]);
      const bonusExp = Math.round(idleEnemy.expReward * (1 + (relicBonus?.pctExp ?? 0) / 100));
      const { grownBase, grownEffective } = growPlayer(player, bonusExp, equipmentBonus);
      setPlayer(grownEffective);
      const growthLog = grownBase.events.length ? ' ' + grownBase.events.join(' ') : '';
      const idleFlavorLine = maybePickIdleFlavor();
      setIdleLog(idleFlavorLine ?? `${idleEnemy.name} 처치! 경험치 +${bonusExp}, 골드 +${idleEnemy.goldReward}${growthLog}`);
      onIdleGain?.(grownBase, idleEnemy.goldReward);
      setIdleEnemy(getIdleMonster(chapter, grownBase.level));
    }, IDLE_KILL_INTERVAL);
    return () => clearInterval(timer);
  }, [mode, player, idleEnemy, chapter, equipmentBonus, relicBonus]); // eslint-disable-line react-hooks/exhaustive-deps

  const damageEnemy = useCallback((amount) => {
    setEnemy((prev) => ({ ...prev, hp: Math.max(prev.hp - amount, 0) }));
    spawnParticles(0.8, 0.35, ELEMENT_COLORS.fire);
    triggerShake();
  }, [spawnParticles, triggerShake]);

  const damagePlayer = useCallback((amount) => {
    setPlayer((prev) => ({ ...prev, hp: Math.max(prev.hp - amount, 0) }));
    spawnParticles(0.2, 0.7, ELEMENT_COLORS[player.element]);
    triggerShake();
  }, [spawnParticles, triggerShake, player.element]);

  function startChallenge() {
    setEnemy({ ...stageEnemyTemplate });
    setPlayer((prev) => ({ ...prev, hp: prev.maxHp })); // 도전 시작 시 풀피로
    setResult(null);
    // 전직 스킬은 강할수록(차수가 높을수록) 전투 시작 직후 바로 못 쏘게 초기 대기시간을 줌
    const initial = buildInitialJobSkillCooldowns(availableSkills);
    setCooldowns(initial.cooldowns);
    setCooldownStarts(initial.cooldownStarts);
    setEffectiveCooldowns((prev) => ({ ...prev, ...initial.effectiveCooldowns }));
    Object.entries(initial.effectiveCooldowns).forEach(([skillId, delay]) => {
      setTimeout(() => setCooldowns((prev) => ({ ...prev, [skillId]: false })), delay);
    });
    setEnemyStunnedUntil(0);
    setPlayerBuffs({ atkUntil: 0, atkMult: 1, defUntil: 0, defMult: 1, hasteUntil: 0, hasteReduction: 0 });
    setLog(flavor);
    setMode('challenge');
  }

  function backToIdle() {
    setMode('idle');
    setResult(null);
    setPlayer((prev) => ({ ...prev, hp: prev.maxHp }));
  }

  // 챌린지 전투 종료 체크
  useEffect(() => {
    if (mode !== 'challenge' || result) return;
    if (enemy.hp <= 0) {
      setResult('win');
      const { grownBase, grownEffective } = growPlayer(player, enemy.expReward, equipmentBonus);
      setPlayer(grownEffective);
      const growthLog = grownBase.events.length ? ' ' + grownBase.events.join(' ') : '';
      setLog(`${enemy.name} 처치! 경험치 +${enemy.expReward}, 골드 +${enemy.goldReward}${growthLog}`);
      playVictorySound();
      if (grownBase.events.some((e) => e.includes('레벨'))) {
        setTimeout(() => playLevelUpSound(), 300);
      }
      onClear?.(grownBase, enemy.goldReward);
    } else if (player.hp <= 0) {
      setResult('lose');
      setLog(`${player.name}가 쓰러졌다... 다시 도전해보세요!`);
    }
  }, [mode, enemy.hp, player.hp, result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'challenge' || result) return;
    const timer = setInterval(() => {
      if (Date.now() < enemyStunnedUntil) {
        setLog(`${enemy.name}은(는) 기절해서 움직이지 못한다!`);
        return;
      }
      setLog(`${enemy.name}의 공격!`);
      const defBuffActive = Date.now() < playerBuffs.defUntil;
      const effDef = player.def * (defBuffActive ? playerBuffs.defMult : 1);
      damagePlayer(mitigateDamage(enemy.atk, effDef));
    }, ENEMY_ATTACK_INTERVAL);
    return () => clearInterval(timer);
  }, [mode, enemy.atk, enemy.name, result, damagePlayer, player.def, enemyStunnedUntil, playerBuffs]);

  function useSkill(skill) {
    if (mode !== 'challenge' || result || cooldowns[skill.id]) return;
    const now = Date.now();
    const atkBuffActive = now < playerBuffs.atkUntil;
    const effAtk = player.atk * (atkBuffActive ? playerBuffs.atkMult : 1);

    const jobTier = getJobSkillTier(skill.id);
    if (skill.type === 'damage') {
      const dmg = mitigateDamage(effAtk * skill.multiplier, enemy.def);
      setLog(`${player.name}의 ${skill.name}!`);
      playAttackSound();
      damageEnemy(dmg);
      if (jobTier > 0) {
        // 전직(각성) 스킬일수록 이펙트가 더 크고 화려해짐
        const jobColors = ['#ffd24a', '#ff9a3c', '#ff5a5a', '#ff4ad9', '#c94aff'];
        spawnParticles(0.8, 0.35, jobColors[jobTier - 1], 22 + jobTier * 18, 1 + jobTier * 0.35);
        spawnParticles(0.5, 0.4, '#ffffff', 6 + jobTier * 6, 1 + jobTier * 0.2);
        if (jobTier >= 3) {
          setScreenFlash(jobColors[jobTier - 1]);
          setTimeout(() => setScreenFlash(null), 260 + jobTier * 40);
        }
      }
    } else if (skill.type === 'heal') {
      const healAmount = Math.round(player.maxHp * skill.multiplier);
      setPlayer((prev) => ({ ...prev, hp: Math.min(prev.hp + healAmount, prev.maxHp) }));
      setLog(`${player.name}의 ${skill.name}! 체력 +${healAmount}`);
      playHealSound();
      spawnParticles(0.2, 0.7, '#8fffb0');
      setShowHealFx(true);
      setTimeout(() => setShowHealFx(false), 1300);
    } else if (skill.type === 'stun') {
      const stunMs = Math.round(skill.multiplier * 1000);
      setEnemyStunnedUntil(now + stunMs);
      setLog(`${player.name}의 ${skill.name}! 적을 ${(stunMs / 1000).toFixed(1)}초간 기절시켰다!`);
      spawnParticles(0.8, 0.35, '#ffe680');
    } else if (skill.type === 'dot') {
      const perTick = mitigateDamage(effAtk * skill.multiplier, enemy.def);
      const ticks = skill.ticks ?? 4;
      const tickInterval = skill.tickInterval ?? 1500;
      setLog(`${player.name}의 ${skill.name}! 지속 피해 시작`);
      for (let t = 1; t <= ticks; t++) {
        setTimeout(() => damageEnemy(perTick), t * tickInterval);
      }
    } else if (skill.type === 'buff_atk') {
      const boosted = skill.multiplier * (1 + (relicBonus?.pctBuff ?? 0) / 100);
      setPlayerBuffs((prev) => ({ ...prev, atkUntil: now + skill.duration, atkMult: 1 + boosted }));
      setLog(`${player.name}의 ${skill.name}! 공격력이 상승했다!`);
      playBuffSound();
      spawnParticles(0.2, 0.7, '#ff8a4a');
    } else if (skill.type === 'buff_def') {
      const boosted = skill.multiplier * (1 + (relicBonus?.pctBuff ?? 0) / 100);
      setPlayerBuffs((prev) => ({ ...prev, defUntil: now + skill.duration, defMult: 1 + boosted }));
      setLog(`${player.name}의 ${skill.name}! 방어력이 상승했다!`);
      playBuffSound();
      spawnParticles(0.2, 0.7, '#4aa8ff');
    } else if (skill.type === 'haste') {
      const boosted = Math.min(0.95, skill.multiplier * (1 + (relicBonus?.pctBuff ?? 0) / 100));
      setPlayerBuffs((prev) => ({ ...prev, hasteUntil: now + skill.duration, hasteReduction: boosted }));
      // haste 버프는 "Date.now() < hasteUntil" 조건으로 화면에 표시되는데, React는 시간이
      // 지났다고 저절로 리렌더하지 않으므로, 버프가 실제로 끝나는 정확한 시점에 강제로
      // 리렌더를 유발해서(같은 값이라도 새 객체로 set) "⚡ 쿨타임 감소 중" 표시가
      // 정확한 타이밍에 사라지도록 함
      setTimeout(() => setPlayerBuffs((prev) => ({ ...prev })), skill.duration);
      setLog(`${player.name}의 ${skill.name}! 재사용 대기시간이 감소한다!`);
      playBuffSound();
      spawnParticles(0.2, 0.7, '#c9ff4a');
    }

    bumpMission('use_skills', 1);
    const hasteActive = now < playerBuffs.hasteUntil;
    const relicCooldownMult = 1 - Math.min(0.9, (relicBonus?.pctCooldown ?? 0) / 100);
    const effectiveCooldown = Math.round((hasteActive ? skill.cooldown * (1 - playerBuffs.hasteReduction) : skill.cooldown) * relicCooldownMult);
    setCooldowns((prev) => ({ ...prev, [skill.id]: true }));
    setCooldownStarts((prev) => ({ ...prev, [skill.id]: now }));
    setEffectiveCooldowns((prev) => ({ ...prev, [skill.id]: effectiveCooldown }));
    setTimeout(() => setCooldowns((prev) => ({ ...prev, [skill.id]: false })), effectiveCooldown);
  }

  const displayEnemy = mode === 'challenge' ? enemy : idleEnemy;
  const displayLog = mode === 'challenge' ? log : idleLog;

  // 키보드 단축키: 1~5 스킬 즉발, Space(상황별 진행), R(재도전)
  // 리스너는 1번만 등록하고, 최신 상태는 ref로 읽어서 클로저 문제 없이 처리
  const keyStateRef = useRef();
  keyStateRef.current = { mode, result, availableSkills, useSkill, startChallenge, onAdvance };

  useEffect(() => {
    function handleKeyDown(e) {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const { mode, result, availableSkills, useSkill, startChallenge, onAdvance } = keyStateRef.current;

      if (/^[1-9]$/.test(e.key)) {
        if (mode === 'challenge' && !result) {
          const skill = availableSkills[Number(e.key) - 1];
          if (skill) { e.preventDefault(); useSkill(skill); }
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (mode === 'idle') startChallenge();
        else if (mode === 'challenge' && result === 'win') onAdvance?.();
        else if (mode === 'challenge' && result === 'lose') startChallenge();
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        if (mode === 'challenge' && result === 'lose') {
          e.preventDefault();
          startChallenge();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`battle-screen ${shake ? 'shake' : ''}`}>
      <div className="stage-badge">
        {chapter}-{stage} · {getChapterName(chapter)}{stageEnemyTemplate.isBoss ? ' (보스)' : ''}
        {mode === 'idle' && <span className="idle-tag">자동 사냥 중</span>}
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
          <MonsterSprite speciesKey={displayEnemy.spriteKey} size={mode === 'challenge' ? 110 : 80} alt={displayEnemy.name} />
        </div>
      </div>

      <div className="hud-row">
        <HpBar
          label={`${player.name}${player.jobTitle ? ' · ' + player.jobTitle : ''} Lv.${player.level}`}
          hp={player.hp} maxHp={player.maxHp} color={ELEMENT_COLORS[player.element]}
        />
        <HpBar label={displayEnemy.name} hp={displayEnemy.hp} maxHp={displayEnemy.maxHp} color={ELEMENT_COLORS[displayEnemy.element]} />
      </div>

      <BuffStatusRow buffs={playerBuffs} enemyStunnedUntil={mode === 'challenge' ? enemyStunnedUntil : 0} />

      <ExpBar level={player.level} exp={player.exp} />

      <p className="battle-log">{displayLog}</p>

      {mode === 'idle' && (
        <div className="idle-panel">
          <p className="idle-hint">약한 필드 몬스터를 자동으로 잡으며 경험치를 조금씩 얻고 있어요.</p>
          <button className="btn btn-challenge" onClick={startChallenge}>
            ⚔️ {chapter}-{stage} 스테이지 도전하기 <span className="key-hint">Space</span>
          </button>
        </div>
      )}

      {mode === 'challenge' && !result && (
        <>
          <div className="skills-row">
            {availableSkills.map((skill, i) => (
              <SkillButton
                key={skill.id}
                skill={{ ...skill, cooldown: effectiveCooldowns[skill.id] ?? skill.cooldown }}
                disabled={!!cooldowns[skill.id]}
                startedAt={cooldownStarts[skill.id]}
                onUse={useSkill}
                hotkey={i < 9 ? i + 1 : undefined}
              />
            ))}
          </div>
          <p className="keyboard-hint">숫자키 1~5로 스킬 사용</p>
        </>
      )}

      {mode === 'challenge' && result === 'win' && (
        <div className="result-panel">
          <p className="result-text">승리!</p>
          <div className="result-actions">
            <button className="btn btn-challenge" onClick={onAdvance}>다음 스테이지로 <span className="key-hint">Space</span></button>
            <button className="btn btn-neutral" onClick={onGoStageList}>스테이지 목록</button>
            <button className="btn btn-ghost" onClick={backToIdle}>사냥터로</button>
          </div>
        </div>
      )}

      {mode === 'challenge' && result === 'lose' && (
        <div className="result-panel">
          <p className="result-text">패배...</p>
          <div className="result-actions">
            <button className="btn btn-challenge" onClick={startChallenge}>다시 도전 <span className="key-hint">Space / R</span></button>
            <button className="btn btn-ghost" onClick={backToIdle}>사냥터로</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BuffStatusRow({ buffs, enemyStunnedUntil }) {
  const now = Date.now();
  const tags = [];
  if (buffs.atkUntil > now) tags.push({ key: 'atk', label: '⚔️ 공격력 상승', cls: 'buff-atk' });
  if (buffs.defUntil > now) tags.push({ key: 'def', label: '🛡️ 방어력 상승', cls: 'buff-def' });
  if (enemyStunnedUntil > now) tags.push({ key: 'stun', label: '💫 적 기절중', cls: 'buff-stun' });
  if (tags.length === 0) return null;
  return (
    <div className="buff-status-row">
      {tags.map((t) => (
        <span key={t.key} className={`buff-tag ${t.cls}`}>{t.label}</span>
      ))}
    </div>
  );
}

function ExpBar({ level, exp }) {
  const need = expToNextLevel(level);
  const pct = Math.min((exp / need) * 100, 100);
  return (
    <div className="exp-bar-wrap">
      <div className="exp-label">Lv.{level} 경험치 ({exp}/{need})</div>
      <div className="bar-track exp-track"><div className="bar-fill exp-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function HpBar({ label, hp, maxHp, color }) {
  const pct = Math.max((hp / maxHp) * 100, 0);
  return (
    <div className="hp-bar">
      <div className="hp-label">{label} ({Math.ceil(hp)}/{maxHp})</div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}
