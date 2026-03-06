# Pokemon Emerald TypeScript Browser Port

This project is a browser-based TypeScript port of the Game Boy Advance
`pokeemerald` codebase, with a WebGL-first rendering pipeline and a strong
focus on behavior parity with the original game.

It aims to let you play Pokemon Emerald in the browser while preserving the
original game logic, map behavior, script flow, and presentation rules as
closely as possible.

## Authorship and Date

- This README was created by Codex.
- Date: March 6, 2026.

## What This Repo Is

- A TypeScript runtime for Pokemon Emerald gameplay systems.
- A WebGL-powered map/sprite renderer for performance at larger viewports.
- A documentation-first reverse-port effort grounded in the original C source.
- A work-in-progress parity project (some systems are complete, others are
  still being implemented).

## Core Approach

For parity-sensitive features, implementation follows this pattern:

1. Read original C source in `public/pokeemerald/` first.
2. Translate behavior into TypeScript with matching semantics.
3. Verify behavior in-game and via debug tooling.
4. Keep implementation notes and plans updated under `docs/`.

`public/pokeemerald/` is treated as read-only reference source.

## Upstream Reference (`pret/pokeemerald`)

The upstream decompilation project this port is based on is:

- [pret/pokeemerald](https://github.com/pret/pokeemerald)

This TypeScript project uses that codebase as the behavioral source of truth
for parity work. In practice, we read the original C logic first, then
implement equivalent behavior for browser runtime systems (gameplay logic,
scripts, movement, and rendering rules).

## Rendering Architecture (WebGL + Browser)

The runtime uses a tile/camera model similar to the GBA game, then renders
through browser graphics APIs:

- WebGL map pipeline for tile layers and large viewport performance.
- Sprite rendering with ordering/layering rules that mirror Emerald behavior.
- Camera-driven viewport rendering instead of full-map blitting.
- Canvas-based state/UI overlays where appropriate.
- Debug overlays for collision, elevation, tile diagnostics, and renderer stats.

This gives the project room to support larger-than-GBA viewport sizes while
preserving the core game feel.

## Project Structure

- `src/`: TypeScript gameplay/runtime source.
- `public/pokeemerald/`: original C source and assets used as reference.
- `docs/`: architecture notes, feature docs, implementation plans, backlog.
- `scripts/`: data generation and validation scripts.
- `.github/workflows/deploy-pages.yml`: GitHub Pages build/deploy workflow.

Start here for docs: `docs/README.md`.

## Getting Started

### Prerequisites

- Node.js `>=20.19.0`
- npm

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`).

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Useful Scripts

The repo contains many generation/verification scripts for extracted game data.
Examples:

- `npm run generate:scripts`
- `npm run generate:wild-encounters`
- `npm run generate:battle-data`
- `npm run verify:generated:battle`
- `npm run audit:parity`

See `package.json` for the full list.

## Deployment

Deployment is configured through GitHub Actions:

- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main` (or manual workflow dispatch)
- Output: GitHub Pages artifact from `dist/`

## Ongoing Harness Effort

There is an ongoing effort to build an autonomous harness that can drive the
game, run repeatable scenarios, and collect parity signals automatically. The
goal is to speed up continued porting by reducing manual verification work and
making regressions easier to catch during development.

## Documentation and Status

Detailed implementation status and plans live in `docs/`:

- Documentation index: `docs/README.md`
- Feature work: `docs/features/`
- Systems design: `docs/systems/`
- Architecture notes: `docs/architecture/`
- Backlog: `docs/backlog/todolist.md`

## Credits

- Original game decompilation and primary reference:
  [pret/pokeemerald](https://github.com/pret/pokeemerald)
