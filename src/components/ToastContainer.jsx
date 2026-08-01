import { useEffect, useState } from 'react';
import { subscribeToast } from '../lib/toast';

const MAX_VISIBLE_TOASTS = 3;

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToast((toast) => {
      // (사용자 요청) 최대 3개까지만 동시에 뜨도록 제한 - 4개째가 생기면 가장 오래된
      // 토스트를 밀어내고 새 토스트를 추가함(연속 알림이 몰릴 때 화면이 뒤덮이는 것 방지)
      setToasts((prev) => [...prev, toast].slice(-MAX_VISIBLE_TOASTS));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3200);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
