import { useState, useEffect, useCallback } from 'react';
import {
  MAX_FRIENDS, sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
  cancelFriendRequest, removeFriend, fetchMyFriends, fetchIncomingFriendRequests, fetchOutgoingFriendRequests,
} from '../lib/friends';
import { showToast } from '../lib/toast';
import { copyToClipboardWithFeedback } from '../lib/clipboard';

export default function Friends({ userId }) {
  const [tab, setTab] = useState('list'); // 'list' | 'requests'
  const [uidCopied, setUidCopied] = useState(false);
  const [targetUid, setTargetUid] = useState('');
  const [sending, setSending] = useState(false);

  const [friends, setFriends] = useState(null); // null=로딩중
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  const [incoming, setIncoming] = useState(null);
  const [outgoing, setOutgoing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadFriends = useCallback((p) => {
    fetchMyFriends(p).then(({ friends: rows, totalCount: total }) => {
      setFriends(rows);
      setTotalCount(total);
    }).catch(() => { setFriends([]); setTotalCount(0); });
  }, []);

  const loadRequests = useCallback(() => {
    fetchIncomingFriendRequests().then(setIncoming).catch(() => setIncoming([]));
    fetchOutgoingFriendRequests().then(setOutgoing).catch(() => setOutgoing([]));
  }, []);

  useEffect(() => { loadFriends(page); }, [page, loadFriends]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function handleCopyUid() {
    if (await copyToClipboardWithFeedback(userId)) {
      setUidCopied(true);
      setTimeout(() => setUidCopied(false), 2000);
    }
  }

  async function handleSendRequest(e) {
    e.preventDefault();
    const uid = targetUid.trim();
    if (!uid) return;
    setSending(true);
    try {
      await sendFriendRequest(uid);
      showToast('친구 요청을 보냈어요.', 'success');
      setTargetUid('');
      loadRequests();
    } catch (err) {
      showToast(err.message ?? '요청에 실패했어요.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleAccept(requesterId) {
    setBusyId(requesterId);
    try {
      await acceptFriendRequest(requesterId);
      showToast('친구가 됐어요!', 'success');
      loadRequests();
      loadFriends(0);
      setPage(0);
    } catch (err) {
      showToast(err.message ?? '수락에 실패했어요.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(requesterId) {
    setBusyId(requesterId);
    try {
      await rejectFriendRequest(requesterId);
      loadRequests();
    } catch (err) {
      showToast(err.message ?? '거절에 실패했어요.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(targetId) {
    setBusyId(targetId);
    try {
      await cancelFriendRequest(targetId);
      loadRequests();
    } catch (err) {
      showToast(err.message ?? '취소에 실패했어요.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(friendId) {
    setBusyId(friendId);
    try {
      await removeFriend(friendId);
      showToast('친구를 삭제했어요.', 'info');
      loadFriends(page);
    } catch (err) {
      showToast(err.message ?? '삭제에 실패했어요.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / 20));
  const pendingBadgeCount = incoming?.length ?? 0;

  return (
    <div className="friends-screen">
      <h2>👥 친구</h2>

      <div className="friends-uid-card">
        <div className="friends-uid-row">
          <span>내 UID</span>
          <code className="friends-uid-value">{userId}</code>
          <button type="button" className="btn btn-ghost" onClick={handleCopyUid}>
            {uidCopied ? '✅ 복사됨' : '📋 복사'}
          </button>
        </div>
        <form className="friends-add-form" onSubmit={handleSendRequest}>
          <input
            value={targetUid}
            onChange={(e) => setTargetUid(e.target.value)}
            placeholder="친구 UID 붙여넣기"
          />
          <button type="submit" className="btn btn-challenge" disabled={sending || !targetUid.trim()}>
            {sending ? '보내는 중...' : '친구 추가'}
          </button>
        </form>
        <p className="stage-select-hint">친구는 최대 {MAX_FRIENDS}명까지 등록할 수 있어요. 상대가 수락해야 친구가 성립돼요.</p>
      </div>

      <div className="shop-tabs">
        <button className={`shop-tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          🧑‍🤝‍🧑 친구 목록 ({totalCount}/{MAX_FRIENDS})
        </button>
        <button className={`shop-tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          📬 요청함{pendingBadgeCount > 0 && <span className="mail-unread-dot" aria-label="받은 요청 있음" />}
        </button>
      </div>

      {tab === 'list' && (
        <div>
          {friends === null && <p className="stage-select-hint">불러오는 중...</p>}
          {friends && friends.length === 0 && <p className="inventory-empty">아직 친구가 없어요. UID로 친구를 추가해보세요!</p>}
          {friends && friends.length > 0 && (
            <>
              <div className="friends-list">
                {friends.map((f) => (
                  <div key={f.friendId} className="friends-list-row">
                    <span className="friends-list-name">
                      {f.equippedTitle && <span className="app-title-badge">[{f.equippedTitle}]</span>}
                      {f.nickname}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId === f.friendId}
                      onClick={() => handleRemove(f.friendId)}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="friends-pagination">
                  <button className="btn btn-ghost" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>◀ 이전</button>
                  <span>{page + 1} / {totalPages}</span>
                  <button className="btn btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>다음 ▶</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div>
          <h3 className="mypage-subtitle" style={{ marginTop: 0 }}>받은 요청</h3>
          {incoming === null && <p className="stage-select-hint">불러오는 중...</p>}
          {incoming && incoming.length === 0 && <p className="inventory-empty">받은 요청이 없어요.</p>}
          {incoming && incoming.length > 0 && (
            <div className="friends-list">
              {incoming.map((r) => (
                <div key={r.requesterId} className="friends-list-row">
                  <span className="friends-list-name">{r.nickname}</span>
                  <div className="friends-request-actions">
                    <button className="btn btn-challenge" disabled={busyId === r.requesterId} onClick={() => handleAccept(r.requesterId)}>수락</button>
                    <button className="btn btn-ghost" disabled={busyId === r.requesterId} onClick={() => handleReject(r.requesterId)}>거절</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="mypage-subtitle">보낸 요청</h3>
          {outgoing === null && <p className="stage-select-hint">불러오는 중...</p>}
          {outgoing && outgoing.length === 0 && <p className="inventory-empty">보낸 요청이 없어요.</p>}
          {outgoing && outgoing.length > 0 && (
            <div className="friends-list">
              {outgoing.map((r) => (
                <div key={r.targetId} className="friends-list-row">
                  <span className="friends-list-name">{r.nickname}</span>
                  <button className="btn btn-ghost" disabled={busyId === r.targetId} onClick={() => handleCancel(r.targetId)}>요청 취소</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
