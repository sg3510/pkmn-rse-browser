---
title: Documentation Index
status: reference
last_verified: 2026-02-06
---

# Documentation Index

This folder uses frontmatter in every markdown document to make status explicit.

## Status legend
- implemented: Feature or change is complete and verified in code.
- in-progress: Work has started; doc may lag or lead current code.
- planned: Design or plan exists, but implementation is not done.
- research: Investigation, analysis, or findings; not a commitment to implement.
- bug: Known issue, repro notes, or bug analysis.
- reference: Stable background info, guides, or inventories.

## Top-level areas
- architecture: `docs/architecture/`
- features: `docs/features/`
- systems: `docs/systems/`
- projects: `docs/projects/`
- releases: `docs/releases/`
- guides: `docs/guides/`
- backlog: `docs/backlog/`
- assets: `docs/assets/`
- experiments: `docs/experiments/`

## Recently Updated
- Birch intro rendering/layering + scaling notes: `docs/architecture/intro/birch-intro-rendering.md`
- Prompt/menu/move-flow unification architecture note: `docs/architecture/prompt-menu-unification.md`

## How to keep docs accurate
1. Update the frontmatter `status` and `last_verified` whenever behavior changes.
2. Prefer feature-local docs over global docs unless the topic is truly cross-cutting.
3. Link related docs in a short "Related" section near the top of each document.
