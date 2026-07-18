import { GAME_GUIDE_SECTIONS } from '../lib/gameGuide';

export default function GameGuide() {
  return (
    <div className="game-guide-screen">
      <p className="stage-select-hint">처음이신가요? 아래 요약만 훑어봐도 게임 흐름을 빠르게 잡을 수 있어요.</p>
      {GAME_GUIDE_SECTIONS.map((section, i) => (
        <div key={i} className="game-guide-section">
          <h3 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>{section.icon} {section.title}</h3>
          <ul className="patch-note-list">
            {section.tips.map((tip, j) => (
              <li key={j}>{tip}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
