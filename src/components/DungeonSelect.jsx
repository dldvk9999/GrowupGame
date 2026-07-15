import { useState } from 'react';
import { DUNGEON_STAGE_COUNT, getDungeonStage } from '../lib/dungeonStages';

export default function DungeonSelect({ attemptsRemaining, onEnterDungeon, entering, error }) {
  const [activeType, setActiveType] = useState('exp');
  const remaining = attemptsRemaining?.[activeType] ?? 3;

  return (
    <div className="dungeon-select">
      <h2>일일 던전</h2>
      <p className="stage-select-hint">하루 3번까지 입장할 수 있어요. 높은 층일수록 보스가 훨씬 강해요.</p>

      <div className="shop-tabs">
        <button className={`shop-tab ${activeType === 'exp' ? 'active' : ''}`} onClick={() => setActiveType('exp')}>
          📘 경험치 던전 ({attemptsRemaining?.exp ?? 3}/3)
        </button>
        <button className={`shop-tab ${activeType === 'gold' ? 'active' : ''}`} onClick={() => setActiveType('gold')}>
          💰 골드 던전 ({attemptsRemaining?.gold ?? 3}/3)
        </button>
      </div>

      {error && <p className="shop-error">{error}</p>}
      {remaining <= 0 && <p className="mypage-locked-hint">오늘 입장 횟수를 모두 사용했어요. 내일 다시 도전해보세요.</p>}

      <div className="dungeon-stage-grid">
        {Array.from({ length: DUNGEON_STAGE_COUNT }, (_, i) => i + 1).map((stage) => {
          const d = getDungeonStage(activeType, stage);
          return (
            <div key={stage} className="dungeon-stage-card">
              <div className="dungeon-stage-num">{stage}층</div>
              <div className="dungeon-stage-boss">{d.name}</div>
              <div className="dungeon-stage-reward">
                EXP +{d.expReward.toLocaleString()} · 💰 +{d.goldReward.toLocaleString()}
              </div>
              <button
                className="btn btn-challenge"
                disabled={remaining <= 0 || entering}
                onClick={() => onEnterDungeon(activeType, stage)}
              >
                {entering ? '입장 중...' : '입장'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
