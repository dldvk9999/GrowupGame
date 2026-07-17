import { useState, useEffect } from 'react';
import { getItem, SLOTS, MAX_ENHANCE_LEVEL, getEnhancedStatBonus, getPossessionBonus } from '../lib/itemCatalog';
import { equipItem, unequipItem } from '../lib/inventory';
import { synthesizeEquipment, synthesizeEquipmentBatch } from '../lib/equipmentGacha';
import { fetchMyCostumes, setCostumeLoadout } from '../lib/pvp';
import { showToast } from '../lib/toast';

const SLOT_ORDER = Object.keys(SLOTS);
const SYNTHESIS_COST = 10;

export default function Inventory({ userId, inventory, equippedCostumes, onInventoryChange, onCostumeLoadoutChange }) {
  const [subTab, setSubTab] = useState('equipment'); // 'equipment' | 'costume'
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

  async function handleSynthesizeAll(row) {
    setError('');
    const level = row.enhance_level ?? 0;
    if (level < SYNTHESIS_COST) {
      showToast(`강화수치가 ${SYNTHESIS_COST} 이상이어야 합성할 수 있어요.`, 'error');
      return;
    }
    setSynthesizingId(row.id);
    try {
      const result = await synthesizeEquipmentBatch(row.item_key);
      const targetItem = getItem(result.target_item_key);
      showToast(`일괄합성 완료! ${result.times}회 합성 → ${targetItem?.name ?? '상위 등급'} +${result.target_new_level}`, 'success');
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

      <div className="shop-tabs">
        <button className={`shop-tab ${subTab === 'equipment' ? 'active' : ''}`} onClick={() => setSubTab('equipment')}>
          🎒 장비
        </button>
        <button className={`shop-tab ${subTab === 'costume' ? 'active' : ''}`} onClick={() => setSubTab('costume')}>
          👗 코스튬
        </button>
      </div>

      {subTab === 'equipment' ? (
        <>
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
                            <>
                              <button
                                className={`btn btn-ghost ${!canSynthesize ? 'btn-unaffordable' : ''}`}
                                disabled={synthesizingId === row.id}
                                onClick={() => handleSynthesize(row)}
                                title={`강화수치 ${SYNTHESIS_COST} 소모 → 상위 등급 +1`}
                              >
                                {synthesizingId === row.id ? '처리 중...' : `합성 (-${SYNTHESIS_COST})`}
                              </button>
                              <button
                                className={`btn btn-ghost ${!canSynthesize ? 'btn-unaffordable' : ''}`}
                                disabled={synthesizingId === row.id}
                                onClick={() => handleSynthesizeAll(row)}
                                title="가능한 만큼 한번에 반복 합성"
                              >
                                {synthesizingId === row.id ? '처리 중...' : '일괄합성'}
                              </button>
                            </>
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
        </>
      ) : (
        <CostumeCloset
          userId={userId}
          equippedCostumes={equippedCostumes}
          onCostumeLoadoutChange={onCostumeLoadoutChange}
        />
      )}
    </div>
  );
}

/** PvP 상점에서 산 코스튬을 슬롯별로 착용/해제하는 화면 (스탯에는 영향 없고, 캐릭터 스프라이트에 배지로 표시됨) */
function CostumeCloset({ userId, equippedCostumes, onCostumeLoadoutChange }) {
  const [ownedKeys, setOwnedKeys] = useState(null); // null=로딩중
  const [pending, setPending] = useState(equippedCostumes ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    fetchMyCostumes(userId)
      .then((set) => setOwnedKeys(Array.from(set)))
      .catch(() => setOwnedKeys([]));
  }, [userId]);

  useEffect(() => {
    setPending(equippedCostumes ?? []);
  }, [equippedCostumes]);

  function toggleCostume(item) {
    setPending((prev) => {
      const isEquipped = prev.includes(item.itemKey);
      if (isEquipped) return prev.filter((k) => k !== item.itemKey);
      // 슬롯당 1개만 - 같은 슬롯의 기존 착용은 자동으로 교체
      const withoutSameSlot = prev.filter((k) => getItem(k)?.slot !== item.slot);
      return [...withoutSameSlot, item.itemKey];
    });
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      await setCostumeLoadout(pending);
      onCostumeLoadoutChange?.(pending);
      showToast('코스튬 착용을 저장했어요.', 'success');
    } catch (err) {
      setError(err.message ?? '코스튬 저장에 실패했어요.');
      showToast(err.message ?? '코스튬 저장에 실패했어요.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (ownedKeys === null) {
    return <p className="stage-select-hint">코스튬 목록을 불러오는 중...</p>;
  }

  if (ownedKeys.length === 0) {
    return <p className="inventory-empty">보유한 코스튬이 없어요. PvP 탭의 상점에서 구매해보세요.</p>;
  }

  const ownedItems = ownedKeys
    .map((key) => getItem(key))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.slot !== b.slot) return SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
      return b.rarityOrder - a.rarityOrder;
    });

  return (
    <div className="costume-closet">
      <p className="stage-select-hint">
        코스튬은 전투 스탯에 영향을 주지 않는 수집/과시용이에요. 슬롯(무기/방어구/장갑/신발)당 1개만 착용할 수 있고,
        착용하면 캐릭터 주위에 등급색 배지로 표시돼요.
      </p>

      {error && <p className="shop-error">{error}</p>}

      <div className="inventory-list">
        {ownedItems.map((item) => {
          const isPending = pending.includes(item.itemKey);
          return (
            <div key={item.itemKey} className={`inventory-row ${isPending ? 'inventory-row--equipped' : ''}`}>
              <span className="inventory-icon" style={{ color: item.color }}>{item.icon}</span>
              <span className="inventory-name">
                {item.name} <span className="owned-skill-rarity">({item.rarityLabel})</span>
              </span>
              <div className="inventory-row-actions">
                <button
                  className={`btn ${isPending ? 'btn-neutral' : 'btn-ghost'}`}
                  onClick={() => toggleCostume(item)}
                >
                  {isPending ? '착용중' : '착용'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-neutral loadout-save-btn" disabled={saving} onClick={handleSave}>
        {saving ? '저장 중...' : '착용 저장'}
      </button>
    </div>
  );
}
