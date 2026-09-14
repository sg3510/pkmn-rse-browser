/**
 * 3D enhancement of public/pokeemerald/src/title_screen.c's static silhouette
 * and UpdateLegendaryMarkingColor. Pose/motion are authored for the ORAS rig.
 */
import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { toPublicAssetUrl } from '../utils/publicAssetUrl';

import { UPPER_COIL, LOWER_COIL, markingRollForJoint, type Cubic2 } from './rayquazaPoseReference';
import { sampleRayquazaFlight, sampleSwimAngle } from './rayquazaMotion';
export { RAYQUAZA_ENTRANCE_SECONDS } from './rayquazaMotion';

interface JointPose {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  worldRest: THREE.Quaternion;
  forward: THREE.Vector3;
  target: THREE.Vector3;
  distance: number;
  positionRest: THREE.Vector3;
  positionTarget: THREE.Vector3;
}

export class RayquazaFlight {
  readonly group = new THREE.Group();
  private model: THREE.Object3D | null = null;
  private joints: JointPose[] = [];
  private glow = { value: 0 };
  private rotation = new THREE.Quaternion();
  private twist = new THREE.Quaternion();
  private parentRotation = new THREE.Quaternion();
  private groupRotation = new THREE.Quaternion();
  private direction = new THREE.Vector3();
  private axis = new THREE.Vector3(0, 0, 1);
  private disposed = false;
  private bindSpaceInverse = new THREE.Matrix4();
  private poseSpace = new THREE.Matrix4();
  private point = new THREE.Vector3();
  private desiredPoint = new THREE.Vector3();

  async load(): Promise<void> {
    const manager = new THREE.LoadingManager();
    // Await textures as well as the DAE before showing the entrance.
    let failedAsset: string | undefined;
    const loaded = new Promise<void>(resolve => {
      manager.onLoad = resolve;
      manager.onError = url => { failedAsset = url; };
    });
    const collada = await new ColladaLoader(manager).loadAsync(
      toPublicAssetUrl('/3dmodels/Rayquaza_ORAS/pm0384_00_fi.dae'),
    );
    this.model = collada.scene;
    await loaded;
    if (failedAsset) throw new Error(`Rayquaza asset failed: ${failedAsset}`);
    if (this.disposed) { this.dispose(); return; }
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this.group.add(this.model);
    this.group.updateMatrixWorld(true);
    const bones = new Map<string, THREE.Bone>();
    this.model.traverse(object => {
      if (object instanceof THREE.Bone) bones.set(object.name, object);
    });
    this.bindSpaceInverse.copy(this.model.matrixWorld).invert();
    const waist = bones.get('Waist')!.getWorldPosition(new THREE.Vector3());
    const fromPixel = (x: number, y: number) => new THREE.Vector3((x - 53) * 0.42, (159 - y) * 0.42, 0).add(waist);
    const makeCurve = (segments: readonly Cubic2[]) => {
      const curve = new THREE.CurvePath<THREE.Vector3>();
      for (const segment of segments) {
        const [a, b, c, d] = segment.map(([x, y]) => fromPixel(x, y));
        curve.add(new THREE.CubicBezierCurve3(a, b, c, d));
      }
      return curve;
    };
    const upper = makeCurve(UPPER_COIL);
    const lower = makeCurve(LOWER_COIL);
    // The guide marks the face center. The head bone sits slightly up the neck.
    const headStart = 0.075;
    const upperNames = ['Spine1', 'Spine2', 'Neck1', 'Neck2', 'Head'];
    const segments: [string, string | null, THREE.Vector3, THREE.Vector3, number][] = [];
    upperNames.forEach((name, index) => {
      const position = upper.getPointAt(1 - index / 4 * (1 - headStart));
      const end = index === 4 ? position.clone().add(new THREE.Vector3(0, -0.65, 1).normalize()) : upper.getPointAt(1 - (index + 1) / 4 * (1 - headStart));
      segments.push([name, index === 4 ? 'loc_mouth' : upperNames[index + 1], position, end, (4 - index) * 12]);
    });
    for (let index = 0; index <= 15; index++) {
      const position = lower.getPointAt(index / 15);
      const end = index === 15 ? position.clone().add(lower.getTangentAt(1)) : lower.getPointAt((index + 1) / 15);
      segments.push([index === 0 ? 'Hips' : `Tail${index}`, index === 15 ? null : `Tail${index + 1}`, position, end, 54 + index * 9]);
    }
    for (const [name, childName, position, end, distance] of segments) {
      const bone = bones.get(name);
      const child = childName ? bones.get(childName) : null;
      if (!bone || (childName && !child)) throw new Error(`Missing Rayquaza joint: ${name}/${childName}`);
      const worldRest = bone.getWorldQuaternion(new THREE.Quaternion());
      this.joints.push({ bone, rest: bone.quaternion.clone(), worldRest,
        positionRest: bone.position.clone(), positionTarget: position,
        forward: child ? child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize() : new THREE.Vector3(1, 0, 0).applyQuaternion(worldRest),
        target: end.sub(position).normalize(), distance });
    }
    this.model.traverse(object => {
      if (object instanceof THREE.Mesh) {
        // Animated skin bounds change substantially between straight and coiled poses.
        object.frustumCulled = false;
        const originals = Array.isArray(object.material) ? object.material : [object.material];
        const replacements = originals.map(original => {
          const source = original as THREE.MeshPhongMaterial;
          const eye = source.map?.image instanceof HTMLImageElement && source.map.image.src.includes('_eye');
          const material = new THREE.MeshPhongMaterial({ map: source.map, color: eye ? 0xffffff : 0x426b60,
            emissive: eye ? 0xffffff : 0x000000, emissiveMap: eye ? source.map : null, emissiveIntensity: eye ? 0.35 : 1,
            shininess: 8, specular: 0x10251e, side: THREE.DoubleSide });
          if (source.map?.name.includes('body') || (source.map?.image instanceof HTMLImageElement && source.map.image.src.includes('_body'))) {
            // UV-aligned yellow mask, restricted to the body material (never eyes).
            // Replace base yellow too, so markings dim into the green silhouette.
            material.onBeforeCompile = shader => {
              shader.uniforms.markingGlow = this.glow;
              shader.fragmentShader = 'uniform float markingGlow;\n' + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                #include <map_fragment>
                float markingMask = smoothstep(0.03, 0.12, sampledDiffuseColor.r - sampledDiffuseColor.g)
                  * smoothstep(0.06, 0.18, sampledDiffuseColor.g - sampledDiffuseColor.b);
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.13, 0.085), markingMask);
              `).replace('#include <emissivemap_fragment>', `
                #include <emissivemap_fragment>
                totalEmissiveRadiance += vec3(1.0, 0.82, 0.16) * markingMask * markingGlow * 1.5;
              `);
            };
            material.customProgramCacheKey = () => 'rayquaza-markings-v1';
          }
          original.dispose();
          return material;
        });
        object.material = Array.isArray(object.material) ? replacements : replacements[0];
      }
    });
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this.pose(1, 0);
    this.group.updateMatrixWorld(true);
    // Match the reference's 256px coordinate plane to the fixed title camera.
    // Bounds-based fitting shrinks the curve when fins/arms enlarge the bounds,
    // and face-depth centering pushes the body farther behind the guide plane.
    const scale = (2 * 5.5 * Math.tan(THREE.MathUtils.degToRad(35 / 2))) / (256 * 0.42);
    const center = fromPixel(128, 128);
    this.model.scale.multiplyScalar(scale);
    this.model.position.addScaledVector(center, -scale);
    this.update(0);
  }

  private pose(coil: number, seconds: number): void {
    if (!this.model) return;
    for (const joint of this.joints) {
      joint.bone.quaternion.copy(joint.rest);
      joint.bone.position.copy(joint.positionRest);
    }
    this.group.updateMatrixWorld(true);
    this.group.getWorldQuaternion(this.groupRotation);
    this.poseSpace.copy(this.model.matrixWorld).multiply(this.bindSpaceInverse);
    for (const joint of this.joints) {
      joint.bone.getWorldPosition(this.point);
      this.desiredPoint.copy(joint.positionTarget).applyMatrix4(this.poseSpace);
      this.point.lerp(this.desiredPoint, coil);
      joint.bone.position.copy(joint.bone.parent!.worldToLocal(this.point));
      const swim = sampleSwimAngle(joint.distance, seconds) * (1 - coil);
      const restAngle = Math.atan2(joint.forward.y, joint.forward.x);
      const targetAngle = Math.atan2(joint.target.y, joint.target.x);
      // Keep every planar bend on the same Z axis, including a 180-degree turn.
      // A shortest-arc 3D rotation can flip the skin around its length at the tail.
      let turn = targetAngle - restAngle;
      if (turn > Math.PI) turn -= Math.PI * 2;
      if (turn < -Math.PI) turn += Math.PI * 2;
      this.rotation.setFromAxisAngle(this.axis, turn * coil + swim);
      if (joint.bone.name === 'Head') {
        this.direction.copy(joint.forward).lerp(joint.target, coil).normalize();
        this.rotation.setFromUnitVectors(joint.forward, this.direction);
        this.twist.setFromAxisAngle(this.axis, swim);
        this.rotation.premultiply(this.twist);
      }
      if (joint.bone.name !== 'Head') {
        this.direction.copy(joint.forward).applyQuaternion(this.rotation).normalize();
        this.twist.setFromAxisAngle(this.direction, markingRollForJoint(joint.bone.name) * coil);
        this.rotation.premultiply(this.twist);
      }
      this.rotation.multiply(joint.worldRest);
      this.rotation.premultiply(this.groupRotation);
      joint.bone.parent!.getWorldQuaternion(this.parentRotation).invert();
      joint.bone.quaternion.copy(this.parentRotation).multiply(this.rotation);
      joint.bone.updateWorldMatrix(false, true);
    }
  }

  update(seconds: number, aspect = 1): void {
    const motion = sampleRayquazaFlight(seconds);
    this.group.visible = motion.visible;
    this.group.position.set(motion.x * Math.max(1, aspect), motion.y, 0);
    this.group.rotation.set(0, motion.yaw, motion.roll);
    this.group.scale.setScalar(motion.scale);
    this.glow.value = motion.glow;
    this.pose(motion.coil, seconds);
  }

  dispose(): void {
    this.disposed = true;
    const textures = new Set<THREE.Texture>();
    const materials = new Set<THREE.Material>();
    this.model?.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      }
      if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
    });
    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
    this.group.clear();
    this.model = null;
    this.joints = [];
  }
}
