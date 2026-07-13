import { useState } from 'react';
import { TOTAL_CHAPTERS, STAGES_PER_CHAPTER, toStageIndex, getChapterName, getChapterElement } from '../lib/stages';

const ELEMENT_LABEL = { fire: '화', water: '수', grass: '초' };

export default function StageSelect({ clearedStageIds, onSelectStage, currentStageIndex }) {
  const [openChapter, setOpenChapter] = useState(
    Math.floor((currentStageIndex - 1) / STAGES_PER_CHAPTER) + 1
  );

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
      <p className="stage-select-hint">클리어한 스테이지는 자유롭게 다시 도전할 수 있어요.</p>

      <div className="chapter-list">
        {Array.from({ length: TOTAL_CHAPTERS }, (_, i) => i + 1).map((chapter) => {
          const unlocked = isChapterUnlocked(chapter);
          const cleared = chapterClearedCount(chapter);
          const isOpen = openChapter === chapter;
          return (
            <div key={chapter} className={`chapter-item ${unlocked ? '' : 'locked'}`}>
              <button
                className="chapter-header"
                disabled={!unlocked}
                onClick={() => setOpenChapter(isOpen ? null : chapter)}
              >
                <span className={`chapter-tag element-${getChapterElement(chapter)}`}>
                  {ELEMENT_LABEL[getChapterElement(chapter)]}
                </span>
                <span className="chapter-title">
                  {chapter}. {getChapterName(chapter)}
                </span>
                <span className="chapter-progress">
                  {unlocked ? `${cleared}/${STAGES_PER_CHAPTER}` : '🔒'}
                </span>
              </button>

              {isOpen && unlocked && (
                <div className="substage-grid">
                  {Array.from({ length: STAGES_PER_CHAPTER }, (_, i) => i + 1).map((stage) => {
                    const index = toStageIndex(chapter, stage);
                    const stageUnlocked = isStageUnlocked(index);
                    const stageCleared = clearedStageIds.has(index);
                    const isBoss = stage === STAGES_PER_CHAPTER;
                    return (
                      <button
                        key={stage}
                        className={`substage-btn ${stageCleared ? 'cleared' : ''} ${isBoss ? 'boss' : ''}`}
                        disabled={!stageUnlocked}
                        onClick={() => onSelectStage(chapter, stage)}
                      >
                        {isBoss ? '👑' : stage}
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
