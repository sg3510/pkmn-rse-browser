import assert from 'node:assert/strict';
import test from 'node:test';
import { PlayerController } from '../../../game/PlayerController';
import { ObjectEventManager } from '../../../game/ObjectEventManager';
import { createNPCMovementProviders } from '../npcMovementProviders';

function withWindowStub(run: () => void): void {
  const previousWindow = (globalThis as { window?: Window }).window;
  (globalThis as { window?: Window }).window = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as Window;

  try {
    run();
  } finally {
    if (previousWindow) {
      (globalThis as { window?: Window }).window = previousWindow;
    } else {
      delete (globalThis as { window?: Window }).window;
    }
  }
}

test('movement provider treats moving player as occupying previous and current tiles', () => {
  withWindowStub(() => {
    const player = new PlayerController();
    player.setPosition(7, 4);

    const providers = createNPCMovementProviders(
      { current: player },
      { current: new ObjectEventManager() }
    );

    assert.equal(player.forceMove('right', true), true);

    assert.equal(providers.hasPlayerAt(7, 4), true);
    assert.equal(providers.hasPlayerAt(8, 4), true);
    assert.equal(providers.hasPlayerAt(9, 4), false);

    const playerState = providers.getPlayerState();
    assert.ok(playerState);
    assert.equal(playerState.tileX, 7);
    assert.equal(playerState.tileY, 4);
    assert.equal(playerState.destTileX, 8);
    assert.equal(playerState.destTileY, 4);
    assert.equal(playerState.isMoving, true);

    player.destroy();
  });
});
