export type CompositeRegionUv = {
  uvScaleX: number;
  uvScaleY: number;
  uvOffsetX: number;
  uvOffsetY: number;
};

export function computeCompositeRegionUv(
  sourceWidth: number,
  sourceHeight: number,
  sourceX: number,
  sourceY: number,
  sourceRegionWidth: number,
  sourceRegionHeight: number
): CompositeRegionUv {
  const safeSourceWidth = Math.max(1, sourceWidth);
  const safeSourceHeight = Math.max(1, sourceHeight);
  // sourceX/sourceY are top-left pixel coordinates in render-space.
  // UV origin is bottom-left, so Y must be converted when computing uvOffsetY.
  const clampedSourceX = Math.max(0, Math.min(sourceX, safeSourceWidth - 1));
  const clampedSourceY = Math.max(0, Math.min(sourceY, safeSourceHeight - 1));
  const clampedRegionWidth = Math.max(1, Math.min(sourceRegionWidth, safeSourceWidth - clampedSourceX));
  const clampedRegionHeight = Math.max(1, Math.min(sourceRegionHeight, safeSourceHeight - clampedSourceY));

  return {
    uvScaleX: clampedRegionWidth / safeSourceWidth,
    uvScaleY: clampedRegionHeight / safeSourceHeight,
    uvOffsetX: clampedSourceX / safeSourceWidth,
    uvOffsetY: (safeSourceHeight - clampedSourceY - clampedRegionHeight) / safeSourceHeight,
  };
}
