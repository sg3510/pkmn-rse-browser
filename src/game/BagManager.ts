/**
 * Bag Manager
 *
 * Manages the player's item bag inventory.
 * Items are stored in pockets like the real game.
 */

import type { BagState, ItemSlot } from '../save/types';

/** Maximum items per pocket (from Emerald) */
const POCKET_MAX = {
  items: 30,
  keyItems: 30,
  pokeBalls: 16,
  tmHm: 64,
  berries: 46,
} as const;

/** Item ID ranges for pocket determination */
const ITEM_RANGES = {
  // Poke Balls: IDs 1-12 (Master Ball to Premier Ball)
  pokeBalls: { min: 1, max: 12 },
  // Key Items: IDs 259-376
  keyItems: { min: 259, max: 376 },
  // TMs/HMs: IDs 289-338 (TM01-TM50) and 339-346 (HM01-HM08)
  tmHm: { min: 289, max: 346 },
  // Berries: IDs 133-175
  berries: { min: 133, max: 175 },
} as const;

/**
 * Determine which pocket an item belongs to
 */
function getPocketForItem(itemId: number): keyof BagState {
  if (itemId >= ITEM_RANGES.pokeBalls.min && itemId <= ITEM_RANGES.pokeBalls.max) {
    return 'pokeBalls';
  }
  if (itemId >= ITEM_RANGES.keyItems.min && itemId <= ITEM_RANGES.keyItems.max) {
    return 'keyItems';
  }
  if (itemId >= ITEM_RANGES.tmHm.min && itemId <= ITEM_RANGES.tmHm.max) {
    return 'tmHm';
  }
  if (itemId >= ITEM_RANGES.berries.min && itemId <= ITEM_RANGES.berries.max) {
    return 'berries';
  }
  return 'items';
}

class BagManagerClass {
  private bag: BagState = {
    items: [],
    keyItems: [],
    pokeBalls: [],
    tmHm: [],
    berries: [],
  };

  constructor() {
    // Bag will be loaded by SaveManager on Continue
  }

  /**
   * Add an item to the bag
   * @returns true if successfully added, false if bag full
   */
  addItem(itemId: number, quantity: number = 1): boolean {
    const pocket = getPocketForItem(itemId);
    const pocketItems = this.bag[pocket];
    const maxItems = POCKET_MAX[pocket];

    // Check if we already have this item
    const existing = pocketItems.find((slot) => slot.itemId === itemId);
    if (existing) {
      // Stack with existing (max 99 per stack for most items)
      existing.quantity = Math.min(existing.quantity + quantity, 99);
      console.log(`[BagManager] Added ${quantity}x item ${itemId} to ${pocket} (now ${existing.quantity})`);
      return true;
    }

    // Check if pocket is full
    if (pocketItems.length >= maxItems) {
      console.warn(`[BagManager] ${pocket} pocket is full!`);
      return false;
    }

    // Add new item slot
    pocketItems.push({ itemId, quantity });
    console.log(`[BagManager] Added ${quantity}x item ${itemId} to ${pocket}`);
    return true;
  }

  /**
   * Remove an item from the bag
   * @returns true if successfully removed, false if not enough
   */
  removeItem(itemId: number, quantity: number = 1): boolean {
    const pocket = getPocketForItem(itemId);
    const pocketItems = this.bag[pocket];

    const index = pocketItems.findIndex((slot) => slot.itemId === itemId);
    if (index === -1) {
      console.warn(`[BagManager] Item ${itemId} not in bag`);
      return false;
    }

    const slot = pocketItems[index];
    if (slot.quantity < quantity) {
      console.warn(`[BagManager] Not enough of item ${itemId} (have ${slot.quantity}, need ${quantity})`);
      return false;
    }

    slot.quantity -= quantity;
    if (slot.quantity <= 0) {
      pocketItems.splice(index, 1);
    }

    console.log(`[BagManager] Removed ${quantity}x item ${itemId} from ${pocket}`);
    return true;
  }

  /**
   * Check if bag has at least the specified quantity of an item
   */
  hasItem(itemId: number, quantity: number = 1): boolean {
    const pocket = getPocketForItem(itemId);
    const slot = this.bag[pocket].find((s) => s.itemId === itemId);
    return slot !== undefined && slot.quantity >= quantity;
  }

  /**
   * Get quantity of an item in bag
   */
  getItemQuantity(itemId: number): number {
    const pocket = getPocketForItem(itemId);
    const slot = this.bag[pocket].find((s) => s.itemId === itemId);
    return slot?.quantity ?? 0;
  }

  /**
   * Get a copy of a specific pocket
   */
  getPocket(pocket: keyof BagState): ItemSlot[] {
    return [...this.bag[pocket]];
  }

  /**
   * Get the full bag state (for saving)
   */
  getBagState(): BagState {
    return {
      items: [...this.bag.items],
      keyItems: [...this.bag.keyItems],
      pokeBalls: [...this.bag.pokeBalls],
      tmHm: [...this.bag.tmHm],
      berries: [...this.bag.berries],
    };
  }

  /**
   * Load bag state (from save)
   */
  loadBagState(state: BagState): void {
    this.bag = {
      items: state.items ? [...state.items] : [],
      keyItems: state.keyItems ? [...state.keyItems] : [],
      pokeBalls: state.pokeBalls ? [...state.pokeBalls] : [],
      tmHm: state.tmHm ? [...state.tmHm] : [],
      berries: state.berries ? [...state.berries] : [],
    };
    console.log('[BagManager] Loaded bag state:', {
      items: this.bag.items.length,
      keyItems: this.bag.keyItems.length,
      pokeBalls: this.bag.pokeBalls.length,
      tmHm: this.bag.tmHm.length,
      berries: this.bag.berries.length,
    });
  }

  /**
   * Reset bag to empty (new game)
   */
  reset(): void {
    this.bag = {
      items: [],
      keyItems: [],
      pokeBalls: [],
      tmHm: [],
      berries: [],
    };
    console.log('[BagManager] Bag reset');
  }

  /**
   * Get total item count across all pockets
   */
  getTotalItemCount(): number {
    return (
      this.bag.items.length +
      this.bag.keyItems.length +
      this.bag.pokeBalls.length +
      this.bag.tmHm.length +
      this.bag.berries.length
    );
  }

  /**
   * Debug: print bag contents
   */
  debugPrint(): void {
    console.log('[BagManager] Current bag contents:');
    for (const [pocket, items] of Object.entries(this.bag)) {
      if (items.length > 0) {
        console.log(`  ${pocket}:`, items.map((i: ItemSlot) => `${i.itemId}x${i.quantity}`).join(', '));
      }
    }
  }
}

// Singleton instance
export const bagManager = new BagManagerClass();

// Export for use elsewhere
export { getPocketForItem, POCKET_MAX, ITEM_RANGES };
