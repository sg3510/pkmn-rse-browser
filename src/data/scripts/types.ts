/**
 * Type definitions for parsed script data.
 *
 * Generated .gen.ts files conform to these types.
 * The ScriptRunner consumes MapScriptData at runtime.
 */

export interface ScriptCommand {
  cmd: string;
  args?: (string | number)[];
}

export interface OnFrameEntry {
  var: string;
  value: number | string;
  script: string;
}

export interface MapScriptHeader {
  onLoad?: string;
  onTransition?: string;
  onResume?: string;
  onFrame?: OnFrameEntry[];
  onWarpInto?: OnFrameEntry[];
}

export interface MapScriptData {
  mapScripts: MapScriptHeader;
  scripts: Record<string, ScriptCommand[]>;
  movements: Record<string, string[]>;
  text: Record<string, string>;
}
