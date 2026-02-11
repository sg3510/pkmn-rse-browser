/**
 * Gen3 layout profiles for native save parsing.
 *
 * References:
 * - public/pokeemerald/include/global.h
 * - docs/systems/save/gen3-native-field-reference.md
 */

import { SAVEBLOCK1, SAVEBLOCK2, SECTION_SIZES } from './Gen3Constants.ts';

export type SaveLayoutId = string;
type SaveBlock1Layout = { [K in keyof typeof SAVEBLOCK1]: number };
type SaveBlock2Layout = { [K in keyof typeof SAVEBLOCK2]: number };
type SaveSanityFlagKey = 'FLAG_ADVENTURE_STARTED' | 'FLAG_SYS_POKEMON_GET' | 'FLAG_SYS_POKEDEX_GET';
type SaveSanityVarKey =
  | 'VAR_STARTER_MON'
  | 'VAR_LITTLEROOT_TOWN_STATE'
  | 'VAR_ROUTE101_STATE'
  | 'VAR_BIRCH_LAB_STATE'
  | 'VAR_LITTLEROOT_INTRO_STATE';

export interface SaveLayoutSanityConfig {
  keyFlagIds?: Partial<Record<SaveSanityFlagKey, number>>;
  keyVarIds?: Partial<Record<SaveSanityVarKey, number>>;
}

export interface SaveLayoutProfile {
  id: SaveLayoutId;
  game: 'E' | 'RS';
  displayName: string;
  encryption: 'xor' | 'none';
  sectionSizes: Record<number, number>;
  saveBlock1: SaveBlock1Layout;
  saveBlock2: SaveBlock2Layout;
  source?: 'builtin' | 'custom';
  supportLevel?: 'stable' | 'experimental';
  flagAliases?: Record<string, number>;
  sanityConfig?: SaveLayoutSanityConfig;
}

export interface SaveLayoutProfileOverride {
  id: SaveLayoutId;
  baseProfileId: SaveLayoutId;
  displayName?: string;
  game?: 'E' | 'RS';
  encryption?: 'xor' | 'none';
  sectionSizes?: Partial<Record<number, number>>;
  saveBlock1?: Partial<SaveBlock1Layout>;
  saveBlock2?: Partial<SaveBlock2Layout>;
  source?: 'builtin' | 'custom';
  supportLevel?: 'stable' | 'experimental';
  flagAliases?: Record<string, number>;
  sanityConfig?: SaveLayoutSanityConfig;
}

const EMERALD_PROFILE: SaveLayoutProfile = {
  id: 'emerald_vanilla',
  game: 'E',
  displayName: 'Pokemon Emerald (vanilla)',
  encryption: 'xor',
  sectionSizes: { ...SECTION_SIZES },
  saveBlock1: { ...SAVEBLOCK1 },
  saveBlock2: { ...SAVEBLOCK2 },
  source: 'builtin',
  supportLevel: 'stable',
};

// RS diverges at several SaveBlock1 offsets (especially bag pocket blocks).
const RUBY_SAPPHIRE_PROFILE: SaveLayoutProfile = {
  id: 'ruby_sapphire_vanilla',
  game: 'RS',
  displayName: 'Pokemon Ruby/Sapphire (vanilla)',
  encryption: 'none',
  sectionSizes: { ...SECTION_SIZES },
  saveBlock1: {
    ...SAVEBLOCK1,
    BAG_KEY_ITEMS: 0x5B0,
    BAG_POKE_BALLS: 0x600,
    BAG_TM_HM: 0x640,
    BAG_BERRIES: 0x740,
  },
  saveBlock2: { ...SAVEBLOCK2 },
  source: 'builtin',
  supportLevel: 'stable',
};

/**
 * Emerald Legacy 6.0.4 save layout (as documented by PKHeX Emerald Legacy support).
 *
 * References:
 * - /tmp/PKHeX-EmeraldLegacy/PKHeX.Core/Saves/SAV3E.cs
 *   - Event flags/work offsets:
 *     EventFlag = 0x13D8
 *     EventWork = 0x1504
 *   - Bag pocket offsets:
 *     KeyItems = 0x0740
 *     Balls    = 0x07B8
 *     TM/HM    = 0x07F8
 *     Berries  = 0x08F8
 *
 * Note:
 * - System menu flags in Legacy saves do not align with vanilla IDs in our flag map.
 *   `flagAliases` projects the known Legacy IDs onto canonical runtime names so
 *   menu gating and scripts keep working.
 */
const EMERALD_LEGACY_604_PROFILE: SaveLayoutProfile = {
  id: 'emerald_legacy_604',
  game: 'E',
  displayName: 'Pokemon Emerald Legacy 6.0.4',
  encryption: 'xor',
  sectionSizes: { ...SECTION_SIZES },
  saveBlock1: {
    ...SAVEBLOCK1,
    BAG_KEY_ITEMS: 0x740,
    BAG_POKE_BALLS: 0x7B8,
    BAG_TM_HM: 0x7F8,
    BAG_BERRIES: 0x8F8,
    FLAGS: 0x13D8,
    VARS: 0x1504,
    GAME_STATS: 0x1704,
  },
  saveBlock2: { ...SAVEBLOCK2 },
  source: 'builtin',
  supportLevel: 'experimental',
  // Legacy system flags shift in this profile; map them to canonical names for runtime.
  flagAliases: {
    FLAG_SYS_POKEMON_GET: 0x857,
    FLAG_SYS_POKEDEX_GET: 0x85A,
    FLAG_SYS_POKENAV_GET: 0x85C,
  },
  sanityConfig: {
    keyFlagIds: {
      FLAG_ADVENTURE_STARTED: 0x74,
      FLAG_SYS_POKEMON_GET: 0x857,
      FLAG_SYS_POKEDEX_GET: 0x85A,
    },
  },
};

export const BUILTIN_SAVE_LAYOUT_PROFILES: readonly SaveLayoutProfile[] = [
  EMERALD_PROFILE,
  RUBY_SAPPHIRE_PROFILE,
  EMERALD_LEGACY_604_PROFILE,
];

export const SAVE_LAYOUT_PROFILES: readonly SaveLayoutProfile[] = BUILTIN_SAVE_LAYOUT_PROFILES;

export const SAVE_LAYOUT_PROFILE_BY_ID: ReadonlyMap<SaveLayoutId, SaveLayoutProfile> = new Map(
  BUILTIN_SAVE_LAYOUT_PROFILES.map((profile) => [profile.id, profile])
);

export function buildSaveLayoutProfile(
  override: SaveLayoutProfileOverride,
  baseProfiles: readonly SaveLayoutProfile[] = BUILTIN_SAVE_LAYOUT_PROFILES
): SaveLayoutProfile {
  const baseProfile = baseProfiles.find((profile) => profile.id === override.baseProfileId);
  if (!baseProfile) {
    throw new Error(`Unknown base layout profile: ${override.baseProfileId}`);
  }

  return {
    id: override.id,
    game: override.game ?? baseProfile.game,
    displayName: override.displayName ?? `${baseProfile.displayName} (override)`,
    encryption: override.encryption ?? baseProfile.encryption,
    sectionSizes: { ...baseProfile.sectionSizes, ...(override.sectionSizes ?? {}) },
    saveBlock1: { ...baseProfile.saveBlock1, ...(override.saveBlock1 ?? {}) },
    saveBlock2: { ...baseProfile.saveBlock2, ...(override.saveBlock2 ?? {}) },
    source: override.source ?? 'custom',
    supportLevel: override.supportLevel ?? 'experimental',
    flagAliases: { ...(baseProfile.flagAliases ?? {}), ...(override.flagAliases ?? {}) },
    sanityConfig: {
      keyFlagIds: { ...(baseProfile.sanityConfig?.keyFlagIds ?? {}), ...(override.sanityConfig?.keyFlagIds ?? {}) },
      keyVarIds: { ...(baseProfile.sanityConfig?.keyVarIds ?? {}), ...(override.sanityConfig?.keyVarIds ?? {}) },
    },
  };
}

export function buildSaveLayoutProfiles(
  overrides: readonly SaveLayoutProfileOverride[],
  baseProfiles: readonly SaveLayoutProfile[] = BUILTIN_SAVE_LAYOUT_PROFILES
): SaveLayoutProfile[] {
  const resolvedProfiles = [...baseProfiles];

  for (const override of overrides) {
    const profile = buildSaveLayoutProfile(override, resolvedProfiles);
    const existingIdx = resolvedProfiles.findIndex((candidate) => candidate.id === profile.id);
    if (existingIdx >= 0) {
      resolvedProfiles[existingIdx] = profile;
    } else {
      resolvedProfiles.push(profile);
    }
  }

  return resolvedProfiles;
}

export function mergeSaveLayoutProfiles(
  customProfiles: readonly SaveLayoutProfile[],
  baseProfiles: readonly SaveLayoutProfile[] = BUILTIN_SAVE_LAYOUT_PROFILES
): SaveLayoutProfile[] {
  if (customProfiles.length === 0) {
    return [...baseProfiles];
  }

  const merged = new Map<SaveLayoutId, SaveLayoutProfile>();
  for (const profile of baseProfiles) {
    merged.set(profile.id, profile);
  }
  for (const profile of customProfiles) {
    merged.set(profile.id, profile);
  }

  return Array.from(merged.values());
}
