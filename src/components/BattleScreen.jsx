import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import MonsterSprite from './MonsterSprite';
import SkillButton from './SkillButton';
import { getDisplaySpriteKey } from '../lib/jobAdvancement';
import { applyExpGain, expToNextLevel } from '../lib/growth';
import { getAvailableSkills } from '../lib/jobAdvancement';
import { getStageEnemy, getIdleMonster, getChapterName } from '../lib/stages';
import { getStageFlavor } from '../lib/stageStory';
import { mitigateDamage, calculateCombatPower } from '../lib/combat';

const ELEMENT_COLORS = { fire: '#ff5a1f', water: '#3aa8e0', grass: '#5cb83c' };
const ENEMY_ATTACK_INTERVAL = 1900; // ms, 스테이지 도전 중 적 공격 텀 (난이도 재상향)
const IDLE_KILL_INTERVAL = 3000; // ms, 자동 사냥 처치 텀

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
  initialMonster, chapter, stage, equipmentBonus, equippedSkills,
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
  const [log, setLog] = useState(flavor);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState(null);

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

  const spawnParticles = useCallback((xr, yr, color, count = 18) => {
    const { w, h } = dimsRef.current;
    const x = w * xr, y = h * yr;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particlesRef.current.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        size: 2 + Math.random() * 3, color, life: 30 + Math.random() * 20, maxLife: 50,
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
      const { grownBase, grownEffective } = growPlayer(player, idleEnemy.expReward, equipmentBonus);
      setPlayer(grownEffective);
      const growthLog = grownBase.events.length ? ' ' + grownBase.events.join(' ') : '';
      setIdleLog(`${idleEnemy.name} 처치! 경험치 +${idleEnemy.expReward}, 골드 +${idleEnemy.goldReward}${growthLog}`);
      onIdleGain?.(grownBase, idleEnemy.goldReward);
      setIdleEnemy(getIdleMonster(chapter, grownBase.level));
    }, IDLE_KILL_INTERVAL);
    return () => clearInterval(timer);
  }, [mode, player, idleEnemy, chapter, equipmentBonus]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setCooldowns({});
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
      onClear?.(grownBase, enemy.goldReward);
    } else if (player.hp <= 0) {
      setResult('lose');
      setLog(`${player.name}가 쓰러졌다... 다시 도전해보세요!`);
    }
  }, [mode, enemy.hp, player.hp, result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'challenge' || result) return;
    const timer = setInterval(() => {
      setLog(`${enemy.name}의 공격!`);
      damagePlayer(mitigateDamage(enemy.atk, player.def));
    }, ENEMY_ATTACK_INTERVAL);
    return () => clearInterval(timer);
  }, [mode, enemy.atk, enemy.name, result, damagePlayer, player.def]);

  function useSkill(skill) {
    if (mode !== 'challenge' || result || cooldowns[skill.id]) return;
    if (skill.type === 'damage') {
      const dmg = mitigateDamage(player.atk * skill.multiplier, enemy.def);
      setLog(`${player.name}의 ${skill.name}!`);
      damageEnemy(dmg);
    } else if (skill.type === 'heal') {
      const healAmount = Math.round(player.maxHp * skill.multiplier);
      setPlayer((prev) => ({ ...prev, hp: Math.min(prev.hp + healAmount, prev.maxHp) }));
      setLog(`${player.name}의 ${skill.name}! 체력 +${healAmount}`);
      spawnParticles(0.2, 0.7, '#8fffb0');
    }
    setCooldowns((prev) => ({ ...prev, [skill.id]: true }));
    setCooldownStarts((prev) => ({ ...prev, [skill.id]: Date.now() }));
    setTimeout(() => setCooldowns((prev) => ({ ...prev, [skill.id]: false })), skill.cooldown);
  }

  const displayEnemy = mode === 'challenge' ? enemy : idleEnemy;
  const displayLog = mode === 'challenge' ? log : idleLog;

  return (
    <div className={`battle-screen ${shake ? 'shake' : ''}`}>
      <div className="stage-badge">
        {chapter}-{stage} · {getChapterName(chapter)}{stageEnemyTemplate.isBoss ? ' (보스)' : ''}
        {mode === 'idle' && <span className="idle-tag">자동 사냥 중</span>}
        <span className="combat-power-badge">⚔️ 전투력 {calculateCombatPower(player).toLocaleString()}</span>
      </div>

      <div className="arena">
        <canvas ref={canvasRef} className="arena-fx" />
        <div className="fighter-slot fighter-slot--player">
          <MonsterSprite speciesKey={getDisplaySpriteKey(player.speciesId, player.element, player.unlockedJobTier ?? 0)} size={110} alt={player.name} />
        </div>
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

      <ExpBar level={player.level} exp={player.exp} />

      <p className="battle-log">{displayLog}</p>

      {mode === 'idle' && (
        <div className="idle-panel">
          <p className="idle-hint">약한 필드 몬스터를 자동으로 잡으며 경험치를 조금씩 얻고 있어요.</p>
          <button className="btn btn-challenge" onClick={startChallenge}>
            ⚔️ {chapter}-{stage} 스테이지 도전하기
          </button>
        </div>
      )}

      {mode === 'challenge' && !result && (
        <div className="skills-row">
          {availableSkills.map((skill) => (
            <SkillButton
              key={skill.id}
              skill={skill}
              disabled={!!cooldowns[skill.id]}
              startedAt={cooldownStarts[skill.id]}
              onUse={useSkill}
            />
          ))}
        </div>
      )}

      {mode === 'challenge' && result === 'win' && (
        <div className="result-panel">
          <p className="result-text">승리!</p>
          <div className="result-actions">
            <button className="btn btn-challenge" onClick={onAdvance}>다음 스테이지로</button>
            <button className="btn btn-neutral" onClick={onGoStageList}>스테이지 목록</button>
            <button className="btn btn-ghost" onClick={backToIdle}>사냥터로</button>
          </div>
        </div>
      )}

      {mode === 'challenge' && result === 'lose' && (
        <div className="result-panel">
          <p className="result-text">패배...</p>
          <div className="result-actions">
            <button className="btn btn-challenge" onClick={startChallenge}>다시 도전</button>
            <button className="btn btn-ghost" onClick={backToIdle}>사냥터로</button>
          </div>
        </div>
      )}
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
