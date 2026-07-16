import { useState } from 'react';
import { SLOTS } from '../lib/itemCatalog';
import EquipmentGacha from './EquipmentGacha';
import SkillGacha from './SkillGacha';

const EQUIP_TABS = Object.keys(SLOTS); // ['weapon','armor','gloves','shoes']

export default function Shop({
  userId, gold, equipmentDrawProgress, totalSkillDraws, monsterLevel,
  userSkills, equippedSkills, onInventoryChange, onGoldChange, onSkillsRefresh, onLoadoutChange,
}) {
  const [tab, setTab] = useState('weapon');

  return (
    <div className="shop-screen">
      <div className="shop-header">
        <h2>상점 - 뽑기</h2>
        <span className="gold-display">💰 {gold.toLocaleString()}</span>
      </div>

      <div className="shop-tabs">
        {EQUIP_TABS.map((slot) => (
          <button key={slot} className={`shop-tab ${tab === slot ? 'active' : ''}`} onClick={() => setTab(slot)}>
            {SLOTS[slot].icon} {SLOTS[slot].label} 뽑기
          </button>
        ))}
        <button className={`shop-tab ${tab === 'skill' ? 'active' : ''}`} onClick={() => setTab('skill')}>
          🎯 스킬 뽑기
        </button>
      </div>

      {tab === 'skill' ? (
        <SkillGacha
          userId={userId}
          gold={gold}
          totalDraws={totalSkillDraws}
          monsterLevel={monsterLevel}
          userSkills={userSkills}
          equippedSkills={equippedSkills}
          onGoldChange={onGoldChange}
          onSkillsRefresh={onSkillsRefresh}
          onLoadoutChange={onLoadoutChange}
        />
      ) : (
        <EquipmentGacha
          slot={tab}
          gold={gold}
          totalDraws={equipmentDrawProgress?.[tab] ?? 0}
          onGoldChange={onGoldChange}
          onInventoryChange={onInventoryChange}
        />
      )}
    </div>
  );
}
