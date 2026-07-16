import { useEffect, useState, useCallback } from 'react';
import { syncDailyMails, fetchMails, claimMail } from '../lib/mail';
import { getItem } from '../lib/itemCatalog';

export default function Mailbox({ userId, onGoldChange, gold }) {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await syncDailyMails();
      const list = await fetchMails(userId);
      setMails(list);
    } catch (err) {
      setError(err.message ?? '우편함을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function handleClaim(mail) {
    setError('');
    setClaimingId(mail.id);
    try {
      await claimMail(mail.id);
      if (mail.gold_amount > 0) onGoldChange(gold + mail.gold_amount);
      setMails((prev) => prev.map((m) => (m.id === mail.id ? { ...m, claimed: true } : m)));
    } catch (err) {
      setError(err.message ?? '수령에 실패했어요.');
    } finally {
      setClaimingId(null);
    }
  }

  const unclaimed = mails.filter((m) => !m.claimed);
  const claimed = mails.filter((m) => m.claimed);

  return (
    <div className="mailbox-screen">
      <h2>우편함</h2>
      <p className="stage-select-hint">매일 아침 8시 / 낮 12시 / 저녁 7시(서울시간) 정각부터 1시간 안에 접속해야 그 우편을 받을 수 있어요. 놓치면 그 회차는 사라져요.</p>

      {error && <p className="shop-error">{error}</p>}
      {loading && <p className="app-loading">불러오는 중...</p>}

      {!loading && unclaimed.length === 0 && claimed.length === 0 && (
        <p className="inventory-empty">아직 도착한 우편이 없어요. 정해진 시간이 지나면 자동으로 도착해요.</p>
      )}

      {unclaimed.length > 0 && (
        <div className="mail-list">
          {unclaimed.map((mail) => (
            <MailRow key={mail.id} mail={mail} onClaim={handleClaim} claiming={claimingId === mail.id} />
          ))}
        </div>
      )}

      {claimed.length > 0 && (
        <>
          <h3 className="mypage-subtitle">수령 완료</h3>
          <div className="mail-list">
            {claimed.map((mail) => (
              <MailRow key={mail.id} mail={mail} onClaim={handleClaim} claiming={false} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MailRow({ mail, onClaim, claiming }) {
  const item = mail.item_key ? getItem(mail.item_key) : null;
  return (
    <div className={`mail-row ${mail.claimed ? 'claimed' : ''}`}>
      <div className="mail-row-main">
        <strong>{mail.title}</strong>
        <p className="mail-row-body">{mail.body}</p>
        <div className="mail-row-reward">
          {mail.gold_amount > 0 && <span>💰 {mail.gold_amount.toLocaleString()}</span>}
          {item && <span>{item.icon} {item.name}</span>}
        </div>
      </div>
      {mail.claimed ? (
        <span className="mail-row-done">수령완료</span>
      ) : (
        <button className="btn btn-challenge" disabled={claiming} onClick={() => onClaim(mail)}>
          {claiming ? '수령 중...' : '수령'}
        </button>
      )}
    </div>
  );
}
