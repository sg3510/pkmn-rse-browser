/**
 * Money Manager
 *
 * Manages the player's money, Game Corner coins, and registered item.
 * Thin wrapper delegating to SaveStateStore (follows BagManager pattern).
 *
 * C references:
 * - public/pokeemerald/src/money.c
 * - public/pokeemerald/src/coins.c
 * - public/pokeemerald/include/constants/global.h (MAX_MONEY, MAX_COINS)
 */

import { saveStateStore } from '../save/SaveStateStore';

const MAX_MONEY = 999999;
const MAX_COINS = 9999;

class MoneyManagerClass {
  // === Money ===

  getMoney(): number {
    return saveStateStore.getMoney();
  }

  setMoney(amount: number): void {
    saveStateStore.setMoney(amount);
  }

  addMoney(amount: number): void {
    saveStateStore.setMoney(this.getMoney() + amount);
  }

  removeMoney(amount: number): boolean {
    if (this.getMoney() < amount) return false;
    saveStateStore.setMoney(this.getMoney() - amount);
    return true;
  }

  isEnoughMoney(amount: number): boolean {
    return this.getMoney() >= amount;
  }

  // === Coins ===

  getCoins(): number {
    return saveStateStore.getCoins();
  }

  setCoins(amount: number): void {
    saveStateStore.setCoins(amount);
  }

  addCoins(amount: number): boolean {
    const newTotal = this.getCoins() + amount;
    if (newTotal > MAX_COINS) return false;
    saveStateStore.setCoins(newTotal);
    return true;
  }

  removeCoins(amount: number): boolean {
    if (this.getCoins() < amount) return false;
    saveStateStore.setCoins(this.getCoins() - amount);
    return true;
  }

  // === Registered Item ===

  getRegisteredItem(): number {
    return saveStateStore.getRegisteredItem();
  }

  setRegisteredItem(itemId: number): void {
    saveStateStore.setRegisteredItem(itemId);
  }

  // === Reset ===

  reset(): void {
    saveStateStore.setMoney(3000);
    saveStateStore.setCoins(0);
    saveStateStore.setRegisteredItem(0);
  }
}

export const moneyManager = new MoneyManagerClass();
export { MAX_MONEY, MAX_COINS };
