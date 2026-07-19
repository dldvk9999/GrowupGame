import { useState, useEffect } from 'react';
import { getSkillDef, RARITY_LABEL, RARITY_COLOR } from '../lib/skillCatalog';
import { drawSkill, drawSkillBatch } from '../lib/skillGacha';
import { showToast } from '../lib/toast';
import { bumpMission } from '../lib/missions';
import { playGachaRevealSound } from '../lib/audio';
import { getGachaProbability } from '../lib/gachaProbability';

const RARITY_ORDER = ['normal', 'rare', 'epic', 'legendary', 'mythic'];

export default function SkillGacha({ gold, totalDraws, onGoldChange, onSkillsRefresh }) {
  const [drawing, setDrawing] = useState(false);
  const [lastResults, setLastResults] = useState([]); // 항상 배열로 통일 (1회도 배열 1개)
  const [error, setError] = useState('');
  const [showProbability, setShowProbability] = useState(false);

  const drawLevel = Math.min(50, 1 + Math.floor((totalDraws ?? 0) / 1000));
  const cost = 300 + (drawLevel - 1) * 90;

  async function handleDraw(count) {
    setError('');
    if (gold < cost) {
      showToast(`골드가 ${(cost - gold).toLocaleString()} 부족해요.`, 'error');
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
      const bestRarity = results
        .map((r) => getSkillDef(r.skill_key)?.rarity)
        .filter(Boolean)
        .sort((a, b) => RARITY_ORDER.indexOf(b) - RARITY_ORDER.indexOf(a))[0];
      if (bestRarity) playGachaRevealSound(bestRarity);
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

  // G: 1회, Shift+G: 10회, Ctrl(⌘)+G: 100회
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'g' && e.key !== 'G') return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (drawing) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) handleDraw(100);
      else if (e.shiftKey) handleDraw(10);
      else handleDraw(1);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawing, gold]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="skillgacha-screen">
      <h2>스킬 뽑기</h2>

      <div className="gacha-panel">
        <div className="gacha-level-row">
          <span>뽑기 레벨 <strong>{drawLevel}</strong> / 50</span>
          <span className="gold-display">💰 {gold.toLocaleString()}</span>
        </div>
        <div className="bar-track exp-track">
          <div className="bar-fill exp-fill" style={{ width: `${((totalDraws % 1000) / 1000) * 100}%` }} />
        </div>
        <p className="gacha-hint">뽑기 1000회마다 뽑기 레벨이 오르고, 레벨이 높을수록 고등급 스킬 확률이 올라가요. (최대 Lv.50)</p>

        <button type="button" className="btn btn-ghost gacha-probability-toggle" onClick={() => setShowProbability((s) => !s)}>
          {showProbability ? '▲ 확률 접기' : '🎲 현재 확률 보기'}
        </button>
        {showProbability && (
          <div className="gacha-probability-table">
            {Object.entries(getGachaProbability(drawLevel)).filter(([k]) => k !== 'maxLevel').map(([rarity, prob]) => (
              <div key={rarity} className="gacha-probability-row" style={{ color: RARITY_COLOR[rarity] }}>
                <span>{RARITY_LABEL[rarity]}</span>
                <span>{(prob * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="shop-error">{error}</p>}

        <div className="gacha-draw-buttons">
          <button className={`btn btn-challenge ${gold < cost ? 'btn-unaffordable' : ''}`} disabled={drawing} onClick={() => handleDraw(1)}>
            {drawing ? '뽑는 중...' : `1회 뽑기 (💰 ${cost.toLocaleString()})`} <span className="key-hint">G</span>
          </button>
          <button className={`btn btn-neutral ${gold < cost * 10 ? 'btn-unaffordable' : ''}`} disabled={drawing} onClick={() => handleDraw(10)}>
            10회 뽑기 (💰 {(cost * 10).toLocaleString()}) <span className="key-hint">Shift+G</span>
          </button>
          <button className={`btn btn-neutral ${gold < cost * 100 ? 'btn-unaffordable' : ''}`} disabled={drawing} onClick={() => handleDraw(100)}>
            100회 뽑기 (💰 {(cost * 100).toLocaleString()}) <span className="key-hint">Ctrl+G</span>
          </button>
        </div>
        <p className="gacha-hint" style={{ marginTop: 6 }}>
          뽑기 레벨이 오를수록 비용도 증가해요 (Lv.1=300골드, Lv.50=4,710골드). 레벨이 높을수록 고등급 확률도 올라가요.
        </p>

        {lastResults.length > 0 && (
          <GachaResultList results={lastResults} />
        )}
      </div>

      <p className="gacha-hint">편성은 "🧩 스킬 편성" 탭에서 할 수 있어요.</p>
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
