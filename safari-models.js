import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Sculpted, continuous surfaces. Species have their own anatomy, not a shared toy body.
const sphere = new THREE.SphereGeometry(1, 40, 28);
const materials = new Map(), sculptures = new Map();
const palettes = {
  lion: ['#c99249', '#76472d'], tiger: ['#de8b38', '#4c3525'],
  giraffe: ['#d5af6d', '#885731'], elephant: ['#869e9c', '#c49b95'],
  zebra: ['#eee7d8', '#45423e'], monkey: ['#87644c', '#e5c9a2'],
  hippo: ['#9c87a1', '#c8a7b1'], rhino: ['#939688', '#d6c6a5'],
};
function material(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .82, envMapIntensity: .32 }));
  return materials.get(color);
}
// Evaluate markings per pixel so they stay crisp on curved surfaces, even at thumbnail size.
function paintedMaterial(color, kind, region) {
  if (!['tiger', 'zebra', 'giraffe'].includes(kind)) return material(color);
  const key = `${kind}-${region}-${color}`;
  if (!materials.has(key)) {
    const skin = material(color).clone();
    let pattern;
    if (kind === 'tiger') pattern = region === 'body'
      ? 'float stripe = sin(p.z * 19.0 + p.y * 3.0 + sin(p.y * 9.0) * .7); float mark = smoothstep(.63, .70, stripe) * smoothstep(.25, .29, abs(p.x)) * .93;'
      : 'float stripe = sin(p.y * 25.0 + abs(p.x) * 8.0 + p.z * 3.0); float mark = smoothstep(.63, .70, stripe) * smoothstep(.22, .26, abs(p.x)) * .93;';
    else if (kind === 'zebra') pattern = region === 'head'
      ? 'float stripe = sin(p.x * 30.0 + p.z * 6.0 + sin(p.y * 6.0) * .9); float mark = smoothstep(.18, .25, stripe) * smoothstep(.035, .08, abs(p.x)) * .96;'
      : 'float stripe = sin(p.z * 19.0 + p.y * 4.0 + sin(p.y * 8.0) * .7 + abs(p.x) * 3.0); float mark = smoothstep(.18, .25, stripe) * .96;';
    else pattern = 'float spot = sin(p.y * 16.0 + p.z * 5.0) * cos(p.z * 16.0 + p.x * 7.0 + .4); float mark = smoothstep(.20, .25, spot) * .85;';
    skin.onBeforeCompile = shader => {
      shader.uniforms.safariInk = { value: new THREE.Color(palettes[kind][1]) };
      shader.vertexShader = 'varying vec3 safariPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nsafariPosition = position;');
      shader.fragmentShader = 'varying vec3 safariPosition;\nuniform vec3 safariInk;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\nvec3 p = safariPosition; ${pattern} diffuseColor.rgb = mix(diffuseColor.rgb, safariInk, mark);`);
    };
    skin.customProgramCacheKey = () => key;
    materials.set(key, skin);
  }
  return materials.get(key);
}
function part(parent, color, position, scale) {
  const mesh = new THREE.Mesh(sphere, material(color));
  mesh.position.set(...position); mesh.scale.set(...scale);
  parent.add(mesh); return mesh;
}
function joint(parent, position) {
  const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group;
}
function sculpt(parent, name, color, shapes, kind, region) {
  if (!sculptures.has(name)) {
    const bounds = new THREE.Box3();
    for (const [c, r] of shapes) {
      bounds.expandByPoint(new THREE.Vector3(...c).sub(new THREE.Vector3(...r)));
      bounds.expandByPoint(new THREE.Vector3(...c).add(new THREE.Vector3(...r)));
    }
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z) * .61;
    const resolution = 42;
    const field = new MarchingCubes(resolution, material(color), false, false, 16000);
    field.isolation = 0;
    for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
      const px = center.x + (x * 2 / resolution - 1) * extent;
      const py = center.y + (y * 2 / resolution - 1) * extent;
      const pz = center.z + (z * 2 / resolution - 1) * extent;
      let distance = 1e3;
      for (const [c, r] of shapes) {
        const dx = (px - c[0]) / r[0], dy = (py - c[1]) / r[1], dz = (pz - c[2]) / r[2];
        const d = (Math.sqrt(dx * dx + dy * dy + dz * dz) - 1) * Math.min(...r);
        const k = .075;
        const h = Math.max(0, k - Math.abs(distance - d)) / k;
        distance = Math.min(distance, d) - h * h * k * .25;
      }
      field.field[x + y * resolution + z * resolution * resolution] = -distance;
    }
    field.update();
    const geometry = new THREE.BufferGeometry();
    for (const attribute of ['position', 'normal']) geometry.setAttribute(attribute, new THREE.BufferAttribute(field.geometry.getAttribute(attribute).array.slice(0, field.count * 3), 3));
    geometry.scale(extent, extent, extent); geometry.translate(center.x, center.y, center.z);
    field.geometry.dispose();
    geometry.computeBoundingSphere(); sculptures.set(name, geometry);
  }
  const mesh = new THREE.Mesh(sculptures.get(name), paintedMaterial(color, kind, region));
  parent.add(mesh); return mesh;
}

// One connected skinned surface per limb/trunk/tail, so bends have no bead-like joints.
function flexibleTube(parent, color, points, radii, bonePositions) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const segments = 36, sides = 20;
  const frames = curve.computeFrenetFrames(segments, false);
  const vertices = [], indices = [], skinIndices = [], skinWeights = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, point = curve.getPointAt(t);
    const stop = t * (radii.length - 1), a = Math.floor(stop), mix = stop - a;
    const radius = THREE.MathUtils.lerp(radii[a], radii[Math.min(a + 1, radii.length - 1)], mix);
    const weightPosition = t * (bonePositions.length - 1);
    const bone = Math.min(bonePositions.length - 2, Math.floor(weightPosition));
    const weight = weightPosition - bone;
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const vertex = point.clone().addScaledVector(frames.normals[i], Math.cos(angle) * radius).addScaledVector(frames.binormals[i], Math.sin(angle) * radius);
      vertices.push(vertex.x, vertex.y, vertex.z);
      skinIndices.push(bone, bone + 1, 0, 0); skinWeights.push(1 - weight, weight, 0, 0);
      if (i < segments && j < sides) {
        const v = i * (sides + 1) + j;
        indices.push(v, v + sides + 1, v + 1, v + 1, v + sides + 1, v + sides + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.SkinnedMesh(geometry, material(color));
  const bones = bonePositions.map((p, i) => {
    const bone = new THREE.Bone();
    const previous = i ? bonePositions[i - 1] : [0, 0, 0];
    bone.position.set(p[0] - previous[0], p[1] - previous[1], p[2] - previous[2]);
    return bone;
  });
  bones.forEach((bone, i) => (i ? bones[i - 1] : mesh).add(bone));
  parent.add(mesh); mesh.updateWorldMatrix(true, true); mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false;
  return bones;
}
function smile(parent, width, y, z) {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-width, y + .03, z), new THREE.Vector3(0, y, z + .018), new THREE.Vector3(width, y + .03, z)]);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, .012, 6, false), material('#5c493b'));
  parent.add(mesh);
}

export function createAnimal(kind) {
  const [skin, accent] = palettes[kind];
  const root = new THREE.Group(), bodyRig = joint(root, [0, 0, 0]);
  const stocky = ['elephant', 'hippo', 'rhino'].includes(kind), monkey = kind === 'monkey', tall = kind === 'giraffe';
  const width = stocky ? .58 : monkey ? .31 : .41;
  const bodyY = tall ? .96 : monkey ? .84 : .78;
  const length = stocky ? .76 : monkey ? .33 : .62;
  const body = sculpt(bodyRig, `${kind}-body`, skin, [
    [[0, bodyY, -.16], [width, stocky ? .48 : monkey ? .48 : .38, length]],
    [[0, bodyY + .055, .23], [width * .91, stocky ? .46 : .39, .4]],
    [[0, bodyY - .025, -.51], [width * .95, .34, .32]],
  ], kind, 'body');
  const legs = [];
  for (const side of [-1, 1]) for (const front of [false, true]) {
    const arm = monkey && front;
    const x = side * (arm ? .36 : width * .73);
    const legY = arm ? 1.1 : tall ? .83 : stocky ? .64 : .61;
    const legLength = arm ? .66 : tall ? .79 : stocky ? .60 : .57;
    const z = monkey ? (front ? .1 : -.12) : front ? .38 : -.53;
    const leg = joint(bodyRig, [x, legY, z]);
    const radius = stocky ? .17 : tall ? .09 : arm ? .085 : .13;
    const bones = flexibleTube(leg, skin,
      [[0, .04, 0], [0, -legLength * .45, -.01], [0, -legLength * .78, .02], [0, -legLength * .98, .04]],
      [radius * .85, radius, radius * .91, radius * .81, radius * .70, radius * .48, .003],
      [[0, 0, 0], [0, -legLength * .53, 0]]);
    const knee = bones[1];
    const footColor = tall || kind === 'zebra' ? accent : skin;
    part(knee, footColor, [0, -legLength * .43, .08], arm ? [radius * .95, radius * 1.3, radius] : [radius * 1.05, radius * .65, radius * 1.45]);
    if (stocky) for (const toe of [-1, 0, 1]) {
      part(knee, '#d9d3c4', [toe * .052, -legLength * .45, .31], [.026, .022, .014]);
    }
    legs.push({ leg, knee, phase: side * (front ? 1 : -1) > 0 ? 0 : Math.PI, front });
  }
  const neck = joint(bodyRig, [0, tall ? 1.16 : monkey ? 1.17 : 1.02, monkey ? .02 : .38]);
  if (tall) sculpt(neck, 'giraffe-neck', skin, [
    [[0, .34, -.01], [.19, .53, .21]], [[0, .65, -.005], [.155, .32, .18]],
  ], kind, 'neck');
  const head = joint(neck, [0, tall ? .84 : .04, .06]);
  const faceWidth = kind === 'rhino' ? .42 : stocky ? .48 : monkey ? .40 : tall ? .31 : .46;
  const faceHeight = stocky ? .39 : .44;
  const snoutWidth = kind === 'hippo' ? .48 : kind === 'rhino' ? .34 : tall ? .27 : .29;
  const snoutZ = kind === 'rhino' || kind === 'hippo' ? .40 : .34;
  if (kind === 'lion') {
    const mane = sphere.clone();
    const positions = mane.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const angle = Math.atan2(y, x), ripple = 1 + .055 * Math.sin(angle * 9) + .018 * Math.sin(angle * 21);
      positions.setXYZ(i, x * .67 * ripple, y * .66 * ripple + .26, z * .30 - .10);
    }
    mane.computeVertexNormals();
    const fur = new THREE.Mesh(mane, material(accent)); head.add(fur);
  }
  sculpt(head, `${kind}-head`, skin, [
    [[0, .28, .09], [faceWidth, faceHeight, stocky ? .43 : .38]],
    [[0, .09, snoutZ], [snoutWidth, kind === 'hippo' ? .24 : .18, stocky && kind !== 'elephant' ? .30 : .22]],
    [[-.19, .13, .28], [.20, .19, .23]], [[.19, .13, .28], [.20, .19, .23]],
  ], kind, 'head');
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = joint(head, [side * (kind === 'elephant' ? .44 : kind === 'lion' ? .43 : .34), kind === 'lion' ? .68 : kind === 'hippo' || kind === 'rhino' ? .60 : .57, kind === 'lion' ? .13 : -.035]);
    const pointed = tall || kind === 'zebra';
    const size = kind === 'elephant' ? [.38, .49, .105] : pointed ? [.12, .25, .09] : [.145, .15, .095];
    const outer = part(ear, skin, [side * (kind === 'elephant' ? .08 : 0), 0, 0], size);
    outer.rotation.z = side * (pointed ? -.35 : kind === 'elephant' ? -.15 : -.25);
    const inner = part(ear, kind === 'elephant' ? accent : '#d4b197', [side * (kind === 'elephant' ? .08 : 0), .006, .071], size.map((v, i) => v * (i === 2 ? .40 : .62)));
    inner.rotation.z = outer.rotation.z; ears.push({ ear, side });
  }
  if (tall) for (const x of [-.145, .145]) {
    part(head, accent, [x, .71, -.02], [.037, .17, .038]);
    part(head, accent, [x, .87, -.02], [.058, .052, .058]);
  }
  if (monkey) sculpt(head, 'monkey-mask', accent, [
    [[-.14, .30, .40], [.215, .25, .10]], [[.14, .30, .40], [.215, .25, .10]],
    [[0, .04, .40], [.29, .20, .16]],
  ], 'mask', 'face');
  const muzzleColor = kind === 'elephant' || stocky ? skin : kind === 'zebra' ? '#514a42' : '#f1dfbc';
  if (!stocky && !monkey) sculpt(head, `${kind}-muzzle`, muzzleColor, [
    [[-.11, .07, .465], [.165, .135, .10]], [[.11, .07, .465], [.165, .135, .10]],
  ], 'muzzle', 'face');
  const jaw = joint(head, [0, -.025, .41]);
  part(jaw, muzzleColor, [0, -.02, .035], [snoutWidth * .72, .07, .13]);
  smile(head, stocky ? .18 : .12, -.005, kind === 'hippo' || kind === 'rhino' ? .73 : stocky ? .62 : .58);
  if (!stocky && !monkey) part(head, '#5b4231', [0, .15, .58], [.072, .048, .036]);
  if (monkey) {
    part(head, '#775a48', [-.045, .12, .566], [.015, .013, .016]);
    part(head, '#775a48', [.045, .12, .566], [.015, .013, .016]);
  }
  if (kind === 'hippo' || kind === 'rhino') for (const side of [-1, 1]) part(head, '#766761', [side * .18, .20, .71], [.035, .024, .018]);
  if (kind === 'rhino') {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(.09, .35, 24), material('#ddd6bf'));
    horn.position.set(0, .32, .57); horn.rotation.x = .3; head.add(horn);
  }
  const eyes = [];
  const eyeZ = monkey ? .51 : .425;
  for (const side of [-1, 1]) {
    const eye = joint(head, [side * (stocky ? .285 : tall ? .18 : .215), .365, eyeZ]);
    const eyeball = part(eye, '#292820', [0, 0, 0], [.074, .09, .043]);
    eyeball.material = new THREE.MeshPhysicalMaterial({ color: '#28251f', roughness: .17, clearcoat: .7 });
    part(eye, '#fff9ea', [-.021, .026, .038], [.018, .022, .008]);
    part(eye, '#fff9ea', [.021, -.02, .037], [.007, .009, .006]);
    eyes.push(eye);
    const eyebrow = part(head, stocky ? skin : accent, [side * (stocky ? .285 : tall ? .18 : .215), .49, eyeZ - .005], [.10, .034, .038]);
    eyebrow.rotation.z = side * -.12;
  }
  const trunk = [];
  if (kind === 'elephant') {
    const mount = joint(head, [0, .12, .45]);
    trunk.push(...flexibleTube(mount, skin,
      [[0, 0, 0], [0, -.22, .02], [0, -.55, .09], [0, -.70, .23], [0, -.61, .34]],
      [.165, .14, .11, .09, .008],
      [[0, 0, 0], [0, -.16, .01], [0, -.32, .03], [0, -.48, .06], [0, -.64, .10]]));
  }
  const tail = joint(bodyRig, [0, bodyY + .14, monkey ? -.3 : -length - .17]);
  const tailLength = monkey ? .85 : kind === 'hippo' ? .24 : stocky ? .33 : .59;
  const tailJoints = flexibleTube(tail, skin,
    [[0, 0, 0], [0, -.035, -tailLength * .36], [.045, .02, -tailLength * .75], [.08, .15, -tailLength]],
    [monkey ? .062 : .035, .037, .029, .012],
    [[0, 0, 0], [0, 0, -tailLength * .33], [0, .025, -tailLength * .66], [.08, .14, -tailLength]]);
  if (kind === 'lion' || tall) part(tailJoints.at(-1), accent, [0, 0, 0], [.065, .075, .10]);
  const scale = tall ? .88 : 1;
  root.scale.setScalar(scale);
  return { root, bodyRig, body, neck, head, legs, ears, eyes, tailJoints, trunk, jaw, scale, kind };
}

export function poseAnimal(rig, state, seconds, phase, surprise = null) {
  const { root, bodyRig, neck, head, legs, eyes, ears, tailJoints, trunk, jaw, scale } = rig;
  // Reset the pose before blending into the next activity.
  root.position.set(0, 0, 0); root.rotation.set(0, .35, 0); root.scale.setScalar(scale);
  bodyRig.rotation.set(0, 0, 0); bodyRig.position.set(0, 0, 0);
  neck.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
  jaw.rotation.x = 0;
  const gait = seconds * 8;
  const blink = seconds % 4.7 > 4.5 ? .1 : 1;
  eyes.forEach(eye => eye.scale.set(1, state === 'sleep' ? .07 : blink, 1));
  legs.forEach(({ leg, knee }) => { leg.rotation.set(0, 0, 0); knee.rotation.x = 0; });
  tailJoints.forEach((tail, i) => { tail.rotation.set(0, Math.sin(seconds * 3 - i * .45) * .2, rig.kind === 'monkey' ? .42 : .08); });
  ears.forEach(({ ear, side }) => { ear.rotation.y = Math.sin(seconds * 3.2) * .16 * side; });
  trunk.forEach((segment, i) => { segment.rotation.x = Math.sin(seconds * 2.5 - i * .6) * .16; });
  if (state === 'walk') {
    const angle = phase * Math.PI * 4;
    root.position.set(Math.sin(angle) * .54, Math.abs(Math.sin(gait)) * .035, Math.cos(angle) * .42);
    root.rotation.y = angle + Math.PI / 2;
    bodyRig.rotation.z = Math.sin(gait) * .055;
    head.rotation.x = Math.sin(gait) * .07;
    legs.forEach(({ leg, knee, phase }) => { leg.rotation.x = Math.sin(gait + phase) * .44; knee.rotation.x = Math.max(0, -Math.sin(gait + phase)) * .32; });
  } else if (state === 'eat') {
    root.rotation.y = .18;
    bodyRig.position.y = -.13;
    bodyRig.rotation.x = .12;
    neck.rotation.x = (rig.kind === 'giraffe' ? 1.85 : .95) + Math.sin(seconds * 5) * .1;
    head.rotation.x = .4 + Math.sin(seconds * 8) * .06;
    legs.filter(leg => leg.front).forEach(({ leg, knee }) => { leg.rotation.x = -.28; knee.rotation.x = .18; });
    jaw.rotation.x = Math.max(0, Math.sin(seconds * 10)) * .3;
    trunk.forEach((segment, i) => { segment.rotation.x = -.18 + Math.sin(seconds * 4 - i * .4) * .22; });
  } else if (state === 'sleep') {
    bodyRig.position.y = -.24 + Math.sin(seconds * 2) * .014;
    bodyRig.rotation.z = -.28;
    neck.rotation.x = .55; head.rotation.z = -.3;
    legs.forEach(({ leg, knee, front }) => { leg.rotation.x = front ? -.95 : 1.15; knee.rotation.x = -.65; });
    root.scale.set(scale * (1 + Math.sin(seconds * 2) * .015), scale, scale);
    tailJoints.forEach(tail => { tail.rotation.y = .32; });
  } else if (state === 'play') {
    const beat = seconds * 4;
    root.position.set(Math.sin(beat * .6) * .25, Math.max(0, Math.sin(beat)) * .42, Math.cos(beat * .6) * .16);
    root.rotation.y = .35 + Math.sin(beat * .6) * .7;
    bodyRig.rotation.x = Math.sin(beat) * .18;
    head.rotation.z = Math.sin(beat) * .16;
    legs.forEach(({ leg, phase }) => { leg.rotation.x = Math.sin(beat + phase) * .8; });
  }
  if (surprise !== null) {
    // Crouch, turn toward the viewer, leap forward, then bounce back home.
    const jump = Math.sin(Math.PI * Math.min(1, surprise / .74));
    const bounce = surprise > .74 ? Math.sin((surprise - .74) / .26 * Math.PI) * .16 : 0;
    root.position.set(0, surprise < .12 ? -.09 : Math.max(0, jump) * .53 + bounce, Math.max(0, jump) * .56);
    root.rotation.y = .52;
    root.scale.setScalar(scale * (1 + Math.max(0, jump) * .3));
    bodyRig.rotation.set(-Math.max(0, jump) * .14, 0, Math.sin(surprise * 34) * .08);
    bodyRig.position.y = 0; neck.rotation.x = -.15; head.rotation.set(-.12, 0, 0);
    legs.forEach(({ leg, knee, front }) => { leg.rotation.x = (front ? -.9 : .6) * jump; knee.rotation.x = .3 * jump; });
    eyes.forEach(eye => eye.scale.set(1.22, 1.3, 1));
    jaw.rotation.x = .42;
    ears.forEach(({ ear, side }) => { ear.rotation.y = -.38 * side; });
    trunk.forEach(segment => { segment.rotation.x = -.35; });
  }
}

let sharedRenderer, contactShadow;
function shadowTexture() {
  if (!contactShadow) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const draw = canvas.getContext('2d');
    const gradient = draw.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(49, 48, 39, .28)');
    gradient.addColorStop(.35, 'rgba(49, 48, 39, .18)');
    gradient.addColorStop(.72, 'rgba(49, 48, 39, .04)');
    gradient.addColorStop(1, 'rgba(49, 48, 39, 0)');
    draw.fillStyle = gradient; draw.fillRect(0, 0, 128, 128);
    contactShadow = new THREE.CanvasTexture(canvas); contactShadow.colorSpace = THREE.SRGBColorSpace;
  }
  return contactShadow;
}
export function createHabitat(canvas, kind) {
  if (!sharedRenderer) {
    const surface = document.createElement('canvas');
    const context = surface.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!context) return null;
    sharedRenderer = new THREE.WebGLRenderer({ canvas: surface, context, alpha: true, antialias: true });
    sharedRenderer.setClearColor(0x000000, 0);
    sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
    sharedRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    const environment = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(sharedRenderer);
    sharedRenderer.userData = { environment: generator.fromScene(environment, .04).texture };
    generator.dispose(); environment.dispose();
  }
  const draw = canvas.getContext('2d');
  if (!draw) return null;
  const scene = new THREE.Scene();
  scene.environment = sharedRenderer.userData.environment;
  scene.add(new THREE.HemisphereLight(0xfff8ed, 0xb7c5be, .65));
  const light = new THREE.DirectionalLight(0xfff4e4, 1.7);
  light.position.set(-3, 5, 4);
  scene.add(light);
  const fill = new THREE.DirectionalLight(0xecf2ff, .5);
  fill.position.set(3, 2, -2); scene.add(fill);
  const camera = new THREE.OrthographicCamera(-2.2, 2.2, 2.1, -2.1, .1, 30);
  camera.position.set(3.4, 3, 6); camera.lookAt(0, 1, 0);
  const rig = createAnimal(kind); scene.add(rig.root);
  // A feathered contact shadow keeps the tiny transparent scene grounded without jagged silhouettes.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.025; scene.add(ground);
  const food = new THREE.Group(); food.position.set(0, .08, 1.03); scene.add(food);
  part(food, '#d9b280', [0, 0, 0], [.29, .07, .24]);
  for (let i = 0; i < 3; i++) part(food, ['lion', 'tiger'].includes(kind) ? '#c27d60' : '#88a264', [Math.sin(i * 2) * .14, .08, Math.cos(i * 2) * .12], [.12, .07, .08]);
  const ball = new THREE.Group(); scene.add(ball);
  part(ball, '#d9925b', [0, 0, 0], [.19, .19, .19]);
  part(ball, '#f2dfad', [0, .04, .02], [.193, .08, .193]);
  function render(state, elapsed, phase, surprise) {
    poseAnimal(rig, state, elapsed / 1000, phase, surprise);
    ground.position.x = rig.root.position.x; ground.position.z = rig.root.position.z;
    ground.rotation.z = -rig.root.rotation.y;
    ground.material.opacity = 1 - Math.min(.65, Math.max(0, rig.root.position.y));
    food.visible = state === 'eat' && surprise === null;
    ball.visible = state === 'play' && surprise === null;
    const time = elapsed / 1000;
    ball.position.set(.65 + Math.sin(time * 2.4) * .25, .19 + Math.abs(Math.sin(time * 4)) * .14, .55);
    ball.rotation.set(time * 3, 0, time * 2);
    const width = Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 1.5));
    const height = Math.round(canvas.clientHeight * Math.min(devicePixelRatio, 1.5));
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const surface = sharedRenderer.domElement;
    if (surface.width !== width || surface.height !== height) sharedRenderer.setSize(width, height, false);
    const aspect = width / height;
    // Follow the vertical leap just enough to keep ears and giraffe horns inside the frame.
    const leap = surprise === null ? 0 : Math.max(0, Math.sin(Math.PI * Math.min(1, surprise / .74)));
    const centerY = 1 + (kind === 'giraffe' ? .15 : 0) + leap * (kind === 'giraffe' ? .70 : .55);
    camera.position.y = centerY + 2; camera.lookAt(0, centerY, 0);
    const frame = 1.82 + (kind === 'giraffe' ? leap * .25 : 0);
    camera.left = -frame * aspect; camera.right = frame * aspect;
    camera.top = frame; camera.bottom = -frame;
    camera.updateProjectionMatrix();
    sharedRenderer.render(scene, camera);
    draw.clearRect(0, 0, width, height);
    draw.drawImage(sharedRenderer.domElement, 0, 0);
  }
  return { render };
}
