import { useState, useEffect } from 'react';
import { ACHIEVEMENT_CATALOG, ACHIEVEMENT_CATEGORY_LABEL, fetchClaimedAchievements, claimAchievement } from '../lib/achievements';
import { showToast } from '../lib/toast';

/**
 * 업적 목록 화면. stats(현재 진행도 스냅샷)는 App.jsx가 이미 들고 있는 값들을
 * 그대로 내려받아서 별도 서버 호출 없이 프로그레스바를 계산한다.
 * 실제 수령 검증은 claim_achievement RPC가 서버에서 다시 하므로, 여기 계산은 표시용일 뿐.
 */
export default function Achievements({ userId, stats, onGoldChange, gold }) {
  const [claimedKeys, setClaimedKeys] = useState(null);
  const [claimingKey, setClaimingKey] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    fetchClaimedAchievements(userId).then(setClaimedKeys).catch(() => setClaimedKeys(new Set()));
  }, [userId]);

  async function handleClaim(achievement) {
    setError('');
    setClaimingKey(achievement.key);
    try {
      const reward = await claimAchievement(achievement.key);
      onGoldChange(gold + reward);
      setClaimedKeys((prev) => new Set(prev).add(achievement.key));
      showToast(`업적 달성! "${achievement.title}" 💰 ${reward.toLocaleString()} 획득!`, 'success');
    } catch (err) {
      setError(err.message ?? '수령에 실패했어요.');
      showToast(err.message ?? '수령에 실패했어요.', 'error');
    } finally {
      setClaimingKey(null);
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

      {error && <p className="shop-error">{error}</p>}

      {categories.map((cat) => (
        <div key={cat} className="inventory-section">
          <h3 className="inventory-section-title">{ACHIEVEMENT_CATEGORY_LABEL[cat] ?? cat}</h3>
          <div className="achievement-list">
            {ACHIEVEMENT_CATALOG.filter((a) => a.category === cat).map((a) => {
              const current = stats?.[a.stat] ?? 0;
              const claimed = claimedKeys.has(a.key);
              const eligible = current >= a.target;
              const progressPct = Math.min(100, Math.round((current / a.target) * 100));
              return (
                <div key={a.key} className={`achievement-row ${claimed ? 'achievement-row--claimed' : ''}`}>
                  <span className="achievement-icon">{a.icon}</span>
                  <div className="achievement-info">
                    <strong>{a.title}</strong>
                    <span className="achievement-desc">{a.desc}</span>
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
                      <span className="achievement-done-badge">완료</span>
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
      ))}
    </div>
  );
}
