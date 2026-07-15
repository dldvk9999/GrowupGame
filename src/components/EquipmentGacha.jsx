import { useState } from 'react';
import { getItem, SLOTS, RARITIES } from '../lib/itemCatalog';
import { drawEquipment, drawEquipmentBatch } from '../lib/equipmentGacha';
import { showToast } from '../lib/toast';

export default function EquipmentGacha({ gold, totalDraws, onGoldChange, onInventoryChange }) {
  const [drawing, setDrawing] = useState(false);
  const [lastResults, setLastResults] = useState([]);
  const [error, setError] = useState('');

  const drawLevel = Math.min(20, 1 + Math.floor((totalDraws ?? 0) / 1000));
  const cost = 100 + (drawLevel - 1) * 30;

  async function handleDraw(count) {
    setError('');
    if (gold < cost) {
      showToast('골드가 부족합니다.', 'error');
      setError('골드가 부족합니다.');
      return;
    }
    setDrawing(true);
    try {
      const results = count === 1 ? [await drawEquipment()] : await drawEquipmentBatch(count);
      if (results.length === 0) {
        setError('골드가 부족합니다.');
        return;
      }
      const totalSpent = results.reduce((sum, r) => sum + r.cost, 0);
      setLastResults(results);
      onGoldChange(gold - totalSpent);
      onInventoryChange();
      if (results.length < count) {
        setError(`골드가 부족해서 ${results.length}회까지만 뽑았어요.`);
        showToast(`골드가 부족해서 ${results.length}회까지만 뽑았어요.`, 'error');
      }
    } catch (err) {
      setError(err.message ?? '뽑기에 실패했어요.');
    } finally {
      setDrawing(false);
    }
  }

  const counts = { normal: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
  for (const r of lastResults) counts[r.rarity] += 1;

  return (
    <div className="skillgacha-screen">
      <div className="gacha-panel">
        <div className="gacha-level-row">
          <span>뽑기 레벨 <strong>{drawLevel}</strong> / 20</span>
          <span className="gold-display">💰 {gold.toLocaleString()}</span>
        </div>
        <div className="bar-track exp-track">
          <div className="bar-fill exp-fill" style={{ width: `${((totalDraws % 1000) / 1000) * 100}%` }} />
        </div>
        <p className="gacha-hint">
          무기/보호구/장갑/신발 중 랜덤 슬롯 + 등급이 나와요. 뽑기 1000회마다 레벨이 오르고, 레벨이 높을수록 고등급 확률이 올라가요. (최대 Lv.20)
        </p>

        {error && <p className="shop-error">{error}</p>}

        <div className="gacha-draw-buttons">
          <button className={`btn btn-challenge ${gold < cost ? 'btn-unaffordable' : ''}`} disabled={drawing} onClick={() => handleDraw(1)}>
            {drawing ? '뽑는 중...' : `1회 뽑기 (💰 ${cost.toLocaleString()})`}
          </button>
          <button className={`btn btn-neutral ${gold < cost * 10 ? 'btn-unaffordable' : ''}`} disabled={drawing} onClick={() => handleDraw(10)}>
            10회 뽑기 (💰 약 {(cost * 10).toLocaleString()}+)
          </button>
          <button className={`btn btn-neutral ${gold < cost * 100 ? 'btn-unaffordable' : ''}`} disabled={drawing} onClick={() => handleDraw(100)}>
            100회 뽑기 (💰 약 {(cost * 100).toLocaleString()}+)
          </button>
        </div>

        {lastResults.length > 0 && (
          <div className="gacha-result-wrap">
            <div className="gacha-result-summary">
              {Object.entries(counts).filter(([, n]) => n > 0).map(([rarity, n]) => (
                <span key={rarity} className="gacha-summary-chip" style={{ borderColor: RARITIES[rarity].color, color: RARITIES[rarity].color }}>
                  {RARITIES[rarity].label} ×{n}
                </span>
              ))}
              <span className="gacha-summary-total">총 {lastResults.length}회</span>
            </div>
            <div className="gacha-result-list">
              {lastResults.map((r, i) => {
                const item = getItem(r.item_key);
                return (
                  <div key={i} className="gacha-result-item" style={{ borderColor: RARITIES[r.rarity].color }} title={item?.name}>
                    <span>{SLOTS[r.slot].icon}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
