/**
 * New-game state initialization and story-script exports.
 *
 * C references:
 * - public/pokeemerald/data/scripts/new_game.inc
 */

import { gameFlags } from './GameFlags.ts';
import { gameVariables, GAME_VARS } from './GameVariables.ts';
import { clearDynamicWarpTarget } from './DynamicWarp.ts';
import { clearFixedHoleWarpTarget } from './FixedHoleWarp.ts';
import { resetDynamicObjectGfxVars } from './DynamicObjectGfx.ts';
import { NEW_GAME_FLAGS } from '../data/newGameFlags.gen.ts';

export type { StoryScriptContext } from './story/StoryScriptContext.ts';
export { executeStoryScript, isHandledStoryScript } from './story/executeStoryScript.ts';

export function initializeNewGameStoryState(): void {
  gameFlags.reset();
  gameVariables.reset();
  clearDynamicWarpTarget();
  clearFixedHoleWarpTarget();
  resetDynamicObjectGfxVars();

  gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 0);
  gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_TOWN_STATE, 0);
  gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_HOUSES_STATE_MAY, 0);
  gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_HOUSES_STATE_BRENDAN, 0);
  gameVariables.setVar(GAME_VARS.VAR_ROUTE101_STATE, 0);
  gameVariables.setVar(GAME_VARS.VAR_BIRCH_LAB_STATE, 0);
  gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE, 0);
  gameVariables.setVar(GAME_VARS.VAR_RESULT, 0);
  gameVariables.setVar(GAME_VARS.VAR_STARTER_MON, 0);

  // Set all hide flags from C source (EventScript_ResetAllMapFlags in new_game.inc).
  // This hides ~159 NPCs/objects across every map — post-game content, story NPCs
  // that appear later, Johto starter balls in the lab, rival dolls, etc.
  for (const flag of NEW_GAME_FLAGS) {
    gameFlags.set(flag);
  }
  // FLAG_HIDE_MAP_NAME_POPUP is not in the C source — it's our own UI flag.
  gameFlags.set('FLAG_HIDE_MAP_NAME_POPUP');

  // Movers must be visible during moving-in (hidden later when clock is set).
  gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_1');
  gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_2');

  // Route 101 objects that must be visible at game start.
  gameFlags.clear('FLAG_HIDE_ROUTE_101_BIRCH_STARTERS_BAG');
  gameFlags.clear('FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE');
  gameFlags.clear('FLAG_HIDE_ROUTE_101_ZIGZAGOON');
}

export function shouldRunCoordEvent(varName: string, requiredValue: number): boolean {
  return gameVariables.getVar(varName) === requiredValue;
}
