/**
 * Hand-coded boat ride sequences for Mr. Briney's boat.
 *
 * These scripts are hand-coded because the original GBA scripts move
 * the boat and player ~170 tiles across the ocean simultaneously,
 * which exceeds our map boundaries. Instead, we:
 * 1. Play the boarding animation
 * 2. Skip the long sail with a delay
 * 3. Set flags/vars as the original script would
 * 4. Warp to the destination
 *
 * C references:
 * - public/pokeemerald/data/maps/Route104/scripts.inc
 * - public/pokeemerald/data/maps/DewfordTown/scripts.inc
 * - public/pokeemerald/data/maps/Route109/scripts.inc
 */

import { gameFlags } from '../GameFlags';
import { gameVariables } from '../GameVariables';
import type { StoryScriptContext } from '../NewGameFlow';

/** All boat ride scripts that we intercept with hand-coded handlers. */
export const BRINEY_BOAT_SCRIPTS = new Set([
  // ON_FRAME trigger on Route 104 when VAR_BOARD_BRINEY_BOAT_STATE = 1
  'Route104_EventScript_StartSailToDewford',
  // Dewford Briney interaction (multichoice → Petalburg or Slateport)
  'DewfordTown_EventScript_Briney',
]);

export function isBrineyBoatScript(scriptName: string): boolean {
  return BRINEY_BOAT_SCRIPTS.has(scriptName);
}

/**
 * Execute a Briney boat ride script.
 * Returns true if the script was handled.
 */
export async function executeBrineyBoatScript(
  scriptName: string,
  ctx: StoryScriptContext,
): Promise<boolean> {
  switch (scriptName) {
    case 'Route104_EventScript_StartSailToDewford':
      return sailRoute104ToDewford(ctx);
    case 'DewfordTown_EventScript_Briney':
      return dewfordBrineyInteraction(ctx);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Route 104 → Dewford
// ---------------------------------------------------------------------------

/**
 * Route104_EventScript_StartSailToDewford
 * Triggered by ON_FRAME when VAR_BOARD_BRINEY_BOAT_STATE = 1.
 * Player arrives at Route 104 (13, 51) from Briney's house warp.
 *
 * C ref: Route104_EventScript_SailToDewford + ArriveInDewford
 */
async function sailRoute104ToDewford(ctx: StoryScriptContext): Promise<boolean> {
  const mapId = 'MAP_ROUTE104';

  if (gameVariables.getVar('VAR_BOARD_BRINEY_BOAT_STATE') !== 1) {
    return true; // Wrong state — skip silently
  }

  // --- Boarding animation ---
  // C: applymovement LOCALID_ROUTE104_BRINEY Route104_Movement_BrineyBoardBoat
  // Movement: walk_down, walk_down
  if (ctx.hasNpc?.(mapId, 'LOCALID_ROUTE104_BRINEY')) {
    await ctx.moveNpc(mapId, 'LOCALID_ROUTE104_BRINEY', 'down');
    await ctx.moveNpc(mapId, 'LOCALID_ROUTE104_BRINEY', 'down');
    ctx.setNpcVisible(mapId, 'LOCALID_ROUTE104_BRINEY', false, true); // removeobject
  }

  // C: applymovement LOCALID_PLAYER Route104_Movement_PlayerBoardBoat
  // Movement: walk_left, walk_down, walk_down
  await ctx.movePlayer('left');
  await ctx.movePlayer('down');
  await ctx.movePlayer('down');
  ctx.setPlayerVisible(false); // hideobjectat

  // --- Skip sailing — delay to simulate travel ---
  await ctx.delayFrames(60);

  // --- Handle Norman match call (C: FLAG_ENABLE_NORMAN_MATCH_CALL path) ---
  // In the GBA game, dad calls during the sail if this flag isn't set yet.
  // We skip the PokéNav call UI and just set the flag.
  if (!gameFlags.isSet('FLAG_ENABLE_NORMAN_MATCH_CALL')) {
    gameFlags.set('FLAG_ENABLE_NORMAN_MATCH_CALL');
  }

  // --- Arrival message ---
  // C: Route104_EventScript_DeliverLetterReminder / LandedInDewford
  if (!gameFlags.isSet('FLAG_DELIVERED_STEVEN_LETTER')) {
    await ctx.showMessage(
      "MR. BRINEY: Ahoy!\nWe've hit land in DEWFORD.\n\nI suppose you're off to deliver that\nLETTER to, who was it now, STEVEN!"
    );
  } else {
    await ctx.showMessage(
      "MR. BRINEY: Ahoy!\nWe've hit land in DEWFORD!\n\nYou just go on and tell me whenever\nyou want to set sail again!"
    );
  }

  // --- Set flags and vars (from ArriveInDewford) ---
  gameFlags.set('FLAG_HIDE_ROUTE_104_MR_BRINEY_BOAT');
  gameFlags.clear('FLAG_HIDE_MR_BRINEY_DEWFORD_TOWN');
  gameFlags.clear('FLAG_HIDE_MR_BRINEY_BOAT_DEWFORD_TOWN');

  // C: copyvar VAR_BRINEY_LOCATION, VAR_0x8008 (restore backup)
  gameVariables.setVar('VAR_BRINEY_LOCATION', gameVariables.getVar('VAR_0x8008'));
  gameVariables.setVar('VAR_BOARD_BRINEY_BOAT_STATE', 0);

  // --- Warp to Dewford ---
  // Position (12, 10) is near the boat dock, facing down.
  // C: Player ends up at approximately this position after exit animation.
  ctx.setPlayerVisible(true);
  ctx.queueWarp('MAP_DEWFORD_TOWN', 12, 10, 'down');

  return true;
}

// ---------------------------------------------------------------------------
// Dewford Briney interaction (covers Petalburg + Slateport routes)
// ---------------------------------------------------------------------------

/**
 * DewfordTown_EventScript_Briney
 * Full Briney interaction on Dewford — branches based on delivery flags.
 *
 * C ref: DewfordTown_EventScript_Briney + ReturnToPetalburgPrompt +
 *        ChoosePetalburg/ChooseSlateport/CancelSailSelect
 */
async function dewfordBrineyInteraction(ctx: StoryScriptContext): Promise<boolean> {
  const mapId = 'MAP_DEWFORD_TOWN';

  if (!gameFlags.isSet('FLAG_DELIVERED_STEVEN_LETTER')) {
    // --- Pre-letter: simple yes/no to return to Petalburg ---
    // C: DewfordTown_EventScript_ReturnToPetalburgPrompt
    const yes = await ctx.showYesNo!(
      "MR. BRINEY: Have you delivered your\nLETTER?\n\nOr were you meaning to sail back to\nPETALBURG?"
    );

    if (!yes) {
      await ctx.showMessage(
        "MR. BRINEY: Then you go on and deliver\nthe LETTER. I'll be waiting."
      );
      return true;
    }

    // C: DewfordTown_EventScript_SailBackToPetalburg
    await ctx.showMessage(
      "MR. BRINEY: PETALBURG it is, then!\n\nAnchors aweigh!\nPEEKO, we're setting sail, my darling!"
    );
    await sailDewfordToPetalburg(ctx, mapId);
    return true;
  }

  // --- Post-letter: destination choice ---
  // C: multichoicedefault MULTI_BRINEY_ON_DEWFORD
  const choice = await ctx.showChoice(
    "MR. BRINEY: Ahoy!\nFor you, I'll go out to sea anytime!\n\nNow, my friend, where are we bound?",
    [
      { label: 'PETALBURG', value: 'petalburg' },
      { label: 'SLATEPORT', value: 'slateport' },
    ],
    { cancelable: true }
  );

  if (!choice) {
    // C: DewfordTown_EventScript_CancelSailSelect
    await ctx.showMessage(
      "MR. BRINEY: You just tell me whenever\nyou need to set sail again!"
    );
    return true;
  }

  if (choice === 'petalburg') {
    // C: DewfordTown_EventScript_ChoosePetalburg
    await ctx.showMessage(
      "MR. BRINEY: PETALBURG, is it?\n\nAnchors aweigh!\nPEEKO, we're setting sail, my darling!"
    );
    await sailDewfordToPetalburg(ctx, mapId);
  } else {
    // C: DewfordTown_EventScript_ChooseSlateport
    await ctx.showMessage(
      "MR. BRINEY: SLATEPORT, is it?\n\nAnchors aweigh!\nPEEKO, we're setting sail, my darling!"
    );
    await sailDewfordToSlateport(ctx, mapId);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Dewford → Petalburg (Route 104 / Briney's House)
// ---------------------------------------------------------------------------

/**
 * DewfordTown_EventScript_SailToPetalburg
 * Boarding on Dewford dock, skip sail, warp to Briney's house.
 *
 * C ref: DewfordTown_EventScript_SailToPetalburg
 */
async function sailDewfordToPetalburg(ctx: StoryScriptContext, mapId: string): Promise<void> {
  // C: call EventScript_BackupMrBrineyLocation
  // copyvar VAR_0x8008, VAR_BRINEY_LOCATION; setvar VAR_BRINEY_LOCATION, 0
  gameVariables.setVar('VAR_0x8008', gameVariables.getVar('VAR_BRINEY_LOCATION'));
  gameVariables.setVar('VAR_BRINEY_LOCATION', 0);

  // --- Boarding animation ---
  // C: applymovement LOCALID_DEWFORD_BRINEY DewfordTown_Movement_BrineyBoardBoat
  // Movement: walk_up
  if (ctx.hasNpc?.(mapId, 'LOCALID_DEWFORD_BRINEY')) {
    await ctx.moveNpc(mapId, 'LOCALID_DEWFORD_BRINEY', 'up');
    ctx.setNpcVisible(mapId, 'LOCALID_DEWFORD_BRINEY', false, true); // removeobject
  }

  // C: applymovement LOCALID_PLAYER DewfordTown_Movement_PlayerBoardBoat
  // Movement: walk_right, walk_up
  await ctx.movePlayer('right');
  await ctx.movePlayer('up');
  ctx.setPlayerVisible(false); // hideobjectat

  // --- Skip sailing ---
  await ctx.delayFrames(60);

  // --- Set flags (from original script) ---
  gameFlags.clear('FLAG_HIDE_BRINEYS_HOUSE_MR_BRINEY');
  gameFlags.clear('FLAG_HIDE_BRINEYS_HOUSE_PEEKO');
  gameFlags.clear('FLAG_HIDE_ROUTE_104_MR_BRINEY_BOAT');
  gameFlags.set('FLAG_HIDE_MR_BRINEY_BOAT_DEWFORD_TOWN');
  gameVariables.setVar('VAR_BOARD_BRINEY_BOAT_STATE', 2);

  // C: copyvar VAR_BRINEY_LOCATION, VAR_0x8008
  gameVariables.setVar('VAR_BRINEY_LOCATION', gameVariables.getVar('VAR_0x8008'));

  // --- Warp to Briney's house ---
  // C: warp MAP_ROUTE104_MR_BRINEYS_HOUSE 5 4
  ctx.setPlayerVisible(true);
  ctx.queueWarp('MAP_ROUTE104_MR_BRINEYS_HOUSE', 5, 4, 'up');
}

// ---------------------------------------------------------------------------
// Dewford → Slateport (Route 109)
// ---------------------------------------------------------------------------

/**
 * DewfordTown_EventScript_SailToSlateport
 * Boarding on Dewford dock, skip sail, warp to Route 109 dock.
 *
 * C ref: DewfordTown_EventScript_SailToSlateport
 */
async function sailDewfordToSlateport(ctx: StoryScriptContext, mapId: string): Promise<void> {
  // C: call EventScript_BackupMrBrineyLocation
  gameVariables.setVar('VAR_0x8008', gameVariables.getVar('VAR_BRINEY_LOCATION'));
  gameVariables.setVar('VAR_BRINEY_LOCATION', 0);

  // --- Boarding animation ---
  // C: applymovement LOCALID_DEWFORD_BRINEY DewfordTown_Movement_BrineyBoardBoat
  // Movement: walk_up
  if (ctx.hasNpc?.(mapId, 'LOCALID_DEWFORD_BRINEY')) {
    await ctx.moveNpc(mapId, 'LOCALID_DEWFORD_BRINEY', 'up');
    ctx.setNpcVisible(mapId, 'LOCALID_DEWFORD_BRINEY', false, true); // removeobject
  }

  // C: applymovement LOCALID_PLAYER DewfordTown_Movement_PlayerBoardBoat
  // Movement: walk_right, walk_up
  await ctx.movePlayer('right');
  await ctx.movePlayer('up');
  ctx.setPlayerVisible(false); // hideobjectat

  // --- Skip sailing ---
  await ctx.delayFrames(60);

  // --- Arrival message ---
  // C: DewfordTown_EventScript_LandedSlateportDeliverGoods / LandedSlateport
  if (!gameFlags.isSet('FLAG_DELIVERED_DEVON_GOODS')) {
    await ctx.showMessage(
      "MR. BRINEY: Ahoy!\nWe've made land in SLATEPORT!\n\nI suppose you're going to visit CAPT.\nSTERN and deliver the DEVON GOODS?"
    );
  } else {
    await ctx.showMessage(
      "MR. BRINEY: Ahoy! We've made land in\nSLATEPORT!\n\nYou just go on and tell me whenever\nyou want to set sail again!"
    );
  }

  // --- Set flags (from original script) ---
  gameFlags.clear('FLAG_HIDE_ROUTE_109_MR_BRINEY');
  gameFlags.clear('FLAG_HIDE_ROUTE_109_MR_BRINEY_BOAT');
  gameFlags.set('FLAG_HIDE_MR_BRINEY_BOAT_DEWFORD_TOWN');

  // C: copyvar VAR_BRINEY_LOCATION, VAR_0x8008
  gameVariables.setVar('VAR_BRINEY_LOCATION', gameVariables.getVar('VAR_0x8008'));

  // --- Warp to Route 109 (near Briney's dock) ---
  // C: Player ends near (21, 24) after exit animation, facing down.
  // Briney appears at (21, 26) in original script.
  ctx.setPlayerVisible(true);
  ctx.queueWarp('MAP_ROUTE109', 21, 24, 'down');
}
