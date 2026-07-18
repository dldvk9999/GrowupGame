import { GAME_GUIDE_SECTIONS } from '../lib/gameGuide';
import { THEMES, getSavedTheme, applyTheme } from '../lib/theme';
import { getAudioSettings, setBgmEnabled, setSfxEnabled, setAudioVolume, playClickSound } from '../lib/audio';
import { useState } from 'react';

export default function GameGuide() {
  const [currentTheme, setCurrentTheme] = useState(getSavedTheme());
  const [audioSettings, setAudioSettingsState] = useState(getAudioSettings());

  function handleThemeClick(key) {
    applyTheme(key);
    setCurrentTheme(key);
  }

  function handleToggleBgm() {
    const next = !audioSettings.bgmEnabled;
    setBgmEnabled(next);
    setAudioSettingsState((s) => ({ ...s, bgmEnabled: next }));
  }

  function handleToggleSfx() {
    const next = !audioSettings.sfxEnabled;
    setSfxEnabled(next);
    setAudioSettingsState((s) => ({ ...s, sfxEnabled: next }));
    if (next) playClickSound();
  }

  function handleVolumeChange(e) {
    const vol = Number(e.target.value);
    setAudioVolume(vol);
    setAudioSettingsState((s) => ({ ...s, volume: vol }));
  }

  return (
    <div className="game-guide-screen">
      <p className="stage-select-hint">처음이신가요? 아래 요약만 훑어봐도 게임 흐름을 빠르게 잡을 수 있어요.</p>

      <div className="game-guide-section">
        <h3 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🔊 사운드</h3>
        <p className="stage-select-hint" style={{ marginTop: 0 }}>배경음악/효과음은 신스로 합성한 사운드예요. 이 기기에만 저장돼요.</p>
        <div className="sound-settings-row">
          <button type="button" className={`btn btn-neutral sound-toggle-btn ${audioSettings.bgmEnabled ? 'active' : ''}`} onClick={handleToggleBgm}>
            {audioSettings.bgmEnabled ? '🎵 BGM 켜짐' : '🔇 BGM 꺼짐'}
          </button>
          <button type="button" className={`btn btn-neutral sound-toggle-btn ${audioSettings.sfxEnabled ? 'active' : ''}`} onClick={handleToggleSfx}>
            {audioSettings.sfxEnabled ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐'}
          </button>
        </div>
        <div className="sound-volume-row">
          <span className="stage-select-hint" style={{ margin: 0 }}>볼륨</span>
          <input type="range" min="0" max="1" step="0.05" value={audioSettings.volume} onChange={handleVolumeChange} className="sound-volume-slider" />
        </div>
      </div>

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
