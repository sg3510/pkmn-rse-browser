---
title: Battle Full Parity Pass
status: implemented
written_on: 2026-02-21
last_verified: 2026-02-21
---

# Battle Full Parity Pass (2026-02-21)

## Scope

Single-battle Emerald parity pass focused on:

1. Party/menu switching parity and forced faint replacement flow.
2. Move selection legality and no-PP behavior.
3. PP bonus math parity in battle/menu/item flows.
4. Trainer/wild message sequence ordering fixes.
5. Targeted move-effect parity for all missing referenced effects with `moveCount >= 2`.

## Emerald Source Mapping

| Area | TS path(s) | Emerald reference |
| --- | --- | --- |
| Party selection contract and forced replacement | `src/menu/MenuStateManager.ts`, `src/menu/components/PartyMenuContent.tsx`, `src/states/BattleState.ts` | `public/pokeemerald/src/battle_controller_player.c` |
| Move legality + no-PP/disabled/taunt/torment/choice gating | `src/battle/engine/types.ts`, `src/battle/engine/BattleEngine.ts`, `src/states/BattleState.ts` | `public/pokeemerald/src/battle_controller_player.c`, `public/pokeemerald/src/battle_util.c` |
| PP bonus math and PP item logic | `src/pokemon/pp.ts`, `src/pokemon/fieldItemEffects.ts`, `src/pages/GamePage.tsx`, menu/summaries | `public/pokeemerald/src/pokemon.c` (`CalculatePPWithBonus` parity) |
| Battle intro/send-out/faint text ordering | `src/battle/messages/battleMessageSequences.ts`, `src/states/BattleState.ts` | `public/pokeemerald/src/battle_message.c`, `public/pokeemerald/src/battle_script_commands.c` |
| Move-effect parity (targeted list) | `src/battle/engine/MoveEffects.ts`, `src/battle/engine/BattleEngine.ts`, `src/battle/engine/DamageCalculator.ts`, `src/battle/engine/types.ts` | `public/pokeemerald/data/battle_scripts_1.s`, `public/pokeemerald/src/battle_script_commands.c`, `public/pokeemerald/src/battle_util.c` |

## Implemented Checklist

- [x] `BPP-001` Battle party menu contract (`selectionReason`, `allowCancel`, `initialCursorIndex`, `blockedPartyIndexes`) added and wired.
- [x] `BPP-002` Party reorder parity: `SELECT` swap mode enabled outside battle/field-item contexts.
- [x] `BPP-003` Forced faint replacement flow: non-cancelable party select with active/fainted slots blocked.
- [x] `BPP-004` Move action validation layer added (`BattleActionValidationResult`, `MoveSelectionBlockReason`).
- [x] `BPP-005` Invalid move selection no longer silently remaps to first usable move; turn is not consumed.
- [x] `BPP-006` Struggle remains forced fallback only when all moves are unusable.
- [x] `BPP-007` Shared PP helpers added and all UI/battle max-PP displays switched to PP-bonus-aware math.
- [x] `BPP-008` Field vitamins (`HP UP/PROTEIN/IRON/CARBOS/CALCIUM/ZINC`) implemented with EV cap parity (`100`/`510`).
- [x] `BPP-009` Field `PP UP`/`PP MAX` flow implemented with move-slot selection and consume-on-success behavior.
- [x] `BPP-010` Trainer/wild intro and send-out text sequencing moved to shared deterministic builders.
- [x] `BPP-011` Targeted move effects implemented: `EFFECT_RECHARGE`, `EFFECT_FLINCH_MINIMIZE_HIT`, `EFFECT_SEMI_INVULNERABLE`, `EFFECT_RAMPAGE`, `EFFECT_MEAN_LOOK`, `EFFECT_ROAR`, `EFFECT_RECOIL_IF_MISS`, `EFFECT_LOCK_ON`, `EFFECT_FLAIL`, `EFFECT_HEAL_BELL`, `EFFECT_THIEF`, `EFFECT_FORESIGHT`, `EFFECT_ROLLOUT`, `EFFECT_FUTURE_SIGHT`, `EFFECT_SOFTBOILED`, `EFFECT_ERUPTION`.
- [x] `BPP-012` Coverage regression check: missing referenced effects reduced from `110` to `94` (exact `-16` for targeted IDs).

## Notes

- Roar/Whirlwind is implemented for single-battle wild outcome resolution (`battle_end: flee`) and trainer failure path.
- Double-battle-specific branch behavior remains out of scope for this pass.
