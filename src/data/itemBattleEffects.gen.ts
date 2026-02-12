// Auto-generated — do not edit
// Source: public/pokeemerald/src/data/items.h + hold_effects.h
// Regenerate: node scripts/generate-item-battle-effects.cjs

/** Hold effect constants from hold_effects.h */
export const HOLD_EFFECTS = {
  HOLD_EFFECT_NONE: 0,
  HOLD_EFFECT_RESTORE_HP: 1,
  HOLD_EFFECT_CURE_PAR: 2,
  HOLD_EFFECT_CURE_SLP: 3,
  HOLD_EFFECT_CURE_PSN: 4,
  HOLD_EFFECT_CURE_BRN: 5,
  HOLD_EFFECT_CURE_FRZ: 6,
  HOLD_EFFECT_RESTORE_PP: 7,
  HOLD_EFFECT_CURE_CONFUSION: 8,
  HOLD_EFFECT_CURE_STATUS: 9,
  HOLD_EFFECT_CONFUSE_SPICY: 10,
  HOLD_EFFECT_CONFUSE_DRY: 11,
  HOLD_EFFECT_CONFUSE_SWEET: 12,
  HOLD_EFFECT_CONFUSE_BITTER: 13,
  HOLD_EFFECT_CONFUSE_SOUR: 14,
  HOLD_EFFECT_ATTACK_UP: 15,
  HOLD_EFFECT_DEFENSE_UP: 16,
  HOLD_EFFECT_SPEED_UP: 17,
  HOLD_EFFECT_SP_ATTACK_UP: 18,
  HOLD_EFFECT_SP_DEFENSE_UP: 19,
  HOLD_EFFECT_CRITICAL_UP: 20,
  HOLD_EFFECT_RANDOM_STAT_UP: 21,
  HOLD_EFFECT_EVASION_UP: 22,
  HOLD_EFFECT_RESTORE_STATS: 23,
  HOLD_EFFECT_MACHO_BRACE: 24,
  HOLD_EFFECT_EXP_SHARE: 25,
  HOLD_EFFECT_QUICK_CLAW: 26,
  HOLD_EFFECT_FRIENDSHIP_UP: 27,
  HOLD_EFFECT_CURE_ATTRACT: 28,
  HOLD_EFFECT_CHOICE_BAND: 29,
  HOLD_EFFECT_FLINCH: 30,
  HOLD_EFFECT_BUG_POWER: 31,
  HOLD_EFFECT_DOUBLE_PRIZE: 32,
  HOLD_EFFECT_REPEL: 33,
  HOLD_EFFECT_SOUL_DEW: 34,
  HOLD_EFFECT_DEEP_SEA_TOOTH: 35,
  HOLD_EFFECT_DEEP_SEA_SCALE: 36,
  HOLD_EFFECT_CAN_ALWAYS_RUN: 37,
  HOLD_EFFECT_PREVENT_EVOLVE: 38,
  HOLD_EFFECT_FOCUS_BAND: 39,
  HOLD_EFFECT_LUCKY_EGG: 40,
  HOLD_EFFECT_SCOPE_LENS: 41,
  HOLD_EFFECT_STEEL_POWER: 42,
  HOLD_EFFECT_LEFTOVERS: 43,
  HOLD_EFFECT_DRAGON_SCALE: 44,
  HOLD_EFFECT_LIGHT_BALL: 45,
  HOLD_EFFECT_GROUND_POWER: 46,
  HOLD_EFFECT_ROCK_POWER: 47,
  HOLD_EFFECT_GRASS_POWER: 48,
  HOLD_EFFECT_DARK_POWER: 49,
  HOLD_EFFECT_FIGHTING_POWER: 50,
  HOLD_EFFECT_ELECTRIC_POWER: 51,
  HOLD_EFFECT_WATER_POWER: 52,
  HOLD_EFFECT_FLYING_POWER: 53,
  HOLD_EFFECT_POISON_POWER: 54,
  HOLD_EFFECT_ICE_POWER: 55,
  HOLD_EFFECT_GHOST_POWER: 56,
  HOLD_EFFECT_PSYCHIC_POWER: 57,
  HOLD_EFFECT_FIRE_POWER: 58,
  HOLD_EFFECT_DRAGON_POWER: 59,
  HOLD_EFFECT_NORMAL_POWER: 60,
  HOLD_EFFECT_UP_GRADE: 61,
  HOLD_EFFECT_SHELL_BELL: 62,
  HOLD_EFFECT_LUCKY_PUNCH: 63,
  HOLD_EFFECT_METAL_POWDER: 64,
  HOLD_EFFECT_THICK_CLUB: 65,
  HOLD_EFFECT_STICK: 66,
} as const;

export interface ItemBattleEffect {
  holdEffect: number;
  holdEffectParam: number;
  battleUsage: number;
}

/** Items with battle effects, indexed by item ID. */
export const ITEM_BATTLE_EFFECTS: Record<number, ItemBattleEffect> = {
  44: { holdEffect: 1, holdEffectParam: 20, battleUsage: 0 }, // ITEM_BERRY_JUICE — HOLD_EFFECT_RESTORE_HP
  133: { holdEffect: 2, holdEffectParam: 0, battleUsage: 0 }, // ITEM_CHERI_BERRY — HOLD_EFFECT_CURE_PAR
  134: { holdEffect: 3, holdEffectParam: 0, battleUsage: 0 }, // ITEM_CHESTO_BERRY — HOLD_EFFECT_CURE_SLP
  135: { holdEffect: 4, holdEffectParam: 0, battleUsage: 0 }, // ITEM_PECHA_BERRY — HOLD_EFFECT_CURE_PSN
  136: { holdEffect: 5, holdEffectParam: 0, battleUsage: 0 }, // ITEM_RAWST_BERRY — HOLD_EFFECT_CURE_BRN
  137: { holdEffect: 6, holdEffectParam: 0, battleUsage: 0 }, // ITEM_ASPEAR_BERRY — HOLD_EFFECT_CURE_FRZ
  138: { holdEffect: 7, holdEffectParam: 10, battleUsage: 0 }, // ITEM_LEPPA_BERRY — HOLD_EFFECT_RESTORE_PP
  139: { holdEffect: 1, holdEffectParam: 10, battleUsage: 0 }, // ITEM_ORAN_BERRY — HOLD_EFFECT_RESTORE_HP
  140: { holdEffect: 8, holdEffectParam: 0, battleUsage: 0 }, // ITEM_PERSIM_BERRY — HOLD_EFFECT_CURE_CONFUSION
  141: { holdEffect: 9, holdEffectParam: 0, battleUsage: 0 }, // ITEM_LUM_BERRY — HOLD_EFFECT_CURE_STATUS
  142: { holdEffect: 1, holdEffectParam: 30, battleUsage: 0 }, // ITEM_SITRUS_BERRY — HOLD_EFFECT_RESTORE_HP
  143: { holdEffect: 10, holdEffectParam: 8, battleUsage: 0 }, // ITEM_FIGY_BERRY — HOLD_EFFECT_CONFUSE_SPICY
  144: { holdEffect: 11, holdEffectParam: 8, battleUsage: 0 }, // ITEM_WIKI_BERRY — HOLD_EFFECT_CONFUSE_DRY
  145: { holdEffect: 12, holdEffectParam: 8, battleUsage: 0 }, // ITEM_MAGO_BERRY — HOLD_EFFECT_CONFUSE_SWEET
  146: { holdEffect: 13, holdEffectParam: 8, battleUsage: 0 }, // ITEM_AGUAV_BERRY — HOLD_EFFECT_CONFUSE_BITTER
  147: { holdEffect: 14, holdEffectParam: 8, battleUsage: 0 }, // ITEM_IAPAPA_BERRY — HOLD_EFFECT_CONFUSE_SOUR
  168: { holdEffect: 15, holdEffectParam: 4, battleUsage: 0 }, // ITEM_LIECHI_BERRY — HOLD_EFFECT_ATTACK_UP
  169: { holdEffect: 16, holdEffectParam: 4, battleUsage: 0 }, // ITEM_GANLON_BERRY — HOLD_EFFECT_DEFENSE_UP
  170: { holdEffect: 17, holdEffectParam: 4, battleUsage: 0 }, // ITEM_SALAC_BERRY — HOLD_EFFECT_SPEED_UP
  171: { holdEffect: 18, holdEffectParam: 4, battleUsage: 0 }, // ITEM_PETAYA_BERRY — HOLD_EFFECT_SP_ATTACK_UP
  172: { holdEffect: 19, holdEffectParam: 4, battleUsage: 0 }, // ITEM_APICOT_BERRY — HOLD_EFFECT_SP_DEFENSE_UP
  173: { holdEffect: 20, holdEffectParam: 4, battleUsage: 0 }, // ITEM_LANSAT_BERRY — HOLD_EFFECT_CRITICAL_UP
  174: { holdEffect: 21, holdEffectParam: 4, battleUsage: 0 }, // ITEM_STARF_BERRY — HOLD_EFFECT_RANDOM_STAT_UP
  179: { holdEffect: 22, holdEffectParam: 10, battleUsage: 0 }, // ITEM_BRIGHT_POWDER — HOLD_EFFECT_EVASION_UP
  180: { holdEffect: 23, holdEffectParam: 0, battleUsage: 0 }, // ITEM_WHITE_HERB — HOLD_EFFECT_RESTORE_STATS
  181: { holdEffect: 24, holdEffectParam: 0, battleUsage: 0 }, // ITEM_MACHO_BRACE — HOLD_EFFECT_MACHO_BRACE
  182: { holdEffect: 25, holdEffectParam: 0, battleUsage: 0 }, // ITEM_EXP_SHARE — HOLD_EFFECT_EXP_SHARE
  183: { holdEffect: 26, holdEffectParam: 20, battleUsage: 0 }, // ITEM_QUICK_CLAW — HOLD_EFFECT_QUICK_CLAW
  184: { holdEffect: 27, holdEffectParam: 0, battleUsage: 0 }, // ITEM_SOOTHE_BELL — HOLD_EFFECT_FRIENDSHIP_UP
  185: { holdEffect: 28, holdEffectParam: 0, battleUsage: 0 }, // ITEM_MENTAL_HERB — HOLD_EFFECT_CURE_ATTRACT
  186: { holdEffect: 29, holdEffectParam: 0, battleUsage: 0 }, // ITEM_CHOICE_BAND — HOLD_EFFECT_CHOICE_BAND
  187: { holdEffect: 30, holdEffectParam: 10, battleUsage: 0 }, // ITEM_KINGS_ROCK — HOLD_EFFECT_FLINCH
  188: { holdEffect: 31, holdEffectParam: 10, battleUsage: 0 }, // ITEM_SILVER_POWDER — HOLD_EFFECT_BUG_POWER
  189: { holdEffect: 32, holdEffectParam: 10, battleUsage: 0 }, // ITEM_AMULET_COIN — HOLD_EFFECT_DOUBLE_PRIZE
  190: { holdEffect: 33, holdEffectParam: 0, battleUsage: 0 }, // ITEM_CLEANSE_TAG — HOLD_EFFECT_REPEL
  191: { holdEffect: 34, holdEffectParam: 0, battleUsage: 0 }, // ITEM_SOUL_DEW — HOLD_EFFECT_SOUL_DEW
  192: { holdEffect: 35, holdEffectParam: 0, battleUsage: 0 }, // ITEM_DEEP_SEA_TOOTH — HOLD_EFFECT_DEEP_SEA_TOOTH
  193: { holdEffect: 36, holdEffectParam: 0, battleUsage: 0 }, // ITEM_DEEP_SEA_SCALE — HOLD_EFFECT_DEEP_SEA_SCALE
  194: { holdEffect: 37, holdEffectParam: 0, battleUsage: 0 }, // ITEM_SMOKE_BALL — HOLD_EFFECT_CAN_ALWAYS_RUN
  195: { holdEffect: 38, holdEffectParam: 0, battleUsage: 0 }, // ITEM_EVERSTONE — HOLD_EFFECT_PREVENT_EVOLVE
  196: { holdEffect: 39, holdEffectParam: 10, battleUsage: 0 }, // ITEM_FOCUS_BAND — HOLD_EFFECT_FOCUS_BAND
  197: { holdEffect: 40, holdEffectParam: 0, battleUsage: 0 }, // ITEM_LUCKY_EGG — HOLD_EFFECT_LUCKY_EGG
  198: { holdEffect: 41, holdEffectParam: 0, battleUsage: 0 }, // ITEM_SCOPE_LENS — HOLD_EFFECT_SCOPE_LENS
  199: { holdEffect: 42, holdEffectParam: 10, battleUsage: 0 }, // ITEM_METAL_COAT — HOLD_EFFECT_STEEL_POWER
  200: { holdEffect: 43, holdEffectParam: 10, battleUsage: 0 }, // ITEM_LEFTOVERS — HOLD_EFFECT_LEFTOVERS
  201: { holdEffect: 44, holdEffectParam: 10, battleUsage: 0 }, // ITEM_DRAGON_SCALE — HOLD_EFFECT_DRAGON_SCALE
  202: { holdEffect: 45, holdEffectParam: 0, battleUsage: 0 }, // ITEM_LIGHT_BALL — HOLD_EFFECT_LIGHT_BALL
  203: { holdEffect: 46, holdEffectParam: 10, battleUsage: 0 }, // ITEM_SOFT_SAND — HOLD_EFFECT_GROUND_POWER
  204: { holdEffect: 47, holdEffectParam: 10, battleUsage: 0 }, // ITEM_HARD_STONE — HOLD_EFFECT_ROCK_POWER
  205: { holdEffect: 48, holdEffectParam: 10, battleUsage: 0 }, // ITEM_MIRACLE_SEED — HOLD_EFFECT_GRASS_POWER
  206: { holdEffect: 49, holdEffectParam: 10, battleUsage: 0 }, // ITEM_BLACK_GLASSES — HOLD_EFFECT_DARK_POWER
  207: { holdEffect: 50, holdEffectParam: 10, battleUsage: 0 }, // ITEM_BLACK_BELT — HOLD_EFFECT_FIGHTING_POWER
  208: { holdEffect: 51, holdEffectParam: 10, battleUsage: 0 }, // ITEM_MAGNET — HOLD_EFFECT_ELECTRIC_POWER
  209: { holdEffect: 52, holdEffectParam: 10, battleUsage: 0 }, // ITEM_MYSTIC_WATER — HOLD_EFFECT_WATER_POWER
  210: { holdEffect: 53, holdEffectParam: 10, battleUsage: 0 }, // ITEM_SHARP_BEAK — HOLD_EFFECT_FLYING_POWER
  211: { holdEffect: 54, holdEffectParam: 10, battleUsage: 0 }, // ITEM_POISON_BARB — HOLD_EFFECT_POISON_POWER
  212: { holdEffect: 55, holdEffectParam: 10, battleUsage: 0 }, // ITEM_NEVER_MELT_ICE — HOLD_EFFECT_ICE_POWER
  213: { holdEffect: 56, holdEffectParam: 10, battleUsage: 0 }, // ITEM_SPELL_TAG — HOLD_EFFECT_GHOST_POWER
  214: { holdEffect: 57, holdEffectParam: 10, battleUsage: 0 }, // ITEM_TWISTED_SPOON — HOLD_EFFECT_PSYCHIC_POWER
  215: { holdEffect: 58, holdEffectParam: 10, battleUsage: 0 }, // ITEM_CHARCOAL — HOLD_EFFECT_FIRE_POWER
  216: { holdEffect: 59, holdEffectParam: 10, battleUsage: 0 }, // ITEM_DRAGON_FANG — HOLD_EFFECT_DRAGON_POWER
  217: { holdEffect: 60, holdEffectParam: 10, battleUsage: 0 }, // ITEM_SILK_SCARF — HOLD_EFFECT_NORMAL_POWER
  218: { holdEffect: 61, holdEffectParam: 0, battleUsage: 0 }, // ITEM_UP_GRADE — HOLD_EFFECT_UP_GRADE
  219: { holdEffect: 62, holdEffectParam: 8, battleUsage: 0 }, // ITEM_SHELL_BELL — HOLD_EFFECT_SHELL_BELL
  220: { holdEffect: 52, holdEffectParam: 5, battleUsage: 0 }, // ITEM_SEA_INCENSE — HOLD_EFFECT_WATER_POWER
  221: { holdEffect: 22, holdEffectParam: 5, battleUsage: 0 }, // ITEM_LAX_INCENSE — HOLD_EFFECT_EVASION_UP
  222: { holdEffect: 63, holdEffectParam: 0, battleUsage: 0 }, // ITEM_LUCKY_PUNCH — HOLD_EFFECT_LUCKY_PUNCH
  223: { holdEffect: 64, holdEffectParam: 0, battleUsage: 0 }, // ITEM_METAL_POWDER — HOLD_EFFECT_METAL_POWDER
  224: { holdEffect: 65, holdEffectParam: 0, battleUsage: 0 }, // ITEM_THICK_CLUB — HOLD_EFFECT_THICK_CLUB
  225: { holdEffect: 66, holdEffectParam: 0, battleUsage: 0 }, // ITEM_STICK — HOLD_EFFECT_STICK
};

/** Get battle effect data for an item. */
export function getItemBattleEffect(itemId: number): ItemBattleEffect | undefined {
  return ITEM_BATTLE_EFFECTS[itemId];
}

/** Check if an item can be used in battle (e.g. Potion, Pokeball). */
export function canUseInBattle(itemId: number): boolean {
  const effect = ITEM_BATTLE_EFFECTS[itemId];
  return effect !== undefined && effect.battleUsage > 0;
}
