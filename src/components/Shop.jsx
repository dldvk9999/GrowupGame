import { useState } from 'react';
import { ITEM_CATALOG, SLOTS, getItem, getEnhancedStatBonus, estimateEnhance, MAX_ENHANCE_LEVEL } from '../lib/itemCatalog';
import { buyItem, equipItem, unequipItem } from '../lib/inventory';
import { enhanceItem } from '../lib/enhance';
import { showToast } from '../lib/toast';
import EquipmentGacha from './EquipmentGacha';

const SLOT_ORDER = Object.keys(SLOTS);

export default function Shop({ userId, gold, inventory, totalEquipmentDraws, onInventoryChange, onGoldChange }) {
  const [mode, setMode] = useState('buy'); // 'buy' | 'gacha'
  const [activeSlot, setActiveSlot] = useState('weapon');
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');
  const [enhanceResult, setEnhanceResult] = useState(null); // { id, success, newLevel }

  const ownedKeys = new Set(inventory.map((i) => i.item_key));

  async function handleBuy(itemKey, price) {
    setError('');
    if (gold < price) {
      showToast('골드가 부족합니다.', 'error');
      setError('골드가 부족합니다.');
      return;
    }
    setBusyKey(itemKey);
    try {
      await buyItem(userId, itemKey);
      onGoldChange(gold - price);
      onInventoryChange();
    } catch (err) {
      setError(err.message ?? '구매에 실패했어요.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleEquip(row) {
    setBusyKey(row.id);
    try {
      if (row.equipped) {
        await unequipItem(row.id);
      } else {
        await equipItem(userId, row.id, row.slot);
      }
      onInventoryChange();
    } catch (err) {
      setError(err.message ?? '장착에 실패했어요.');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleEnhance(row, cost) {
    setError('');
    setEnhanceResult(null);
    if (gold < cost) {
      showToast('골드가 부족합니다.', 'error');
      setError('골드가 부족합니다.');
      return;
    }
    setBusyKey(row.id);
    try {
      const result = await enhanceItem(row.id);
      onGoldChange(gold - result.cost);
      setEnhanceResult({ id: row.id, success: result.success, newLevel: result.new_level });
      onInventoryChange();
    } catch (err) {
      setError(err.message ?? '강화에 실패했어요.');
    } finally {
      setBusyKey(null);
    }
  }

  const slotItems = ITEM_CATALOG.filter((i) => i.slot === activeSlot);

  return (
    <div className="shop-screen">
      <div className="shop-header">
        <h2>상점</h2>
        <span className="gold-display">💰 {gold.toLocaleString()}</span>
      </div>

      <div className="shop-mode-toggle">
        <button className={`shop-tab ${mode === 'buy' ? 'active' : ''}`} onClick={() => setMode('buy')}>🛒 직접 구매</button>
        <button className={`shop-tab ${mode === 'gacha' ? 'active' : ''}`} onClick={() => setMode('gacha')}>🎁 장비 뽑기</button>
      </div>

      {mode === 'gacha' ? (
        <EquipmentGacha
          gold={gold}
          totalDraws={totalEquipmentDraws ?? 0}
          onGoldChange={onGoldChange}
          onInventoryChange={onInventoryChange}
        />
      ) : (
      <>
      <div className="shop-tabs">
        {SLOT_ORDER.map((slot) => (
          <button
            key={slot}
            className={`shop-tab ${activeSlot === slot ? 'active' : ''}`}
            onClick={() => setActiveSlot(slot)}
          >
            {SLOTS[slot].icon} {SLOTS[slot].label}
          </button>
        ))}
      </div>

      {error && <p className="shop-error">{error}</p>}

      <div className="shop-grid">
        {slotItems.map((item) => {
          const owned = ownedKeys.has(item.itemKey);
          const canAfford = gold >= item.price;
          return (
            <div key={item.itemKey} className="shop-card" style={{ borderColor: item.color }}>
              <span className="shop-card-icon">{item.icon}</span>
              <strong style={{ color: item.color }}>{item.name}</strong>
              <span className="shop-card-stat">+{item.statBonus} {item.statKey.toUpperCase()}</span>
              <span className="shop-card-price">💰 {item.price.toLocaleString()}</span>
              {owned ? (
                <span className="shop-card-owned">보유중</span>
              ) : (
                <button
                  className={`btn btn-neutral ${!canAfford ? 'btn-unaffordable' : ''}`}
                  disabled={busyKey === item.itemKey}
                  onClick={() => handleBuy(item.itemKey, item.price)}
                >
                  구매
                </button>
              )}
            </div>
          );
        })}
      </div>
      </>
      )}

      <h3 className="inventory-title">내 인벤토리</h3>
      <div className="inventory-list">
        {inventory.length === 0 && <p className="inventory-empty">보유한 아이템이 없어요.</p>}
        {inventory.map((row) => {
          const item = getItem(row.item_key);
          if (!item) return null;
          const level = row.enhance_level ?? 0;
          const maxed = level >= MAX_ENHANCE_LEVEL;
          const { rate, cost } = estimateEnhance(item, level);
          const canAffordEnhance = gold >= cost;
          const lastResult = enhanceResult?.id === row.id ? enhanceResult : null;

          return (
            <div key={row.id} className="inventory-row inventory-row--enhance">
              <div className="inventory-main">
                <span className="inventory-icon" style={{ color: item.color }}>{item.icon}</span>
                <span className="inventory-name">
                  {item.name} {level > 0 && <span className="enhance-badge">+{level}</span>}
                </span>
                <span className="inventory-stat">
                  +{getEnhancedStatBonus(item, level)} {item.statKey.toUpperCase()}
                </span>
                <button
                  className={`btn ${row.equipped ? 'btn-neutral' : 'btn-ghost'}`}
                  disabled={busyKey === row.id}
                  onClick={() => handleEquip(row)}
                >
                  {row.equipped ? '장착중' : '장착'}
                </button>
              </div>

              <div className="enhance-row">
                {maxed ? (
                  <span className="enhance-maxed">최대 강화 완료</span>
                ) : (
                  <>
                    <span className="enhance-info">
                      성공률 {Math.round(rate * 100)}% · 💰 {cost.toLocaleString()}
                    </span>
                    <button
                      className={`btn btn-neutral btn-enhance ${!canAffordEnhance ? 'btn-unaffordable' : ''}`}
                      disabled={busyKey === row.id}
                      onClick={() => handleEnhance(row, cost)}
                    >
                      강화
                    </button>
                  </>
                )}
                {lastResult && (
                  <span className={`enhance-result ${lastResult.success ? 'ok' : 'fail'}`}>
                    {lastResult.success ? `✨ 성공! +${lastResult.newLevel}` : '💨 실패...'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
