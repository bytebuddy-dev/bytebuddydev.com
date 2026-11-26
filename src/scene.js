// bytebuddydev.com: the 3D Bugsy.
// One fixed, transparent canvas above the page (pointer-events: none). Bugsy is built from
// primitives (ported from the Byte Buddy video engine), so there are no model files to download.
//
// What he does:
// - drops in from the top on first load and lands with a squash,
// - his head and eyes follow the cursor,
// - poke him (click/tap) and he reacts with a mood, a speech bubble and a tiny page glitch,
// - scroll past the hero and he flies to the bottom-right corner and stays there as a companion,
// - type "hesoyam" for golden Bugsy, or the Konami code for party mode.
// Pauses when the tab is hidden, caps the pixel ratio, and honours prefers-reduced-motion.

import {
  ACESFilmicToneMapping,
  CapsuleGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  HemisphereLight,
  DirectionalLight,
  AmbientLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  CatmullRomCurve3,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => innerWidth < 760;
const INK = '#141414';
const YELLOW = '#ffd400';

// ---------- renderer ----------
const canvas = document.getElementById('bugsy-canvas');
let renderer;
try {
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch {
  renderer = null;
}
if (renderer) start();

function start() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall() ? 1.5 : 1.75));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pm = new PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;
  pm.dispose();

  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 20);

  scene.add(new AmbientLight(0xffffff, 0.3));
  scene.add(new HemisphereLight(0xc8d4ff, 0x2a1f3d, 0.75));
  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(-6, 8, 12);
  scene.add(key);
  const rimY = new DirectionalLight(YELLOW, 2.2);
  rimY.position.set(8, 5, -8);
  scene.add(rimY);
  const rimB = new DirectionalLight(0x7cc4ff, 1.6);
  rimB.position.set(-8, 5, -8);
  scene.add(rimB);

  // ---------- Bugsy ----------
  const segs = isSmall() ? [32, 24] : [48, 32];
  const vinyl = (color, rough = 0.38) => new MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.18, sheen: 0.3 });
  const ball = (r, color, opts = {}) => {
    const m = new Mesh(new SphereGeometry(r, segs[0], segs[1]), opts.material ?? new MeshPhysicalMaterial({ color, roughness: opts.rough ?? 0.35, clearcoat: 1, clearcoatRoughness: 0.15, emissive: opts.emissive ? color : 0x000000, emissiveIntensity: opts.emissive ?? 0 }));
    if (opts.p) m.position.set(...opts.p);
    if (opts.s) m.scale.set(...opts.s);
    return m;
  };
  const tube = (pts, r, color = INK) =>
    new Mesh(new TubeGeometry(new CatmullRomCurve3(pts.map((p) => new Vector3(...p))), 24, r, 10, false), new MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.6 }));

  const stripes = (() => {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 8, 512);
    g.fillStyle = '#000';
    for (const [a, b] of [[0.4, 0.5], [0.58, 0.68], [0.76, 0.86]]) g.fillRect(0, a * 512, 8, (b - a) * 512);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  })();

  const bodyMat = vinyl(YELLOW);
  bodyMat.map = stripes;
  const headMat = vinyl(YELLOW);

  const root = new Group(); // placed on screen (hero / corner)
  const bug = new Group(); // body motion (bob, jump, squash)
  root.add(bug);
  scene.add(root);

  // soft blob shadow
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  })();
  const shadow = new Mesh(new PlaneGeometry(3.2, 1.1), new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.position.set(0, -1.9, 0);
  root.add(shadow);

  const body = new Mesh(new SphereGeometry(1, 64, 48), bodyMat);
  body.scale.set(1, 1.12, 0.92);
  bug.add(body);

  const wings = [-1, 1].map((s) => {
    const w = ball(1, '#e8f4ff', { material: new MeshPhysicalMaterial({ color: '#e8f4ff', roughness: 0.05, transparent: true, opacity: 0.45, clearcoat: 1 }) });
    w.position.set(s * 0.75, 0.55, -0.7);
    w.scale.set(0.7, 0.32, 0.04);
    bug.add(w);
    return w;
  });

  bug.add(ball(0.14, INK, { p: [0, 1.12, 0.1] }));
  bug.add(tube([[-0.6, 1.0, 0.3], [-0.58, 1.12, -0.25], [0, 1.2, -0.55], [0.58, 1.12, -0.25], [0.6, 1.0, 0.3]], 0.055, '#1f1f24'));
  for (const s of [-1, 1]) {
    const cup = new Group();
    cup.position.set(s * 0.64, 0.98, 0.36);
    cup.rotation.set(0.9, s * 0.2, s * -1.0);
    cup.add(new Mesh(new CylinderGeometry(0.21, 0.21, 0.14, 32), new MeshPhysicalMaterial({ color: '#1f1f24', roughness: 0.35, clearcoat: 1 })));
    const ring = new Mesh(new TorusGeometry(0.15, 0.018, 10, 32), new MeshBasicMaterial({ color: '#22d3ee', toneMapped: false }));
    ring.position.y = 0.072;
    ring.rotation.x = Math.PI / 2;
    cup.add(ring);
    bug.add(cup);
  }

  // head
  const head = new Group();
  head.position.set(0, 1.78, 0.1);
  bug.add(head);
  head.add(new Mesh(new SphereGeometry(0.9, 64, 48), headMat));
  const antennaTips = [];
  const antennae = [-1, 1].map((s) => {
    const g = new Group();
    const tip = ball(0.13, YELLOW, { material: headMat });
    g.add(tip);
    head.add(g);
    antennaTips.push(tip);
    return { g, s, tube: null };
  });
  const cap = new Mesh(new SphereGeometry(0.94, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.36), new MeshPhysicalMaterial({ color: '#161616', roughness: 0.5, clearcoat: 0.5, side: DoubleSide }));
  cap.position.set(0, 0.06, 0);
  cap.rotation.set(-0.12, 0, -0.12);
  head.add(cap);
  const brim = new Mesh(new CylinderGeometry(1, 1, 1, 40), new MeshPhysicalMaterial({ color: '#161616', roughness: 0.5, clearcoat: 0.5 }));
  brim.position.set(0.62, 0.5, 0.42);
  brim.rotation.set(0.1, -0.75, -0.32);
  brim.scale.set(0.62, 0.05, 0.36);
  head.add(brim);

  const eyes = [-0.3, 0.3].map((x) => {
    const g = new Group();
    g.position.set(x, 0.12, 0.74);
    const white = ball(0.2, '#ffffff', { s: [1, 1.2, 0.55], rough: 0.15 });
    const pupil = ball(0.11, '#0b0b10', { s: [1, 1, 0.4], rough: 0.1 });
    const glint = ball(0.026, '#ffffff', { emissive: 0.6 });
    g.add(white, pupil, glint);
    head.add(g);
    return { g, pupil, glint };
  });

  // mouth: a smile arc, or an open oval
  const smile = new Mesh(new TorusGeometry(0.2, 0.024, 10, 28, Math.PI * 0.5), new MeshStandardMaterial({ color: INK }));
  smile.position.set(0, -0.38 + 0.126, 0.8);
  smile.rotation.z = Math.PI * 1.5 - Math.PI * 0.25;
  head.add(smile);
  const mouthOpen = new Group();
  mouthOpen.position.set(0, -0.38, 0.8);
  mouthOpen.add(ball(0.18, '#3a0d12', { s: [1, 1, 0.35], rough: 0.6 }));
  const tongue = ball(0.1, '#ff6b8b', { s: [1, 0.45, 0.3], rough: 0.5, p: [0, -0.07, 0.04] });
  mouthOpen.add(tongue);
  head.add(mouthOpen);
  const cheeks = [-0.55, 0.55].map((x) => {
    const c = ball(0.12, '#ff6b8b', { s: [1, 0.55, 0.3], rough: 0.8, p: [x, -0.22, 0.62] });
    head.add(c);
    return c;
  });

  // arms: two capsules per arm (shoulder → elbow → hand), re-aimed every frame
  const armMat = new MeshPhysicalMaterial({ color: INK, roughness: 0.45, clearcoat: 0.6 });
  const makeArm = (side) => {
    const upper = new Mesh(new CapsuleGeometry(0.075, 1, 6, 12), armMat);
    const lower = new Mesh(new CapsuleGeometry(0.075, 1, 6, 12), armMat);
    const hand = ball(0.15, '#f4f4f4');
    bug.add(upper, lower, hand);
    return { side, upper, lower, hand, cur: new Vector3() };
  };
  const arms = [makeArm(1), makeArm(-1)];
  const up = new Vector3(0, 1, 0);
  const q = new Quaternion();
  const aim = (mesh, a, b) => {
    const d = new Vector3().subVectors(b, a);
    const len = d.length();
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.scale.set(1, Math.max(0.01, len), 1);
    q.setFromUnitVectors(up, d.normalize());
    mesh.quaternion.copy(q);
  };
  // capsule length param = 1, so scale.y = length works for the cylinder part; good enough at this size.

  bug.add(tube([[0.9, -0.4, 0], [1.2, -0.5, 0.1], [1.25, -0.75, 0.15]], 0.05));
  bug.add(tube([[-0.9, -0.4, 0], [-1.2, -0.5, 0.1], [-1.25, -0.75, 0.15]], 0.05));
  for (const s of [-1, 1]) {
    bug.add(tube([[s * 0.35, -1.0, 0], [s * 0.4, -1.35, 0.05], [s * 0.38, -1.65, 0.1]], 0.08));
    bug.add(ball(0.2, INK, { p: [s * 0.4, -1.72, 0.25], s: [1, 0.5, 1.4] }));
  }

  // hit area for pointer tests (invisible sphere around him)
  const hit = new Mesh(new SphereGeometry(1.9, 12, 8), new MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.6;
  bug.add(hit);

  // ---------- moods ----------
  // hand targets [x, y, z] for right / left, head tilt, which face
  const POSES = {
    idle: { r: [1.3, -0.38, 0.55], l: [-1.2, -0.48, 0.45], face: 'smile' },
    wave: { r: [1.5, 1.0, 0.5], l: [-1.2, -0.48, 0.45], face: 'smile', cheeks: true },
    shocked: { r: [1.12, 1.5, 0.75], l: [-1.12, 1.5, 0.75], face: 'open', big: true },
    laughing: { r: [0.55, -0.35, 1.0], l: [-0.55, -0.35, 1.0], face: 'open', cheeks: true },
    angry: { r: [1.0, -0.32, 0.2], l: [-1.0, -0.32, 0.2], face: 'flat' },
    thinking: { r: [0.42, 1.0, 1.08], l: [-0.45, -0.1, 1.0], face: 'smile' },
    flying: { r: [1.4, 0.3, 0.2], l: [-1.4, 0.3, 0.2], face: 'smile', cheeks: true },
  };
  let mood = 'idle';
  let moodUntil = 0;
  const setMood = (m, seconds = 2.2) => {
    mood = m;
    moodUntil = now + seconds;
  };

  // ---------- placement ----------
  const pointer = new Vector2(0, 0); // -1..1
  let pointerSeen = false;
  const view = { halfH: 20 * Math.tan((15 * Math.PI) / 180), halfW: 0 };
  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.halfW = view.halfH * camera.aspect;
  };
  resize();
  addEventListener('resize', resize);

  // Hero spot comes from the empty #bugsy-spot box in the hero, so CSS decides the layout.
  const spotEl = document.getElementById('bugsy-spot');
  const heroEl = document.querySelector('.hero');
  const target = () => {
    const small = isSmall();
    const corner = { x: 1 - (small ? 0.17 : 0.11), y: -1 + (small ? 0.15 : 0.2), s: small ? 0.22 : 0.36 };
    if (!spotEl || !heroEl) return { corner, p: 1 };
    const r = spotEl.getBoundingClientRect();
    const heroBottom = heroEl.getBoundingClientRect().bottom;
    // progress: 0 while the hero is in view, 1 once it's mostly scrolled away
    const p = Math.min(1, Math.max(0, 1 - (heroBottom - innerHeight * 0.35) / (innerHeight * 0.45)));
    const cx = ((r.left + r.width / 2) / innerWidth) * 2 - 1;
    const cy = -(((r.top + r.height / 2) / innerHeight) * 2 - 1);
    // Bugsy spans y -1.9 (feet) … +3.3 (antennae): 5.2 units, centred 0.68 above his origin.
    const s = ((r.height / innerHeight) * 2 * view.halfH * 0.9) / 5.2;
    return { hero: { x: cx, y: cy - (0.68 * s) / view.halfH, s }, corner, p };
  };

  // ---------- interaction ----------
  const ray = new Raycaster();
  const hitTest = (clientX, clientY) => {
    const v = new Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(v, camera);
    return ray.intersectObject(hit).length > 0;
  };
  addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    pointerSeen = true;
    if (e.pointerType === 'mouse') document.documentElement.classList.toggle('over-bugsy', hitTest(e.clientX, e.clientY));
  }, { passive: true });

  const bubble = document.getElementById('bugsy-bubble');
  const LINES = [
    ['shocked', "Hey! I'm not a bug, I'm a feature."],
    ['laughing', 'Works on my machine!'],
    ['angry', "Don't touch prod!"],
    ['thinking', 'git blame says… you.'],
    ['laughing', 'Fixed it. (I did not fix it.)'],
    ['shocked', 'Was that a Friday deploy?!'],
    ['thinking', "It's not a bug if nobody reports it."],
    ['wave', 'Scroll down, the good stuff is there 👇'],
  ];
  let lineIx = 0;
  let bubbleUntil = 0;
  const say = (text, seconds = 2.6) => {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add('show');
    bubbleUntil = now + seconds;
  };
  let glitchTimer = 0;
  const poke = () => {
    const [m, text] = LINES[lineIx++ % LINES.length];
    setMood(m);
    jumpV = reduceMotion ? 0 : 5.5;
    say(text);
    if (!reduceMotion) {
      document.documentElement.classList.add('glitch');
      clearTimeout(glitchTimer);
      glitchTimer = setTimeout(() => document.documentElement.classList.remove('glitch'), 420);
    }
  };
  addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !hitTest(e.clientX, e.clientY)) return;
    // only if nothing interactive is under the pointer
    if (e.target.closest('a, button, input, textarea, select, summary, #chat')) return;
    e.preventDefault();
    poke();
  });

  // The chat (site.js) asks Bugsy to react: window.dispatchEvent(new CustomEvent('bugsy:mood', { detail: 'wave' }))
  addEventListener('bugsy:mood', (e) => setMood(e.detail || 'wave', 2.4));

  // keyboard easter eggs (ignored while typing in a field)
  const buf = [];
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let golden = false;
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    buf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase());
    if (buf.length > 10) buf.shift();
    const tail = (arr) => buf.slice(-arr.length).join(',') === arr.join(',');
    if (tail('hesoyam'.split(''))) {
      golden = !golden;
      bodyMat.color.set(golden ? '#ffb800' : YELLOW);
      headMat.color.set(golden ? '#ffb800' : YELLOW);
      headMat.emissive = new Color(golden ? '#6b4a00' : '#000000');
      bodyMat.emissive = headMat.emissive;
      setMood('wave');
      say(golden ? 'Cheat activated: golden Bugsy ✨' : 'Cheat off. Back to normal.');
    }
    if (tail(KONAMI)) {
      document.documentElement.classList.toggle('party');
      setMood('laughing', 3);
      say(document.documentElement.classList.contains('party') ? 'Party mode! ↑↑↓↓←→←→BA' : 'Party over. Back to work.');
    }
  });

  // ---------- animation ----------
  let now = 0;
  let last = performance.now();
  let dropY = reduceMotion ? 0 : 9; // intro: falls from above
  let dropV = 0;
  let landed = reduceMotion;
  let squash = 0;
  let jumpY = 0;
  let jumpV = 0;
  const pos = new Vector3();
  let scl = 1;
  let first = true;
  const cur = { r: new Vector3(...POSES.idle.r), l: new Vector3(...POSES.idle.l) };
  const look = new Vector2();
  let flyLean = 0;
  let prevP = 0;
  let introWaved = false;
  let slowFrames = 0;
  let lowRes = false;
  let wasDocked = null;

  const frame = (t) => {
    const raw = (t - last) / 1000;
    const dt = Math.min(0.1, raw);
    last = t;
    now += dt;
    // Slow device? Drop the resolution once (keeps the motion smooth instead of sharp).
    slowFrames = raw > 0.045 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames > 20 && !lowRes) {
      lowRes = true;
      renderer.setPixelRatio(1);
      resize();
    }

    // placement
    const tg = target();
    const p = tg.p ?? 1;
    const e = p * p * (3 - 2 * p);
    // Docked in the corner: the chat launcher (a real button over him) takes the clicks.
    const docked = p > 0.9;
    if (docked !== wasDocked) {
      wasDocked = docked;
      document.documentElement.classList.toggle('bugsy-docked', docked);
    }
    const hx = tg.hero ? tg.hero.x : tg.corner.x;
    const hy = tg.hero ? tg.hero.y : tg.corner.y;
    const hs = tg.hero ? tg.hero.s : tg.corner.s;
    // flight arc: bulges upward mid-way
    const arc = Math.sin(e * Math.PI) * 0.25;
    const nx = hx + (tg.corner.x - hx) * e;
    const ny = hy + (tg.corner.y - hy) * e + arc;
    const ns = hs + (tg.corner.s - hs) * e;
    const wantX = nx * view.halfW;
    const wantY = ny * view.halfH;
    if (first) {
      pos.set(wantX, wantY, 0);
      scl = ns;
      first = false;
    }
    const k = 1 - Math.pow(0.0015, dt); // smooth follow
    const vx = (wantX - pos.x) / Math.max(dt, 1e-3);
    pos.x += (wantX - pos.x) * k;
    pos.y += (wantY - pos.y) * k;
    scl += (ns - scl) * k;
    const moving = Math.abs(p - prevP) > 0.002 || (p > 0.02 && p < 0.98);
    prevP = p;
    const flying = !reduceMotion && (moving || p >= 0.98); // in the corner he hovers on his wings
    flyLean += ((moving ? Math.max(-0.35, Math.min(0.35, -vx * 0.01)) : 0) - flyLean) * k;

    // intro drop with a bounce
    if (!landed) {
      dropV -= 30 * dt;
      dropY += dropV * dt;
      if (dropY <= 0) {
        dropY = 0;
        if (dropV < -6) {
          squash = Math.min(0.35, -dropV * 0.018);
          dropV = -dropV * 0.28;
        } else {
          landed = true;
          dropV = 0;
        }
      }
    }
    squash += (0 - squash) * (1 - Math.pow(0.0005, dt));
    if (landed && !introWaved && now > 0.2) {
      introWaved = true;
      setMood('wave', 2.4);
      if (!sessionStorageGet('bb-greeted')) {
        say(spotEl ? "Hi! I'm Bugsy. Poke me 👆" : 'Need a hand? Click me to chat 💬', 3.2);
        sessionStorageSet('bb-greeted', '1');
      }
    }
    // poke jump
    if (jumpV !== 0 || jumpY > 0) {
      jumpV -= 24 * dt;
      jumpY += jumpV * dt;
      if (jumpY <= 0) {
        jumpY = 0;
        jumpV = 0;
        squash = 0.18;
      }
    }

    if (mood !== 'idle' && now > moodUntil) mood = 'idle';
    const activeMood = mood !== 'idle' ? mood : flying ? 'flying' : 'idle';
    const pose = POSES[activeMood];

    const bob = reduceMotion ? 0 : Math.sin(now * 2) * 0.05 + (flying ? Math.sin(now * 4) * 0.12 : 0);
    root.position.set(pos.x, pos.y + dropY * (scl || 1), 0);
    root.scale.setScalar(scl);
    root.rotation.set(0, -0.18 + flyLean * 0.5, flyLean);
    bug.position.y = bob + jumpY;
    bug.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    shadow.visible = !flying;
    shadow.scale.setScalar(1 - Math.min(0.6, (jumpY + dropY) * 0.15));

    // wings: fast flap while flying, lazy otherwise
    const flapSpeed = flying ? 38 : 6;
    const flapAmp = flying ? 0.5 : 0.12;
    wings.forEach((w, i) => {
      const s = i === 0 ? -1 : 1;
      w.rotation.set(0.3, s * (0.6 + Math.sin(now * flapSpeed) * flapAmp), s * 0.6);
    });

    // head + eyes follow the pointer (idle look-around until the pointer moves)
    const lx = pointerSeen ? pointer.x - (root.position.x / view.halfW) : Math.sin(now * 0.7) * 0.5;
    const ly = pointerSeen ? pointer.y - (root.position.y / view.halfH) : Math.sin(now * 0.5) * 0.2;
    look.x += (Math.max(-1, Math.min(1, lx)) - look.x) * k;
    look.y += (Math.max(-1, Math.min(1, ly)) - look.y) * k;
    head.rotation.set(-look.y * 0.35 + (activeMood === 'angry' ? 0.12 : 0), look.x * 0.6, activeMood === 'thinking' ? -0.12 : 0.04);
    const blink = (Math.floor(now * 30) % 96) < 4;
    eyes.forEach(({ g, pupil, glint }) => {
      const big = pose.big ? 1.18 : 1;
      g.scale.set(big, blink ? 0.08 : big, big);
      pupil.scale.set(pose.big ? 0.5 : 1, pose.big ? 0.5 : 1, 0.4);
      pupil.position.set(look.x * 0.07, look.y * 0.06, 0.1);
      glint.position.set(look.x * 0.07 + 0.036, look.y * 0.06 + 0.044, 0.124);
    });
    smile.visible = pose.face === 'smile';
    mouthOpen.visible = pose.face === 'open' || pose.face === 'flat';
    mouthOpen.scale.set(1, pose.face === 'flat' ? 0.25 : activeMood === 'laughing' ? 0.9 + Math.abs(Math.sin(now * 18)) * 0.3 : 1.1, 1);
    cheeks.forEach((c) => (c.visible = !!pose.cheeks));

    // antennae wiggle (rebuild the two little tubes: cheap)
    const wig = Math.sin(now * 7) * 0.12 + (activeMood === 'shocked' ? Math.sin(now * 30) * 0.1 : 0);
    antennae.forEach((a, i) => {
      const tip = [a.s * (0.55 + wig), 1.35 - Math.abs(wig) * 0.5, 0.1];
      antennaTips[i].position.set(...tip);
      if (a.tube) {
        a.g.remove(a.tube);
        a.tube.geometry.dispose();
      }
      a.tube = new Mesh(new TubeGeometry(new CatmullRomCurve3([new Vector3(a.s * 0.22, 0.75, 0), new Vector3(a.s * 0.3, 1.1, 0.05), new Vector3(...tip)]), 12, 0.045, 8, false), armMat);
      a.g.add(a.tube);
    });

    // arms
    const wave = activeMood === 'wave' ? Math.sin(now * 9) * 0.14 : 0;
    const laugh = activeMood === 'laughing' ? Math.sin(now * 18) * 0.05 : 0;
    const kk = 1 - Math.pow(0.002, dt);
    cur.r.lerp(new Vector3(pose.r[0] + wave * 0.6, pose.r[1] + wave + laugh, pose.r[2]), kk);
    cur.l.lerp(new Vector3(pose.l[0], pose.l[1] + laugh + (flying && activeMood === 'flying' ? Math.sin(now * 8) * 0.1 : 0), pose.l[2]), kk);
    arms.forEach((arm) => {
      const sh = new Vector3(arm.side * 0.85, 0.35, 0.2);
      const hand = arm.side === 1 ? cur.r : cur.l;
      const elbow = new Vector3().addVectors(sh, hand).multiplyScalar(0.5).add(new Vector3(arm.side * 0.3, -0.08, -0.05));
      aim(arm.upper, sh, elbow);
      aim(arm.lower, elbow, hand);
      arm.hand.position.copy(hand);
    });

    // speech bubble follows his head
    if (bubble) {
      if (now > bubbleUntil) bubble.classList.remove('show');
      const hp = new Vector3(0, 3.1, 0);
      bug.localToWorld(hp);
      hp.project(camera);
      const bx = (hp.x * 0.5 + 0.5) * innerWidth;
      const by = (-hp.y * 0.5 + 0.5) * innerHeight;
      bubble.style.transform = `translate(${Math.round(Math.min(innerWidth - 150, Math.max(150, bx)))}px, ${Math.round(Math.max(110, by))}px) translate(-50%, -100%)`;
    }

    renderer.render(scene, camera);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  };
  let raf = requestAnimationFrame((t) => {
    last = t;
    document.documentElement.classList.add('bugsy-ready');
    frame(t);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
  });
}

function sessionStorageGet(k) {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
function sessionStorageSet(k, v) {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
}
