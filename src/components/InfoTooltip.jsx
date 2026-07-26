import { useState } from 'react';

// PC(마우스)에서만 호버로 열리게 하고, 터치 전용 기기에서는 호버 이벤트 자체를 등록하지
// 않음(신규 버그수정, 사용자 제보 - "모바일에서 두 번 눌러야 뜬다"). 원인: 터치 탭이
// 브라우저에서 mouseenter -> click 순서로 합성 이벤트를 발생시키는데, mouseenter로
// setOpen(true) 했다가 곧바로 click 핸들러의 setOpen(o => !o)가 그걸 다시 꺼버려서
// (같은 틱에 배치되어 최종 상태가 false로 덮어써짐) 첫 탭은 항상 "안 열린 것처럼" 보였음.
const supportsHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

/**
 * 탭/화면 설명 텍스트를 아이콘 버튼(ⓘ) 뒤로 숨기는 범용 툴팁(신규, 사용자 요청).
 * PC: 마우스를 올리면 보임(hover 지원 기기에서만 onMouseEnter/Leave 등록).
 * 모바일: 탭하면 열리고, 닫기(✕) 버튼이나 바깥 영역을 탭하면 닫힘.
 *
 * 사용법: <InfoTooltip text="설명 문구" /> 만 붙이면 됨(children으로 커스텀 트리거도 가능).
 */
export default function InfoTooltip({ text, children, align = 'left' }) {
  const [open, setOpen] = useState(false);

  const hoverHandlers = supportsHover
    ? { onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false) }
    : {};

  return (
    <span className="info-tooltip-wrap" {...hoverHandlers}>
      <button
        type="button"
        className="info-tooltip-trigger"
        onClick={(e) => {
          e.stopPropagation();
          // 호버 지원 기기에서는 이미 mouseenter로 열려있는 상태에서 클릭이 들어올 수
          // 있으니 토글, 터치 기기에서는 항상 "열기"로 취급해서 첫 탭에 바로 뜨게 함
          setOpen(supportsHover ? (o => !o) : true);
        }}
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
