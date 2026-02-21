import assert from 'node:assert/strict';
import test from 'node:test';
import {
  updateScriptedWarpStateMachine,
  type PendingScriptedWarp,
  type ScriptedWarpLoadMonitor,
} from '../overworldGameUpdate.ts';
import type { PlayerController } from '../../../game/PlayerController.ts';
import type { WorldManager } from '../../../game/WorldManager.ts';
import type { FadeController } from '../../../field/FadeController.ts';
import type { WarpHandler } from '../../../field/WarpHandler.ts';
import type { InputUnlockGuards } from '../../../game/overworld/inputLock/scheduleInputUnlock.ts';

interface MutableRef<T> {
  current: T;
}

interface DeferredState {
  completion: NonNullable<PendingScriptedWarp['completion']>;
  getResolved: () => boolean;
  getRejected: () => boolean;
  getError: () => unknown;
}

function createWarpCompletionDeferred(): DeferredState {
  let resolveCompletion!: () => void;
  let rejectCompletion!: (error?: unknown) => void;
  let resolved = false;
  let rejected = false;
  let rejectionError: unknown = null;
  const promise = new Promise<void>((resolve, reject) => {
    resolveCompletion = () => {
      resolved = true;
      resolve();
    };
    rejectCompletion = (error?: unknown) => {
      rejected = true;
      rejectionError = error;
      reject(error);
    };
  });
  void promise.catch(() => {});
  return {
    completion: {
      promise,
      resolve: resolveCompletion,
      reject: rejectCompletion,
      settled: false,
    },
    getResolved: () => resolved,
    getRejected: () => rejected,
    getError: () => rejectionError,
  };
}

function createFadeStub() {
  let direction: 'in' | 'out' | null = null;
  let active = false;
  let fadeInStarts = 0;
  return {
    fade: {
      getDirection: () => direction,
      isActive: () => active,
      isComplete: () => true,
      startFadeIn: () => {
        direction = 'in';
        active = true;
        fadeInStarts++;
      },
      startFadeOut: () => {
        direction = 'out';
        active = true;
      },
    } as unknown as FadeController,
    getFadeInStarts: () => fadeInStarts,
  };
}

function createPlayerStub(unlockCalls: { count: number }): PlayerController {
  const player = {
    tileX: 9,
    tileY: 17,
    unlockInput: () => {
      unlockCalls.count++;
    },
  };
  return player as unknown as PlayerController;
}

function createWorldManagerStub(mapId: string): WorldManager {
  const manager = {
    findMapAtPosition: () => ({ entry: { id: mapId } }),
  };
  return manager as unknown as WorldManager;
}

function createWarpHandlerStub(updateCalls: { count: number }): WarpHandler {
  const handler = {
    updateLastCheckedTile: () => {
      updateCalls.count++;
    },
  };
  return handler as unknown as WarpHandler;
}

test('style=fall keeps warp locked and defers unlock until fall sequencer completes', () => {
  const mapId = 'MAP_SKY_PILLAR_4F';
  const pendingScriptedWarpRef: MutableRef<PendingScriptedWarp | null> = {
    current: {
      mapId,
      x: 2,
      y: 3,
      direction: 'down',
      phase: 'loading',
      style: 'fall',
    },
  };
  const scriptedWarpLoadMonitorRef: MutableRef<ScriptedWarpLoadMonitor | null> = {
    current: {
      mapId,
      startedAt: 0,
      retries: 0,
      fallbackDeferredLogged: false,
    },
  };
  const warpingRef: MutableRef<boolean> = { current: true };
  const loadingRef: MutableRef<boolean> = { current: false };
  const pendingSavedLocationRef: MutableRef<any> = { current: null };
  const unlockCalls = { count: 0 };
  const playerRef: MutableRef<PlayerController | null> = { current: createPlayerStub(unlockCalls) };
  const worldManagerRef: MutableRef<WorldManager | null> = { current: createWorldManagerStub(mapId) };
  const updateLastCheckedTileCalls = { count: 0 };
  const { fade, getFadeInStarts } = createFadeStub();
  const warpHandler = createWarpHandlerStub(updateLastCheckedTileCalls);
  const inputUnlockGuards: InputUnlockGuards = {
    warpingRef,
    storyScriptRunningRef: { current: false },
    dialogIsOpenRef: { current: false },
  };
  let fallStartCalls = 0;

  updateScriptedWarpStateMachine({
    nowTime: 100,
    pendingScriptedWarpRef,
    scriptedWarpLoadMonitorRef,
    warpingRef,
    loadingRef,
    pendingSavedLocationRef,
    warpHandler,
    fadeController: fade,
    playerRef,
    worldManagerRef,
    inputUnlockGuards,
    selectMapForLoad: () => {},
    startFallWarpArrival: () => {
      fallStartCalls++;
      return true;
    },
  });

  assert.equal(fallStartCalls, 1);
  assert.equal(getFadeInStarts(), 1);
  assert.equal(updateLastCheckedTileCalls.count, 1);
  assert.equal(pendingScriptedWarpRef.current, null);
  assert.equal(scriptedWarpLoadMonitorRef.current, null);
  assert.equal(warpingRef.current, true);
  assert.equal(unlockCalls.count, 0);
});

test('style=default resolves completion only after fade/unlock timeout', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const queuedTimeouts: Array<() => void> = [];
  globalThis.setTimeout = ((handler: TimerHandler) => {
    queuedTimeouts.push(() => {
      if (typeof handler === 'function') {
        handler();
      }
    });
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  try {
    const mapId = 'MAP_ROUTE111';
    const deferred = createWarpCompletionDeferred();
    const pendingScriptedWarpRef: MutableRef<PendingScriptedWarp | null> = {
      current: {
        mapId,
        x: 1,
        y: 1,
        direction: 'down',
        phase: 'loading',
        style: 'default',
        completion: deferred.completion,
      },
    };
    const scriptedWarpLoadMonitorRef: MutableRef<ScriptedWarpLoadMonitor | null> = {
      current: {
        mapId,
        startedAt: 0,
        retries: 0,
        fallbackDeferredLogged: false,
      },
    };
    const warpingRef: MutableRef<boolean> = { current: true };
    const loadingRef: MutableRef<boolean> = { current: false };
    const pendingSavedLocationRef: MutableRef<any> = { current: null };
    const unlockCalls = { count: 0 };
    const playerRef: MutableRef<PlayerController | null> = { current: createPlayerStub(unlockCalls) };
    const worldManagerRef: MutableRef<WorldManager | null> = { current: createWorldManagerStub(mapId) };
    const updateLastCheckedTileCalls = { count: 0 };
    const { fade, getFadeInStarts } = createFadeStub();
    const warpHandler = createWarpHandlerStub(updateLastCheckedTileCalls);
    const inputUnlockGuards: InputUnlockGuards = {
      warpingRef,
      storyScriptRunningRef: { current: false },
      dialogIsOpenRef: { current: false },
    };
    let fallStartCalls = 0;

    updateScriptedWarpStateMachine({
      nowTime: 100,
      pendingScriptedWarpRef,
      scriptedWarpLoadMonitorRef,
      warpingRef,
      loadingRef,
      pendingSavedLocationRef,
      warpHandler,
      fadeController: fade,
      playerRef,
      worldManagerRef,
      inputUnlockGuards,
      selectMapForLoad: () => {},
      startFallWarpArrival: () => {
        fallStartCalls++;
        return true;
      },
    });

    await Promise.resolve();
    assert.equal(deferred.getResolved(), false);
    assert.equal(unlockCalls.count, 0);

    for (const runTimeout of queuedTimeouts) {
      runTimeout();
    }
    await Promise.resolve();

    assert.equal(fallStartCalls, 0);
    assert.equal(getFadeInStarts(), 1);
    assert.equal(updateLastCheckedTileCalls.count, 1);
    assert.equal(pendingScriptedWarpRef.current, null);
    assert.equal(scriptedWarpLoadMonitorRef.current, null);
    assert.equal(warpingRef.current, false);
    assert.equal(unlockCalls.count, 1);
    assert.equal(deferred.getResolved(), true);
    assert.equal(deferred.getRejected(), false);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

test('loading retry exhaustion rejects completion and does not unlock before timeout', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const queuedTimeouts: Array<() => void> = [];
  globalThis.setTimeout = ((handler: TimerHandler) => {
    queuedTimeouts.push(() => {
      if (typeof handler === 'function') {
        handler();
      }
    });
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  try {
    const mapId = 'MAP_SKY_PILLAR_5F';
    const deferred = createWarpCompletionDeferred();
    const pendingScriptedWarpRef: MutableRef<PendingScriptedWarp | null> = {
      current: {
        mapId,
        x: 6,
        y: 9,
        direction: 'down',
        phase: 'loading',
        style: 'default',
        completion: deferred.completion,
      },
    };
    const scriptedWarpLoadMonitorRef: MutableRef<ScriptedWarpLoadMonitor | null> = {
      current: {
        mapId,
        startedAt: 0,
        retries: 3,
        fallbackDeferredLogged: false,
      },
    };
    const warpingRef: MutableRef<boolean> = { current: true };
    const loadingRef: MutableRef<boolean> = { current: false };
    const pendingSavedLocationRef: MutableRef<any> = { current: null };
    const unlockCalls = { count: 0 };
    const playerRef: MutableRef<PlayerController | null> = { current: createPlayerStub(unlockCalls) };
    const worldManagerRef: MutableRef<WorldManager | null> = {
      current: createWorldManagerStub('MAP_SKY_PILLAR_4F'),
    };
    const { fade, getFadeInStarts } = createFadeStub();
    const warpHandler = createWarpHandlerStub({ count: 0 });
    const inputUnlockGuards: InputUnlockGuards = {
      warpingRef,
      storyScriptRunningRef: { current: false },
      dialogIsOpenRef: { current: false },
    };

    updateScriptedWarpStateMachine({
      nowTime: 2000,
      pendingScriptedWarpRef,
      scriptedWarpLoadMonitorRef,
      warpingRef,
      loadingRef,
      pendingSavedLocationRef,
      warpHandler,
      fadeController: fade,
      playerRef,
      worldManagerRef,
      inputUnlockGuards,
      selectMapForLoad: () => {},
      startFallWarpArrival: () => false,
    });

    await Promise.resolve();
    assert.equal(pendingScriptedWarpRef.current, null);
    assert.equal(scriptedWarpLoadMonitorRef.current, null);
    assert.equal(warpingRef.current, false);
    assert.equal(getFadeInStarts(), 1);
    assert.equal(deferred.getResolved(), false);
    assert.equal(deferred.getRejected(), true);
    assert.ok(deferred.getError() instanceof Error);
    assert.equal(unlockCalls.count, 0);

    for (const runTimeout of queuedTimeouts) {
      runTimeout();
    }
    await Promise.resolve();
    assert.equal(unlockCalls.count, 1);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

test('loading completion enters scripted warp exiting phase before resolving waitstate', async () => {
  const mapId = 'MAP_PETALBURG_CITY';
  const deferred = createWarpCompletionDeferred();
  const pendingScriptedWarpRef: MutableRef<PendingScriptedWarp | null> = {
    current: {
      mapId,
      x: 15,
      y: 8,
      direction: 'down',
      phase: 'loading',
      style: 'default',
      completion: deferred.completion,
    },
  };
  const scriptedWarpLoadMonitorRef: MutableRef<ScriptedWarpLoadMonitor | null> = {
    current: {
      mapId,
      startedAt: 0,
      retries: 0,
      fallbackDeferredLogged: false,
    },
  };
  const warpingRef: MutableRef<boolean> = { current: true };
  const loadingRef: MutableRef<boolean> = { current: false };
  const pendingSavedLocationRef: MutableRef<any> = { current: { mapId, x: 15, y: 8 } };
  const unlockCalls = { count: 0 };
  const playerRef: MutableRef<PlayerController | null> = { current: createPlayerStub(unlockCalls) };
  const worldManagerRef: MutableRef<WorldManager | null> = { current: createWorldManagerStub(mapId) };
  const updateLastCheckedTileCalls = { count: 0 };
  const { fade, getFadeInStarts } = createFadeStub();
  const warpHandler = createWarpHandlerStub(updateLastCheckedTileCalls);
  const inputUnlockGuards: InputUnlockGuards = {
    warpingRef,
    storyScriptRunningRef: { current: false },
    dialogIsOpenRef: { current: false },
  };
  let exitStartCalls = 0;

  updateScriptedWarpStateMachine({
    nowTime: 100,
    pendingScriptedWarpRef,
    scriptedWarpLoadMonitorRef,
    warpingRef,
    loadingRef,
    pendingSavedLocationRef,
    warpHandler,
    fadeController: fade,
    playerRef,
    worldManagerRef,
    inputUnlockGuards,
    selectMapForLoad: () => {},
    startFallWarpArrival: () => false,
    startScriptedWarpExit: () => {
      exitStartCalls++;
      return true;
    },
  });

  await Promise.resolve();
  assert.equal(exitStartCalls, 1);
  assert.equal(getFadeInStarts(), 1);
  assert.equal(updateLastCheckedTileCalls.count, 1);
  assert.equal(pendingSavedLocationRef.current, null);
  assert.equal(scriptedWarpLoadMonitorRef.current, null);
  assert.equal(pendingScriptedWarpRef.current?.phase, 'exiting');
  assert.equal(warpingRef.current, true);
  assert.equal(unlockCalls.count, 0);
  assert.equal(deferred.getResolved(), false);
  assert.equal(deferred.getRejected(), false);

  updateScriptedWarpStateMachine({
    nowTime: 116,
    pendingScriptedWarpRef,
    scriptedWarpLoadMonitorRef,
    warpingRef,
    loadingRef,
    pendingSavedLocationRef,
    warpHandler,
    fadeController: fade,
    playerRef,
    worldManagerRef,
    inputUnlockGuards,
    selectMapForLoad: () => {},
    startFallWarpArrival: () => false,
    startScriptedWarpExit: () => {
      exitStartCalls++;
      return true;
    },
  });
  assert.equal(exitStartCalls, 1);
  assert.equal(pendingScriptedWarpRef.current?.phase, 'exiting');
});
