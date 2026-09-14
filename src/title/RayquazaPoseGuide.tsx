/** Shared screen-space trace of the user's GBA reference, not the 3D model. */
import { POSE_GUIDE_PATH } from './rayquazaPoseReference';

export function RayquazaPoseGuide() {
  return <svg viewBox="0 0 256 256" aria-label="GBA spiral centerline guide" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
    <path d={POSE_GUIDE_PATH}
      fill="none" stroke="#101019" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
    <path d={POSE_GUIDE_PATH}
      fill="none" stroke="#ff668e" strokeWidth="2" strokeLinecap="round" />
    <circle cx="136" cy="128" r="5" fill="#fff" stroke="#ff668e" strokeWidth="2" />
    <path d="M215 97 L204 99 L211 108" fill="none" stroke="#ff668e" strokeWidth="2" />
    <g fill="white" stroke="#101019" strokeWidth="2" paintOrder="stroke" fontFamily="sans-serif" fontSize="9" fontWeight="bold">
      <text x="146" y="132">FACE</text><text x="180" y="92">TAIL</text>
    </g>
  </svg>;
}
