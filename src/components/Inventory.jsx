import { useState } from 'react';
import { getItem, SLOTS, MAX_ENHANCE_LEVEL, getEnhancedStatBonus, getPossessionBonus } from '../lib/itemCatalog';
import { equipItem, unequipItem } from '../lib/inventory';
import { synthesizeEquipment } from '../lib/equipmentGacha';
import { showToast } from '../lib/toast';

const SLOT_ORDER = Object.keys(SLOTS);
const SYNTHESIS_COST = 10;

export default function Inventory({ userId, inventory, onInventoryChange }) {
  const [busyId, setBusyId] = useState(null);
  const [synthesizingId, setSynthesizingId] = useState(null);
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

  async function handleSynthesize(row) {
    setError('');
    const level = row.enhance_level ?? 0;
    if (level < SYNTHESIS_COST) {
      showToast(`강화수치가 ${SYNTHESIS_COST} 이상이어야 합성할 수 있어요.`, 'error');
      return;
    }
    setSynthesizingId(row.id);
    try {
      const result = await synthesizeEquipment(row.item_key);
      const targetItem = getItem(result.target_item_key);
      showToast(`합성 성공! ${targetItem?.name ?? '상위 등급'} +${result.target_new_level}`, 'success');
      onInventoryChange();
    } catch (err) {
      showToast(err.message ?? '합성에 실패했어요.', 'error');
    } finally {
      setSynthesizingId(null);
    }
  }

  return (
    <div className="inventory-screen">
      <h2>인벤토리</h2>
      <p className="stage-select-hint">
        같은 등급을 또 뽑으면 자동으로 강화(+1, 최대 +{MAX_ENHANCE_LEVEL})돼요.
        <strong> 보유효과는 장착하지 않아도 항상 적용</strong>되고, 강화될수록 같이 올라가요.
        강화수치 {SYNTHESIS_COST} 이상이면 <strong>합성</strong>해서 상위 등급의 강화수치를 1 올릴 수 있어요.
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
                const canSynthesize = level >= SYNTHESIS_COST && item.rarityOrder < 5;
                return (
                  <div key={row.id} className={`inventory-row ${row.equipped ? 'inventory-row--equipped' : ''}`}>
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
                    <div className="inventory-row-actions">
                      {item.rarityOrder < 5 && (
                        <button
                          className={`btn btn-ghost ${!canSynthesize ? 'btn-unaffordable' : ''}`}
                          disabled={synthesizingId === row.id}
                          onClick={() => handleSynthesize(row)}
                          title={`강화수치 ${SYNTHESIS_COST} 소모 → 상위 등급 +1`}
                        >
                          {synthesizingId === row.id ? '합성 중...' : `합성 (-${SYNTHESIS_COST})`}
                        </button>
                      )}
                      <button
                        className={`btn ${row.equipped ? 'btn-neutral' : 'btn-ghost'}`}
                        disabled={busyId === row.id}
                        onClick={() => handleEquip(row)}
                      >
                        {row.equipped ? '장착중' : '장착'}
                      </button>
                    </div>
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
