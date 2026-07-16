import { useState } from 'react';
import { SKILL_CATALOG, getSkillDef, getEffectiveSkillValue, getSkillSlotCount, RARITY_LABEL, RARITY_COLOR } from '../lib/skillCatalog';
import { drawSkill, drawSkillBatch, setSkillLoadout } from '../lib/skillGacha';
import { showToast } from '../lib/toast';
import { bumpMission } from '../lib/missions';

export default function SkillGacha({ userId, gold, totalDraws, monsterLevel, userSkills, equippedSkills, onGoldChange, onSkillsRefresh, onLoadoutChange }) {
  const [drawing, setDrawing] = useState(false);
  const [lastResults, setLastResults] = useState([]); // 항상 배열로 통일 (1회도 배열 1개)
  const [error, setError] = useState('');
  const [pendingLoadout, setPendingLoadout] = useState(equippedSkills ?? []);
  const [savingLoadout, setSavingLoadout] = useState(false);

  const drawLevel = Math.min(20, 1 + Math.floor((totalDraws ?? 0) / 1000));
  const cost = 300; // 뽑기레벨과 무관하게 1회당 정가 300골드
  const slotLimit = getSkillSlotCount(monsterLevel ?? 1);

  const ownedMap = new Map((userSkills ?? []).map((s) => [s.skill_key, s.skill_level]));

  async function handleDraw(count) {
    setError('');
    if (gold < cost) {
      showToast('골드가 부족합니다.', 'error');
      setError('골드가 부족합니다.');
      return;
    }
    setDrawing(true);
    try {
      const results = count === 1 ? [await drawSkill()] : await drawSkillBatch(count);
      if (results.length === 0) {
        setError('골드가 부족합니다.');
        showToast('골드가 부족합니다.', 'error');
        return;
      }
      const totalSpent = results.reduce((sum, r) => sum + r.cost, 0);
      setLastResults(results);
      onGoldChange(gold - totalSpent);
      onSkillsRefresh();
      bumpMission('spend_gold', totalSpent);
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
          <div className="bar-fill exp-fill" style={{ width: `${((totalDraws % 1000) / 1000) * 100}%` }} />
        </div>
        <p className="gacha-hint">뽑기 1000회마다 뽑기 레벨이 오르고, 레벨이 높을수록 고등급 스킬 확률이 올라가요. (최대 Lv.20)</p>

        {error && <p className="shop-error">{error}</p>}

        <div className="gacha-draw-buttons">
          <button className={`btn btn-challenge ${gold < cost ? 'btn-unaffordable' : ''}`} disabled={drawing} onClick={() => handleDraw(1)}>
            {drawing ? '뽑는 중...' : `1회 뽑기 (💰 ${cost.toLocaleString()})`}
          </button>
          <button className={`btn btn-neutral ${gold < cost * 10 ? 'btn-unaffordable' : ''}`} disabled={drawing} onClick={() => handleDraw(10)}>
            10회 뽑기 (💰 {(cost * 10).toLocaleString()})
          </button>
          <button className={`btn btn-neutral ${gold < cost * 100 ? 'btn-unaffordable' : ''}`} disabled={drawing} onClick={() => handleDraw(100)}>
            100회 뽑기 (💰 {(cost * 100).toLocaleString()})
          </button>
        </div>
        <p className="gacha-hint" style={{ marginTop: 6 }}>
          1회당 정가 💰{cost.toLocaleString()}로 고정이에요. 뽑기 레벨은 등급 확률에만 영향을 줘요.
        </p>

        {lastResults.length > 0 && (
          <GachaResultList results={lastResults} />
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
                  Lv.{level} · {formatSkillPower(def, effective)}
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

function GachaResultList({ results }) {
  const counts = { normal: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
  for (const r of results) {
    const def = getSkillDef(r.skill_key);
    if (def) counts[def.rarity] += 1;
  }

  return (
    <div className="gacha-result-wrap">
      <div className="gacha-result-summary">
        {Object.entries(counts).filter(([, n]) => n > 0).map(([rarity, n]) => (
          <span key={rarity} className="gacha-summary-chip" style={{ borderColor: RARITY_COLOR[rarity], color: RARITY_COLOR[rarity] }}>
            {RARITY_LABEL[rarity]} ×{n}
          </span>
        ))}
        <span className="gacha-summary-total">총 {results.length}회</span>
      </div>
      <div className="gacha-result-list">
        {results.map((r, i) => {
          const def = getSkillDef(r.skill_key);
          return (
            <div key={i} className="gacha-result-item" style={{ borderColor: RARITY_COLOR[def.rarity] }} title={def.name}>
              <span>{def.icon}</span>
              {r.was_duplicate && <span className="gacha-result-dup">+{r.new_skill_level}</span>}
            </div>
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
