import type { StepCallbackDebugState } from '../StepCallbackManager.ts';
import { isDebugMode } from '../../utils/debug.ts';

const MAX_TIMELINE_EVENTS = 512;

export type StoryScriptTimelineKind =
  | 'step_callback_tick'
  | 'on_frame_trigger'
  | 'story_script_start'
  | 'story_script_end'
  | 'lock_wait_start'
  | 'lock_wait_end'
  | 'warphole_coords';

export interface StoryScriptTimelineEvent {
  kind: StoryScriptTimelineKind;
  timestampMs: number;
  frame: number | null;
  mapId: string | null;
  scriptName?: string;
  callback?: StepCallbackDebugState;
  details?: Record<string, unknown>;
}

export interface StoryScriptTimelineWindowApi {
  dump: () => StoryScriptTimelineEvent[];
  clear: () => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: () => boolean;
}

let forceEnabled: boolean | null = null;
const timelineEvents: StoryScriptTimelineEvent[] = [];

function shouldCaptureTimeline(): boolean {
  if (forceEnabled !== null) {
    return forceEnabled;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  if (window.__PKMN_DEBUG_TIMELINE === true) {
    return true;
  }

  return isDebugMode() || isDebugMode('field');
}

export function setStoryScriptTimelineEnabled(enabled: boolean): void {
  forceEnabled = enabled;
}

export function isStoryScriptTimelineEnabled(): boolean {
  return shouldCaptureTimeline();
}

export function clearStoryScriptTimeline(): void {
  timelineEvents.length = 0;
}

export function dumpStoryScriptTimeline(): StoryScriptTimelineEvent[] {
  return [...timelineEvents];
}

export function recordStoryScriptTimelineEvent(
  event: Omit<StoryScriptTimelineEvent, 'timestampMs'>
): void {
  if (!shouldCaptureTimeline()) {
    return;
  }

  timelineEvents.push({
    ...event,
    timestampMs: performance.now(),
  });

  if (timelineEvents.length > MAX_TIMELINE_EVENTS) {
    timelineEvents.splice(0, timelineEvents.length - MAX_TIMELINE_EVENTS);
  }
}

declare global {
  interface Window {
    __PKMN_DEBUG_TIMELINE?: boolean;
    __PKMN_STORY_TIMELINE?: StoryScriptTimelineWindowApi;
  }
}

if (typeof window !== 'undefined' && !window.__PKMN_STORY_TIMELINE) {
  window.__PKMN_STORY_TIMELINE = {
    dump: () => dumpStoryScriptTimeline(),
    clear: () => clearStoryScriptTimeline(),
    setEnabled: (enabled: boolean) => setStoryScriptTimelineEnabled(enabled),
    isEnabled: () => isStoryScriptTimelineEnabled(),
  };
}
