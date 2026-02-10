export type DebugCategory = 'door' | 'map' | 'field' | string;

const GLOBAL_DEBUG_FLAG = 'DEBUG_MODE';
const STRUCTURED_DEBUG_KEY = '__PKMN_DEBUG';

const LEGACY_CATEGORY_FLAGS: Record<string, string[]> = {
  door: ['DEBUG_DOOR'],
  map: ['PKMN_DEBUG_MODE'],
};

function asWindowRecord(): Record<string, unknown> | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window as unknown as Record<string, unknown>;
}

function readStructuredCategoryDebug(win: Record<string, unknown>, category: DebugCategory): boolean | null {
  const raw = win[STRUCTURED_DEBUG_KEY];
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = (raw as Record<string, unknown>)[category];
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

export function isDebugMode(category?: DebugCategory): boolean {
  const win = asWindowRecord();
  if (!win) {
    return false;
  }

  if (win[GLOBAL_DEBUG_FLAG] === true) {
    return true;
  }

  if (category) {
    const structured = readStructuredCategoryDebug(win, category);
    if (structured !== null) {
      return structured;
    }

    const legacyFlags = LEGACY_CATEGORY_FLAGS[category] ?? [];
    for (const flag of legacyFlags) {
      if (win[flag] === true) {
        return true;
      }
    }
    return false;
  }

  // Backward compatibility for old global map debug toggle.
  if (win.PKMN_DEBUG_MODE === true) {
    return true;
  }

  return false;
}
