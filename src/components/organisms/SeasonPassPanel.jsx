import { useEffect, useState } from 'react';
import { SEASON_PASS_MAX_TIER, getSeasonTierInfo, fetchMySeasonPass, claimSeasonTier } from '../../lib/seasonPass';
import { showToast } from '../../lib/toast';
import InfoTooltip from '../InfoTooltip';

// 리팩토링(아토믹디자인 organism) - 매달 리셋되는 20단계 보상트랙. 포인트는 출석체크(+20)/
// 가이드미션 완료(+30)로만 쌓임(migration 178) - 여기선 순수 표시/수령만 담당.
export default function SeasonPassPanel({ onClose, onGoldChange, onRubiesChange }) {
  const [pass, setPass] = useState(undefined); // undefined=로딩중
  const [claimingTier, setClaimingTier] = useState(null);

  useEffect(() => {
    fetchMySeasonPass().then(setPass).catch(() => setPass({ points: 0, claimedTiers: [] }));
  }, []);

  async function handleClaim(tier) {
    setClaimingTier(tier);
    try {
      const { newGold, newRubies } = await claimSeasonTier(tier);
      onGoldChange?.(newGold);
      if (newRubies != null) onRubiesChange?.(newRubies);
      setPass((p) => ({ ...p, claimedTiers: [...p.claimedTiers, tier] }));
      showToast(`🎫 시즌 ${tier}단계 보상을 받았어요!`, 'success');
    } catch (err) {
      showToast(err.message ?? '수령에 실패했어요.', 'error');
    } finally {
      setClaimingTier(null);
    }
  }

  const points = pass?.points ?? 0;
  const claimed = new Set(pass?.claimedTiers ?? []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel attendance-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🎫 시즌 패스</h3>
          <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <p className="stage-select-hint">
          <InfoTooltip text="매달 1일에 초기화되는 보상 트랙이에요. 출석체크(+20)와 가이드미션 완료(+30)로 포인트를 모아서 20단계까지 순서대로 수령할 수 있어요." />
          {' '}이번 달 포인트: <strong style={{ color: 'var(--accent-gold)' }}>{points.toLocaleString()}</strong>
        </p>

        {pass === undefined ? (
          <p className="stage-select-hint">불러오는 중...</p>
        ) : (
          <div className="inventory-list">
            {Array.from({ length: SEASON_PASS_MAX_TIER }, (_, i) => i + 1).map((tier) => {
              const { required, gold, rubies } = getSeasonTierInfo(tier);
              const isClaimed = claimed.has(tier);
              const canClaim = !isClaimed && points >= required;
              return (
                <div key={tier} className={`inventory-row ${isClaimed ? 'inventory-row--equipped' : ''}`}>
                  <span className="inventory-icon">{tier % 5 === 0 ? '🎁' : '🎫'}</span>
                  <span className="inventory-name">
                    {tier}단계 <span className="owned-skill-rarity">({required.toLocaleString()}P)</span>
                    <br />
                    <span className="mypage-locked-hint">💰{gold.toLocaleString()}{rubies > 0 && ` · 💎${rubies}`}</span>
                  </span>
                  <div className="inventory-row-actions">
                    {isClaimed ? (
                      <span className="mypage-locked-hint">수령완료</span>
                    ) : (
                      <button
                        type="button"
                        className={`btn ${canClaim ? 'btn-challenge' : 'btn-ghost'}`}
                        disabled={!canClaim || claimingTier === tier}
                        onClick={() => handleClaim(tier)}
                      >
                        {claimingTier === tier ? '수령 중...' : canClaim ? '수령' : '🔒'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
