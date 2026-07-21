import { useState, useEffect } from 'react';
import { signIn, signUp, checkNicknameAvailable, fetchTotalUserCount, fetchTotalAchievementClaims, findMaskedEmailByNickname, sendPasswordResetEmail } from '../lib/auth';

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'find-email' | 'reset-password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState(null); // 'checking'|'ok'|'taken'|null
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalUsers, setTotalUsers] = useState(null);
  const [totalAchievements, setTotalAchievements] = useState(null);
  const [findEmailNickname, setFindEmailNickname] = useState('');
  const [foundMaskedEmail, setFoundMaskedEmail] = useState(undefined); // undefined=아직 안 찾음, null=못 찾음, string=결과
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    fetchTotalUserCount().then(setTotalUsers).catch(() => setTotalUsers(null));
    fetchTotalAchievementClaims().then(setTotalAchievements).catch(() => setTotalAchievements(null));
  }, []);

  async function handleNicknameBlur() {
    if (!nickname || mode !== 'signup') return;
    setNicknameStatus('checking');
    try {
      const available = await checkNicknameAvailable(nickname);
      setNicknameStatus(available ? 'ok' : 'taken');
    } catch {
      setNicknameStatus(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (nicknameStatus !== 'ok') {
          const available = await checkNicknameAvailable(nickname);
          if (!available) throw new Error('이미 사용 중인 닉네임이에요.');
        }
        await signUp({ email, password, nickname });
      } else {
        await signIn({ email, password, rememberMe });
      }
      onAuthed();
    } catch (err) {
      setError(err.message ?? '요청 중 문제가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleFindEmail(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const masked = await findMaskedEmailByNickname(findEmailNickname.trim());
      setFoundMaskedEmail(masked); // null이면 "못 찾음"으로 표시
    } catch (err) {
      setError(err.message ?? '조회 중 문제가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(resetEmail.trim());
      setResetSent(true);
    } catch (err) {
      setError(err.message ?? '요청 중 문제가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }

  function backToSignin() {
    setMode('signin');
    setError('');
    setFoundMaskedEmail(undefined);
    setFindEmailNickname('');
    setResetSent(false);
    setResetEmail('');
  }

  if (mode === 'find-email') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">이메일 찾기</h1>
          <p className="auth-subtitle">가입할 때 쓴 닉네임을 입력하면 이메일을 일부 가려서 보여드려요</p>
          <form onSubmit={handleFindEmail} className="auth-form">
            <div className="field">
              <label>닉네임</label>
              <input value={findEmailNickname} onChange={(e) => setFindEmailNickname(e.target.value)} required />
            </div>
            {error && <p className="auth-error">{error}</p>}
            {foundMaskedEmail === null && <p className="hint bad">일치하는 계정을 찾을 수 없어요.</p>}
            {typeof foundMaskedEmail === 'string' && (
              <p className="hint ok">가입하신 이메일: <strong>{foundMaskedEmail}</strong></p>
            )}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? '찾는 중...' : '이메일 찾기'}
            </button>
            <button type="button" className="auth-back-link" onClick={backToSignin}>← 로그인으로 돌아가기</button>
          </form>
        </div>
      </div>
    );
  }

  if (mode === 'reset-password') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1 className="auth-title">비밀번호 초기화</h1>
          <p className="auth-subtitle">가입한 이메일로 재설정 링크를 보내드려요</p>
          {resetSent ? (
            <p className="hint ok">📧 재설정 링크를 보냈어요. 메일함(스팸함도)을 확인해주세요.</p>
          ) : (
            <form onSubmit={handleResetPassword} className="auth-form">
              <div className="field">
                <label>이메일</label>
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? '보내는 중...' : '재설정 링크 보내기'}
              </button>
            </form>
          )}
          <button type="button" className="auth-back-link" onClick={backToSignin}>← 로그인으로 돌아가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">GrowupGame</h1>
        <p className="auth-subtitle">키우기 게임에 오신 걸 환영해요</p>
        {totalUsers !== null && totalUsers > 0 && (
          <p className="auth-user-count">👥 {totalUsers.toLocaleString()}명의 조련사가 함께하고 있어요</p>
        )}
        {totalAchievements !== null && totalAchievements > 0 && (
          <p className="auth-user-count">🏆 지금까지 {totalAchievements.toLocaleString()}개의 업적이 달성됐어요</p>
        )}

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => setMode('signin')}
          >
            로그인
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="field">
              <label>닉네임</label>
              <input
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setNicknameStatus(null);
                }}
                onBlur={handleNicknameBlur}
                placeholder="2~12자, 한글/영문/숫자"
                required
              />
              {nicknameStatus === 'checking' && <span className="hint">확인 중...</span>}
              {nicknameStatus === 'ok' && <span className="hint ok">사용 가능한 닉네임이에요</span>}
              {nicknameStatus === 'taken' && <span className="hint bad">이미 사용 중이에요</span>}
            </div>
          )}

          <div className="field">
            <label>이메일</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="field">
            <label>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {mode === 'signin' && (
            <label className="auth-checkbox-row">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>자동 로그인 (다음에 접속할 때 자동으로 로그인돼요)</span>
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '처리 중...' : mode === 'signup' ? '가입하고 시작하기' : '로그인'}
          </button>

          {mode === 'signin' && (
            <div className="auth-helper-links">
              <button type="button" className="auth-back-link" onClick={() => { setMode('find-email'); setError(''); }}>이메일 찾기</button>
              <span className="auth-helper-divider">·</span>
              <button type="button" className="auth-back-link" onClick={() => { setMode('reset-password'); setError(''); }}>비밀번호 찾기</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
