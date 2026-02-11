/**
 * Runtime storage for dynamic object event graphics variables.
 *
 * C references:
 * - public/pokeemerald/include/constants/vars.h (VAR_OBJ_GFX_ID_*)
 * - public/pokeemerald/data/scripts/common.inc (Common_EventScript_SetupRivalGfxId)
 */

const dynamicObjectGfxVars = new Map<string, string>();

function getFallbackObjectGfx(varName: string, playerGender: 0 | 1): string | null {
  // Player gender: 0 = male, 1 = female.
  // Rival is always opposite gender in Emerald.
  if (varName === 'VAR_OBJ_GFX_ID_0') {
    return playerGender === 0
      ? 'OBJ_EVENT_GFX_RIVAL_MAY_NORMAL'
      : 'OBJ_EVENT_GFX_RIVAL_BRENDAN_NORMAL';
  }

  if (varName === 'VAR_OBJ_GFX_ID_3') {
    return playerGender === 0
      ? 'OBJ_EVENT_GFX_RIVAL_MAY_MACH_BIKE'
      : 'OBJ_EVENT_GFX_RIVAL_BRENDAN_MACH_BIKE';
  }

  return null;
}

export function setDynamicObjectGfxVar(varName: string, graphicsId: string): void {
  if (!varName.startsWith('VAR_OBJ_GFX_ID_')) return;
  if (!graphicsId.startsWith('OBJ_EVENT_GFX_')) return;
  dynamicObjectGfxVars.set(varName, graphicsId);
}

export function getDynamicObjectGfxVar(varName: string): string | null {
  return dynamicObjectGfxVars.get(varName) ?? null;
}

export function clearDynamicObjectGfxVar(varName: string): void {
  dynamicObjectGfxVars.delete(varName);
}

export function resetDynamicObjectGfxVars(): void {
  dynamicObjectGfxVars.clear();
}

export function resolveDynamicObjectGfx(graphicsId: string, playerGender: 0 | 1): string {
  const match = /^OBJ_EVENT_GFX_VAR_([0-9A-F])$/.exec(graphicsId);
  if (!match) return graphicsId;

  const varName = `VAR_OBJ_GFX_ID_${match[1]}`;
  return dynamicObjectGfxVars.get(varName)
    ?? getFallbackObjectGfx(varName, playerGender)
    ?? graphicsId;
}
