import { useState, useEffect } from 'react';
import { updateNickname, checkNicknameAvailable, setReferrer, fetchMyReferralCount } from '../lib/auth';
import { setMonsterNickname } from '../lib/monsters';
import { fetchClaimedAchievements, ACHIEVEMENT_CATALOG } from '../lib/achievements';
import { getPvpTier } from '../lib/pvpTier';
import { getNextGoals } from '../lib/nextGoals';
import { speciesById } from '../lib/speciesData';
import { scaleStats } from '../lib/growth';
import { showToast } from '../lib/toast';
import { playClickSound } from '../lib/audio';
import MonsterDex from './MonsterDex';

export default function MyPage({ session, profile, activeMonster, clearedCount, totalStages, onProfileUpdate, equipmentBonus, skillPossessionAtk, dragonBuffActive, towerHighestFloor, attendanceState, onMonsterNicknameChange }) {
  const [referrerInput, setReferrerInput] = useState('');
  const [referrerSaving, setReferrerSaving] = useState(false);
  const [referrerError, setReferrerError] = useState('');
  const [referrerDone, setReferrerDone] = useState(false);
  const [myReferralCount, setMyReferralCount] = useState(null);
  const [myAchievementCount, setMyAchievementCount] = useState(null);
  const [nicknameCopied, setNicknameCopied] = useState(false);

  async function handleCopyNickname() {
    try {
      await navigator.clipboard.writeText(profile?.nickname ?? '');
      setNicknameCopied(true);
      playClickSound();
      setTimeout(() => setNicknameCopied(false), 2000);
    } catch {
      showToast('복사에 실패했어요. 닉네임을 직접 알려주세요: ' + (profile?.nickname ?? ''), 'error');
    }
  }

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchMyReferralCount(session.user.id).then(setMyReferralCount).catch(() => setMyReferralCount(null));
    fetchClaimedAchievements(session.user.id).then((set) => setMyAchievementCount(set.size)).catch(() => setMyAchievementCount(null));
  }, [session?.user?.id]);

  // 가입 후 24시간이 지났으면 클라이언트에서도 미리 폼을 숨김(서버가 최종 검증은 항상 다시 함)
  const signupHoursAgo = profile?.created_at ? (Date.now() - new Date(profile.created_at)) / (1000 * 60 * 60) : 999;
  const canSetReferrer = !profile?.referred_by && signupHoursAgo < 24 && !referrerDone;

  async function handleSetReferrer() {
    if (!referrerInput.trim()) return;
    setReferrerError('');
    setReferrerSaving(true);
    try {
      await setReferrer(referrerInput.trim());
      setReferrerDone(true);
    } catch (err) {
      setReferrerError(err.message ?? '추천인 등록에 실패했어요.');
    } finally {
      setReferrerSaving(false);
    }
  }
  const dragonBuffRemaining = dragonBuffActive && profile?.dragon_buff_until
    ? formatRemainingTime(new Date(profile.dragon_buff_until) - new Date())
    : null;
  const [nickname, setNickname] = useState('');
  const [checkState, setCheckState] = useState(null); // 'checking' | 'ok' | 'taken' | null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingPetName, setEditingPetName] = useState(false);
  const [petNameInput, setPetNameInput] = useState('');
  const [petNameSaving, setPetNameSaving] = useState(false);
  const [petNameError, setPetNameError] = useState('');

  async function handleSavePetName() {
    setPetNameError('');
    setPetNameSaving(true);
    try {
      await setMonsterNickname(petNameInput.trim());
      onMonsterNicknameChange?.(petNameInput.trim() || null);
      setEditingPetName(false);
    } catch (err) {
      setPetNameError(err.message ?? '애칭 설정에 실패했어요.');
    } finally {
      setPetNameSaving(false);
    }
  }
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

      {activeMonster && (
        <div className="character-card">
          <div className="character-card-title">
            {profile?.equipped_title && <span className="app-title-badge">[{profile.equipped_title}]</span>}
            {profile?.nickname}
            <button type="button" className="nickname-copy-btn" onClick={handleCopyNickname} title="닉네임 복사(친구에게 추천인으로 공유해보세요)">
              {nicknameCopied ? '✅' : '📋'}
            </button>
          </div>
          <div className="character-card-sub">
            {activeMonster.name}{activeMonster.jobTitle ? ` · ${activeMonster.jobTitle}` : ''} Lv.{activeMonster.level}
          </div>
          <div className="character-card-stats">
            <div className="character-card-stat">
              <span className="character-card-stat-label">PvP 티어</span>
              <span className="character-card-stat-value">{getPvpTier(profile?.pvp_wins).icon} {getPvpTier(profile?.pvp_wins).label}</span>
            </div>
            <div className="character-card-stat">
              <span className="character-card-stat-label">무한의 탑</span>
              <span className="character-card-stat-value">🗼 {towerHighestFloor ?? 0}층</span>
            </div>
            <div className="character-card-stat">
              <span className="character-card-stat-label">업적</span>
              <span className="character-card-stat-value">🏆 {myAchievementCount ?? '-'}/{ACHIEVEMENT_CATALOG.length}</span>
            </div>
            <div className="character-card-stat">
              <span className="character-card-stat-label">스테이지</span>
              <span className="character-card-stat-value">🗺️ {clearedCount}/{totalStages}</span>
            </div>
          </div>
          <div className="character-card-next-goals">
            <span className="character-card-next-goals-title">🎯 다음 목표</span>
            {getNextGoals({
              pvpWins: profile?.pvp_wins,
              towerHighestFloor,
              attendanceTotal: attendanceState?.total_claim_count,
            }).map((goal) => (
              <span key={goal.label} className="character-card-next-goal-chip">
                {goal.icon} {goal.label} {goal.remaining}{goal.unit} 남음
              </span>
            ))}
          </div>
        </div>
      )}

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
        {activeMonster && (
          <div className="mypage-row mypage-row--petname">
            <span>애칭</span>
            {editingPetName ? (
              <span className="petname-edit-row">
                <input
                  value={petNameInput}
                  onChange={(e) => setPetNameInput(e.target.value)}
                  maxLength={12}
                  placeholder={activeMonster.speciesName}
                />
                <button className="btn btn-neutral" disabled={petNameSaving} onClick={handleSavePetName}>
                  {petNameSaving ? '저장 중...' : '저장'}
                </button>
                <button className="btn btn-ghost" onClick={() => setEditingPetName(false)}>취소</button>
              </span>
            ) : (
              <span className="petname-edit-row">
                <strong>{activeMonster.nickname ?? `(없음 · ${activeMonster.speciesName})`}</strong>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setPetNameInput(activeMonster.nickname ?? ''); setEditingPetName(true); setPetNameError(''); }}
                >
                  {activeMonster.nickname ? '수정' : '애칭 짓기'}
                </button>
              </span>
            )}
          </div>
        )}
        {petNameError && <p className="auth-error">{petNameError}</p>}
        <div className="mypage-row"><span>클리어한 스테이지</span><strong>{clearedCount} / {totalStages}</strong></div>
        {myReferralCount !== null && myReferralCount > 0 && (
          <div className="mypage-row"><span>내가 추천한 친구</span><strong>🤝 {myReferralCount}명</strong></div>
        )}
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

      {activeMonster && speciesById[activeMonster.speciesId] && (
        <div className="stat-breakdown-card">
          <h3 className="mypage-subtitle" style={{ marginTop: 0 }}>📈 성장 곡선 미리보기</h3>
          <p className="mypage-locked-hint" style={{ marginTop: 0 }}>
            지금 전직 단계({activeMonster.unlockedJobTier ?? 0}차) 기준으로, 레벨만 올랐을 때의 예상 기본 스탯이에요. (장비/스킬 보너스는 미포함, 진화·추가 전직 시 더 커질 수 있어요)
          </p>
          <table className="stat-breakdown-table">
            <thead>
              <tr><th>레벨</th><th>ATK</th><th>DEF</th><th>HP</th></tr>
            </thead>
            <tbody>
              {[activeMonster.level, activeMonster.level + 10, activeMonster.level + 30, activeMonster.level + 50]
                .filter((lv, i, arr) => arr.indexOf(lv) === i && lv <= 200)
                .map((lv) => {
                  const projected = scaleStats(speciesById[activeMonster.speciesId], lv, activeMonster.unlockedJobTier ?? 0);
                  return (
                    <tr key={lv} className={lv === activeMonster.level ? 'stat-breakdown-total' : ''}>
                      <td>Lv.{lv}{lv === activeMonster.level ? ' (현재)' : ''}</td>
                      <td>{projected.atk.toLocaleString()}</td>
                      <td>{projected.def.toLocaleString()}</td>
                      <td>{projected.maxHp.toLocaleString()}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {canSetReferrer && (
        <div className="referral-card">
          <h3 className="mypage-subtitle" style={{ marginTop: 0 }}>🤝 친구 추천인 등록</h3>
          <p className="stage-select-hint">
            나를 이 게임으로 이끈 친구의 닉네임을 입력하면, 내가 레벨 10을 달성했을 때 그 친구에게 보너스가 가요.
            가입 후 24시간 이내에만 등록할 수 있어요.
          </p>
          <div className="petname-edit-row">
            <input
              value={referrerInput}
              onChange={(e) => setReferrerInput(e.target.value)}
              placeholder="추천인 닉네임"
              maxLength={12}
            />
            <button className="btn btn-neutral" disabled={referrerSaving || !referrerInput.trim()} onClick={handleSetReferrer}>
              {referrerSaving ? '등록 중...' : '등록'}
            </button>
          </div>
          {referrerError && <p className="auth-error">{referrerError}</p>}
        </div>
      )}
      {(profile?.referred_by || referrerDone) && (
        <p className="stage-select-hint">🤝 추천인이 등록되어 있어요. 레벨 10을 달성하면 추천인에게 보너스가 전달돼요.</p>
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
