// C parity reference:
// - public/pokeemerald/src/field_control_avatar.c (ProcessPlayerFieldInput order:
//   trainer sight / ON_FRAME scripts before free movement input)
export interface PreInputOnFrameGateEvaluationInput {
  mapEntryGateActive: boolean;
  /**
   * True only after the pre-input phase had a valid chance to evaluate
   * trainer sight / ON_FRAME triggers for this frame.
   */
  preInputOnFrameEvaluated: boolean;
  /**
   * True when pre-input checks actually started a script/sequence this frame.
   */
  preInputOnFrameTriggered: boolean;
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

  // If pre-input checks already started a cutscene this frame, ownership has
  // been transferred to story-script locking and this gate can be cleared.
  if (input.preInputOnFrameTriggered) {
    return {
      shouldClearGate: true,
      shouldBlockPlayerUpdate: false,
    };
  }

  // Keep gate locked until pre-input checks had at least one valid evaluation
  // chance on the new map. This prevents old-script completion from unlocking
  // input one frame early before ON_FRAME callbacks can fire.
  if (!input.preInputOnFrameEvaluated) {
    return {
      shouldClearGate: false,
      shouldBlockPlayerUpdate: true,
    };
  }

  const isSatisfied = input.mapObjectsReady && input.mapScriptCacheReady;
  return {
    shouldClearGate: isSatisfied,
    shouldBlockPlayerUpdate: !isSatisfied,
  };
}
