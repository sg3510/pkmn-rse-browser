import { useEffect, useRef, useState } from 'react';
import { BattleWebGLContext } from '../battle/render/BattleWebGLContext';
import { createBackgroundSprite, createEntryBackgroundSprites, loadBattleBackground, type BattleTerrain } from '../battle/render/BattleBackground';
import { createBackSprite, createFrontSprite, loadPokemonBattleSprites } from '../battle/render/BattleSpriteLoader';
import { drawActionMenu, drawEnemyHealthBox, drawMoveMenu, drawPlayerHealthBox, preloadBattleInterfaceAssets } from '../battle/render/BattleHealthBox';
import { getPokemonSpriteCoords } from '../data/pokemonSpriteCoords.gen';
import { SPECIES } from '../data/species';
import { STATUS } from '../pokemon/types';
import { PromptCanvasRenderer } from '../core/prompt/PromptCanvasRenderer';
import { BATTLE_MESSAGE_PROFILE } from '../core/prompt/PromptWindowProfiles';
import { BattleTextboxSkin } from '../core/prompt/skins/BattleTextboxSkin';
import { battleMessageTextPainter } from '../rendering/GbaFont';
import { toPublicAssetUrl } from '../utils/publicAssetUrl';

const cases = {
  normal: { enemy: 'POOCHYENA', level: 2, hp: 21, maxHp: 21, gender: '♂', status: STATUS.NONE },
  yellow: { enemy: 'ZIGZAGOON', level: 20, hp: 10, maxHp: 21, gender: '♀', status: STATUS.POISON },
  red: { enemy: 'ZIGZAGOON', level: 20, hp: 1, maxHp: 21, gender: '♀', status: STATUS.BURN },
  empty: { enemy: 'ZIGZAGOON', level: 20, hp: 0, maxHp: 21, gender: '♀', status: STATUS.NONE },
  long: { enemy: 'CHARMANDER', level: 100, hp: 333, maxHp: 333, gender: '♀', status: STATUS.NONE },
  genderless: { enemy: 'RAYQUAZA', level: 100, hp: 333, maxHp: 333, gender: '', status: STATUS.NONE },
};

/** Isolated visual fixtures using the production renderers; never reads or writes a save. */
export default function BattleRenderDebugPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webglRef = useRef<BattleWebGLContext | null>(null);
  const [terrain, setTerrain] = useState<BattleTerrain>('plain');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState('action');
  const [testCase, setTestCase] = useState<keyof typeof cases>('normal');
  const [elapsed, setElapsed] = useState(1500);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    const webgl = new BattleWebGLContext();
    webglRef.current = webgl;
    Promise.all([
      loadBattleBackground(webgl, { terrain }), preloadBattleInterfaceAssets(),
      loadPokemonBattleSprites(webgl, SPECIES.MUDKIP),
      loadPokemonBattleSprites(webgl, SPECIES.POOCHYENA),
      loadPokemonBattleSprites(webgl, SPECIES.ZIGZAGOON),
      loadPokemonBattleSprites(webgl, SPECIES.CHARMANDER),
      loadPokemonBattleSprites(webgl, SPECIES.RAYQUAZA),
      loadPokemonBattleSprites(webgl, SPECIES.METAGROSS),
    ]).then(() => { if (!cancelled) setReady(true); })
      .catch((reason) => { if (!cancelled) setError(String(reason)); })
      .finally(() => { loaded = true; if (cancelled) webgl.dispose(); });
    return () => { cancelled = true; if (loaded) webgl.dispose(); webglRef.current = null; };
  }, [terrain]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    const webgl = webglRef.current;
    if (!ready || !ctx || !webgl) return;
    const fixture = cases[testCase];
    const enemy = testCase === 'normal' ? SPECIES.POOCHYENA
      : testCase === 'long' ? SPECIES.CHARMANDER
      : testCase === 'genderless' ? SPECIES.RAYQUAZA : SPECIES.ZIGZAGOON;
    const player = testCase === 'long' ? SPECIES.CHARMANDER
      : testCase === 'genderless' ? SPECIES.METAGROSS : SPECIES.MUDKIP;
    const playerName = testCase === 'long' ? 'CHARMANDER' : testCase === 'genderless' ? 'METAGROSS' : 'MUDKIP';
    webgl.clear();
    webgl.renderSprites([
      createBackgroundSprite(), ...createEntryBackgroundSprites(elapsed),
      createFrontSprite(enemy, getPokemonSpriteCoords(enemy)),
      createBackSprite(player, getPokemonSpriteCoords(player)),
    ]);
    ctx.imageSmoothingEnabled = false;
    webgl.compositeOnto(ctx, 240, 160);
    drawEnemyHealthBox(ctx, 0, 0, fixture.enemy, fixture.level, fixture.hp, fixture.maxHp, fixture.status, fixture.gender);
    drawPlayerHealthBox(ctx, 0, 0, playerName, testCase === 'long' || testCase === 'genderless' ? 100 : 5,
      fixture.hp, fixture.maxHp, .45, fixture.status, testCase === 'genderless' ? '' : '♂');
    if (page === 'action') {
      drawActionMenu(ctx, 0, 0, selected, playerName, false);
    } else if (page === 'move') {
      drawMoveMenu(ctx, 0, 0, [
        { name: 'TACKLE', pp: 35, maxPp: 35, type: 'NORMAL' },
        { name: 'GROWL', pp: 40, maxPp: 40, type: 'NORMAL' },
        { name: 'WATER GUN', pp: 25, maxPp: 25, type: 'WATER' },
        { name: 'ANCIENTPOWER', pp: 5, maxPp: 5, type: 'ROCK' },
      ], selected);
    } else {
      const text = page === 'long-message'
        ? 'The wild POOCHYENA used\nSAND-ATTACK!' : 'Go! MUDKIP!';
      new PromptCanvasRenderer().render(ctx, {
        profile: BATTLE_MESSAGE_PROFILE, skin: new BattleTextboxSkin(),
        textPainter: battleMessageTextPainter,
        state: { type: 'message', text, visibleChars: text.length, isFullyVisible: true },
        originX: 0, originY: 0,
      });
    }
  }, [ready, page, testCase, elapsed, selected]);

  return <main style={{ padding: 24, color: '#e3e9ef', background: '#101820', minHeight: '100vh', fontFamily: 'system-ui' }}>
    <h1>Battle rendering comparison</h1>
    <p>Production rendering at 240 × 160. The controls below affect this preview only.</p>
    <p><a href="#/battle-animations" style={{ color: '#91d5ed' }}>Open the battle animation preview</a></p>
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 20 }}>
      <label>Terrain <select aria-label="Terrain" value={terrain} onChange={(event) => {
        setReady(false); setTerrain(event.target.value as BattleTerrain);
      }}>
        <option value="plain">Plain (reference)</option><option value="tall_grass">Tall grass</option>
        <option value="water">Water</option><option value="cave">Cave</option>
      </select></label>
      <label>Window <select aria-label="Window" value={page} onChange={(event) => setPage(event.target.value)}>
        <option value="action">Actions</option><option value="move">Moves</option>
        <option value="message">Message</option><option value="long-message">Two-line message</option>
      </select></label>
      <label>Fixture <select aria-label="Fixture" value={testCase} onChange={(event) => setTestCase(event.target.value as keyof typeof cases)}>
        <option value="normal">Full HP</option><option value="yellow">Yellow HP + poison</option>
        <option value="red">1 HP + burn</option><option value="empty">Fainted</option>
        <option value="long">Long names + level 100</option><option value="genderless">Genderless</option>
      </select></label>
      <label>Cursor <select aria-label="Cursor" value={selected} onChange={(event) => setSelected(Number(event.target.value))}>
        {[0, 1, 2, 3].map((value) => <option key={value} value={value}>{value + 1}</option>)}
      </select></label>
      <label>Entrance time <input aria-label="Entrance time" type="range" min="0" max="1500" step="50"
        value={elapsed} onChange={(event) => setElapsed(Number(event.target.value))} /> {elapsed} ms</label>
    </div>
    {error && <p role="alert">{error}</p>}
    {!ready && <p>Loading renderer…</p>}
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <figure style={{ margin: 0 }}><figcaption>Browser render</figcaption>
        <canvas ref={canvasRef} width={240} height={160} aria-label="Battle preview"
          style={{ width: 480, maxWidth: '100%', imageRendering: 'pixelated' }} />
      </figure>
      <figure style={{ margin: 0 }}><figcaption>Your GBA reference</figcaption>
        <img src={toPublicAssetUrl('/debug/battle-gba-reference.png')} alt="GBA battle reference with Mudkip and Zigzagoon"
          style={{ width: 480, maxWidth: '100%', imageRendering: 'pixelated' }} />
      </figure>
    </div>
  </main>;
}
