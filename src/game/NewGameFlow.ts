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
import { clearDynamicWarpTarget, setDynamicWarpTarget } from './DynamicWarp';
import { SPECIES, getSpeciesName } from '../data/species';
import { MOVES } from '../data/moves';
import { createTestPokemon } from '../pokemon/testFactory';
import type { PartyPokemon } from '../pokemon/types';

type ScriptDirection = 'up' | 'down' | 'left' | 'right';
type ScriptMoveMode = 'walk' | 'jump' | 'face';

export interface StoryScriptContext {
  showMessage: (text: string) => Promise<void>;
  showChoice: <T>(
    text: string,
    choices: Array<{ label: string; value: T; disabled?: boolean }>,
    options?: { cancelable?: boolean; defaultIndex?: number }
  ) => Promise<T | null>;
  getPlayerGender: () => 0 | 1;
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
    mode?: Exclude<ScriptMoveMode, 'jump'>
  ) => Promise<void>;
  faceNpcToPlayer: (mapId: string, localId: string) => void;
  setNpcPosition: (mapId: string, localId: string, tileX: number, tileY: number) => void;
  setNpcVisible: (mapId: string, localId: string, visible: boolean) => void;
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

const HANDLED_SCRIPTS = new Set<string>([
  'InsideOfTruck_EventScript_SetIntroFlags',
  'InsideOfTruck_EventScript_MovingBox',
  'LittlerootTown_EventScript_StepOffTruckMale',
  'LittlerootTown_EventScript_StepOffTruckFemale',
  'LittlerootTown_BrendansHouse_1F_EventScript_EnterHouseMovingIn',
  'LittlerootTown_MaysHouse_1F_EventScript_EnterHouseMovingIn',
  'Route101_EventScript_HideMapNamePopup',
  'Route101_EventScript_StartBirchRescue',
  'Route101_EventScript_PreventExitSouth',
  'Route101_EventScript_PreventExitWest',
  'Route101_EventScript_PreventExitNorth',
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
  gameVariables.setVar(GAME_VARS.VAR_RESULT, 0);
  gameVariables.setVar(GAME_VARS.VAR_STARTER_MON, 0);

  // Baseline flags needed for the opening story. This intentionally mirrors
  // the "everything hidden, then selectively shown" behavior from new_game.inc.
  gameFlags.set('FLAG_HIDE_MAP_NAME_POPUP');
  gameFlags.set('FLAG_HIDE_ROUTE_101_BIRCH');
  gameFlags.set('FLAG_HIDE_ROUTE_101_BOY');
  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MOM_OUTSIDE');
  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_BEDROOM_MOM');

  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_FAT_MAN');
  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_RIVAL');
  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BIRCH');
  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BIRCHS_LAB_BIRCH');
  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BIRCHS_LAB_RIVAL');
  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_BRENDAN');
  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_MAY');
  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_BEDROOM');
  gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_RIVAL_BEDROOM');

  gameFlags.set('FLAG_HIDE_PLAYERS_HOUSE_DAD');

  // Movers must be visible during moving-in (hidden later when clock is set).
  gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_1');
  gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_PLAYERS_HOUSE_VIGOROTH_2');

  gameFlags.clear('FLAG_HIDE_ROUTE_101_BIRCH_STARTERS_BAG');
  gameFlags.clear('FLAG_HIDE_ROUTE_101_BIRCH_ZIGZAGOON_BATTLE');
  gameFlags.clear('FLAG_HIDE_ROUTE_101_ZIGZAGOON');
}

export function shouldRunCoordEvent(varName: string, requiredValue: number): boolean {
  return gameVariables.getVar(varName) === requiredValue;
}

export async function executeStoryScript(scriptName: string, ctx: StoryScriptContext): Promise<boolean> {
  switch (scriptName) {
    case 'InsideOfTruck_EventScript_SetIntroFlags': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE) !== 0) {
        return true;
      }

      const isMale = ctx.getPlayerGender() === 0;
      gameFlags.set('FLAG_HIDE_MAP_NAME_POPUP');
      gameVariables.setVar(GAME_VARS.VAR_RESULT, isMale ? 0 : 1);

      if (isMale) {
        gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 1);
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_MOM');
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK');
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_MOM');
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_RIVAL_SIBLING');
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_2F_POKE_BALL');
        gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_HOUSES_STATE_BRENDAN, 1);
        setDynamicWarpTarget('MAP_LITTLEROOT_TOWN', 3, 10);
      } else {
        gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 2);
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_MOM');
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK');
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_RIVAL_MOM');
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_RIVAL_SIBLING');
        gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_2F_POKE_BALL');
        gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_HOUSES_STATE_MAY, 1);
        setDynamicWarpTarget('MAP_LITTLEROOT_TOWN', 12, 10);
      }
      return true;
    }

    case 'InsideOfTruck_EventScript_MovingBox': {
      await ctx.showMessage("The box is printed with a POKeMON logo. It's a POKeMON brand moving and delivery service.");
      return true;
    }

    case 'LittlerootTown_EventScript_StepOffTruckMale': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE) !== 1) {
        return true;
      }

      const mapId = 'MAP_LITTLEROOT_TOWN';
      const momLocalId = 'LOCALID_LITTLEROOT_MOM';
      ctx.setNpcPosition(mapId, momLocalId, 5, 8);
      ctx.setNpcVisible(mapId, momLocalId, true);

      await ctx.delayFrames(15);
      await ctx.movePlayer('right', 'jump');

      await ctx.moveNpc(mapId, momLocalId, 'down', 'walk');
      await ctx.moveNpc(mapId, momLocalId, 'down', 'walk');
      await ctx.moveNpc(mapId, momLocalId, 'left', 'face');

      await ctx.showMessage("MOM: We're here, honey! This is LITTLEROOT TOWN. What do you think?");
      await ctx.showMessage("MOM: This is going to be our new home! Let's go inside.");

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
      gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_BRENDANS_HOUSE_TRUCK');
      gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 3);
      gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_FAT_MAN');
      gameFlags.clear('FLAG_HIDE_MAP_NAME_POPUP');
      ctx.queueWarp('MAP_LITTLEROOT_TOWN_BRENDANS_HOUSE_1F', 8, 8, 'up');
      return true;
    }

    case 'LittlerootTown_EventScript_StepOffTruckFemale': {
      if (gameVariables.getVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE) !== 2) {
        return true;
      }

      const mapId = 'MAP_LITTLEROOT_TOWN';
      const momLocalId = 'LOCALID_LITTLEROOT_MOM';
      ctx.setNpcPosition(mapId, momLocalId, 14, 8);
      ctx.setNpcVisible(mapId, momLocalId, true);

      await ctx.delayFrames(15);
      await ctx.movePlayer('right', 'jump');

      await ctx.moveNpc(mapId, momLocalId, 'down', 'walk');
      await ctx.moveNpc(mapId, momLocalId, 'down', 'walk');
      await ctx.moveNpc(mapId, momLocalId, 'left', 'face');

      await ctx.showMessage("MOM: We're here, honey! This is LITTLEROOT TOWN. What do you think?");
      await ctx.showMessage("MOM: This is going to be our new home! Let's go inside.");

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
      gameFlags.set('FLAG_HIDE_LITTLEROOT_TOWN_MAYS_HOUSE_TRUCK');
      gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 3);
      gameFlags.clear('FLAG_HIDE_LITTLEROOT_TOWN_FAT_MAN');
      gameFlags.clear('FLAG_HIDE_MAP_NAME_POPUP');
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

      await ctx.showMessage("MOM: See, {PLAYER}?\nIsn't it nice in here, too?");
      ctx.faceNpcToPlayer(houseMapId, momLocalId);
      await ctx.movePlayer(isMaleHouse ? 'right' : 'left', 'face');

      await ctx.showMessage(
        "The mover's POKeMON do all the work of moving us in and cleaning up after.\nThis is so convenient!"
      );
      await ctx.showMessage("{PLAYER}, your room is upstairs.\nGo check it out, dear!");
      await ctx.showMessage("DAD bought you a new clock to mark our move here.\nDon't forget to set it!");
      gameVariables.setVar(GAME_VARS.VAR_LITTLEROOT_INTRO_STATE, 4);
      await Promise.all([
        ctx.movePlayer('up', 'walk'),
        ctx.moveNpc(houseMapId, momLocalId, 'up', 'face'),
      ]);
      return true;
    }

    case 'Route101_EventScript_HideMapNamePopup': {
      if (gameVariables.getVar(GAME_VARS.VAR_ROUTE101_STATE) !== 0) {
        return true;
      }

      gameFlags.set('FLAG_HIDE_MAP_NAME_POPUP');
      gameVariables.setVar(GAME_VARS.VAR_ROUTE101_STATE, 1);
      return true;
    }

    case 'Route101_EventScript_StartBirchRescue': {
      if (gameVariables.getVar(GAME_VARS.VAR_ROUTE101_STATE) !== 1) {
        return true;
      }

      await ctx.showMessage('H-help me!');
      await ctx.showMessage("Hello! You over there! Please! Help! In my BAG! There's a POKe BALL!");
      gameVariables.setVar(GAME_VARS.VAR_ROUTE101_STATE, 2);
      return true;
    }

    case 'Route101_EventScript_PreventExitSouth': {
      if (gameVariables.getVar(GAME_VARS.VAR_ROUTE101_STATE) === 2) {
        await ctx.showMessage("Wh-Where are you going?! Don't leave me like this!");
        ctx.forcePlayerStep('up');
      }
      return true;
    }

    case 'Route101_EventScript_PreventExitWest': {
      if (gameVariables.getVar(GAME_VARS.VAR_ROUTE101_STATE) === 2) {
        await ctx.showMessage("Wh-Where are you going?! Don't leave me like this!");
        ctx.forcePlayerStep('right');
      }
      return true;
    }

    case 'Route101_EventScript_PreventExitNorth': {
      if (gameVariables.getVar(GAME_VARS.VAR_ROUTE101_STATE) === 2) {
        await ctx.showMessage("Wh-Where are you going?! Don't leave me like this!");
        ctx.forcePlayerStep('down');
      }
      return true;
    }

    case 'Route101_EventScript_BirchsBag': {
      if (gameVariables.getVar(GAME_VARS.VAR_ROUTE101_STATE) < 2) {
        await ctx.showMessage("You hear someone shouting for help deeper in the grass.");
        return true;
      }

      if (ctx.hasPartyPokemon()) {
        await ctx.showMessage("Professor Birch's bag is here.");
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

      await ctx.showMessage(`You chose ${getSpeciesName(selectedChoice.species)}!`);
      await ctx.startFirstBattle(starter);
      return true;
    }

    default:
      return false;
  }
}
