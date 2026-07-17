import { useEffect, useState, useRef, useCallback } from 'react';
import MonsterSprite from './MonsterSprite';

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

/**
 * props
 * - battle: startPvpBattle()의 결과 { result, opponent_name, opponent_is_real, my_power, opponent_power, reward }
 * - mySpeciesKey: 내 캐릭터 스프라이트 키
 * - onFinish(): 연출이 끝나면 호출 (결과 패널 표시 트리거)
 */
export default function PvPBattleScene({ battle, mySpeciesKey, onFinish }) {
  const [myHp, setMyHp] = useState(100);
  const [oppHp, setOppHp] = useState(100);
  const [shake, setShake] = useState(false);
  const [screenFlash, setScreenFlash] = useState(null);
  const [log, setLog] = useState('전투 개시!');
  const finishedRef = useRef(false);

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

      // 매 라운드 양쪽 다 타격 이펙트 (승자 쪽 공격이 더 화려함)
      const bigHitSide = iWin ? 0.8 : 0.2; // 이기는 쪽이 상대에게 큰 타격을 준다는 연출
      spawnParticles(0.2, 0.7, '#ff5a5a', 14, 0.8); // 내가 맞는 이펙트
      spawnParticles(0.8, 0.35, '#ffcf4a', 14, 0.8); // 상대가 맞는 이펙트
      spawnParticles(bigHitSide, bigHitSide > 0.5 ? 0.35 : 0.7, '#ffffff', 20 + round * 4, 1 + round * 0.12);

      setShake(true);
      setTimeout(() => setShake(false), 180);
      setScreenFlash(isFinalRound ? (iWin ? '#ffcf4a' : '#ff4d6d') : 'rgba(255,255,255,0.5)');
      setTimeout(() => setScreenFlash(null), isFinalRound ? 320 : 140);
      setLog(HIT_LOGS[Math.floor(Math.random() * HIT_LOGS.length)]);

      if (isFinalRound) {
        clearInterval(timer);
        if (iWin) setOppHp(0); else setMyHp(0);
        setLog(iWin ? '치명적인 결정타!' : '결국 무너지고 말았다...');
        // 마무리 대형 폭발 이펙트
        spawnParticles(iWin ? 0.8 : 0.2, iWin ? 0.35 : 0.7, iWin ? '#ffe14a' : '#ff4d6d', 46, 1.6);
        setTimeout(() => {
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinish?.();
          }
        }, 700);
      }
    }, ROUND_INTERVAL);
    return () => clearInterval(timer);
  }, [battle, onFinish, spawnParticles]);

  return (
    <div className={`pvp-battle-scene ${shake ? 'shake' : ''}`}>
      <div className="arena">
        <canvas ref={canvasRef} className="arena-fx" />
        {screenFlash && <div className="job-skill-flash" style={{ background: screenFlash }} />}
        <div className="fighter-slot fighter-slot--player">
          <MonsterSprite speciesKey={mySpeciesKey} size={100} alt="나" />
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
