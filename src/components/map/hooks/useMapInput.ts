import { useCallback, useEffect } from 'react';
import { PlayerController } from '../../../game/PlayerController';
import type { WorldCameraView } from '../types';
import { METATILE_SIZE } from '../../../utils/mapLoader';

const DEBUG_MODE_FLAG = 'DEBUG_MODE';
function isDebugMode(): boolean {
  return !!(window as unknown as Record<string, boolean>)[DEBUG_MODE_FLAG];
}

interface UseMapInputProps {
  playerControllerRef: React.MutableRefObject<PlayerController | null>;
  cameraViewRef: React.MutableRefObject<WorldCameraView | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  showTileDebug: boolean;
  debugFocusMode: 'player' | 'inspect';
  dialogIsOpen: boolean;
  onInspectTile: (tileX: number, tileY: number) => void;
  onSurfDialogShow: (message: string, options?: { defaultYes?: boolean }) => Promise<boolean>;
  onSurfMessageShow: (message: string) => Promise<void>;
}

export const useMapInput = ({
  playerControllerRef,
  cameraViewRef,
  canvasRef,
  showTileDebug,
  debugFocusMode,
  dialogIsOpen,
  onInspectTile,
  onSurfDialogShow,
  onSurfMessageShow,
}: UseMapInputProps) => {
  
  // Canvas click handler for tile inspection in debug mode
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!showTileDebug || debugFocusMode !== 'inspect') return;
      const view = cameraViewRef.current;
      if (!view) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const localX = (e.clientX - rect.left) * scaleX;
      const localY = (e.clientY - rect.top) * scaleY;
      const worldPixelX = view.cameraWorldX + localX;
      const worldPixelY = view.cameraWorldY + localY;
      const tileX = Math.floor(worldPixelX / METATILE_SIZE);
      const tileY = Math.floor(worldPixelY / METATILE_SIZE);
      
      onInspectTile(tileX, tileY);
    },
    [debugFocusMode, showTileDebug, canvasRef, cameraViewRef, onInspectTile]
  );

  // X key handler for surf initiation
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only handle X key (KeyX)
      if (e.code !== 'KeyX') return;
      
      if (isDebugMode()) {
        console.log('[DEBUG_X] X key pressed!', { 
           player: !!playerControllerRef.current,
           inputLocked: playerControllerRef.current?.inputLocked,
           isSurfing: playerControllerRef.current?.isSurfing(),
           dialogOpen: dialogIsOpen
        });
      }

      const player = playerControllerRef.current;
      if (!player || player.inputLocked || player.isSurfing() || dialogIsOpen) return;
      
      e.preventDefault();
      
      // Get player's facing tile
      const facingTileX = player.dir === 'left' ? player.tileX - 1 :
                          player.dir === 'right' ? player.tileX + 1 :
                          player.tileX;
      const facingTileY = player.dir === 'up' ? player.tileY - 1 :
                          player.dir === 'down' ? player.tileY + 1 :
                          player.tileY;
      
      // Check if can surf
      const result = player.surfingController.canInitiateSurf(
        player.tileX,
        player.tileY,
        player.dir,
        player.tileResolver ?? undefined
      );
      
      if (!result.canSurf) {
        if (isDebugMode()) {
          console.log('[SURF] Cannot surf:', result.reason);
        }
        return;
      }
      
      // Show surf dialog
      console.log('[SURF] Showing dialog...');
      const wantToSurf = await onSurfDialogShow(
        "The water is a deep blue...\nWould you like to SURF?",
        { defaultYes: true }
      );
      console.log('[SURF] Dialog returned:', wantToSurf, typeof wantToSurf);

      if (wantToSurf) {
        // Show "Pokemon used SURF!" message
        await onSurfMessageShow("LAPRAS used SURF!");
        console.log('[SURF] Starting surf sequence');

        // Start surfing with jump animation
        player.startSurfing(facingTileX, facingTileY);

        if (isDebugMode()) {
          console.log('[SURF] Jump animation started to water tile');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [playerControllerRef, dialogIsOpen, onSurfDialogShow, onSurfMessageShow]);

  return {
    handleCanvasClick,
  };
};
