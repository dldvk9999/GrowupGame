import { useState } from 'react';
import { getItem, MAX_ENHANCE_LEVEL, getEnhancedStatBonus } from '../lib/itemCatalog';
import { equipItem, unequipItem } from '../lib/inventory';

export default function Inventory({ userId, inventory, onInventoryChange }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function handleEquip(row) {
    setError('');
    setBusyId(row.id);
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
      setBusyId(null);
    }
  }

  return (
    <div className="inventory-screen">
      <h2>인벤토리</h2>
      <p className="stage-select-hint">
        상점에서 뽑은 장비를 장착/해제할 수 있어요. 같은 등급을 또 뽑으면 자동으로 강화(+1, 최대 +{MAX_ENHANCE_LEVEL})돼요.
      </p>

      {error && <p className="shop-error">{error}</p>}

      <div className="inventory-list">
        {inventory.length === 0 && <p className="inventory-empty">보유한 장비가 없어요. 상점에서 뽑아보세요.</p>}
        {inventory.map((row) => {
          const item = getItem(row.item_key);
          if (!item) return null;
          const level = row.enhance_level ?? 0;

          return (
            <div key={row.id} className="inventory-row">
              <span className="inventory-icon" style={{ color: item.color }}>{item.icon}</span>
              <span className="inventory-name">
                {item.name} {level > 0 && <span className="enhance-badge">+{level}</span>}
              </span>
              <span className="inventory-stat">
                +{getEnhancedStatBonus(item, level)} {item.statKey.toUpperCase()}
              </span>
              <button
                className={`btn ${row.equipped ? 'btn-neutral' : 'btn-ghost'}`}
                disabled={busyId === row.id}
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
