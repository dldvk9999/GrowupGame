import { useState } from 'react';

/**
 * 탭/화면 설명 텍스트를 아이콘 버튼(ⓘ) 뒤로 숨기는 범용 툴팁(신규, 사용자 요청).
 * PC: 마우스를 올리면 보임(:hover 겸용 - onMouseEnter/Leave). 모바일: 탭하면 열리고,
 * 닫기(✕) 버튼이나 바깥 영역을 탭하면 닫힘(호버가 없는 터치 환경 대응).
 *
 * 사용법: <InfoTooltip text="설명 문구" /> 만 붙이면 됨(children으로 커스텀 트리거도 가능).
 */
export default function InfoTooltip({ text, children, align = 'left' }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="info-tooltip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-tooltip-trigger"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label="설명 보기"
      >
        {children ?? 'ⓘ'}
      </button>
      {open && (
        <>
          {/* 모바일에서 바깥을 탭하면 닫히도록 - 데스크톱에선 mouseleave가 이미 처리하므로 겹쳐도 무해 */}
          <span className="info-tooltip-backdrop" onClick={() => setOpen(false)} />
          <span className={`info-tooltip-popup info-tooltip-popup--${align}`} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="info-tooltip-close" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
            <span className="info-tooltip-text">{text}</span>
          </span>
        </>
      )}
    </span>
  );
}
