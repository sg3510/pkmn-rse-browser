/**
 * Minimal Battle Frontier runtime state used by script commands.
 *
 * C refs:
 * - public/pokeemerald/src/frontier_util.c (GetFrontierData / SetFrontierData)
 */

interface FrontierState {
  challengeStatus: number;
  lvlMode: number;
  battleNum: number;
  paused: number;
  recordDisabled: number;
  heardBrainSpeech: number;
  battleOutcome: number;
}

const frontierState: FrontierState = {
  challengeStatus: 0,
  lvlMode: 0,
  battleNum: 0,
  paused: 0,
  recordDisabled: 0,
  heardBrainSpeech: 0,
  battleOutcome: 0,
};

export function resetFrontierRuntimeState(): void {
  frontierState.challengeStatus = 0;
  frontierState.lvlMode = 0;
  frontierState.battleNum = 0;
  frontierState.paused = 0;
  frontierState.recordDisabled = 0;
  frontierState.heardBrainSpeech = 0;
  frontierState.battleOutcome = 0;
}

export function setFrontierBattleOutcome(outcome: number): void {
  frontierState.battleOutcome = outcome | 0;
}

export function getFrontierStatusVarTempChallengeStatus(): number {
  const status = frontierState.challengeStatus | 0;
  if (status >= 1 && status <= 4) {
    return status;
  }
  return 0xff;
}

export function getFrontierData(dataKey: string): number {
  switch (dataKey) {
    case 'FRONTIER_DATA_CHALLENGE_STATUS':
      return frontierState.challengeStatus;
    case 'FRONTIER_DATA_LVL_MODE':
      return frontierState.lvlMode;
    case 'FRONTIER_DATA_BATTLE_NUM':
      return frontierState.battleNum;
    case 'FRONTIER_DATA_PAUSED':
      return frontierState.paused;
    case 'FRONTIER_DATA_BATTLE_OUTCOME': {
      const outcome = frontierState.battleOutcome;
      frontierState.battleOutcome = 0;
      return outcome;
    }
    case 'FRONTIER_DATA_RECORD_DISABLED':
      return frontierState.recordDisabled;
    case 'FRONTIER_DATA_HEARD_BRAIN_SPEECH':
      return frontierState.heardBrainSpeech;
    default:
      return 0;
  }
}

export function setFrontierData(dataKey: string, value: number): void {
  const normalized = value | 0;
  switch (dataKey) {
    case 'FRONTIER_DATA_CHALLENGE_STATUS':
      frontierState.challengeStatus = normalized;
      break;
    case 'FRONTIER_DATA_LVL_MODE':
      frontierState.lvlMode = normalized;
      break;
    case 'FRONTIER_DATA_BATTLE_NUM':
      frontierState.battleNum = normalized;
      break;
    case 'FRONTIER_DATA_PAUSED':
      frontierState.paused = normalized;
      break;
    case 'FRONTIER_DATA_BATTLE_OUTCOME':
      frontierState.battleOutcome = normalized;
      break;
    case 'FRONTIER_DATA_RECORD_DISABLED':
      frontierState.recordDisabled = normalized;
      break;
    case 'FRONTIER_DATA_HEARD_BRAIN_SPEECH':
      frontierState.heardBrainSpeech = normalized;
      break;
  }
}
