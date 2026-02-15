export interface StoryScriptFadeRecoveryState {
  fadeDirection: 'in' | 'out' | null;
  fadeIsComplete: boolean;
  fadeIsActive: boolean;
  hasActiveWarp: boolean;
  hasPendingScriptedWarp: boolean;
  hasOpenMenu: boolean;
}

export function shouldAutoRecoverStoryScriptFade(
  state: StoryScriptFadeRecoveryState
): boolean {
  if (state.hasActiveWarp || state.hasPendingScriptedWarp || state.hasOpenMenu) {
    return false;
  }
  if (state.fadeDirection !== 'out') {
    return false;
  }
  if (!state.fadeIsComplete) {
    return false;
  }
  return state.fadeIsActive;
}
