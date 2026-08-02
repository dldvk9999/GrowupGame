import { showToast } from '../../lib/toast';
import InfoTooltip from '../InfoTooltip';
import { getTodayBannedSkillTypes, isMythicBannedToday } from '../../lib/eliteTrial';

const BANNED_TYPE_LABEL = { heal: '치유', stun: '기절', dot: '지속피해', buff_atk: '공격버프', buff_def: '방어버프', haste: '가속' };

// 리팩토링(사용자 요청 - DungeonSelect.jsx 996줄을 패널별로 분리, atomic design organism): 원래 DungeonSelect.jsx 안의 EliteTrialPanel를 그대로 옮김(로직 변경 없음)
export default function EliteTrialPanel({ activeMonster, onEnter, entering, error, attemptsRemaining, eliteLevel }) {
  if (!activeMonster) return null;

  if (eliteLevel < 1) {
    return (
      <div>
        <p className="stage-select-hint">
          <InfoTooltip text="레벨 500(만렙) 달성 후 이어지는 '정예레벨'을 1 이상 올려야 입장할 수 있어요. 정예레벨은 만렙 이후 얻는 경험치가 자동으로 쌓여서 오릅니다." />
          {' '}정예의 시련 안내
        </p>
        <p className="stage-select-hint" style={{ textAlign: 'center', padding: '20px 0' }}>
          🔒 정예레벨 1 이상부터 입장할 수 있어요.<br />
          먼저 레벨 500(만렙)을 찍고, 다른 던전에서 계속 싸우며 정예레벨을 올려보세요.
        </p>
      </div>
    );
  }

  const keys = attemptsRemaining ?? 0;
  const bannedTypes = getTodayBannedSkillTypes(eliteLevel);
  const mythicBanned = isMythicBannedToday(eliteLevel);
  return (
    <div>
      <p className="stage-select-hint">
        <InfoTooltip text="정예레벨에 비례해 점점 강해지는 보스와 싸워요. 방어력이 매우 높아서 전직스킬을 강화하지 않으면 클리어가 어려워요. 골드는 없고, 승리하면 정예 경험치만 받아요(다음 정예레벨까지 필요한 경험치의 약 15%). 하루 3회 도전할 수 있어요." />
        {' '}정예의 시련 안내
      </p>
      {error && <p className="shop-error">{error}</p>}
      <p className="stage-select-hint" style={{ color: 'var(--accent-gold)' }}>
        ✨ 현재 정예레벨: {eliteLevel} / 100 · 오늘 남은 도전: {attemptsRemaining ?? '...'} / 3
      </p>
      {(bannedTypes.length > 0 || mythicBanned) && (
        <p className="stage-select-hint" style={{ color: 'var(--accent-fire)' }}>
          🚫 오늘은 {mythicBanned ? '신화 등급 스킬 전부' : bannedTypes.map((t) => BANNED_TYPE_LABEL[t] ?? t).join('/') + ' 타입'}을(를) 사용할 수 없어요. 전직스킬 위주로 편성해보세요!
        </p>
      )}
      <button
        className={`btn btn-challenge ${keys <= 0 ? 'btn-unaffordable' : ''}`}
        disabled={entering || keys <= 0}
        onClick={() => {
          if (keys <= 0) {
            showToast('오늘의 정예 시련 도전 횟수를 모두 사용했어요.', 'error');
            return;
          }
          onEnter();
        }}
      >
        {keys <= 0 ? '오늘 도전 횟수 소진' : entering ? '입장 중...' : '💠 정예의 시련 도전하기'}
      </button>
    </div>
  );
}
