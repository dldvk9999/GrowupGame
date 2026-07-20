import { useEffect, useState } from 'react';
import { fetchMyCombatPower, startPvpBattle, fetchPvpHistory } from '../lib/pvp';
import { getDisplaySpriteKey } from '../lib/jobAdvancement';
import { getPvpTier, getWinsToNextTier } from '../lib/pvpTier';
import { showToast } from '../lib/toast';
import PvPBattleScene from './PvPBattleScene';

export default function PvPArena({ profile, activeMonster, onBattleResolved }) {
  const [myPower, setMyPower] = useState(null);
  const [fighting, setFighting] = useState(false);
  const [pendingBattle, setPendingBattle] = useState(null); // 서버 결과는 받았지만 아직 연출 중
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchMyCombatPower().then(setMyPower).catch(() => {});
    loadHistory(); // 연승 스트릭 표시를 위해 처음부터 로드(최근 20개, 가벼운 쿼리)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loadHistory() {
    if (!profile?.id) return;
    fetchPvpHistory(profile.id).then(setHistory).catch(() => setHistory([]));
  }

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
    loadHistory(); // 연승 스트릭 표시와 전적 목록 둘 다 즉시 반영되도록 항상 갱신
    if (res.result === 'win') {
      const bonusTag = res.opponent_is_real ? ' (실유저 3배!)' : '';
      showToast(`승리! PvP 재화 +${res.reward.toLocaleString()}${bonusTag}`, 'success');
    } else if (res.reward > 0) {
      showToast(`패배했지만 실유저 대전 보상 +${res.reward.toLocaleString()}`, 'info');
    } else {
      showToast('패배했어요. 다시 도전해보세요!', 'error');
    }
  }

  const mySpeciesKey = activeMonster
    ? getDisplaySpriteKey(activeMonster.speciesId, activeMonster.element, activeMonster.unlockedJobTier ?? 0)
    : undefined;

  // 최근 전적(최신순) 맨 앞부터 'win'이 연속되는 개수 = 현재 연승 스트릭
  const winStreak = (() => {
    if (!history) return 0;
    let n = 0;
    for (const h of history) {
      if (h.result === 'win') n++;
      else break;
    }
    return n;
  })();

  const myTier = getPvpTier(profile?.pvp_wins);
  const winsToNext = getWinsToNextTier(profile?.pvp_wins);

  return (
    <div className="pvp-arena">
      <div className="pvp-power-card">
        <span className={`pvp-tier-badge pvp-tier-${myTier.key}`} style={{ borderColor: myTier.color, color: myTier.color }}>
          {myTier.icon} {myTier.label}
        </span>
        <span className="pvp-power-label">나의 전투력</span>
        <span className="pvp-power-value">{myPower != null ? myPower.toLocaleString() : '-'}</span>
        <span className="pvp-record">🏆 {profile?.pvp_wins ?? 0}승 · 💀 {profile?.pvp_losses ?? 0}패</span>
        {winsToNext != null && <span className="pvp-tier-next">다음 티어까지 {winsToNext}승</span>}
        {winStreak >= 2 && <span className="pvp-win-streak">🔥 {winStreak}연승 중!</span>}
      </div>

      <p className="stage-select-hint">
        전투력이 비슷한(±25%) 실제 유저와 매칭돼요. 마땅한 상대가 없으면 내 전투력과 비슷한 가상 캐릭터가 대신 나와요.
        실제 유저와 붙으면 승리 시 재화 <strong>3배</strong>, 패배해도 위로 보상이 지급돼요!
      </p>

      {error && <p className="shop-error">{error}</p>}

      {pendingBattle ? (
        <PvPBattleScene battle={pendingBattle} mySpeciesKey={mySpeciesKey} equippedCostumes={profile?.equipped_costumes} onFinish={handleSceneFinish} />
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
          {lastResult.reward > 0 && (
            <p className="pvp-reward-line">
              💰 PvP 재화 +{lastResult.reward.toLocaleString()}
              {lastResult.opponent_is_real && lastResult.result === 'win' && ' (실유저 3배!)'}
              {lastResult.opponent_is_real && lastResult.result === 'lose' && ' (실유저 위로보상)'}
            </p>
          )}
        </div>
      )}

      <button
        className="btn btn-ghost pvp-history-toggle"
        onClick={() => {
          const next = !showHistory;
          setShowHistory(next);
          if (next && history === null) loadHistory();
        }}
      >
        {showHistory ? '▲ 최근 전적 접기' : '▼ 최근 전적 보기'}
      </button>

      {showHistory && (
        <div className="pvp-history-list">
          {history === null && <p className="stage-select-hint">불러오는 중...</p>}
          {history?.length === 0 && <p className="inventory-empty">아직 전적이 없어요.</p>}
          {history?.map((h) => (
            <div key={h.id} className={`pvp-history-row ${h.result === 'win' ? 'pvp-history-row--win' : 'pvp-history-row--lose'}`}>
              <span className="pvp-history-result">{h.result === 'win' ? '승' : '패'}</span>
              <span className="pvp-history-opponent">
                {h.opponent_name}{!h.opponent_is_real && <span className="pvp-synthetic-tag">가상</span>}
              </span>
              <span className="pvp-history-power">{h.my_power.toLocaleString()} vs {h.opponent_power.toLocaleString()}</span>
              {h.reward > 0 && <span className="pvp-history-reward">+{h.reward.toLocaleString()}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
