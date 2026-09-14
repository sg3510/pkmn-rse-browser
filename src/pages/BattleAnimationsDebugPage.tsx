import { useEffect, useRef, useState } from 'react';
import { createAnimationPlayer } from '../battle/animation/createAnimationPlayer';
import { AnimationAssets } from '../battle/animation/assets/AnimationAssets';
import { BattleAnimationScene } from '../battle/animation/scene/BattleAnimationScene';
import { AnimationPreviewModel, type PreviewConfig } from '../battle/animation/debug/AnimationPreviewModel';
import { BattleWebGLContext } from '../battle/render/BattleWebGLContext';
import { createBackgroundSprite, loadBattleBackground } from '../battle/render/BattleBackground';
import { createBackSprite, createFrontSprite, loadPokemonBattleSprites } from '../battle/render/BattleSpriteLoader';
import { drawEnemyHealthBox, drawPlayerHealthBox, preloadBattleInterfaceAssets } from '../battle/render/BattleHealthBox';
import { BATTLE_ANIMATION_ASSETS, BATTLE_ANIMATION_BACKGROUNDS, BATTLE_ANIMATION_PROGRAM } from '../data/battleAnimationPrograms.gen';
import { MOVES, getMoveName } from '../data/moves';
import { SPECIES, getSpeciesName } from '../data/species';
import { getPokemonSpriteCoords } from '../data/pokemonSpriteCoords.gen';
import { GBA_FRAME_MS } from '../config/timing';
import { PromptCanvasRenderer } from '../core/prompt/PromptCanvasRenderer';
import { BattleTextboxSkin } from '../core/prompt/skins/BattleTextboxSkin';
import { BATTLE_MESSAGE_PROFILE } from '../core/prompt/PromptWindowProfiles';
import { battleMessageTextPainter } from '../rendering/GbaFont';
import { toPublicAssetUrl } from '../utils/publicAssetUrl';

const speciesChoices = [SPECIES.MUDKIP, SPECIES.POOCHYENA, SPECIES.ZIGZAGOON, SPECIES.RAYQUAZA, SPECIES.GARDEVOIR];
const initial: PreviewConfig = { moveId: MOVES.TACKLE, attacker: 0, playerSpecies: SPECIES.MUDKIP,
  enemySpecies: SPECIES.POOCHYENA, seed: 7, enabled: true, mode: 'animation' };
/** Uses the production player/presentation with in-memory battle fixtures; no save reads or writes. */
export default function BattleAnimationsDebugPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<AnimationPreviewModel | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [config, setConfig] = useState<PreviewConfig>(initial);
  const [playing, setPlaying] = useState(true), [speed, setSpeed] = useState(1);
  const [seekFrame, setSeekFrame] = useState('0');
  const [readout, setReadout] = useState({ frame: 0, status: 'loading', active: 0, phase: '', message: '', invariant: true, p95: 0, trace: '' });
  useEffect(() => {
    let cancelled = false, loaded = false, raf = 0, previous = 0, lastReadout = 0;
    const samples: number[] = [];
    const webgl = new BattleWebGLContext();
    const assets = new AnimationAssets(webgl), scene = new BattleAnimationScene(assets);
    const player = createAnimationPlayer({ preload: (tags, backgrounds) => assets.preload(tags, backgrounds), trace: true });
    const model = new AnimationPreviewModel(player); modelRef.current = model;
    const prompt = new PromptCanvasRenderer(), skin = new BattleTextboxSkin();
    const publish = () => {
      const sorted = [...samples].sort((a, b) => a - b);
      setReadout({ frame: player.frame, status: player.status, active: player.activeEffectCount,
        phase: model.sequence.currentKind ?? (model.config?.mode === 'turn' ? 'turn complete' : 'clip'), message: model.message,
        invariant: model.mechanicsUnchanged, p95: sorted[Math.floor(sorted.length * .95)] ?? 0,
        trace: player.trace.slice(-14).map((entry) => `${String(entry.frame).padStart(3)}  ${entry.kind.padEnd(9)} ${entry.symbol}${entry.line ? `  (C script:${entry.line})` : ''}`).join('\n') });
    };
    const draw = () => {
      const ctx = canvasRef.current?.getContext('2d'); if (!ctx || !loaded || cancelled || !model.config) return;
      const c = model.config;
      const enemy = createFrontSprite(c.enemySpecies, getPokemonSpriteCoords(c.enemySpecies));
      const back = createBackSprite(c.playerSpecies, getPokemonSpriteCoords(c.playerSpecies));
      for (const [slot, sprite] of [back, enemy].entries()) {
        scene.applyPose(sprite, slot === 0 ? 0 : 1, player);
        sprite.worldY += model.faint[slot] * 34; sprite.alpha *= 1 - model.faint[slot] * .85;
        if (model.damageFlash[slot] > 0 && Math.floor(model.damageFlash[slot] / 50) % 2 === 0) sprite.alpha *= .3;
      }
      const sprites = [createBackgroundSprite(), enemy, back]; scene.appendSprites(sprites, player);
      webgl.clear(); webgl.renderSprites(sprites); webgl.compositeOnto(ctx, 240, 160);
      drawEnemyHealthBox(ctx, 0, 0, getSpeciesName(c.enemySpecies), 15, model.hp[1], model.maxHp[1], model.status[1], '♀');
      drawPlayerHealthBox(ctx, 0, 0, getSpeciesName(c.playerSpecies), 15, model.hp[0], model.maxHp[0], .4, model.status[0], '♂');
      prompt.render(ctx, { profile: BATTLE_MESSAGE_PROFILE, skin, textPainter: battleMessageTextPainter,
        state: { type: 'message', text: model.message, visibleChars: model.message.length, isFullyVisible: true },
        originX: 0, originY: 0, showArrow: model.sequence.waitingForMessage });
    };
    drawRef.current = () => { draw(); publish(); };
    Promise.all([loadBattleBackground(webgl, { terrain: 'plain' }), preloadBattleInterfaceAssets(), prompt.preload(skin),
      ...speciesChoices.map((species) => loadPokemonBattleSprites(webgl, species)), assets.preload(Object.keys(BATTLE_ANIMATION_ASSETS).map(Number), Object.keys(BATTLE_ANIMATION_BACKGROUNDS).map(Number))])
      .then(() => {
        loaded = true; if (cancelled) { webgl.dispose(); return; }
        setReady(true);
        const loop = (now: number) => {
          if (cancelled) return;
          const dt = previous ? now - previous : 0; previous = now;
          if (model.config) {
            if (playingRef.current && dt > 0) {
              const measure = player.active || model.sequence.active;
              const start = performance.now(); model.update(dt * speedRef.current);
              if (measure) {
                if (samples.length >= 240) samples.shift(); samples.push(performance.now() - start);
              }
            }
            draw(); if (now - lastReadout > 100) { publish(); lastReadout = now; }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }).catch((reason) => { loaded = true; if (!cancelled) setError(String(reason)); else webgl.dispose(); });
    return () => { cancelled = true; cancelAnimationFrame(raf); player.cancel('Preview disposed'); assets.dispose();
      if (loaded) webgl.dispose(); modelRef.current = null; drawRef.current = () => {}; };
  }, []);
  useEffect(() => { if (ready) { modelRef.current?.reset(config); drawRef.current(); } }, [ready, config]);
  const setRunning = (value: boolean) => { playingRef.current = value; setPlaying(value); };
  const patch = (change: Partial<PreviewConfig>) => setConfig((current) => ({ ...current, ...change }));
  const seek = (frame: number) => {
    setRunning(false); const model = modelRef.current; if (!model) return;
    model.reset(config);
    for (let i = 0; i < Math.max(0, Math.min(600, frame)); i++) model.update(GBA_FRAME_MS);
    drawRef.current();
  };
  return <main style={{ padding: 24, background: '#101820', color: '#e3e9ef', minHeight: '100vh', fontFamily: 'system-ui' }}>
    <h1>Battle animation preview</h1>
    <p>Imported Emerald scripts, original sprite frames, and the production battle renderer. Audio hooks are silent.</p>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
      <label>Mode <select aria-label="Mode" value={config.mode} onChange={(e) => patch({ mode: e.target.value as PreviewConfig['mode'] })}>
        <option value="animation">Animation clip</option><option value="turn">Battle turn (sequencing)</option></select></label>
      <label>Move <select aria-label="Move" value={config.moveId} onChange={(e) => patch({ moveId: Number(e.target.value) })}>
        {Object.keys(BATTLE_ANIMATION_PROGRAM.moveEntries).map(Number).map((move) => <option value={move} key={move}>{getMoveName(move)}</option>)}</select></label>
      <label>Attacker <select aria-label="Attacker" value={config.attacker} onChange={(e) => patch({ attacker: Number(e.target.value) as 0 | 1 })}>
        <option value={0}>Player</option><option value={1}>Opponent</option></select></label>
      {(['playerSpecies', 'enemySpecies'] as const).map((key) => <label key={key}>{key === 'playerSpecies' ? 'Player Pokémon ' : 'Opponent Pokémon '}
        <select aria-label={key === 'playerSpecies' ? 'Player Pokémon' : 'Opponent Pokémon'} value={config[key]} onChange={(e) => patch({ [key]: Number(e.target.value) })}>
          {speciesChoices.map((species) => <option key={species} value={species}>{getSpeciesName(species)}</option>)}</select></label>)}
      <label>Seed <input aria-label="Seed" type="number" min={0} max={4294967295} value={config.seed}
        onChange={(e) => patch({ seed: Number(e.target.value) >>> 0 })} style={{ width: 80 }} /></label>
      <label><input type="checkbox" checked={config.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /> Battle animations</label>
      <button onClick={() => patch({ playerSpecies: SPECIES.GARDEVOIR, enemySpecies: SPECIES.MUDKIP, attacker: 0, moveId: MOVES.PSYCHIC })}>Gardevoir preset</button>
    </div>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      <button disabled={!ready} onClick={() => { modelRef.current?.reset(config); setRunning(true); drawRef.current(); }}>Replay</button>
      <button disabled={!ready} onClick={() => { setRunning(false); modelRef.current?.reset(config); drawRef.current(); }}>Reset to start</button>
      <button disabled={!ready} onClick={() => setRunning(!playing)}>{playing ? 'Pause' : 'Play'}</button>
      <button disabled={!ready} onClick={() => { setRunning(false); modelRef.current?.update(GBA_FRAME_MS); drawRef.current(); }}>Step one frame</button>
      <button disabled={!ready || readout.phase !== 'message'} onClick={() => { modelRef.current?.sequence.advanceMessage(); drawRef.current(); }}>Next message</button>
      <label>Speed <select aria-label="Speed" value={speed} onChange={(e) => { const value = Number(e.target.value); speedRef.current = value; setSpeed(value); }}>
        {[.25, .5, 1, 2].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
      <label>Frame <input aria-label="Frame" type="range" min={0} max={600} value={Math.min(600, readout.frame)}
        disabled={!ready || config.mode !== 'animation'} onChange={(event) => seek(Number(event.currentTarget.value))} /></label>
      <form onSubmit={(event) => { event.preventDefault(); seek(Number(seekFrame)); }} style={{ display: 'flex', gap: 6 }}>
        <input aria-label="Go to frame" type="number" min={0} max={600} value={seekFrame}
          disabled={!ready || config.mode !== 'animation'} onChange={(event) => setSeekFrame(event.currentTarget.value)} style={{ width: 64 }} />
        <button disabled={!ready || config.mode !== 'animation'}>Go</button>
      </form>
      <a href="#/battle-render" style={{ color: '#91d5ed' }}>Rendering comparison</a>
    </div>
    {error && <p role="alert">{error}</p>}
    {!ready && <p>Preparing animation assets…</p>}
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <figure style={{ margin: 0 }}><figcaption>Browser render · frame {readout.frame}</figcaption>
        <canvas ref={canvasRef} width={240} height={160} aria-label="Battle animation preview"
          style={{ width: 720, maxWidth: '100%', imageRendering: 'pixelated' }} />
      </figure>
      <figure style={{ margin: 0 }}><figcaption>GBA layout reference (still image)</figcaption>
        <img alt="Original GBA battle layout reference" src={toPublicAssetUrl('/debug/battle-gba-reference.png')}
          style={{ width: 480, maxWidth: '100%', imageRendering: 'pixelated' }} />
      </figure>
    </div>
    <p role="status">Frame {readout.frame} · {readout.status} · {readout.phase} · {readout.active} active effects · update p95 {readout.p95.toFixed(2)} ms</p>
    {config.mode === 'turn' && <p>Mechanics preserved during playback: {readout.invariant ? 'yes' : 'FAILED'}. This fixture never reads or writes your save.</p>}
    <details open><summary>Recent animation events</summary><pre style={{ overflowX: 'auto', fontSize: 12 }}>{readout.trace}</pre></details>
    <p>Visual timing follows the source. Sound-completion timing will be verified when the shared audio system is connected.</p>
  </main>;
}
