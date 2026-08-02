import { showToast } from '../../lib/toast';
import InfoTooltip from '../InfoTooltip';

// 리팩토링(사용자 요청 - DungeonSelect.jsx 996줄을 패널별로 분리, atomic design organism): 원래 DungeonSelect.jsx 안의 RubyDungeonPanel를 그대로 옮김(로직 변경 없음)
export default function RubyDungeonPanel({ activeMonster, onEnter, entering, error, attemptsRemaining, rubies }) {
  if (!activeMonster) return null;
  const noAttemptsLeft = attemptsRemaining === 0;

  return (
    <div>
      <p className="stage-select-hint">
        <InfoTooltip text="내 캐릭터 레벨에 맞춰 난이도가 자동으로 정해지는 단발성 던전이에요. 클리어하면 루비 10~100개를 무작위로 받아요(전직스킬 강화에 사용). 순차 진행이 필요한 다른 던전과 달리 하루 5회까지 언제든 도전할 수 있어요." />
        {' '}루비 던전 안내
      </p>
      {error && <p className="shop-error">{error}</p>}
      <p className="stage-select-hint" style={{ color: 'var(--accent-gold)' }}>
        💎 보유 루비: {(rubies ?? 0).toLocaleString()}개 · 오늘 남은 입장 횟수: {attemptsRemaining ?? '...'} / 5
      </p>
      <button
        className={`btn btn-challenge ${noAttemptsLeft ? 'btn-unaffordable' : ''}`}
        disabled={entering || noAttemptsLeft}
        onClick={() => {
          if (noAttemptsLeft) {
            showToast('오늘의 루비 던전 입장 횟수를 모두 사용했어요.', 'error');
            return;
          }
          onEnter();
        }}
      >
        {noAttemptsLeft ? '오늘 입장 횟수 소진' : entering ? '입장 중...' : '💎 루비 던전 도전하기'}
      </button>
    </div>
  );
}
