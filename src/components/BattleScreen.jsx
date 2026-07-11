import { useEffect, useRef, useState, useCallback } from 'react';
import MonsterSprite from './MonsterSprite';

const ELEMENT_COLORS = {
  fire: '#ff5a1f',
  water: '#3aa8e0',
  grass: '#5cb83c',
};

const ATTACK_COOLDOWN = 700; // ms
const SKILL_COOLDOWN = 3000; // ms
const ENEMY_ATTACK_INTERVAL = 1600; // ms

function makeFighter({ name, element, maxHp, atk, spriteKey }) {
  return { name, element, maxHp, hp: maxHp, atk, spriteKey };
}

export default function BattleScreen() {
  const [player, setPlayer] = useState(() =>
    makeFighter({ name: '이모탄', element: 'fire', maxHp: 120, atk: 14, spriteKey: 'fire_1' })
  );
  const [enemy, setEnemy] = useState(() =>
    makeFighter({ name: '파이어킹', element: 'fire', maxHp: 200, atk: 10, spriteKey: 'fire_1' })
  );
  const [attackReady, setAttackReady] = useState(true);
  const [skillReady, setSkillReady] = useState(true);
  const [log, setLog] = useState('전투 시작!');
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState(null); // 'win' | 'lose' | null

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);

  // 캔버스 파티클 애니메이션 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // 중력
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
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const spawnParticles = useCallback((x, y, color, count = 18) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particlesRef.current.push({
        x,
        y,
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

  const dealDamage = useCallback(
    (target, amount, side) => {
      const setTarget = side === 'enemy' ? setEnemy : setPlayer;
      setTarget((prev) => {
        const nextHp = Math.max(prev.hp - amount, 0);
        return { ...prev, hp: nextHp };
      });

      const x = side === 'enemy' ? 480 : 120;
      const y = 100;
      spawnParticles(x, y, ELEMENT_COLORS[target.element] || '#ffffff');
      triggerShake();
    },
    [spawnParticles, triggerShake]
  );

  // 전투 종료 체크
  useEffect(() => {
    if (result) return;
    if (enemy.hp <= 0) {
      setResult('win');
      setLog(`${enemy.name} 처치! 보스 획득!`);
    } else if (player.hp <= 0) {
      setResult('lose');
      setLog(`${player.name}가 쓰러졌다...`);
    }
  }, [enemy.hp, player.hp, result]);

  // 적 AI 자동 공격
  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => {
      setLog(`${enemy.name}의 공격!`);
      dealDamage(player, enemy.atk, 'player');
    }, ENEMY_ATTACK_INTERVAL);
    return () => clearInterval(timer);
  }, [enemy.atk, enemy.name, player, result, dealDamage]);

  function handleAttack() {
    if (!attackReady || result) return;
    setAttackReady(false);
    setLog(`${player.name}의 공격!`);
    dealDamage(enemy, player.atk, 'enemy');
    setTimeout(() => setAttackReady(true), ATTACK_COOLDOWN);
  }

  function handleSkill() {
    if (!skillReady || result) return;
    setSkillReady(false);
    const skillDamage = player.atk * 2.2;
    setLog(`${player.name}의 스킬 작렬!`);
    dealDamage(enemy, skillDamage, 'enemy');
    setTimeout(() => setSkillReady(true), SKILL_COOLDOWN);
  }

  function handleRestart() {
    setPlayer(makeFighter({ name: '이모탄', element: 'fire', maxHp: 120, atk: 14, spriteKey: 'fire_1' }));
    setEnemy(makeFighter({ name: '파이어킹', element: 'fire', maxHp: 200, atk: 10, spriteKey: 'fire_1' }));
    setResult(null);
    setLog('전투 시작!');
  }

  return (
    <div
      style={{
        position: 'relative',
        maxWidth: 600,
        margin: '0 auto',
        fontFamily: 'sans-serif',
        transform: shake ? 'translate(3px, -2px)' : 'none',
        transition: 'transform 0.05s',
      }}
    >
      <div style={{ position: 'relative', height: 220, background: '#1a1a2e', borderRadius: 12, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={220}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        />

        <FighterBadge fighter={player} x={40} y={140} />
        <FighterBadge fighter={enemy} x={400} y={40} flip />
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
        <HpBar label={player.name} hp={player.hp} maxHp={player.maxHp} color={ELEMENT_COLORS[player.element]} />
        <HpBar label={enemy.name} hp={enemy.hp} maxHp={enemy.maxHp} color={ELEMENT_COLORS[enemy.element]} />
      </div>

      <p style={{ minHeight: 24, color: '#333' }}>{log}</p>

      {result ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>
            {result === 'win' ? '승리!' : '패배...'}
          </p>
          <button onClick={handleRestart} style={buttonStyle('#555')}>
            다시 도전
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleAttack} disabled={!attackReady} style={buttonStyle(ELEMENT_COLORS.fire, !attackReady)}>
            공격 {attackReady ? '' : '(쿨타임)'}
          </button>
          <button onClick={handleSkill} disabled={!skillReady} style={buttonStyle('#c04ec2', !skillReady)}>
            스킬 {skillReady ? '' : '(쿨타임)'}
          </button>
        </div>
      )}
    </div>
  );
}

function FighterBadge({ fighter, x, y, flip }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 90,
        height: 90,
        transform: flip ? 'scaleX(-1)' : 'none',
      }}
    >
      <MonsterSprite speciesKey={fighter.spriteKey} size={90} alt={fighter.name} />
    </div>
  );
}

function HpBar({ label, hp, maxHp, color }) {
  const pct = Math.max((hp / maxHp) * 100, 0);
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        {label} ({Math.ceil(hp)}/{maxHp})
      </div>
      <div style={{ height: 10, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            transition: 'width 0.2s ease-out',
          }}
        />
      </div>
    </div>
  );
}

function buttonStyle(color, disabled) {
  return {
    flex: 1,
    padding: '12px 0',
    border: 'none',
    borderRadius: 8,
    background: disabled ? '#ccc' : color,
    color: '#fff',
    fontWeight: 600,
    fontSize: 15,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
