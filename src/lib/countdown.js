import { useEffect, useState } from 'react';

/**
 * "매일 서울시간 오전 8시"까지 남은 시간을 "HH:MM:SS"로. 이미 지났으면 내일 오전 8시까지 계산.
 * onReset이 있으면 그 시각에 딱 한 번(1.2초 여유를 두고) 호출해서 화면을 자동 갱신할 수 있게 함.
 */
export function useCountdownToDaily8AM(onReset) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    let firedReset = false;
    function tick() {
      const now = new Date();
      // 서울시간(UTC+9) 기준 "오늘 08:00"을 UTC 타임스탬프로 구한 뒤, 이미 지났으면 24시간 더함
      const seoulNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const seoulTodayReset = new Date(Date.UTC(seoulNow.getUTCFullYear(), seoulNow.getUTCMonth(), seoulNow.getUTCDate(), 8, 0, 0));
      let resetUtc = new Date(seoulTodayReset.getTime() - 9 * 60 * 60 * 1000);
      if (resetUtc <= now) resetUtc = new Date(resetUtc.getTime() + 24 * 60 * 60 * 1000);

      const diffSec = Math.max(0, Math.floor((resetUtc - now) / 1000));
      const hh = String(Math.floor(diffSec / 3600)).padStart(2, '0');
      const mm = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
      const ss = String(diffSec % 60).padStart(2, '0');
      setRemaining(`${hh}:${mm}:${ss}`);

      if (diffSec <= 1 && !firedReset) {
        firedReset = true;
        setTimeout(() => { onReset?.(); firedReset = false; }, 1200);
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [onReset]);
  return remaining;
}
