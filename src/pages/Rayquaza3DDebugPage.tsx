/**
 * Rayquaza 3D Debug Page
 *
 * Interactive controls to adjust the 3D model positioning for the title screen.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
  scale: 0.02,
  posX: 0,
  posY: -2,
  posZ: 0,
  rotX: 0,
  rotY: Math.PI * 0.8,
  rotZ: 0,
};

const defaultCameraConfig: CameraConfig = {
  posX: 0,
  posY: 5,
  posZ: 25,
  lookX: 0,
  lookY: 3,
  lookZ: 0,
  fov: 35,
};

// Model sources
interface ModelSource {
  id: string;
  name: string;
  type: 'fbx' | 'obj' | 'dae';
  path: string;
  mtlPath?: string; // For OBJ models
  texturePath: string;
  textureFiles: string[];
  defaultScale: number;
}

const MODEL_SOURCE_DEFS: ModelSource[] = [
  {
    id: 'rayquaza-xy',
    name: 'XY/3DS (FBX)',
    type: 'fbx',
    path: '/3dmodels/rayquaza_title/source/Rayquaza.fbx',
    texturePath: '/3dmodels/rayquaza_title/textures/',
    textureFiles: ['Image_0.png', 'Image_1.png', 'Image_2.png', 'Image_4.png'],
    defaultScale: 0.02,
  },
  {
    id: 'rayquaza-wii-dae',
    name: 'Wii (DAE)',
    type: 'dae',
    path: '/3dmodels/rayquaza-wii/Rayquaza.dae',
    texturePath: '/3dmodels/rayquaza-wii/',
    textureFiles: ['RayBody.png', 'RayEye.png', 'Raykuchi.png', 'RaySebire.png', 'RayKankyo.png', 'RayKankyo02.png'],
    defaultScale: 0.1,
  },
  {
    id: 'rayquaza-wii-obj',
    name: 'Wii (OBJ)',
    type: 'obj',
    path: '/3dmodels/rayquaza-wii/Rayquaza.obj',
    mtlPath: '/3dmodels/rayquaza-wii/Rayquaza.mtl',
    texturePath: '/3dmodels/rayquaza-wii/',
    textureFiles: ['RayBody.png', 'RayEye.png', 'Raykuchi.png', 'RaySebire.png', 'RayKankyo.png', 'RayKankyo02.png'],
    defaultScale: 0.1,
  },
];

const MODEL_SOURCES: ModelSource[] = MODEL_SOURCE_DEFS.map((source): ModelSource => ({
  ...source,
  path: toPublicAssetUrl(source.path),
  texturePath: toPublicAssetUrl(source.texturePath),
  ...(source.mtlPath ? { mtlPath: toPublicAssetUrl(source.mtlPath) } : {}),
}));

// Helper to get hierarchy path
const getPath = (obj: THREE.Object3D): string => {
  const parts: string[] = [];
  let current: THREE.Object3D | null = obj;
  while (current) {
    parts.unshift(current.name || current.type);
    current = current.parent;
  }
  return parts.join(' > ');
};

// Helper to get UV bounds
const getUVBounds = (geometry: THREE.BufferGeometry): { minU: number; maxU: number; minV: number; maxV: number } | null => {
  const uvAttr = geometry.getAttribute('uv');
  if (!uvAttr) return null;

  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < uvAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  return { minU, maxU, minV, maxV };
};

// Helper to get side name
const getSideName = (side: THREE.Side): string => {
  switch (side) {
    case THREE.FrontSide: return 'FrontSide';
    case THREE.BackSide: return 'BackSide';
    case THREE.DoubleSide: return 'DoubleSide';
    default: return `Unknown(${side})`;
  }
};

interface MaterialInfo {
  meshName: string;
  materialName: string;
  materialIndex: number;
  material: THREE.Material;
  currentTexture: number | null; // index into TEXTURE_FILES, or null for none
}

interface MeshDebugInfo {
  name: string;
  path: string; // hierarchy path
  vertexCount: number;
  faceCount: number;
  hasUV: boolean;
  hasUV2: boolean;
  uvBounds: { minU: number; maxU: number; minV: number; maxV: number } | null;
  materials: {
    name: string;
    type: string;
    color: string;
    hasMap: boolean;
    mapName: string | null;
    hasNormalMap: boolean;
    hasEmissive: boolean;
    emissiveColor: string;
    transparent: boolean;
    opacity: number;
    side: string;
  }[];
  groups: { start: number; count: number; materialIndex: number }[];
}

// Improved slider component with drag support - uses refs to avoid feedback loops
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
  const incrementBig = () => onChange(Math.min(max, value + step * 10));
  const decrementBig = () => onChange(Math.max(min, value - step * 10));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, userSelect: 'none' }}>
      <label style={{ width: 70, fontSize: 11, color: '#aaa' }}>{label}</label>

      {/* Big decrement */}
      <button
        onClick={decrementBig}
        style={{
          width: 24,
          height: 24,
          border: '1px solid #555',
          background: '#333',
          color: '#fff',
          cursor: 'pointer',
          borderRadius: 3,
          fontSize: 10,
        }}
      >
        ««
      </button>

      {/* Small decrement */}
      <button
        onClick={decrement}
        style={{
          width: 24,
          height: 24,
          border: '1px solid #555',
          background: '#333',
          color: '#fff',
          cursor: 'pointer',
          borderRadius: 3,
        }}
      >
        ‹
      </button>

      {/* Draggable value display */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          flex: 1,
          height: 28,
          background: isDragging ? '#4a4a4a' : '#2a2a2a',
          border: '1px solid #555',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'ew-resize',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${((value - min) / (max - min)) * 100}%`,
            background: 'rgba(100, 150, 255, 0.3)',
            pointerEvents: 'none',
          }}
        />
        <span style={{ fontSize: 12, fontFamily: 'monospace', position: 'relative', color: '#fff' }}>
          {value.toFixed(step < 0.01 ? 4 : step < 0.1 ? 3 : step < 1 ? 2 : 1)}
        </span>
      </div>

      {/* Small increment */}
      <button
        onClick={increment}
        style={{
          width: 24,
          height: 24,
          border: '1px solid #555',
          background: '#333',
          color: '#fff',
          cursor: 'pointer',
          borderRadius: 3,
        }}
      >
        ›
      </button>

      {/* Big increment */}
      <button
        onClick={incrementBig}
        style={{
          width: 24,
          height: 24,
          border: '1px solid #555',
          background: '#333',
          color: '#fff',
          cursor: 'pointer',
          borderRadius: 3,
          fontSize: 10,
        }}
      >
        »»
      </button>

      {/* Direct input */}
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        step={step}
        style={{
          width: 60,
          height: 24,
          fontSize: 11,
          fontFamily: 'monospace',
          background: '#222',
          border: '1px solid #555',
          color: '#fff',
          borderRadius: 3,
          textAlign: 'right',
          padding: '0 4px',
        }}
      />
    </div>
  );
}

export default function Rayquaza3DDebugPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const wrapperRef = useRef<THREE.Group | null>(null); // Wrapper group for proper centering
  const controlsRef = useRef<OrbitControls | null>(null);

  const [modelConfig, setModelConfig] = useState<ModelConfig>(defaultModelConfig);
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>(defaultCameraConfig);
  const [orbitEnabled, setOrbitEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showHelpers, setShowHelpers] = useState(true);
  const [boundingBox, setBoundingBox] = useState<{ min: THREE.Vector3; max: THREE.Vector3; center: THREE.Vector3; size: THREE.Vector3 } | null>(null);
  const [materialInfos, setMaterialInfos] = useState<MaterialInfo[]>([]);
  const [meshDebugInfos, setMeshDebugInfos] = useState<MeshDebugInfo[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>(MODEL_SOURCES[0].id);
  const [currentTextureFiles, setCurrentTextureFiles] = useState<string[]>(MODEL_SOURCES[0].textureFiles);
  const [lightPos, setLightPos] = useState({ x: 5, y: 10, z: 10 });
  const [pivotOffset, setPivotOffset] = useState({ x: 0, y: 0, z: 0 });
  const [showLightHelper, setShowLightHelper] = useState(false);
  const [showPivotHelper, setShowPivotHelper] = useState(false);
  const texturesRef = useRef<THREE.Texture[]>([]);
  const mainLightRef = useRef<THREE.DirectionalLight | null>(null);
  const lightHelperRef = useRef<THREE.Mesh | null>(null);
  const pivotHelperRef = useRef<THREE.Mesh | null>(null);
  const loadIdRef = useRef<number>(0); // To track which load is current
  const [isDraggingHelper, setIsDraggingHelper] = useState<'light' | 'pivot' | null>(null);
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());

  // Initialize Three.js
  useEffect(() => {
    if (!canvasRef.current) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(GBA_WIDTH * SCALE, GBA_HEIGHT * SCALE);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      cameraConfig.fov,
      GBA_WIDTH / GBA_HEIGHT,
      0.1,
      1000
    );
    camera.position.set(cameraConfig.posX, cameraConfig.posY, cameraConfig.posZ);
    camera.lookAt(cameraConfig.lookX, cameraConfig.lookY, cameraConfig.lookZ);
    cameraRef.current = camera;

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = false;
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 10);
    dirLight.name = 'mainLight';
    scene.add(dirLight);
    mainLightRef.current = dirLight;

    const fillLight = new THREE.DirectionalLight(0x089c6a, 0.5);
    fillLight.position.set(0, -5, 5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x0039a5, 0.8);
    rimLight.position.set(0, 10, -5);
    scene.add(rimLight);

    // Grid helper for reference
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    gridHelper.name = 'gridHelper';
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(5);
    axesHelper.name = 'axesHelper';
    scene.add(axesHelper);

    // Light helper sphere (draggable indicator)
    const lightHelperGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const lightHelperMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
    const lightHelper = new THREE.Mesh(lightHelperGeo, lightHelperMat);
    lightHelper.name = 'lightHelper';
    lightHelper.position.copy(dirLight.position);
    lightHelper.visible = false;
    scene.add(lightHelper);
    lightHelperRef.current = lightHelper;

    // Pivot helper sphere (center point indicator)
    const pivotHelperGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const pivotHelperMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.8 });
    const pivotHelper = new THREE.Mesh(pivotHelperGeo, pivotHelperMat);
    pivotHelper.name = 'pivotHelper';
    pivotHelper.visible = false;
    scene.add(pivotHelper);
    pivotHelperRef.current = pivotHelper;

    // Create wrapper group - transforms will be applied to this
    const wrapper = new THREE.Group();
    wrapper.name = 'rayquazaWrapper';
    scene.add(wrapper);
    wrapperRef.current = wrapper;

    // Animation loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (controlsRef.current?.enabled) {
        controlsRef.current.update();
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
    };
  }, []);

  // Load model when selectedModelId changes
  useEffect(() => {
    if (!wrapperRef.current || !sceneRef.current) return;

    const modelSource = MODEL_SOURCES.find(m => m.id === selectedModelId);
    if (!modelSource) return;

    // Increment load ID to invalidate any pending async loads
    loadIdRef.current += 1;
    const currentLoadId = loadIdRef.current;

    // Clear ALL children from wrapper (not just modelRef)
    while (wrapperRef.current.children.length > 0) {
      const child = wrapperRef.current.children[0];
      // Dispose of geometries and materials
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((mat) => {
            if (mat) {
              const matAny = mat as THREE.MeshStandardMaterial;
              matAny.map?.dispose();
              matAny.normalMap?.dispose();
              matAny.roughnessMap?.dispose();
              matAny.metalnessMap?.dispose();
              matAny.emissiveMap?.dispose();
              mat.dispose();
            }
          });
        }
      });
      wrapperRef.current.remove(child);
    }
    modelRef.current = null;

    // Dispose old textures
    texturesRef.current.forEach(tex => tex?.dispose());
    texturesRef.current = [];

    setLoaded(false);
    setMaterialInfos([]);
    setMeshDebugInfos([]);
    setCurrentTextureFiles(modelSource.textureFiles);
    setPivotOffset({ x: 0, y: 0, z: 0 }); // Reset pivot
    console.log(`Switching to model: ${modelSource.name} (loadId: ${currentLoadId})`);

    const textureLoader = new THREE.TextureLoader();

    // Process loaded model (shared between FBX, OBJ, DAE)
    const processModel = (model: THREE.Object3D, textures: THREE.Texture[]) => {
      // Check if this load is still current (user might have switched models)
      if (currentLoadId !== loadIdRef.current) {
        console.log(`Ignoring stale load (${currentLoadId} vs ${loadIdRef.current})`);
        // Dispose textures we just loaded
        textures.forEach(tex => tex?.dispose());
        return;
      }

      texturesRef.current = textures;

      // Collect detailed mesh debug info
      const debugInfos: MeshDebugInfo[] = [];
      const infos: MaterialInfo[] = [];
      let materialGlobalIndex = 0;

      console.group(`=== ${modelSource.name} MODEL STRUCTURE ===`);
      console.log('Root name:', model.name);
      console.log('Root type:', model.type);
      console.log('Children count:', model.children.length);

      model.traverse((child) => {
        const path = getPath(child);

        if (child instanceof THREE.Mesh) {
          const meshName = child.name || `Mesh_${debugInfos.length}`;
          const geometry = child.geometry;
          const materials = Array.isArray(child.material) ? child.material : [child.material];

          // Get UV info
          const uvBounds = getUVBounds(geometry);
          const hasUV = !!geometry.getAttribute('uv');
          const hasUV2 = !!geometry.getAttribute('uv2');

          // Get geometry groups (for multi-material meshes)
          const groups = geometry.groups.map((g: { start: number; count: number; materialIndex?: number }) => ({
            start: g.start,
            count: g.count,
            materialIndex: g.materialIndex ?? 0,
          }));

          // Collect material details
          const matDetails = materials.map((mat) => {
            const m = mat as THREE.MeshPhongMaterial & THREE.MeshStandardMaterial;
            return {
              name: m.name || 'unnamed',
              type: m.type,
              color: m.color ? `#${m.color.getHexString()}` : 'none',
              hasMap: !!m.map,
              mapName: m.map?.name || (m.map?.image as HTMLImageElement | undefined)?.src || null,
              hasNormalMap: !!m.normalMap,
              hasEmissive: !!m.emissive && m.emissive.getHex() !== 0,
              emissiveColor: m.emissive ? `#${m.emissive.getHexString()}` : '#000000',
              transparent: m.transparent,
              opacity: m.opacity,
              side: getSideName(m.side),
            };
          });

          const debugInfo: MeshDebugInfo = {
            name: meshName,
            path,
            vertexCount: geometry.getAttribute('position')?.count || 0,
            faceCount: geometry.index ? geometry.index.count / 3 : (geometry.getAttribute('position')?.count || 0) / 3,
            hasUV,
            hasUV2,
            uvBounds,
            materials: matDetails,
            groups,
          };
          debugInfos.push(debugInfo);

          // Console output
          console.group(`Mesh: ${meshName}`);
          console.log('Path:', path);
          console.log('Vertices:', debugInfo.vertexCount, 'Faces:', debugInfo.faceCount);
          console.log('Has UV:', hasUV, 'Has UV2:', hasUV2);
          if (uvBounds) {
            console.log(`UV Bounds: U[${uvBounds.minU.toFixed(3)} - ${uvBounds.maxU.toFixed(3)}] V[${uvBounds.minV.toFixed(3)} - ${uvBounds.maxV.toFixed(3)}]`);
          }
          console.log('Geometry groups:', groups);
          console.log('Materials:', matDetails);
          console.groupEnd();

          // Build material infos for the UI
          materials.forEach((mat, localIndex) => {
            const matAny = mat as THREE.MeshPhongMaterial;

            // For FBX: apply textures based on heuristics
            // For OBJ: textures are already applied via MTL
            let textureIndex: number | null = null;
            if (modelSource.type === 'fbx') {
              const matName = matAny.name?.toLowerCase() || '';
              if (matName.includes('eye') || matName.includes('iris') || matName.includes('pupil')) {
                textureIndex = 2;
              } else if (matName.includes('body') || matName.includes('skin') || matName.includes('main')) {
                textureIndex = 0;
              } else {
                textureIndex = localIndex < textures.length ? localIndex : 0;
              }

              if (textureIndex !== null && textures[textureIndex]) {
                matAny.map = textures[textureIndex];
                matAny.needsUpdate = true;
              }
            } else {
              // For OBJ, find which texture is assigned
              const mapName = matAny.map?.name || '';
              textureIndex = modelSource.textureFiles.findIndex(f => mapName.includes(f.replace('.png', '')));
              if (textureIndex === -1) textureIndex = null;
            }

            infos.push({
              meshName,
              materialName: matAny.name || `Material_${materialGlobalIndex}`,
              materialIndex: materialGlobalIndex,
              material: matAny,
              currentTexture: textureIndex,
            });

            materialGlobalIndex++;
          });
        } else if (child instanceof THREE.Group || child instanceof THREE.Object3D) {
          if (child !== model) {
            console.log(`Group/Object: ${child.name || child.type} (${child.children.length} children) - ${path}`);
          }
        }
      });

      console.groupEnd();

      setMeshDebugInfos(debugInfos);
      setMaterialInfos(infos);

      // Store model and add to wrapper
      modelRef.current = model;
      wrapperRef.current!.add(model);

      // Compute bounding box
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      setBoundingBox({ min: box.min.clone(), max: box.max.clone(), center, size });
      console.log('Model bounding box:', { min: box.min, max: box.max, center, size });

      // Apply default scale
      setModelConfig(prev => ({ ...prev, scale: modelSource.defaultScale }));

      setLoaded(true);
      console.log(`${modelSource.name} loaded with`, infos.length, 'materials,', debugInfos.length, 'meshes');
    };

    // Load based on model type
    if (modelSource.type === 'fbx') {
      const loader = new FBXLoader();

      // Load textures
      const textures: THREE.Texture[] = [];
      modelSource.textureFiles.forEach((file, index) => {
        const texture = textureLoader.load(modelSource.texturePath + file);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.name = file;
        textures[index] = texture;
      });

      loader.load(
        modelSource.path,
        (fbx) => processModel(fbx, textures),
        undefined,
        (error) => console.error('Failed to load FBX model:', error)
      );
    } else if (modelSource.type === 'obj') {
      const mtlLoader = new MTLLoader();
      mtlLoader.setPath(modelSource.texturePath);

      if (modelSource.mtlPath) {
        mtlLoader.load(
          modelSource.mtlPath.split('/').pop()!, // Just the filename
          (materials) => {
            materials.preload();

            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);

            objLoader.load(
              modelSource.path,
              (obj) => {
                // Collect textures from materials
                const textures: THREE.Texture[] = [];
                modelSource.textureFiles.forEach((file, index) => {
                  const texture = textureLoader.load(modelSource.texturePath + file);
                  texture.flipY = false;
                  texture.colorSpace = THREE.SRGBColorSpace;
                  texture.name = file;
                  textures[index] = texture;
                });

                processModel(obj, textures);
              },
              undefined,
              (error) => console.error('Failed to load OBJ model:', error)
            );
          },
          undefined,
          (error) => console.error('Failed to load MTL:', error)
        );
      } else {
        // Load OBJ without MTL
        const objLoader = new OBJLoader();
        objLoader.load(
          modelSource.path,
          (obj) => {
            const textures: THREE.Texture[] = [];
            modelSource.textureFiles.forEach((file, index) => {
              const texture = textureLoader.load(modelSource.texturePath + file);
              texture.flipY = false;
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.name = file;
              textures[index] = texture;
            });
            processModel(obj, textures);
          },
          undefined,
          (error) => console.error('Failed to load OBJ model:', error)
        );
      }
    } else if (modelSource.type === 'dae') {
      const loader = new ColladaLoader();

      // Load textures
      const textures: THREE.Texture[] = [];
      modelSource.textureFiles.forEach((file, index) => {
        const texture = textureLoader.load(modelSource.texturePath + file);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.name = file;
        textures[index] = texture;
      });

      loader.load(
        modelSource.path,
        (collada) => {
          // DAE files return { scene, animations, ... }
          const model = collada.scene;
          processModel(model, textures);
        },
        undefined,
        (error) => console.error('Failed to load DAE model:', error)
      );
    }
  }, [selectedModelId]);

  // Update model config - apply transforms to WRAPPER, not model directly
  // This allows auto-center to work by moving the model inside the wrapper
  useEffect(() => {
    if (!wrapperRef.current) return;

    wrapperRef.current.scale.setScalar(modelConfig.scale);
    wrapperRef.current.position.set(modelConfig.posX, modelConfig.posY, modelConfig.posZ);
    wrapperRef.current.rotation.set(modelConfig.rotX, modelConfig.rotY, modelConfig.rotZ);
  }, [modelConfig]);

  // Update camera config
  useEffect(() => {
    if (!cameraRef.current || orbitEnabled) return;

    cameraRef.current.fov = cameraConfig.fov;
    cameraRef.current.position.set(cameraConfig.posX, cameraConfig.posY, cameraConfig.posZ);
    cameraRef.current.lookAt(cameraConfig.lookX, cameraConfig.lookY, cameraConfig.lookZ);
    cameraRef.current.updateProjectionMatrix();

    // Keep orbit controls target in sync with lookAt
    if (controlsRef.current) {
      controlsRef.current.target.set(cameraConfig.lookX, cameraConfig.lookY, cameraConfig.lookZ);
    }
  }, [cameraConfig, orbitEnabled]);

  // Toggle orbit controls and sync camera values in real-time
  useEffect(() => {
    if (!controlsRef.current || !cameraRef.current) return;

    controlsRef.current.enabled = orbitEnabled;

    if (orbitEnabled) {
      // Add listener to update camera config as user drags
      const handleChange = () => {
        const cam = cameraRef.current!;
        const target = controlsRef.current!.target;

        setCameraConfig({
          posX: Math.round(cam.position.x * 100) / 100,
          posY: Math.round(cam.position.y * 100) / 100,
          posZ: Math.round(cam.position.z * 100) / 100,
          lookX: Math.round(target.x * 100) / 100,
          lookY: Math.round(target.y * 100) / 100,
          lookZ: Math.round(target.z * 100) / 100,
          fov: cam.fov,
        });
      };

      controlsRef.current.addEventListener('change', handleChange);
      return () => {
        controlsRef.current?.removeEventListener('change', handleChange);
      };
    }
  }, [orbitEnabled]);

  // Toggle helpers
  useEffect(() => {
    if (!sceneRef.current) return;
    const grid = sceneRef.current.getObjectByName('gridHelper');
    const axes = sceneRef.current.getObjectByName('axesHelper');
    if (grid) grid.visible = showHelpers;
    if (axes) axes.visible = showHelpers;
  }, [showHelpers]);

  // Auto-rotate
  useEffect(() => {
    if (!autoRotate || !wrapperRef.current) return;

    const interval = setInterval(() => {
      setModelConfig(prev => ({
        ...prev,
        rotY: prev.rotY + 0.02,
      }));
    }, 16);

    return () => clearInterval(interval);
  }, [autoRotate]);

  // Update light position
  useEffect(() => {
    if (mainLightRef.current) {
      mainLightRef.current.position.set(lightPos.x, lightPos.y, lightPos.z);
    }
    if (lightHelperRef.current) {
      lightHelperRef.current.position.set(lightPos.x, lightPos.y, lightPos.z);
    }
  }, [lightPos]);

  // Toggle light helper visibility
  useEffect(() => {
    if (lightHelperRef.current) {
      lightHelperRef.current.visible = showLightHelper;
    }
  }, [showLightHelper]);

  // Toggle pivot helper visibility and update position
  useEffect(() => {
    if (pivotHelperRef.current) {
      pivotHelperRef.current.visible = showPivotHelper;
      pivotHelperRef.current.position.set(pivotOffset.x, pivotOffset.y, pivotOffset.z);
    }
  }, [showPivotHelper, pivotOffset]);

  // Apply pivot offset to model
  useEffect(() => {
    if (modelRef.current) {
      // The pivot offset shifts where the model's "center" is
      // We store this separately from auto-center offset
      modelRef.current.userData.pivotOffset = pivotOffset;
    }
  }, [pivotOffset]);

  // Get mouse position in normalized device coordinates
  const getMouseNDC = (e: React.MouseEvent | MouseEvent): THREE.Vector2 => {
    if (!canvasRef.current) return new THREE.Vector2();
    const rect = canvasRef.current.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
  };

  // Handle mouse down for helper dragging
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!e.shiftKey || !cameraRef.current) return;
    if (!showLightHelper && !showPivotHelper) return;

    const mouse = getMouseNDC(e);
    raycasterRef.current.setFromCamera(mouse, cameraRef.current);

    // Check what we hit
    const targets: THREE.Object3D[] = [];
    if (showLightHelper && lightHelperRef.current) targets.push(lightHelperRef.current);
    if (showPivotHelper && pivotHelperRef.current) targets.push(pivotHelperRef.current);

    const intersects = raycasterRef.current.intersectObjects(targets);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      e.preventDefault();
      e.stopPropagation();

      // Determine which helper was hit
      if (hit === lightHelperRef.current) {
        setIsDraggingHelper('light');
      } else if (hit === pivotHelperRef.current) {
        setIsDraggingHelper('pivot');
      }

      // Create a drag plane perpendicular to the camera
      const cameraDir = new THREE.Vector3();
      cameraRef.current.getWorldDirection(cameraDir);
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(cameraDir, intersects[0].point);

      // Disable orbit controls while dragging
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }
    }
  };

  // Handle mouse move for helper dragging
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingHelper || !cameraRef.current) return;

    const mouse = getMouseNDC(e);
    raycasterRef.current.setFromCamera(mouse, cameraRef.current);

    // Find intersection with drag plane
    const intersectPoint = new THREE.Vector3();
    raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint);

    if (intersectPoint) {
      if (isDraggingHelper === 'light') {
        setLightPos({
          x: Math.round(intersectPoint.x * 10) / 10,
          y: Math.round(intersectPoint.y * 10) / 10,
          z: Math.round(intersectPoint.z * 10) / 10,
        });
      } else if (isDraggingHelper === 'pivot') {
        setPivotOffset({
          x: Math.round(intersectPoint.x * 10) / 10,
          y: Math.round(intersectPoint.y * 10) / 10,
          z: Math.round(intersectPoint.z * 10) / 10,
        });
      }
    }
  };

  // Handle mouse up for helper dragging
  const handleCanvasMouseUp = () => {
    if (isDraggingHelper) {
      setIsDraggingHelper(null);
      // Re-enable orbit controls if it was enabled
      if (controlsRef.current && orbitEnabled) {
        controlsRef.current.enabled = true;
      }
    }
  };

  // Global mouse up listener (in case mouse leaves canvas)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingHelper) {
        setIsDraggingHelper(null);
        if (controlsRef.current && orbitEnabled) {
          controlsRef.current.enabled = true;
        }
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDraggingHelper, orbitEnabled]);

  const updateModel = (key: keyof ModelConfig, value: number) => {
    setModelConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateCamera = (key: keyof CameraConfig, value: number) => {
    setCameraConfig(prev => ({ ...prev, [key]: value }));
  };

  // Auto-center the model based on its bounding box using wrapper group pattern
  const autoCenterModel = () => {
    if (!modelRef.current || !wrapperRef.current) return;

    // Step 1: Reset wrapper transforms to identity so we get unscaled bounding box
    wrapperRef.current.scale.setScalar(1);
    wrapperRef.current.position.set(0, 0, 0);
    wrapperRef.current.rotation.set(0, 0, 0);

    // Step 2: Reset model position inside wrapper
    modelRef.current.position.set(0, 0, 0);

    // Step 3: Compute bounding box of the model (now in wrapper space at identity)
    const box = new THREE.Box3().setFromObject(modelRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    console.log('Auto-center: bounding box center =', center, 'size =', size);

    // Step 4: Move the model inside the wrapper so its center is at origin
    modelRef.current.position.sub(center);

    // Step 5: Update bounding box display
    setBoundingBox({
      min: box.min.clone(),
      max: box.max.clone(),
      center: new THREE.Vector3(0, 0, 0), // Center is now at origin
      size,
    });

    // Step 6: Re-apply the current transforms to the wrapper
    // Reset position to 0 since the model is now centered
    setModelConfig(prev => ({
      ...prev,
      posX: 0,
      posY: 0,
      posZ: 0,
    }));

    console.log('Model centered! Visual center is now at (0,0,0)');
  };

  // Auto-fit camera to see the whole model
  const autoFitCamera = () => {
    if (!wrapperRef.current || !cameraRef.current) return;

    // Get bounding box of the wrapper (which includes all transforms)
    const box = new THREE.Box3().setFromObject(wrapperRef.current);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Calculate distance needed to fit model in view
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    const distance = maxDim / (2 * Math.tan(fov / 2)) * 1.5; // 1.5x for some padding

    setCameraConfig(prev => ({
      ...prev,
      posX: center.x,
      posY: center.y,
      posZ: center.z + distance,
      lookX: center.x,
      lookY: center.y,
      lookZ: center.z,
    }));
  };

  // Capture camera position from orbit controls
  const captureCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;

    const cam = cameraRef.current;
    const target = controlsRef.current.target;

    setCameraConfig({
      posX: Math.round(cam.position.x * 100) / 100,
      posY: Math.round(cam.position.y * 100) / 100,
      posZ: Math.round(cam.position.z * 100) / 100,
      lookX: Math.round(target.x * 100) / 100,
      lookY: Math.round(target.y * 100) / 100,
      lookZ: Math.round(target.z * 100) / 100,
      fov: cam.fov,
    });

    console.log('Camera captured:', {
      position: cam.position.toArray(),
      target: target.toArray(),
      fov: cam.fov,
    });
  };

  // Change texture for a specific material
  const changeTexture = (materialIndex: number, textureIndex: number | null) => {
    const info = materialInfos[materialIndex];
    if (!info) return;

    const mat = info.material as THREE.MeshPhongMaterial;
    if (textureIndex === null) {
      mat.map = null;
    } else if (texturesRef.current[textureIndex]) {
      mat.map = texturesRef.current[textureIndex];
    }
    mat.needsUpdate = true;

    // Update state
    setMaterialInfos(prev => prev.map((m, i) =>
      i === materialIndex ? { ...m, currentTexture: textureIndex } : m
    ));
  };

  const copyConfig = () => {
    // Get the model's offset (applied by auto-center)
    const modelOffset = modelRef.current
      ? { x: modelRef.current.position.x, y: modelRef.current.position.y, z: modelRef.current.position.z }
      : { x: 0, y: 0, z: 0 };

    const modelSource = MODEL_SOURCES.find(m => m.id === selectedModelId);

    const config = `// ===== Rayquaza 3D Config =====
// Model: ${modelSource?.name || selectedModelId}
// Path: ${modelSource?.path || 'unknown'}

// Model config (using wrapper pattern for centering)
// First, center the model by offsetting its local position:
model.position.set(${modelOffset.x.toFixed(4)}, ${modelOffset.y.toFixed(4)}, ${modelOffset.z.toFixed(4)});

// Apply transforms to the wrapper:
wrapper.scale.set(${modelConfig.scale}, ${modelConfig.scale}, ${modelConfig.scale});
wrapper.position.set(${modelConfig.posX}, ${modelConfig.posY}, ${modelConfig.posZ});
wrapper.rotation.set(${modelConfig.rotX.toFixed(4)}, ${modelConfig.rotY.toFixed(4)}, ${modelConfig.rotZ.toFixed(4)});

// Pivot offset (custom center point):
// pivotOffset: { x: ${pivotOffset.x.toFixed(2)}, y: ${pivotOffset.y.toFixed(2)}, z: ${pivotOffset.z.toFixed(2)} }

// Camera config
camera = new THREE.PerspectiveCamera(${cameraConfig.fov}, GBA_WIDTH / GBA_HEIGHT, 0.1, 1000);
camera.position.set(${cameraConfig.posX}, ${cameraConfig.posY}, ${cameraConfig.posZ});
camera.lookAt(${cameraConfig.lookX}, ${cameraConfig.lookY}, ${cameraConfig.lookZ});

// Main light position
mainLight.position.set(${lightPos.x}, ${lightPos.y}, ${lightPos.z});

// Material texture assignments:
${materialInfos.map(m => `// ${m.meshName} / ${m.materialName}: texture ${m.currentTexture !== null ? currentTextureFiles[m.currentTexture] : 'none'}`).join('\n')}
`;

    navigator.clipboard.writeText(config);
    alert('Config copied to clipboard!');
  };

  // Gradient background matching title screen
  const gradientStyle = {
    background: 'linear-gradient(to bottom, rgb(0, 57, 165), rgb(8, 156, 106))',
    width: GBA_WIDTH * SCALE,
    height: GBA_HEIGHT * SCALE,
    position: 'relative' as const,
    border: '2px solid #444',
    borderRadius: 4,
  };

  const sectionStyle = {
    background: '#1e1e1e',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  };

  const headerStyle = {
    fontSize: 13,
    fontWeight: 'bold' as const,
    marginBottom: 10,
    color: '#6af',
    borderBottom: '1px solid #333',
    paddingBottom: 6,
  };

  return (
    <div style={{ display: 'flex', gap: 20, padding: 20, backgroundColor: '#121212', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Canvas area */}
      <div>
        <h2 style={{ marginBottom: 10, fontSize: 16 }}>Rayquaza 3D Debug</h2>
        <p style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
          {GBA_WIDTH}×{GBA_HEIGHT} @ {SCALE}x scale
        </p>
        <div style={gradientStyle}>
          <canvas
            ref={canvasRef}
            width={GBA_WIDTH * SCALE}
            height={GBA_HEIGHT * SCALE}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              cursor: isDraggingHelper ? 'grabbing' : (showLightHelper || showPivotHelper) ? 'crosshair' : 'default',
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
          />
        </div>
        <div style={{ marginTop: 10, fontSize: 12 }}>
          {loaded ? '✅ Model loaded' : '⏳ Loading model...'}
          {isDraggingHelper && <span style={{ color: '#ff0', marginLeft: 8 }}>Dragging {isDraggingHelper}...</span>}
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: '#666' }}>
          <strong>Tips:</strong><br/>
          • Drag value bars left/right to adjust<br/>
          • Use ‹ › for small steps, «« »» for big<br/>
          • <span style={{ color: '#ff0' }}>Shift+drag</span> yellow/magenta balls to move light/pivot
        </div>
      </div>

      {/* Controls */}
      <div style={{ width: 400 }}>
        {/* Model Selector */}
        <div style={sectionStyle}>
          <div style={headerStyle}>🎮 Model Source</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {MODEL_SOURCES.map((source) => (
              <button
                key={source.id}
                onClick={() => setSelectedModelId(source.id)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: selectedModelId === source.id ? '#2563eb' : '#333',
                  border: selectedModelId === source.id ? '2px solid #5b9aff' : '1px solid #555',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: selectedModelId === source.id ? 'bold' : 'normal',
                }}
              >
                {source.name}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#666' }}>
            {MODEL_SOURCES.find(m => m.id === selectedModelId)?.type.toUpperCase()} format
          </div>
        </div>

        {/* Model Transform */}
        <div style={sectionStyle}>
          <div style={headerStyle}>📦 Model Transform</div>
          <DragSlider label="Scale" value={modelConfig.scale} onChange={(v) => updateModel('scale', v)} min={0.001} max={0.2} step={0.001} sensitivity={0.5} />
          <DragSlider label="Position X" value={modelConfig.posX} onChange={(v) => updateModel('posX', v)} min={-20} max={20} step={0.1} />
          <DragSlider label="Position Y" value={modelConfig.posY} onChange={(v) => updateModel('posY', v)} min={-20} max={20} step={0.1} />
          <DragSlider label="Position Z" value={modelConfig.posZ} onChange={(v) => updateModel('posZ', v)} min={-20} max={20} step={0.1} />
          <DragSlider label="Pitch (X)" value={modelConfig.rotX} onChange={(v) => updateModel('rotX', v)} min={-Math.PI} max={Math.PI} step={0.01} />
          <DragSlider label="Yaw (Y)" value={modelConfig.rotY} onChange={(v) => updateModel('rotY', v)} min={-Math.PI * 2} max={Math.PI * 2} step={0.01} />
          <DragSlider label="Roll (Z)" value={modelConfig.rotZ} onChange={(v) => updateModel('rotZ', v)} min={-Math.PI} max={Math.PI} step={0.01} />
        </div>

        {/* Camera */}
        <div style={sectionStyle}>
          <div style={headerStyle}>📷 Camera</div>
          <DragSlider label="FOV" value={cameraConfig.fov} onChange={(v) => updateCamera('fov', v)} min={10} max={120} step={1} />
          <DragSlider label="Cam X" value={cameraConfig.posX} onChange={(v) => updateCamera('posX', v)} min={-50} max={50} step={0.5} />
          <DragSlider label="Cam Y" value={cameraConfig.posY} onChange={(v) => updateCamera('posY', v)} min={-50} max={50} step={0.5} />
          <DragSlider label="Cam Z" value={cameraConfig.posZ} onChange={(v) => updateCamera('posZ', v)} min={1} max={100} step={0.5} />
          <DragSlider label="Look X" value={cameraConfig.lookX} onChange={(v) => updateCamera('lookX', v)} min={-20} max={20} step={0.5} />
          <DragSlider label="Look Y" value={cameraConfig.lookY} onChange={(v) => updateCamera('lookY', v)} min={-20} max={20} step={0.5} />
          <DragSlider label="Look Z" value={cameraConfig.lookZ} onChange={(v) => updateCamera('lookZ', v)} min={-20} max={20} step={0.5} />
        </div>

        {/* Light & Pivot */}
        <div style={sectionStyle}>
          <div style={headerStyle}>💡 Light & Pivot</div>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>
            Hold <span style={{ color: '#ff0', fontWeight: 'bold' }}>Shift</span> + drag balls in canvas
          </div>

          {/* Light controls */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={showLightHelper} onChange={(e) => setShowLightHelper(e.target.checked)} />
                <span style={{ fontSize: 11, color: '#ff0' }}>🔆 Show Light (yellow ball)</span>
              </label>
            </div>
            <DragSlider label="Light X" value={lightPos.x} onChange={(v) => setLightPos(p => ({ ...p, x: v }))} min={-30} max={30} step={0.5} />
            <DragSlider label="Light Y" value={lightPos.y} onChange={(v) => setLightPos(p => ({ ...p, y: v }))} min={-30} max={30} step={0.5} />
            <DragSlider label="Light Z" value={lightPos.z} onChange={(v) => setLightPos(p => ({ ...p, z: v }))} min={-30} max={30} step={0.5} />
          </div>

          {/* Pivot controls */}
          <div style={{ borderTop: '1px solid #333', paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={showPivotHelper} onChange={(e) => setShowPivotHelper(e.target.checked)} />
                <span style={{ fontSize: 11, color: '#f0f' }}>🎯 Show Pivot (magenta ball)</span>
              </label>
            </div>
            <DragSlider label="Pivot X" value={pivotOffset.x} onChange={(v) => setPivotOffset(p => ({ ...p, x: v }))} min={-10} max={10} step={0.1} />
            <DragSlider label="Pivot Y" value={pivotOffset.y} onChange={(v) => setPivotOffset(p => ({ ...p, y: v }))} min={-10} max={10} step={0.1} />
            <DragSlider label="Pivot Z" value={pivotOffset.z} onChange={(v) => setPivotOffset(p => ({ ...p, z: v }))} min={-10} max={10} step={0.1} />
            <button
              onClick={() => {
                if (modelRef.current) {
                  // Apply pivot as model offset
                  modelRef.current.position.sub(new THREE.Vector3(pivotOffset.x, pivotOffset.y, pivotOffset.z));
                  setPivotOffset({ x: 0, y: 0, z: 0 });
                }
              }}
              disabled={!loaded}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '6px',
                fontSize: 10,
                background: '#444',
                border: '1px solid #666',
                borderRadius: 3,
                color: '#fff',
                cursor: loaded ? 'pointer' : 'not-allowed',
                opacity: loaded ? 1 : 0.5,
              }}
            >
              Apply Pivot as New Center
            </button>
          </div>
        </div>

        {/* Options */}
        <div style={sectionStyle}>
          <div style={headerStyle}>⚙️ Options</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
              <input type="checkbox" checked={orbitEnabled} onChange={(e) => setOrbitEnabled(e.target.checked)} />
              <span style={{ fontSize: 12 }}>Orbit Controls (drag canvas)</span>
            </label>
            {orbitEnabled && (
              <button
                onClick={captureCamera}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: 3,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                📷 Capture
              </button>
            )}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />
            <span style={{ fontSize: 12 }}>Auto-rotate model</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={showHelpers} onChange={(e) => setShowHelpers(e.target.checked)} />
            <span style={{ fontSize: 12 }}>Show grid & axes</span>
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={autoCenterModel}
              disabled={!loaded}
              style={{
                flex: 1,
                padding: '8px 12px',
                cursor: loaded ? 'pointer' : 'not-allowed',
                background: '#444',
                border: '1px solid #666',
                borderRadius: 4,
                color: '#fff',
                fontSize: 11,
                opacity: loaded ? 1 : 0.5,
              }}
            >
              🎯 Auto-Center Model
            </button>
            <button
              onClick={autoFitCamera}
              disabled={!loaded}
              style={{
                flex: 1,
                padding: '8px 12px',
                cursor: loaded ? 'pointer' : 'not-allowed',
                background: '#444',
                border: '1px solid #666',
                borderRadius: 4,
                color: '#fff',
                fontSize: 11,
                opacity: loaded ? 1 : 0.5,
              }}
            >
              📐 Auto-Fit Camera
            </button>
          </div>

          {boundingBox && (
            <div style={{ marginTop: 12, fontSize: 10, color: '#888', fontFamily: 'monospace' }}>
              <div>Bounding Box (scaled):</div>
              <div>Center: ({boundingBox.center.x.toFixed(1)}, {boundingBox.center.y.toFixed(1)}, {boundingBox.center.z.toFixed(1)})</div>
              <div>Size: ({boundingBox.size.x.toFixed(1)}, {boundingBox.size.y.toFixed(1)}, {boundingBox.size.z.toFixed(1)})</div>
            </div>
          )}
        </div>

        {/* Materials & Textures */}
        {materialInfos.length > 0 && (
          <div style={sectionStyle}>
            <div style={headerStyle}>🎨 Materials & Textures ({materialInfos.length})</div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {materialInfos.map((info, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    padding: 6,
                    background: '#252525',
                    borderRadius: 4,
                    fontSize: 11,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {info.meshName}
                    </div>
                    <div style={{ color: '#666', fontSize: 10 }}>
                      {info.materialName}
                    </div>
                  </div>
                  <select
                    value={info.currentTexture ?? -1}
                    onChange={(e) => changeTexture(idx, e.target.value === '-1' ? null : parseInt(e.target.value))}
                    style={{
                      padding: '4px 6px',
                      fontSize: 10,
                      background: '#333',
                      border: '1px solid #555',
                      borderRadius: 3,
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={-1}>None</option>
                    {currentTextureFiles.map((file, texIdx) => (
                      <option key={texIdx} value={texIdx}>
                        {file}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
              {selectedModelId === 'rayquaza-xy' && 'Tip: Image_2.png contains eyes/irises (4x2 atlas)'}
              {selectedModelId.startsWith('rayquaza-wii') && 'Tip: RayEye.png = eyes, Raykuchi.png = mouth'}
            </div>
          </div>
        )}

        {/* Mesh Debug Info */}
        {meshDebugInfos.length > 0 && (
          <div style={sectionStyle}>
            <div
              style={{ ...headerStyle, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              onClick={() => setShowDebugPanel(!showDebugPanel)}
            >
              <span>🔍 Model Debug Info ({meshDebugInfos.length} meshes)</span>
              <span>{showDebugPanel ? '▼' : '▶'}</span>
            </div>
            {showDebugPanel && (
              <div style={{ maxHeight: 400, overflowY: 'auto', fontSize: 10, fontFamily: 'monospace' }}>
                {meshDebugInfos.map((mesh, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom: 12,
                      padding: 8,
                      background: '#1a1a1a',
                      borderRadius: 4,
                      border: '1px solid #333',
                    }}
                  >
                    <div style={{ color: '#6af', fontWeight: 'bold', marginBottom: 4 }}>
                      {mesh.name}
                    </div>
                    <div style={{ color: '#666', marginBottom: 4, wordBreak: 'break-all' }}>
                      {mesh.path}
                    </div>
                    <div style={{ color: '#888' }}>
                      Vertices: {mesh.vertexCount} | Faces: {mesh.faceCount}
                    </div>
                    <div style={{ color: '#888' }}>
                      UV: {mesh.hasUV ? '✅' : '❌'} | UV2: {mesh.hasUV2 ? '✅' : '❌'}
                    </div>
                    {mesh.uvBounds && (
                      <div style={{ color: '#9c9', marginTop: 4 }}>
                        <div>UV Bounds:</div>
                        <div style={{ paddingLeft: 8 }}>
                          U: [{mesh.uvBounds.minU.toFixed(3)} → {mesh.uvBounds.maxU.toFixed(3)}]
                        </div>
                        <div style={{ paddingLeft: 8 }}>
                          V: [{mesh.uvBounds.minV.toFixed(3)} → {mesh.uvBounds.maxV.toFixed(3)}]
                        </div>
                        <div style={{ paddingLeft: 8, color: '#fc6' }}>
                          Atlas region (4x2): col {Math.floor(mesh.uvBounds.minU * 4)}-{Math.floor(mesh.uvBounds.maxU * 4)}, row {Math.floor(mesh.uvBounds.minV * 2)}-{Math.floor(mesh.uvBounds.maxV * 2)}
                        </div>
                      </div>
                    )}
                    {mesh.groups.length > 0 && (
                      <div style={{ color: '#c9c', marginTop: 4 }}>
                        Groups: {mesh.groups.map((g, i) => (
                          <span key={i} style={{ marginRight: 8 }}>
                            [{g.materialIndex}]: {g.start}-{g.start + g.count}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 4 }}>
                      {mesh.materials.map((mat, mi) => (
                        <div key={mi} style={{ color: '#aaa', padding: 4, background: '#222', marginTop: 4, borderRadius: 2 }}>
                          <div style={{ color: '#f9c' }}>Material: {mat.name} ({mat.type})</div>
                          <div>Color: <span style={{ color: mat.color }}>{mat.color}</span></div>
                          <div>Map: {mat.hasMap ? `✅ ${mat.mapName || 'unnamed'}` : '❌'}</div>
                          <div>Normal: {mat.hasNormalMap ? '✅' : '❌'} | Emissive: {mat.hasEmissive ? <span style={{ color: mat.emissiveColor }}>{mat.emissiveColor}</span> : '❌'}</div>
                          <div>Transparent: {mat.transparent ? '✅' : '❌'} | Opacity: {mat.opacity} | Side: {mat.side}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 8, padding: 8, background: '#222', borderRadius: 4 }}>
                  <div style={{ color: '#fc6', marginBottom: 4 }}>📐 Image_2.png Atlas Layout (4x2):</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, fontSize: 9 }}>
                    <div style={{ background: '#333', padding: 4, textAlign: 'center' }}>0,0</div>
                    <div style={{ background: '#333', padding: 4, textAlign: 'center' }}>1,0</div>
                    <div style={{ background: '#333', padding: 4, textAlign: 'center' }}>2,0</div>
                    <div style={{ background: '#533', padding: 4, textAlign: 'center' }}>3,0 (mouth?)</div>
                    <div style={{ background: '#353', padding: 4, textAlign: 'center' }}>0,1 (eye?)</div>
                    <div style={{ background: '#353', padding: 4, textAlign: 'center' }}>1,1 (eye?)</div>
                    <div style={{ background: '#353', padding: 4, textAlign: 'center' }}>2,1 (eye?)</div>
                    <div style={{ background: '#353', padding: 4, textAlign: 'center' }}>3,1 (eye?)</div>
                  </div>
                  <div style={{ color: '#888', marginTop: 4 }}>
                    Check console for full UV analysis
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <button
            onClick={copyConfig}
            style={{
              flex: 1,
              padding: '10px 16px',
              cursor: 'pointer',
              background: '#2563eb',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontWeight: 'bold',
              fontSize: 13,
            }}
          >
            📋 Copy Config
          </button>
          <button
            onClick={() => { setModelConfig(defaultModelConfig); setCameraConfig(defaultCameraConfig); }}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              background: '#333',
              border: '1px solid #555',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
            }}
          >
            🔄 Reset
          </button>
        </div>

        {/* Output */}
        <div style={sectionStyle}>
          <div style={headerStyle}>📄 Current Config</div>
          <pre style={{
            fontSize: 9,
            backgroundColor: '#0d0d0d',
            padding: 10,
            borderRadius: 4,
            overflow: 'auto',
            maxHeight: 280,
            margin: 0,
            lineHeight: 1.4,
          }}>
{`// Model: ${MODEL_SOURCES.find(m => m.id === selectedModelId)?.name}
// Path: ${MODEL_SOURCES.find(m => m.id === selectedModelId)?.path}

// Wrapper transforms
scale: ${modelConfig.scale}
position: (${modelConfig.posX}, ${modelConfig.posY}, ${modelConfig.posZ})
rotation: (${modelConfig.rotX.toFixed(4)}, ${modelConfig.rotY.toFixed(4)}, ${modelConfig.rotZ.toFixed(4)})

// Model center offset (from auto-center)
offset: (${modelRef.current?.position.x.toFixed(2) ?? 0}, ${modelRef.current?.position.y.toFixed(2) ?? 0}, ${modelRef.current?.position.z.toFixed(2) ?? 0})

// Pivot offset
pivot: (${pivotOffset.x.toFixed(2)}, ${pivotOffset.y.toFixed(2)}, ${pivotOffset.z.toFixed(2)})

// Camera
fov: ${cameraConfig.fov}
camPos: (${cameraConfig.posX}, ${cameraConfig.posY}, ${cameraConfig.posZ})
lookAt: (${cameraConfig.lookX}, ${cameraConfig.lookY}, ${cameraConfig.lookZ})

// Main Light
lightPos: (${lightPos.x}, ${lightPos.y}, ${lightPos.z})`}
          </pre>
        </div>
      </div>
    </div>
  );
}
