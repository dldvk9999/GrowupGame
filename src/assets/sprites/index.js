import FireStage1 from './FireStage1';
import WaterStage1 from './WaterStage1';
import GrassStage1 from './GrassStage1';

// monster_species.sprite_key 값과 1:1 매핑.
// 외부 이미지로 교체할 몬스터가 생기면 여기서 지우지 말고 그대로 둔다.
// MonsterSprite 컴포넌트가 이미지 로드 실패 시 이 벡터로 자동 폴백한다.
export const spriteRegistry = {
  fire_1: FireStage1,
  water_1: WaterStage1,
  grass_1: GrassStage1,
  // fire_2, fire_3, water_2 ... 진화 단계 및 보스 스프라이트는
  // 같은 패턴으로 벡터 컴포넌트 추가 후 여기에 등록
};
