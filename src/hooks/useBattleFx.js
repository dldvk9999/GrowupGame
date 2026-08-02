import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 리팩토링(사용자 요청): 9개 전투화면(BattleScreen/DungeonBattle/JobDungeonBattle/
 * RubyDungeonBattle/StreakDungeonBattle/EliteTrialBattle/SealedDungeonBattle/
 * WorldBossBattle/GuildRaidBattle)에 바이트 단위로 거의 동일하게 복붙되어 있던
 * "캔버스 파티클 + 화면 흔들림" 로직을 하나의 훅으로 추출함.
 *
 * 사용법:
 *   const { canvasRef, shake, spawnParticles, triggerShake } = useBattleFx();
 *   <canvas ref={canvasRef} className="arena-fx" />
 *   spawnParticles(0.8, 0.35, '#ff4d6d'); // x비율, y비율, 색상, [개수], [크기배율]
 */
export function useBattleFx() {
  const [shake, setShake] = useState(false);
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

  const spawnParticles = useCallback((xr, yr, color, count = 20, sizeMult = 1) => {
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

  return { canvasRef, shake, spawnParticles, triggerShake };
}
