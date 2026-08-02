import { useEffect, useState } from 'react';
import { showToast } from '../lib/toast';
import InfoTooltip from './InfoTooltip';
import PublicProfileModal from './PublicProfileModal';
import ProgressiveDungeon from './organisms/ProgressiveDungeon';
import RubyDungeonPanel from './organisms/RubyDungeonPanel';
import StreakDungeonPanel from './organisms/StreakDungeonPanel';
import SealedDungeonPanel from './organisms/SealedDungeonPanel';
import EliteTrialPanel from './organisms/EliteTrialPanel';
import JobDungeonPanel from './organisms/JobDungeonPanel';
import WorldBossPanel from './organisms/WorldBossPanel';
import GuildRaidPanel from './organisms/GuildRaidPanel';
import TowerPanel from './organisms/TowerPanel';
import ExpeditionPanel from './organisms/ExpeditionPanel';

const DUNGEON_TABS = ['exp', 'gold', 'job', 'ruby', 'streak', 'sealed', 'elite', 'worldboss', 'guildraid', 'tower', 'expedition'];

export default function DungeonSelect({
  attemptsRemaining, dungeonProgress, onEnterDungeon, entering, error,
  activeMonster, onEnterJobDungeon, jobEntering, jobError,
  activeType, onActiveTypeChange,
  worldBoss, worldBossProgress, onEnterWorldBoss, worldBossEntering, worldBossError,
  towerHighestFloor, onEnterTower, towerEntering, towerError,
  userId, onExpeditionGoldChange, onExpeditionRubiesChange, onExpeditionSealFragmentsChange, missionNumber,
  onEnterRubyDungeon, rubyEntering, rubyError, rubyAttemptsRemaining, rubies,
  onEnterStreakDungeon, streakEntering, streakError, streakAttemptsRemaining, streakBest,
  guildRaid, guildRaidProgress, onEnterGuildRaid, guildRaidEntering, guildRaidError, onGoToGuild,
  onEnterSealedDungeon, sealedEntering, sealedError, sealStatus,
  equippedCostumes, onCostumeLoadoutChange, onSealCostumePurchased,
  onEnterEliteTrial, eliteEntering, eliteError, eliteAttemptsRemaining, eliteLevel,
}) {
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Tab / Shift+Tab으로 던전 탭 순환
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      const idx = DUNGEON_TABS.indexOf(activeType);
      const next = e.shiftKey
        ? DUNGEON_TABS[(idx - 1 + DUNGEON_TABS.length) % DUNGEON_TABS.length]
        : DUNGEON_TABS[(idx + 1) % DUNGEON_TABS.length];
      onActiveTypeChange(next);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeType, onActiveTypeChange]);

  return (
    <div className="dungeon-select">
      <h2>던전</h2>
      {selectedUserId && <PublicProfileModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />}

      <div className="shop-tabs">
        <button className={`shop-tab ${activeType === 'exp' ? 'active' : ''}`} onClick={() => onActiveTypeChange('exp')}>
          📘 경험치 던전
        </button>
        <button className={`shop-tab ${activeType === 'gold' ? 'active' : ''}`} onClick={() => onActiveTypeChange('gold')}>
          💰 골드 던전
        </button>
        <button className={`shop-tab ${activeType === 'job' ? 'active' : ''}`} onClick={() => onActiveTypeChange('job')}>
          ⚔️ 전직 던전
        </button>
        <button className={`shop-tab ${activeType === 'ruby' ? 'active' : ''}`} onClick={() => onActiveTypeChange('ruby')}>
          💎 루비 던전
        </button>
        <button className={`shop-tab ${activeType === 'streak' ? 'active' : ''}`} onClick={() => onActiveTypeChange('streak')}>
          🔥 연승 던전
        </button>
        <button className={`shop-tab ${activeType === 'sealed' ? 'active' : ''}`} onClick={() => onActiveTypeChange('sealed')}>
          🗝️ 봉인된 던전
        </button>
        <button className={`shop-tab ${activeType === 'elite' ? 'active' : ''}`} onClick={() => onActiveTypeChange('elite')}>
          💠 정예의 시련
        </button>
        <button className={`shop-tab ${activeType === 'worldboss' ? 'active' : ''}`} onClick={() => onActiveTypeChange('worldboss')}>
          🐉 월드보스
        </button>
        <button className={`shop-tab ${activeType === 'guildraid' ? 'active' : ''}`} onClick={() => onActiveTypeChange('guildraid')}>
          🛡️ 길드 레이드
        </button>
        <button className={`shop-tab ${activeType === 'tower' ? 'active' : ''}`} onClick={() => onActiveTypeChange('tower')}>
          🗼 무한의 탑
        </button>
        <button className={`shop-tab ${activeType === 'expedition' ? 'active' : ''}`} onClick={() => onActiveTypeChange('expedition')}>
          🧭 파견
        </button>
      </div>
      <p className="keyboard-hint">Tab / Shift+Tab으로 탭 이동</p>

      {activeType === 'job' ? (
        <JobDungeonPanel
          activeMonster={activeMonster}
          onEnter={onEnterJobDungeon}
          entering={jobEntering}
          error={jobError}
          towerHighestFloor={towerHighestFloor}
          missionNumber={missionNumber}
        />
      ) : activeType === 'ruby' ? (
        <RubyDungeonPanel
          activeMonster={activeMonster}
          onEnter={onEnterRubyDungeon}
          entering={rubyEntering}
          error={rubyError}
          attemptsRemaining={rubyAttemptsRemaining}
          rubies={rubies}
        />
      ) : activeType === 'streak' ? (
        <StreakDungeonPanel
          activeMonster={activeMonster}
          onEnter={onEnterStreakDungeon}
          entering={streakEntering}
          error={streakError}
          attemptsRemaining={streakAttemptsRemaining}
          streakBest={streakBest}
          onSelectUser={setSelectedUserId}
        />
      ) : activeType === 'sealed' ? (
        <SealedDungeonPanel
          activeMonster={activeMonster}
          onEnter={onEnterSealedDungeon}
          entering={sealedEntering}
          error={sealedError}
          sealStatus={sealStatus}
          equippedCostumes={equippedCostumes}
          onCostumeLoadoutChange={onCostumeLoadoutChange}
          onSealCostumePurchased={onSealCostumePurchased}
          onSelectUser={setSelectedUserId}
        />
      ) : activeType === 'elite' ? (
        <EliteTrialPanel
          activeMonster={activeMonster}
          onEnter={onEnterEliteTrial}
          entering={eliteEntering}
          error={eliteError}
          attemptsRemaining={eliteAttemptsRemaining}
          eliteLevel={eliteLevel}
        />
      ) : activeType === 'worldboss' ? (
        <WorldBossPanel
          boss={worldBoss}
          progress={worldBossProgress}
          onEnter={onEnterWorldBoss}
          entering={worldBossEntering}
          error={worldBossError}
          onSelectUser={setSelectedUserId}
        />
      ) : activeType === 'guildraid' ? (
        <GuildRaidPanel
          guildRaid={guildRaid}
          progress={guildRaidProgress}
          onEnter={onEnterGuildRaid}
          entering={guildRaidEntering}
          error={guildRaidError}
          onGoToGuild={onGoToGuild}
          onSelectUser={setSelectedUserId}
        />
      ) : activeType === 'tower' ? (
        <TowerPanel
          highestFloor={towerHighestFloor}
          onEnter={onEnterTower}
          entering={towerEntering}
          error={towerError}
          onSelectUser={setSelectedUserId}
        />
      ) : activeType === 'expedition' ? (
        <ExpeditionPanel
          userId={userId}
          onGoldChange={onExpeditionGoldChange}
          onRubiesChange={onExpeditionRubiesChange}
          onSealFragmentsChange={onExpeditionSealFragmentsChange}
        />
      ) : (
        <ProgressiveDungeon
          type={activeType}
          remaining={attemptsRemaining?.[activeType] ?? 3}
          clearedStage={dungeonProgress?.[activeType] ?? 0}
          onEnter={onEnterDungeon}
          entering={entering}
          error={error}
        />
      )}
    </div>
  );
}
