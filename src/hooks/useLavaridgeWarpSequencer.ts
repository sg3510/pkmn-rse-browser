import { useMemo } from 'react';
import { LavaridgeWarpSequencer } from '../game/LavaridgeWarpSequencer';

export function useLavaridgeWarpSequencer() {
  const sequencer = useMemo(() => new LavaridgeWarpSequencer(), []);
  return sequencer;
}
