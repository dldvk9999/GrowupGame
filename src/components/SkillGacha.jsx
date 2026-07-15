import { useState } from 'react';
import { SKILL_CATALOG, getSkillDef, getEffectiveSkillValue, getSkillSlotCount, RARITY_LABEL, RARITY_COLOR } from '../lib/skillCatalog';
import { drawSkill, setSkillLoadout } from '../lib/skillGacha';

export default function SkillGacha({ userId, gold, totalDraws, monsterLevel, userSkills, equippedSkills, onGoldChange, onSkillsRefresh, onLoadoutChange }) {
  const [drawing, setDrawing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  const [pendingLoadout, setPendingLoadout] = useState(equippedSkills ?? []);
  const [savingLoadout, setSavingLoadout] = useState(false);

  const drawLevel = Math.min(20, 1 + Math.floor((totalDraws ?? 0) / 5));
  const cost = 100 + (drawLevel - 1) * 30;
  const canAfford = gold >= cost;
  const slotLimit = getSkillSlotCount(monsterLevel ?? 1);

  const ownedMap = new Map((userSkills ?? []).map((s) => [s.skill_key, s.skill_level]));

  async function handleDraw() {
    setError('');
    setDrawing(true);
    try {
      const result = await drawSkill();
      setLastResult(result);
      onGoldChange(gold - result.cost);
      onSkillsRefresh();
    } catch (err) {
      setError(err.message ?? '뽑기에 실패했어요.');
    } finally {
      setDrawing(false);
    }
  }

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
    <div className="skillgacha-screen">
      <h2>스킬 뽑기</h2>

      <div className="gacha-panel">
        <div className="gacha-level-row">
          <span>뽑기 레벨 <strong>{drawLevel}</strong> / 20</span>
          <span className="gold-display">💰 {gold.toLocaleString()}</span>
        </div>
        <div className="bar-track exp-track">
          <div className="bar-fill exp-fill" style={{ width: `${((totalDraws % 5) / 5) * 100}%` }} />
        </div>
        <p className="gacha-hint">뽑기 5회마다 뽑기 레벨이 오르고, 레벨이 높을수록 고등급 스킬 확률이 올라가요. (최대 Lv.20)</p>

        {error && <p className="shop-error">{error}</p>}

        <button className="btn btn-challenge" disabled={drawing || !canAfford} onClick={handleDraw}>
          {drawing ? '뽑는 중...' : `🎯 스킬 뽑기 (💰 ${cost.toLocaleString()})`}
        </button>

        {lastResult && (
          <GachaReveal result={lastResult} />
        )}
      </div>

      <h3 className="mypage-subtitle">스킬 편성 ({pendingLoadout.length}/{slotLimit} 슬롯)</h3>
      <p className="gacha-hint">몬스터 레벨이 오를수록 슬롯이 늘어나요 (Lv.10/25/50/75마다 +1). 원하는 스킬을 눌러 편성하세요.</p>

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

      <button className="btn btn-neutral" disabled={savingLoadout} onClick={handleSaveLoadout} style={{ marginBottom: 20 }}>
        {savingLoadout ? '저장 중...' : '편성 저장'}
      </button>

      <div className="owned-skill-grid">
        {SKILL_CATALOG.map((def) => {
          const level = ownedMap.get(def.skillKey);
          const owned = level != null;
          const equipped = pendingLoadout.includes(def.skillKey);
          const effective = owned ? getEffectiveSkillValue(def, level) : null;
          return (
            <button
              key={def.skillKey}
              type="button"
              className={`owned-skill-card ${owned ? '' : 'not-owned'} ${equipped ? 'equipped' : ''}`}
              style={{ borderColor: RARITY_COLOR[def.rarity] }}
              disabled={!owned}
              onClick={() => toggleSlot(def.skillKey)}
            >
              <span className="owned-skill-icon">{def.icon}</span>
              <strong style={{ color: RARITY_COLOR[def.rarity] }}>{def.name}</strong>
              <span className="owned-skill-rarity">{RARITY_LABEL[def.rarity]}</span>
              {owned ? (
                <span className="owned-skill-level">
                  Lv.{level} · {def.type === 'heal' ? `회복 ${Math.round(effective * 100)}%` : `배율 ${effective.toFixed(2)}x`}
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

function GachaReveal({ result }) {
  const def = getSkillDef(result.skill_key);
  return (
    <div className="gacha-reveal" style={{ borderColor: RARITY_COLOR[def.rarity] }}>
      <span className="gacha-reveal-icon">{def.icon}</span>
      <div>
        <strong style={{ color: RARITY_COLOR[def.rarity] }}>{def.name}</strong>
        <span className="gacha-reveal-rarity"> · {RARITY_LABEL[def.rarity]}</span>
        <p className="gacha-reveal-desc">
          {result.was_duplicate ? `중복! 스킬 레벨 ${result.new_skill_level}로 합성됨` : '새로운 스킬 획득!'}
        </p>
      </div>
    </div>
  );
}
