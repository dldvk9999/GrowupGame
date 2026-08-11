import { useState, useEffect, useCallback } from 'react';
import {
  createGuild, joinGuild, leaveGuild, transferGuildLeadership, setGuildAnnouncement,
  fetchMyGuild, fetchGuildList, fetchGuildMembers, fetchGuildLeaderboard,
} from '../lib/guild';
import { showToast } from '../lib/toast';
import { donateToGuildBank, withdrawFromGuildBank, fetchGuildBankLog } from '../lib/guildBank';
import InfoTooltip from './InfoTooltip';
import GuildLobby from './GuildLobby';

export default function GuildPanel({ userId, profile, loginAt, onGoToGuildRaid, onGoldChange }) {
  const [myGuild, setMyGuild] = useState(undefined); // undefined=로딩중, null=미가입
  const [members, setMembers] = useState(null);
  const [subTab, setSubTab] = useState('list'); // 'list' | 'ranking' | 'create'
  const [guildList, setGuildList] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [viewingMyGuild, setViewingMyGuild] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [donateAmount, setDonateAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawTarget, setWithdrawTarget] = useState('');
  const [bankLog, setBankLog] = useState(null);

  const loadMyGuild = useCallback(() => {
    fetchMyGuild().then((g) => {
      setMyGuild(g);
      setAnnouncementDraft(g?.announcement ?? '');
      if (g) fetchGuildMembers(g.guildId).then(setMembers).catch(() => setMembers([]));
    }).catch((err) => {
      // (진단용, 사용자 제보 - "길드 정보가 안 보임") 예전엔 에러를 조용히 삼키고
      // 무조건 미가입(null) 취급해서, 서버 쪽에 문제가 있어도 화면에서 전혀 티가
      // 안 났음. 콘솔+토스트로 실제 에러를 드러내서 원인 파악이 가능하게 함.
      console.error('길드 정보 조회 실패', err);
      showToast(err.message ?? '길드 정보를 불러오지 못했어요.', 'error');
      setMyGuild(null);
    });
  }, []);

  useEffect(() => { loadMyGuild(); }, [userId, loadMyGuild]);

  useEffect(() => {
    if (myGuild === undefined) return; // 아직 내 길드 정보 로딩 중이면 대기
    // (버그 수정, 사용자 제보) 길드 목록/랭킹 재설계 당시, 예전 설계("가입 중이면 목록
    // 자체를 안 봄")의 가드(`|| myGuild`)를 지우는 걸 빠뜨렸었음 - 그래서 가입한 유저는
    // 길드 탭에 들어와도 guildList가 영원히 null로 남아 "불러오는 중..."에서 멈춰있었음.
    // 이제 가입 여부와 무관하게 항상 불러옴(가입 중에도 다른 길드 목록을 볼 수 있어야 함).
    if (subTab === 'list' && guildList === null) {
      fetchGuildList().then(setGuildList).catch(() => setGuildList([]));
    }
  }, [subTab, myGuild, guildList]);

  useEffect(() => {
    if (subTab === 'ranking' && leaderboard === null) {
      fetchGuildLeaderboard().then(setLeaderboard).catch(() => setLeaderboard([]));
    }
  }, [subTab, leaderboard]);

  async function handleCreate() {
    setBusy(true);
    try {
      await createGuild(newName.trim(), newTag.trim());
      showToast(`🛡️ 길드 "${newName}"을(를) 창설했어요!`, 'success');
      setNewName(''); setNewTag('');
      loadMyGuild();
    } catch (err) {
      showToast(err.message ?? '길드 창설에 실패했어요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(guildId, name) {
    setBusy(true);
    try {
      await joinGuild(guildId);
      showToast(`🛡️ 길드 "${name}"에 가입했어요!`, 'success');
      loadMyGuild();
    } catch (err) {
      showToast(err.message ?? '가입에 실패했어요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    try {
      await leaveGuild();
      showToast('길드에서 탈퇴했어요.', 'info');
      setMyGuild(null);
      setGuildList(null);
    } catch (err) {
      showToast(err.message ?? '탈퇴에 실패했어요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer(targetId, nickname) {
    if (!window.confirm(`${nickname}님에게 길드장을 위임할까요?`)) return;
    setBusy(true);
    try {
      await transferGuildLeadership(targetId);
      showToast(`👑 ${nickname}님에게 길드장을 위임했어요.`, 'success');
      loadMyGuild();
    } catch (err) {
      showToast(err.message ?? '위임에 실패했어요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAnnouncement() {
    setBusy(true);
    try {
      await setGuildAnnouncement(announcementDraft);
      showToast('공지사항을 저장했어요.', 'success');
      loadMyGuild();
    } catch (err) {
      showToast(err.message ?? '저장에 실패했어요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function refreshBankLog() {
    fetchGuildBankLog().then(setBankLog).catch(() => setBankLog([]));
  }

  async function handleDonate() {
    const amount = Math.floor(Number(donateAmount));
    if (!amount || amount <= 0) return;
    setBusy(true);
    try {
      const { newGold } = await donateToGuildBank(amount);
      onGoldChange?.(newGold);
      showToast(`🏦 길드 창고에 ${amount.toLocaleString()}골드를 기부했어요!`, 'success');
      setDonateAmount('');
      loadMyGuild();
      refreshBankLog();
    } catch (err) {
      showToast(err.message ?? '기부에 실패했어요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    const amount = Math.floor(Number(withdrawAmount));
    if (!amount || amount <= 0 || !withdrawTarget) return;
    setBusy(true);
    try {
      await withdrawFromGuildBank(amount, withdrawTarget);
      showToast('🏦 길드원에게 골드를 지급했어요! (우편함으로 전달됨)', 'success');
      setWithdrawAmount('');
      loadMyGuild();
      refreshBankLog();
    } catch (err) {
      showToast(err.message ?? '지급에 실패했어요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (myGuild && viewingMyGuild) refreshBankLog();
  }, [myGuild?.guildId, viewingMyGuild]); // eslint-disable-line react-hooks/exhaustive-deps

  if (myGuild === undefined) {
    return <p className="stage-select-hint">불러오는 중...</p>;
  }

  // ---- 가입한 길드가 있고, "내 길드 보기"를 눌렀으면: 내 길드 정보 화면 ----
  if (myGuild && viewingMyGuild) {
    if (showLobby) {
      return <GuildLobby guild={myGuild} profile={profile} loginAt={loginAt} onBack={() => setShowLobby(false)} />;
    }
    return (
      <div>
        <button type="button" className="btn btn-ghost" onClick={() => setViewingMyGuild(false)} style={{ marginBottom: 10 }}>
          ← 길드 목록으로
        </button>
        <button
          type="button"
          className="worldboss-hp-card"
          style={{ border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          onClick={() => setShowLobby(true)}
        >
          <div className="worldboss-hp-title">🛡️ [{myGuild.tag}] {myGuild.name} <span className="app-title-badge">Lv.{myGuild.level}</span></div>
          <p className="mypage-locked-hint" style={{ margin: '4px 0 0' }}>길드원 {myGuild.memberCount} / 30 · 🏰 눌러서 로비 보기</p>
          {myGuild.level < 20 ? (
            <div className="bar-track" style={{ marginTop: 8 }}>
              <div className="bar-fill" style={{ width: `${Math.min(100, (myGuild.exp / Math.max(1, myGuild.expToNext)) * 100)}%`, background: 'linear-gradient(90deg, var(--accent-fire), var(--accent-gold))' }} />
            </div>
          ) : (
            <p className="mypage-locked-hint" style={{ margin: '8px 0 0', color: 'var(--accent-gold)' }}>✨ 길드 최고 레벨 달성!</p>
          )}
        </button>

        {onGoToGuildRaid && (
          <button className="btn btn-challenge" style={{ marginTop: 10 }} onClick={onGoToGuildRaid}>
            ⚔️ 길드 레이드 도전하러 가기
          </button>
        )}

        {myGuild.isLeader ? (
          <div style={{ marginTop: 10 }}>
            <label className="mypage-subtitle" style={{ marginTop: 0 }}>📢 공지사항 (길드장만 수정 가능)</label>
            <textarea
              className="petname-input"
              style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
              value={announcementDraft}
              maxLength={200}
              onChange={(e) => setAnnouncementDraft(e.target.value)}
            />
            <button type="button" className="btn btn-neutral" disabled={busy} onClick={handleSaveAnnouncement} style={{ marginTop: 6 }}>
              공지 저장
            </button>
          </div>
        ) : myGuild.announcement ? (
          <div className="worldboss-hp-card" style={{ marginTop: 10 }}>
            <div className="worldboss-hp-title">📢 공지사항</div>
            <p className="mypage-locked-hint" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{myGuild.announcement}</p>
          </div>
        ) : null}

        <div className="worldboss-hp-card" style={{ marginTop: 10 }}>
          <div className="worldboss-hp-title">
            🏦 길드 창고 <InfoTooltip text="길드원 누구나 골드를 기부할 수 있고, 인출은 길드장만 할 수 있어요(다른 길드원에게 우편으로 지급). 창고 골드는 새로 만들어지는 게 아니라 기부한 만큼만 오가는 거라 안전해요." />
          </div>
          <p className="mypage-locked-hint" style={{ margin: '4px 0 10px', fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)' }}>
            💰 {(myGuild.bankGold ?? 0).toLocaleString()} 골드
          </p>

          <div style={{ display: 'flex', gap: 6, marginBottom: myGuild.isLeader ? 10 : 0 }}>
            <input
              type="number"
              min="1"
              className="petname-input"
              placeholder="기부할 골드"
              value={donateAmount}
              onChange={(e) => setDonateAmount(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-neutral" disabled={busy || !donateAmount} onClick={handleDonate}>기부</button>
          </div>

          {myGuild.isLeader && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <select className="petname-input" value={withdrawTarget} onChange={(e) => setWithdrawTarget(e.target.value)} style={{ flex: '1 1 140px' }}>
                <option value="">받을 길드원 선택</option>
                {members?.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.nickname}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                className="petname-input"
                placeholder="지급할 골드"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                style={{ width: 100 }}
              />
              <button type="button" className="btn btn-challenge" disabled={busy || !withdrawAmount || !withdrawTarget} onClick={handleWithdraw}>지급</button>
            </div>
          )}

          {bankLog && bankLog.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {bankLog.map((log) => (
                <p key={log.id} className="mypage-locked-hint" style={{ margin: '2px 0' }}>
                  {log.amount > 0
                    ? `➕ ${log.nickname}님이 ${log.amount.toLocaleString()}골드 기부`
                    : `➖ ${log.nickname}님이 ${log.targetNickname}님에게 ${Math.abs(log.amount).toLocaleString()}골드 지급`}
                </p>
              ))}
            </div>
          )}
        </div>

        <h3 className="mypage-subtitle">길드원 목록</h3>
        {members === null && <p className="stage-select-hint">불러오는 중...</p>}
        {members?.map((m) => (
          <div key={m.userId} className="friend-row">
            <span className="friend-row-name">
              {m.userId === myGuild.leaderId && '👑 '}{m.nickname} <span className="mypage-locked-hint">Lv.{m.level}</span>
            </span>
            {myGuild.isLeader && m.userId !== userId && (
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => handleTransfer(m.userId, m.nickname)}>
                길드장 위임
              </button>
            )}
          </div>
        ))}

        <button type="button" className="btn btn-ghost" disabled={busy} onClick={handleLeave} style={{ marginTop: 14 }}>
          {myGuild.isLeader ? '길드 삭제(마지막 인원일 때만)' : '길드 탈퇴'}
        </button>
      </div>
    );
  }

  // ---- 길드 목록/랭킹/창설 화면 (가입 전이거나, 가입 후 "길드 목록으로"를 누른 상태) ----
  return (
    <div>
      <p className="stage-select-hint">
        <InfoTooltip text="같은 뜻을 가진 유저들과 함께하는 그룹이에요. 길드원끼리 서로의 레벨을 확인할 수 있고, 길드 전체 랭킹에도 참여해요. 최대 30명까지 가입할 수 있어요." />
        {' '}길드 안내
      </p>

      {myGuild && (
        <button
          type="button"
          className="worldboss-hp-card"
          style={{ border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 14 }}
          onClick={() => setViewingMyGuild(true)}
        >
          <div className="worldboss-hp-title">🛡️ 내가 가입한 길드 <span className="app-title-badge">Lv.{myGuild.level}</span></div>
          <p className="mypage-locked-hint" style={{ margin: '4px 0 0' }}>[{myGuild.tag}] {myGuild.name} · 길드원 {myGuild.memberCount} / 30 · 눌러서 자세히 보기 →</p>
        </button>
      )}

      <div className="shop-tabs">
        <button className={`shop-tab ${subTab === 'list' ? 'active' : ''}`} onClick={() => setSubTab('list')}>📋 길드 목록</button>
        <button className={`shop-tab ${subTab === 'ranking' ? 'active' : ''}`} onClick={() => setSubTab('ranking')}>🏆 길드 랭킹</button>
        {!myGuild && (
          <button className={`shop-tab ${subTab === 'create' ? 'active' : ''}`} onClick={() => setSubTab('create')}>➕ 길드 창설</button>
        )}
      </div>

      {subTab === 'list' && (
        <>
          {guildList === null && <p className="stage-select-hint">불러오는 중...</p>}
          {guildList?.length === 0 && <p className="inventory-empty">아직 만들어진 길드가 없어요. 첫 길드를 창설해보세요!</p>}
          {guildList?.map((g) => {
            const isMine = myGuild?.guildId === g.guildId;
            return (
              <div key={g.guildId} className="friend-row">
                <span className="friend-row-name">[{g.tag}] {g.name} <span className="mypage-locked-hint">{g.memberCount}/30명</span></span>
                {isMine ? (
                  <button type="button" className="btn btn-neutral" onClick={() => setViewingMyGuild(true)}>내 길드</button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-neutral"
                    disabled={busy || !!myGuild || g.memberCount >= 30}
                    onClick={() => handleJoin(g.guildId, g.name)}
                  >
                    {myGuild ? '가입중' : g.memberCount >= 30 ? '정원 마감' : '가입'}
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}

      {subTab === 'ranking' && (
        <>
          <p className="stage-select-hint">
            <InfoTooltip text="매주 상위 10개 길드의 모든 길드원에게 골드 보상이 우편으로 지급돼요! 1위 30,000 · 2~3위 20,000 · 4~5위 12,000 · 6~10위 6,000골드. 우편함을 한 번 열면 그 시점에 지급돼요." />
            {' '}🏆 상위 10개 길드는 매주 전원 보상을 받아요
          </p>
          {leaderboard === null && <p className="stage-select-hint">불러오는 중...</p>}
          {leaderboard?.map((g, i) => (
            <div key={g.guildId} className="friend-row">
              <span className="friend-row-name">{i < 10 && '🏆'} #{i + 1} [{g.tag}] {g.name} <span className="mypage-locked-hint">{g.memberCount}명</span></span>
              <span className="mypage-locked-hint">레벨합 {g.totalLevel.toLocaleString()}</span>
            </div>
          ))}
        </>
      )}

      {subTab === 'create' && !myGuild && (
        <div>
          <div className="field">
            <label>길드명 (2~12자)</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={12} />
          </div>
          <div className="field">
            <label>길드 태그 (2~4자, 닉네임 옆에 표시돼요)</label>
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} maxLength={4} />
          </div>
          <button
            type="button"
            className="btn btn-challenge"
            disabled={busy || newName.trim().length < 2 || newTag.trim().length < 2}
            onClick={handleCreate}
            style={{ width: '100%' }}
          >
            🛡️ 길드 창설하기
          </button>
        </div>
      )}
    </div>
  );
}
