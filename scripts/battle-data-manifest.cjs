#!/usr/bin/env node
/**
 * Canonical manifest for battle-data generators.
 *
 * This keeps generation and verification wiring in one place so
 * battle data structures are imported at scale from generator scripts.
 */

const BATTLE_DATA_GENERATORS = Object.freeze([
  {
    id: 'trainer-ids',
    script: 'scripts/generate-trainer-ids.cjs',
    outputs: ['src/data/trainerIds.gen.ts'],
    description: 'Trainer ID constants',
  },
  {
    id: 'trainer-parties',
    script: 'scripts/generate-trainer-parties.cjs',
    outputs: ['src/data/trainerParties.gen.ts'],
    description: 'Trainer party rosters and custom moves',
  },
  {
    id: 'learnsets',
    script: 'scripts/generate-learnsets.cjs',
    outputs: ['src/data/learnsets.gen.ts'],
    description: 'Species level-up learnsets',
  },
  {
    id: 'evolutions',
    script: 'scripts/generate-evolutions.cjs',
    outputs: ['src/data/evolutions.gen.ts'],
    description: 'Species evolution rules',
  },
  {
    id: 'battle-moves',
    script: 'scripts/generate-battle-moves.cjs',
    outputs: ['src/data/battleMoves.gen.ts'],
    description: 'Battle move metadata',
  },
  {
    id: 'wild-encounters',
    script: 'scripts/generate-wild-encounters.cjs',
    outputs: ['src/data/wildEncounters.gen.ts'],
    description: 'Per-map wild encounter tables and slot rates',
  },
  {
    id: 'battle-scripts',
    script: 'scripts/generate-battle-scripts.cjs',
    outputs: ['src/data/battleScripts.gen.ts'],
    description: 'Battle script command blocks and move-effect table',
  },
  {
    id: 'battle-move-effects',
    script: 'scripts/generate-battle-move-effects.cjs',
    outputs: ['src/data/battleMoveEffects.gen.ts'],
    description: 'Move-effect to move/script index',
  },
  {
    id: 'battle-constants',
    script: 'scripts/generate-battle-constants.cjs',
    outputs: ['src/data/battleConstants.gen.ts'],
    description: 'Battle constants extracted from C headers',
  },
  {
    id: 'item-effects',
    script: 'scripts/generate-item-battle-effects.cjs',
    outputs: ['src/data/itemBattleEffects.gen.ts'],
    description: 'Battle item effect definitions',
  },
]);

const BATTLE_DATA_GENERATOR_IDS = Object.freeze(
  BATTLE_DATA_GENERATORS.map((entry) => entry.id),
);

const BATTLE_DATA_GENERATOR_SCRIPTS = Object.freeze(
  BATTLE_DATA_GENERATORS.map((entry) => entry.script),
);

const BATTLE_DATA_GENERATED_FILES = Object.freeze(
  Array.from(new Set(BATTLE_DATA_GENERATORS.flatMap((entry) => entry.outputs))),
);

module.exports = {
  BATTLE_DATA_GENERATORS,
  BATTLE_DATA_GENERATOR_IDS,
  BATTLE_DATA_GENERATOR_SCRIPTS,
  BATTLE_DATA_GENERATED_FILES,
};
