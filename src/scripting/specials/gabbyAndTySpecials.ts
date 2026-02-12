/**
 * Gabby and Ty script-special dispatch helpers.
 *
 * C references:
 * - public/pokeemerald/src/tv.c (GabbyAndTyBeforeInterview, GabbyAndTyGetBattleNum, etc.)
 * - public/pokeemerald/data/scripts/gabby_and_ty.inc
 */

interface GabbyAndTySpecialContext {
  getVar: (name: string) => number;
  setVar: (name: string, value: number | string) => void;
}

interface SpecialDispatchResult {
  handled: boolean;
  result?: number;
}

const VAR_GABBY_AND_TY_BATTLE_NUM = 'VAR_GABBY_AND_TY_BATTLE_NUM';
const VAR_GABBY_AND_TY_ON_AIR = 'VAR_GABBY_AND_TY_ON_AIR';
const VAR_GABBY_AND_TY_LAST_BATTLE_TRIVIA = 'VAR_GABBY_AND_TY_LAST_BATTLE_TRIVIA';

const GABBY_AND_TY_LOCAL_IDS_BY_BATTLE_NUM: Readonly<
  Partial<Record<number, { gabby: string; ty: string }>>
> = {
  1: { gabby: 'LOCALID_ROUTE111_GABBY_1', ty: 'LOCALID_ROUTE111_TY_1' },
  2: { gabby: 'LOCALID_ROUTE118_GABBY_1', ty: 'LOCALID_ROUTE118_TY_1' },
  3: { gabby: 'LOCALID_ROUTE120_GABBY_1', ty: 'LOCALID_ROUTE120_TY_1' },
  4: { gabby: 'LOCALID_ROUTE111_GABBY_2', ty: 'LOCALID_ROUTE111_TY_2' },
  5: { gabby: 'LOCALID_ROUTE118_GABBY_2', ty: 'LOCALID_ROUTE118_TY_2' },
  6: { gabby: 'LOCALID_ROUTE120_GABBY_2', ty: 'LOCALID_ROUTE120_TY_2' },
  7: { gabby: 'LOCALID_ROUTE111_GABBY_3', ty: 'LOCALID_ROUTE111_TY_3' },
  8: { gabby: 'LOCALID_ROUTE118_GABBY_3', ty: 'LOCALID_ROUTE118_TY_3' },
};

function resolveGabbyAndTyBattleNum(rawBattleNum: number): number {
  if (rawBattleNum > 5) {
    return (rawBattleNum % 3) + 6;
  }
  return rawBattleNum;
}

/**
 * Execute Gabby-and-Ty-related specials.
 *
 * Notes:
 * - We keep runtime data in script vars so state survives browser save/load.
 * - Easy-chat quote payload parity is not implemented yet; `GabbyAndTyGetLastQuote`
 *   currently reports no stored quote.
 */
export function executeGabbyAndTySpecial(
  name: string,
  context: GabbyAndTySpecialContext
): SpecialDispatchResult {
  switch (name) {
    case 'GabbyAndTyGetBattleNum': {
      const battleNum = context.getVar(VAR_GABBY_AND_TY_BATTLE_NUM);
      return { handled: true, result: resolveGabbyAndTyBattleNum(battleNum) };
    }

    case 'GabbyAndTyBeforeInterview': {
      const battleNum = context.getVar(VAR_GABBY_AND_TY_BATTLE_NUM);
      if (battleNum !== 0xFF) {
        context.setVar(VAR_GABBY_AND_TY_BATTLE_NUM, (battleNum + 1) & 0xFFFF);
      }
      context.setVar(VAR_GABBY_AND_TY_ON_AIR, 0);
      context.setVar(VAR_GABBY_AND_TY_LAST_BATTLE_TRIVIA, 0);
      return { handled: true };
    }

    case 'GabbyAndTyAfterInterview':
      context.setVar(VAR_GABBY_AND_TY_ON_AIR, 1);
      return { handled: true };

    case 'GetGabbyAndTyLocalIds': {
      const battleNum = resolveGabbyAndTyBattleNum(context.getVar(VAR_GABBY_AND_TY_BATTLE_NUM));
      const ids = GABBY_AND_TY_LOCAL_IDS_BY_BATTLE_NUM[battleNum];
      if (ids) {
        context.setVar('VAR_0x8004', ids.gabby);
        context.setVar('VAR_0x8005', ids.ty);
      } else {
        context.setVar('VAR_0x8004', 0);
        context.setVar('VAR_0x8005', 0);
      }
      return { handled: true };
    }

    case 'IsGabbyAndTyShowOnTheAir':
      return {
        handled: true,
        result: context.getVar(VAR_GABBY_AND_TY_ON_AIR) !== 0 ? 1 : 0,
      };

    case 'GabbyAndTyGetLastBattleTrivia':
      return {
        handled: true,
        result: context.getVar(VAR_GABBY_AND_TY_LAST_BATTLE_TRIVIA),
      };

    case 'GabbyAndTyGetLastQuote':
      return { handled: true, result: 0 };

    default:
      return { handled: false };
  }
}
