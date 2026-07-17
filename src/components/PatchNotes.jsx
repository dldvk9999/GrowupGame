import { PATCH_NOTES } from '../lib/patchNotes';

export default function PatchNotes() {
  return (
    <div className="patch-notes-screen">
      <p className="stage-select-hint">이 게임은 계속 업데이트되고 있어요. 최근 변경사항을 확인해보세요!</p>
      {PATCH_NOTES.map((entry, i) => (
        <div key={i} className="patch-note-entry">
          <div className="patch-note-header">
            <strong>{entry.title}</strong>
            <span className="patch-note-date">{entry.date}</span>
          </div>
          <ul className="patch-note-list">
            {entry.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
