import { useState } from 'react';
import { updateNickname, checkNicknameAvailable } from '../lib/auth';
import MonsterDex from './MonsterDex';

export default function MyPage({ session, profile, activeMonster, clearedCount, totalStages, onProfileUpdate, equipmentBonus, skillPossessionAtk, dragonBuffActive }) {
  const dragonBuffRemaining = dragonBuffActive && profile?.dragon_buff_until
    ? formatRemainingTime(new Date(profile.dragon_buff_until) - new Date())
    : null;
  const [nickname, setNickname] = useState('');
  const [checkState, setCheckState] = useState(null); // 'checking' | 'ok' | 'taken' | null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const alreadyEdited = profile?.nickname_edited;

  async function handleCheck() {
    if (nickname.length < 2) return;
    setCheckState('checking');
    try {
      const available = await checkNicknameAvailable(nickname);
      setCheckState(available ? 'ok' : 'taken');
    } catch {
      setCheckState(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (checkState !== 'ok') {
      setError('닉네임 중복 확인을 먼저 해주세요.');
      return;
    }
    setSaving(true);
    try {
      await updateNickname(nickname);
      setSuccess('닉네임이 변경되었습니다.');
      onProfileUpdate?.({ ...profile, nickname, nickname_edited: true });
      setNickname('');
      setCheckState(null);
    } catch (err) {
      setError(err.message ?? '변경에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  const joinedAt = session?.user?.created_at
    ? new Date(session.user.created_at).toLocaleDateString('ko-KR')
    : '-';

  return (
    <div className="mypage-screen">
      <h2>마이페이지</h2>

      <div className="mypage-card">
        <div className="mypage-row"><span>닉네임</span><strong>{profile?.nickname}</strong></div>
        <div className="mypage-row"><span>이메일</span><strong>{session?.user?.email}</strong></div>
        <div className="mypage-row"><span>가입일</span><strong>{joinedAt}</strong></div>
        <div className="mypage-row"><span>보유 골드</span><strong>💰 {(profile?.gold ?? 0).toLocaleString()}</strong></div>
        {activeMonster && (
          <div className="mypage-row">
            <span>대표 몬스터</span>
            <strong>{activeMonster.name}{activeMonster.jobTitle ? ` · ${activeMonster.jobTitle}` : ''} Lv.{activeMonster.level}</strong>
          </div>
        )}
        <div className="mypage-row"><span>클리어한 스테이지</span><strong>{clearedCount} / {totalStages}</strong></div>
      </div>

      <MonsterDex
        myElement={activeMonster?.element}
        myStage={activeMonster?.speciesId ? Number(activeMonster.speciesId.split('_')[1]) : 0}
      />

      {activeMonster && (
        <div className="stat-breakdown-card">
          <h3 className="mypage-subtitle" style={{ marginTop: 0 }}>⚔️ 능력치 상세</h3>
          <table className="stat-breakdown-table">
            <thead>
              <tr>
                <th></th>
                <th>ATK</th>
                <th>DEF</th>
                <th>HP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>기본(레벨·전직)</td>
                <td>{activeMonster.atk.toLocaleString()}</td>
                <td>{activeMonster.def.toLocaleString()}</td>
                <td>{activeMonster.maxHp.toLocaleString()}</td>
              </tr>
              <tr>
                <td>장비 보너스</td>
                <td>+{(equipmentBonus?.atk ?? 0).toLocaleString()}</td>
                <td>+{(equipmentBonus?.def ?? 0).toLocaleString()}</td>
                <td>+{(equipmentBonus?.hp ?? 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td>스킬 보유효과</td>
                <td>+{(skillPossessionAtk ?? 0).toLocaleString()}</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr className="stat-breakdown-total">
                <td>최종</td>
                <td>{(activeMonster.atk + (equipmentBonus?.atk ?? 0) + (skillPossessionAtk ?? 0)).toLocaleString()}</td>
                <td>{(activeMonster.def + (equipmentBonus?.def ?? 0)).toLocaleString()}</td>
                <td>{(activeMonster.maxHp + (equipmentBonus?.hp ?? 0)).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          {dragonBuffActive && (
            <p className="mypage-locked-hint" style={{ color: 'var(--accent-gold)' }}>
              🐉 용의 버프 적용 중{dragonBuffRemaining && ` (${dragonBuffRemaining} 남음)`} — 전투 시 위 최종 공격력·방어력이 20배로 적용돼요.
            </p>
          )}
        </div>
      )}

      <h3 className="mypage-subtitle">닉네임 변경</h3>
      {alreadyEdited ? (
        <p className="mypage-locked-hint">닉네임은 이미 한 번 수정하셨습니다. 더 이상 변경할 수 없어요.</p>
      ) : (
        <form className="mypage-nickname-form" onSubmit={handleSubmit}>
          <p className="mypage-warning">⚠️ 닉네임은 평생 딱 한 번만 수정할 수 있어요. 신중하게 정해주세요.</p>
          <div className="field">
            <label>새 닉네임 (한글/영문/숫자 2~12자)</label>
            <div className="nickname-input-row">
              <input
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setCheckState(null); }}
                maxLength={12}
                placeholder="새 닉네임 입력"
              />
              <button type="button" className="btn btn-neutral" onClick={handleCheck} disabled={nickname.length < 2}>
                중복확인
              </button>
            </div>
            {checkState === 'checking' && <span className="hint">확인 중...</span>}
            {checkState === 'ok' && <span className="hint ok">사용 가능한 닉네임이에요.</span>}
            {checkState === 'taken' && <span className="hint bad">이미 사용 중이에요.</span>}
          </div>

          {error && <p className="auth-error">{error}</p>}
          {success && <p className="hint ok">{success}</p>}

          <button type="submit" className="auth-submit" disabled={saving || checkState !== 'ok'}>
            {saving ? '변경 중...' : '닉네임 변경하기'}
          </button>
        </form>
      )}
    </div>
  );
}

/** 밀리초를 "N일 M시간" 형태로 변환 (하루 미만이면 "N시간") */
function formatRemainingTime(ms) {
  if (ms <= 0) return null;
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}일 ${hours}시간`;
  return `${hours}시간`;
}
