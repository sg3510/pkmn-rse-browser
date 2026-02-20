// C parity reference:
// - public/pokeemerald/src/field_control_avatar.c (ProcessPlayerFieldInput order:
//   trainer sight / ON_FRAME scripts before free movement input)
export interface PreInputOnFrameGateEvaluationInput {
  mapEntryGateActive: boolean;
  storyScriptRunning: boolean;
  mapObjectsReady: boolean;
  mapScriptCacheReady: boolean;
}

export interface PreInputOnFrameGateEvaluationResult {
  shouldClearGate: boolean;
  shouldBlockPlayerUpdate: boolean;
}

export function evaluatePreInputOnFrameGate(
  input: PreInputOnFrameGateEvaluationInput
): PreInputOnFrameGateEvaluationResult {
  if (!input.mapEntryGateActive) {
    return {
      shouldClearGate: false,
      shouldBlockPlayerUpdate: false,
    };
  }

  const isSatisfied = input.storyScriptRunning || (input.mapObjectsReady && input.mapScriptCacheReady);
  return {
    shouldClearGate: isSatisfied,
    shouldBlockPlayerUpdate: !isSatisfied,
  };
}
