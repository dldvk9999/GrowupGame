import { speciesById } from '../lib/speciesData';
import MonsterSprite from './MonsterSprite';

const ELEMENT_LABEL = { fire: '🔥 불', water: '💧 물', grass: '🌿 풀' };
const ELEMENTS = ['fire', 'water', 'grass'];
const STAGES = [1, 2, 3];

/**
 * 몬스터 도감 - 9종(3속성×3진화단계)의 발견 여부를 보여줌.
 * "발견"의 기준: 지금 키우는 몬스터의 속성과 같고, 그 몬스터가 이미 도달한 진화 단계 이하인 경우.
 * (이 게임은 스타터 1종만 계약해서 진화시키는 구조라 "포획"이 없고, 다른 속성은 항상 미발견 상태로 남음
 * — 나중에 몬스터 전환/포획 기능이 생기면 이 로직을 서버가 실제로 거쳐온 종족 기록 기반으로 바꿔야 함)
 */
export default function MonsterDex({ myElement, myStage }) {
  const discoveredCount = ELEMENTS.reduce((sum, el) => {
    if (el !== myElement) return sum;
    return sum + STAGES.filter((s) => s <= (myStage ?? 0)).length;
  }, 0);

  return (
    <div className="monster-dex">
      <div className="monster-dex-header">
        <h3 className="mypage-subtitle" style={{ margin: 0 }}>📖 몬스터 도감</h3>
        <span className="monster-dex-count">{discoveredCount} / 9 발견</span>
      </div>
      <div className="monster-dex-grid">
        {ELEMENTS.map((element) => (
          <div key={element} className="monster-dex-column">
            <span className="monster-dex-element-label">{ELEMENT_LABEL[element]}</span>
            {STAGES.map((stage) => {
              const speciesKey = `${element}_${stage}`;
              const species = speciesById[speciesKey];
              const discovered = element === myElement && stage <= (myStage ?? 0);
              return (
                <div key={speciesKey} className={`monster-dex-cell ${discovered ? 'discovered' : 'locked'}`}>
                  {discovered ? (
                    <>
                      <MonsterSprite speciesKey={speciesKey} size={56} alt={species?.name} />
                      <span className="monster-dex-name">{species?.name}</span>
                    </>
                  ) : (
                    <>
                      <div className="monster-dex-silhouette">?</div>
                      <span className="monster-dex-name monster-dex-name--locked">미발견</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mypage-locked-hint">현재 계약한 속성의 진화 단계만 발견돼요. 다른 속성은 아직 만나보지 못했어요.</p>
    </div>
  );
}
