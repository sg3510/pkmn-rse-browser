/**
 * Gen3 Pokemon Parser
 *
 * Parses Pokemon data from GBA save files.
 * Handles decryption and substruct shuffling.
 *
 * Structure:
 * - BoxPokemon (80 bytes): Base Pokemon data, stored in PC
 * - PartyPokemon (100 bytes): BoxPokemon + battle stats, stored in party
 *
 * Encryption:
 * - 48 bytes of data are XOR'd with (personality ^ otId)
 * - Data is split into 4 substructs of 12 bytes each
 * - Substruct order is shuffled based on personality % 24
 */

import { POKEMON, SAVEBLOCK1, SECTION_SIZES } from './Gen3Constants.ts';
import { decodeGen3String } from './Gen3Charset.ts';
import type { BoxPokemon, PartyPokemon, IVs, EVs } from '../../pokemon/types.ts';
import { createEmptyRibbons } from '../../pokemon/types.ts';

// ============================================================================
// Substruct Order Table
// ============================================================================

/**
 * The 24 possible substruct orders based on personality % 24
 * G = Growth, A = Attacks, E = EVs/Condition, M = Miscellaneous
 * Each array contains the order: [posOfG, posOfA, posOfE, posOfM]
 * Where position 0-3 maps to substructs in the encrypted data
 */
const SUBSTRUCT_ORDERS: readonly [number, number, number, number][] = [
  [0, 1, 2, 3], // 0:  GAEM
  [0, 1, 3, 2], // 1:  GAME
  [0, 2, 1, 3], // 2:  GEAM
  [0, 3, 1, 2], // 3:  GEMA
  [0, 2, 3, 1], // 4:  GEMA
  [0, 3, 2, 1], // 5:  GMEA
  [1, 0, 2, 3], // 6:  AGEM
  [1, 0, 3, 2], // 7:  AGME
  [2, 0, 1, 3], // 8:  EGAM
  [3, 0, 1, 2], // 9:  MGAE
  [2, 0, 3, 1], // 10: EGMA
  [3, 0, 2, 1], // 11: MGEA
  [1, 2, 0, 3], // 12: AEGM
  [1, 3, 0, 2], // 13: AMGE
  [2, 1, 0, 3], // 14: EAGM
  [3, 1, 0, 2], // 15: MAGE
  [2, 3, 0, 1], // 16: EMGA
  [3, 2, 0, 1], // 17: MEGA
  [1, 2, 3, 0], // 18: AEMG
  [1, 3, 2, 0], // 19: AMEG
  [2, 1, 3, 0], // 20: EAMG
  [3, 1, 2, 0], // 21: MAEG
  [2, 3, 1, 0], // 22: EMAG
  [3, 2, 1, 0], // 23: MEAG
];

/**
 * Get substruct positions for a given personality value
 * Returns [growthPos, attacksPos, evsPos, miscPos]
 */
function getSubstructOrder(personality: number): [number, number, number, number] {
  const index = personality % 24;
  return [...SUBSTRUCT_ORDERS[index]] as [number, number, number, number];
}

// ============================================================================
// Decryption
// ============================================================================

/**
 * Decrypt the 48-byte encrypted data block
 * XOR each 32-bit word with (personality ^ otId)
 */
function decryptData(encrypted: Uint8Array, personality: number, otId: number): Uint8Array {
  const key = (personality ^ otId) >>> 0; // Ensure unsigned 32-bit
  const decrypted = new Uint8Array(48);
  const view = new DataView(encrypted.buffer, encrypted.byteOffset, 48);
  const outView = new DataView(decrypted.buffer);

  for (let i = 0; i < 48; i += 4) {
    const word = view.getUint32(i, true);
    const decryptedWord = (word ^ key) >>> 0;
    outView.setUint32(i, decryptedWord, true);
  }

  return decrypted;
}

// ============================================================================
// Substruct Parsers
// ============================================================================

interface GrowthSubstruct {
  species: number;
  heldItem: number;
  experience: number;
  ppBonuses: number;
  friendship: number;
}

interface AttacksSubstruct {
  moves: [number, number, number, number];
  pp: [number, number, number, number];
}

interface EVsSubstruct {
  evs: EVs;
  contest: {
    cool: number;
    beauty: number;
    cute: number;
    smart: number;
    tough: number;
    sheen: number;
  };
}

interface MiscSubstruct {
  pokerus: number;
  metLocation: number;
  origins: number; // Packed: metLevel, metGame, pokeball, otGender
  ivsEggAbility: number; // Packed: IVs (30 bits), egg (1 bit), ability (1 bit)
  ribbons: number;
}

function parseGrowthSubstruct(data: Uint8Array, offset: number): GrowthSubstruct {
  const view = new DataView(data.buffer, data.byteOffset + offset, 12);
  return {
    species: view.getUint16(0, true),
    heldItem: view.getUint16(2, true),
    experience: view.getUint32(4, true),
    ppBonuses: view.getUint8(8),
    friendship: view.getUint8(9),
    // 2 bytes padding
  };
}

function parseAttacksSubstruct(data: Uint8Array, offset: number): AttacksSubstruct {
  const view = new DataView(data.buffer, data.byteOffset + offset, 12);
  return {
    moves: [
      view.getUint16(0, true),
      view.getUint16(2, true),
      view.getUint16(4, true),
      view.getUint16(6, true),
    ],
    pp: [
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11),
    ],
  };
}

function parseEVsSubstruct(data: Uint8Array, offset: number): EVsSubstruct {
  const view = new DataView(data.buffer, data.byteOffset + offset, 12);
  return {
    evs: {
      hp: view.getUint8(0),
      attack: view.getUint8(1),
      defense: view.getUint8(2),
      speed: view.getUint8(3),
      spAttack: view.getUint8(4),
      spDefense: view.getUint8(5),
    },
    contest: {
      cool: view.getUint8(6),
      beauty: view.getUint8(7),
      cute: view.getUint8(8),
      smart: view.getUint8(9),
      tough: view.getUint8(10),
      sheen: view.getUint8(11),
    },
  };
}

function parseMiscSubstruct(data: Uint8Array, offset: number): MiscSubstruct {
  const view = new DataView(data.buffer, data.byteOffset + offset, 12);
  return {
    pokerus: view.getUint8(0),
    metLocation: view.getUint8(1),
    origins: view.getUint16(2, true),
    ivsEggAbility: view.getUint32(4, true),
    ribbons: view.getUint32(8, true),
  };
}

/**
 * Extract IVs from the packed ivsEggAbility field
 * Bits 0-4: HP IV
 * Bits 5-9: Attack IV
 * Bits 10-14: Defense IV
 * Bits 15-19: Speed IV
 * Bits 20-24: Sp.Attack IV
 * Bits 25-29: Sp.Defense IV
 * Bit 30: isEgg
 * Bit 31: abilityNum
 */
function extractIVs(packed: number): IVs {
  return {
    hp: packed & 0x1F,
    attack: (packed >> 5) & 0x1F,
    defense: (packed >> 10) & 0x1F,
    speed: (packed >> 15) & 0x1F,
    spAttack: (packed >> 20) & 0x1F,
    spDefense: (packed >> 25) & 0x1F,
  };
}

/**
 * Extract origin info from packed origins field
 * Bits 0-6: Met level (0-127)
 * Bits 7-10: Game of origin
 * Bits 11-14: Poke Ball
 * Bit 15: OT gender (0=male, 1=female)
 */
function extractOrigins(packed: number): {
  metLevel: number;
  metGame: number;
  pokeball: number;
  otGender: 'male' | 'female';
} {
  return {
    metLevel: packed & 0x7F,
    metGame: (packed >> 7) & 0xF,
    pokeball: (packed >> 11) & 0xF,
    otGender: ((packed >> 15) & 1) === 0 ? 'male' : 'female',
  };
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a BoxPokemon (80 bytes) from raw data
 */
export function parseBoxPokemon(data: DataView, offset: number): BoxPokemon | null {
  // Read unencrypted header
  const personality = data.getUint32(offset + 0, true);
  const otId = data.getUint32(offset + 4, true);

  // Empty slot check - all zeros means empty
  if (personality === 0 && otId === 0) {
    return null;
  }

  // Read nickname (10 bytes)
  const nicknameBytes = new Uint8Array(data.buffer, data.byteOffset + offset + 8, 10);
  const nickname = decodeGen3String(nicknameBytes);

  // Language (2 bytes at offset 18)
  const language = data.getUint16(offset + 18, true);

  // OT name (7 bytes at offset 20)
  const otNameBytes = new Uint8Array(data.buffer, data.byteOffset + offset + 20, 7);
  const otName = decodeGen3String(otNameBytes);

  // Markings (1 byte at offset 27)
  const markingsByte = data.getUint8(offset + 27);

  // Checksum (2 bytes at offset 28)
  // const checksum = data.getUint16(offset + 28, true);

  // Padding (2 bytes at offset 30)

  // Extract and decrypt the 48-byte encrypted data (offset 32)
  const encryptedData = new Uint8Array(data.buffer, data.byteOffset + offset + 32, 48);
  const decryptedData = decryptData(encryptedData, personality, otId);

  // Get substruct order
  const [gPos, aPos, ePos, mPos] = getSubstructOrder(personality);

  // Parse substructs (each is 12 bytes)
  const growth = parseGrowthSubstruct(decryptedData, gPos * 12);
  const attacks = parseAttacksSubstruct(decryptedData, aPos * 12);
  const evs = parseEVsSubstruct(decryptedData, ePos * 12);
  const misc = parseMiscSubstruct(decryptedData, mPos * 12);

  // Check for bad egg (species 0 or invalid)
  if (growth.species === 0 || growth.species > 411) {
    // Possibly a bad egg or corrupted data
    console.warn(`[Gen3Pokemon] Invalid species ${growth.species} at offset ${offset}`);
  }

  // Extract packed values
  const ivs = extractIVs(misc.ivsEggAbility);
  const isEgg = ((misc.ivsEggAbility >> 30) & 1) === 1;
  const abilityNum = ((misc.ivsEggAbility >> 31) & 1) as 0 | 1;
  const origins = extractOrigins(misc.origins);

  // Parse markings
  const markings = {
    circle: (markingsByte & 1) !== 0,
    square: (markingsByte & 2) !== 0,
    triangle: (markingsByte & 4) !== 0,
    heart: (markingsByte & 8) !== 0,
  };

  // Parse pokerus
  const pokerus = {
    strain: (misc.pokerus >> 4) & 0xF,
    days: misc.pokerus & 0xF,
  };

  // Build BoxPokemon
  return {
    personality,
    otId,
    species: growth.species,
    nickname: nickname || null,
    otName,
    language,
    heldItem: growth.heldItem,
    experience: growth.experience,
    friendship: growth.friendship,
    moves: attacks.moves,
    pp: attacks.pp,
    ppBonuses: growth.ppBonuses,
    ivs,
    evs: evs.evs,
    isEgg,
    isBadEgg: growth.species === 0,
    abilityNum,
    metLocation: misc.metLocation,
    metLevel: origins.metLevel,
    metGame: origins.metGame,
    pokeball: origins.pokeball,
    otGender: origins.otGender,
    pokerus,
    contest: evs.contest,
    markings,
    ribbons: createEmptyRibbons(), // TODO: Parse ribbons from misc.ribbons
    fatefulEncounter: false, // TODO: Extract from origins
  };
}

/**
 * Parse a PartyPokemon (100 bytes) from raw data
 * PartyPokemon = BoxPokemon (80 bytes) + battle stats (20 bytes)
 */
export function parsePartyPokemon(data: DataView, offset: number): PartyPokemon | null {
  // Parse base BoxPokemon
  const boxPokemon = parseBoxPokemon(data, offset);
  if (!boxPokemon) {
    return null;
  }

  // Read party-specific data (offset 80-99)
  const status = data.getUint32(offset + 80, true);
  const level = data.getUint8(offset + 84);
  const mailId = data.getUint8(offset + 85); // Pokérus remaining / mail ID
  const currentHp = data.getUint16(offset + 86, true);
  const maxHp = data.getUint16(offset + 88, true);
  const attack = data.getUint16(offset + 90, true);
  const defense = data.getUint16(offset + 92, true);
  const speed = data.getUint16(offset + 94, true);
  const spAttack = data.getUint16(offset + 96, true);
  const spDefense = data.getUint16(offset + 98, true);

  return {
    ...boxPokemon,
    level,
    status,
    stats: {
      hp: currentHp,
      maxHp,
      attack,
      defense,
      speed,
      spAttack,
      spDefense,
    },
    mail: mailId > 0 ? mailId : null,
  };
}

// ============================================================================
// Party/PC Parsing Helpers
// ============================================================================

/**
 * Section map type from Gen3SaveParser
 */
type SectionMap = Map<number, number>;

/**
 * Read data from SaveBlock1 accounting for section boundaries
 * SaveBlock1 spans sections 1-4
 */
function readSaveBlock1Data(
  data: DataView,
  sectionMap: SectionMap,
  offset: number,
  length: number
): Uint8Array | null {
  const result = new Uint8Array(length);
  let remaining = length;
  let resultOffset = 0;
  let currentOffset = offset;

  // Determine starting section
  let sectionId = 1;
  let sectionStart = 0;

  while (sectionId <= 4) {
    const sectionSize = SECTION_SIZES[sectionId];
    if (currentOffset < sectionStart + sectionSize) {
      break;
    }
    sectionStart += sectionSize;
    sectionId++;
  }

  // Read across sections
  while (remaining > 0 && sectionId <= 4) {
    const sectorOffset = sectionMap.get(sectionId);
    if (sectorOffset === undefined) {
      console.error(`[Gen3Pokemon] Missing section ${sectionId}`);
      return null;
    }

    const sectionSize = SECTION_SIZES[sectionId];
    const offsetInSection = currentOffset - sectionStart;
    const availableInSection = sectionSize - offsetInSection;
    const toRead = Math.min(remaining, availableInSection);

    // Copy data from this section
    const sectorData = new Uint8Array(
      data.buffer,
      data.byteOffset + sectorOffset + offsetInSection,
      toRead
    );
    result.set(sectorData, resultOffset);

    resultOffset += toRead;
    remaining -= toRead;
    currentOffset += toRead;
    sectionStart += sectionSize;
    sectionId++;
  }

  return remaining === 0 ? result : null;
}

/**
 * Parse the player's party from SaveBlock1
 */
export function parseParty(data: DataView, sectionMap: SectionMap): PartyPokemon[] {
  const party: PartyPokemon[] = [];

  // Read party count (4 bytes at offset 0x234 in SaveBlock1)
  const countData = readSaveBlock1Data(data, sectionMap, SAVEBLOCK1.PARTY_COUNT, 4);
  if (!countData) {
    console.error('[Gen3Pokemon] Failed to read party count');
    return party;
  }
  const countView = new DataView(countData.buffer);
  const partyCount = Math.min(countView.getUint32(0, true), 6);

  console.log(`[Gen3Pokemon] Party count: ${partyCount}`);

  // Read each party Pokemon (100 bytes each at offset 0x238)
  for (let i = 0; i < partyCount; i++) {
    const pokemonOffset = SAVEBLOCK1.PARTY_DATA + i * POKEMON.PARTY_SIZE;
    const pokemonData = readSaveBlock1Data(data, sectionMap, pokemonOffset, POKEMON.PARTY_SIZE);

    if (!pokemonData) {
      console.error(`[Gen3Pokemon] Failed to read party Pokemon ${i}`);
      continue;
    }

    const pokemonView = new DataView(pokemonData.buffer);
    const pokemon = parsePartyPokemon(pokemonView, 0);

    if (pokemon) {
      console.log(`[Gen3Pokemon] Parsed party slot ${i}: ${pokemon.species} Lv.${pokemon.level}`);
      party.push(pokemon);
    }
  }

  return party;
}

/**
 * Check if a Pokemon slot is empty
 */
export function isPokemonEmpty(data: DataView, offset: number): boolean {
  const personality = data.getUint32(offset, true);
  const otId = data.getUint32(offset + 4, true);
  return personality === 0 && otId === 0;
}
