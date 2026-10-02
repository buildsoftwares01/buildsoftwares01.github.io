import * as THREE from 'three';

// Original toy-like models built from real 3D meshes and articulated pivots.
// Geometry/materials are shared across the cast; there are no model downloads.
const sphere = new THREE.SphereGeometry(1, 20, 14);
const materials = new Map();
function material(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .73 }));
  return materials.get(color);
}
function part(parent, color, position, scale) {
  const mesh = new THREE.Mesh(sphere, material(color));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}
function joint(parent, position) {
  const group = new THREE.Group();
  group.position.set(...position);
  parent.add(group);
  return group;
}
const palettes = {
  lion: ['#dfa65c', '#b56e3c'], tiger: ['#e59a4d', '#563e2e'],
  giraffe: ['#e3b56a', '#986341'], elephant: ['#9cafa6', '#d3b3ac'],
  zebra: ['#f1ebdd', '#4a4740'], monkey: ['#a27b56', '#dfbc91'],
  hippo: ['#a69aa9', '#cab8bd'], rhino: ['#b0b2a3', '#e9dbbe'],
};

export function createAnimal(kind) {
  const [skin, accent] = palettes[kind];
  const root = new THREE.Group();
  const bodyRig = joint(root, [0, 0, 0]);
  const body = part(bodyRig, skin, [0, .77, -.12], [.46, .4, .69]);
  part(bodyRig, kind === 'elephant' ? '#c0cbbf' : '#f1d7ac', [0, .66, .16], [.34, .26, .47]);
  const legs = [];
  for (const x of [-.3, .3]) for (const z of [-.48, .4]) {
    const leg = joint(bodyRig, [x, .61, z]);
    part(leg, skin, [0, -.19, 0], [.13, .26, .14]);
    const knee = joint(leg, [0, -.33, 0]);
    part(knee, skin, [0, -.1, .03], [.12, .17, .12]);
    part(knee, ['giraffe', 'zebra', 'rhino'].includes(kind) ? accent : skin, [0, -.2, .06], [.15, .1, .2]);
    legs.push({ leg, knee, phase: (x * z > 0 ? 0 : Math.PI), front: z > 0 });
  }
  const neck = joint(bodyRig, [0, 1.02, .38]);
  if (kind === 'giraffe') {
    part(neck, skin, [0, .39, 0], [.2, .57, .22]);
    for (let i = 0; i < 5; i++) part(neck, accent, [Math.sin(i * 2) * .14, i * .17, .19], [.075, .09, .035]);
  }
  const head = joint(neck, [0, kind === 'giraffe' ? .91 : .08, .07]);
  const headSize = kind === 'giraffe' ? .37 : .44;
  if (kind === 'lion') {
    part(head, accent, [0, .24, -.07], [.62, .6, .26]);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      part(head, i % 2 ? accent : '#c08043', [Math.cos(a) * .5, .25 + Math.sin(a) * .5, -.05], [.17, .17, .22]);
    }
  }
  part(head, skin, [0, .25, .08], [headSize, headSize, .37]);
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = joint(head, [side * (kind === 'elephant' ? .46 : .33), .49, -.03]);
    const size = kind === 'elephant' ? [.33, .43, .1] : kind === 'zebra' || kind === 'giraffe' ? [.12, .25, .1] : [.16, .16, .1];
    part(ear, skin, [0, 0, 0], size);
    part(ear, kind === 'lion' ? '#e8c18c' : accent, [0, 0, .078], size.map((v, i) => v * (i === 2 ? .4 : .65)));
    ears.push({ ear, side });
  }
  if (kind === 'giraffe') for (const x of [-.17, .17]) {
    part(head, accent, [x, .7, 0], [.045, .2, .045]);
    part(head, accent, [x, .87, 0], [.075, .07, .075]);
  }
  const muzzleColor = kind === 'monkey' ? accent : kind === 'elephant' ? skin : '#f1d7ac';
  const muzzle = joint(head, [0, .11, .33]);
  part(muzzle, muzzleColor, [0, 0, .05], kind === 'hippo' ? [.38, .22, .27] : [.28, .18, .18]);
  const jaw = joint(muzzle, [0, -.08, 0]);
  part(jaw, muzzleColor, [0, -.025, .03], [.23, .09, .15]);
  if (!['elephant', 'rhino', 'hippo'].includes(kind)) part(muzzle, '#503b30', [0, .075, .205], [.085, .055, .045]);
  else if (kind !== 'elephant') for (const x of [-.15, .15]) part(muzzle, '#6b5b54', [x, .11, .24], [.035, .026, .022]);
  if (kind === 'rhino') {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(.095, .32, 16), material(accent));
    horn.position.set(0, .24, .43); horn.rotation.x = .35; muzzle.add(horn);
  }
  const eyes = [];
  for (const x of [-.19, .19]) {
    const eye = joint(head, [x, .36, .38]);
    part(eye, '#fff8e9', [0, 0, 0], [.095, .11, .05]);
    part(eye, '#302b25', [0, -.008, .045], [.056, .072, .033]);
    part(eye, '#ffffff', [.02, .024, .072], [.017, .019, .014]);
    eyes.push(eye);
    part(head, '#d39177', [x * 1.45, .19, .33], [.062, .035, .02]);
  }
  const trunk = [];
  if (kind === 'elephant') {
    let parent = joint(head, [0, .13, .43]);
    for (let i = 0; i < 5; i++) {
      part(parent, skin, [0, -.075, .01], [.1 - i * .008, .13, .09 - i * .006]);
      trunk.push(parent);
      parent = joint(parent, [0, -.15, .02]);
    }
  }
  const tail = joint(bodyRig, [0, .93, -.72]);
  const tailJoints = [];
  let end = tail;
  for (let i = 0; i < (kind === 'monkey' ? 7 : 4); i++) {
    part(end, skin, [0, .015, -.1], [.047, .052, .14]);
    tailJoints.push(end);
    end = joint(end, [0, .03, -.18]);
  }
  if (['lion', 'giraffe'].includes(kind)) part(end, accent, [0, 0, 0], [.1, .1, .12]);
  if (kind === 'monkey') {
    part(head, accent, [0, .24, .33], [.31, .28, .07]);
    // Put the facial features in front of the pale face patch.
    eyes.forEach(eye => { eye.position.z = .42; });
  }
  if (kind === 'tiger' || kind === 'zebra' || kind === 'giraffe') {
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const mark = part(bodyRig, accent, [side * .432, .81 + (i % 2) * .075, -.58 + i * .23], kind === 'giraffe' ? [.035, .09, .1] : [.027, .25, .05]);
      mark.rotation.x = (i % 2 ? 1 : -1) * .22;
    }
    if (kind !== 'giraffe') for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const stripe = part(head, accent, [side * (.25 + i * .04), .45 - i * .11, .32 - i * .025], [.09, .025, .045]);
      stripe.rotation.z = side * -.35;
    }
  }
  const scale = kind === 'giraffe' ? .83 : 1;
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
    legs.forEach(({ leg, knee, phase }) => { leg.rotation.x = Math.sin(gait + phase) * .63; knee.rotation.x = Math.max(0, -Math.sin(gait + phase)) * .5; });
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

let sharedRenderer;
export function createHabitat(canvas, kind) {
  if (!sharedRenderer) {
    const surface = document.createElement('canvas');
    const context = surface.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!context) return null;
    sharedRenderer = new THREE.WebGLRenderer({ canvas: surface, context, alpha: true, antialias: true });
    sharedRenderer.setClearColor(0x000000, 0);
    sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
    sharedRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  const draw = canvas.getContext('2d');
  if (!draw) return null;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff5df, 0x8b9b79, 2.8));
  const light = new THREE.DirectionalLight(0xffe5c5, 3.2);
  light.position.set(-3, 5, 4); scene.add(light);
  const fill = new THREE.DirectionalLight(0xe5f3ef, 1.2);
  fill.position.set(3, 2, -2); scene.add(fill);
  const camera = new THREE.OrthographicCamera(-2.2, 2.2, 2.1, -2.1, .1, 30);
  camera.position.set(3.4, 3, 6); camera.lookAt(0, 1, 0);
  const rig = createAnimal(kind); scene.add(rig.root);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.24, 48), new THREE.MeshBasicMaterial({ color: '#dbe2ce', transparent: true, opacity: .28, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.025; scene.add(ground);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.65, 32), new THREE.MeshBasicMaterial({ color: '#4e6143', transparent: true, opacity: .12, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1, 1.3, 1); shadow.position.y = -.01; scene.add(shadow);
  const food = new THREE.Group(); food.position.set(0, .08, 1.03); scene.add(food);
  part(food, '#d9b280', [0, 0, 0], [.29, .07, .24]);
  for (let i = 0; i < 3; i++) part(food, ['lion', 'tiger'].includes(kind) ? '#c27d60' : '#88a264', [Math.sin(i * 2) * .14, .08, Math.cos(i * 2) * .12], [.12, .07, .08]);
  const ball = new THREE.Group(); scene.add(ball);
  part(ball, '#d9925b', [0, 0, 0], [.19, .19, .19]);
  part(ball, '#f2dfad', [0, .04, .02], [.193, .08, .193]);
  function render(state, elapsed, phase, surprise) {
    poseAnimal(rig, state, elapsed / 1000, phase, surprise);
    food.visible = state === 'eat' && surprise === null;
    ball.visible = state === 'play' && surprise === null;
    const time = elapsed / 1000;
    ball.position.set(.65 + Math.sin(time * 2.4) * .25, .19 + Math.abs(Math.sin(time * 4)) * .14, .55);
    ball.rotation.set(time * 3, 0, time * 2);
    shadow.position.x = rig.root.position.x; shadow.position.z = rig.root.position.z;
    shadow.material.opacity = .12 / (1 + rig.root.position.y * 2);
    const width = Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 1.5));
    const height = Math.round(canvas.clientHeight * Math.min(devicePixelRatio, 1.5));
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const surface = sharedRenderer.domElement;
    if (surface.width !== width || surface.height !== height) sharedRenderer.setSize(width, height, false);
    const aspect = width / height;
    camera.left = -2.05 * aspect; camera.right = 2.05 * aspect;
    camera.updateProjectionMatrix();
    sharedRenderer.render(scene, camera);
    draw.clearRect(0, 0, width, height);
    draw.drawImage(sharedRenderer.domElement, 0, 0);
  }
  return { render };
}
