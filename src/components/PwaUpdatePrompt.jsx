import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * 새 버전이 배포되면(서비스워커가 백그라운드에서 새 빌드를 감지) 화면 하단에
 * "새 버전이 있어요, 새로고침" 배너를 띄움. autoUpdate 모드는 새 서비스워커를
 * 자동으로 활성화하긴 하지만 페이지 자체를 강제로 새로고침하진 않아서,
 * 사용자가 알아채지 못하고 계속 예전 버전을 쓰게 되는 걸 방지하기 위한 안내.
 * 이 게임처럼 자주 배포되는 프로젝트에서 특히 유용함.
 */
export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // 새 배포가 있는지 30분마다 자체 점검(기본은 페이지 재방문 시에만 체크됨)
      if (registration) {
        setInterval(() => { registration.update(); }, 30 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-banner">
      <span>🔄 새 버전이 있어요!</span>
      <button
        className="btn btn-challenge"
        onClick={() => updateServiceWorker(true)}
      >
        새로고침
      </button>
      <button className="btn btn-ghost" onClick={() => setNeedRefresh(false)}>나중에</button>
    </div>
  );
}
