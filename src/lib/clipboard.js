import { playClickSound } from './audio';
import { showToast } from './toast';

/**
 * 클립보드 복사 + 클릭 사운드, 실패 시 에러 토스트.
 * 뽑기 결과 공유/PvP 결과 공유/월드보스 결과 공유/닉네임 초대문구 복사 등
 * 여러 화면에서 거의 똑같은 try/catch 코드가 반복되고 있어서 하나로 통합함.
 * 성공하면 true를 반환하므로, 호출부는 이 값으로 "복사됨" 표시 상태(setTimeout 리셋)만 관리하면 됨.
 * @param {string} text - 복사할 텍스트
 * @param {string} [errorMessage] - 실패 시 보여줄 토스트 메시지(기본값 있음, 필요하면 커스텀)
 * @returns {Promise<boolean>}
 */
export async function copyToClipboardWithFeedback(text, errorMessage = '복사에 실패했어요.') {
  try {
    await navigator.clipboard.writeText(text);
    playClickSound();
    return true;
  } catch {
    showToast(errorMessage, 'error');
    return false;
  }
}
