import { useEffect, useRef, useState, useCallback } from 'react';
import MonsterSprite from './MonsterSprite';
import SkillButton from './SkillButton';
import { getDisplaySpriteKey, getAvailableSkills } from '../lib/jobAdvancement';
import { applyExpGain, expToNextLevel } from '../lib/growth';
import { mitigateDamage } from '../lib/combat';

const ELEMENT_COLORS = { fire: '#ff5a1f', water: '#3aa8e0', grass: '#5cb83c' };
const ENEMY_ATTACK_INTERVAL = 1900;

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
 * - initialMonster, equipmentBonus, equippedSkills: BattleScreen과 동일
 * - dungeonEnemy: dungeonStages.js의 getDungeonStage() 결과
 * - onClear(grownBaseMonster, goldReward)
 * - onExit(): 던전 목록으로 돌아가기
 */
export default function DungeonBattle({ initialMonster, equipmentBonus, equippedSkills, dungeonEnemy, onClear, onExit }) {
  const availableSkills = getAvailableSkills(equippedSkills ?? [], initialMonster.element, initialMonster.unlockedJobTier ?? 0);
  const [player, setPlayer] = useState(() => withEquipment(initialMonster, equipmentBonus));
  const [enemy, setEnemy] = useState(() => ({ ...dungeonEnemy }));
  const [cooldowns, setCooldowns] = useState({});
  const [cooldownStarts, setCooldownStarts] = useState({});
  const [log, setLog] = useState(`${dungeonEnemy.name} 등장!`);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState(null);

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const dimsRef = useRef({ w: 600, h: 220 });

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
      const grownBase = applyExpGain(base, dungeonEnemy.expReward);
      setPlayer(withEquipment(grownBase, equipmentBonus));
      const growthLog = grownBase.events.length ? ' ' + grownBase.events.join(' ') : '';
      setLog(`${enemy.name} 처치! 경험치 +${dungeonEnemy.expReward}, 골드 +${dungeonEnemy.goldReward}${growthLog}`);
      onClear?.(grownBase, dungeonEnemy.goldReward);
    } else if (player.hp <= 0) {
      setResult('lose');
      setLog(`${player.name}가 쓰러졌다... 오늘 입장 횟수가 차감됐어요.`);
    }
  }, [enemy.hp, player.hp, result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => {
      setLog(`${enemy.name}의 공격!`);
      damagePlayer(mitigateDamage(enemy.atk, player.def));
    }, ENEMY_ATTACK_INTERVAL);
    return () => clearInterval(timer);
  }, [enemy.atk, enemy.name, result, damagePlayer, player.def]);

  function useSkill(skill) {
    if (result || cooldowns[skill.id]) return;
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

  return (
    <div className={`battle-screen ${shake ? 'shake' : ''}`}>
      <div className="stage-badge">{dungeonEnemy.dungeonType === 'exp' ? '경험치 던전' : '골드 던전'} · {dungeonEnemy.stage}층</div>

      <div className="arena">
        <canvas ref={canvasRef} className="arena-fx" />
        <div className="fighter-slot fighter-slot--player">
          <MonsterSprite speciesKey={getDisplaySpriteKey(player.speciesId, player.element, player.unlockedJobTier ?? 0)} size={110} alt={player.name} />
        </div>
        <div className="fighter-slot fighter-slot--enemy">
          <MonsterSprite speciesKey={enemy.spriteKey} size={110} alt={enemy.name} />
        </div>
      </div>

      <div className="hud-row">
        <HpBar label={`${player.name} Lv.${player.level}`} hp={player.hp} maxHp={player.maxHp} color={ELEMENT_COLORS[player.element]} />
        <HpBar label={enemy.name} hp={enemy.hp} maxHp={enemy.maxHp} color={ELEMENT_COLORS[enemy.element]} />
      </div>

      <ExpBar level={player.level} exp={player.exp} />

      <p className="battle-log">{log}</p>

      {result ? (
        <div className="result-panel">
          <p className="result-text">{result === 'win' ? '승리!' : '패배...'}</p>
          <div className="result-actions">
            <button className="btn btn-neutral" onClick={onExit}>던전 목록으로</button>
          </div>
        </div>
      ) : (
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
