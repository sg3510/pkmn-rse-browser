import { getItemId } from '../../data/items.ts';
import {
  getMultichoiceIdByName,
  getMultichoiceList,
} from '../../data/multichoice.gen.ts';
import { bagManager } from '../../game/BagManager.ts';
import { gameFlags } from '../../game/GameFlags.ts';
import { menuStateManager } from '../../menu/MenuStateManager.ts';

const GBA_WIDTH = 240;
const GBA_HEIGHT = 160;
const TILE_SIZE = 8;
const DEFAULT_CANCEL_RESULT = getMultichoiceIdByName('MULTI_B_PRESSED') ?? 127;

type LilycoveSelection =
  | 0 // SLATEPORT
  | 1 // BATTLE_FRONTIER
  | 2 // SOUTHERN_ISLAND
  | 3 // NAVEL_ROCK
  | 4 // BIRTH_ISLAND
  | 5 // FARAWAY_ISLAND
  | 6; // EXIT

const LILYCOVE_LABELS: Record<LilycoveSelection, string> = {
  0: 'SLATEPORT CITY',
  1: 'BATTLE FRONTIER',
  2: 'SOUTHERN ISLAND',
  3: 'NAVEL ROCK',
  4: 'BIRTH ISLAND',
  5: 'FARAWAY ISLAND',
  6: 'EXIT',
};

interface MultichoiceRequest {
  left: number;
  top: number;
  multichoiceId: number;
  ignoreBPress: boolean;
  defaultChoice?: number;
}

interface MultichoiceGridRequest extends MultichoiceRequest {
  columns: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toMenuPosition(left: number, top: number): { leftRatio: number; topRatio: number } {
  return {
    leftRatio: clamp((left * TILE_SIZE) / GBA_WIDTH, 0, 1),
    topRatio: clamp((top * TILE_SIZE) / GBA_HEIGHT, 0, 1),
  };
}

function hasTicketItem(itemConstName: string): boolean {
  const itemId = getItemId(itemConstName);
  return itemId !== null && itemId > 0 && bagManager.hasItem(itemId, 1);
}

export class ScriptMenuHost {
  private lilycoveSelections: LilycoveSelection[] = [];

  async openMultichoice(request: MultichoiceRequest): Promise<number> {
    const choiceLabels = getMultichoiceList(request.multichoiceId);
    if (!choiceLabels) {
      return 0;
    }

    const defaultIndex = clamp(request.defaultChoice ?? 0, 0, Math.max(0, choiceLabels.length - 1));
    const result = await menuStateManager.openAsync('scriptChoice', {
      title: '',
      promptText: '',
      choices: choiceLabels.map((label, index) => ({
        label,
        value: index,
      })),
      cancelable: !request.ignoreBPress,
      defaultIndex,
      columns: 1,
      menuPosition: toMenuPosition(request.left, request.top),
    });

    return result ?? DEFAULT_CANCEL_RESULT;
  }

  async openMultichoiceGrid(request: MultichoiceGridRequest): Promise<number> {
    const choiceLabels = getMultichoiceList(request.multichoiceId);
    if (!choiceLabels) {
      return 0;
    }

    const result = await menuStateManager.openAsync('scriptChoice', {
      title: '',
      promptText: '',
      choices: choiceLabels.map((label, index) => ({
        label,
        value: index,
      })),
      cancelable: !request.ignoreBPress,
      defaultIndex: 0,
      columns: Math.max(1, request.columns),
      menuPosition: toMenuPosition(request.left, request.top),
    });

    return result ?? DEFAULT_CANCEL_RESULT;
  }

  async openForcedStartMenu(playerName: string): Promise<number> {
    const multichoiceId = getMultichoiceIdByName('MULTI_FORCED_START_MENU');
    if (multichoiceId === undefined) {
      return 0;
    }

    const labels = getMultichoiceList(multichoiceId);
    if (!labels) {
      return 0;
    }

    const replacedLabels = labels.map((label, index) => {
      if (index === 4) {
        return playerName;
      }
      return label;
    });

    const result = await menuStateManager.openAsync('scriptChoice', {
      title: 'START MENU',
      choices: replacedLabels.map((label, index) => ({
        label,
        value: index,
      })),
      cancelable: true,
      defaultIndex: 0,
      columns: 1,
      menuPosition: toMenuPosition(21, 0),
    });

    return result ?? DEFAULT_CANCEL_RESULT;
  }

  async openPcMultichoice(playerName: string): Promise<number> {
    const playerPcLabel = `${playerName}'s PC`;
    const choices: Array<{ label: string; value: number }> = [
      {
        label: gameFlags.isSet('FLAG_SYS_PC_LANETTE') ? "LANETTE'S PC" : "SOMEONE'S PC",
        value: 0,
      },
      { label: playerPcLabel, value: 1 },
    ];

    if (gameFlags.isSet('FLAG_SYS_GAME_CLEAR')) {
      choices.push({ label: 'HALL OF FAME', value: 2 });
      choices.push({ label: 'LOG OFF', value: 3 });
    } else {
      choices.push({ label: 'LOG OFF', value: 2 });
    }

    const result = await menuStateManager.openAsync('scriptChoice', {
      title: '',
      choices,
      cancelable: true,
      defaultIndex: 0,
      columns: 1,
      menuPosition: toMenuPosition(0, 0),
    });

    return result ?? DEFAULT_CANCEL_RESULT;
  }

  async openLilycoveSSTidalMultichoice(ticketSelectionMode: number): Promise<number> {
    const showOnlyNewTicketDestinations = ticketSelectionMode === 1;
    const selections: LilycoveSelection[] = [];

    if (!showOnlyNewTicketDestinations) {
      selections.push(0);
      if (gameFlags.isSet('FLAG_MET_SCOTT_ON_SS_TIDAL')) {
        selections.push(1);
      }
    }

    this.tryPushLilycoveTicketSelection(selections, {
      showOnlyNewTicketDestinations,
      itemConst: 'ITEM_EON_TICKET',
      enableFlag: 'FLAG_ENABLE_SHIP_SOUTHERN_ISLAND',
      shownFlag: 'FLAG_SHOWN_EON_TICKET',
      selection: 2,
    });
    this.tryPushLilycoveTicketSelection(selections, {
      showOnlyNewTicketDestinations,
      itemConst: 'ITEM_MYSTIC_TICKET',
      enableFlag: 'FLAG_ENABLE_SHIP_NAVEL_ROCK',
      shownFlag: 'FLAG_SHOWN_MYSTIC_TICKET',
      selection: 3,
    });
    this.tryPushLilycoveTicketSelection(selections, {
      showOnlyNewTicketDestinations,
      itemConst: 'ITEM_AURORA_TICKET',
      enableFlag: 'FLAG_ENABLE_SHIP_BIRTH_ISLAND',
      shownFlag: 'FLAG_SHOWN_AURORA_TICKET',
      selection: 4,
    });
    this.tryPushLilycoveTicketSelection(selections, {
      showOnlyNewTicketDestinations,
      itemConst: 'ITEM_OLD_SEA_MAP',
      enableFlag: 'FLAG_ENABLE_SHIP_FARAWAY_ISLAND',
      shownFlag: 'FLAG_SHOWN_OLD_SEA_MAP',
      selection: 5,
    });

    selections.push(6);
    this.lilycoveSelections = selections;

    const result = await menuStateManager.openAsync('scriptChoice', {
      choices: selections.map((selection, index) => ({
        label: LILYCOVE_LABELS[selection],
        value: index,
      })),
      cancelable: true,
      defaultIndex: Math.max(0, selections.length - 1),
      columns: 1,
      menuPosition: toMenuPosition(0, 0),
    });

    return result ?? DEFAULT_CANCEL_RESULT;
  }

  mapLilycoveSelectionResult(result: number): number {
    if (result === DEFAULT_CANCEL_RESULT) {
      return result;
    }
    if (result < 0 || result >= this.lilycoveSelections.length) {
      return result;
    }
    return this.lilycoveSelections[result] ?? result;
  }

  private tryPushLilycoveTicketSelection(
    selections: LilycoveSelection[],
    params: {
      showOnlyNewTicketDestinations: boolean;
      itemConst: string;
      enableFlag: string;
      shownFlag: string;
      selection: LilycoveSelection;
    },
  ): void {
    if (!gameFlags.isSet(params.enableFlag)) {
      return;
    }
    if (!hasTicketItem(params.itemConst)) {
      return;
    }

    if (!params.showOnlyNewTicketDestinations) {
      selections.push(params.selection);
      return;
    }

    if (gameFlags.isSet(params.shownFlag)) {
      return;
    }
    selections.push(params.selection);
    gameFlags.set(params.shownFlag);
  }
}

export const scriptMenuHost = new ScriptMenuHost();

export { DEFAULT_CANCEL_RESULT as MULTI_B_PRESSED };
