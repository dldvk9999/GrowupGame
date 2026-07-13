import { useState } from 'react';
import { ITEM_CATALOG, SLOTS, getItem } from '../lib/itemCatalog';
import { buyItem, equipItem, unequipItem } from '../lib/inventory';

const SLOT_ORDER = Object.keys(SLOTS);

export default function Shop({ userId, gold, inventory, onInventoryChange, onGoldChange }) {
  const [activeSlot, setActiveSlot] = useState('weapon');
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');

  const ownedKeys = new Set(inventory.map((i) => i.item_key));

  async function handleBuy(itemKey, price) {
    setError('');
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

  const slotItems = ITEM_CATALOG.filter((i) => i.slot === activeSlot);

  return (
    <div className="shop-screen">
      <div className="shop-header">
        <h2>상점</h2>
        <span className="gold-display">💰 {gold.toLocaleString()}</span>
      </div>

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
                  className="btn btn-neutral"
                  disabled={!canAfford || busyKey === item.itemKey}
                  onClick={() => handleBuy(item.itemKey, item.price)}
                >
                  구매
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="inventory-title">내 인벤토리</h3>
      <div className="inventory-list">
        {inventory.length === 0 && <p className="inventory-empty">보유한 아이템이 없어요.</p>}
        {inventory.map((row) => {
          const item = getItem(row.item_key);
          if (!item) return null;
          return (
            <div key={row.id} className="inventory-row">
              <span className="inventory-icon" style={{ color: item.color }}>{item.icon}</span>
              <span className="inventory-name">{item.name}</span>
              <span className="inventory-stat">+{item.statBonus} {item.statKey.toUpperCase()}</span>
              <button
                className={`btn ${row.equipped ? 'btn-neutral' : 'btn-ghost'}`}
                disabled={busyKey === row.id}
                onClick={() => handleEquip(row)}
              >
                {row.equipped ? '장착중' : '장착'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
