---
title: Architecture Lessons & Summary
status: reference
last_verified: 2026-01-13
---

# Architecture Lessons & Summary

## The "Main Callback" Pattern

The most important architectural lesson from the GBA source is the **Main Callback** pattern (`SetMainCallback2`).

### How it works
The game is not a single giant `update()` function with a switch statement. Instead, the `gMain.callback2` function pointer *is* the game engine at that moment.

*   **Advantage**: Extreme modularity. The "Battle Engine" doesn't need to know about the "Overworld Engine". They just agree on how to hand off control (setup data -> switch callback).
*   **Application**: In our React/Browser port, we should model this as a top-level `<GameLoop>` component that renders exactly *one* active "State Component" (e.g., `<Overworld />`, `<Battle />`, `<TitleScreen />`) based on a state machine.

## The Task System

Secondary to the Main Callback is the `Task` system.
*   **Purpose**: Managing asynchronous, long-lived operations *within* a state.
*   **Examples**: Moving a sprite from A to B over 60 frames, fading the screen, running the Birch intro sequence.
*   **Application**: We should use `useEffect` hooks or a custom "Task Manager" class to handle sequential animations and logic that spans multiple frames, rather than hard-coding them into the main render loop.

## Scripting Integration

The game is heavily data-driven via **Bytecode Scripts** (`script.c`).
*   **Observation**: Logic for "What happens when I talk to this NPC?" is NOT in the C code. It's in a script file interpreted at runtime.
*   **Application**: We should define our interaction logic in a similar data format (JSON or a custom DSL) rather than hard-coding interactions in TypeScript. This allows for rapid content creation and separates "Engine" from "Game Content".

## Memory & Resource Management

The GBA has limited RAM, so it aggressively loads/unloads assets between states.
*   **Observation**: `CB2_InitBattle` completely overwrites Video RAM used by the Overworld. `CB2_ReturnToField` reloads it.
*   **Application**: While browsers have more RAM, we should still follow this pattern for performance. Unmount the `<Overworld />` component completely when entering `<Battle />` to free up WebGL contexts and DOM nodes.

## Conclusion

The Pokemon Emerald source code reveals a disciplined, state-machine-driven architecture. It separates high-level Game States (Callbacks) from low-level Frame Logic (Tasks) and Content Logic (Scripts). Emulating this three-tiered structure (State -> Task -> Script) will be key to a faithful and maintainable browser recreation.
