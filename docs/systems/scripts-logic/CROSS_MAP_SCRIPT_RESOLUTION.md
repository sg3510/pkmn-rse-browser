---
title: Cross-Map Script Resolution
status: reference
last_verified: 2026-02-20
---

# Cross-Map Script Resolution

## Why This Exists

Some map event/object scripts point to labels owned by a different map script file. A map-local-only lookup causes false `missing-script` failures (for example, trainer interactions in Lavaridge Gym B1F).

## Runtime Rule

Script command lookup now resolves labels in this order:

1. Active map scripts
2. Generated label owner map scripts
3. Common scripts (`common.gen.ts`)

If a label has multiple owner maps (collision), fallback is refused and logged so behavior stays deterministic.

## Generated Ownership Index

- File: `src/data/scripts/scriptLabelOwners.gen.ts`
- Produced by: `npm run generate:scripts`
- Exports:
  - `SCRIPT_LABEL_OWNER_MAP`
  - `SCRIPT_LABEL_OWNER_COLLISIONS`

## Guardrails

- Script-resolution audit: `npm run audit:scripts:resolution`
  - Fails on unresolved map event script refs.
  - Fails on label owner collisions.
