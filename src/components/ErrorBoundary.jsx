import { Component } from 'react';

/**
 * 최상위 안전망 - 어떤 컴포넌트에서든 렌더링 중 예외가 나면 React가 기본적으로
 * 앱 전체를 unmount시켜서 화면이 완전히 하얗게 깨짐(사용자는 원인도 모르고 새로고침 외엔 방법이 없음).
 * 이 컴포넌트가 그 예외를 붙잡아서 "오류가 발생했어요" 복구 화면을 보여주고,
 * 새로고침 버튼으로 다시 시작할 수 있게 해줌. 게임 로직/서버에는 전혀 관여하지 않는
 * 순수 방어적 UI 안전장치라, 평소엔(에러가 없으면) 아무 영향도 없음.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // 콘솔에만 남김 - 별도 원격 로깅 인프라는 없음
    console.error('처리되지 않은 렌더링 오류:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-screen">
          <div className="error-boundary-card">
            <h2>😵 앗, 문제가 생겼어요</h2>
            <p>예상치 못한 오류가 발생했어요. 새로고침하면 대부분 해결돼요.</p>
            <button className="btn btn-challenge" onClick={() => window.location.reload()}>
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
