import { getMissionLabel, getMissionIcon } from '../lib/missions';

const CONDITION_MISSIONS = new Set(['job_tier1', 'job_tier2', 'job_tier3', 'job_tier4', 'equip_skill_slot']);

export default function MissionFloatingButton({ mission, completed, onClaim, claiming }) {
  if (!mission) return null;
  const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
  const isConditionMission = CONDITION_MISSIONS.has(mission.mission_key);

  return (
    <button
      className={`mission-fab ${completed ? 'mission-fab--done' : ''} ${mission.is_priority ? 'mission-fab--priority' : ''}`}
      onClick={() => completed && onClaim()}
      disabled={claiming}
    >
      <span className="mission-fab-number">미션 #{mission.mission_number}</span>
      <span className="mission-fab-body">
        <span className="mission-fab-icon">{getMissionIcon(mission.mission_key)}</span>
        <span className="mission-fab-text">
          <span className="mission-fab-label">{getMissionLabel(mission.mission_key, mission.target)}</span>
          <span className="mission-fab-progress">
            {completed
              ? (claiming ? '수령 중...' : '✅ 완료! 눌러서 보상받기')
              : (isConditionMission ? '조건을 달성하면 자동으로 완료돼요' : `${mission.progress}/${mission.target}`)}
          </span>
        </span>
      </span>
      {!completed && !isConditionMission && (
        <span className="mission-fab-bar"><span className="mission-fab-bar-fill" style={{ width: `${pct}%` }} /></span>
      )}
    </button>
  );
}
