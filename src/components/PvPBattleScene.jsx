import { useEffect, useState, useRef } from 'react';
import MonsterSprite from './MonsterSprite';

const ROUNDS = 6;
const ROUND_INTERVAL = 450; // ms

/**
 * props
 * - battle: startPvpBattle()의 결과 { result, opponent_name, opponent_is_real, my_power, opponent_power, reward }
 * - mySpeciesKey: 내 캐릭터 스프라이트 키
 * - onFinish(): 연출이 끝나면 호출 (결과 패널 표시 트리거)
 */
export default function PvPBattleScene({ battle, mySpeciesKey, onFinish }) {
  const [myHp, setMyHp] = useState(100);
  const [oppHp, setOppHp] = useState(100);
  const [round, setRound] = useState(0);
  const [shake, setShake] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    const iWin = battle.result === 'win';
    const timer = setInterval(() => {
      setRound((r) => {
        const next = r + 1;
        const progress = next / ROUNDS;
        const loserFloor = 0;
        const winnerFloor = 30 + Math.random() * 25;
        if (iWin) {
          setOppHp(Math.max(loserFloor, Math.round(100 * (1 - progress))));
          setMyHp(Math.max(winnerFloor, Math.round(100 - (100 - winnerFloor) * progress)));
        } else {
          setMyHp(Math.max(loserFloor, Math.round(100 * (1 - progress))));
          setOppHp(Math.max(winnerFloor, Math.round(100 - (100 - winnerFloor) * progress)));
        }
        setShake(true);
        setTimeout(() => setShake(false), 150);

        if (next >= ROUNDS) {
          clearInterval(timer);
          if (iWin) setOppHp(0); else setMyHp(0);
          setTimeout(() => {
            if (!finishedRef.current) {
              finishedRef.current = true;
              onFinish?.();
            }
          }, 600);
        }
        return next;
      });
    }, ROUND_INTERVAL);
    return () => clearInterval(timer);
  }, [battle, onFinish]);

  return (
    <div className={`pvp-battle-scene ${shake ? 'shake' : ''}`}>
      <div className="arena">
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

      <p className="battle-log">치열하게 격돌하는 중...</p>
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
