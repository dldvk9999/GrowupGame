import { useState, useEffect } from 'react';
import { SLOTS, getItem } from '../lib/itemCatalog';
import { getSkillDef } from '../lib/skillCatalog';
import { getRelic } from '../lib/relicCatalog';
import EquipmentGacha from './EquipmentGacha';
import SkillGacha from './SkillGacha';
import RelicGacha from './RelicGacha';
import { claimDailyFreeDraw } from '../lib/dailyFreeDraw';
import { showToast } from '../lib/toast';

const EQUIP_TABS = Object.keys(SLOTS); // ['weapon','armor','gloves','shoes']
const ALL_TABS = [...EQUIP_TABS, 'skill', 'relic']; // 무료뽑기 탭 순환 대상(유물도 포함, 사용자 요청)

export default function Shop({
  userId, gold, equipmentDrawProgress, totalSkillDraws, totalRelicDraws, inventory, freeDrawUsedMap, onFreeDrawUsedChange,
  onInventoryChange, onGoldChange, onSkillsRefresh,
}) {
  const [tab, setTab] = useState('weapon');
  const [claimingFree, setClaimingFree] = useState(false);
  const [relicRefreshSignal, setRelicRefreshSignal] = useState(0);

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
      const result = await claimDailyFreeDraw(tab);
      onFreeDrawUsedChange?.(tab);
      if (tab === 'skill') {
        const def = getSkillDef(result.skill_key);
        showToast(`🎁 무료뽑기! ${def?.name ?? result.skill_key} ${result.was_duplicate ? `(중복, Lv.${result.new_level})` : '(신규 획득!)'}`, 'success');
        onSkillsRefresh?.();
      } else if (tab === 'relic') {
        const relic = getRelic(result.relic_key);
        let statusText = '(신규 획득!)';
        if (result.was_duplicate) {
          statusText = result.enhance_attempted
            ? (result.enhance_success ? `(중복 강화 성공, +${result.new_level})` : '(중복 강화 실패)')
            : '(중복, 이미 최대강화)';
        }
        showToast(`🎁 무료뽑기! ${relic?.name ?? result.relic_key} ${statusText}`, 'success');
        setRelicRefreshSignal((s) => s + 1);
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

  const freeDrawUsed = freeDrawUsedMap ? freeDrawUsedMap[tab] : null;

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
        {freeDrawUsed === null ? '확인 중...' : freeDrawUsed ? '🎁 오늘의 무료뽑기 사용 완료 (내일 초기화)' : claimingFree ? '뽑는 중...' : `🎁 오늘의 무료뽑기 (${tab === 'skill' ? '스킬' : tab === 'relic' ? '유물' : SLOTS[tab].label}, 1회 공짜)`}
      </button>
      <p className="stage-select-hint free-draw-hint">무기·방어구·장갑·신발·스킬·유물 각각 하루 1번씩, 총 6번 무료로 뽑을 수 있어요.</p>

      <div className="shop-tabs">
        {EQUIP_TABS.map((slot) => (
          <button key={slot} className={`shop-tab free-draw-tab-btn ${tab === slot ? 'active' : ''}`} onClick={() => setTab(slot)}>
            {SLOTS[slot].icon} {SLOTS[slot].label} 뽑기{freeDrawUsedMap && !freeDrawUsedMap[slot] && <span className="mail-unread-dot" aria-label="무료뽑기 가능" />}
          </button>
        ))}
        <button className={`shop-tab free-draw-tab-btn ${tab === 'skill' ? 'active' : ''}`} onClick={() => setTab('skill')}>
          🎯 스킬 뽑기{freeDrawUsedMap && !freeDrawUsedMap.skill && <span className="mail-unread-dot" aria-label="무료뽑기 가능" />}
        </button>
        <button className={`shop-tab free-draw-tab-btn ${tab === 'relic' ? 'active' : ''}`} onClick={() => setTab('relic')}>
          🏺 유물 뽑기{freeDrawUsedMap && !freeDrawUsedMap.relic && <span className="mail-unread-dot" aria-label="무료뽑기 가능" />}
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
      ) : tab === 'relic' ? (
        <RelicGacha
          userId={userId}
          gold={gold}
          totalDraws={totalRelicDraws}
          onGoldChange={onGoldChange}
          refreshSignal={relicRefreshSignal}
        />
      ) : (
        <EquipmentGacha
          slot={tab}
          gold={gold}
          totalDraws={equipmentDrawProgress?.[tab] ?? 0}
          onGoldChange={onGoldChange}
          onInventoryChange={onInventoryChange}
          inventory={inventory}
        />
      )}
    </div>
  );
}
