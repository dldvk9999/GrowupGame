import { useState } from 'react';
import { spriteRegistry } from '../assets/sprites';

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
 */
export default function MonsterSprite({ speciesKey, size = 90, alt }) {
  const [imgFailed, setImgFailed] = useState(false);
  const cdnBase = import.meta.env.VITE_SPRITE_CDN_URL;
  const imageUrl = cdnBase && speciesKey ? `${cdnBase}/${speciesKey}.png` : null;

  if (imageUrl && !imgFailed) {
    return (
      <img
        src={imageUrl}
        width={size}
        height={size}
        alt={alt || speciesKey}
        style={{ objectFit: 'contain', borderRadius: '50%' }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  const Vector = spriteRegistry[speciesKey];
  if (Vector) return <Vector size={size} />;

  return (
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
  );
}
