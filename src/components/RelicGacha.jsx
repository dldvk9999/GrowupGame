import { useState, useEffect } from 'react';
import { RELIC_CATALOG, getRelic, MAX_RELIC_LEVEL, MAX_RELIC_EQUIP, formatRelicEffect, getRelicEnhanceSuccessChance } from '../lib/relicCatalog';
import { drawRelic, drawRelicBatch, fetchMyRelics, setRelicLoadout } from '../lib/relicGacha';
import { showToast } from '../lib/toast';
import { bumpMission } from '../lib/missions';
import { playGachaRevealSound, playClickSound } from '../lib/audio';
import { getGachaProbability } from '../lib/gachaProbability';
import { copyToClipboardWithFeedback } from '../lib/clipboard';

const RARITY_ORDER = ['normal', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_LABEL = { normal: '노멀', rare: '레어', epic: '에픽', legendary: '전설', mythic: '신화' };
const RARITY_COLOR = { normal: '#9aa0b8', rare: '#3aa8e0', epic: '#b566e0', legendary: '#f2b705', mythic: '#ff5a7a' };

export default function RelicGacha({ userId, gold, totalDraws, onGoldChange }) {
  const [drawing, setDrawing] = useState(false);
  const [lastResults, setLastResults] = useState([]);
  const [error, setError] = useState('');
  const [showProbability, setShowProbability] = useState(false);
  const [myRelics, setMyRelics] = useState(null); // [{relic_key, level, equipped}] | null(로딩중)
  const [selectedLoadout, setSelectedLoadout] = useState(null); // 저장 전 임시 선택 상태
  const [savingLoadout, setSavingLoadout] = useState(false);

  const drawLevel = Math.min(50, 1 + Math.floor((totalDraws ?? 0) / 1000));
  const cost = 300 + (drawLevel - 1) * 90;

  function loadRelics() {
    if (!userId) return;
    fetchMyRelics(userId).then((rows) => {
      setMyRelics(rows);
      setSelectedLoadout(rows.filter((r) => r.equipped).map((r) => r.relic_key));
    }).catch(() => setMyRelics([]));
  }

  useEffect(() => { loadRelics(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDraw(count) {
    setError('');
    if (gold < cost) {
      showToast(`골드가 ${(cost - gold).toLocaleString()} 부족해요.`, 'error');
      setError('골드가 부족합니다.');
      return;
    }
    setDrawing(true);
    try {
      const results = count === 1 ? [await drawRelic()] : await drawRelicBatch(count);
      if (results.length === 0) {
        setError('골드가 부족합니다.');
        showToast('골드가 부족합니다.', 'error');
        return;
      }
      const totalSpent = results.reduce((sum, r) => sum + r.cost, 0);
      setLastResults(results);
      onGoldChange(gold - totalSpent);
      bumpMission('spend_gold', totalSpent);
      loadRelics();
      const bestRarity = results.map((r) => r.rarity).sort((a, b) => RARITY_ORDER.indexOf(b) - RARITY_ORDER.indexOf(a))[0];
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

  function toggleLoadoutPick(relicKey) {
    setSelectedLoadout((prev) => {
      if (prev.includes(relicKey)) return prev.filter((k) => k !== relicKey);
      if (prev.length >= MAX_RELIC_EQUIP) {
        showToast(`유물은 최대 ${MAX_RELIC_EQUIP}개까지만 장착할 수 있어요.`, 'error');
        return prev;
      }
      return [...prev, relicKey];
    });
  }

  async function handleSaveLoadout() {
    setSavingLoadout(true);
    try {
      await setRelicLoadout(selectedLoadout);
      playClickSound();
      showToast('유물 장착을 저장했어요.', 'success');
      loadRelics();
    } catch (err) {
      showToast(err.message ?? '저장에 실패했어요.', 'error');
    } finally {
      setSavingLoadout(false);
    }
  }

  const ownedSorted = (myRelics ?? [])
    .map((r) => ({ ...r, relic: getRelic(r.relic_key) }))
    .filter((r) => r.relic)
    .sort((a, b) => b.relic.rarityOrder - a.relic.rarityOrder || b.level - a.level);

  const loadoutDirty = myRelics && JSON.stringify([...selectedLoadout].sort()) !== JSON.stringify(myRelics.filter((r) => r.equipped).map((r) => r.relic_key).sort());

  return (
    <div className="skillgacha-screen">
      <h2>🏺 유물 뽑기</h2>

      <div className="gacha-panel">
        <div className="gacha-level-row">
          <span>뽑기 레벨 <strong>{drawLevel}</strong> / 50</span>
          <span className="gold-display">💰 {gold.toLocaleString()}</span>
        </div>
        <div className="bar-track exp-track">
          <div className="bar-fill exp-fill" style={{ width: `${((totalDraws % 1000) / 1000) * 100}%` }} />
        </div>
        <p className="gacha-hint">
          유물 50종 중 하나를 뽑아요. 중복이면 강화를 <strong>시도</strong>해요(레벨이 높을수록 성공확률이 낮아짐, 최대 강화 +{MAX_RELIC_LEVEL}).
          유물은 <strong>장착한 최대 {MAX_RELIC_EQUIP}개</strong>만 효과가 적용돼요 — 아래에서 장착할 유물을 골라보세요.
        </p>

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
            {drawing ? '뽑는 중...' : `1회 뽑기 (💰 ${cost.toLocaleString()})`}
          </button>
          <button className={`btn btn-neutral ${gold < cost * 10 ? 'btn-unaffordable' : ''}`} disabled={drawing} onClick={() => handleDraw(10)}>
            10회 뽑기 (💰 {(cost * 10).toLocaleString()})
          </button>
        </div>

        {lastResults.length > 0 && <RelicResultList results={lastResults} />}
      </div>

      <div className="gacha-panel">
        <h3 className="mypage-subtitle" style={{ marginTop: 0 }}>
          🎒 보유 유물 ({ownedSorted.length}/{RELIC_CATALOG.length}) · 장착 {selectedLoadout?.length ?? 0}/{MAX_RELIC_EQUIP}
        </h3>
        {myRelics === null && <p className="stage-select-hint">불러오는 중...</p>}
        {myRelics && ownedSorted.length === 0 && <p className="inventory-empty">아직 보유한 유물이 없어요. 위에서 뽑아보세요!</p>}
        {ownedSorted.length > 0 && (
          <>
            <div className="relic-list">
              {ownedSorted.map(({ relic_key, level, relic }) => {
                const picked = selectedLoadout?.includes(relic_key);
                const successChance = getRelicEnhanceSuccessChance(level);
                return (
                  <button
                    key={relic_key}
                    type="button"
                    className={`relic-card ${picked ? 'relic-card--equipped' : ''}`}
                    style={{ borderColor: RARITY_COLOR[relic.rarity] }}
                    onClick={() => toggleLoadoutPick(relic_key)}
                    title={level >= MAX_RELIC_LEVEL ? '최대 강화' : `다음 강화 성공확률 ${(successChance * 100).toFixed(0)}%`}
                  >
                    <span className="relic-card-icon">{relic.icon}</span>
                    <span className="relic-card-name">{relic.name}</span>
                    <span className="relic-card-effect" style={{ color: RARITY_COLOR[relic.rarity] }}>{formatRelicEffect(relic, level)}</span>
                    <span className="relic-card-level">+{level}{level >= MAX_RELIC_LEVEL ? ' (MAX)' : ''}</span>
                    {picked && <span className="relic-card-badge">장착중</span>}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={`btn btn-challenge ${!loadoutDirty ? 'btn-unaffordable' : ''}`}
              disabled={!loadoutDirty || savingLoadout}
              onClick={handleSaveLoadout}
              style={{ marginTop: 10 }}
            >
              {savingLoadout ? '저장 중...' : '장착 저장하기'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RelicResultList({ results }) {
  const [copied, setCopied] = useState(false);
  const counts = { normal: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
  for (const r of results) counts[r.rarity] += 1;

  async function handleCopyResult() {
    const summary = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([rarity, n]) => `${RARITY_LABEL[rarity]} ×${n}`)
      .join(', ');
    const text = `🏺 유물 뽑기 ${results.length}회 결과 - ${summary}`;
    if (await copyToClipboardWithFeedback(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
        <button type="button" className="btn btn-ghost gacha-share-btn" onClick={handleCopyResult}>
          {copied ? '✅ 복사됨' : '📋 결과 공유'}
        </button>
      </div>
      <div className="gacha-result-list">
        {results.map((r, i) => {
          const relic = getRelic(r.relic_key);
          return (
            <div key={i} className="gacha-result-item" style={{ borderColor: RARITY_COLOR[r.rarity] }} title={relic?.name}>
              <span>{relic?.icon ?? '🏺'}</span>
              {r.was_duplicate && (
                r.enhance_attempted
                  ? <span className={`gacha-result-dup ${r.enhance_success ? '' : 'relic-enhance-fail'}`}>
                      {r.enhance_success ? `+${r.new_level}` : '실패'}
                    </span>
                  : <span className="gacha-result-dup">MAX</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
