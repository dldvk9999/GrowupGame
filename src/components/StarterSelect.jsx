import { useState } from 'react';
import MonsterSprite from './MonsterSprite';

const STARTERS = [
  { speciesId: 'fire_1', name: '이모탄', element: 'fire', desc: '뜨거운 성격, 초반 공격력이 좋아요' },
  { speciesId: 'water_1', name: '아쿠파피', element: 'water', desc: '침착한 성격, 방어력이 좋아요' },
  { speciesId: 'grass_1', name: '새프링', element: 'grass', desc: '균형 잡힌 성격, 밸런스형이에요' },
];

export default function StarterSelect({ onSelect, loading }) {
  const [picked, setPicked] = useState(null);

  return (
    <div className="starter-screen">
      <h2>첫 몬스터를 골라주세요</h2>
      <p className="starter-hint">한번 고르면 이 몬스터와 함께 성장하게 돼요.</p>

      <div className="starter-grid">
        {STARTERS.map((s) => (
          <button
            key={s.speciesId}
            className={`starter-card ${picked === s.speciesId ? 'picked' : ''}`}
            onClick={() => setPicked(s.speciesId)}
            type="button"
          >
            <MonsterSprite speciesKey={s.speciesId} size={96} alt={s.name} />
            <strong>{s.name}</strong>
            <span>{s.desc}</span>
          </button>
        ))}
      </div>

      <button
        className="starter-confirm"
        disabled={!picked || loading}
        onClick={() => onSelect(picked)}
      >
        {loading ? '준비 중...' : '이 몬스터와 시작하기'}
      </button>
    </div>
  );
}
