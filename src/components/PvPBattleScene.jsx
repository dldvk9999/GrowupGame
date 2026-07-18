import { useEffect, useState, useRef, useCallback } from 'react';
import MonsterSprite from './MonsterSprite';
import { playAttackSound, playVictorySound, playErrorSound } from '../lib/audio';

const ROUNDS = 6;
const ROUND_INTERVAL = 450; // ms

const HIT_LOGS = [
  '강렬한 일격이 꽂혔다!',
  '연속 공격이 몰아친다!',
  '치명적인 타격!',
  '방어를 뚫고 들어갔다!',
  '큰 충격파가 터졌다!',
  '숨 돌릴 틈 없이 몰아붙인다!',
];

const PROJECTILE_COLORS = ['#ffcf4a', '#ff5a5a', '#4ad9ff', '#c94aff', '#8fffb0'];

/**
 * props
 * - battle: startPvpBattle()의 결과 { result, opponent_name, opponent_is_real, my_power, opponent_power, reward }
 * - mySpeciesKey: 내 캐릭터 스프라이트 키
 * - onFinish(): 연출이 끝나면 호출 (결과 패널 표시 트리거)
 */
export default function PvPBattleScene({ battle, mySpeciesKey, equippedCostumes, onFinish }) {
  const [myHp, setMyHp] = useState(100);
  const [oppHp, setOppHp] = useState(100);
  const [shake, setShake] = useState(false);
  const [screenFlash, setScreenFlash] = useState(null);
  const [log, setLog] = useState('전투 개시!');
  const finishedRef = useRef(false);

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const projectilesRef = useRef([]);
  const rafRef = useRef(null);
  const dimsRef = useRef({ w: 600, h: 220 });

  const spawnParticles = useCallback((xr, yr, color, count = 24, sizeMult = 1) => {
    const { w, h } = dimsRef.current;
    const x = w * xr, y = h * yr;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      particlesRef.current.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        size: (2.5 + Math.random() * 4) * sizeMult, color, life: 26 + Math.random() * 18, maxLife: 44,
      });
    }
  }, []);

  // 한쪽 캐릭터 위치에서 다른쪽으로 날아가는 투사체 - 도착하면 그 자리에서 폭발 파티클을 터뜨림
  const spawnProjectile = useCallback((fromXr, fromYr, toXr, toYr, color, size = 6) => {
    const { w, h } = dimsRef.current;
    projectilesRef.current.push({
      x: w * fromXr, y: h * fromYr,
      tx: w * toXr, ty: h * toYr,
      sx: w * fromXr, sy: h * fromYr,
      color, size, t: 0, duration: 10 + Math.random() * 6,
    });
  }, []);

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

      // 투사체 갱신 - 목표까지 도달하면 그 자리에서 작은 폭발을 만들고 소멸
      const stillFlying = [];
      for (const pr of projectilesRef.current) {
        pr.t += 1;
        const progress = Math.min(1, pr.t / pr.duration);
        const arcLift = Math.sin(progress * Math.PI) * 22; // 포물선처럼 살짝 떠서 날아감
        pr.x = pr.sx + (pr.tx - pr.sx) * progress;
        pr.y = pr.sy + (pr.ty - pr.sy) * progress - arcLift;

        // 꼬리(트레일) 그리기
        ctx.strokeStyle = pr.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = pr.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(pr.x - (pr.tx - pr.sx) * 0.06, pr.y - (pr.ty - pr.sy) * 0.06 + arcLift * 0.1);
        ctx.lineTo(pr.x, pr.y);
        ctx.stroke();

        // 머리(광구) 그리기
        ctx.globalAlpha = 1;
        ctx.fillStyle = pr.color;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.size * 2, 0, Math.PI * 2);
        ctx.fill();

        if (progress >= 1) {
          for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            particlesRef.current.push({
              x: pr.tx, y: pr.ty, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
              size: 2 + Math.random() * 3, color: pr.color, life: 18 + Math.random() * 10, maxLife: 28,
            });
          }
        } else {
          stillFlying.push(pr);
        }
      }
      projectilesRef.current = stillFlying;
      ctx.globalAlpha = 1;

      // 파티클 갱신
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 1;
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

  useEffect(() => {
    const iWin = battle.result === 'win';
    let round = 0;
    const timer = setInterval(() => {
      round += 1;
      const progress = round / ROUNDS;
      const loserFloor = 0;
      const winnerFloor = 30 + Math.random() * 25;
      const isFinalRound = round >= ROUNDS;

      if (iWin) {
        setOppHp(Math.max(loserFloor, Math.round(100 * (1 - progress))));
        setMyHp(Math.max(winnerFloor, Math.round(100 - (100 - winnerFloor) * progress)));
      } else {
        setMyHp(Math.max(loserFloor, Math.round(100 * (1 - progress))));
        setOppHp(Math.max(winnerFloor, Math.round(100 - (100 - winnerFloor) * progress)));
      }

      // 매 라운드 양쪽에서 서로에게 투사체를 여러 발 날림 - 이기는 쪽이 더 많이/크게 날림
      const myProjectiles = iWin ? 3 : 1;
      const oppProjectiles = iWin ? 1 : 3;
      for (let i = 0; i < myProjectiles; i++) {
        const color = PROJECTILE_COLORS[Math.floor(Math.random() * PROJECTILE_COLORS.length)];
        setTimeout(() => spawnProjectile(0.22, 0.72, 0.78, 0.4, color, 5 + (iWin ? 2 : 0)), i * 70);
      }
      for (let i = 0; i < oppProjectiles; i++) {
        const color = PROJECTILE_COLORS[Math.floor(Math.random() * PROJECTILE_COLORS.length)];
        setTimeout(() => spawnProjectile(0.78, 0.4, 0.22, 0.72, color, 5 + (!iWin ? 2 : 0)), i * 70 + 30);
      }

      // 매 라운드 양쪽 다 타격 이펙트 (승자 쪽 공격이 더 화려함)
      const bigHitSide = iWin ? 0.8 : 0.2;
      spawnParticles(0.2, 0.7, '#ff5a5a', 14, 0.8);
      spawnParticles(0.8, 0.35, '#ffcf4a', 14, 0.8);
      spawnParticles(bigHitSide, bigHitSide > 0.5 ? 0.35 : 0.7, '#ffffff', 20 + round * 4, 1 + round * 0.12);

      setShake(true);
      setTimeout(() => setShake(false), 180);
      playAttackSound();
      setScreenFlash(isFinalRound ? (iWin ? '#ffcf4a' : '#ff4d6d') : 'rgba(255,255,255,0.5)');
      setTimeout(() => setScreenFlash(null), isFinalRound ? 320 : 140);
      setLog(HIT_LOGS[Math.floor(Math.random() * HIT_LOGS.length)]);

      if (isFinalRound) {
        clearInterval(timer);
        if (iWin) setOppHp(0); else setMyHp(0);
        setLog(iWin ? '치명적인 결정타!' : '결국 무너지고 말았다...');
        if (iWin) playVictorySound(); else playErrorSound();
        // 마무리 대형 폭발 이펙트 + 투사체 집중포화
        spawnParticles(iWin ? 0.8 : 0.2, iWin ? 0.35 : 0.7, iWin ? '#ffe14a' : '#ff4d6d', 46, 1.6);
        for (let i = 0; i < 5; i++) {
          setTimeout(() => spawnProjectile(
            iWin ? 0.22 : 0.78, iWin ? 0.72 : 0.4,
            iWin ? 0.78 : 0.22, iWin ? 0.35 : 0.72,
            iWin ? '#ffe14a' : '#ff4d6d', 8
          ), i * 60);
        }
        setTimeout(() => {
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinish?.();
          }
        }, 700);
      }
    }, ROUND_INTERVAL);
    return () => clearInterval(timer);
  }, [battle, onFinish, spawnParticles, spawnProjectile]);

  return (
    <div className={`pvp-battle-scene ${shake ? 'shake' : ''}`}>
      <div className="arena">
        <canvas ref={canvasRef} className="arena-fx" />
        {screenFlash && <div className="job-skill-flash" style={{ background: screenFlash }} />}
        <div className="fighter-slot fighter-slot--player">
          <MonsterSprite speciesKey={mySpeciesKey} size={100} alt="나" costumeKeys={equippedCostumes} />
        </div>
        <div className="fighter-slot fighter-slot--enemy">
          <span className="pvp-opponent-icon">{battle.opponent_is_real ? '🧑‍🤝‍🧑' : '👻'}</span>
        </div>
      </div>

      <div className="hud-row">
        <PvpHpBar label="나" hp={myHp} />
        <PvpHpBar label={battle.opponent_name} hp={oppHp} />
      </div>

      <p className="battle-log">{log}</p>
    </div>
  );
}

function PvpHpBar({ label, hp }) {
  return (
    <div className="hp-bar">
      <div className="hp-label">{label} ({hp}%)</div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${hp}%`, background: hp > 30 ? 'var(--accent-heal)' : 'var(--danger)' }} /></div>
    </div>
  );
}
