/** Pose and timeline preview for src/title/RayquazaFlight.ts. */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { toPublicAssetUrl } from '../utils/publicAssetUrl';
import { RayquazaPoseGuide } from '../title/RayquazaPoseGuide';
import { RayquazaFlight } from '../title/RayquazaFlight';
import { RAYQUAZA_CYCLE_SECONDS } from '../title/rayquazaMotion';

export default function RayquazaFlightDebugPage() {
  const host = useRef<HTMLDivElement>(null);
  const time = useRef(14);
  const playing = useRef(false);
  const [status, setStatus] = useState('Loading rig…');
  const [seconds, setSeconds] = useState(14);
  const [running, setRunning] = useState(false);
  const [comparison, setComparison] = useState<'side' | 'overlay' | 'model'>('side');
  const [guide, setGuide] = useState(true);
  const [opacity, setOpacity] = useState(0.4);
  useEffect(() => {
    const container = host.current!;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(640, 640);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = 'auto';
    container.append(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
    camera.position.z = 5.5;
    scene.add(new THREE.AmbientLight(0x404040, 2));
    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(-0.1, 0, 1.3);
    scene.add(light);
    const flight = new RayquazaFlight();
    scene.add(flight.group);
    let alive = true;
    void flight.load().then(() => { if (alive) setStatus('Ready'); }).catch(error => { if (alive) setStatus(String(error)); });
    const ticker = window.setInterval(() => { if (playing.current) setSeconds(time.current); }, 100);
    let last = performance.now();
    let frame = 0;
    const render = (now: number) => {
      if (playing.current) time.current = (time.current + (now - last) / 1000) % RAYQUAZA_CYCLE_SECONDS;
      last = now;
      flight.update(time.current);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { alive = false; clearInterval(ticker); cancelAnimationFrame(frame); flight.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, []);
  const seek = (value: number) => {
    time.current = value;
    setSeconds(value);
    playing.current = false;
    setRunning(false);
  };
  return <main style={{ maxWidth: 1200, margin: '24px auto', color: '#e4f5ee', padding: 16 }}>
    <h1>Rayquaza flight preview</h1>
    <p>{status} · Up 0–3.5s · Down 4.5–8s · Spiral 9–12s · Hold 12–32s</p>
    <p><label><input type="checkbox" checked={guide} onChange={event => setGuide(event.target.checked)} /> Show shared GBA spiral guide</label></p>
    <p><label>Compare <select value={comparison} onChange={event => setComparison(event.target.value as typeof comparison)}>
      <option value="side">Side by side</option><option value="overlay">Reference overlay</option><option value="model">Model only</option>
    </select></label>{comparison === 'overlay' && <label> Reference opacity <input aria-label="Reference opacity" type="range" min="0" max="1" step="0.05" value={opacity} onChange={event => setOpacity(Number(event.target.value))} /></label>}</p>
    <div style={{ display: 'grid', gridTemplateColumns: comparison === 'side' ? '1fr 1fr' : '1fr', gap: 12 }}>
      <div style={{ position: 'relative', minWidth: 0 }}>
        <div ref={host} style={{ background: 'linear-gradient(#0039a5, #089c6a)' }} />
        {comparison === 'overlay' && <img alt="GBA pose reference overlay" src={toPublicAssetUrl('/debug/rayquaza-title-reference.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity, imageRendering: 'pixelated', pointerEvents: 'none' }} />}
        {guide && <RayquazaPoseGuide />}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '1px dashed #ffffff40', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed #ffffff40', pointerEvents: 'none' }} />
      </div>
      {comparison === 'side' && <div style={{ position: 'relative' }}><img alt="Original GBA Rayquaza pose" src={toPublicAssetUrl('/debug/rayquaza-title-reference.png')} style={{ width: '100%', display: 'block', imageRendering: 'pixelated' }} />{guide && <RayquazaPoseGuide />}</div>}
    </div>
    <label>Timeline: {seconds.toFixed(1)}s <input aria-label="Timeline" type="range" min="0" max={RAYQUAZA_CYCLE_SECONDS} step="0.1" value={seconds}
      onChange={event => seek(Number(event.target.value))} style={{ width: '100%' }} /></label>
    <button onClick={() => { playing.current = !playing.current; setRunning(playing.current); }}>{running ? 'Pause' : 'Play'}</button>{' '}
    {([['Upward pass', 1.75], ['Downward pass', 6.25], ['Coil / glow', 15.05], ['Dim markings', 17.2], ['Departure', 33], ['Offscreen', 4]] as const).map(([label, value]) =>
      <button key={label} onClick={() => seek(value)} style={{ marginRight: 4 }}>{label}</button>)}
    <p><a href="#/play">View title screen</a></p>
  </main>;
}
