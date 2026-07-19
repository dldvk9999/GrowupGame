import { useState } from 'react';
import { SKILL_CATALOG, getSkillDef, getEffectiveSkillValue, getSkillSlotCount, getSkillPossessionBonus, sumSkillPossessionBonus, RARITY_LABEL, RARITY_COLOR } from '../lib/skillCatalog';
import { setSkillLoadout } from '../lib/skillGacha';

export default function SkillLoadout({ monsterLevel, userSkills, equippedSkills, onLoadoutChange }) {
  const [pendingLoadout, setPendingLoadout] = useState(equippedSkills ?? []);
  const [savingLoadout, setSavingLoadout] = useState(false);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const slotLimit = getSkillSlotCount(monsterLevel ?? 1);
  const ownedMap = new Map((userSkills ?? []).map((s) => [s.skill_key, s.skill_level]));
  const savedEquippedSet = new Set(equippedSkills ?? []); // 서버에 실제 저장된(현재 착용중) 스킬

  function toggleSlot(skillKey) {
    setPendingLoadout((prev) => {
      if (prev.includes(skillKey)) {
        return prev.filter((k) => k !== skillKey);
      }
      if (prev.length >= slotLimit) return prev;
      return [...prev, skillKey];
    });
  }

  async function handleSaveLoadout() {
    setError('');
    setSavingLoadout(true);
    try {
      await setSkillLoadout(pendingLoadout);
      onLoadoutChange?.(pendingLoadout);
    } catch (err) {
      setError(err.message ?? '편성 저장에 실패했어요.');
    } finally {
      setSavingLoadout(false);
    }
  }

  return (
    <div className="skill-loadout-screen">
      <h2>스킬 편성</h2>

      {/* 스크롤해도 항상 보이는 편성 슬롯 영역 - 접었다 펼 수 있음 */}
      <div className={`loadout-sticky-bar ${collapsed ? 'collapsed' : ''}`}>
        <button
          type="button"
          className="loadout-collapse-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <span>편성 슬롯 ({pendingLoadout.length}/{slotLimit})</span>
          <span className="loadout-collapse-icon">{collapsed ? '▼ 펼치기' : '▲ 접기'}</span>
        </button>

        {!collapsed && (
          <>
            <p className="gacha-hint">몬스터 레벨이 오를수록 슬롯이 늘어나요 (Lv.10/25/50/75/100/130/160/190/220마다 +1, 최대 10슬롯). 아래에서 원하는 스킬을 눌러 편성하세요.</p>
            <p className="gacha-hint">
              보유한 스킬은 장착 여부와 상관없이 <strong>상시 공격력 보너스</strong>를 줘요.
              현재 총 <strong style={{ color: 'var(--accent-gold)' }}>+{sumSkillPossessionBonus(userSkills)} ATK</strong>
            </p>
            <p className="gacha-hint loadout-legend">
              <span className="loadout-legend-dot loadout-legend-dot--equipped" /> 현재 착용 중
              <span className="loadout-legend-dot loadout-legend-dot--pending" /> 편성 중(미저장)
            </p>

            <div className="loadout-slots">
              {Array.from({ length: slotLimit }, (_, i) => {
                const key = pendingLoadout[i];
                const def = key ? getSkillDef(key) : null;
                return (
                  <div key={i} className={`loadout-slot ${def ? 'filled' : ''}`} style={def ? { borderColor: RARITY_COLOR[def.rarity] } : undefined}>
                    {def ? <span style={{ fontSize: 22 }}>{def.icon}</span> : <span className="loadout-slot-empty">+</span>}
                  </div>
                );
              })}
            </div>

            {error && <p className="shop-error">{error}</p>}

            <button className="btn btn-neutral loadout-save-btn" disabled={savingLoadout} onClick={handleSaveLoadout}>
              {savingLoadout ? '저장 중...' : `편성 저장 (${pendingLoadout.length}/${slotLimit})`}
            </button>
          </>
        )}
      </div>

      <div className="costume-collection-progress">
        📚 스킬 컬렉션 {ownedMap.size} / {SKILL_CATALOG.length}
        <span className="bar-track costume-collection-track">
          <span className="bar-fill" style={{ width: `${(ownedMap.size / SKILL_CATALOG.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent-fire), var(--accent-gold))' }} />
        </span>
      </div>

      <div className="owned-skill-grid">
        {SKILL_CATALOG.map((def) => {
          const level = ownedMap.get(def.skillKey);
          const owned = level != null;
          const isSavedEquipped = savedEquippedSet.has(def.skillKey);
          const isPending = pendingLoadout.includes(def.skillKey);
          // 저장된 착용중 스킬은 항상 금색으로, 아직 저장 안 한 편성중 선택은 청록색으로 구분
          const cardStateClass = isSavedEquipped ? 'equipped' : isPending ? 'pending-equip' : '';
          const effective = owned ? getEffectiveSkillValue(def, level) : null;
          return (
            <button
              key={def.skillKey}
              type="button"
              className={`owned-skill-card ${owned ? '' : 'not-owned'} ${cardStateClass}`}
              style={{ borderColor: RARITY_COLOR[def.rarity] }}
              disabled={!owned}
              onClick={() => toggleSlot(def.skillKey)}
            >
              {isSavedEquipped && <span className="owned-skill-equipped-badge">착용중</span>}
              <span className="owned-skill-icon">{def.icon}</span>
              <strong style={{ color: RARITY_COLOR[def.rarity] }}>{def.name}</strong>
              <span className="owned-skill-rarity">{RARITY_LABEL[def.rarity]}</span>
              {owned ? (
                <span className="owned-skill-level">
                  Lv.{level} · {formatSkillPower(def, effective)}
                  <br />
                  <span className="owned-skill-possession">보유효과 +{getSkillPossessionBonus(def, level)} ATK</span>
                </span>
              ) : (
                <span className="owned-skill-locked">미보유</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatSkillPower(def, effective) {
  switch (def.type) {
    case 'heal': return `회복 ${Math.round(effective * 100)}%`;
    case 'stun': return `기절 ${effective.toFixed(1)}초`;
    case 'dot': return `틱당 ${effective.toFixed(2)}x ×${def.ticks}회`;
    case 'buff_atk': return `공격력 +${Math.round(effective * 100)}%`;
    case 'buff_def': return `방어력 +${Math.round(effective * 100)}%`;
    case 'haste': return `쿨감 -${Math.round(effective * 100)}%`;
    default: return `배율 ${effective.toFixed(2)}x`;
  }
}
