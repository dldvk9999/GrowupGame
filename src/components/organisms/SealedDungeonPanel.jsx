import { useEffect, useState } from 'react';
import { fetchSealLeaderboard, fetchMySealRank, fetchMySealCostumes, buySealCostume } from '../../lib/sealedDungeon';
import { SEAL_COSTUME_CATALOG } from '../../lib/sealCostumeCatalog';
import { setCostumeLoadout } from '../../lib/pvp';
import { showToast } from '../../lib/toast';
import InfoTooltip from '../InfoTooltip';

// 리팩토링(사용자 요청 - DungeonSelect.jsx 996줄을 패널별로 분리, atomic design organism): 원래 DungeonSelect.jsx 안의 SealedDungeonPanel를 그대로 옮김(로직 변경 없음)
export default function SealedDungeonPanel({ activeMonster, onEnter, entering, error, sealStatus, equippedCostumes, onCostumeLoadoutChange, onSealCostumePurchased, onSelectUser }) {
  const [leaderboard, setLeaderboard] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const [ownedCostumeKeys, setOwnedCostumeKeys] = useState(null);
  const [shopError, setShopError] = useState('');
  const [shopBusyKey, setShopBusyKey] = useState(null);

  useEffect(() => {
    Promise.all([fetchSealLeaderboard(), fetchMySealRank()])
      .then(([lb, rank]) => { setLeaderboard(lb); setMyRank(rank); })
      .catch(() => setLeaderboard([]));
  }, [sealStatus?.sealFragments]);

  useEffect(() => {
    fetchMySealCostumes().then(setOwnedCostumeKeys).catch(() => setOwnedCostumeKeys([]));
  }, [sealStatus?.sealFragments]);

  if (!activeMonster) return null;
  const keys = sealStatus?.sealKeys ?? 0;
  const fragments = sealStatus?.sealFragments ?? 0;
  const iAmInTop20 = leaderboard?.some((r) => r.is_me);

  async function handleBuyCostume(item) {
    setShopError('');
    setShopBusyKey(item.itemKey);
    try {
      await buySealCostume(item.itemKey);
      setOwnedCostumeKeys((prev) => [...(prev ?? []), item.itemKey]);
      onSealCostumePurchased?.();
      showToast(`🗝️ ${item.name}을(를) 구매했어요!`, 'success');
    } catch (err) {
      const message = err.message ?? '구매에 실패했어요.';
      setShopError(message);
      showToast(message, 'error');
    } finally {
      setShopBusyKey(null);
    }
  }

  async function handleToggleEquip(item) {
    const isEquipped = (equippedCostumes ?? []).includes(item.itemKey);
    const withoutSameSlot = (equippedCostumes ?? []).filter((k) => k !== item.itemKey && !k.startsWith(`${item.slot}_`));
    const next = isEquipped ? withoutSameSlot : [...withoutSameSlot, item.itemKey];
    try {
      await setCostumeLoadout(next);
      onCostumeLoadoutChange?.(next);
    } catch (err) {
      showToast(err.message ?? '착용 변경에 실패했어요.', 'error');
    }
  }

  return (
    <div>
      <p className="stage-select-hint">
        <InfoTooltip text="이 던전은 골드도 경험치도 안 줘요. 대신 '봉인의 파편'을 모아 누적 랭킹에 도전하는 던전이에요. 열쇠는 하루에 1개만 자연 생성되고 최대 3개까지만 모아둘 수 있어요(골드로 살 수 없어요). 보스는 루비 던전보다 훨씬 강하니 장비/스킬을 잘 갖추고 도전해보세요." />
        {' '}봉인된 던전 안내
      </p>
      {error && <p className="shop-error">{error}</p>}
      <p className="stage-select-hint" style={{ color: 'var(--accent-gold)' }}>
        🗝️ 보유 열쇠: {keys} / 3 (내일 자정 이후 자연 +1) · 🧩 누적 파편: {fragments.toLocaleString()}
      </p>
      <button
        className={`btn btn-challenge ${keys <= 0 ? 'btn-unaffordable' : ''}`}
        disabled={entering || keys <= 0}
        onClick={() => {
          if (keys <= 0) {
            showToast('봉인의 열쇠가 없어요. 하루에 하나씩 자연 생성돼요.', 'error');
            return;
          }
          onEnter();
        }}
      >
        {keys <= 0 ? '열쇠 없음' : entering ? '입장 중...' : '🗝️ 봉인된 던전 도전하기 (경험치 없음, 파편 +3)'}
      </button>

      <div style={{ marginTop: 18 }}>
        <h4 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🛍️ 봉인의 상점 (파편으로 구매, 전투 스탯 영향 없음)</h4>
        {shopError && <p className="shop-error">{shopError}</p>}
        <div className="inventory-list">
          {SEAL_COSTUME_CATALOG.map((item) => {
            const owned = (ownedCostumeKeys ?? []).includes(item.itemKey);
            const equipped = (equippedCostumes ?? []).includes(item.itemKey);
            return (
              <div key={item.itemKey} className={`inventory-row ${equipped ? 'inventory-row--equipped' : ''}`}>
                <span className="inventory-icon" style={{ color: item.color }}>{item.icon}</span>
                <span className="inventory-name">{item.name} <span className="owned-skill-rarity">({item.slotLabel})</span></span>
                <div className="inventory-row-actions">
                  {owned ? (
                    <button className={`btn ${equipped ? 'btn-neutral' : 'btn-ghost'}`} onClick={() => handleToggleEquip(item)}>
                      {equipped ? '착용중' : '착용'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-challenge"
                      disabled={shopBusyKey === item.itemKey || fragments < item.price}
                      onClick={() => handleBuyCostume(item)}
                    >
                      {shopBusyKey === item.itemKey ? '구매 중...' : `🧩 ${item.price}로 구매`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {leaderboard && leaderboard.length > 0 && (
        <div className="worldboss-top-contributors">
          <h4 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🏅 누적 파편 TOP {leaderboard.length}</h4>
          <div className="worldboss-contributor-list">
            {leaderboard.map((row) => (
              <div
                key={row.rank}
                className={`worldboss-contributor-row ${row.is_me ? 'inventory-row--equipped' : ''}`}
                onClick={() => row.user_id && onSelectUser?.(row.user_id)}
                style={{ cursor: row.user_id ? 'pointer' : 'default' }}
              >
                <span className="worldboss-contributor-rank">{['🥇', '🥈', '🥉'][row.rank - 1] ?? row.rank}</span>
                <span className="worldboss-contributor-nickname">
                  {row.equipped_title && <span className="app-title-badge">[{row.equipped_title}]</span>}
                  {row.nickname}{row.is_me && ' (나)'}
                </span>
                <span className="worldboss-contributor-damage">🧩{row.seal_fragments.toLocaleString()}</span>
              </div>
            ))}
          </div>
          {myRank != null && !iAmInTop20 && (
            <p className="stage-select-hint" style={{ marginTop: 8, marginBottom: 0 }}>내 순위: <strong style={{ color: 'var(--accent-gold)' }}>{myRank}위</strong></p>
          )}
        </div>
      )}
    </div>
  );
}
