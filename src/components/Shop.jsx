import { useState, useEffect } from 'react';
import { SLOTS, getItem } from '../lib/itemCatalog';
import { getSkillDef } from '../lib/skillCatalog';
import EquipmentGacha from './EquipmentGacha';
import SkillGacha from './SkillGacha';
import { fetchDailyFreeDrawState, hasUsedFreeDrawToday, claimDailyFreeDraw } from '../lib/dailyFreeDraw';
import { showToast } from '../lib/toast';

const EQUIP_TABS = Object.keys(SLOTS); // ['weapon','armor','gloves','shoes']
const ALL_TABS = [...EQUIP_TABS, 'skill'];

export default function Shop({
  userId, gold, equipmentDrawProgress, totalSkillDraws,
  onInventoryChange, onGoldChange, onSkillsRefresh,
}) {
  const [tab, setTab] = useState('weapon');
  const [freeDrawUsed, setFreeDrawUsed] = useState(null); // null=로딩중
  const [claimingFree, setClaimingFree] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchDailyFreeDrawState(userId).then((s) => setFreeDrawUsed(hasUsedFreeDrawToday(s))).catch(() => setFreeDrawUsed(false));
  }, [userId]);

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

  async function handleFreeDraw() {
    setClaimingFree(true);
    try {
      const type = tab === 'skill' ? 'skill' : 'equipment';
      const result = await claimDailyFreeDraw(type, type === 'equipment' ? tab : undefined);
      setFreeDrawUsed(true);
      if (type === 'skill') {
        const def = getSkillDef(result.skill_key);
        showToast(`🎁 무료뽑기! ${def?.name ?? result.skill_key} ${result.was_duplicate ? `(중복, Lv.${result.new_level})` : '(신규 획득!)'}`, 'success');
        onSkillsRefresh?.();
      } else {
        const item = getItem(result.item_key);
        showToast(`🎁 무료뽑기! ${item?.name ?? result.item_key} ${result.was_duplicate ? `(중복, +${result.new_level})` : '(신규 획득!)'}`, 'success');
        onInventoryChange?.();
      }
    } catch (err) {
      showToast(err.message ?? '무료 뽑기에 실패했어요.', 'error');
    } finally {
      setClaimingFree(false);
    }
  }

  return (
    <div className="shop-screen">
      <div className="shop-header">
        <h2>상점 - 뽑기</h2>
        <span className="gold-display">💰 {gold.toLocaleString()}</span>
      </div>

      <button
        className={`btn btn-challenge free-draw-btn ${freeDrawUsed ? 'btn-unaffordable' : ''}`}
        disabled={freeDrawUsed !== false || claimingFree}
        onClick={handleFreeDraw}
      >
        {freeDrawUsed === null ? '확인 중...' : freeDrawUsed ? '🎁 오늘의 무료뽑기 사용 완료' : claimingFree ? '뽑는 중...' : `🎁 오늘의 무료뽑기 (${tab === 'skill' ? '스킬' : SLOTS[tab].label}, 1회 공짜)`}
      </button>

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
      <p className="keyboard-hint">Tab / Shift+Tab으로 탭 이동</p>

      {tab === 'skill' ? (
        <SkillGacha
          gold={gold}
          totalDraws={totalSkillDraws}
          onGoldChange={onGoldChange}
          onSkillsRefresh={onSkillsRefresh}
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
