import StoryArtwork from './StoryArtwork';

export default function ChapterStory({ title, body, imageKey, onContinue }) {
  return (
    <div className="story-screen">
      <div className="story-card">
        <h2>{title}</h2>
        {imageKey && <StoryArtwork imageKey={imageKey} />}
        <p className="story-paragraph">{body}</p>
        <button className="story-continue" onClick={onContinue}>
          계속하기
        </button>
      </div>
    </div>
  );
}
