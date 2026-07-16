import FireStage1 from './FireStage1';
import FireStage2 from './FireStage2';
import FireStage3 from './FireStage3';
import WaterStage1 from './WaterStage1';
import WaterStage2 from './WaterStage2';
import WaterStage3 from './WaterStage3';
import GrassStage1 from './GrassStage1';
import GrassStage2 from './GrassStage2';
import GrassStage3 from './GrassStage3';
import JobTierSprite from './JobTierSprite';

// monster_species.sprite_key 값과 1:1 매핑.
// 외부 이미지로 교체할 몬스터가 생기면 여기서 지우지 말고 그대로 둔다.
// MonsterSprite 컴포넌트가 이미지 로드 실패 시 이 벡터로 자동 폴백한다.
export const spriteRegistry = {
  fire_1: FireStage1,
  fire_2: FireStage2,
  fire_3: FireStage3,
  water_1: WaterStage1,
  water_2: WaterStage2,
  water_3: WaterStage3,
  grass_1: GrassStage1,
  grass_2: GrassStage2,
  grass_3: GrassStage3,

  // 전직 단계 전용 외형 (전직 던전 클리어 시 unlockedJobTier가 올라가면 진화 단계 외형 대신 이걸로 표시됨)
  fire_job1: (props) => <JobTierSprite element="fire" tier={1} {...props} />,
  fire_job2: (props) => <JobTierSprite element="fire" tier={2} {...props} />,
  fire_job3: (props) => <JobTierSprite element="fire" tier={3} {...props} />,
  water_job1: (props) => <JobTierSprite element="water" tier={1} {...props} />,
  water_job2: (props) => <JobTierSprite element="water" tier={2} {...props} />,
  water_job3: (props) => <JobTierSprite element="water" tier={3} {...props} />,
  grass_job1: (props) => <JobTierSprite element="grass" tier={1} {...props} />,
  grass_job2: (props) => <JobTierSprite element="grass" tier={2} {...props} />,
  grass_job3: (props) => <JobTierSprite element="grass" tier={3} {...props} />,
  fire_job4: (props) => <JobTierSprite element="fire" tier={4} {...props} />,
  water_job4: (props) => <JobTierSprite element="water" tier={4} {...props} />,
  grass_job4: (props) => <JobTierSprite element="grass" tier={4} {...props} />,
  fire_job5: (props) => <JobTierSprite element="fire" tier={5} {...props} />,
  water_job5: (props) => <JobTierSprite element="water" tier={5} {...props} />,
  grass_job5: (props) => <JobTierSprite element="grass" tier={5} {...props} />,
};
