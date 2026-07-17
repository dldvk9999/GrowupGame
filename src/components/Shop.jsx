import { useState, useEffect } from 'react';
import { SLOTS } from '../lib/itemCatalog';
import EquipmentGacha from './EquipmentGacha';
import SkillGacha from './SkillGacha';
import SkillLoadout from './SkillLoadout';

const EQUIP_TABS = Object.keys(SLOTS); // ['weapon','armor','gloves','shoes']
const ALL_TABS = [...EQUIP_TABS, 'skill', 'loadout'];

export default function Shop({
  userId, gold, equipmentDrawProgress, totalSkillDraws, monsterLevel,
  userSkills, equippedSkills, onInventoryChange, onGoldChange, onSkillsRefresh, onLoadoutChange,
}) {
  const [tab, setTab] = useState('weapon');

  // Tab / Shift+Tab으로 뽑기 탭 순환
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      const idx = ALL_TABS.indexOf(tab);
      const next = e.shiftKey
        ? ALL_TABS[(idx - 1 + ALL_TABS.length) % ALL_TABS.length]
        : ALL_TABS[(idx + 1) % ALL_TABS.length];
      setTab(next);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tab]);

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
        <button className={`shop-tab ${tab === 'loadout' ? 'active' : ''}`} onClick={() => setTab('loadout')}>
          🧩 스킬 편성
        </button>
      </div>
      <p className="keyboard-hint">Tab / Shift+Tab으로 탭 이동</p>

      {tab === 'skill' ? (
        <SkillGacha
          gold={gold}
          totalDraws={totalSkillDraws}
          onGoldChange={onGoldChange}
          onSkillsRefresh={onSkillsRefresh}
        />
      ) : tab === 'loadout' ? (
        <SkillLoadout
          monsterLevel={monsterLevel}
          userSkills={userSkills}
          equippedSkills={equippedSkills}
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
