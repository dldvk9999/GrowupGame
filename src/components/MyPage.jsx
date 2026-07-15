import { useState } from 'react';
import { updateNickname, checkNicknameAvailable } from '../lib/auth';

export default function MyPage({ session, profile, activeMonster, clearedCount, totalStages, onProfileUpdate }) {
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
