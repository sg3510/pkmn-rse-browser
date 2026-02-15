import fs from "node:fs/promises";
import path from "node:path";

import { resolveMask } from "./buttons.js";
import { MgbaClient } from "./mgbaClient.js";
import { parseNonNegativeInt, parseNumeric } from "./numbers.js";
import type { HarnessScript, HarnessStep } from "./types.js";

type CliOptions = {
  scriptPath: string;
  hostOverride?: string;
  portOverride?: number;
  timeoutOverrideMs?: number;
};

function printUsage(): void {
  console.log(`Usage:
  node dist/runHarness.js --script ./examples/title-screen.json [--host 127.0.0.1] [--port 61337] [--timeout-ms 15000]

Description:
  Executes a JSON action script against a running mGBA instance with lua/mgba_harness.lua loaded.
`);
}

function parseCliArgs(argv: string[]): CliOptions {
  let scriptPath = "";
  let hostOverride: string | undefined;
  let portOverride: number | undefined;
  let timeoutOverrideMs: number | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--script") {
      scriptPath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg === "--host") {
      hostOverride = argv[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg === "--port") {
      portOverride = parseNonNegativeInt(argv[i + 1] ?? "", "--port");
      i += 1;
      continue;
    }

    if (arg === "--timeout-ms") {
      timeoutOverrideMs = parseNonNegativeInt(argv[i + 1] ?? "", "--timeout-ms");
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (scriptPath.length === 0) {
    throw new Error("--script is required.");
  }

  return {
    scriptPath,
    hostOverride,
    portOverride,
    timeoutOverrideMs
  };
}

function parseScript(rawJson: string): HarnessScript {
  const parsed = JSON.parse(rawJson) as Partial<HarnessScript>;
  if (!parsed || !Array.isArray(parsed.steps)) {
    throw new Error("Harness script must include a steps array.");
  }
  return parsed as HarnessScript;
}

function resolveStepPath(baseDir: string, rawPath: string): string {
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(baseDir, rawPath);
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function assertStepMask(step: HarnessStep, label: string): number {
  const mask = resolveMask(step as Record<string, unknown>, label);
  if (mask === undefined) {
    throw new Error(`${label} requires one of: mask, button, or buttons.`);
  }
  return mask;
}

function stepPrefix(index: number, total: number): string {
  return `[${index + 1}/${total}]`;
}

function describeStep(step: HarnessStep): string {
  if (step.note) {
    return `${step.action} - ${step.note}`;
  }
  return step.action;
}

async function executeStep(
  client: MgbaClient,
  step: HarnessStep,
  index: number,
  total: number,
  scriptBaseDir: string
): Promise<void> {
  const prefix = stepPrefix(index, total);
  const label = `steps[${index}]`;
  console.log(`${prefix} ${describeStep(step)}`);

  switch (step.action) {
    case "ping": {
      await client.ping();
      return;
    }

    case "frame": {
      const frame = await client.frame();
      if (step.expect !== undefined) {
        const expectedFrame = parseNonNegativeInt(parseNumeric(step.expect, `${label}.expect`), `${label}.expect`);
        if (frame !== expectedFrame) {
          throw new Error(`${label}: expected frame ${expectedFrame}, got ${frame}.`);
        }
      }
      console.log(`${prefix} frame=${frame}`);
      return;
    }

    case "waitMs": {
      const ms = parseNonNegativeInt(parseNumeric(step.ms, `${label}.ms`), `${label}.ms`);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });
      return;
    }

    case "clearKeys": {
      await client.clearKeys();
      return;
    }

    case "reset": {
      await client.reset();
      return;
    }

    case "hold": {
      const mask = assertStepMask(step, label);
      await client.pressMask(mask);
      return;
    }

    case "release": {
      const mask = assertStepMask(step, label);
      await client.releaseMask(mask);
      return;
    }

    case "advance": {
      const frames = parseNonNegativeInt(parseNumeric(step.frames, `${label}.frames`), `${label}.frames`);
      const mask = resolveMask(step as Record<string, unknown>, label);
      const resultingFrame = await client.advance(frames, mask);
      console.log(`${prefix} advanced to frame ${resultingFrame}`);
      return;
    }

    case "tap": {
      const mask = assertStepMask(step, label);
      const pressFrames = parseNonNegativeInt(parseNumeric(step.frames ?? 1, `${label}.frames`), `${label}.frames`);
      const afterFrames = parseNonNegativeInt(
        parseNumeric(step.afterFrames ?? 0, `${label}.afterFrames`),
        `${label}.afterFrames`
      );

      await client.advance(pressFrames, mask);
      if (afterFrames > 0) {
        await client.advance(afterFrames);
      }
      return;
    }

    case "read8":
    case "read16":
    case "read32": {
      const address = parseNonNegativeInt(parseNumeric(step.address, `${label}.address`), `${label}.address`);
      const value =
        step.action === "read8"
          ? await client.read8(address)
          : step.action === "read16"
            ? await client.read16(address)
            : await client.read32(address);

      if (step.expect !== undefined) {
        const expected = parseNonNegativeInt(parseNumeric(step.expect, `${label}.expect`), `${label}.expect`);
        if (value !== expected) {
          throw new Error(`${label}: expected ${step.action} value ${expected}, got ${value}.`);
        }
      }

      console.log(`${prefix} ${step.action} 0x${address.toString(16).toUpperCase()} => ${value}`);
      return;
    }

    case "write8":
    case "write16":
    case "write32": {
      const address = parseNonNegativeInt(parseNumeric(step.address, `${label}.address`), `${label}.address`);
      const value = parseNonNegativeInt(parseNumeric(step.value, `${label}.value`), `${label}.value`);

      if (step.action === "write8") {
        await client.write8(address, value);
      } else if (step.action === "write16") {
        await client.write16(address, value);
      } else {
        await client.write32(address, value);
      }
      return;
    }

    case "screenshot":
    case "saveState":
    case "loadState": {
      const resolved = resolveStepPath(scriptBaseDir, step.path);
      await ensureParentDir(resolved);

      if (step.action === "screenshot") {
        await client.screenshot(resolved);
      } else if (step.action === "saveState") {
        await client.saveState(resolved);
      } else {
        await client.loadState(resolved);
      }

      console.log(`${prefix} wrote ${resolved}`);
      return;
    }

    default: {
      const unknownAction: never = step;
      throw new Error(`Unsupported action: ${JSON.stringify(unknownAction)}`);
    }
  }
}

async function main(): Promise<void> {
  const cli = parseCliArgs(process.argv.slice(2));
  const resolvedScriptPath = path.resolve(process.cwd(), cli.scriptPath);
  const scriptBaseDir = path.dirname(resolvedScriptPath);

  const scriptJson = await fs.readFile(resolvedScriptPath, "utf8");
  const script = parseScript(scriptJson);

  const host = cli.hostOverride ?? script.host ?? "127.0.0.1";
  const port =
    cli.portOverride ??
    parseNonNegativeInt(parseNumeric(script.port ?? 61337, "script.port"), "script.port");
  const timeoutMs =
    cli.timeoutOverrideMs ??
    parseNonNegativeInt(parseNumeric(script.timeoutMs ?? 15_000, "script.timeoutMs"), "script.timeoutMs");

  let client: MgbaClient | null = null;
  try {
    client = await MgbaClient.connect({
      host,
      port,
      defaultTimeoutMs: timeoutMs,
      connectTimeoutMs: timeoutMs
    });
    await client.ping();
    console.log(`[gba_harness] Connected to ${host}:${port}`);

    for (let i = 0; i < script.steps.length; i += 1) {
      await executeStep(client, script.steps[i], i, script.steps.length, scriptBaseDir);
    }

    console.log(`[gba_harness] Completed ${script.steps.length} step(s).`);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

void main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[gba_harness] ${error.message}`);
  } else {
    console.error(`[gba_harness] ${String(error)}`);
  }
  process.exitCode = 1;
});
