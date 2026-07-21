import { useState } from 'react';
import { verifyCurrentPassword, changeEmail, changePassword } from '../lib/auth';
import { showToast } from '../lib/toast';

export default function AccountSecurityModal({ currentEmail, onClose }) {
  const [step, setStep] = useState('verify'); // 'verify' | 'manage'
  const [currentPassword, setCurrentPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  async function handleVerify(e) {
    e.preventDefault();
    setVerifyError('');
    setVerifying(true);
    try {
      await verifyCurrentPassword(currentEmail, currentPassword);
      setStep('manage');
    } catch (err) {
      setVerifyError(err.message ?? '확인에 실패했어요.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleChangeEmail(e) {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setSavingEmail(true);
    try {
      await changeEmail(newEmail.trim());
      setEmailSuccess('새 이메일로 확인 메일을 보냈어요. 메일함에서 링크를 눌러야 실제로 바뀌어요.');
      setNewEmail('');
    } catch (err) {
      setEmailError(err.message ?? '변경에 실패했어요.');
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword.length < 6) {
      setPasswordError('비밀번호는 6자 이상이어야 해요.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('새 비밀번호가 서로 달라요.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(newPassword);
      setPasswordSuccess('비밀번호가 변경됐어요.');
      showToast('비밀번호가 변경됐어요.', 'success');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      setPasswordError(err.message ?? '변경에 실패했어요.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel account-security-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔒 계정 관리</h3>
          <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        {step === 'verify' && (
          <form onSubmit={handleVerify} className="auth-form">
            <p className="stage-select-hint" style={{ marginTop: 0 }}>
              이메일이나 비밀번호를 변경하려면 먼저 현재 비밀번호를 확인해주세요.
            </p>
            <div className="field">
              <label>현재 비밀번호</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            {verifyError && <p className="auth-error">{verifyError}</p>}
            <button type="submit" className="auth-submit" disabled={verifying}>
              {verifying ? '확인 중...' : '확인'}
            </button>
          </form>
        )}

        {step === 'manage' && (
          <>
            <h4 className="mypage-subtitle" style={{ marginTop: 0 }}>이메일 변경</h4>
            <form onSubmit={handleChangeEmail} className="auth-form">
              <div className="field">
                <label>새 이메일 (현재: {currentEmail})</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              </div>
              {emailError && <p className="auth-error">{emailError}</p>}
              {emailSuccess && <p className="hint ok">{emailSuccess}</p>}
              <button type="submit" className="btn btn-challenge" disabled={savingEmail} style={{ width: '100%' }}>
                {savingEmail ? '변경 중...' : '이메일 변경하기'}
              </button>
            </form>

            <h4 className="mypage-subtitle">비밀번호 변경</h4>
            <form onSubmit={handleChangePassword} className="auth-form">
              <div className="field">
                <label>새 비밀번호 (6자 이상)</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
              </div>
              <div className="field">
                <label>새 비밀번호 확인</label>
                <input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} minLength={6} required />
              </div>
              {passwordError && <p className="auth-error">{passwordError}</p>}
              {passwordSuccess && <p className="hint ok">{passwordSuccess}</p>}
              <button type="submit" className="btn btn-challenge" disabled={savingPassword} style={{ width: '100%' }}>
                {savingPassword ? '변경 중...' : '비밀번호 변경하기'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
