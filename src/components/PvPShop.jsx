import { useEffect, useState, useCallback } from 'react';
import { getItem, RARITIES } from '../lib/itemCatalog';
import { fetchPvpShop, fetchMyCostumes, buyPvpCostume } from '../lib/pvp';
import { showToast } from '../lib/toast';

/** 다음 정시(HH:00:00)까지 남은 시간을 "MM:SS" 형태로, 정시가 되면 onRefresh 콜백 1회 호출 */
function useCountdownToNextHour(onRefresh) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    let firedRefresh = false;
    function tick() {
      const now = new Date();
      const next = new Date(now);
      next.setMinutes(0, 0, 0);
      next.setHours(now.getHours() + 1);
      const diffSec = Math.max(0, Math.floor((next - now) / 1000));
      const mm = String(Math.floor(diffSec / 60)).padStart(2, '0');
      const ss = String(diffSec % 60).padStart(2, '0');
      setRemaining(`${mm}:${ss}`);
      if (diffSec <= 1 && !firedRefresh) {
        firedRefresh = true;
        setTimeout(() => { onRefresh?.(); firedRefresh = false; }, 1200); // 정시 직후 서버가 갱신할 여유(1.2초)를 두고 재조회
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [onRefresh]);
  return remaining;
}

export default function PvPShop({ userId, currency, onCurrencyChange }) {
  const [listings, setListings] = useState([]);
  const [owned, setOwned] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState(null);
  const [error, setError] = useState('');

  const loadShop = useCallback(async () => {
    setLoading(true);
    try {
      const [shopList, mine] = await Promise.all([fetchPvpShop(), fetchMyCostumes(userId)]);
      setListings(shopList);
      setOwned(mine);
      setError('');
    } catch (err) {
      setError(err.message ?? '상점을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const nextRefreshIn = useCountdownToNextHour(loadShop);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  async function handleBuy(listing) {
    setError('');
    if (currency < listing.price) {
      showToast(`PvP 재화가 ${(listing.price - currency).toLocaleString()} 부족해요.`, 'error');
      return;
    }
    if (owned.has(listing.item_key)) {
      showToast('이미 보유한 코스튬입니다.', 'error');
      return;
    }
    setBuyingId(listing.id);
    try {
      await buyPvpCostume(listing.id);
      onCurrencyChange(currency - listing.price);
      setOwned((prev) => new Set(prev).add(listing.item_key));
      showToast('코스튬을 구매했어요!', 'success');
    } catch (err) {
      showToast(err.message ?? '구매에 실패했어요.', 'error');
    } finally {
      setBuyingId(null);
    }
  }

  return (
    <div className="pvp-shop">
      <div className="shop-header">
        <span className="gold-display">🎖️ {currency.toLocaleString()}</span>
      </div>
      <p className="stage-select-hint">
        진열대는 매시 정각에 10개로 새로 갱신돼요(<strong style={{ color: 'var(--accent-gold)' }}>{nextRefreshIn}</strong> 후 갱신). 등급이 높을수록 나올 확률이 낮아요. 승리 보상으로 모은 PvP 재화로 코스튬을 모아보세요 — 노멀 등급도 꽤 비싸요.
      </p>

      {error && <p className="shop-error">{error}</p>}
      {loading && <p className="app-loading">불러오는 중...</p>}

      <div className="pvp-shop-grid">
        {listings.map((listing) => {
          const item = getItem(listing.item_key);
          if (!item) return null;
          const isOwned = owned.has(listing.item_key);
          const canAfford = currency >= listing.price;
          return (
            <div key={listing.id} className={`pvp-shop-card ${listing.is_on_sale ? 'pvp-shop-card--sale' : ''}`} style={{ borderColor: item.color }}>
              {listing.is_on_sale && <span className="pvp-shop-sale-badge">🔥 20% 할인</span>}
              <span className="shop-card-icon">{item.icon}</span>
              <strong style={{ color: item.color }}>{item.name}</strong>
              <span className="pvp-shop-rarity" style={{ color: RARITIES[listing.item_key.split('_')[1]]?.color }}>
                {RARITIES[listing.item_key.split('_')[1]]?.label}
              </span>
              <span className="shop-card-price">🎖️ {listing.price.toLocaleString()}</span>
              {isOwned ? (
                <span className="shop-card-owned">보유중</span>
              ) : (
                <button
                  className={`btn btn-neutral ${!canAfford ? 'btn-unaffordable' : ''}`}
                  disabled={buyingId === listing.id}
                  onClick={() => handleBuy(listing)}
                >
                  {buyingId === listing.id ? '구매 중...' : '구매'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
