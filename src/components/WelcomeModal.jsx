const GITHUB_URL = 'https://github.com/dldvk9999/GrowupGame';

export default function WelcomeModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel welcome-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>👋 환영합니다!</h3>
          <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <p className="stage-select-hint" style={{ marginTop: 0 }}>
          작은 몬스터와 함께 성장하는 여정에 오신 걸 환영해요. 자동사냥부터 전직, PvP, 유물까지
          천천히 둘러보면서 즐겨주세요!
        </p>
        <p className="stage-select-hint">
          플레이 중 버그나 보안 이슈를 발견하셨거나, 추가됐으면 하는 기능이 있다면
          아래 GitHub 저장소에 이슈로 남겨주세요. 큰 힘이 돼요 🙏
        </p>
        <a className="btn btn-challenge welcome-github-btn" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          🔗 GitHub에서 이슈 남기기
        </a>
        <button className="btn btn-ghost" style={{ marginTop: 8, width: '100%' }} onClick={onClose}>
          시작하기
        </button>
      </div>
    </div>
  );
}
