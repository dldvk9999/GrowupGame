import { STORY_INTRO } from '../lib/story';
import StoryArtwork from './StoryArtwork';

export default function StoryIntro({ onContinue }) {
  return (
    <div className="story-screen">
      <div className="story-card">
        <h2>{STORY_INTRO.title}</h2>
        <p className="story-subtitle">{STORY_INTRO.subtitle}</p>
        <StoryArtwork imageKey="dawn" />

        {STORY_INTRO.paragraphs.map((p, i) => (
          <p key={i} className="story-paragraph">{p}</p>
        ))}

        <p className="story-hint">{STORY_INTRO.goalHint}</p>

        <button className="story-continue" onClick={onContinue}>
          모험 시작하기
        </button>
      </div>
    </div>
  );
}
