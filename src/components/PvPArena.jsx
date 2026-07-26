import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchMyCombatPower, startPvpBattle, startPvpRevengeBattle, fetchPvpHistory } from '../lib/pvp';
import { getDisplaySpriteKey } from '../lib/jobAdvancement';
import { getPvpTier, getWinsToNextTier } from '../lib/pvpTier';
import { showToast } from '../lib/toast';
import { markPvpPlayedToday } from '../lib/dailyPvpFlag';
import { copyToClipboardWithFeedback } from '../lib/clipboard';
import PvPBattleScene from './PvPBattleScene';
import InfoTooltip from './InfoTooltip';

export default function PvPArena({ profile, activeMonster, onBattleResolved }) {
  const [myPower, setMyPower] = useState(null);
  const [fighting, setFighting] = useState(false);
  const [pendingBattle, setPendingBattle] = useState(null); // 서버 결과는 받았지만 아직 연출 중
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [resultCopied, setResultCopied] = useState(false);

  async function handleCopyResult() {
    if (!lastResult) return;
    const text = `⚔️ PvP 승리! vs ${lastResult.opponent_name}(전투력 ${lastResult.opponent_power.toLocaleString()}) - 재화 +${lastResult.reward.toLocaleString()}`;
    if (await copyToClipboardWithFeedback(text)) {
      setResultCopied(true);
      setTimeout(() => setResultCopied(false), 2000);
    }
  }

  useEffect(() => {
    fetchMyCombatPower().then(setMyPower).catch(() => {});
    loadHistory(); // 연승 스트릭 표시를 위해 처음부터 로드(최근 20개, 가벼운 쿼리)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loadHistory() {
    if (!profile?.id) return;
    fetchPvpHistory(profile.id).then(setHistory).catch(() => setHistory([]));
  }

  async function handleFight(revengeOpponentId) {
    setError('');
    setLastResult(null);
    setFighting(true);
    try {
      const res = revengeOpponentId
        ? await startPvpRevengeBattle(revengeOpponentId)
        : await startPvpBattle();
      setPendingBattle(res); // 결과는 이미 받았지만, 연출이 끝날 때까지 화면엔 안 보여줌
    } catch (err) {
      setError(err.message ?? '대결에 실패했어요.');
      showToast(err.message ?? '대결에 실패했어요.', 'error');
      setFighting(false);
    }
  }

  // ⚠️ [버그 수정, 사용자 제보] "최근 전적 보기" 버튼을 누르면 전투가 처음부터 다시
  // 시작되던 문제 - handleSceneFinish가 매 렌더마다 새로 생성되는 일반 함수였는데,
  // PvPBattleScene의 애니메이션 useEffect가 이 함수를 의존성 배열에 넣고 있어서
  // (onFinish가 바뀔 때마다 effect가 통째로 정리+재시작됨), showHistory 토글 같은
  // PvPArena의 아무 리렌더에서나 handleSceneFinish 참조가 바뀌어 애니메이션이
  // round=0부터 다시 시작됐음. useCallback으로 참조를 안정시켜서 해결.
  // onBattleResolved도 App.jsx에서 JSX 인라인 함수로 전달돼 매 렌더마다 참조가 바뀌므로,
  // ref로 최신값만 담아두고 handleSceneFinish 자체는 완전히 빈 의존성 배열로 고정함
  // (그래야 PvPBattleScene의 애니메이션 effect가 절대 재시작되지 않음)
  const onBattleResolvedRef = useRef(onBattleResolved);
  onBattleResolvedRef.current = onBattleResolved;

  const handleSceneFinish = useCallback(() => {
    setPendingBattle((prev) => {
      if (!prev) return prev;
      setLastResult(prev);
      setMyPower(prev.my_power);
      onBattleResolvedRef.current(prev);
      markPvpPlayedToday();
      setFighting(false);
      loadHistory();
      if (prev.result === 'win') {
        const bonusTag = prev.opponent_is_real ? ' (실유저 3배!)' : '';
        showToast(`승리! PvP 재화 +${prev.reward.toLocaleString()}${bonusTag}`, 'success');
      } else if (prev.reward > 0) {
        showToast(`패배했지만 실유저 대전 보상 +${prev.reward.toLocaleString()}`, 'info');
      } else {
        showToast('패배했어요. 다시 도전해보세요!', 'error');
      }
      return null;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        <InfoTooltip text="전투력이 비슷한(±25%) 실제 유저와 매칭돼요. 마땅한 상대가 없으면 내 전투력과 비슷한 가상 캐릭터가 대신 나와요. 실제 유저와 붙으면 승리 시 재화 3배, 패배해도 위로 보상이 지급돼요!" />
        {' '}PvP 안내
      </p>

      {error && <p className="shop-error">{error}</p>}

      {pendingBattle ? (
        <PvPBattleScene battle={pendingBattle} mySpeciesKey={mySpeciesKey} equippedCostumes={profile?.equipped_costumes} onFinish={handleSceneFinish} />
      ) : (
        <button className="btn btn-challenge pvp-fight-btn" disabled={fighting} onClick={() => handleFight()}>
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
          {lastResult.opponent_is_real && lastResult.result === 'win' && (
            <button type="button" className="btn btn-ghost pvp-share-btn" onClick={handleCopyResult}>
              {resultCopied ? '✅ 복사됨' : '📋 결과 공유'}
            </button>
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
              {h.opponent_is_real && h.opponent_user_id && (
                <button
                  type="button"
                  className="btn btn-ghost pvp-revenge-btn"
                  disabled={fighting || !!pendingBattle}
                  onClick={() => handleFight(h.opponent_user_id)}
                >
                  🔁 복수하기
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
