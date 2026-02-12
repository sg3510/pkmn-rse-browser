/**
 * Gen3SaveParser - Parse Pokemon Emerald/Ruby/Sapphire .sav files
 *
 * Parses native GBA save files and converts them to our SaveData format.
 * Supports both Emerald (encrypted) and Ruby/Sapphire (unencrypted) saves.
 *
 * Save Structure:
 * - 128KB file with two 64KB slots (A and B)
 * - Each slot has 14 sectors (4KB each)
 * - Sectors rotate, so sectionId in footer maps to actual data
 * - Active slot determined by highest saveCounter
 */

import {
  SAVE_SIZE_FULL,
  SAVE_SLOT_SIZE,
  SECTOR_SIZE,
  SECTORS_PER_SLOT,
  SECTOR_DATA_SIZE,
  SECTOR_FOOTER,
  SAVE_SIGNATURE,
  SAVEBLOCK2,
  ITEM_SLOT_SIZE,
} from './Gen3Constants.ts';
import {
  SAVE_LAYOUT_PROFILES,
  type SaveLayoutProfile,
  type SaveLayoutSanityConfig,
} from './Gen3LayoutProfiles.ts';
import { decodeGen3String } from './Gen3Charset.ts';
import { mapGroupNumToMapId } from './mapResolver.ts';
import { parseParty } from './Gen3Pokemon.ts';
import { FLAG_ID_TO_NAME, VAR_ID_TO_NAME } from '../../data/flagVarMaps.gen.ts';
import type {
  SaveData,
  PlayerProfile,
  PlayTime,
  LocationState,
  WarpData,
  MoneyState,
  BagState,
  PCItemsState,
  ItemSlot,
} from '../types';
import type { PartyPokemon } from '../../pokemon/types';

/**
 * Native save metadata (preserved for round-trip export)
 */
export interface NativeMetadata {
  game: 'E' | 'RS';
  layoutProfileId: string;
  layoutDisplayName: string;
  layoutConfidence: number;
  layoutSupported: boolean;
  layoutCandidates: Array<{
    profileId: string;
    score: number;
    sanityLevel: 'high' | 'low';
    issueCount: number;
  }>;
  activeSlot: 'A' | 'B';
  saveCounter: number;
  encryptionKey: number;
  sectorOrder: number[];
  checksumFailures: number[];
  rawLength: number;
  sourceFormat: 'raw' | 'sharkport' | 'wrapped';
  rawOffset: number;
  sanity: ParseSanityReport;
  sourceFilename?: string;
}

/**
 * Sanity report for parsed vanilla-layout fields.
 * Used to guard against importing malformed/unsupported layouts.
 */
export interface ParseSanityReport {
  level: 'high' | 'low';
  issues: string[];
  flagsSetCount: number;
  nonZeroVarCount: number;
  rawPartyCount: number;
  keyFlags: {
    FLAG_ADVENTURE_STARTED: boolean;
    FLAG_SYS_POKEMON_GET: boolean;
    FLAG_SYS_POKEDEX_GET: boolean;
  };
  keyVars: {
    VAR_STARTER_MON: number;
    VAR_LITTLEROOT_TOWN_STATE: number;
    VAR_ROUTE101_STATE: number;
    VAR_BIRCH_LAB_STATE: number;
    VAR_LITTLEROOT_INTRO_STATE: number;
  };
}

/**
 * Parsed sector information
 */
interface SectorInfo {
  offset: number;
  sectionId: number;
  checksum: number;
  signature: number;
  saveCounter: number;
  checksumValid: boolean;
}

/**
 * Section map: sectionId → sector offset
 */
type SectionMap = Map<number, number>;

/**
 * Parse result from the parser
 */
export interface Gen3ParseResult {
  success: boolean;
  error?: string;
  saveData?: SaveData;
  nativeMetadata?: NativeMetadata;
}

export interface ParseGen3SaveOptions {
  layoutProfiles?: readonly SaveLayoutProfile[];
  minSupportedConfidence?: number;
  requireHighSanity?: boolean;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47];

const KEY_FLAG_IDS = {
  FLAG_ADVENTURE_STARTED: 0x74,
  FLAG_SYS_POKEMON_GET: 0x860,
  FLAG_SYS_POKEDEX_GET: 0x861,
} as const;

const KEY_VAR_IDS = {
  VAR_STARTER_MON: 0x4023,
  VAR_LITTLEROOT_TOWN_STATE: 0x4050,
  VAR_ROUTE101_STATE: 0x4060,
  VAR_BIRCH_LAB_STATE: 0x4084,
  VAR_LITTLEROOT_INTRO_STATE: 0x4092,
} as const;

interface NormalizedBufferInfo {
  buffer: ArrayBuffer;
  sourceFormat: 'raw' | 'sharkport' | 'wrapped';
  rawOffset: number;
}

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function hasSignatureStride(bytes: Uint8Array, rawOffset: number, sectors: number): boolean {
  for (let i = 0; i < sectors; i++) {
    const sigOffset = rawOffset + SECTOR_FOOTER.SIGNATURE + i * SECTOR_SIZE;
    if (sigOffset + 3 >= bytes.length) return false;
    if (
      bytes[sigOffset] !== 0x25 ||
      bytes[sigOffset + 1] !== 0x20 ||
      bytes[sigOffset + 2] !== 0x01 ||
      bytes[sigOffset + 3] !== 0x08
    ) {
      return false;
    }
  }
  return true;
}

function findFirstSignatureOffset(bytes: Uint8Array): number {
  for (let i = 0; i <= bytes.length - 4; i++) {
    if (
      bytes[i] === 0x25 &&
      bytes[i + 1] === 0x20 &&
      bytes[i + 2] === 0x01 &&
      bytes[i + 3] === 0x08
    ) {
      return i;
    }
  }
  return -1;
}

function normalizeInputBuffer(buffer: ArrayBuffer): { ok: true; info: NormalizedBufferInfo } | { ok: false; error: string } {
  const bytes = new Uint8Array(buffer);

  if (hasPrefix(bytes, PNG_SIGNATURE)) {
    return {
      ok: false,
      error: 'This file appears to be a PNG image (likely a save-state screenshot), not a Gen3 .sav file.',
    };
  }

  if (buffer.byteLength < SAVE_SLOT_SIZE) {
    return {
      ok: false,
      error: `File too small: ${buffer.byteLength} bytes (expected at least ${SAVE_SLOT_SIZE})`,
    };
  }

  // Raw flash saves are usually 128 KiB (sometimes with trailing bytes).
  if (hasSignatureStride(bytes, 0, SECTORS_PER_SLOT * 2)) {
    const normalized = buffer.byteLength > SAVE_SIZE_FULL ? buffer.slice(0, SAVE_SIZE_FULL) : buffer;
    return { ok: true, info: { buffer: normalized, sourceFormat: 'raw', rawOffset: 0 } };
  }

  // Wrapped save formats (e.g. SharkPort) prepend metadata before raw flash sectors.
  const firstSigOffset = findFirstSignatureOffset(bytes);
  if (firstSigOffset >= 0) {
    const rawOffset = firstSigOffset - SECTOR_FOOTER.SIGNATURE;
    if (rawOffset > 0 && rawOffset + SAVE_SIZE_FULL <= buffer.byteLength) {
      if (hasSignatureStride(bytes, rawOffset, SECTORS_PER_SLOT * 2)) {
        const headerText = new TextDecoder('ascii').decode(bytes.subarray(0, Math.min(64, bytes.length)));
        const sourceFormat = headerText.includes('SharkPortSave') ? 'sharkport' : 'wrapped';
        return {
          ok: true,
          info: {
            buffer: buffer.slice(rawOffset, rawOffset + SAVE_SIZE_FULL),
            sourceFormat,
            rawOffset,
          },
        };
      }
    }
  }

  // Fallback: treat as raw input and clamp trailing bytes if present.
  const normalized = buffer.byteLength > SAVE_SIZE_FULL ? buffer.slice(0, SAVE_SIZE_FULL) : buffer;
  return { ok: true, info: { buffer: normalized, sourceFormat: 'raw', rawOffset: 0 } };
}

/**
 * Calculate checksum for a sector
 * Sum of all u32 values in first 0xF80 bytes, truncated to u16
 */
function calculateChecksum(data: DataView, sectorOffset: number): number {
  let sum = 0;
  for (let i = 0; i < SECTOR_DATA_SIZE; i += 4) {
    sum += data.getUint32(sectorOffset + i, true);
  }
  return ((sum & 0xFFFF) + (sum >>> 16)) & 0xFFFF;
}

/**
 * Read sector footer information
 */
function readSectorInfo(data: DataView, sectorOffset: number): SectorInfo {
  const sectionId = data.getUint16(sectorOffset + SECTOR_FOOTER.SECTION_ID, true);
  const checksum = data.getUint16(sectorOffset + SECTOR_FOOTER.CHECKSUM, true);
  const signature = data.getUint32(sectorOffset + SECTOR_FOOTER.SIGNATURE, true);
  const saveCounter = data.getUint32(sectorOffset + SECTOR_FOOTER.SAVE_COUNTER, true);

  const calculatedChecksum = calculateChecksum(data, sectorOffset);
  const checksumValid = checksum === calculatedChecksum;

  return {
    offset: sectorOffset,
    sectionId,
    checksum,
    signature,
    saveCounter,
    checksumValid,
  };
}

/**
 * Build section map for a slot
 * Returns map of sectionId → sector offset
 */
function buildSectionMap(data: DataView, slotOffset: number): { map: SectionMap; saveCounter: number; failures: number[] } {
  const map: SectionMap = new Map();
  const failures: number[] = [];
  let saveCounter = 0;

  for (let i = 0; i < SECTORS_PER_SLOT; i++) {
    const sectorOffset = slotOffset + i * SECTOR_SIZE;
    const info = readSectorInfo(data, sectorOffset);

    // Validate signature
    if (info.signature !== SAVE_SIGNATURE) {
      continue;
    }

    // Track checksum failures
    if (!info.checksumValid) {
      failures.push(info.sectionId);
    }

    // Map sectionId to offset
    if (info.sectionId < SECTORS_PER_SLOT) {
      map.set(info.sectionId, sectorOffset);
    }

    // Track save counter from section 0
    if (info.sectionId === 0) {
      saveCounter = info.saveCounter;
    }
  }

  return { map, saveCounter, failures };
}

/**
 * Check if all main sections (0-13) are present
 */
function isSlotValid(sectionMap: SectionMap): boolean {
  for (let i = 0; i < SECTORS_PER_SLOT; i++) {
    if (!sectionMap.has(i)) {
      return false;
    }
  }
  return true;
}

/**
 * Read a warp data structure from SaveBlock1
 */
function readWarpData(
  data: DataView,
  offset: number,
  sectionMap: SectionMap,
  sectionSizes: Record<number, number>
): WarpData | null {
  // Calculate which section this offset falls into
  // Sections 1-4 make up SaveBlock1
  let remainingOffset = offset;
  let sectionId = 1;

  while (sectionId <= 4) {
    const sectionSize = sectionSizes[sectionId];
    if (remainingOffset < sectionSize) {
      break;
    }
    remainingOffset -= sectionSize;
    sectionId++;
  }

  if (sectionId > 4) return null;

  const sectorOffset = sectionMap.get(sectionId);
  if (sectorOffset === undefined) return null;

  const actualOffset = sectorOffset + remainingOffset;

  const mapGroup = data.getUint8(actualOffset);
  const mapNum = data.getUint8(actualOffset + 1);
  const warpId = data.getInt8(actualOffset + 2);
  const x = data.getInt16(actualOffset + 4, true);
  const y = data.getInt16(actualOffset + 6, true);

  // Resolve mapGroup/mapNum to our mapId
  const resolved = mapGroupNumToMapId(mapGroup, mapNum);
  const mapId = resolved?.mapId ?? 'MAP_LITTLEROOT_TOWN';

  return {
    mapId,
    warpId,
    x,
    y,
  };
}

/**
 * Read a value from SaveBlock1 (spans sections 1-4)
 * Note: data parameter is captured by readFn closure from caller
 */
function readFromSaveBlock1(
  _data: DataView,
  offset: number,
  sectionMap: SectionMap,
  sectionSizes: Record<number, number>,
  readFn: (offset: number) => number
): number {
  // Calculate which section this offset falls into
  let remainingOffset = offset;
  let sectionId = 1;

  while (sectionId <= 4) {
    const sectionSize = sectionSizes[sectionId];
    if (remainingOffset < sectionSize) {
      break;
    }
    remainingOffset -= sectionSize;
    sectionId++;
  }

  if (sectionId > 4) return 0;

  const sectorOffset = sectionMap.get(sectionId);
  if (sectorOffset === undefined) return 0;

  return readFn(sectorOffset + remainingOffset);
}

/**
 * Read item slots from a bag pocket
 */
function readItemSlots(
  data: DataView,
  offset: number,
  count: number,
  sectionMap: SectionMap,
  sectionSizes: Record<number, number>,
  encryptionKey: number
): ItemSlot[] {
  const items: ItemSlot[] = [];

  for (let i = 0; i < count; i++) {
    const slotOffset = offset + i * ITEM_SLOT_SIZE;

    // Read item ID and quantity
    const itemId = readFromSaveBlock1(data, slotOffset, sectionMap, sectionSizes, (o) => data.getUint16(o, true));
    let quantity = readFromSaveBlock1(data, slotOffset + 2, sectionMap, sectionSizes, (o) => data.getUint16(o, true));

    // XOR decrypt quantity (Emerald only)
    if (encryptionKey !== 0) {
      quantity ^= (encryptionKey & 0xFFFF);
    }

    if (itemId !== 0 && quantity > 0) {
      items.push({ itemId, quantity });
    }
  }

  return items;
}

/**
 * Read raw flag bitfield from SaveBlock1 (300 bytes at FLAGS offset).
 */
function readRawFlags(
  data: DataView,
  sectionMap: SectionMap,
  sectionSizes: Record<number, number>,
  flagsOffset: number,
  flagsSize: number
): Uint8Array {
  const raw = new Uint8Array(flagsSize);
  for (let byteIdx = 0; byteIdx < raw.length; byteIdx++) {
    raw[byteIdx] = readFromSaveBlock1(
      data,
      flagsOffset + byteIdx,
      sectionMap,
      sectionSizes,
      (o) => data.getUint8(o)
    );
  }
  return raw;
}

/**
 * Parse named flags from raw flag bitfield.
 */
function parseFlags(rawFlags: Uint8Array, profile?: SaveLayoutProfile): string[] {
  const flags = new Set<string>();

  for (let byteIdx = 0; byteIdx < rawFlags.length; byteIdx++) {
    const byte = rawFlags[byteIdx];
    if (byte === 0) continue; // Fast-skip zero bytes

    for (let bit = 0; bit < 8; bit++) {
      if (byte & (1 << bit)) {
        const flagId = byteIdx * 8 + bit;
        const name = FLAG_ID_TO_NAME[flagId];
        if (name) {
          flags.add(name);
        }
      }
    }
  }

  // Profile-specific alias projection for hacks where canonical system flags moved.
  if (profile?.flagAliases) {
    for (const [name, flagId] of Object.entries(profile.flagAliases)) {
      if (readFlagByIdRaw(rawFlags, flagId)) {
        flags.add(name);
      }
    }
  }

  return [...flags];
}

/**
 * Read raw variable array from SaveBlock1 (256 u16 values at VARS offset).
 */
function readRawVars(
  data: DataView,
  sectionMap: SectionMap,
  sectionSizes: Record<number, number>,
  varsOffset: number,
  varsCount: number
): Uint16Array {
  const raw = new Uint16Array(varsCount);
  for (let i = 0; i < raw.length; i++) {
    raw[i] = readFromSaveBlock1(
      data,
      varsOffset + i * 2,
      sectionMap,
      sectionSizes,
      (o) => data.getUint16(o, true)
    );
  }
  return raw;
}

/**
 * Parse named variables from raw var array.
 * Var ID = 0x4000 + index; look up name from VAR_ID_TO_NAME.
 */
function parseVars(rawVars: Uint16Array): Record<string, number> {
  const vars: Record<string, number> = {};

  for (let i = 0; i < rawVars.length; i++) {
    const value = rawVars[i];
    if (value === 0) continue; // Skip zero-value vars

    const varId = 0x4000 + i;
    const name = VAR_ID_TO_NAME[varId];
    if (name) {
      vars[name] = value;
    }
  }

  return vars;
}

function readFlagByIdRaw(rawFlags: Uint8Array, flagId: number): boolean {
  const byteIdx = flagId >> 3;
  const bit = flagId & 7;
  if (byteIdx < 0 || byteIdx >= rawFlags.length) return false;
  const byte = rawFlags[byteIdx];
  return (byte & (1 << bit)) !== 0;
}

function countSetFlagsRaw(rawFlags: Uint8Array): number {
  let count = 0;
  for (let byteIdx = 0; byteIdx < rawFlags.length; byteIdx++) {
    let value = rawFlags[byteIdx];
    while (value) {
      count += value & 1;
      value >>= 1;
    }
  }
  return count;
}

function readVarByIdRaw(rawVars: Uint16Array, varId: number): number {
  if (varId < 0x4000 || varId > 0x40FF) return 0;
  const idx = varId - 0x4000;
  return idx >= 0 && idx < rawVars.length ? rawVars[idx] : 0;
}

function countNonZeroVarsRaw(rawVars: Uint16Array): number {
  let count = 0;
  for (let i = 0; i < rawVars.length; i++) {
    if (rawVars[i] !== 0) count++;
  }
  return count;
}

function buildSanityReport(
  rawFlags: Uint8Array,
  rawVars: Uint16Array,
  rawPartyCount: number,
  sanityConfig?: SaveLayoutSanityConfig
): ParseSanityReport {
  const keyFlagIds = { ...KEY_FLAG_IDS, ...(sanityConfig?.keyFlagIds ?? {}) };
  const keyVarIds = { ...KEY_VAR_IDS, ...(sanityConfig?.keyVarIds ?? {}) };
  const flagsSetCount = countSetFlagsRaw(rawFlags);
  const nonZeroVarCount = countNonZeroVarsRaw(rawVars);

  const keyFlags = {
    FLAG_ADVENTURE_STARTED: readFlagByIdRaw(rawFlags, keyFlagIds.FLAG_ADVENTURE_STARTED),
    FLAG_SYS_POKEMON_GET: readFlagByIdRaw(rawFlags, keyFlagIds.FLAG_SYS_POKEMON_GET),
    FLAG_SYS_POKEDEX_GET: readFlagByIdRaw(rawFlags, keyFlagIds.FLAG_SYS_POKEDEX_GET),
  };

  const keyVars = {
    VAR_STARTER_MON: readVarByIdRaw(rawVars, keyVarIds.VAR_STARTER_MON),
    VAR_LITTLEROOT_TOWN_STATE: readVarByIdRaw(rawVars, keyVarIds.VAR_LITTLEROOT_TOWN_STATE),
    VAR_ROUTE101_STATE: readVarByIdRaw(rawVars, keyVarIds.VAR_ROUTE101_STATE),
    VAR_BIRCH_LAB_STATE: readVarByIdRaw(rawVars, keyVarIds.VAR_BIRCH_LAB_STATE),
    VAR_LITTLEROOT_INTRO_STATE: readVarByIdRaw(rawVars, keyVarIds.VAR_LITTLEROOT_INTRO_STATE),
  };

  const issues: string[] = [];

  if (rawPartyCount > 0 && flagsSetCount === 0) {
    issues.push('Party count > 0 but vanilla flag bitfield has no set flags.');
  }

  if (rawPartyCount > 0 && !keyFlags.FLAG_SYS_POKEMON_GET && !keyFlags.FLAG_SYS_POKEDEX_GET) {
    issues.push('Party count > 0 but both FLAG_SYS_POKEMON_GET and FLAG_SYS_POKEDEX_GET are unset.');
  }

  if (keyVars.VAR_STARTER_MON > 2) {
    issues.push(`VAR_STARTER_MON out of expected range (0..2): ${keyVars.VAR_STARTER_MON}`);
  }

  if (keyVars.VAR_LITTLEROOT_TOWN_STATE > 1000) {
    issues.push(`VAR_LITTLEROOT_TOWN_STATE implausibly high: ${keyVars.VAR_LITTLEROOT_TOWN_STATE}`);
  }

  if (nonZeroVarCount > 80 && keyVars.VAR_STARTER_MON > 2) {
    issues.push(`High non-zero var count (${nonZeroVarCount}) with implausible key vars; likely unsupported layout.`);
  }

  return {
    level: issues.length > 0 ? 'low' : 'high',
    issues,
    flagsSetCount,
    nonZeroVarCount,
    rawPartyCount,
    keyFlags,
    keyVars,
  };
}

interface LayoutCandidateAssessment {
  profile: SaveLayoutProfile;
  score: number;
  confidence: number;
  supported: boolean;
  encryptionKey: number;
  rawFlags: Uint8Array;
  rawVars: Uint16Array;
  rawPartyCount: number;
  sanity: ParseSanityReport;
}

interface LayoutEvaluationOptions {
  minSupportedConfidence: number;
  requireHighSanity: boolean;
}

function evaluateLayoutCandidate(
  data: DataView,
  section0Offset: number,
  sectionMap: SectionMap,
  profile: SaveLayoutProfile,
  options: LayoutEvaluationOptions
): LayoutCandidateAssessment {
  const sb1 = profile.saveBlock1;
  const sectionSizes = profile.sectionSizes;

  const rawEncryptionKey = data.getUint32(section0Offset + profile.saveBlock2.ENCRYPTION_KEY, true);
  const encryptionKey = profile.encryption === 'xor' ? rawEncryptionKey : 0;

  let money = readFromSaveBlock1(data, sb1.MONEY, sectionMap, sectionSizes, (o) => data.getUint32(o, true));
  if (profile.encryption === 'xor') {
    money ^= encryptionKey;
  }

  let coins = readFromSaveBlock1(data, sb1.COINS, sectionMap, sectionSizes, (o) => data.getUint16(o, true));
  if (profile.encryption === 'xor') {
    coins ^= (encryptionKey & 0xFFFF);
  }

  const rawPartyCount = readFromSaveBlock1(
    data,
    sb1.PARTY_COUNT,
    sectionMap,
    sectionSizes,
    (o) => data.getUint32(o, true)
  );
  const rawFlags = readRawFlags(data, sectionMap, sectionSizes, sb1.FLAGS, sb1.FLAGS_SIZE);
  const rawVars = readRawVars(data, sectionMap, sectionSizes, sb1.VARS, sb1.VARS_COUNT);
  const sanity = buildSanityReport(rawFlags, rawVars, rawPartyCount, profile.sanityConfig);

  let score = 0;
  score += sanity.level === 'high' ? 70 : 20;
  score += Math.max(0, 20 - sanity.issues.length * 8);
  score += rawPartyCount <= sb1.PARTY_MAX_SIZE ? 10 : -25;
  score += money >= 0 && money <= 999999 ? 10 : -15;
  score += coins >= 0 && coins <= 9999 ? 5 : -10;
  score += sanity.keyVars.VAR_STARTER_MON <= 2 ? 10 : -10;

  if (profile.encryption === 'xor') {
    score += rawEncryptionKey !== 0 ? 8 : -3;
  }

  const confidence = Math.max(0, Math.min(100, score));
  const supported = confidence >= options.minSupportedConfidence && (
    options.requireHighSanity ? sanity.level === 'high' : true
  );

  return {
    profile,
    score,
    confidence,
    supported,
    encryptionKey,
    rawFlags,
    rawVars,
    rawPartyCount,
    sanity,
  };
}

/**
 * Main parser function
 */
export function parseGen3Save(
  buffer: ArrayBuffer,
  filename?: string,
  options: ParseGen3SaveOptions = {}
): Gen3ParseResult {
  const normalizedInput = normalizeInputBuffer(buffer);
  if (normalizedInput.ok === false) {
    return { success: false, error: normalizedInput.error };
  }

  const { buffer: normalizedBuffer, sourceFormat, rawOffset } = normalizedInput.info;
  const data = new DataView(normalizedBuffer);
  const layoutProfiles = options.layoutProfiles
    ? [...options.layoutProfiles]
    : [...SAVE_LAYOUT_PROFILES];
  const evaluationOptions: LayoutEvaluationOptions = {
    minSupportedConfidence: options.minSupportedConfidence ?? 60,
    requireHighSanity: options.requireHighSanity ?? true,
  };

  if (layoutProfiles.length === 0) {
    return { success: false, error: 'No layout profiles available for parsing' };
  }

  // Try to find valid slot
  let activeSlot: 'A' | 'B' = 'A';
  let activeSectionMap: SectionMap = new Map();
  let activeSaveCounter = 0;
  let checksumFailures: number[] = [];

  // Check slot A
  const slotA = buildSectionMap(data, 0);
  const slotAValid = isSlotValid(slotA.map);

  // Check slot B (if file is large enough)
  let slotBValid = false;
  let slotB = { map: new Map<number, number>(), saveCounter: 0, failures: [] as number[] };
  if (normalizedBuffer.byteLength >= SAVE_SIZE_FULL) {
    slotB = buildSectionMap(data, SAVE_SLOT_SIZE);
    slotBValid = isSlotValid(slotB.map);
  }

  // Determine active slot
  if (slotAValid && slotBValid) {
    // Both valid, use higher save counter
    if (slotB.saveCounter > slotA.saveCounter) {
      activeSlot = 'B';
      activeSectionMap = slotB.map;
      activeSaveCounter = slotB.saveCounter;
      checksumFailures = slotB.failures;
    } else {
      activeSlot = 'A';
      activeSectionMap = slotA.map;
      activeSaveCounter = slotA.saveCounter;
      checksumFailures = slotA.failures;
    }
  } else if (slotAValid) {
    activeSlot = 'A';
    activeSectionMap = slotA.map;
    activeSaveCounter = slotA.saveCounter;
    checksumFailures = slotA.failures;
  } else if (slotBValid) {
    activeSlot = 'B';
    activeSectionMap = slotB.map;
    activeSaveCounter = slotB.saveCounter;
    checksumFailures = slotB.failures;
  } else {
    return { success: false, error: 'No valid save slot found' };
  }

  // Get section 0 offset for SaveBlock2
  const section0Offset = activeSectionMap.get(0);
  if (section0Offset === undefined) {
    return { success: false, error: 'Section 0 not found' };
  }

  // === Parse SaveBlock2 (Section 0) ===

  // Player name
  const nameBytes = new Uint8Array(normalizedBuffer, section0Offset + SAVEBLOCK2.PLAYER_NAME, SAVEBLOCK2.PLAYER_NAME_LENGTH);
  const playerName = decodeGen3String(nameBytes);

  // Gender
  const gender = data.getUint8(section0Offset + SAVEBLOCK2.GENDER) as 0 | 1;

  // Trainer IDs
  const trainerId = data.getUint16(section0Offset + SAVEBLOCK2.TRAINER_ID, true);
  const secretId = data.getUint16(section0Offset + SAVEBLOCK2.SECRET_ID, true);

  // Play time
  const playTimeHours = data.getUint16(section0Offset + SAVEBLOCK2.PLAY_TIME_HOURS, true);
  const playTimeMinutes = data.getUint8(section0Offset + SAVEBLOCK2.PLAY_TIME_MINUTES);
  const playTimeSeconds = data.getUint8(section0Offset + SAVEBLOCK2.PLAY_TIME_SECONDS);

  // Detect best matching layout profile and parse with it.
  const candidateAssessments = layoutProfiles.map((layoutProfile) =>
    evaluateLayoutCandidate(data, section0Offset, activeSectionMap, layoutProfile, evaluationOptions)
  ).sort((a, b) => b.score - a.score);

  const selectedCandidate = candidateAssessments[0];
  if (!selectedCandidate) {
    return { success: false, error: 'No layout profile candidates available' };
  }

  const selectedProfile = selectedCandidate.profile;
  const selectedSaveBlock1 = selectedProfile.saveBlock1;
  const sectionSizes = selectedProfile.sectionSizes;
  const encryptionKey = selectedCandidate.encryptionKey;
  const sanity = selectedCandidate.sanity;

  // === Parse SaveBlock1 (Sections 1-4) with selected profile ===

  // Position
  const posX = readFromSaveBlock1(
    data,
    selectedSaveBlock1.POS_X,
    activeSectionMap,
    sectionSizes,
    (o) => data.getInt16(o, true)
  );
  const posY = readFromSaveBlock1(
    data,
    selectedSaveBlock1.POS_Y,
    activeSectionMap,
    sectionSizes,
    (o) => data.getInt16(o, true)
  );

  // Location warp
  const locationWarp = readWarpData(data, selectedSaveBlock1.LOCATION_WARP, activeSectionMap, sectionSizes);
  const continueGameWarp = readWarpData(data, selectedSaveBlock1.CONTINUE_GAME_WARP, activeSectionMap, sectionSizes);
  const lastHealLocation = readWarpData(data, selectedSaveBlock1.LAST_HEAL_LOCATION, activeSectionMap, sectionSizes);
  const escapeWarp = readWarpData(data, selectedSaveBlock1.ESCAPE_WARP, activeSectionMap, sectionSizes);

  // Money / coins
  let money = readFromSaveBlock1(
    data,
    selectedSaveBlock1.MONEY,
    activeSectionMap,
    sectionSizes,
    (o) => data.getUint32(o, true)
  );
  if (selectedProfile.encryption === 'xor') {
    money ^= encryptionKey;
  }

  let coins = readFromSaveBlock1(
    data,
    selectedSaveBlock1.COINS,
    activeSectionMap,
    sectionSizes,
    (o) => data.getUint16(o, true)
  );
  if (selectedProfile.encryption === 'xor') {
    coins ^= (encryptionKey & 0xFFFF);
  }

  // Registered item (u16, NOT encrypted)
  const registeredItem = readFromSaveBlock1(
    data,
    selectedSaveBlock1.REGISTERED_ITEM,
    activeSectionMap,
    sectionSizes,
    (o) => data.getUint16(o, true)
  );

  // PC Items (NOT encrypted)
  const pcItems = readItemSlots(
    data,
    selectedSaveBlock1.PC_ITEMS,
    selectedSaveBlock1.PC_ITEMS_COUNT,
    activeSectionMap,
    sectionSizes,
    0
  );

  // Bag pockets (XOR only for Emerald profile)
  const bagItems = readItemSlots(
    data,
    selectedSaveBlock1.BAG_ITEMS,
    selectedSaveBlock1.BAG_ITEMS_COUNT,
    activeSectionMap,
    sectionSizes,
    selectedProfile.encryption === 'xor' ? encryptionKey : 0
  );
  const keyItems = readItemSlots(
    data,
    selectedSaveBlock1.BAG_KEY_ITEMS,
    selectedSaveBlock1.BAG_KEY_ITEMS_COUNT,
    activeSectionMap,
    sectionSizes,
    selectedProfile.encryption === 'xor' ? encryptionKey : 0
  );
  const pokeBalls = readItemSlots(
    data,
    selectedSaveBlock1.BAG_POKE_BALLS,
    selectedSaveBlock1.BAG_POKE_BALLS_COUNT,
    activeSectionMap,
    sectionSizes,
    selectedProfile.encryption === 'xor' ? encryptionKey : 0
  );
  const tmHm = readItemSlots(
    data,
    selectedSaveBlock1.BAG_TM_HM,
    selectedSaveBlock1.BAG_TM_HM_COUNT,
    activeSectionMap,
    sectionSizes,
    selectedProfile.encryption === 'xor' ? encryptionKey : 0
  );
  const berries = readItemSlots(
    data,
    selectedSaveBlock1.BAG_BERRIES,
    selectedSaveBlock1.BAG_BERRIES_COUNT,
    activeSectionMap,
    sectionSizes,
    selectedProfile.encryption === 'xor' ? encryptionKey : 0
  );

  // === Parse Pokemon Party ===
  const partyPokemon: PartyPokemon[] = parseParty(data, activeSectionMap);
  console.log(`[Gen3SaveParser] Parsed ${partyPokemon.length} Pokemon in party`);

  // === Parse Raw + Named Flags & Variables ===
  const rawFlags = selectedCandidate.rawFlags;
  const rawVars = selectedCandidate.rawVars;
  const parsedFlags = parseFlags(rawFlags, selectedProfile);
  const parsedVars = parseVars(rawVars);
  console.log(`[Gen3SaveParser] Parsed ${parsedFlags.length} flags, ${Object.keys(parsedVars).length} vars`);

  if (!selectedCandidate.supported) {
    console.warn('[Gen3SaveParser] Low-confidence parse:', sanity);
  }

  // === Build SaveData ===

  const profile: PlayerProfile = {
    name: playerName,
    gender,
    trainerId,
    secretId,
  };

  const playTime: PlayTime = {
    hours: playTimeHours,
    minutes: playTimeMinutes,
    seconds: playTimeSeconds,
  };

  // Default warp values
  const defaultWarp: WarpData = {
    mapId: 'MAP_LITTLEROOT_TOWN',
    warpId: 0,
    x: 5,
    y: 3,
  };

  const location: LocationState = {
    pos: { x: posX, y: posY },
    location: locationWarp ?? defaultWarp,
    continueGameWarp: continueGameWarp ?? defaultWarp,
    lastHealLocation: lastHealLocation ?? defaultWarp,
    escapeWarp: escapeWarp ?? defaultWarp,
    direction: 'down', // Default direction (TODO: parse from save)
    elevation: 3, // Default elevation
    isSurfing: false,
    isUnderwater: false,
  };

  const moneyState: MoneyState = {
    money,
    coins,
  };

  const bag: BagState = {
    items: bagItems,
    keyItems,
    pokeBalls,
    tmHm,
    berries,
  };

  const pcItemsState: PCItemsState = {
    items: pcItems,
  };

  // Build party state for SaveData
  const partyState = {
    pokemon: partyPokemon.map(p => ({
      species: p.species,
      nickname: p.nickname,
      otName: p.otName,
      otId: p.otId,
      level: p.level,
      experience: p.experience,
    })),
    count: partyPokemon.length,
  };

  const partyFull: (PartyPokemon | null)[] = [...partyPokemon];
  while (partyFull.length < selectedSaveBlock1.PARTY_MAX_SIZE) {
    partyFull.push(null);
  }

  const saveData: SaveData = {
    version: 1,
    timestamp: Date.now(),
    profile,
    playTime,
    location,
    money: moneyState,
    bag,
    pcItems: pcItemsState,
    registeredItem,
    party: partyState,
    partyFull,
    flags: parsedFlags,
    rawFlags: Array.from(rawFlags),
    vars: parsedVars,
    rawVars: Array.from(rawVars),
  };

  const nativeMetadata: NativeMetadata = {
    game: selectedProfile.game,
    layoutProfileId: selectedProfile.id,
    layoutDisplayName: selectedProfile.displayName,
    layoutConfidence: selectedCandidate.confidence,
    layoutSupported: selectedCandidate.supported,
    layoutCandidates: candidateAssessments.map((candidate) => ({
      profileId: candidate.profile.id,
      score: candidate.score,
      sanityLevel: candidate.sanity.level,
      issueCount: candidate.sanity.issues.length,
    })),
    activeSlot,
    saveCounter: activeSaveCounter,
    encryptionKey,
    sectorOrder: Array.from({ length: SECTORS_PER_SLOT }, (_, sectionId) => sectionId),
    checksumFailures,
    rawLength: normalizedBuffer.byteLength,
    sourceFormat,
    rawOffset,
    sanity,
    sourceFilename: filename,
  };

  return {
    success: true,
    saveData,
    nativeMetadata,
  };
}

/**
 * Quick validation check for a potential .sav file
 */
export function isValidGen3Save(buffer: ArrayBuffer): boolean {
  const normalizedInput = normalizeInputBuffer(buffer);
  if (normalizedInput.ok === false) {
    return false;
  }

  const data = new DataView(normalizedInput.info.buffer);

  // Check for valid signature in at least one sector of slot A/B.
  for (const slotOffset of [0, SAVE_SLOT_SIZE]) {
    for (let i = 0; i < SECTORS_PER_SLOT; i++) {
      const sectorOffset = slotOffset + i * SECTOR_SIZE;
      if (sectorOffset + SECTOR_SIZE > data.byteLength) break;

      const signature = data.getUint32(sectorOffset + SECTOR_FOOTER.SIGNATURE, true);
      if (signature === SAVE_SIGNATURE) {
        return true;
      }
    }
  }

  return false;
}
