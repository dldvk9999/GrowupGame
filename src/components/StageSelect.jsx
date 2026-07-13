import { useEffect, useRef, useState } from 'react';
import { TOTAL_CHAPTERS, STAGES_PER_CHAPTER, toStageIndex, getChapterName, getChapterElement } from '../lib/stages';

const ELEMENT_LABEL = { fire: '화', water: '수', grass: '초' };

export default function StageSelect({ clearedStageIds, onSelectStage, currentStageIndex }) {
  const currentChapter = Math.floor((currentStageIndex - 1) / STAGES_PER_CHAPTER) + 1;
  const [openChapter, setOpenChapter] = useState(currentChapter);
  const openRef = useRef(null);

  useEffect(() => {
    openRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  function isStageUnlocked(index) {
    return index === 1 || clearedStageIds.has(index) || clearedStageIds.has(index - 1);
  }

  function chapterClearedCount(chapter) {
    let count = 0;
    for (let s = 1; s <= STAGES_PER_CHAPTER; s++) {
      if (clearedStageIds.has(toStageIndex(chapter, s))) count++;
    }
    return count;
  }

  function isChapterUnlocked(chapter) {
    if (chapter === 1) return true;
    return isStageUnlocked(toStageIndex(chapter, 1));
  }

  return (
    <div className="stage-select">
      <h2>스테이지 선택</h2>
      <p className="stage-select-hint">
        ✅ 클리어한 스테이지는 언제든 다시 도전할 수 있어요. 🔒 잠긴 챕터는 이전 챕터의 10번(보스)을 깨야 열려요.
      </p>

      <div className="chapter-list">
        {Array.from({ length: TOTAL_CHAPTERS }, (_, i) => i + 1).map((chapter) => {
          const unlocked = isChapterUnlocked(chapter);
          const cleared = chapterClearedCount(chapter);
          const isOpen = openChapter === chapter;
          const isCurrent = chapter === currentChapter;
          return (
            <div
              key={chapter}
              ref={isCurrent ? openRef : null}
              className={`chapter-item ${unlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'is-current' : ''}`}
            >
              <button
                type="button"
                className="chapter-header"
                disabled={!unlocked}
                onClick={() => unlocked && setOpenChapter(isOpen ? null : chapter)}
              >
                <span className={`chapter-tag element-${getChapterElement(chapter)}`}>
                  {ELEMENT_LABEL[getChapterElement(chapter)]}
                </span>
                <span className="chapter-title">
                  {chapter}. {getChapterName(chapter)}
                  {isCurrent && <span className="chapter-current-badge">현재</span>}
                </span>
                <span className="chapter-progress">
                  {unlocked ? (cleared === STAGES_PER_CHAPTER ? '✅ 완료' : `${cleared}/${STAGES_PER_CHAPTER}`) : '🔒 잠김'}
                </span>
                <span className="chapter-chevron">{unlocked ? (isOpen ? '▲' : '▼') : ''}</span>
              </button>

              {isOpen && unlocked && (
                <div className="substage-grid">
                  {Array.from({ length: STAGES_PER_CHAPTER }, (_, i) => i + 1).map((stageNum) => {
                    const index = toStageIndex(chapter, stageNum);
                    const stageUnlocked = isStageUnlocked(index);
                    const stageCleared = clearedStageIds.has(index);
                    const isBoss = stageNum === STAGES_PER_CHAPTER;
                    const isHere = index === currentStageIndex;
                    return (
                      <button
                        key={stageNum}
                        type="button"
                        className={`substage-btn ${stageCleared ? 'cleared' : ''} ${isBoss ? 'boss' : ''} ${isHere ? 'here' : ''} ${!stageUnlocked ? 'locked' : ''}`}
                        disabled={!stageUnlocked}
                        onClick={() => stageUnlocked && onSelectStage(chapter, stageNum)}
                      >
                        {stageUnlocked ? (isBoss ? '👑' : stageNum) : '🔒'}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
