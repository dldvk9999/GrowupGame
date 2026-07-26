import { useState } from 'react';
import { PATCH_NOTES } from '../lib/patchNotes';

/** 패치노트를 날짜(=한 페이지에 한 항목) 단위로 페이지네이션(신규, 사용자 요청).
 * PATCH_NOTES[0]이 가장 최신 날짜라는 전제 하에, 0페이지=최신을 기본으로 보여줌. */
export default function PatchNotes() {
  const [page, setPage] = useState(0);
  const totalPages = PATCH_NOTES.length;
  const entry = PATCH_NOTES[page];

  if (!entry) {
    return <p className="stage-select-hint">패치노트가 없어요.</p>;
  }

  return (
    <div className="patch-notes-screen">
      <p className="stage-select-hint">이 게임은 계속 업데이트되고 있어요. 최근 변경사항을 확인해보세요!</p>

      <div className="patch-note-entry">
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

      {totalPages > 1 && (
        <div className="patch-note-pagination">
          <button
            type="button"
            className="btn btn-neutral"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← 최신
          </button>
          <span className="patch-note-page-indicator">{page + 1} / {totalPages}</span>
          <button
            type="button"
            className="btn btn-neutral"
            disabled={page === totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            이전 →
          </button>
        </div>
      )}
    </div>
  );
}
