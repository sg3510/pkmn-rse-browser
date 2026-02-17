import assert from 'node:assert/strict';
import test from 'node:test';
import { METATILE_LABELS } from '../../data/metatileLabels.gen.ts';

const REQUIRED_LABELS = [
  'METATILE_SootopolisGym_Ice_Cracked',
  'METATILE_SootopolisGym_Ice_Broken',
  'METATILE_Fortree_BridgeOverGrass_Raised',
  'METATILE_Fortree_BridgeOverGrass_Lowered',
  'METATILE_Fortree_BridgeOverTrees_Raised',
  'METATILE_Fortree_BridgeOverTrees_Lowered',
  'METATILE_Pacifidlog_HalfSubmergedLogs_VerticalTop',
  'METATILE_Pacifidlog_HalfSubmergedLogs_VerticalBottom',
  'METATILE_Pacifidlog_HalfSubmergedLogs_HorizontalLeft',
  'METATILE_Pacifidlog_HalfSubmergedLogs_HorizontalRight',
  'METATILE_Pacifidlog_SubmergedLogs_VerticalTop',
  'METATILE_Pacifidlog_SubmergedLogs_VerticalBottom',
  'METATILE_Pacifidlog_SubmergedLogs_HorizontalLeft',
  'METATILE_Pacifidlog_SubmergedLogs_HorizontalRight',
  'METATILE_Pacifidlog_FloatingLogs_VerticalTop',
  'METATILE_Pacifidlog_FloatingLogs_VerticalBottom',
  'METATILE_Pacifidlog_FloatingLogs_HorizontalLeft',
  'METATILE_Pacifidlog_FloatingLogs_HorizontalRight',
  'METATILE_Cave_CrackedFloor',
  'METATILE_Cave_CrackedFloor_Hole',
  'METATILE_Pacifidlog_SkyPillar_CrackedFloor_Hole',
] as const;

test('Step callback metatile labels required for animation states are present', () => {
  const missing = REQUIRED_LABELS.filter((label) => METATILE_LABELS[label] === undefined);
  assert.deepEqual(missing, []);
});
