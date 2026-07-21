import { GAME_GUIDE_SECTIONS } from '../lib/gameGuide';
import { THEMES, getSavedTheme, applyTheme } from '../lib/theme';
import { getAudioSettings, setBgmEnabled, setSfxEnabled, setAudioVolume, playClickSound } from '../lib/audio';
import { isPushSupported, isCurrentlySubscribed, subscribeToPush, unsubscribeFromPush } from '../lib/push';
import { getPvpTier } from '../lib/pvpTier';
import { fetchClaimedAchievements } from '../lib/achievements';
import { showToast } from '../lib/toast';
import { useState, useEffect } from 'react';

export default function GameGuide({ userId, isFounder, pvpWins }) {
  const [currentTheme, setCurrentTheme] = useState(getSavedTheme());
  const [audioSettings, setAudioSettingsState] = useState(getAudioSettings());
  const [claimedKeys, setClaimedKeys] = useState(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    setPushSupported(isPushSupported());
    isCurrentlySubscribed().then(setPushSubscribed).catch(() => setPushSubscribed(false));
  }, []);

  async function handleTogglePush() {
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush();
        setPushSubscribed(false);
        showToast('알림을 껐어요.', 'info');
      } else {
        await subscribeToPush();
        setPushSubscribed(true);
        showToast('알림을 켰어요! 아침·점심·저녁 보상 소식을 보내드릴게요.', 'success');
      }
    } catch (err) {
      showToast(err.message ?? '알림 설정에 실패했어요.', 'error');
    } finally {
      setPushLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    fetchClaimedAchievements(userId).then(setClaimedKeys).catch(() => setClaimedKeys(new Set()));
  }, [userId]);

  function isThemeUnlocked(key) {
    const unlock = THEMES[key]?.unlock;
    if (!unlock) return true;
    if (unlock.type === 'achievement') {
      if (unlock.key === 'founder') return !!isFounder; // 090 이전부터 있던 예외 - App.jsx가 이미 계산해둔 값 재사용
      return claimedKeys?.has(unlock.key) ?? false;
    }
    if (unlock.type === 'pvpTier') return getPvpTier(pvpWins).key === unlock.tier;
    return true;
  }

  function handleThemeClick(key) {
    if (!isThemeUnlocked(key)) {
      showToast(`🔒 ${THEMES[key].unlock.label} 시 사용할 수 있어요.`, 'error');
      return;
    }
    applyTheme(key);
    setCurrentTheme(key);
    playClickSound();
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

      {pushSupported && (
        <div className="game-guide-section">
          <h3 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🔔 알림</h3>
          <p className="stage-select-hint" style={{ marginTop: 0 }}>
            켜두면 아침·점심·저녁 보상 시간대에 알림을 보내드려요. 브라우저 알림 권한이 필요해요.
          </p>
          <button
            type="button"
            className={`btn btn-neutral sound-toggle-btn ${pushSubscribed ? 'active' : ''}`}
            onClick={handleTogglePush}
            disabled={pushLoading}
          >
            {pushLoading ? '처리 중...' : pushSubscribed ? '🔔 알림 켜짐' : '🔕 알림 꺼짐'}
          </button>
        </div>
      )}

      <div className="game-guide-section">
        <h3 className="mypage-subtitle" style={{ margin: '0 0 8px' }}>🎨 테마 컬러</h3>
        <p className="stage-select-hint" style={{ marginTop: 0 }}>취향에 맞게 앱의 포인트 컬러를 바꿔보세요. 이 기기에만 저장돼요.</p>
        <div className="theme-picker">
          {Object.entries(THEMES).map(([key, theme]) => {
            const unlocked = isThemeUnlocked(key);
            return (
              <button
                key={key}
                type="button"
                className={`theme-swatch ${currentTheme === key ? 'active' : ''} ${!unlocked ? 'locked' : ''}`}
                style={{ background: `linear-gradient(135deg, ${theme.fire}, ${theme.gold})` }}
                onClick={() => handleThemeClick(key)}
                title={unlocked ? theme.label : `🔒 ${theme.unlock.label} 시 해금`}
              >
                {!unlocked ? '🔒' : currentTheme === key && '✓'}
              </button>
            );
          })}
        </div>
        <p className="stage-select-hint" style={{ marginBottom: 0 }}>{THEMES[currentTheme]?.label}</p>
        {Object.entries(THEMES).some(([k]) => !isThemeUnlocked(k)) && (
          <p className="stage-select-hint theme-locked-hint">
            🔒 표시된 테마는 특별 조건 달성 시 해금돼요: {Object.entries(THEMES).filter(([k]) => !isThemeUnlocked(k)).map(([, t]) => t.unlock.label).join(', ')}
          </p>
        )}
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
