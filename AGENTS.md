# AGENT INSTRUCTIONS

## Scope
This README is agent-facing. Follow these instructions when working in this repo.

## Documentation-first workflow
- Explore `docs/` before implementing or changing behavior.
- Use the doc status frontmatter to understand what is implemented vs planned.

## GBA C parity (1:1 features)
- When implementing a feature that should match the original game 1:1, read the base C source in `public/pokeemerald/` first.
- Understand how the C code behaves before translating to TypeScript.
- The C code is also the primary reference when debugging TypeScript for 1:1 features.

## Translation guidance (C -> TypeScript)
- When writing TypeScript that is a translation of C, add a short comment at the top of the file that points to the original C files.
- Prefer the original hierarchy and structure from the C code unless it clearly does not make sense in TypeScript.

## Task tracking
- When working from any TODO list, always mark tasks as complete when finished.

## Docs location
- All documentation lives under `docs/`.
- If you reference a doc from code comments or other docs, use the `docs/` path.
- the main readme is in docs/README.md
- the main backlog is in docs/backlog/todolist.md