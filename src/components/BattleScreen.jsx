import { useEffect, useRef, useState, useCallback } from 'react';
import MonsterSprite from './MonsterSprite';
import { applyExpGain, expToNextLevel } from '../lib/growth';
import { SKILLS } from '../lib/skills';

const ELEMENT_COLORS = {
  fire: '#ff5a1f',
  water: '#3aa8e0',
  grass: '#5cb83c',
};

// 난이도 하향: 보스 체력/공격력 낮추고 공격 텀도 늘림 (초반 진입장벽 완화)
function makeBoss() {
  return {
    name: '꼬마 파이어킹',
    element: 'fire',
    spriteKey: 'fire_1',
    maxHp: 70,
    hp: 70,
    atk: 5,
  };
}
const ENEMY_ATTACK_INTERVAL = 2400; // ms, 여유 있게 반격 텀 확보

/**
 * props
 * - initialMonster: growth.js 형태의 몬스터 객체 (필수)
 * - onWin(grownMonster): 승리 시 최종 성장 결과 전달 (DB 저장 지점)
 */
export default function BattleScreen({ initialMonster, onWin }) {
  const [player, setPlayer] = useState(initialMonster);
  const [enemy, setEnemy] = useState(() => makeBoss());
  const [cooldowns, setCooldowns] = useState({});
  const [log, setLog] = useState(`${initialMonster.name}(와)과 함께 모험을 시작합니다!`);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState(null);

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const dimsRef = useRef({ w: 600, h: 220 });

  useEffect(() => {
    setPlayer(initialMonster);
  }, [initialMonster]);

  // 캔버스 파티클 애니메이션 루프 (반응형 크기 대응)
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
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 1;
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
    const x = w * xr;
    const y = h * yr;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 2 + Math.random() * 3,
        color,
        life: 30 + Math.random() * 20,
        maxLife: 50,
      });
    }
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 200);
  }, []);

  const damageEnemy = useCallback(
    (amount) => {
      setEnemy((prev) => ({ ...prev, hp: Math.max(prev.hp - amount, 0) }));
      spawnParticles(0.8, 0.35, ELEMENT_COLORS.fire);
      triggerShake();
    },
    [spawnParticles, triggerShake]
  );

  const damagePlayer = useCallback(
    (amount) => {
      setPlayer((prev) => ({ ...prev, hp: Math.max(prev.hp - amount, 0) }));
      spawnParticles(0.2, 0.7, ELEMENT_COLORS[player.element]);
      triggerShake();
    },
    [spawnParticles, triggerShake, player.element]
  );

  // 전투 종료 체크
  useEffect(() => {
    if (result) return;
    if (enemy.hp <= 0) {
      setResult('win');
      const expReward = Math.round(enemy.maxHp * 0.9);
      const grown = applyExpGain(player, expReward);
      setPlayer(grown);
      const growthLog = grown.events.length ? ' ' + grown.events.join(' ') : '';
      setLog(`${enemy.name} 처치! 경험치 +${expReward}${growthLog}`);
      onWin?.(grown);
    } else if (player.hp <= 0) {
      setResult('lose');
      setLog(`${player.name}가 쓰러졌다... 다시 도전해보세요!`);
    }
  }, [enemy.hp, player.hp, result]);

  // 적 자동 공격
  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => {
      setLog(`${enemy.name}의 공격!`);
      damagePlayer(enemy.atk);
    }, ENEMY_ATTACK_INTERVAL);
    return () => clearInterval(timer);
  }, [enemy.atk, enemy.name, result, damagePlayer]);

  function useSkill(skill) {
    if (result || cooldowns[skill.id]) return;

    if (skill.type === 'damage') {
      const dmg = Math.round(player.atk * skill.multiplier);
      setLog(`${player.name}의 ${skill.name}!`);
      damageEnemy(dmg);
    } else if (skill.type === 'heal') {
      const healAmount = Math.round(player.maxHp * skill.multiplier);
      setPlayer((prev) => ({ ...prev, hp: Math.min(prev.hp + healAmount, prev.maxHp) }));
      setLog(`${player.name}의 ${skill.name}! 체력 +${healAmount}`);
      spawnParticles(0.2, 0.7, '#8fffb0');
    }

    setCooldowns((prev) => ({ ...prev, [skill.id]: true }));
    setTimeout(() => {
      setCooldowns((prev) => ({ ...prev, [skill.id]: false }));
    }, skill.cooldown);
  }

  function handleRestart() {
    setEnemy(makeBoss());
    setResult(null);
    setCooldowns({});
    setLog('다음 상대 등장!');
    setPlayer((prev) => ({ ...prev, hp: prev.maxHp }));
  }

  return (
    <div className={`battle-screen ${shake ? 'shake' : ''}`}>
      <div className="arena">
        <canvas ref={canvasRef} className="arena-fx" />
        <div className="fighter-slot fighter-slot--player">
          <MonsterSprite speciesKey={player.speciesId} size={110} alt={player.name} />
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
          <button onClick={handleRestart} className="btn btn-neutral">
            {result === 'win' ? '다음 상대 도전' : '다시 도전'}
          </button>
        </div>
      ) : (
        <div className="skills-row">
          {SKILLS.map((skill) => (
            <button
              key={skill.id}
              className={`skill-btn ${cooldowns[skill.id] ? 'on-cooldown' : ''} ${skill.type === 'heal' ? 'skill-heal' : ''}`}
              onClick={() => useSkill(skill)}
              disabled={!!cooldowns[skill.id]}
              title={skill.description}
            >
              <span className="skill-icon">{skill.icon}</span>
              <span className="skill-name">{skill.name}</span>
            </button>
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
      <div className="bar-track exp-track">
        <div className="bar-fill exp-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HpBar({ label, hp, maxHp, color }) {
  const pct = Math.max((hp / maxHp) * 100, 0);
  return (
    <div className="hp-bar">
      <div className="hp-label">{label} ({Math.ceil(hp)}/{maxHp})</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
