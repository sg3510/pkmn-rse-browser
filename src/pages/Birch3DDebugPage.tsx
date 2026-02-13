/**
 * Professor Birch 3D Debug Page
 *
 * Interactive controls to view the model and manipulate its skeleton (hands).
 *
 * NOTES on COLLADA skinned mesh handling:
 * - The model contains SkinnedMesh objects bound to a Skeleton
 * - Bone transformations must be applied to actual THREE.Bone objects
 * - The ColladaLoader handles texture loading, but flipY may need adjustment
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SkeletonHelper } from 'three';
import { toPublicAssetUrl } from '../utils/publicAssetUrl';

// GBA dimensions
const GBA_WIDTH = 240;
const GBA_HEIGHT = 160;
const SCALE = 2; // 2x for better visibility

interface ModelConfig {
  scale: number;
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

interface CameraConfig {
  posX: number;
  posY: number;
  posZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  fov: number;
}

const defaultModelConfig: ModelConfig = {
  scale: 0.1, // Birch model might need different scale
  posX: 0,
  posY: -2,
  posZ: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
};

const defaultCameraConfig: CameraConfig = {
  posX: 0,
  posY: 5,
  posZ: 15,
  lookX: 0,
  lookY: 3,
  lookZ: 0,
  fov: 35,
};

// Model source
const BIRCH_MODEL = {
  id: 'birch',
  name: 'Professor Birch (DAE)',
  path: toPublicAssetUrl('/3dmodels/Professor Birch/rstr0009_00_fi.dae'),
  texturePath: toPublicAssetUrl('/3dmodels/Professor Birch/'),
  textureFiles: ['rstr0009_00_fi_body.png', 'rstr0009_00_fi_face.png', 'rstr0009_00_fi_head.png'],
};

// Improved slider component
function DragSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  sensitivity = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  sensitivity?: number;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startValue: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current.startX = e.clientX;
    dragRef.current.startValue = value;
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = (moveEvent.clientX - dragRef.current.startX) * sensitivity * step;
      const newValue = Math.max(min, Math.min(max, dragRef.current.startValue + delta));
      onChange(Math.round(newValue / step) * step);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const increment = () => onChange(Math.min(max, value + step));
  const decrement = () => onChange(Math.max(min, value - step));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, userSelect: 'none' }}>
      <label style={{ width: 80, fontSize: 11, color: '#aaa' }}>{label}</label>
      <button onClick={decrement} style={{ width: 20, height: 20, cursor: 'pointer', background: '#333', color: '#fff', border: '1px solid #555' }}>‹</button>
      <div
        onMouseDown={handleMouseDown}
        style={{
          flex: 1,
          height: 24,
          background: isDragging ? '#4a4a4a' : '#2a2a2a',
          border: '1px solid #555',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'ew-resize',
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${((value - min) / (max - min)) * 100}%`, background: 'rgba(100, 150, 255, 0.3)', pointerEvents: 'none' }} />
        <span style={{ fontSize: 11, fontFamily: 'monospace', position: 'relative', color: '#fff' }}>{value.toFixed(2)}</span>
      </div>
      <button onClick={increment} style={{ width: 20, height: 20, cursor: 'pointer', background: '#333', color: '#fff', border: '1px solid #555' }}>›</button>
    </div>
  );
}

export default function Birch3DDebugPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const wrapperRef = useRef<THREE.Group | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const boneHelperRef = useRef<THREE.AxesHelper | null>(null);
  const skeletonHelperRef = useRef<SkeletonHelper | null>(null);
  const skeletonRef = useRef<THREE.Skeleton | null>(null);
  const modelLoadedRef = useRef(false); // Track if model was loaded (persists across strict mode remounts)

  const [modelConfig, setModelConfig] = useState<ModelConfig>(defaultModelConfig);
  const [cameraConfig, _setCameraConfig] = useState<CameraConfig>(defaultCameraConfig);
  const [orbitEnabled, _setOrbitEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  
  // Bone control state
  const [bones, setBones] = useState<string[]>([]);
  const [selectedBone, setSelectedBone] = useState<string>('');
  const selectedBoneRef = useRef<string>('');
  const [boneRotation, setBoneRotation] = useState({ x: 0, y: 0, z: 0 });
  
  // Specific Hand States
  const [lHandRot, setLHandRot] = useState({ x: 0, y: 0, z: 0 });
  const [rHandRot, setRHandRot] = useState({ x: 0, y: 0, z: 0 });

  // Debug: Texture Orientation - toggle ALL textures flipY
  const [allTexturesFlipY, setAllTexturesFlipY] = useState(true); // Try true first (common for COLLADA)
  const [showSkeletonHelper, setShowSkeletonHelper] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Face expression control (4 expressions in texture: 0=neutral, 1=blink, 2=happy, 3=worried)
  const [faceExpression, setFaceExpression] = useState(0);
  const faceMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const faceMeshRef = useRef<THREE.SkinnedMesh | null>(null);
  const originalFaceUVsRef = useRef<Float32Array | null>(null);

  // Initialize Three.js
  useEffect(() => {
    if (!canvasRef.current) return;
    // ... (rest of init) ...
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
    renderer.setSize(GBA_WIDTH * SCALE, GBA_HEIGHT * SCALE);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(cameraConfig.fov, GBA_WIDTH / GBA_HEIGHT, 0.1, 1000);
    camera.position.set(cameraConfig.posX, cameraConfig.posY, cameraConfig.posZ);
    camera.lookAt(cameraConfig.lookX, cameraConfig.lookY, cameraConfig.lookZ);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = orbitEnabled;
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 10);
    scene.add(dirLight);

    const wrapper = new THREE.Group();
    scene.add(wrapper);
    wrapperRef.current = wrapper;

    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Bone helper
    const boneHelper = new THREE.AxesHelper(1);
    boneHelper.visible = false;
    scene.add(boneHelper);
    boneHelperRef.current = boneHelper;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      // Update bone helper position using skeleton
      if (boneHelper.visible && skeletonRef.current && selectedBoneRef.current) {
        const bone = skeletonRef.current.getBoneByName(selectedBoneRef.current);
        if (bone) {
          const worldPos = new THREE.Vector3();
          bone.getWorldPosition(worldPos);
          boneHelper.position.copy(worldPos);
        }
      }
    };
    animate();

    return () => { renderer.dispose(); };
  }, []);

  // Load Model
  useEffect(() => {
    if (!wrapperRef.current || !sceneRef.current) return;

    // Prevent duplicate loads (React Strict Mode calls useEffect twice)
    if (modelLoadedRef.current) {
      console.log('Model already loaded, skipping duplicate load');
      return;
    }
    modelLoadedRef.current = true;

    const loader = new ColladaLoader();

    // Set the resource path so ColladaLoader knows where to find textures
    loader.setResourcePath(BIRCH_MODEL.texturePath);

    console.log('Loading Birch model from:', BIRCH_MODEL.path);
    console.log('Texture path:', BIRCH_MODEL.texturePath);

    loader.load(BIRCH_MODEL.path, (collada) => {
      const model = collada.scene;
      const debugLines: string[] = [];

      // Diagnostic: Log all objects in the scene
      debugLines.push('=== Model Structure ===');
      model.traverse((child) => {
        const indent = '  '.repeat(child.parent ? getDepth(child) : 0);
        let info = `${indent}${child.name || '(unnamed)'} [${child.type}]`;
        if (child instanceof THREE.SkinnedMesh) {
          info += ` - SkinnedMesh (skeleton: ${child.skeleton ? 'YES' : 'NO'})`;
        } else if (child instanceof THREE.Mesh) {
          info += ` - Mesh`;
        } else if (child instanceof THREE.Bone) {
          info += ` - Bone`;
        }
        debugLines.push(info);
      });

      // Find all SkinnedMesh objects and their skeletons
      const skinnedMeshes: THREE.SkinnedMesh[] = [];
      const regularMeshes: THREE.Mesh[] = [];
      let foundSkeleton: THREE.Skeleton | null = null;

      model.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh) {
          skinnedMeshes.push(child);
          if (child.skeleton && !foundSkeleton) {
            foundSkeleton = child.skeleton;
            skeletonRef.current = child.skeleton;
          }

          // Log texture info for debugging
          const mat = child.material as THREE.MeshStandardMaterial;
          debugLines.push(`--- SkinnedMesh: ${child.name} ---`);
          debugLines.push(`  Material name: ${mat.name}`);
          debugLines.push(`  Material color: #${mat.color?.getHexString()}`);
          debugLines.push(`  Has texture map: ${mat.map ? 'YES' : 'NO'}`);
          if (mat.map) {
            debugLines.push(`  Texture flipY: ${mat.map.flipY}`);
            const img = mat.map.image as HTMLImageElement | undefined;
            debugLines.push(`  Texture image: ${img?.src || '(no src - embedded/blob)'}`);
            debugLines.push(`  Texture size: ${img?.width || '?'}x${img?.height || '?'}`);
            // Set colorSpace for correct color rendering
            mat.map.colorSpace = THREE.SRGBColorSpace;
            // Set initial flipY based on state - will be toggled by effect
            mat.map.flipY = allTexturesFlipY;
            mat.map.needsUpdate = true;

            // Store reference to face material for expression switching
            // The face mesh has "face" in the material name
            if (mat.name.toLowerCase().includes('face')) {
              faceMaterialRef.current = mat;
              faceMeshRef.current = child;
              // Store original UVs for expression switching
              const uvAttr = child.geometry.getAttribute('uv');
              if (uvAttr) {
                originalFaceUVsRef.current = new Float32Array(uvAttr.array);
                debugLines.push(`  ✓ Face mesh stored with ${uvAttr.count} UV coords`);
              }
              debugLines.push(`  ✓ Face material stored for expression switching`);
            }
          } else {
            debugLines.push(`  ⚠️ NO TEXTURE - using material color only!`);
          }
        } else if (child instanceof THREE.Mesh && !(child instanceof THREE.SkinnedMesh)) {
          regularMeshes.push(child);
        }
      });

      debugLines.push('');
      debugLines.push(`=== Mesh Summary ===`);
      debugLines.push(`SkinnedMeshes: ${skinnedMeshes.length}`);
      skinnedMeshes.forEach(sm => {
        debugLines.push(`  - ${sm.name}: skeleton has ${sm.skeleton?.bones.length || 0} bones`);
      });
      debugLines.push(`Regular Meshes: ${regularMeshes.length}`);
      regularMeshes.forEach(rm => {
        debugLines.push(`  - ${rm.name}`);
      });

      // IMPORTANT: Check if there are duplicate meshes (both skinned and regular)
      // This could cause the "ghost" effect
      if (regularMeshes.length > 0) {
        debugLines.push('');
        debugLines.push(`⚠️ Found ${regularMeshes.length} regular (non-skinned) meshes`);
        debugLines.push('Hiding them to prevent ghost rendering...');

        // Hide ALL regular meshes - they are likely duplicates causing ghost effect
        regularMeshes.forEach(rm => {
          debugLines.push(`  Hiding: ${rm.name}`);
          rm.visible = false;
        });
      }

      // Also look for and hide the Armature node itself (the visual skeleton representation)
      // The skeleton bones might be rendered as objects which causes ghost effect
      const armatureNode = model.getObjectByName('Armature');
      if (armatureNode) {
        debugLines.push('');
        debugLines.push('Found Armature node - checking for visual bone objects...');

        // Hide any child of Armature that is NOT a Bone but might render
        armatureNode.traverse((child) => {
          // If it's a mesh inside the armature, hide it
          if (child instanceof THREE.Mesh && !(child instanceof THREE.SkinnedMesh)) {
            debugLines.push(`  Hiding armature mesh: ${child.name}`);
            child.visible = false;
          }
        });
      }

      wrapperRef.current?.add(model);
      modelRef.current = model;

      // Create SkeletonHelper for visualization
      if (foundSkeleton) {
        // Find the root bone to create helper from
        const skinnedMesh = skinnedMeshes[0];
        if (skinnedMesh) {
          const helper = new SkeletonHelper(skinnedMesh);
          helper.visible = false;
          sceneRef.current?.add(helper);
          skeletonHelperRef.current = helper;
          debugLines.push('');
          debugLines.push('✓ SkeletonHelper created');
        }
      }

      // Find all bones (actual THREE.Bone objects only)
      const boneNames: string[] = [];
      const skeleton = skeletonRef.current;
      if (skeleton) {
        skeleton.bones.forEach((bone: THREE.Bone) => {
          boneNames.push(bone.name);
        });
      }
      boneNames.sort();
      setBones(boneNames);

      debugLines.push('');
      debugLines.push(`=== Skeleton Bones (${boneNames.length}) ===`);
      boneNames.forEach(name => debugLines.push(`  ${name}`));

      // Initialize Hand Rotations from skeleton bones
      if (skeleton) {
        const lHand = skeleton.getBoneByName('LHand');
        const rHand = skeleton.getBoneByName('RHand');
        if (lHand) setLHandRot({ x: lHand.rotation.x, y: lHand.rotation.y, z: lHand.rotation.z });
        if (rHand) setRHandRot({ x: rHand.rotation.x, y: rHand.rotation.y, z: rHand.rotation.z });
      }

      // Auto-center
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);

      setDebugInfo(debugLines);
      setLoaded(true);
      console.log('Birch loaded.', debugLines.join('\n'));
    });

    // Helper function to get depth in scene graph
    function getDepth(obj: THREE.Object3D): number {
      let depth = 0;
      let current = obj.parent;
      while (current) {
        depth++;
        current = current.parent;
      }
      return depth;
    }
  }, []);

  // Update transforms
  useEffect(() => {
    if (!wrapperRef.current) return;
    wrapperRef.current.scale.setScalar(modelConfig.scale);
    wrapperRef.current.position.set(modelConfig.posX, modelConfig.posY, modelConfig.posZ);
    wrapperRef.current.rotation.set(modelConfig.rotX, modelConfig.rotY, modelConfig.rotZ);
  }, [modelConfig]);

  // Update ALL Texture flipY
  useEffect(() => {
    if (!modelRef.current) return;
    modelRef.current.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.map) {
          mat.map.flipY = allTexturesFlipY;
          mat.map.needsUpdate = true;
          mat.needsUpdate = true;
        }
      }
    });
  }, [allTexturesFlipY, loaded]);

  // Update Selected Bone Rotation - Use skeleton bones directly
  useEffect(() => {
    if (!skeletonRef.current || !selectedBone) return;
    const bone = skeletonRef.current.getBoneByName(selectedBone);
    if (bone) {
      bone.rotation.set(boneRotation.x, boneRotation.y, boneRotation.z);
    }
  }, [boneRotation, selectedBone]);

  // Update Hand Rotations - Use skeleton bones directly
  useEffect(() => {
    if (!skeletonRef.current) return;

    const lHand = skeletonRef.current.getBoneByName('LHand');
    if (lHand) lHand.rotation.set(lHandRot.x, lHandRot.y, lHandRot.z);

    const rHand = skeletonRef.current.getBoneByName('RHand');
    if (rHand) rHand.rotation.set(rHandRot.x, rHandRot.y, rHandRot.z);

    // If selected bone is one of the hands, sync the slider
    if (selectedBone === 'LHand') setBoneRotation(lHandRot);
    if (selectedBone === 'RHand') setBoneRotation(rHandRot);
  }, [lHandRot, rHandRot]);

  // Update skeleton helper visibility
  useEffect(() => {
    if (skeletonHelperRef.current) {
      skeletonHelperRef.current.visible = showSkeletonHelper;
    }
  }, [showSkeletonHelper]);

  // Update face expression by shifting UV coordinates
  useEffect(() => {
    if (!faceMeshRef.current || !originalFaceUVsRef.current) return;

    const geometry = faceMeshRef.current.geometry;
    const uvAttr = geometry.getAttribute('uv');
    if (!uvAttr) return;

    const originalUVs = originalFaceUVsRef.current;
    const newUVs = uvAttr.array as Float32Array;

    // Shift U coordinates by 0.25 per expression (4 expressions = full texture width)
    const uOffset = faceExpression * 0.25;

    for (let i = 0; i < originalUVs.length; i += 2) {
      newUVs[i] = originalUVs[i] + uOffset; // U coordinate
      newUVs[i + 1] = originalUVs[i + 1];   // V coordinate (unchanged)
    }

    uvAttr.needsUpdate = true;
  }, [faceExpression]);

  const handleBoneSelect = (name: string) => {
    setSelectedBone(name);
    selectedBoneRef.current = name;
    if (skeletonRef.current) {
      const bone = skeletonRef.current.getBoneByName(name);
      if (bone) {
        setBoneRotation({ x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z });
        if (boneHelperRef.current) boneHelperRef.current.visible = true;
      }
    }
  };

  const updateModel = (k: keyof ModelConfig, v: number) => setModelConfig(p => ({ ...p, [k]: v }));

  return (
    <div style={{ display: 'flex', gap: 20, padding: 20, backgroundColor: '#121212', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui' }}>
      <div>
        <h2>Birch Debug</h2>
        <div style={{ width: GBA_WIDTH * SCALE, height: GBA_HEIGHT * SCALE, background: '#000', position: 'relative' }}>
          <canvas ref={canvasRef} />
        </div>
        <p>{loaded ? '✅ Loaded' : '⏳ Loading...'}</p>
      </div>

      <div style={{ width: 300 }}>
        {/* Face Expression Controls */}
        <div style={{ background: '#222', padding: 10, borderRadius: 8, marginBottom: 10 }}>
            <h3>😊 Face Expression</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 0, label: 'Neutral', emoji: '😐' },
                { id: 1, label: 'Blink', emoji: '😌' },
                { id: 2, label: 'Happy', emoji: '😊' },
                { id: 3, label: 'Worried', emoji: '😟' },
              ].map((expr) => (
                <button
                  key={expr.id}
                  onClick={() => setFaceExpression(expr.id)}
                  style={{
                    flex: '1 1 45%',
                    padding: '8px 12px',
                    background: faceExpression === expr.id ? '#4a7cff' : '#333',
                    color: '#fff',
                    border: faceExpression === expr.id ? '2px solid #6a9cff' : '1px solid #555',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {expr.emoji} {expr.label}
                </button>
              ))}
            </div>
        </div>

        {/* Hand Controls */}
        <div style={{ background: '#222', padding: 10, borderRadius: 8, marginBottom: 10 }}>
            <h3>✋ Hand Controls</h3>
            
            <div style={{ marginBottom: 10 }}>
                <strong style={{display:'block', marginBottom:5, color:'#aaa'}}>Left Hand (LHand)</strong>
                <DragSlider label="X" value={lHandRot.x} onChange={v => setLHandRot(p => ({...p, x: v}))} min={-3.14} max={3.14} step={0.1} />
                <DragSlider label="Y" value={lHandRot.y} onChange={v => setLHandRot(p => ({...p, y: v}))} min={-3.14} max={3.14} step={0.1} />
                <DragSlider label="Z" value={lHandRot.z} onChange={v => setLHandRot(p => ({...p, z: v}))} min={-3.14} max={3.14} step={0.1} />
            </div>

            <div>
                <strong style={{display:'block', marginBottom:5, color:'#aaa'}}>Right Hand (RHand)</strong>
                <DragSlider label="X" value={rHandRot.x} onChange={v => setRHandRot(p => ({...p, x: v}))} min={-3.14} max={3.14} step={0.1} />
                <DragSlider label="Y" value={rHandRot.y} onChange={v => setRHandRot(p => ({...p, y: v}))} min={-3.14} max={3.14} step={0.1} />
                <DragSlider label="Z" value={rHandRot.z} onChange={v => setRHandRot(p => ({...p, z: v}))} min={-3.14} max={3.14} step={0.1} />
            </div>
        </div>

        <div style={{ background: '#222', padding: 10, borderRadius: 8, marginBottom: 10 }}>
            <h3>💀 Skeleton Inspector</h3>
            <select 
                style={{ width: '100%', marginBottom: 10, padding: 5, background: '#333', color: '#fff' }}
                value={selectedBone}
                onChange={(e) => handleBoneSelect(e.target.value)}
            >
                <option value="">Select Bone...</option>
                {bones.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            
            {selectedBone && (
                <>
                    <div style={{fontSize:10, color:'#888', marginBottom:5}}>Rotations (Local)</div>
                    <DragSlider label="Rot X" value={boneRotation.x} onChange={v => setBoneRotation(p => ({...p, x: v}))} min={-Math.PI} max={Math.PI} step={0.05} />
                    <DragSlider label="Rot Y" value={boneRotation.y} onChange={v => setBoneRotation(p => ({...p, y: v}))} min={-Math.PI} max={Math.PI} step={0.05} />
                    <DragSlider label="Rot Z" value={boneRotation.z} onChange={v => setBoneRotation(p => ({...p, z: v}))} min={-Math.PI} max={Math.PI} step={0.05} />
                </>
            )}
        </div>

        <div style={{ background: '#222', padding: 10, borderRadius: 8 }}>
            <h3>📦 Model Transform</h3>
            <DragSlider label="Scale" value={modelConfig.scale} onChange={v => updateModel('scale', v)} min={0.01} max={0.5} step={0.01} />
            <DragSlider label="Rot Y" value={modelConfig.rotY} onChange={v => updateModel('rotY', v)} min={-3.14} max={3.14} step={0.1} />
        </div>

        <div style={{ background: '#222', padding: 10, borderRadius: 8, marginTop: 10 }}>
          <h3>Debug Tools</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={allTexturesFlipY}
              onChange={e => setAllTexturesFlipY(e.target.checked)}
            />
            Flip ALL Textures Y (try toggling this!)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={showSkeletonHelper}
              onChange={e => setShowSkeletonHelper(e.target.checked)}
            />
            Show Skeleton Helper
          </label>
        </div>

        {/* Debug Info Panel */}
        <div style={{ background: '#1a1a1a', padding: 10, borderRadius: 8, marginTop: 10, maxHeight: 300, overflowY: 'auto' }}>
          <h3>Debug Info</h3>
          <pre style={{ fontSize: 9, fontFamily: 'monospace', color: '#888', whiteSpace: 'pre-wrap', margin: 0 }}>
            {debugInfo.join('\n')}
          </pre>
        </div>
      </div>
    </div>
  );
}
