import { useEffect, useRef, useState, useCallback } from 'react';
import MonsterSprite from './MonsterSprite';
import SkillButton from './SkillButton';
import { getDisplaySpriteKey, getAvailableSkills, getJobSkillTier, buildInitialJobSkillCooldowns } from '../lib/jobAdvancement';
import { mitigateDamage, calculateCombatPower } from '../lib/combat';
import { bumpMission } from '../lib/missions';
import { playAttackSound, playHealSound, playBuffSound, playNewRecordSound, playClickSound } from '../lib/audio';
import { reportWorldBossDamage } from '../lib/worldBoss';
import { showToast } from '../lib/toast';

const ELEMENT_COLORS = { fire: '#ff5a1f', water: '#3aa8e0', grass: '#5cb83c' };
const ENEMY_ATTACK_INTERVAL = 1900;
const TIME_LIMIT_MS = 60000; // 1분 제한시간

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
 * - initialMonster, equipmentBonus, equippedSkills: 다른 전투화면과 동일
 * - session: enterWorldBoss() 결과 { sessionId, weekKey, bossCurrentHp, bossMaxHp, bossAtk, bossDef, remainingAttempts }
 * - onSettled(result): 전투 종료(승/패 무관) 후 서버 응답 { newCurrentHp, bossMaxHp, clearedNow } 전달
 * - onExit(): 목록으로 돌아가기
 */
export default function WorldBossBattle({ initialMonster, equipmentBonus, equippedSkills, equippedCostumes, session, onSettled, onExit }) {
  const availableSkills = getAvailableSkills(equippedSkills ?? [], initialMonster.element, initialMonster.unlockedJobTier ?? 0);
  const [player, setPlayer] = useState(() => withEquipment(initialMonster, equipmentBonus));
  const [enemy, setEnemy] = useState(() => ({
    name: '월드보스 · 태초의 용',
    element: 'fire',
    spriteKey: 'fire_1',
    hp: session.bossCurrentHp,
    maxHp: session.bossMaxHp,
    atk: session.bossAtk,
    def: session.bossDef,
  }));
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
  const [log, setLog] = useState('월드보스가 그 거대한 모습을 드러냈다!');
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState(null);
  const [screenFlash, setScreenFlash] = useState(null); // 고티어 전직스킬용 화면 플래시 색상
  const [showHealFx, setShowHealFx] = useState(false); // 회복 스킬 사용 시 캐릭터 위 아이콘 표시
  const [settling, setSettling] = useState(false);
  const [personalBestResult, setPersonalBestResult] = useState(null); // { isNewPersonalBest, personalBest } | null
  const [resultCopied, setResultCopied] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(TIME_LIMIT_MS);

  const damageDealtRef = useRef(0);
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

  const damageEnemy = useCallback((amount) => {
    damageDealtRef.current += amount;
    setEnemy((prev) => ({ ...prev, hp: Math.max(prev.hp - amount, 0) }));
    spawnParticles(0.8, 0.35, '#ffcf4a');
    triggerShake();
  }, [spawnParticles, triggerShake]);

  const damagePlayer = useCallback((amount) => {
    setPlayer((prev) => ({ ...prev, hp: Math.max(prev.hp - amount, 0) }));
    spawnParticles(0.2, 0.7, ELEMENT_COLORS[player.element]);
    triggerShake();
  }, [spawnParticles, triggerShake, player.element]);

  // 전투 종료(승/패/시간초과) 시 실제 입힌 데미지를 서버에 보고하고 공식 결과를 받음
  useEffect(() => {
    if (result || settling) return;
    if (enemy.hp <= 0 || player.hp <= 0) {
      const outcome = enemy.hp <= 0 ? 'win' : 'lose';
      setResult(outcome);
      setSettling(true);
      setLog(outcome === 'win' ? '월드보스에게 강력한 일격을 꽂아넣었다!' : `${player.name}가 쓰러졌다... 입힌 피해는 그대로 기록돼요.`);
      reportWorldBossDamage(session.sessionId, Math.round(damageDealtRef.current))
        .then((res) => {
          if (res.isNewPersonalBest) {
            setPersonalBestResult(res);
            playNewRecordSound();
          }
          onSettled?.(res);
        })
        .catch((err) => setLog(err.message ?? '결과 반영에 실패했어요.'))
        .finally(() => setSettling(false));
    }
  }, [enemy.hp, player.hp, result, settling]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1분 제한시간 카운트다운 - 다 되면 그때까지 입힌 피해만 그대로 보고하고 전투 종료
  useEffect(() => {
    if (result) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const left = TIME_LIMIT_MS - (Date.now() - startedAt);
      if (left <= 0) {
        clearInterval(timer);
        setTimeLeftMs(0);
        setResult((prev) => prev ?? 'timeout');
      } else {
        setTimeLeftMs(left);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  // 시간초과로 result가 'timeout'이 된 경우도 동일하게 서버에 데미지 보고
  useEffect(() => {
    if (result !== 'timeout' || settling) return;
    setSettling(true);
    setLog('제한시간 종료! 그동안 입힌 피해는 그대로 기록됐어요.');
    reportWorldBossDamage(session.sessionId, Math.round(damageDealtRef.current))
      .then((res) => {
        if (res.isNewPersonalBest) {
          setPersonalBestResult(res);
          playNewRecordSound();
        }
        onSettled?.(res);
      })
      .catch((err) => setLog(err.message ?? '결과 반영에 실패했어요.'))
      .finally(() => setSettling(false));
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => {
      if (Date.now() < enemyStunnedUntil) {
        setLog('월드보스가 기절해서 움직이지 못한다!');
        return;
      }
      setLog('월드보스의 포효!');
      const defBuffActive = Date.now() < playerBuffs.defUntil;
      const effDef = player.def * (defBuffActive ? playerBuffs.defMult : 1);
      damagePlayer(mitigateDamage(enemy.atk, effDef));
    }, ENEMY_ATTACK_INTERVAL);
    return () => clearInterval(timer);
  }, [enemy.atk, result, damagePlayer, player.def, enemyStunnedUntil, playerBuffs]);

  async function handleCopyResult() {
    if (!personalBestResult?.isNewPersonalBest) return;
    const text = `🐉 월드보스 개인 최고 데미지 경신! ${personalBestResult.personalBest.toLocaleString()}`;
    try {
      await navigator.clipboard.writeText(text);
      setResultCopied(true);
      playClickSound();
      setTimeout(() => setResultCopied(false), 2000);
    } catch {
      showToast('복사에 실패했어요.', 'error');
    }
  }

  function useSkill(skill) {
    if (result || cooldowns[skill.id]) return;
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
      setLog(`${player.name}의 ${skill.name}! 월드보스를 ${(stunMs / 1000).toFixed(1)}초간 기절시켰다!`);
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
      setPlayerBuffs((prev) => ({ ...prev, atkUntil: now + skill.duration, atkMult: 1 + skill.multiplier }));
      setLog(`${player.name}의 ${skill.name}! 공격력이 상승했다!`);
      playBuffSound();
      spawnParticles(0.2, 0.7, '#ff8a4a');
    } else if (skill.type === 'buff_def') {
      setPlayerBuffs((prev) => ({ ...prev, defUntil: now + skill.duration, defMult: 1 + skill.multiplier }));
      setLog(`${player.name}의 ${skill.name}! 방어력이 상승했다!`);
      playBuffSound();
      spawnParticles(0.2, 0.7, '#4aa8ff');
    } else if (skill.type === 'haste') {
      setPlayerBuffs((prev) => ({ ...prev, hasteUntil: now + skill.duration, hasteReduction: skill.multiplier }));
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

  const keyStateRef = useRef();
  keyStateRef.current = { result, availableSkills, useSkill, onExit };

  useEffect(() => {
    function handleKeyDown(e) {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const { result, availableSkills, useSkill, onExit } = keyStateRef.current;
      if (/^[1-9]$/.test(e.key)) {
        if (!result) {
          const skill = availableSkills[Number(e.key) - 1];
          if (skill) { e.preventDefault(); useSkill(skill); }
        }
        return;
      }
      if (e.code === 'Space' && result) {
        e.preventDefault();
        onExit?.();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`battle-screen worldboss-screen ${shake ? 'shake' : ''}`}>
      <div className="stage-badge">
        🐉 월드보스 · 남은 도전 {session.remainingAttempts}회 · ⏱️ {Math.ceil(timeLeftMs / 1000)}초 남음
        <span className="combat-power-badge">⚔️ 나의 전투력 {calculateCombatPower(player).toLocaleString()}</span>
      </div>

      <div className="arena worldboss-arena">
        <canvas ref={canvasRef} className="arena-fx" />
        <div className="worldboss-giant-wrap">
          <span className="worldboss-icon">🐉</span>
        </div>
        <div className="fighter-slot fighter-slot--player worldboss-player-slot">
          <MonsterSprite speciesKey={getDisplaySpriteKey(player.speciesId, player.element, player.unlockedJobTier ?? 0)} size={110} alt={player.name} costumeKeys={equippedCostumes} />
          {(Date.now() < playerBuffs.hasteUntil || showHealFx) && (
            <div className="player-status-fx">
              {Date.now() < playerBuffs.hasteUntil && <span className="status-fx-icon status-fx-haste" title="쿨타임 감소 중">⚡</span>}
              {showHealFx && <span className="status-fx-icon status-fx-heal" title="회복!">💚</span>}
            </div>
          )}
        </div>
        {screenFlash && <div className="job-skill-flash" style={{ background: screenFlash }} />}
      </div>

      <div className="hud-row">
        <HpBar label={`${player.name} Lv.${player.level}`} hp={player.hp} maxHp={player.maxHp} color={ELEMENT_COLORS[player.element]} />
        <HpBar label="월드보스 (전체 유저 공용 체력)" hp={enemy.hp} maxHp={enemy.maxHp} color="#d94aff" />
      </div>

      <BuffStatusRow buffs={playerBuffs} enemyStunnedUntil={enemyStunnedUntil} />

      <p className="battle-log">{log}</p>
      <p className="keyboard-hint">이번 전투에서 입힌 피해: {Math.round(damageDealtRef.current).toLocaleString()}</p>

      {result ? (
        <div className="result-panel">
          <p className="result-text">
            {result === 'win' ? '마지막 일격 성공!' : result === 'timeout' ? '⏱️ 제한시간 종료' : '퇴각...'}
          </p>
          {personalBestResult?.isNewPersonalBest && (
            <>
              <p className="new-record-badge">🏆 개인 최고 데미지 경신! {personalBestResult.personalBest.toLocaleString()}</p>
              <button type="button" className="btn btn-ghost pvp-share-btn" onClick={handleCopyResult}>
                {resultCopied ? '✅ 복사됨' : '📋 결과 공유'}
              </button>
            </>
          )}
          <div className="result-actions">
            <button className="btn btn-neutral" disabled={settling} onClick={onExit}>
              {settling ? '결과 반영 중...' : '목록으로'} <span className="key-hint">Space</span>
            </button>
          </div>
        </div>
      ) : (
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
        <p className="keyboard-hint">숫자키 1~9로 스킬 사용</p>
        </>
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

function HpBar({ label, hp, maxHp, color }) {
  const pct = Math.max((hp / maxHp) * 100, 0);
  return (
    <div className="hp-bar">
      <div className="hp-label">{label} ({Math.ceil(hp).toLocaleString()}/{maxHp.toLocaleString()})</div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}
