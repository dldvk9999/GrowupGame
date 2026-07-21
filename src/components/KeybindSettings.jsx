import { useState, useEffect, useRef } from 'react';
import { getJobSkillKeybinds, setJobSkillKeybinds, resetJobSkillKeybinds, getDefaultJobSkillKeybinds } from '../lib/keybinds';
import { showToast } from '../lib/toast';
import { playClickSound } from '../lib/audio';

const TIER_LABELS = ['1차', '2차', '3차', '4차', '5차', '6차', '7차', '8차', '9차', '10차', '(여유1)', '(여유2)'];

export default function KeybindSettings() {
  const [keys, setKeys] = useState(() => getJobSkillKeybinds());
  const [listeningIndex, setListeningIndex] = useState(null);
  const listeningRef = useRef(null);
  listeningRef.current = listeningIndex;

  useEffect(() => {
    function handleKeyDown(e) {
      if (listeningRef.current === null) return;
      e.preventDefault();
      const key = e.key.length === 1 ? e.key.toLowerCase() : null;
      if (!key) {
        showToast('문자/숫자 키만 사용할 수 있어요.', 'error');
        setListeningIndex(null);
        return;
      }
      setKeys((prev) => {
        const idx = listeningRef.current;
        // 이미 다른 슬롯에 배정된 키면, 그 슬롯은 비워서(자리교체 대신 명확하게 안내) 중복 방지
        const next = prev.map((k, i) => (i === idx ? key : (k === key ? '' : k)));
        return next;
      });
      setListeningIndex(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleSave() {
    if (keys.some((k) => !k)) {
      showToast('비어있는 키가 있어요. 전부 채워주세요.', 'error');
      return;
    }
    setJobSkillKeybinds(keys);
    playClickSound();
    showToast('키보드 설정을 저장했어요.', 'success');
  }

  function handleReset() {
    resetJobSkillKeybinds();
    setKeys(getDefaultJobSkillKeybinds());
    showToast('기본값으로 되돌렸어요.', 'info');
  }

  return (
    <div className="keybind-settings">
      <p className="stage-select-hint">
        전투 중 전직 스킬을 마우스 없이 바로 쓸 수 있는 단축키예요. 슬롯을 눌러 원하는 키를 누르면 바로 바뀌어요.
        이미 다른 슬롯이 쓰던 키를 고르면 그 슬롯은 비워지니, 저장 전에 전부 채워주세요.
      </p>
      <div className="keybind-list">
        {keys.map((key, i) => (
          <button
            key={i}
            type="button"
            className={`keybind-slot ${listeningIndex === i ? 'listening' : ''}`}
            onClick={() => setListeningIndex(i)}
          >
            <span className="keybind-slot-label">{TIER_LABELS[i]} 전직스킬</span>
            <span className="keybind-slot-key">{listeningIndex === i ? '키를 누르세요...' : (key ? key.toUpperCase() : '(없음)')}</span>
          </button>
        ))}
      </div>
      <div className="gacha-draw-buttons" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-challenge" onClick={handleSave}>저장하기</button>
        <button type="button" className="btn btn-ghost" onClick={handleReset}>기본값으로 되돌리기</button>
      </div>
    </div>
  );
}
