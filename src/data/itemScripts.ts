/**
 * Mapping of item ball script names to item constants
 * Generated from public/pokeemerald/data/scripts/item_ball_scripts.inc
 */

import { ITEMS } from './items';

// Script name -> Item constant name mapping
// Format: "Location_EventScript_ItemName" -> "ITEM_NAME"
const SCRIPT_TO_ITEM_CONST: Record<string, string> = {
  // Route 102-134
  'Route102_EventScript_ItemPotion': 'ITEM_POTION',
  'Route103_EventScript_ItemGuardSpec': 'ITEM_GUARD_SPEC',
  'Route103_EventScript_ItemPPUp': 'ITEM_PP_UP',
  'Route104_EventScript_ItemPPUp': 'ITEM_PP_UP',
  'Route104_EventScript_ItemPokeBall': 'ITEM_POKE_BALL',
  'Route104_EventScript_ItemXAccuracy': 'ITEM_X_ACCURACY',
  'Route104_EventScript_ItemPotion': 'ITEM_POTION',
  'Route105_EventScript_ItemIron': 'ITEM_IRON',
  'Route106_EventScript_ItemProtein': 'ITEM_PROTEIN',
  'Route108_EventScript_ItemStarPiece': 'ITEM_STAR_PIECE',
  'Route109_EventScript_ItemPPUp': 'ITEM_PP_UP',
  'Route109_EventScript_ItemPotion': 'ITEM_POTION',
  'Route110_EventScript_ItemRareCandy': 'ITEM_RARE_CANDY',
  'Route110_EventScript_ItemDireHit': 'ITEM_DIRE_HIT',
  'Route110_EventScript_ItemElixir': 'ITEM_ELIXIR',
  'Route111_EventScript_ItemTMSandstorm': 'ITEM_TM32',
  'Route111_EventScript_ItemStardust': 'ITEM_STARDUST',
  'Route111_EventScript_ItemHPUp': 'ITEM_HP_UP',
  'Route111_EventScript_ItemElixir': 'ITEM_ELIXIR',
  'Route112_EventScript_ItemNugget': 'ITEM_NUGGET',
  'Route113_EventScript_ItemMaxEther': 'ITEM_MAX_ETHER',
  'Route113_EventScript_ItemSuperRepel': 'ITEM_SUPER_REPEL',
  'Route113_EventScript_ItemHyperPotion': 'ITEM_HYPER_POTION',
  'Route114_EventScript_ItemRareCandy': 'ITEM_RARE_CANDY',
  'Route114_EventScript_ItemProtein': 'ITEM_PROTEIN',
  'Route114_EventScript_ItemEnergyPowder': 'ITEM_ENERGY_POWDER',
  'Route115_EventScript_ItemSuperPotion': 'ITEM_SUPER_POTION',
  'Route115_EventScript_ItemTMFocusPunch': 'ITEM_TM01',
  'Route115_EventScript_ItemIron': 'ITEM_IRON',
  'Route115_EventScript_ItemGreatBall': 'ITEM_GREAT_BALL',
  'Route115_EventScript_ItemHealPowder': 'ITEM_HEAL_POWDER',
  'Route115_EventScript_ItemPPUp': 'ITEM_PP_UP',
  'Route116_EventScript_ItemXSpecial': 'ITEM_X_SPECIAL',
  'Route116_EventScript_ItemEther': 'ITEM_ETHER',
  'Route116_EventScript_ItemRepel': 'ITEM_REPEL',
  'Route116_EventScript_ItemHPUp': 'ITEM_HP_UP',
  'Route116_EventScript_ItemPotion': 'ITEM_POTION',
  'Route117_EventScript_ItemGreatBall': 'ITEM_GREAT_BALL',
  'Route117_EventScript_ItemRevive': 'ITEM_REVIVE',
  'Route118_EventScript_ItemHyperPotion': 'ITEM_HYPER_POTION',
  'Route119_EventScript_ItemSuperRepel': 'ITEM_SUPER_REPEL',
  'Route119_EventScript_ItemZinc': 'ITEM_ZINC',
  'Route119_EventScript_ItemElixir': 'ITEM_ELIXIR',
  'Route119_EventScript_ItemLeafStone': 'ITEM_LEAF_STONE',
  'Route119_EventScript_ItemRareCandy': 'ITEM_RARE_CANDY',
  'Route119_EventScript_ItemHyperPotion': 'ITEM_HYPER_POTION',
  'Route119_EventScript_ItemHyperPotion2': 'ITEM_HYPER_POTION',
  'Route119_EventScript_ItemElixir2': 'ITEM_ELIXIR',
  'Route119_EventScript_ItemNugget': 'ITEM_NUGGET',
  'Route119_EventScript_ItemMaxElixir': 'ITEM_MAX_ELIXIR',
  'Route119_EventScript_ItemNestBall': 'ITEM_NEST_BALL',
  'Route120_EventScript_ItemNugget': 'ITEM_NUGGET',
  'Route120_EventScript_ItemFullHeal': 'ITEM_FULL_HEAL',
  'Route120_EventScript_ItemHyperPotion': 'ITEM_HYPER_POTION',
  'Route120_EventScript_ItemNestBall': 'ITEM_NEST_BALL',
  'Route120_EventScript_ItemRevive': 'ITEM_REVIVE',
  'Route121_EventScript_ItemCarbos': 'ITEM_CARBOS',
  'Route121_EventScript_ItemRevive': 'ITEM_REVIVE',
  'Route121_EventScript_ItemZinc': 'ITEM_ZINC',
  'Route123_EventScript_ItemCalcium': 'ITEM_CALCIUM',
  'Route123_EventScript_ItemUltraBall': 'ITEM_ULTRA_BALL',
  'Route123_EventScript_ItemElixir': 'ITEM_ELIXIR',
  'Route123_EventScript_ItemPPUp': 'ITEM_PP_UP',
  'Route123_EventScript_ItemRevivalHerb': 'ITEM_REVIVAL_HERB',
  'Route124_EventScript_ItemRedShard': 'ITEM_RED_SHARD',
  'Route124_EventScript_ItemBlueShard': 'ITEM_BLUE_SHARD',
  'Route124_EventScript_ItemYellowShard': 'ITEM_YELLOW_SHARD',
  'Route125_EventScript_ItemBigPearl': 'ITEM_BIG_PEARL',
  'Route126_EventScript_ItemGreenShard': 'ITEM_GREEN_SHARD',
  'Route127_EventScript_ItemZinc': 'ITEM_ZINC',
  'Route127_EventScript_ItemCarbos': 'ITEM_CARBOS',
  'Route127_EventScript_ItemRareCandy': 'ITEM_RARE_CANDY',
  'Route132_EventScript_ItemRareCandy': 'ITEM_RARE_CANDY',
  'Route132_EventScript_ItemProtein': 'ITEM_PROTEIN',
  'Route133_EventScript_ItemBigPearl': 'ITEM_BIG_PEARL',
  'Route133_EventScript_ItemStarPiece': 'ITEM_STAR_PIECE',
  'Route133_EventScript_ItemMaxRevive': 'ITEM_MAX_REVIVE',
  'Route134_EventScript_ItemCarbos': 'ITEM_CARBOS',
  'Route134_EventScript_ItemStarPiece': 'ITEM_STAR_PIECE',

  // Cities
  'PetalburgCity_EventScript_ItemMaxRevive': 'ITEM_MAX_REVIVE',
  'PetalburgCity_EventScript_ItemEther': 'ITEM_ETHER',
  'MauvilleCity_EventScript_ItemXSpeed': 'ITEM_X_SPEED',
  'RustboroCity_EventScript_ItemXDefend': 'ITEM_X_DEFEND',
  'LilycoveCity_EventScript_ItemMaxRepel': 'ITEM_MAX_REPEL',
  'MossdeepCity_EventScript_ItemNetBall': 'ITEM_NET_BALL',

  // Petalburg Woods
  'PetalburgWoods_EventScript_ItemXAttack': 'ITEM_X_ATTACK',
  'PetalburgWoods_EventScript_ItemGreatBall': 'ITEM_GREAT_BALL',
  'PetalburgWoods_EventScript_ItemEther': 'ITEM_ETHER',
  'PetalburgWoods_EventScript_ItemParalyzeHeal': 'ITEM_PARALYZE_HEAL',

  // Rusturf Tunnel
  'RusturfTunnel_EventScript_ItemPokeBall': 'ITEM_POKE_BALL',
  'RusturfTunnel_EventScript_ItemMaxEther': 'ITEM_MAX_ETHER',

  // Granite Cave
  'GraniteCave_1F_EventScript_ItemEscapeRope': 'ITEM_ESCAPE_ROPE',
  'GraniteCave_B1F_EventScript_ItemPokeBall': 'ITEM_POKE_BALL',
  'GraniteCave_B2F_EventScript_ItemRepel': 'ITEM_REPEL',
  'GraniteCave_B2F_EventScript_ItemRareCandy': 'ITEM_RARE_CANDY',

  // Jagged Pass / Fiery Path
  'JaggedPass_EventScript_ItemBurnHeal': 'ITEM_BURN_HEAL',
  'FieryPath_EventScript_ItemFireStone': 'ITEM_FIRE_STONE',
  'FieryPath_EventScript_ItemTMToxic': 'ITEM_TM06',

  // Meteor Falls
  'MeteorFalls_1F_1R_EventScript_ItemTMIronTail': 'ITEM_TM23',
  'MeteorFalls_1F_1R_EventScript_ItemFullHeal': 'ITEM_FULL_HEAL',
  'MeteorFalls_1F_1R_EventScript_ItemMoonStone': 'ITEM_MOON_STONE',
  'MeteorFalls_1F_1R_EventScript_ItemPPUP': 'ITEM_PP_UP',
  'MeteorFalls_B1F_2R_EventScript_ItemTMDragonClaw': 'ITEM_TM02',

  // New Mauville
  'NewMauville_Inside_EventScript_ItemUltraBall': 'ITEM_ULTRA_BALL',
  'NewMauville_Inside_EventScript_ItemEscapeRope': 'ITEM_ESCAPE_ROPE',
  'NewMauville_Inside_EventScript_ItemThunderStone': 'ITEM_THUNDER_STONE',
  'NewMauville_Inside_EventScript_ItemFullHeal': 'ITEM_FULL_HEAL',
  'NewMauville_Inside_EventScript_ItemParalyzeHeal': 'ITEM_PARALYZE_HEAL',

  // Abandoned Ship
  'AbandonedShip_Rooms_1F_EventScript_ItemHarborMail': 'ITEM_HARBOR_MAIL',
  'AbandonedShip_Rooms_B1F_EventScript_ItemEscapeRope': 'ITEM_ESCAPE_ROPE',
  'AbandonedShip_Rooms2_B1F_EventScript_ItemDiveBall': 'ITEM_DIVE_BALL',
  'AbandonedShip_Room_B1F_EventScript_ItemTMIceBeam': 'ITEM_TM13',
  'AbandonedShip_Rooms2_1F_EventScript_ItemRevive': 'ITEM_REVIVE',
  'AbandonedShip_CaptainsOffice_EventScript_ItemStorageKey': 'ITEM_STORAGE_KEY',
  'AbandonedShip_HiddenFloorRooms_EventScript_ItemLuxuryBall': 'ITEM_LUXURY_BALL',
  'AbandonedShip_HiddenFloorRooms_EventScript_ItemScanner': 'ITEM_SCANNER',
  'AbandonedShip_HiddenFloorRooms_EventScript_ItemWaterStone': 'ITEM_WATER_STONE',
  'AbandonedShip_HiddenFloorRooms_EventScript_ItemTMRainDance': 'ITEM_TM18',

  // Scorched Slab
  'ScorchedSlab_EventScript_ItemTMSunnyDay': 'ITEM_TM11',

  // Safari Zone
  'SafariZone_Northwest_EventScript_ItemTMSolarBeam': 'ITEM_TM22',
  'SafariZone_North_EventScript_ItemCalcium': 'ITEM_CALCIUM',
  'SafariZone_Southwest_EventScript_ItemMaxRevive': 'ITEM_MAX_REVIVE',
  'SafariZone_Northeast_EventScript_ItemNugget': 'ITEM_NUGGET',
  'SafariZone_Southeast_EventScript_ItemBigPearl': 'ITEM_BIG_PEARL',

  // Mt. Pyre
  'MtPyre_2F_EventScript_ItemUltraBall': 'ITEM_ULTRA_BALL',
  'MtPyre_3F_EventScript_ItemSuperRepel': 'ITEM_SUPER_REPEL',
  'MtPyre_4F_EventScript_ItemSeaIncense': 'ITEM_SEA_INCENSE',
  'MtPyre_5F_EventScript_ItemLaxIncense': 'ITEM_LAX_INCENSE',
  'MtPyre_6F_EventScript_ItemTMShadowBall': 'ITEM_TM30',
  'MtPyre_Exterior_EventScript_ItemMaxPotion': 'ITEM_MAX_POTION',
  'MtPyre_Exterior_EventScript_ItemTMSkillSwap': 'ITEM_TM48',

  // Aqua Hideout
  'AquaHideout_B1F_EventScript_ItemMasterBall': 'ITEM_MASTER_BALL',
  'AquaHideout_B1F_EventScript_ItemNugget': 'ITEM_NUGGET',
  'AquaHideout_B1F_EventScript_ItemMaxElixir': 'ITEM_MAX_ELIXIR',
  'AquaHideout_B2F_EventScript_ItemNestBall': 'ITEM_NEST_BALL',
  'AquaHideout_B2F_EventScript_ItemMasterBall': 'ITEM_MASTER_BALL',

  // Shoal Cave
  'ShoalCave_LowTideEntranceRoom_EventScript_ItemBigPearl': 'ITEM_BIG_PEARL',
  'ShoalCave_LowTideInnerRoom_EventScript_ItemRareCandy': 'ITEM_RARE_CANDY',
  'ShoalCave_LowTideStairsRoom_EventScript_ItemIceHeal': 'ITEM_ICE_HEAL',
  'ShoalCave_LowTideIceRoom_EventScript_ItemTMHail': 'ITEM_TM07',
  'ShoalCave_LowTideIceRoom_EventScript_ItemNeverMeltIce': 'ITEM_NEVER_MELT_ICE',

  // Seafloor Cavern
  'SeafloorCavern_Room9_EventScript_ItemTMEarthquake': 'ITEM_TM26',

  // Trick House
  'Route110_TrickHousePuzzle1_EventScript_ItemOrangeMail': 'ITEM_ORANGE_MAIL',
  'Route110_TrickHousePuzzle2_EventScript_ItemHarborMail': 'ITEM_HARBOR_MAIL',
  'Route110_TrickHousePuzzle2_EventScript_ItemWaveMail': 'ITEM_WAVE_MAIL',
  'Route110_TrickHousePuzzle3_EventScript_ItemShadowMail': 'ITEM_SHADOW_MAIL',
  'Route110_TrickHousePuzzle3_EventScript_ItemWoodMail': 'ITEM_WOOD_MAIL',
  'Route110_TrickHousePuzzle4_EventScript_ItemMechMail': 'ITEM_MECH_MAIL',
  'Route110_TrickHousePuzzle6_EventScript_ItemGlitterMail': 'ITEM_GLITTER_MAIL',
  'Route110_TrickHousePuzzle7_EventScript_ItemTropicMail': 'ITEM_TROPIC_MAIL',
  'Route110_TrickHousePuzzle8_EventScript_ItemBeadMail': 'ITEM_BEAD_MAIL',

  // Victory Road
  'VictoryRoad_1F_EventScript_ItemMaxElixir': 'ITEM_MAX_ELIXIR',
  'VictoryRoad_1F_EventScript_ItemPPUp': 'ITEM_PP_UP',
  'VictoryRoad_B1F_EventScript_ItemTMPsychic': 'ITEM_TM29',
  'VictoryRoad_B1F_EventScript_ItemFullRestore': 'ITEM_FULL_RESTORE',
  'VictoryRoad_B2F_EventScript_ItemFullHeal': 'ITEM_FULL_HEAL',

  // Artisan Cave
  'ArtisanCave_B1F_EventScript_ItemHPUp': 'ITEM_HP_UP',
  'ArtisanCave_1F_EventScript_ItemCarbos': 'ITEM_CARBOS',

  // Magma Hideout
  'MagmaHideout_1F_EventScript_ItemRareCandy': 'ITEM_RARE_CANDY',
  'MagmaHideout_2F_2R_EventScript_ItemMaxElixir': 'ITEM_MAX_ELIXIR',
  'MagmaHideout_2F_2R_EventScript_ItemFullRestore': 'ITEM_FULL_RESTORE',
  'MagmaHideout_3F_1R_EventScript_ItemNugget': 'ITEM_NUGGET',
  'MagmaHideout_3F_2R_EventScript_ItemPPMax': 'ITEM_PP_MAX',
  'MagmaHideout_4F_EventScript_ItemMaxRevive': 'ITEM_MAX_REVIVE',
  'MagmaHideout_3F_3R_EventScript_ItemEscapeRope': 'ITEM_ESCAPE_ROPE',
};

/**
 * Get item ID from a script name
 * @param scriptName The script name from the map JSON (e.g., "Route102_EventScript_ItemPotion")
 * @returns The item ID or null if not found
 */
export function getItemIdFromScript(scriptName: string): number | null {
  const itemConst = SCRIPT_TO_ITEM_CONST[scriptName];
  if (!itemConst) {
    // Try to parse the item name from the script name as fallback
    // Pattern: *_EventScript_Item* -> ITEM_*
    const match = scriptName.match(/_EventScript_Item(.+)$/);
    if (match) {
      const itemName = match[1];
      // Convert PascalCase to SCREAMING_SNAKE_CASE
      const snakeCase = itemName
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase()
        .replace(/^_/, '');
      const fallbackConst = `ITEM_${snakeCase}`;
      const fallbackId = ITEMS[fallbackConst];
      if (fallbackId !== undefined) {
        return fallbackId;
      }
    }
    return null;
  }
  return ITEMS[itemConst] ?? null;
}

/**
 * Check if a script name is an item ball script
 */
export function isItemBallScript(scriptName: string): boolean {
  return scriptName.includes('_EventScript_Item');
}
