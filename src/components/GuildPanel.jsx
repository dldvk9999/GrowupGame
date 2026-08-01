import { useState, useEffect, useCallback } from 'react';
import {
  createGuild, joinGuild, leaveGuild, transferGuildLeadership, setGuildAnnouncement,
  fetchMyGuild, fetchGuildList, fetchGuildMembers, fetchGuildLeaderboard,
} from '../lib/guild';
import { showToast } from '../lib/toast';
import InfoTooltip from './InfoTooltip';
import GuildLobby from './GuildLobby';

export default function GuildPanel({ userId, onGoToGuildRaid }) {
  const [myGuild, setMyGuild] = useState(undefined); // undefined=로딩중, null=미가입
  const [members, setMembers] = useState(null);
  const [subTab, setSubTab] = useState('list'); // 'list' | 'ranking' | 'create'
  const [guildList, setGuildList] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [announcementDraft, setAnnouncementDraft] = useState('');

  const loadMyGuild = useCallback(() => {
    fetchMyGuild().then((g) => {
      setMyGuild(g);
      setAnnouncementDraft(g?.announcement ?? '');
      if (g) fetchGuildMembers(g.guildId).then(setMembers).catch(() => setMembers([]));
    }).catch(() => setMyGuild(null));
  }, []);

  useEffect(() => { loadMyGuild(); }, [userId, loadMyGuild]);

  useEffect(() => {
    if (myGuild === undefined || myGuild) return; // 이미 가입 중이면 목록 안 불러옴
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

  if (myGuild === undefined) {
    return <p className="stage-select-hint">불러오는 중...</p>;
  }

  // ---- 가입한 길드가 있으면: 내 길드 정보 화면 ----
  if (myGuild) {
    if (showLobby) {
      return <GuildLobby guild={myGuild} onBack={() => setShowLobby(false)} />;
    }
    return (
      <div>
        <button
          type="button"
          className="worldboss-hp-card"
          style={{ border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          onClick={() => setShowLobby(true)}
        >
          <div className="worldboss-hp-title">🛡️ [{myGuild.tag}] {myGuild.name}</div>
          <p className="mypage-locked-hint" style={{ margin: '4px 0 0' }}>길드원 {myGuild.memberCount} / 30 · 🏰 눌러서 로비 보기</p>
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

  // ---- 미가입 상태: 목록/랭킹/창설 ----
  return (
    <div>
      <p className="stage-select-hint">
        <InfoTooltip text="같은 뜻을 가진 유저들과 함께하는 그룹이에요. 길드원끼리 서로의 레벨을 확인할 수 있고, 길드 전체 랭킹에도 참여해요. 최대 30명까지 가입할 수 있어요." />
        {' '}길드 안내
      </p>
      <div className="shop-tabs">
        <button className={`shop-tab ${subTab === 'list' ? 'active' : ''}`} onClick={() => setSubTab('list')}>📋 길드 목록</button>
        <button className={`shop-tab ${subTab === 'ranking' ? 'active' : ''}`} onClick={() => setSubTab('ranking')}>🏆 길드 랭킹</button>
        <button className={`shop-tab ${subTab === 'create' ? 'active' : ''}`} onClick={() => setSubTab('create')}>➕ 길드 창설</button>
      </div>

      {subTab === 'list' && (
        <>
          {guildList === null && <p className="stage-select-hint">불러오는 중...</p>}
          {guildList?.length === 0 && <p className="inventory-empty">아직 만들어진 길드가 없어요. 첫 길드를 창설해보세요!</p>}
          {guildList?.map((g) => (
            <div key={g.guildId} className="friend-row">
              <span className="friend-row-name">[{g.tag}] {g.name} <span className="mypage-locked-hint">{g.memberCount}/30명</span></span>
              <button type="button" className="btn btn-neutral" disabled={busy || g.memberCount >= 30} onClick={() => handleJoin(g.guildId, g.name)}>
                {g.memberCount >= 30 ? '정원 마감' : '가입'}
              </button>
            </div>
          ))}
        </>
      )}

      {subTab === 'ranking' && (
        <>
          {leaderboard === null && <p className="stage-select-hint">불러오는 중...</p>}
          {leaderboard?.map((g, i) => (
            <div key={g.guildId} className="friend-row">
              <span className="friend-row-name">#{i + 1} [{g.tag}] {g.name} <span className="mypage-locked-hint">{g.memberCount}명</span></span>
              <span className="mypage-locked-hint">레벨합 {g.totalLevel.toLocaleString()}</span>
            </div>
          ))}
        </>
      )}

      {subTab === 'create' && (
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
