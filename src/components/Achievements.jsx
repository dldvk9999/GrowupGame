import { useState, useEffect } from 'react';
import { ACHIEVEMENT_CATALOG, ACHIEVEMENT_CATEGORY_LABEL, TITLE_BY_ACHIEVEMENT, fetchClaimedAchievements, claimAchievement, setEquippedTitle, fetchAchievementLeaderboard, fetchMyAchievementRank } from '../lib/achievements';
import { fetchMyCombatPower } from '../lib/pvp';
import { showToast } from '../lib/toast';
import { playLevelUpSound, playGoldSound } from '../lib/audio';

/**
 * 업적 목록 화면. stats(현재 진행도 스냅샷)는 App.jsx가 이미 들고 있는 값들을
 * 그대로 내려받아서 별도 서버 호출 없이 프로그레스바를 계산한다.
 * 실제 수령 검증은 claim_achievement RPC가 서버에서 다시 하므로, 여기 계산은 표시용일 뿐.
 * 전투력만 예외 — App.jsx가 안 들고 있는 값이라, 여기서 fetchMyCombatPower()(PvP와 동일한
 * 서버 계산, 장비 보너스 포함)로 직접 조회해서 stats에 병합함
 */
export default function Achievements({ userId, stats, onGoldChange, gold, equippedTitle, onTitleChange }) {
  const [claimedKeys, setClaimedKeys] = useState(null);
  const [claimingKey, setClaimingKey] = useState(null);
  const [settingTitle, setSettingTitle] = useState(false);
  const [error, setError] = useState('');
  const [showAchLeaderboard, setShowAchLeaderboard] = useState(false);
  const [achLeaderboard, setAchLeaderboard] = useState(null);
  const [myAchRank, setMyAchRank] = useState(null);
  const [combatPower, setCombatPower] = useState(null);

  function loadAchLeaderboard() {
    Promise.all([fetchAchievementLeaderboard(), fetchMyAchievementRank()])
      .then(([lb, rank]) => { setAchLeaderboard(lb); setMyAchRank(rank); })
      .catch(() => setAchLeaderboard([]));
  }

  useEffect(() => {
    if (!userId) return;
    fetchClaimedAchievements(userId).then(setClaimedKeys).catch(() => setClaimedKeys(new Set()));
    fetchMyCombatPower().then(setCombatPower).catch(() => setCombatPower(null));
  }, [userId]);

  const statsWithCombatPower = { ...stats, combatPower: combatPower ?? 0 };



  async function handleClaim(achievement) {
    setError('');
    setClaimingKey(achievement.key);
    try {
      const reward = await claimAchievement(achievement.key);
      onGoldChange(gold + reward);
      setClaimedKeys((prev) => new Set(prev).add(achievement.key));
      playLevelUpSound();
      showToast(`업적 달성! "${achievement.title}" 💰 ${reward.toLocaleString()} 획득!`, 'success');
    } catch (err) {
      setError(err.message ?? '수령에 실패했어요.');
      showToast(err.message ?? '수령에 실패했어요.', 'error');
    } finally {
      setClaimingKey(null);
    }
  }

  async function handleSetTitle(achievementKey, titleText) {
    setSettingTitle(true);
    try {
      const isEquipping = equippedTitle !== titleText;
      await setEquippedTitle(isEquipping ? achievementKey : null);
      onTitleChange?.(isEquipping ? titleText : null);
      showToast(isEquipping ? `칭호 "${titleText}"를 장착했어요.` : '칭호를 해제했어요.', 'success');
    } catch (err) {
      showToast(err.message ?? '칭호 설정에 실패했어요.', 'error');
    } finally {
      setSettingTitle(false);
    }
  }

  if (claimedKeys === null) {
    return <p className="stage-select-hint">업적 목록을 불러오는 중...</p>;
  }

  const categories = [...new Set(ACHIEVEMENT_CATALOG.map((a) => a.category))];
  const totalClaimed = claimedKeys.size;
  const totalCount = ACHIEVEMENT_CATALOG.length;

  return (
    <div className="achievements-screen">
      <p className="stage-select-hint">
        게임을 플레이하면서 자연스럽게 달성되는 목표들이에요. 조건을 채우면 여기서 직접 수령해야 골드를 받아요.
        <strong> {totalClaimed} / {totalCount}</strong> 달성
      </p>

      <div style={{ marginBottom: 16 }}>
        <button
          className="btn btn-ghost pvp-history-toggle"
          onClick={() => {
            const next = !showAchLeaderboard;
            setShowAchLeaderboard(next);
            if (next && achLeaderboard === null) loadAchLeaderboard();
          }}
        >
          {showAchLeaderboard ? '▲ 업적 랭킹 접기' : '🏅 업적 랭킹 보기 (누가 제일 많이 달성했을까?)'}
        </button>

        {showAchLeaderboard && (
          <div className="achievement-leaderboard">
            {achLeaderboard === null && <p className="stage-select-hint">불러오는 중...</p>}
            {achLeaderboard?.length === 0 && <p className="inventory-empty">아직 업적을 달성한 유저가 없어요.</p>}
            {achLeaderboard?.map((row) => (
              <div key={row.rank} className={`worldboss-contributor-row ${row.is_me ? 'inventory-row--equipped' : ''}`}>
                <span className="worldboss-contributor-rank">{['🥇', '🥈', '🥉'][row.rank - 1] ?? row.rank}</span>
                <span className="worldboss-contributor-nickname">
                  {row.equipped_title && <span className="app-title-badge">[{row.equipped_title}]</span>}
                  {row.nickname}{row.is_me && ' (나)'}
                </span>
                <span className="worldboss-contributor-damage">🏆{row.achievement_count}개</span>
              </div>
            ))}
            {myAchRank != null && achLeaderboard && !achLeaderboard.some((r) => r.is_me) && (
              <p className="stage-select-hint" style={{ marginTop: 8, marginBottom: 0 }}>내 순위: <strong style={{ color: 'var(--accent-gold)' }}>{myAchRank}위</strong></p>
            )}
          </div>
        )}
      </div>

      {error && <p className="shop-error">{error}</p>}

      {categories.map((cat) => {
        const catAchievements = ACHIEVEMENT_CATALOG.filter((a) => a.category === cat);
        const catClaimed = catAchievements.filter((a) => claimedKeys.has(a.key)).length;
        return (
        <div key={cat} className="inventory-section">
          <h3 className="inventory-section-title">
            {ACHIEVEMENT_CATEGORY_LABEL[cat] ?? cat}
            <span className="achievement-category-count"> {catClaimed}/{catAchievements.length}</span>
          </h3>
          <div className="achievement-list">
            {catAchievements.map((a) => {
              const current = statsWithCombatPower?.[a.stat] ?? 0;
              const claimed = claimedKeys.has(a.key);
              const eligible = current >= a.target;
              const progressPct = Math.min(100, Math.round((current / a.target) * 100));
              return (
                <div key={a.key} className={`achievement-row ${claimed ? 'achievement-row--claimed' : ''}`}>
                  <span className="achievement-icon">{a.icon}</span>
                  <div className="achievement-info">
                    <strong>{a.title}</strong>
                    <span className="achievement-desc">{a.desc}</span>
                    {!claimed && TITLE_BY_ACHIEVEMENT[a.key] && (
                      <span className="achievement-title-preview">🎖️ 칭호 "{TITLE_BY_ACHIEVEMENT[a.key]}" 획득 가능</span>
                    )}
                    {!claimed && (
                      <div className="achievement-progress-track">
                        <div className="achievement-progress-fill" style={{ width: `${progressPct}%` }} />
                        <span className="achievement-progress-text">{Math.min(current, a.target).toLocaleString()} / {a.target.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="achievement-actions">
                    <span className="achievement-reward">💰{a.reward.toLocaleString()}</span>
                    {claimed ? (
                      <>
                        <span className="achievement-done-badge">완료</span>
                        {TITLE_BY_ACHIEVEMENT[a.key] && (
                          <button
                            className={`btn btn-ghost achievement-title-btn ${equippedTitle === TITLE_BY_ACHIEVEMENT[a.key] ? 'active' : ''}`}
                            disabled={settingTitle}
                            onClick={() => handleSetTitle(a.key, TITLE_BY_ACHIEVEMENT[a.key])}
                          >
                            {equippedTitle === TITLE_BY_ACHIEVEMENT[a.key] ? '칭호 해제' : `"${TITLE_BY_ACHIEVEMENT[a.key]}" 장착`}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        className={`btn btn-ghost ${!eligible ? 'btn-unaffordable' : 'btn-neutral'}`}
                        disabled={!eligible || claimingKey === a.key}
                        onClick={() => handleClaim(a)}
                      >
                        {claimingKey === a.key ? '수령 중...' : eligible ? '수령' : '진행중'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}
