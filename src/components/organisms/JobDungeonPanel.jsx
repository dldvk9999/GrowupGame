import { JOB_DUNGEON_BOSS, JOB_DUNGEON_EXTRA_REQ } from '../../lib/jobDungeon';
import { showToast } from '../../lib/toast';
import InfoTooltip from '../InfoTooltip';

// 리팩토링(사용자 요청 - DungeonSelect.jsx 996줄을 패널별로 분리, atomic design organism): 원래 DungeonSelect.jsx 안의 JobDungeonPanel를 그대로 옮김(로직 변경 없음)
export default function JobDungeonPanel({ activeMonster, onEnter, entering, error, towerHighestFloor, missionNumber }) {
  if (!activeMonster) return null;
  const unlocked = activeMonster.unlockedJobTier ?? 0;

  return (
    <div>
      <p className="stage-select-hint">
        <InfoTooltip text="레벨 조건을 채우면 도전할 수 있어요. 일반 던전보다 훨씬 강해서 스킬을 잘 돌려써야 이길 수 있어요. 6차 전직부터는 레벨 외에 무한의 탑 최소층·가이드미션 진행도·특정 업적 조건도 추가로 필요해요." />
        {' '}전직 던전 안내
      </p>
      {error && <p className="shop-error">{error}</p>}

      <div className="job-dungeon-list">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((tier) => {
          const boss = JOB_DUNGEON_BOSS[tier];
          const extraReq = JOB_DUNGEON_EXTRA_REQ[tier];
          const isDone = unlocked >= tier;
          const levelOk = activeMonster.level >= boss.requiredLevel;
          const prevDone = unlocked === tier - 1;
          const towerOk = !extraReq?.towerFloor || (towerHighestFloor ?? 0) >= extraReq.towerFloor;
          const missionOk = !extraReq?.missionNumber || (missionNumber ?? 1) >= extraReq.missionNumber;
          // 업적 보유 여부는 클라이언트에서 미리 확인하지 않음(서버 start_job_dungeon이 최종 검증,
          // 부족하면 에러 메시지로 정확히 안내함) - 여기선 조건 텍스트만 미리 보여줌
          const isEligible = levelOk && prevDone && towerOk && missionOk;
          const isLocked = !isDone && !isEligible;
          return (
            <div key={tier} className={`job-dungeon-card ${isDone ? 'done' : ''}`}>
              <div className="job-dungeon-tier">{tier}차 전직</div>
              <div className="job-dungeon-boss">{boss.name}</div>
              <div className="job-dungeon-req">필요 레벨 Lv.{boss.requiredLevel} · 체력 {boss.hp.toLocaleString()} · ⚔️{boss.atk.toLocaleString()} · 🛡️{boss.def.toLocaleString()}</div>
              {extraReq && (
                <div className="job-dungeon-extra-req">
                  추가 조건: {extraReq.towerFloor && `무한의 탑 ${extraReq.towerFloor}층 이상`}
                  {extraReq.missionNumber && ` · 가이드미션 ${extraReq.missionNumber}개 이상 진행`}
                  {extraReq.achievementTitle && ` · 업적 "${extraReq.achievementTitle}" 보유`}
                </div>
              )}
              {isDone ? (
                <span className="job-dungeon-done-badge">✅ 완료</span>
              ) : (
                <button
                  className={`btn btn-challenge ${isLocked ? 'btn-unaffordable' : ''}`}
                  disabled={entering}
                  onClick={() => {
                    if (isLocked) {
                      let reason = `레벨이 부족합니다. (Lv.${boss.requiredLevel} 필요)`;
                      if (unlocked < tier - 1) reason = '이전 단계 전직을 먼저 완료해야 합니다.';
                      else if (!towerOk) reason = `무한의 탑 ${extraReq.towerFloor}층 이상 도달해야 합니다.`;
                      else if (!missionOk) reason = `가이드미션을 ${extraReq.missionNumber}개 이상 진행해야 합니다.`;
                      showToast(reason, 'error');
                      return;
                    }
                    onEnter(tier);
                  }}
                >
                  {isLocked
                    ? (unlocked < tier - 1 ? '이전 단계 필요' : !levelOk ? `Lv.${boss.requiredLevel} 필요` : '조건 미달성')
                    : (entering ? '입장 중...' : '도전하기')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
