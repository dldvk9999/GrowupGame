import { useEffect, useRef, useState } from 'react';
import { TOTAL_CHAPTERS, STAGES_PER_CHAPTER, toStageIndex, getChapterName, getChapterElement } from '../lib/stages';
import { getChapterStory } from '../lib/stageStory';
import MonsterSprite from './MonsterSprite';

const ELEMENT_LABEL = { fire: '화속성', water: '수속성', grass: '초속성' };

export default function StageSelect({ clearedStageIds, onSelectStage, currentStageIndex }) {
  const currentChapter = Math.floor((currentStageIndex - 1) / STAGES_PER_CHAPTER) + 1;
  const [selectedChapter, setSelectedChapter] = useState(currentChapter);
  const cardRefs = useRef({});
  const trackRef = useRef(null);

  useEffect(() => {
    cardRefs.current[currentChapter]?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleCardClick(chapter, unlocked) {
    if (!unlocked) return;
    setSelectedChapter(chapter);
    cardRefs.current[chapter]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  function scrollByCard(dir) {
    trackRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  }

  const selectedStory = getChapterStory(selectedChapter);
  const selectedElement = getChapterElement(selectedChapter);
  const selectedCleared = chapterClearedCount(selectedChapter);
  const selectedUnlocked = isChapterUnlocked(selectedChapter);

  return (
    <div className="stage-select">
      <h2>스테이지 선택</h2>
      <p className="stage-select-hint">
        카드를 좌우로 넘겨 챕터를 둘러보고, 열려있는 챕터를 골라 스테이지에 도전하세요.
      </p>

      <div className="chapter-carousel-wrap">
        <button className="carousel-arrow left" onClick={() => scrollByCard(-1)} aria-label="이전 챕터">‹</button>
        <div className="chapter-carousel" ref={trackRef}>
          {Array.from({ length: TOTAL_CHAPTERS }, (_, i) => i + 1).map((chapter) => {
            const unlocked = isChapterUnlocked(chapter);
            const cleared = chapterClearedCount(chapter);
            const element = getChapterElement(chapter);
            const isCurrent = chapter === currentChapter;
            const isSelected = chapter === selectedChapter;
            const story = getChapterStory(chapter);
            return (
              <button
                key={chapter}
                ref={(el) => { cardRefs.current[chapter] = el; }}
                type="button"
                className={`chapter-card element-${element} ${unlocked ? 'unlocked' : 'locked'} ${isSelected ? 'selected' : ''} ${isCurrent ? 'is-current' : ''}`}
                onClick={() => handleCardClick(chapter, unlocked)}
                disabled={!unlocked}
              >
                {isCurrent && <span className="chapter-card-badge">현재</span>}
                <div className="chapter-card-image">
                  {unlocked ? (
                    <MonsterSprite speciesKey={`${element}_1`} size={72} alt={getChapterName(chapter)} />
                  ) : (
                    <span className="chapter-card-lock">🔒</span>
                  )}
                </div>
                <div className="chapter-card-num">Chapter {chapter}</div>
                <div className="chapter-card-name">{getChapterName(chapter)}</div>
                <div className="chapter-card-progress">
                  {unlocked ? `${cleared}/${STAGES_PER_CHAPTER} 클리어` : '잠김'}
                </div>
                {unlocked && (
                  <p className="chapter-card-story">{story.body}</p>
                )}
              </button>
            );
          })}
        </div>
        <button className="carousel-arrow right" onClick={() => scrollByCard(1)} aria-label="다음 챕터">›</button>
      </div>

      {selectedUnlocked && (
        <div className="selected-chapter-panel">
          <div className="selected-chapter-header">
            <span className={`chapter-tag element-${selectedElement}`}>{ELEMENT_LABEL[selectedElement]}</span>
            <div>
              <div className="selected-chapter-title">{selectedChapter}. {getChapterName(selectedChapter)}</div>
              <div className="selected-chapter-sub">{selectedStory.title} · {selectedCleared}/{STAGES_PER_CHAPTER} 클리어</div>
            </div>
          </div>

          <div className="substage-grid">
            {Array.from({ length: STAGES_PER_CHAPTER }, (_, i) => i + 1).map((stageNum) => {
              const index = toStageIndex(selectedChapter, stageNum);
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
                  onClick={() => stageUnlocked && onSelectStage(selectedChapter, stageNum)}
                >
                  {stageUnlocked ? (isBoss ? '👑' : stageNum) : '🔒'}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
