import { useState, useEffect } from 'react';
import { signIn, signUp, checkNicknameAvailable, fetchTotalUserCount } from '../lib/auth';

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState(null); // 'checking'|'ok'|'taken'|null
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalUsers, setTotalUsers] = useState(null);

  useEffect(() => {
    fetchTotalUserCount().then(setTotalUsers).catch(() => setTotalUsers(null));
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

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">GrowupGame</h1>
        <p className="auth-subtitle">키우기 게임에 오신 걸 환영해요</p>
        {totalUsers !== null && totalUsers > 0 && (
          <p className="auth-user-count">👥 {totalUsers.toLocaleString()}명의 조련사가 함께하고 있어요</p>
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
        </form>
      </div>
    </div>
  );
}
