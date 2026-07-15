import { useState } from 'react';
import { redeemCoupon } from '../lib/coupon';

export default function CouponRedeem() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await redeemCoupon(code.trim());
      setMessage({ type: 'ok', text: '쿠폰이 등록됐어요! 우편함에서 보상을 수령하세요.' });
      setCode('');
    } catch (err) {
      setMessage({ type: 'bad', text: err.message ?? '쿠폰 등록에 실패했어요.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="coupon-screen">
      <h2>쿠폰 입력</h2>
      <p className="stage-select-hint">쿠폰을 등록하면 보상이 우편함으로 도착해요.</p>

      <form className="mypage-nickname-form" onSubmit={handleSubmit}>
        <div className="field">
          <label>쿠폰 코드</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="쿠폰 코드를 입력하세요"
            style={{ textTransform: 'uppercase' }}
          />
        </div>
        {message && <p className={`hint ${message.type === 'ok' ? 'ok' : 'bad'}`}>{message.text}</p>}
        <button type="submit" className="auth-submit" disabled={loading || !code.trim()}>
          {loading ? '등록 중...' : '쿠폰 등록'}
        </button>
      </form>
    </div>
  );
}
