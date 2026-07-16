import { useEffect, useState } from 'react';
import { fetchMyCombatPower, startPvpBattle } from '../lib/pvp';
import { getDisplaySpriteKey } from '../lib/jobAdvancement';
import { showToast } from '../lib/toast';
import PvPBattleScene from './PvPBattleScene';

export default function PvPArena({ profile, activeMonster, onBattleResolved }) {
  const [myPower, setMyPower] = useState(null);
  const [fighting, setFighting] = useState(false);
  const [pendingBattle, setPendingBattle] = useState(null); // 서버 결과는 받았지만 아직 연출 중
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyCombatPower().then(setMyPower).catch(() => {});
  }, []);

  async function handleFight() {
    setError('');
    setLastResult(null);
    setFighting(true);
    try {
      const res = await startPvpBattle();
      setPendingBattle(res); // 결과는 이미 받았지만, 연출이 끝날 때까지 화면엔 안 보여줌
    } catch (err) {
      setError(err.message ?? '대결에 실패했어요.');
      showToast(err.message ?? '대결에 실패했어요.', 'error');
      setFighting(false);
    }
  }

  function handleSceneFinish() {
    const res = pendingBattle;
    setPendingBattle(null);
    setLastResult(res);
    setMyPower(res.my_power);
    onBattleResolved(res);
    setFighting(false);
    if (res.result === 'win') {
      showToast(`승리! PvP 재화 +${res.reward.toLocaleString()}`, 'success');
    } else {
      showToast('패배했어요. 다시 도전해보세요!', 'error');
    }
  }

  const mySpeciesKey = activeMonster
    ? getDisplaySpriteKey(activeMonster.speciesId, activeMonster.element, activeMonster.unlockedJobTier ?? 0)
    : undefined;

  return (
    <div className="pvp-arena">
      <div className="pvp-power-card">
        <span className="pvp-power-label">나의 전투력</span>
        <span className="pvp-power-value">{myPower != null ? myPower.toLocaleString() : '-'}</span>
        <span className="pvp-record">🏆 {profile?.pvp_wins ?? 0}승 · 💀 {profile?.pvp_losses ?? 0}패</span>
      </div>

      <p className="stage-select-hint">
        전투력이 비슷한(±25%) 실제 유저와 매칭돼요. 마땅한 상대가 없으면 내 전투력과 비슷한 가상 캐릭터가 대신 나와요.
      </p>

      {error && <p className="shop-error">{error}</p>}

      {pendingBattle ? (
        <PvPBattleScene battle={pendingBattle} mySpeciesKey={mySpeciesKey} onFinish={handleSceneFinish} />
      ) : (
        <button className="btn btn-challenge pvp-fight-btn" disabled={fighting} onClick={handleFight}>
          {fighting ? '상대를 찾는 중...' : '⚔️ 대결 시작'}
        </button>
      )}

      {lastResult && (
        <div className={`pvp-result-card ${lastResult.result === 'win' ? 'win' : 'lose'}`}>
          <p className="result-text">{lastResult.result === 'win' ? '승리!' : '패배...'}</p>
          <div className="pvp-result-row">
            <div>
              <div className="pvp-result-label">나</div>
              <div className="pvp-result-power">{lastResult.my_power.toLocaleString()}</div>
            </div>
            <span className="pvp-vs">VS</span>
            <div>
              <div className="pvp-result-label">
                {lastResult.opponent_name} {!lastResult.opponent_is_real && <span className="pvp-synthetic-tag">가상</span>}
              </div>
              <div className="pvp-result-power">{lastResult.opponent_power.toLocaleString()}</div>
            </div>
          </div>
          {lastResult.result === 'win' && (
            <p className="pvp-reward-line">💰 PvP 재화 +{lastResult.reward.toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}
