import FireStage1 from './FireStage1';
import FireStage2 from './FireStage2';
import FireStage3 from './FireStage3';
import WaterStage1 from './WaterStage1';
import WaterStage2 from './WaterStage2';
import WaterStage3 from './WaterStage3';
import GrassStage1 from './GrassStage1';
import GrassStage2 from './GrassStage2';
import GrassStage3 from './GrassStage3';

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
};
