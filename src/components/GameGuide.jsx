import { GAME_GUIDE_SECTIONS } from '../lib/gameGuide';
import { THEMES, getSavedTheme, applyTheme } from '../lib/theme';
import { useState } from 'react';

export default function GameGuide() {
  const [currentTheme, setCurrentTheme] = useState(getSavedTheme());

  function handleThemeClick(key) {
    applyTheme(key);
    setCurrentTheme(key);
  }

  return (
    <div className="game-guide-screen">
      <p className="stage-select-hint">처음이신가요? 아래 요약만 훑어봐도 게임 흐름을 빠르게 잡을 수 있어요.</p>

      <div className="game-guide-section">
        <h3 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🎨 테마 컬러</h3>
        <p className="stage-select-hint" style={{ marginTop: 0 }}>취향에 맞게 앱의 포인트 컬러를 바꿔보세요. 이 기기에만 저장돼요.</p>
        <div className="theme-picker">
          {Object.entries(THEMES).map(([key, theme]) => (
            <button
              key={key}
              type="button"
              className={`theme-swatch ${currentTheme === key ? 'active' : ''}`}
              style={{ background: `linear-gradient(135deg, ${theme.fire}, ${theme.gold})` }}
              onClick={() => handleThemeClick(key)}
              title={theme.label}
            >
              {currentTheme === key && '✓'}
            </button>
          ))}
        </div>
        <p className="stage-select-hint" style={{ marginBottom: 0 }}>{THEMES[currentTheme]?.label}</p>
      </div>

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
