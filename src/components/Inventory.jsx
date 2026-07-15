import { useState } from 'react';
import { getItem, SLOTS, MAX_ENHANCE_LEVEL, getEnhancedStatBonus, getPossessionBonus } from '../lib/itemCatalog';
import { equipItem, unequipItem } from '../lib/inventory';

const SLOT_ORDER = Object.keys(SLOTS);

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
        같은 등급을 또 뽑으면 자동으로 강화(+1, 최대 +{MAX_ENHANCE_LEVEL})돼요.
        <strong> 보유효과는 장착하지 않아도 항상 적용</strong>되고, 강화될수록 같이 올라가요.
      </p>

      {error && <p className="shop-error">{error}</p>}

      {inventory.length === 0 && <p className="inventory-empty">보유한 장비가 없어요. 상점에서 뽑아보세요.</p>}

      {SLOT_ORDER.map((slot) => {
        const rows = inventory
          .filter((r) => r.slot === slot)
          .sort((a, b) => {
            const itemA = getItem(a.item_key);
            const itemB = getItem(b.item_key);
            return (itemB?.rarityOrder ?? 0) - (itemA?.rarityOrder ?? 0);
          });
        if (rows.length === 0) return null;
        return (
          <div key={slot} className="inventory-section">
            <h3 className="inventory-section-title">{SLOTS[slot].icon} {SLOTS[slot].label}</h3>
            <div className="inventory-list">
              {rows.map((row) => {
                const item = getItem(row.item_key);
                if (!item) return null;
                const level = row.enhance_level ?? 0;
                return (
                  <div key={row.id} className="inventory-row">
                    <span className="inventory-icon" style={{ color: item.color }}>{item.icon}</span>
                    <span className="inventory-name">
                      {item.name} {level > 0 && <span className="enhance-badge">+{level}</span>}
                    </span>
                    <span className="inventory-stat-group">
                      <span className="inventory-stat">
                        장착 시 +{getEnhancedStatBonus(item, level)} {item.statKey.toUpperCase()}
                      </span>
                      <span className="inventory-stat inventory-stat--possession">
                        보유효과 +{getPossessionBonus(item, level)} {item.statKey.toUpperCase()}
                      </span>
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
      })}
    </div>
  );
}
