/**
 * New-game intro flow helpers for the MVP path to the first battle.
 *
 * C references:
 * - public/pokeemerald/data/maps/InsideOfTruck/scripts.inc
 * - public/pokeemerald/data/maps/LittlerootTown/scripts.inc
 * - public/pokeemerald/data/scripts/players_house.inc
 * - public/pokeemerald/data/maps/Route101/scripts.inc
 */

import { gameFlags } from './GameFlags';
import { gameVariables, GAME_VARS } from './GameVariables';
import { clearDynamicWarpTarget } from './DynamicWarp';
import { SPECIES, getSpeciesName } from '../data/species';
import { NEW_GAME_FLAGS } from '../data/newGameFlags.gen';
import { MOVES } from '../data/moves';
import { createTestPokemon } from '../pokemon/testFactory';
import type { PartyPokemon } from '../pokemon/types';

type ScriptDirection = 'up' | 'down' | 'left' | 'right';
type ScriptMoveMode = 'walk' | 'jump' | 'jump_in_place' | 'face';

export interface StoryScriptContext {
  showMessage: (text: string) => Promise<void>;
  showChoice: <T>(
    text: string,
    choices: Array<{ label: string; value: T; disabled?: boolean }>,
    options?: { cancelable?: boolean; defaultIndex?: number }
  ) => Promise<T | null>;
  getPlayerGender: () => 0 | 1;
  getPlayerName: () => string;
  hasPartyPokemon: () => boolean;
  setParty: (party: (PartyPokemon | null)[]) => void;
  startFirstBattle: (starter: PartyPokemon) => Promise<void>;
  queueWarp: (mapId: string, x: number, y: number, direction: ScriptDirection) => void;
  forcePlayerStep: (direction: ScriptDirection) => void;
  delayFrames: (frames: number) => Promise<void>;
  movePlayer: (direction: ScriptDirection, mode?: ScriptMoveMode) => Promise<void>;
  moveNpc: (
    mapId: string,
    localId: string,
    direction: ScriptDirection,
    mode?: ScriptMoveMode
  ) => Promise<void>;
  faceNpcToPlayer: (mapId: string, localId: string) => void;
  setNpcPosition: (mapId: string, localId: string, tileX: number, tileY: number) => void;
  setNpcVisible: (mapId: string, localId: string, visible: boolean) => void;
  playDoorAnimation: (
    mapId: string,
    tileX: number,
    tileY: number,
    direction: 'open' | 'close'
  ) => Promise<void>;
  setPlayerVisible: (visible: boolean) => void;
  setMapMetatile?: (mapId: string, tileX: number, tileY: number, metatileId: number) => void;
  setNpcMovementType?: (mapId: string, localId: string, movementTypeRaw: string) => void;
  showYesNo?: (text: string) => Promise<boolean>;
  getParty?: () => (PartyPokemon | null)[];
}

type StarterChoice = {
  species: number;
  moveA: number;
  moveB: number;
};

const STARTER_CHOICES: StarterChoice[] = [
  { species: SPECIES.TREECKO, moveA: MOVES.POUND, moveB: MOVES.LEER },
  { species: SPECIES.TORCHIC, moveA: MOVES.SCRATCH, moveB: MOVES.GROWL },
  { species: SPECIES.MUDKIP, moveA: MOVES.TACKLE, moveB: MOVES.GROWL },
];

// Scripts with hand-coded implementations that override ScriptRunner.
// These are kept hand-coded because they either:
// - Need commands not yet in ScriptRunner (wall clock UI, starter/battle)
// - Have carefully tuned movement timing that differs from generated data
// - Coordinate parallel movement sequences not expressible in .inc format
// All other scripts fall through to ScriptRunner using generated data.
const HANDLED_SCRIPTS = new Set<string>([
  // Step off truck + mom greeting (complex parallel movements + door animations)
  'LittlerootTown_EventScript_StepOffTruckMale',
  'LittlerootTown_EventScript_StepOffTruckFemale',
  // House 1F cutscenes (warp coordination)
  'LittlerootTown_BrendansHouse_1F_EventScript_EnterHouseMovingIn',
  'LittlerootTown_MaysHouse_1F_EventScript_EnterHouseMovingIn',
  'LittlerootTown_BrendansHouse_1F_EventScript_GoSeeRoom',
  'LittlerootTown_MaysHouse_1F_EventScript_GoSeeRoom',
  'LittlerootTown_BrendansHouse_1F_EventScript_GoUpstairsToSetClock',
  'LittlerootTown_MaysHouse_1F_EventScript_GoUpstairsToSetClock',
  // Clock: custom simplification (real game has full wall clock UI)
  'PlayersHouse_2F_EventScript_SimplifiedClock',
  // TV broadcast (complex cutscenes)
  'LittlerootTown_BrendansHouse_1F_EventScript_PetalburgGymReport',
  'LittlerootTown_MaysHouse_1F_EventScript_PetalburgGymReport',
  // Rival house (complex cutscenes)
  'LittlerootTown_BrendansHouse_1F_EventScript_YoureNewNeighbor',
  'LittlerootTown_MaysHouse_1F_EventScript_YoureNewNeighbor',
  'LittlerootTown_BrendansHouse_1F_EventScript_MeetRival0',
  'LittlerootTown_BrendansHouse_1F_EventScript_MeetRival1',
  'LittlerootTown_BrendansHouse_1F_EventScript_MeetRival2',
  'LittlerootTown_MaysHouse_1F_EventScript_MeetRival0',
  'LittlerootTown_MaysHouse_1F_EventScript_MeetRival1',
  'LittlerootTown_MaysHouse_1F_EventScript_MeetRival2',
  // Route 101: starter selection + battle trigger
  'Route101_EventScript_BirchsBag',
]);

function buildStarter(choice: StarterChoice): PartyPokemon {
  return createTestPokemon({
    species: choice.species,
    level: 5,
    moves: [choice.moveA, choice.moveB, 0, 0],
  });
}

export function isHandledStoryScript(scriptName: string): boolean {
  return HANDLED_SCRIPTS.has(scriptName);
}

export function initializeNewGameStoryState(): void {
  gameFlags.reset();
  gameVariables.reset();
  clearDynamicWarpTarget();

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

function formatStoryText(text: string, playerName: string): string {
  return text.replace(/\{PLAYER\}/g, playerName);
}

export async function executeStoryScript(scriptName: string, ctx: StoryScriptContext): Promise<boolean> {
  const fallbackName = ctx.getPlayerGender() === 1 ? 'MAY' : 'BRENDAN';
  const resolvedPlayerName = ctx.getPlayerName().trim() || fallbackName;
  const showMessage = (text: string): Promise<void> => ctx.showMessage(formatStoryText(text, resolvedPlayerName));

  switch (scriptName) {
    case 'LittlerootTown_EventScript_StepOffTruckMale': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE) !== 1) {
        return true;
      }

      const mapId = 'MAP_LITTLEROOT_TOWN';
      const momLocalId = 'LOCALID_LITTLEROOT_MOM';
      const houseDoorX = 5;
      const houseDoorY = 8;
      ctx.setNpcPosition(mapId, momLocalId, 5, 8);
      ctx.setNpcVisible(mapId, momLocalId, false);

      await ctx.delayFrames(15);
      await ctx.movePlayer('right', 'jump');
      await ctx.delayFrames(48); // C: delay_16 × 3 after jump_right
      await ctx.playDoorAnimation(mapId, houseDoorX, houseDoorY, 'open');
      gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE');
      ctx.setNpcVisible(mapId, momLocalId, true);

      await ctx.moveNpc(mapId, momLocalId, 'down', 'walk');
      await ctx.moveNpc(mapId, momLocalId, 'down', 'walk');
      await ctx.moveNpc(mapId, momLocalId, 'left', 'face');
      await ctx.playDoorAnimation(mapId, houseDoorX, houseDoorY, 'close');

      await showMessage("MOM: We're here, honey! This is LITTLEROOT TOWN. What do you think?");
      await showMessage("MOM: This is going to be our new home! Let's go inside.");

      await Promise.all([
        (async () => {
          await ctx.delayFrames(24);
          await ctx.moveNpc(mapId, momLocalId, 'up', 'walk');
        })(),
        (async () => {
          await ctx.delayFrames(24);
          await ctx.movePlayer('right', 'walk');
          await ctx.movePlayer('up', 'face');
        })(),
      ]);
      await ctx.playDoorAnimation(mapId, houseDoorX, houseDoorY, 'open');

      await Promise.all([
        (async () => {
          await ctx.moveNpc(mapId, momLocalId, 'up', 'walk');
          ctx.setNpcVisible(mapId, momLocalId, false);
        })(),
        (async () => {
          await ctx.movePlayer('up', 'walk');
          await ctx.movePlayer('up', 'walk');
        })(),
      ]);

      gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE');
      gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 3);
      gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_FAT_MAN');
      gameFlags.clear('FLAG_HIDE_MAP_NAME_POPUP');
      ctx.setPlayerVisible(false);
      await ctx.playDoorAnimation(mapId, houseDoorX, houseDoorY, 'close');
      ctx.queueWarp('MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F', 8, 8, 'up');
      return true;
    }

    case 'LittlerootTown_EventScript_StepOffTruckFemale': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE) !== 2) {
        return true;
      }

      const mapId = 'MAP_LITTLEROOT_TOWN';
      const momLocalId = 'LOCALID_LITTLEROOT_MOM';
      const houseDoorX = 14;
      const houseDoorY = 8;
      ctx.setNpcPosition(mapId, momLocalId, 14, 8);
      ctx.setNpcVisible(mapId, momLocalId, false);

      await ctx.delayFrames(15);
      await ctx.movePlayer('right', 'jump');
      await ctx.delayFrames(48); // C: delay_16 × 3 after jump_right
      await ctx.playDoorAnimation(mapId, houseDoorX, houseDoorY, 'open');
      gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE');
      ctx.setNpcVisible(mapId, momLocalId, true);

      await ctx.moveNpc(mapId, momLocalId, 'down', 'walk');
      await ctx.moveNpc(mapId, momLocalId, 'down', 'walk');
      await ctx.moveNpc(mapId, momLocalId, 'left', 'face');
      await ctx.playDoorAnimation(mapId, houseDoorX, houseDoorY, 'close');

      await showMessage("MOM: We're here, honey! This is LITTLEROOT TOWN. What do you think?");
      await showMessage("MOM: This is going to be our new home! Let's go inside.");

      await Promise.all([
        (async () => {
          await ctx.delayFrames(24);
          await ctx.moveNpc(mapId, momLocalId, 'up', 'walk');
        })(),
        (async () => {
          await ctx.delayFrames(24);
          await ctx.movePlayer('right', 'walk');
          await ctx.movePlayer('up', 'face');
        })(),
      ]);
      await ctx.playDoorAnimation(mapId, houseDoorX, houseDoorY, 'open');

      await Promise.all([
        (async () => {
          await ctx.moveNpc(mapId, momLocalId, 'up', 'walk');
          ctx.setNpcVisible(mapId, momLocalId, false);
        })(),
        (async () => {
          await ctx.movePlayer('up', 'walk');
          await ctx.movePlayer('up', 'walk');
        })(),
      ]);

      gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE');
      gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 3);
      gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_FAT_MAN');
      gameFlags.clear('FLAG_HIDE_MAP_NAME_POPUP');
      ctx.setPlayerVisible(false);
      await ctx.playDoorAnimation(mapId, houseDoorX, houseDoorY, 'close');
      ctx.queueWarp('MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F', 2, 8, 'up');
      return true;
    }

    case 'LittlerootTown_BrendansHouse_1F_EventScript_EnterHouseMovingIn':
    case 'LittlerootTown_MaysHouse_1F_EventScript_EnterHouseMovingIn': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE) !== 3) {
        return true;
      }

      const isMaleHouse = scriptName.includes('BrendansHouse');
      const houseMapId = isMaleHouse
        ? 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F'
        : 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F';
      const momLocalId = 'LOCALID_PLAYERS_HOUSE_1F_MOM';
      ctx.setPlayerVisible(true);

      // Hide the truck now that we're inside (exterior is off-screen during warp fade)
      gameFlags.set(isMaleHouse
        ? 'FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK'
        : 'FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK');

      await showMessage("MOM: See, {PLAYER}?\nIsn't it nice in here, too?");
      ctx.faceNpcToPlayer(houseMapId, momLocalId);
      await ctx.movePlayer(isMaleHouse ? 'right' : 'left', 'face');

      await showMessage(
        "The mover's POKeMON do all the work of moving us in and cleaning up after.\nThis is so convenient!"
      );
      await showMessage("{PLAYER}, your room is upstairs.\nGo check it out, dear!");
      await showMessage("DAD bought you a new clock to mark our move here.\nDon't forget to set it!");
      gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 4);
      await Promise.all([
        ctx.movePlayer('up', 'walk'),
        ctx.moveNpc(houseMapId, momLocalId, 'up', 'face'),
      ]);
      return true;
    }

    case 'LittlerootTown_BrendansHouse_1F_EventScript_GoSeeRoom':
    case 'LittlerootTown_MaysHouse_1F_EventScript_GoSeeRoom': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE) !== 4) {
        return true;
      }
      const isMaleHouse = scriptName.includes('BrendansHouse');
      const houseMapId = isMaleHouse
        ? 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F'
        : 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F';
      const momLocalId = 'LOCALID_PLAYERS_HOUSE_1F_MOM';

      await showMessage("MOM: Well, {PLAYER}?\nAren't you interested in seeing your\nvery own room?");

      // Mom faces back up (away from door), push player away from door
      await ctx.moveNpc(houseMapId, momLocalId, 'up', 'face');
      await ctx.movePlayer('up', 'walk');

      // VAR stays at 4 — on GBA this coord event re-fires each time the
      // player walks to the door.  VAR advances to 5 only when the player
      // warps to 2F (ON_TRANSITION: BlockStairsUntilClockIsSet).
      return true;
    }

    // ── State 5: Mom tells player to go upstairs and set the clock ──
    case 'LittlerootTown_BrendansHouse_1F_EventScript_GoUpstairsToSetClock':
    case 'LittlerootTown_MaysHouse_1F_EventScript_GoUpstairsToSetClock': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE) !== 5) {
        return true;
      }
      const isMaleHouse = scriptName.includes('BrendansHouse');
      const houseMapId = isMaleHouse
        ? 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F'
        : 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F';
      const momLocalId = 'LOCALID_PLAYERS_HOUSE_1F_MOM';

      console.log('[GoUpstairsToSetClock] Showing dialog...');
      await showMessage('MOM: {PLAYER}.\nGo set the clock in your room, honey.');
      console.log('[GoUpstairsToSetClock] Dialog dismissed, starting movePlayer+moveNpc...');

      await Promise.all([
        ctx.movePlayer('up').then(() => console.log('[GoUpstairsToSetClock] movePlayer resolved')),
        ctx.moveNpc(houseMapId, momLocalId, 'up').then(() => console.log('[GoUpstairsToSetClock] moveNpc resolved')),
      ]);
      console.log('[GoUpstairsToSetClock] Both moves done, queuing warp...');

      // Warp to 2F
      if (isMaleHouse) {
        ctx.queueWarp('MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F', 7, 1, 'down');
      } else {
        ctx.queueWarp('MAP_LITTLEROOT_TOWN_MAYS_HOUSE_2F', 1, 1, 'down');
      }
      console.log('[GoUpstairsToSetClock] Warp queued, returning');
      return true;
    }

    // ── State 5 on 2F: Simplified clock set (replaces full wall clock UI) ──
    case 'PlayersHouse_2F_EventScript_SimplifiedClock': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE) !== 5) {
        return true;
      }
      const isMale = ctx.getPlayerGender() === 0;
      const house2FMapId = isMale
        ? 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F'
        : 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_2F';
      const mom2FLocalId = 'LOCALID_PLAYERS_HOUSE_2F_MOM';

      // Brief pause after warp
      await ctx.delayFrames(15);
      await showMessage("Seems like it's already correct!");

      // Advance state and set clock flag
      gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 6);
      gameFlags.set('FLAG_SET_WALL_CLOCK');

      // Hide the Vigoroth movers (clock is set, moving is done)
      gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_1');
      gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_2');

      // Mom comes upstairs
      gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_BEDROOM_MOM');
      ctx.setNpcVisible(house2FMapId, mom2FLocalId, true);

      if (isMale) {
        // Mom appears at (7,1), walks down, faces left, walks left, faces player
        ctx.setNpcPosition(house2FMapId, mom2FLocalId, 7, 1);
        await ctx.delayFrames(8);
        await ctx.moveNpc(house2FMapId, mom2FLocalId, 'down');
        await ctx.moveNpc(house2FMapId, mom2FLocalId, 'left', 'face');
        await ctx.delayFrames(8);
        await ctx.moveNpc(house2FMapId, mom2FLocalId, 'left');
        ctx.faceNpcToPlayer(house2FMapId, mom2FLocalId);
      } else {
        // Mom appears at (1,1), walks down, faces right, walks right, faces player
        ctx.setNpcPosition(house2FMapId, mom2FLocalId, 1, 1);
        await ctx.delayFrames(8);
        await ctx.moveNpc(house2FMapId, mom2FLocalId, 'down');
        await ctx.moveNpc(house2FMapId, mom2FLocalId, 'right', 'face');
        await ctx.delayFrames(8);
        await ctx.moveNpc(house2FMapId, mom2FLocalId, 'right');
        ctx.faceNpcToPlayer(house2FMapId, mom2FLocalId);
      }

      // Player faces mom
      await ctx.movePlayer(isMale ? 'right' : 'left', 'face');

      // Mom's dialog (C source: PlayersHouse_2F_Text_HowDoYouLikeYourRoom)
      await showMessage(
        'MOM: {PLAYER}, how do you like your\nnew room?'
      );
      await showMessage(
        'Good! Everything\'s put away neatly!'
      );
      await showMessage(
        'They finished moving everything in\ndownstairs, too.'
      );
      await showMessage(
        'POKéMON movers are so convenient!'
      );
      await showMessage(
        'Oh, you should make sure that\neverything\'s all there on your desk.'
      );

      // Mom exits — walk back to staircase and disappear
      if (isMale) {
        await ctx.moveNpc(house2FMapId, mom2FLocalId, 'right');
        await ctx.moveNpc(house2FMapId, mom2FLocalId, 'up');
        await ctx.delayFrames(8);
      } else {
        await ctx.moveNpc(house2FMapId, mom2FLocalId, 'left');
        await ctx.moveNpc(house2FMapId, mom2FLocalId, 'up');
        await ctx.delayFrames(8);
      }
      ctx.setNpcVisible(house2FMapId, mom2FLocalId, false);
      gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_BEDROOM_MOM');
      return true;
    }

    // ── State 6: Petalburg Gym TV broadcast (mom calls player to TV) ──
    case 'LittlerootTown_BrendansHouse_1F_EventScript_PetalburgGymReport':
    case 'LittlerootTown_MaysHouse_1F_EventScript_PetalburgGymReport': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE) !== 6) {
        return true;
      }
      const isMaleHouse = scriptName.includes('BrendansHouse');
      const houseMapId = isMaleHouse
        ? 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F'
        : 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F';
      const momLocalId = 'LOCALID_PLAYERS_HOUSE_1F_MOM';

      // Mom faces toward player (at stairs) with exclamation
      await ctx.moveNpc(houseMapId, momLocalId, isMaleHouse ? 'right' : 'left', 'face');
      await ctx.delayFrames(48); // exclamation stand-in

      await showMessage('MOM: Oh! {PLAYER}, {PLAYER}!\nQuick! Come quickly!');

      // Player approaches TV — walk down ×2, then toward TV
      await ctx.movePlayer('down');
      await ctx.movePlayer('down');
      if (isMaleHouse) {
        // Male house: TV is to the left
        await ctx.movePlayer('left');
        await ctx.movePlayer('left');
        await ctx.movePlayer('left');
      } else {
        // Female house: TV is to the right
        await ctx.movePlayer('right');
        await ctx.movePlayer('right');
        await ctx.movePlayer('right');
      }

      await showMessage("MOM: Look! It's PETALBURG GYM!\nMaybe DAD will be on!");

      // Mom makes room — walk one step toward TV side, face right/left
      if (isMaleHouse) {
        await ctx.moveNpc(houseMapId, momLocalId, 'left');
        await ctx.moveNpc(houseMapId, momLocalId, 'right', 'face');
      } else {
        await ctx.moveNpc(houseMapId, momLocalId, 'right');
        await ctx.moveNpc(houseMapId, momLocalId, 'left', 'face');
      }

      // Player to TV, face up to watch
      if (isMaleHouse) {
        await ctx.movePlayer('left');
      } else {
        await ctx.movePlayer('right');
      }
      await ctx.movePlayer('up', 'face');

      // Watch broadcast
      await showMessage(
        'INTERVIEWER: ...We brought you this\n'
        + 'report from in front of\nPETALBURG GYM.'
      );
      await ctx.delayFrames(35); // broadcast ends

      // Player turns to face mom
      await ctx.movePlayer(isMaleHouse ? 'left' : 'right', 'face');

      await showMessage(
        "MOM: Oh... It's over.\n"
        + 'I think DAD was on, but we missed him.\n'
        + 'Too bad.'
      );
      await showMessage(
        "Oh, yes.\n"
        + "One of DAD's friends lives in town.\n"
        + 'PROF. BIRCH is his name.\n'
        + "He lives right next door..."
      );

      // Mom returns to her seat
      if (isMaleHouse) {
        await ctx.moveNpc(houseMapId, momLocalId, 'left');
        await ctx.moveNpc(houseMapId, momLocalId, 'down');
        await ctx.moveNpc(houseMapId, momLocalId, 'right', 'face');
      } else {
        await ctx.moveNpc(houseMapId, momLocalId, 'right');
        await ctx.moveNpc(houseMapId, momLocalId, 'down');
        await ctx.moveNpc(houseMapId, momLocalId, 'left', 'face');
      }

      gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 7);
      return true;
    }

    // ── Rival house: rival's mom greets the player ──
    case 'LittlerootTown_BrendansHouse_1F_EventScript_YoureNewNeighbor':
    case 'LittlerootTown_MaysHouse_1F_EventScript_YoureNewNeighbor': {
      const isBrendansHouse = scriptName.includes('BrendansHouse');
      const houseMapId = isBrendansHouse
        ? 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F'
        : 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F';
      const rivalMomLocalId = 'LOCALID_RIVALS_HOUSE_1F_MOM';

      // Check the right house state variable
      if (isBrendansHouse) {
        if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_HOUSES_STATE_MAY) !== 1) return true;
      } else {
        if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_HOUSES_STATE_BRENDAN) !== 1) return true;
      }

      // Exclamation stand-in
      await ctx.delayFrames(48);

      // Player faces rival mom
      await ctx.movePlayer(isBrendansHouse ? 'left' : 'right', 'face');

      // Rival mom approaches from kitchen area
      if (isBrendansHouse) {
        await ctx.moveNpc(houseMapId, rivalMomLocalId, 'down');
        for (let i = 0; i < 5; i++) {
          await ctx.moveNpc(houseMapId, rivalMomLocalId, 'right');
        }
      } else {
        await ctx.moveNpc(houseMapId, rivalMomLocalId, 'down');
        for (let i = 0; i < 5; i++) {
          await ctx.moveNpc(houseMapId, rivalMomLocalId, 'left');
        }
      }
      ctx.faceNpcToPlayer(houseMapId, rivalMomLocalId);

      // Gender-dependent son/daughter text
      const isMale = ctx.getPlayerGender() === 0;
      // Male player → rival is May (daughter); Female player → rival is Brendan (son)
      const childWord = isMale ? 'daughter' : 'son';

      await showMessage(
        'Oh, hello. And you are?\n\n'
        + '... ... ... ... ...'
      );
      await showMessage(
        "Oh, you're {PLAYER}, our new\n"
        + 'next-door neighbor! Hi!'
      );
      await showMessage(
        `We have a ${childWord} about the same\n`
        + 'age as you.'
      );
      await showMessage(
        `Our ${childWord} was excited about\n`
        + 'making a new friend.'
      );
      await showMessage(
        `Our ${childWord} is upstairs, I think.`
      );

      gameFlags.set('FLAG_MET_RIVAL_MOM');

      if (isBrendansHouse) {
        gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_HOUSES_STATE_MAY, 2);
      } else {
        gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_HOUSES_STATE_BRENDAN, 2);
      }
      return true;
    }

    // ── Rival meeting on rival's 1F (coord events at 3 positions per house) ──
    case 'LittlerootTown_BrendansHouse_1F_EventScript_MeetRival0':
    case 'LittlerootTown_BrendansHouse_1F_EventScript_MeetRival1':
    case 'LittlerootTown_BrendansHouse_1F_EventScript_MeetRival2':
    case 'LittlerootTown_MaysHouse_1F_EventScript_MeetRival0':
    case 'LittlerootTown_MaysHouse_1F_EventScript_MeetRival1':
    case 'LittlerootTown_MaysHouse_1F_EventScript_MeetRival2': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE) !== 2) {
        return true;
      }
      const isBrendansHouse = scriptName.includes('BrendansHouse');
      const variant = parseInt(scriptName.charAt(scriptName.length - 1), 10) as 0 | 1 | 2;
      const houseMapId = isBrendansHouse
        ? 'MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F'
        : 'MAP_LITTLEROOT_TOWN_MAYS_HOUSE_1F';
      const rivalLocalId = 'LOCALID_RIVALS_HOUSE_1F_RIVAL';

      // Door sound stand-in
      await ctx.delayFrames(10);

      // Rival appears at door
      ctx.setNpcVisible(houseMapId, rivalLocalId, true);
      await ctx.delayFrames(30);

      // Exclamation stand-in
      await ctx.delayFrames(48);

      // Player faces rival (skip for variant 1 — player is already facing down)
      if (variant !== 1) {
        await ctx.movePlayer('down', 'face');
      }

      // Rival approaches (branched by variant)
      if (isBrendansHouse) {
        // Brendan's House door is on the right side
        switch (variant) {
          case 0:
            await ctx.moveNpc(houseMapId, rivalLocalId, 'left', 'face');
            await ctx.moveNpc(houseMapId, rivalLocalId, 'left');
            await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
            for (let i = 0; i < 4; i++) await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
            break;
          case 1:
            for (let i = 0; i < 3; i++) await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
            break;
          case 2:
            await ctx.moveNpc(houseMapId, rivalLocalId, 'right', 'face');
            await ctx.moveNpc(houseMapId, rivalLocalId, 'right');
            await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
            for (let i = 0; i < 4; i++) await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
            break;
        }
      } else {
        // May's House door is on the left side
        switch (variant) {
          case 0:
            await ctx.moveNpc(houseMapId, rivalLocalId, 'right', 'face');
            await ctx.moveNpc(houseMapId, rivalLocalId, 'right');
            await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
            for (let i = 0; i < 4; i++) await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
            break;
          case 1:
            for (let i = 0; i < 3; i++) await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
            break;
          case 2:
            await ctx.moveNpc(houseMapId, rivalLocalId, 'left', 'face');
            await ctx.moveNpc(houseMapId, rivalLocalId, 'left');
            await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
            for (let i = 0; i < 4; i++) await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
            break;
        }
      }
      ctx.faceNpcToPlayer(houseMapId, rivalLocalId);

      // Rival dialog (gender-dependent)
      if (isBrendansHouse) {
        // Female player meeting Brendan
        await showMessage(
          'Hey! You... Who are you?\n'
          + "Oh, you're {PLAYER}..."
        );
        await showMessage(
          "I didn't know that you're a girl.\n"
          + "My name's BRENDAN."
        );
        await showMessage(
          'So, hi, neighbor!\n'
          + "I... Pokemon..."
        );
        await showMessage(
          "I've got a Pokemon.\nI go Pokemon research with my dad too.");
        await showMessage(
          "I was Pokemon checking the Pokemon in the area.\nYou should come see me.\nWell, see you around!");
      } else {
        // Male player meeting May
        await showMessage(
          'Huh? Who... Who are you?\n\n'
          + '... Oh, you\'re {PLAYER}.'
        );
        await showMessage(
          'So your move was today.\n'
          + "Um... I'm MAY. Glad to meet you!"
        );
        await showMessage(
          "I... Pokemon...\nI've got a Pokemon too.");
        await showMessage(
          "We should be Pokemon friends.\nWell, see you later!");
      }

      // Rival exits upstairs (branched by variant with player watching)
      if (isBrendansHouse) {
        switch (variant) {
          case 0:
            await Promise.all([
              (async () => {
                await ctx.moveNpc(houseMapId, rivalLocalId, 'right', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'right');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
              })(),
              (async () => {
                await ctx.delayFrames(8);
                await ctx.movePlayer('right', 'face');
              })(),
            ]);
            break;
          case 1:
            await Promise.all([
              (async () => {
                await ctx.moveNpc(houseMapId, rivalLocalId, 'right', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'right');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'left', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'left');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
              })(),
              (async () => {
                await ctx.delayFrames(8);
                await ctx.movePlayer('right', 'face');
                await ctx.delayFrames(16);
                await ctx.delayFrames(16);
                await ctx.movePlayer('up', 'face');
              })(),
            ]);
            break;
          case 2:
            await Promise.all([
              (async () => {
                await ctx.moveNpc(houseMapId, rivalLocalId, 'left', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'left');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
              })(),
              (async () => {
                await ctx.delayFrames(8);
                await ctx.movePlayer('left', 'face');
              })(),
            ]);
            break;
        }
      } else {
        // May's House — mirrored
        switch (variant) {
          case 0:
            await Promise.all([
              (async () => {
                await ctx.moveNpc(houseMapId, rivalLocalId, 'left', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'left');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
              })(),
              (async () => {
                await ctx.delayFrames(8);
                await ctx.movePlayer('left', 'face');
              })(),
            ]);
            break;
          case 1:
            await Promise.all([
              (async () => {
                await ctx.moveNpc(houseMapId, rivalLocalId, 'left', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'left');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'right', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'right');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
              })(),
              (async () => {
                await ctx.delayFrames(8);
                await ctx.movePlayer('left', 'face');
                await ctx.delayFrames(16);
                await ctx.delayFrames(16);
                await ctx.movePlayer('up', 'face');
              })(),
            ]);
            break;
          case 2:
            await Promise.all([
              (async () => {
                await ctx.moveNpc(houseMapId, rivalLocalId, 'right', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'right');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up', 'face');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
                await ctx.moveNpc(houseMapId, rivalLocalId, 'up');
              })(),
              (async () => {
                await ctx.delayFrames(8);
                await ctx.movePlayer('right', 'face');
              })(),
            ]);
            break;
        }
      }

      // Rival exits (door sound stand-in)
      await ctx.delayFrames(10);
      ctx.setNpcVisible(houseMapId, rivalLocalId, false);

      // Set flags and vars
      if (isBrendansHouse) {
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_BRENDAN');
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F_POKE_BALL');
        gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_BEDROOM');
      } else {
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_MAY');
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_2F_POKE_BALL');
        gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_RIVAL_BEDROOM');
      }

      await ctx.delayFrames(30);
      gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_RIVAL_STATE, 3);
      gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_TOWN_STATE, 1);
      return true;
    }

    case 'Route101_EventScript_BirchsBag': {
      if (gameVariables.getVar(GAME_VARS.VAR_ROUTE101_STATE) < 2) {
        await showMessage("You hear someone shouting for help deeper in the grass.");
        return true;
      }

      if (ctx.hasPartyPokemon()) {
        await showMessage("Professor Birch's bag is here.");
        return true;
      }

      gameFlags.set('FLAG_SYS_POKEMON_GET');
      gameFlags.set('FLAG_RESCUED_BIRCH');

      const choice = await ctx.showChoice(
        "In Professor Birch's bag, there are three POKe BALLS. Which one will you choose?",
        STARTER_CHOICES.map((starter) => ({
          label: getSpeciesName(starter.species),
          value: starter.species,
        })),
        { cancelable: true, defaultIndex: 0 }
      );

      if (choice === null) {
        return true;
      }

      const selectedChoice = STARTER_CHOICES.find((starter) => starter.species === choice);
      if (!selectedChoice) {
        return true;
      }

      const starter = buildStarter(selectedChoice);
      const party: (PartyPokemon | null)[] = [starter, null, null, null, null, null];
      ctx.setParty(party);

      gameVariables.setVar(GAME_VARS.VAR_STARTER_MON, selectedChoice.species);
      gameVariables.setVar(GAME_VARS.VAR_RESULT, selectedChoice.species);

      await showMessage(`You chose ${getSpeciesName(selectedChoice.species)}!`);
      await ctx.startFirstBattle(starter);
      return true;
    }

    default:
      return false;
  }
}
