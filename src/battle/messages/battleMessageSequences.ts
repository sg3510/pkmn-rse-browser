/**
 * Shared battle message sequencing helpers.
 *
 * C ref:
 * - public/pokeemerald/src/battle_message.c
 * - public/pokeemerald/src/battle_script_commands.c
 */

export function buildBattleIntroMessages(input: {
  battleType: 'wild' | 'trainer';
  trainerLabel?: string;
  enemyName: string;
  playerName: string;
}): string[] {
  if (input.battleType === 'trainer') {
    const trainer = input.trainerLabel?.trim() || 'Trainer';
    return [
      `${trainer} would like to battle!`,
      `${trainer} sent out ${input.enemyName}!`,
      buildPlayerSendOutMessage(input.playerName),
    ];
  }
  return [
    `Wild ${input.enemyName} appeared!`,
    buildPlayerSendOutMessage(input.playerName),
  ];
}

export function buildTrainerSendOutMessage(trainerLabel: string, enemyName: string): string {
  const trainer = trainerLabel.trim() || 'Trainer';
  return `${trainer} sent out ${enemyName}!`;
}

export function buildPlayerSendOutMessage(playerName: string): string {
  return `Go! ${playerName}!`;
}

export function buildPlayerSwitchMessages(activeName: string, nextName: string): [string, string] {
  return [
    `${activeName}, that's enough! Come back!`,
    buildPlayerSendOutMessage(nextName),
  ];
}
