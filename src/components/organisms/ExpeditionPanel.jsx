import { useEffect, useState } from 'react';
import { EXPEDITION_TIERS, startExpedition, claimExpedition, fetchMyExpeditions } from '../../lib/expedition';
import { showToast } from '../../lib/toast';
import { formatRemaining } from '../../lib/formatTime';
import InfoTooltip from '../InfoTooltip';

// 리팩토링(사용자 요청 - DungeonSelect.jsx 996줄을 패널별로 분리, atomic design organism): 원래 DungeonSelect.jsx 안의 ExpeditionPanel를 그대로 옮김(로직 변경 없음)
export default function ExpeditionPanel({ userId, onGoldChange, onRubiesChange, onSealFragmentsChange }) {
  const [expeditions, setExpeditions] = useState(undefined); // undefined=로딩중, [] 이상=배열
  const [totalSlots, setTotalSlots] = useState(1);
  const [starting, setStarting] = useState(false);
  const [claimingId, setClaimingId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');

  function loadExpeditions() {
    if (!userId) return;
    fetchMyExpeditions().then(({ expeditions: rows, totalSlots: slots }) => {
      setExpeditions(rows);
      setTotalSlots(slots);
    }).catch(() => setExpeditions([]));
  }

  useEffect(() => { loadExpeditions(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleStart(tier) {
    setError('');
    setStarting(true);
    try {
      await startExpedition(tier);
      loadExpeditions();
    } catch (err) {
      setError(err.message ?? '파견 시작에 실패했어요.');
      showToast(err.message ?? '파견 시작에 실패했어요.', 'error');
    } finally {
      setStarting(false);
    }
  }

  async function handleClaim(expeditionId) {
    setClaimingId(expeditionId);
    try {
      const res = await claimExpedition(expeditionId);
      showToast(`🧭 파견 완료! 골드 +${res.gold.toLocaleString()}`, 'success');
      onGoldChange?.(res.gold);
      if (res.bonusCurrency === 'ruby') {
        onRubiesChange?.(res.bonusAmount);
        showToast(`💎 파견 중 루비를 발견했어요! +${res.bonusAmount}`, 'success');
      } else if (res.bonusCurrency === 'seal_fragment') {
        onSealFragmentsChange?.(res.bonusAmount);
        showToast(`🧩 파견 중 봉인의 파편을 발견했어요! +${res.bonusAmount}`, 'success');
      }
      loadExpeditions();
    } catch (err) {
      showToast(err.message ?? '수령에 실패했어요.', 'error');
    } finally {
      setClaimingId(null);
    }
  }

  if (expeditions === undefined) {
    return <p className="stage-select-hint">불러오는 중...</p>;
  }

  const hasFreeSlot = expeditions.length < totalSlots;

  return (
    <div>
      <p className="stage-select-hint">
        <InfoTooltip text="몬스터를 잠깐 파견 보내면 시간이 지난 뒤 골드를 받을 수 있어요. 전투/자동사냥과 전혀 겹치지 않고 병행되는 별개의 타이머예요 — 앱을 꺼두고 있어도 시간은 그대로 흘러요. 오프라인 방치 보상보다 훨씬 긴 시간(최대 12시간)을 커버해요. 레벨 100마다 동시에 보낼 수 있는 파견 슬롯이 1개씩 늘어나요. 중간/긴 파견은 낮은 확률로 골드 외에 루비나 봉인의 파편도 소량 얻을 수 있어요(파견이 길수록 확률이 높아져요)." />
        {' '}파견 안내
      </p>
      <p className="stage-select-hint" style={{ marginTop: 0, color: 'var(--accent-gold)' }}>
        파견 슬롯 {expeditions.length}/{totalSlots}
      </p>

      {error && <p className="shop-error">{error}</p>}

      {expeditions.map((exp) => {
        const remainingMs = new Date(exp.startedAt).getTime() + exp.durationSeconds * 1000 - now;
        const isDone = remainingMs <= 0;
        return (
          <div key={exp.id} className="worldboss-hp-card" style={{ marginBottom: 10 }}>
            <div className="worldboss-hp-title">
              {EXPEDITION_TIERS[exp.tier].icon} {EXPEDITION_TIERS[exp.tier].label} 진행 중
            </div>
            {isDone ? (
              <button className="btn btn-challenge" disabled={claimingId === exp.id} onClick={() => handleClaim(exp.id)} style={{ marginTop: 10 }}>
                {claimingId === exp.id ? '수령 중...' : '🎁 파견 완료! 보상 받기'}
              </button>
            ) : (
              <p className="mypage-locked-hint" style={{ margin: '4px 0 0' }}>
                남은 시간: {formatRemaining(remainingMs)}
              </p>
            )}
          </div>
        );
      })}

      {hasFreeSlot && (
        <div className="gacha-draw-buttons">
          {Object.entries(EXPEDITION_TIERS).map(([tier, meta]) => (
            <button key={tier} className="btn btn-neutral" disabled={starting} onClick={() => handleStart(tier)}>
              {meta.icon} {meta.label} ({meta.hours < 1 ? `${meta.hours * 60}분` : `${meta.hours}시간`})
            </button>
          ))}
        </div>
      )}
      {!hasFreeSlot && expeditions.length > 0 && (
        <p className="stage-select-hint">슬롯이 가득 찼어요. 완료된 파견을 수령하거나 레벨을 올려보세요.</p>
      )}
    </div>
  );
}
