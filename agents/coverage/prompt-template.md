You are analyzing C source files from the pokeemerald decompilation against a TypeScript browser port.

## Your Task

For each C file provided, determine what has been ported to TypeScript, what is covered by code generation scripts, and what is missing.

## TypeScript Project File Tree

These are all hand-written TypeScript files in the port (excluding generated files):

```
{{TS_FILE_TREE}}
```

## Generated Files

These TypeScript files are auto-generated from C source by build scripts (do NOT count as hand-ported):

```
{{GENERATED_FILES}}
```

## Generator Manifest

These scripts parse C source and output generated TypeScript. If a C file is consumed by a generator, note it.

```
{{GENERATOR_MANIFEST}}
```

## C Source Files to Analyze

{{C_FILE_CONTENTS}}

## Output Format

For EACH C source file in this batch, output a section in this exact format:

```
### `path/to/file.c`
**Coverage**: Full | Partial | Data-Only | None
**TS equivalent(s)**: `src/path/file.ts` or "None"
**Generation script**: `scripts/generate-xyz.cjs` or "None"

#### Implemented
- [x] function_name — brief description of what it does

#### Partially Implemented
- [-] function_name - brief description of what it does and why not fully done

#### Missing
- [ ] function_name — brief description of what it does

#### No good TS-equivalent

-[/] - function_name - completes a task that is specific to GBA hardware and won't be needed even in a full JS implementation

#### Notes
Any relevant context: intentional omissions (link cable, e-Reader, post-game, etc.), partial implementations, architectural differences between C and TS versions.
```

## Coverage Definitions

- **Full**: All meaningful functions/data ported or generated
- **Partial**: Some functions ported, others missing
- **Data-Only**: Only data tables/constants ported (via generation script), no runtime logic
- **None**: No TypeScript equivalent exists
- **No good TS-equivalent**: When the logic is specific to GBA hardware.

## Guidelines

1. Match C functions to TS by **purpose**, not name (the TS port uses different naming conventions)
2. A function covered by a `.gen.ts` file counts as "generated", not "implemented" — note the generator script
3. Ignore trivial differences (memory management, GBA hardware registers, DMA, interrupt handlers)
4. Hardware-specific code with no browser equivalent (SIO, link cable, flash memory) should be noted as intentionally omitted
5. Focus on gameplay-relevant functions: battle logic, overworld, menus, scripts, pokemon data, items, etc.
6. For header files, focus on whether constants/enums/structs have TS equivalents
7. Be concise — one line per function, don't explain obvious things
8. If a C file is very large, you may group related helper functions (e.g., "12 static helper functions for X")

Respond ONLY with the markdown analysis sections. No preamble, no summary.
