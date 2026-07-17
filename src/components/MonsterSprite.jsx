import { useState } from 'react';
import { spriteRegistry } from '../assets/sprites';
import { getItem, RARITIES } from '../lib/itemCatalog';

// 코스튬 슬롯을 캐릭터 둘레 사방에 배치 (무기=오른쪽, 방어구=아래, 장갑=왼쪽, 신발=위)
const COSTUME_SLOT_POSITION = {
  weapon: { right: '-6%', top: '38%' },
  armor: { bottom: '-6%', left: '38%' },
  gloves: { left: '-6%', top: '38%' },
  shoes: { top: '-6%', left: '38%' },
};

/**
 * 몬스터 이미지를 그려주는 단일 진입점 컴포넌트.
 * 지금은 SVG 벡터만 존재하지만, 나중에 실사/일러스트 이미지가 생기면
 * 이 컴포넌트만 건드리면 앱 전체(전투, 도감, 사육장)에 자동 반영된다.
 *
 * 교체 방법:
 * 1) .env에 VITE_SPRITE_CDN_URL 설정 (예: Supabase Storage public URL)
 * 2) 해당 경로에 `${sprite_key}.png` 파일 업로드 (예: fire_1.png)
 * 3) 끝. 이미지가 있으면 자동으로 이미지 우선 표시, 없거나 로드 실패하면
 *    기존 벡터로 자동 폴백되므로 몬스터별로 순차 교체 가능.
 *
 * costumeKeys: 착용 중인 PvP 코스튬 item_key 배열(예: ['weapon_mythic', 'shoes_rare']).
 * 넘기면 캐릭터 둘레에 슬롯별 등급색 배지 아이콘으로 오버레이됨(042, 실제 스프라이트 합성이 아니라
 * 사방에 배치되는 아이콘 배지 방식 - 전신 리스킨은 몬스터 종류가 9종+15전직이라 코스튬(20종)과의
 * 조합 아트를 전부 그려야 해서 범위 밖으로 남겨두고, 대신 항상 눈에 보이는 배지로 "착용감"을 줌).
 */
export default function MonsterSprite({ speciesKey, size = 90, alt, costumeKeys }) {
  const [imgFailed, setImgFailed] = useState(false);
  const cdnBase = import.meta.env.VITE_SPRITE_CDN_URL;
  const imageUrl = cdnBase && speciesKey ? `${cdnBase}/${speciesKey}.png` : null;

  const costumeBadges = (costumeKeys ?? [])
    .map((key) => getItem(key))
    .filter(Boolean);

  const wrapperStyle = { position: 'relative', width: size, height: size, display: 'inline-block' };

  function renderCostumeOverlay() {
    if (costumeBadges.length === 0) return null;
    const badgeSize = Math.max(18, Math.round(size * 0.28));
    return costumeBadges.map((item) => {
      const pos = COSTUME_SLOT_POSITION[item.slot];
      if (!pos) return null;
      const color = RARITIES[item.rarity]?.color ?? '#9aa0b8';
      return (
        <span
          key={item.itemKey}
          title={item.name}
          style={{
            position: 'absolute',
            ...pos,
            width: badgeSize,
            height: badgeSize,
            borderRadius: '50%',
            background: 'var(--bg-panel)',
            border: `2px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(badgeSize * 0.55),
            boxShadow: `0 0 6px ${color}`,
            pointerEvents: 'none',
          }}
        >
          {item.icon}
        </span>
      );
    });
  }

  if (imageUrl && !imgFailed) {
    return (
      <span style={wrapperStyle}>
        <img
          src={imageUrl}
          width={size}
          height={size}
          alt={alt || speciesKey}
          style={{ objectFit: 'contain', borderRadius: '50%' }}
          onError={() => setImgFailed(true)}
        />
        {renderCostumeOverlay()}
      </span>
    );
  }

  const Vector = spriteRegistry[speciesKey];
  if (Vector) {
    return (
      <span style={wrapperStyle}>
        <Vector size={size} />
        {renderCostumeOverlay()}
      </span>
    );
  }

  return (
    <span style={wrapperStyle}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--surface-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        ?
      </div>
      {renderCostumeOverlay()}
    </span>
  );
}
