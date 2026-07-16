import { useEffect, useState } from 'react';
import { getItem, RARITIES } from '../lib/itemCatalog';
import { fetchPvpShop, fetchMyCostumes, buyPvpCostume } from '../lib/pvp';
import { showToast } from '../lib/toast';

export default function PvPShop({ userId, currency, onCurrencyChange }) {
  const [listings, setListings] = useState([]);
  const [owned, setOwned] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [shopList, mine] = await Promise.all([fetchPvpShop(), fetchMyCostumes(userId)]);
        setListings(shopList);
        setOwned(mine);
      } catch (err) {
        setError(err.message ?? '상점을 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  async function handleBuy(listing) {
    setError('');
    if (currency < listing.price) {
      showToast('PvP 재화가 부족합니다.', 'error');
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
        진열대는 매시 정각에 10개로 새로 갱신돼요. 등급이 높을수록 나올 확률이 낮아요. 승리 보상으로 모은 PvP 재화로 코스튬을 모아보세요 — 노멀 등급도 꽤 비싸요.
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
            <div key={listing.id} className="pvp-shop-card" style={{ borderColor: item.color }}>
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
