# AGENT INSTRUCTIONS

Agent-facing instructions for working in this repo. See [docs/README.md](docs/README.md) for project overview.

## Key paths

| Path | Description |
|---|---|
| `docs/` | All documentation (features, guides, architecture, backlog) |
| `docs/README.md` | Project README |
| `docs/backlog/todolist.md` | Master backlog |
| `public/pokeemerald/` | Original C source (read-only reference — **never edit**) |
| `src/` | TypeScript source |

## Documentation-first workflow

- Read `docs/` before implementing or changing behavior.
- Use doc frontmatter (`status`, `last_verified`) to distinguish implemented vs planned.
- When referencing docs from code comments or other docs, use `docs/` paths.

## C-to-TypeScript parity

For any feature that should match the original GBA game 1:1:

1. Read the C source in `public/pokeemerald/` first — understand behavior before translating.
2. Use the C code as the primary debugging reference.
3. Prefer the original hierarchy and structure unless it clearly doesn't fit TypeScript.
4. Add a comment at the top of translated files pointing to the original C source.

## Code reuse

- Search the whole codebase (`src/utils/`, `src/scripting/`, existing managers) before writing new code.
- Use generators (e.g. `scripts/generate-scripts.cjs`) for data-driven output.
- Prefer modular, scalable abstractions over one-off implementations.

## Input mapping policy

- Always use the shared input mapping (`src/core/InputMap.ts`) for gameplay and menu controls.
- Do not add hardcoded key checks when an action should be mapped through `InputMap`.
- If a required action has no mapped path yet, wire it through `InputMap` and the relevant input hook before adding feature logic.

## Save compatibility

- When implementing a feature that uses persistent state from the original C code, ensure it can be saved to and loaded from save files.
- Purely temporary runtime state does not need save support.

## Task tracking

- When working from any TODO list, mark tasks as complete when finished.
