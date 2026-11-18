import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  ZONES, NAME_ROW, RAMP, ISLAND_RADIUS, coastRadius, nearRoad, inZone, rng,
} from './layout.js';
import { PALETTE, RESUME, STRINGS, CAREER } from './content.js';
import {
  drawGround, canvasTexture, textDecalCanvas, crateCanvas, billboardCanvas, monolithCanvas, signCanvas, makeCanvas,
} from './textures.js';

const LETTERS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
};

export function createWorld({ scene, world, images, lang: initialLang }) {
  let lang = initialLang;
  const dynamics = []; // { body, mesh, kind, home, toppled }
  const interactions = []; // { id, x, z, r, y, label: () => string, zone, panel }
  const langHooks = []; // functions re-run on language change
  const animators = []; // per-frame callbacks (t, dt)
  const r = rng(42);

  const addStatic = (shape, x, y, z, yaw = 0, rx = 0) => {
    const b = new CANNON.Body({ mass: 0, shape });
    b.position.set(x, y, z);
    b.quaternion.setFromEuler(rx, yaw, 0, 'YXZ');
    b.updateAABB(); // static bodies never refresh their AABB on their own
    world.addBody(b);
    return b;
  };
  const shadowed = (m, cast = true, receive = true) => {
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  };
  const S = (k) => STRINGS[lang][k];
  const R = () => RESUME[lang];

  // ---------------- island ----------------
  const shape = new THREE.Shape();
  const N = 220;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rad = coastRadius(a);
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  const islandGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 4, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 1.2, bevelSegments: 3, curveSegments: 1,
  });
  islandGeo.rotateX(-Math.PI / 2);
  islandGeo.translate(0, -4.6, 0); // top face (incl. bevel) sits at y=0
  const groundCanvas = document.createElement('canvas');
  groundCanvas.width = groundCanvas.height = 2048;
  drawGround(groundCanvas);
  const groundTex = canvasTexture(groundCanvas);
  groundTex.repeat.set(1 / 200, 1 / 200);
  groundTex.offset.set(0.5, 0.5);
  groundTex.wrapS = groundTex.wrapT = THREE.ClampToEdgeWrapping;
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 });
  const cliffMat = new THREE.MeshStandardMaterial({ color: '#b9d2ea', roughness: 0.6, flatShading: true });
  const island = new THREE.Mesh(islandGeo, [groundMat, cliffMat]);
  island.receiveShadow = true;
  scene.add(island);

  // water + ice floes
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(900, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.25, metalness: 0.1 }),
  );
  water.position.y = -0.9;
  water.receiveShadow = true;
  scene.add(water);
  const foam = new THREE.Mesh(
    new THREE.RingGeometry(ISLAND_RADIUS - 2, ISLAND_RADIUS + 9, 128).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#d7ecff', transparent: true, opacity: 0.35, depthWrite: false }),
  );
  foam.position.y = -0.85;
  scene.add(foam);
  {
    const floeGeo = new THREE.CylinderGeometry(1, 1.1, 0.4, 6);
    const floes = new THREE.InstancedMesh(floeGeo, new THREE.MeshStandardMaterial({ color: '#e9f4ff', roughness: 0.5, flatShading: true }), 70);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const data = [];
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const d = coastRadius(a) + 8 + r() * 45;
      data.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.8 + r() * 2.8, rot: r() * 6, ph: r() * 6 });
    }
    floes.receiveShadow = true;
    scene.add(floes);
    animators.push((t) => {
      data.forEach((f, i) => {
        p.set(f.x, -0.85 + Math.sin(t * 0.8 + f.ph) * 0.06, f.z);
        q.setFromEuler(new THREE.Euler(Math.sin(t + f.ph) * 0.03, f.rot + t * 0.02, 0));
        s.set(f.s, 1, f.s * 0.8);
        floes.setMatrixAt(i, m.compose(p, q, s));
      });
      floes.instanceMatrix.needsUpdate = true;
    });
  }

  // invisible wall around the coast
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const d = coastRadius(a) - 1.5;
    addStatic(new CANNON.Box(new CANNON.Vec3(0.5, 3, 5.4)), Math.cos(a) * d, 2, Math.sin(a) * d, -a);
  }

  // ---------------- trees, rocks, lanterns ----------------
  const treeGeo = (() => {
    const parts = [];
    const color = (g, c) => {
      const col = new THREE.Color(c);
      const arr = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < arr.length; i += 3) arr.set([col.r, col.g, col.b], i);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return g;
    };
    parts.push(color(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 6).translate(0, 0.7, 0), '#6b4a3a'));
    const layers = [[2.2, 2.2, 1.6], [1.75, 2, 2.8], [1.25, 1.8, 3.9], [0.75, 1.5, 4.9]];
    for (const [rad, h, y] of layers) {
      parts.push(color(new THREE.ConeGeometry(rad, h, 7).translate(0, y, 0), PALETTE.pine));
      parts.push(color(new THREE.ConeGeometry(rad * 0.62, h * 0.42, 7).translate(0, y + h * 0.31, 0), '#f4f8ff'));
    }
    return mergeGeometries(parts.map((g) => g.toNonIndexed()));
  })();
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const treeSpots = [];
  for (let tries = 0; treeSpots.length < 170 && tries < 5000; tries++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * (ISLAND_RADIUS - 6);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (d < 20 || nearRoad(x, z, 6) || inZone(x, z, 4) || Math.hypot(x - RAMP.x - 5, z - RAMP.z) < 11) continue;
    if (treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 4.2)) continue;
    treeSpots.push({ x, z, s: 0.75 + r() * 0.7, rot: r() * 6 });
  }
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, treeSpots.length);
  {
    const m = new THREE.Matrix4();
    treeSpots.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, 0, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.rot, 0)), new THREE.Vector3(t.s, t.s, t.s));
      trees.setMatrixAt(i, m);
      addStatic(new CANNON.Cylinder(0.45 * t.s, 0.45 * t.s, 3, 6), t.x, 1.5, t.z);
    });
  }
  shadowed(trees);
  scene.add(trees);

  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockSpots = [];
  for (let tries = 0; rockSpots.length < 45 && tries < 3000; tries++) {
    const a = r() * Math.PI * 2;
    const d = 18 + r() * (ISLAND_RADIUS - 22);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (nearRoad(x, z, 5) || inZone(x, z, 2) || Math.hypot(x - RAMP.x - 5, z - RAMP.z) < 11) continue;
    if (treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 3)) continue;
    rockSpots.push({ x, z, s: 0.5 + r() * 1.1 });
  }
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: '#8e98b8', flatShading: true, roughness: 0.9 }), rockSpots.length);
  rockSpots.forEach((k, i) => {
    rocks.setMatrixAt(i, new THREE.Matrix4().compose(
      new THREE.Vector3(k.x, k.s * 0.25, k.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r() * 6, r())),
      new THREE.Vector3(k.s * 1.3, k.s * 0.8, k.s),
    ));
    addStatic(new CANNON.Sphere(k.s * 0.85), k.x, 0, k.z);
  });
  shadowed(rocks);
  scene.add(rocks);

  // lanterns along the loop road
  {
    const spots = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + 0.06;
      const d = 52 + 5.2;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (inZone(x, z, 1)) continue;
      spots.push([x, z]);
    }
    const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 2.6, 0.14).translate(0, 1.3, 0), new THREE.MeshStandardMaterial({ color: '#2a3150' }), spots.length);
    const bulb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), new THREE.MeshStandardMaterial({ color: '#ffe3a3', emissive: PALETTE.amber, emissiveIntensity: 2.4 }), spots.length);
    spots.forEach(([x, z], i) => {
      post.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, z));
      bulb.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 2.75, z));
      addStatic(new CANNON.Box(new CANNON.Vec3(0.1, 1.3, 0.1)), x, 1.3, z);
    });
    shadowed(post);
    scene.add(post, bulb);
  }

  // zone lights
  for (const k in ZONES) {
    const z = ZONES[k];
    const l = new THREE.PointLight(k === 'start' ? '#ffd29a' : z.color, k === 'start' ? 70 : 90, 26, 1.6);
    l.position.set(z.x, 5, z.z);
    scene.add(l);
  }

  // ---------------- ground text decals ----------------
  function decal(build, x, z, yaw = 0) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    mesh.position.set(x, 0.03, z);
    mesh.rotation.y = yaw;
    mesh.renderOrder = 1;
    scene.add(mesh);
    const refresh = () => {
      const { canvas, widthM, heightM } = build();
      mat.map?.dispose();
      mat.map = canvasTexture(canvas);
      mat.needsUpdate = true;
      mesh.scale.set(widthM, 1, heightM);
    };
    refresh();
    langHooks.push(refresh);
    return mesh;
  }

  // start: name + title
  decal(() => textDecalCanvas([
    { text: R().meta.name, size: 2.4, color: PALETTE.ink },
    { text: R().meta.title, size: 1.25, color: '#3a4a78', weight: 700 },
    { text: S('groundHint'), size: 0.75, color: '#6b7aa6', weight: 500, font: 'body' },
  ], lang, 30), 0, NAME_ROW.z + 9.5);

  // zone titles
  const zoneTitle = (key, x, z) => decal(() => textDecalCanvas([
    { text: S('zones')[key], size: 2, color: ZONES[key].color === '#ffb547' ? '#c27a12' : ZONES[key].color },
  ], lang, 22), x, z);
  zoneTitle('about', ZONES.about.x + 4, ZONES.about.z + 11);
  zoneTitle('experience', ZONES.experience.x, ZONES.experience.z + 14);
  zoneTitle('stack', ZONES.stack.x, ZONES.stack.z - 13.5);
  zoneTitle('projects', ZONES.projects.x + 4, ZONES.projects.z - 13);
  zoneTitle('contact', ZONES.contact.x, ZONES.contact.z + 13.5);

  // ---------------- name letters (dynamic) ----------------
  {
    const word = 'ALI HANI';
    const cube = 0.78, depth = 1.0;
    const colors = ['#ff7a59', '#ffb547', '#2bb3a3', null, '#9b8cff', '#ff7a59', '#ffb547', '#2bb3a3'];
    let totalCols = 0;
    for (const ch of word) totalCols += ch === ' ' ? 2 : LETTERS[ch][0].length + 1;
    totalCols -= 1;
    let col = -totalCols / 2;
    [...word].forEach((ch, li) => {
      if (ch === ' ') {
        col += 2;
        return;
      }
      const g = LETTERS[ch];
      const w = g[0].length;
      const cx = NAME_ROW.x + (col + w / 2) * cube;
      const body = new CANNON.Body({ mass: 22 });
      const geos = [];
      g.forEach((row, ri) => {
        // merge horizontal runs
        let c = 0;
        while (c < w) {
          if (row[c] !== '#') {
            c++;
            continue;
          }
          let e = c;
          while (e + 1 < w && row[e + 1] === '#') e++;
          const len = e - c + 1;
          const ox = (c + len / 2 - w / 2) * cube;
          const oy = (4 - ri + 0.5 - 2.5) * cube;
          body.addShape(new CANNON.Box(new CANNON.Vec3((len * cube) / 2, cube / 2, depth / 2)), new CANNON.Vec3(ox, oy, 0));
          geos.push(new RoundedBoxGeometry(len * cube, cube, depth, 2, 0.08).translate(ox, oy, 0));
          c = e + 1;
        }
      });
      body.position.set(cx, (5 * cube) / 2 + 0.01, NAME_ROW.z);
      body.allowSleep = true;
      body.sleepSpeedLimit = 0.2;
      world.addBody(body);
      body.sleep();
      const mesh = shadowed(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: colors[li], roughness: 0.45 })));
      scene.add(mesh);
      dynamics.push({ body, mesh, kind: 'letter', home: body.position.clone(), toppled: false });
      col += w + 1;
    });
  }

  // ---------------- ramp ----------------
  {
    const len = 9, wid = 5, ang = 0.26;
    const h = Math.sin(ang) * len;
    const geo = new THREE.BoxGeometry(wid, 0.4, len);
    const mat = new THREE.MeshStandardMaterial({ color: '#7d5443', roughness: 0.8 });
    const ramp = shadowed(new THREE.Mesh(geo, mat));
    const cz = RAMP.z, cy = h / 2 - 0.1;
    ramp.position.set(RAMP.x, cy, cz);
    ramp.rotation.x = ang; // front (low) end towards +z, rises to -z
    scene.add(ramp);
    addStatic(new CANNON.Box(new CANNON.Vec3(wid / 2, 0.2, len / 2)), RAMP.x, cy, cz, 0, ang);
    // stripes
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.02, 0.42, 0.35), new THREE.MeshStandardMaterial({ color: i % 2 ? PALETTE.amber : '#f3ead6' }));
      s.position.set(0, 0, -len / 2 + 0.3 + i * 0.01);
      if (i) s.position.z = len / 2 - 0.3 - (i - 1) * 2.1;
      ramp.add(s);
    }
    // tilted kicker next to the ramp: rolls the car if you hit it fast
    {
      const kl = 6, kx = 0.3, kz = 0.3, kh = Math.sin(kx) * kl;
      const k = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, kl), new THREE.MeshStandardMaterial({ color: PALETTE.teal, roughness: 0.6 })));
      k.position.set(RAMP.x + 8, kh / 2 + 0.1, cz);
      k.rotation.set(kx, 0, kz, 'YXZ');
      scene.add(k);
      addStatic(new CANNON.Box(new CANNON.Vec3(1.4, 0.2, kl / 2)), RAMP.x + 8, kh / 2 + 0.1, cz, 0, kx);
      // match the roll on the physics body too
      const kb = world.bodies[world.bodies.length - 1];
      kb.quaternion.setFromEuler(kx, 0, kz, 'YXZ');
      kb.updateAABB();
    }
    // support
    const sup = shadowed(new THREE.Mesh(new THREE.BoxGeometry(wid - 0.4, h, 0.4), new THREE.MeshStandardMaterial({ color: '#5a3a30' })));
    sup.position.set(RAMP.x, h / 2 - 0.2, cz - len / 2 * Math.cos(ang) + 0.3);
    scene.add(sup);
  }

  // ---------------- snowmen (dynamic) ----------------
  const snowMat = new THREE.MeshStandardMaterial({ color: '#f7faff', roughness: 0.9 });
  const coal = new THREE.MeshStandardMaterial({ color: '#1d2233' });
  const carrot = new THREE.MeshStandardMaterial({ color: '#ff8a3d' });
  [[-14, -22], [16, 32], [-22, 44], [58, -8], [-60, -6]].forEach(([x, z], i) => {
    const body = new CANNON.Body({ mass: 18 });
    const g = new THREE.Group();
    const parts = [[0.8, 0.8], [0.58, 1.9], [0.42, 2.72]];
    for (const [rad, y] of parts) {
      body.addShape(new CANNON.Sphere(rad), new CANNON.Vec3(0, y - 1.5, 0));
      const m = shadowed(new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12), snowMat));
      m.position.y = y - 1.5;
      g.add(m);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 8).rotateX(Math.PI / 2), carrot);
    nose.position.set(0, 1.22, 0.55);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 8, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: i % 2 ? PALETTE.teal : PALETTE.coral }));
    scarf.position.y = 0.85;
    g.add(nose, scarf);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), coal);
      e.position.set(s * 0.15, 1.35, 0.36);
      g.add(e);
    }
    body.position.set(x, 1.5, z);
    body.quaternion.setFromEuler(0, Math.atan2(-x, -z), 0);
    world.addBody(body);
    body.sleep();
    scene.add(g);
    dynamics.push({ body, mesh: g, kind: 'snowman', home: body.position.clone(), toppled: false });
  });

  // ---------------- ABOUT: cabin ----------------
  {
    const z = ZONES.about;
    const cab = new THREE.Group();
    cab.position.set(z.x - 5, 0, z.z - 4);
    cab.rotation.y = Math.atan2(-(z.x - 5), -(z.z - 4)) + Math.PI; // face roughly to the island centre
    cab.rotation.y = 0.6;
    scene.add(cab);
    const wood = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 });
    const darkWood = new THREE.MeshStandardMaterial({ color: '#5a3a30', roughness: 0.9 });
    const walls = shadowed(new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 5.5), wood));
    walls.position.y = 1.7;
    cab.add(walls);
    for (let i = 0; i < 6; i++) {
      const log = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.08, 5.6), darkWood);
      log.position.y = 0.4 + i * 0.55;
      cab.add(log);
    }
    for (const s of [-1, 1]) {
      const roof = shadowed(new THREE.Mesh(new THREE.BoxGeometry(8, 0.35, 3.7), snowMat));
      roof.position.set(0, 4.35, s * 1.45);
      roof.rotation.x = s * 0.62;
      cab.add(roof);
      const under = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 3.7), darkWood);
      under.position.set(0, 4.12, s * 1.43);
      under.rotation.x = s * 0.62;
      cab.add(under);
    }
    const gable = new THREE.Shape();
    gable.moveTo(-2.8, 0); gable.lineTo(2.8, 0); gable.lineTo(0, 1.95); gable.closePath();
    for (const s of [-1, 1]) {
      const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), wood);
      gm.rotation.y = Math.PI / 2 * s;
      gm.position.set(s * 3.5, 3.4, 0);
      cab.add(gm);
    }
    const chim = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.8, 2, 0.8), new THREE.MeshStandardMaterial({ color: '#8e98b8' })));
    chim.position.set(2, 5, -1);
    cab.add(chim);
    const winMat = new THREE.MeshStandardMaterial({ color: '#ffe6a6', emissive: '#ffb547', emissiveIntensity: 2 });
    for (const x of [-2, 2]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 0.1), winMat);
      w.position.set(x, 2, 2.78);
      cab.add(w);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), darkWood);
    door.position.set(0, 1.1, 2.78);
    cab.add(door);
    cab.updateMatrixWorld();
    const wp = new THREE.Vector3();
    walls.getWorldPosition(wp);
    addStatic(new CANNON.Box(new CANNON.Vec3(3.5, 2.5, 2.75)), wp.x, 2.5, wp.z, cab.rotation.y);

    // smoke puffs
    const puffs = [];
    const chimTop = new THREE.Vector3(2, 6.2, -1).applyMatrix4(cab.matrixWorld);
    const puffMat = new THREE.MeshStandardMaterial({ color: '#dfe6f5', transparent: true, opacity: 0.6, flatShading: true });
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), puffMat.clone());
      scene.add(p);
      puffs.push({ m: p, o: i / 7 });
    }
    animators.push((t) => {
      for (const p of puffs) {
        const k = (t * 0.18 + p.o) % 1;
        p.m.position.set(chimTop.x + k * 2.2, chimTop.y + k * 5, chimTop.z - k * 0.6);
        p.m.scale.setScalar(0.5 + k * 1.6);
        p.m.material.opacity = 0.65 * (1 - k);
      }
    });

    // sign
    signPost(z.x + 2, z.z + 2, 0.6, () => S('zones').about);
    interactions.push({ id: 'about', panel: { type: 'about' }, x: z.x + 1, z: z.z + 3, r: 5, y: 3.2, zone: 'about', label: () => S('zones').about });
  }

  function signPost(x, zPos, yaw, text, color) {
    const g = new THREE.Group();
    g.position.set(x, 0, zPos);
    g.rotation.y = yaw;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.14), [
      new THREE.MeshStandardMaterial({ color: '#6e4636' }), new THREE.MeshStandardMaterial({ color: '#6e4636' }),
      new THREE.MeshStandardMaterial({ color: '#6e4636' }), new THREE.MeshStandardMaterial({ color: '#6e4636' }),
      mat, mat,
    ]));
    board.position.y = 2;
    const pole = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 2, 0.16), new THREE.MeshStandardMaterial({ color: '#5a3a30' })));
    pole.position.y = 1;
    g.add(board, pole);
    scene.add(g);
    addStatic(new CANNON.Box(new CANNON.Vec3(0.12, 1.2, 0.12)), x, 1.2, zPos);
    const refresh = () => {
      mat.map?.dispose();
      mat.map = canvasTexture(signCanvas(text(), lang, color));
      mat.needsUpdate = true;
    };
    refresh();
    langHooks.push(refresh);
    return g;
  }

  // ---------------- EXPERIENCE: career road ----------------
  {
    const z = ZONES.experience;
    const x0 = z.x - 15, perYear = 8;
    const yearX = (y) => x0 + (y - 2023) * perYear;
    const now = new Date();
    const nowY = now.getFullYear() + now.getMonth() / 12;
    const lanes = [z.z - 3.5, z.z + 3.5];
    const laneColors = [PALETTE.teal, PALETTE.lavender];
    // year ticks
    for (let y = 2023; y <= 2026; y++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 12), new THREE.MeshStandardMaterial({ color: '#8f9cc2' }));
      tick.position.set(yearX(y), 0.03, z.z);
      scene.add(tick);
      decal(() => textDecalCanvas([{ text: S('years')[y], size: 1.3, color: '#55648f' }], lang, 6), yearX(y), z.z + 8.4);
    }
    CAREER.forEach((c, i) => {
      const item = () => R().experience.items[i];
      const end = c.to ?? nowY;
      const len = (end - c.from) * perYear;
      const mid = yearX(c.from) + len / 2;
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.12, 0.8),
        new THREE.MeshStandardMaterial({ color: laneColors[i], emissive: laneColors[i], emissiveIntensity: 1.1 }),
      );
      strip.position.set(mid, 0.06, lanes[i]);
      scene.add(strip);
      // pulse running along the strip
      const pulse = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.9), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2 }));
      scene.add(pulse);
      animators.push((t) => {
        const k = (t * 0.25 + i * 0.5) % 1;
        pulse.position.set(yearX(c.from) + k * len, 0.08, lanes[i]);
      });
      // start post
      const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 8), new THREE.MeshStandardMaterial({ color: laneColors[i], emissive: laneColors[i], emissiveIntensity: 0.6 })));
      post.position.set(yearX(c.from), 0.6, lanes[i]);
      scene.add(post);
      addStatic(new CANNON.Cylinder(0.4, 0.4, 1.2, 8), yearX(c.from), 0.6, lanes[i]);
      // company sign at the end of the strip
      signPost(Math.min(yearX(end) + 2.4, z.x + 16), lanes[i] + (i ? 2 : -2), 0, () => item().company.split('(')[0].trim(), laneColors[i]);
      interactions.push({
        id: `exp-${i}`, panel: { type: 'experience', index: i }, x: mid, z: lanes[i], r: 4.5, y: 2, zone: 'experience',
        label: () => item().company.split('(')[0].trim(),
      });
    });
  }

  // ---------------- STACK: crate pyramids ----------------
  {
    const z = ZONES.stack;
    const groupColors = [PALETTE.coral, PALETTE.amber, PALETTE.teal, PALETTE.lavender];
    const centres = [[-4.5, -4], [4.5, -4], [-4.5, 4.5], [4.5, 4.5]];
    const size = 1.25;
    const crateGeo = new RoundedBoxGeometry(size, size, size, 2, 0.06);
    RESUME.en.stack.groups.forEach((grp, gi) => {
      const [ox, oz] = centres[gi];
      const layout = [[-1, 0], [0, 0], [1, 0], [-0.5, 1], [0.5, 1], [0, 2]];
      grp.items.slice(0, 6).forEach((label, k) => {
        const [cx, row] = layout[k];
        const tex = canvasTexture(crateCanvas(label, groupColors[gi]));
        const mesh = shadowed(new THREE.Mesh(crateGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })));
        const body = new CANNON.Body({ mass: 5, shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)) });
        body.position.set(z.x + ox + cx * (size + 0.04), size / 2 + row * size + 0.01, z.z + oz);
        body.quaternion.setFromEuler(0, 0.35, 0);
        // rotate the pyramid row offset with the yaw so stacks stay aligned
        const off = new CANNON.Vec3(cx * (size + 0.04), 0, 0);
        const rot = new CANNON.Quaternion().setFromEuler(0, 0.35, 0);
        const roff = rot.vmult(off);
        body.position.set(z.x + ox + roff.x, size / 2 + row * size + 0.01, z.z + oz + roff.z);
        body.allowSleep = true;
        world.addBody(body);
        body.sleep();
        scene.add(mesh);
        dynamics.push({ body, mesh, kind: 'crate', home: body.position.clone(), toppled: false });
      });
    });
    signPost(z.x - 9, z.z - 6, -0.5, () => S('zones').stack, PALETTE.coral);
    interactions.push({ id: 'stack', panel: { type: 'stack' }, x: z.x - 8, z: z.z - 3, r: 5, y: 3.2, zone: 'stack', label: () => R().stack.title });
  }

  // ---------------- PROJECTS: billboards ----------------
  {
    const z = ZONES.projects;
    // billboards stand on the north-west rim so their faces turn towards the (south-east) camera
    const count = R().projects.items.length;
    for (let i = 0; i < count; i++) {
      const a = -2.25 + (i - (count - 1) / 2) * 0.64;
      const d = 12;
      const x = z.x + Math.cos(a) * d, zz = z.z + Math.sin(a) * d;
      const g = new THREE.Group();
      g.position.set(x, 0, zz);
      g.lookAt(z.x, 0, z.z);
      scene.add(g);
      const faceMat = new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.35 });
      const frame = new THREE.MeshStandardMaterial({ color: '#2a3150' });
      const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(6.4, 4, 0.3), [frame, frame, frame, frame, faceMat, frame]));
      board.position.y = 3.6;
      g.add(board);
      for (const s of [-1, 1]) {
        const leg = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.7, 0.25), frame));
        leg.position.set(s * 2.4, 0.85, 0);
        g.add(leg);
      }
      const color = [PALETTE.coral, PALETTE.lavender, PALETTE.teal, PALETTE.amber][i % 4];
      const refresh = () => {
        const p = R().projects.items[i];
        const img = p.image ? images[p.image] : null;
        faceMat.map?.dispose();
        faceMat.map = canvasTexture(billboardCanvas(p, lang, color, img, i));
        faceMat.emissiveMap = faceMat.map;
        faceMat.needsUpdate = true;
      };
      refresh();
      langHooks.push(refresh);
      const yaw = Math.atan2(z.x - x, z.z - zz);
      addStatic(new CANNON.Box(new CANNON.Vec3(3.2, 2.6, 0.3)), x, 2.6, zz, yaw);
      const ix = x + (z.x - x) * 0.45, iz = zz + (z.z - zz) * 0.45;
      interactions.push({
        id: `proj-${i}`, panel: { type: 'project', index: i }, x: ix, z: iz, r: 4, y: 1.6, zone: 'projects',
        label: () => R().projects.items[i].name,
      });
    }
  }

  // ---------------- CONTACT: monoliths ----------------
  {
    const z = ZONES.contact;
    const kinds = ['email', 'github', 'linkedin', 'cv'];
    const colors = [PALETTE.coral, '#e9eefb', '#5ec8ff', PALETTE.amber];
    kinds.forEach((kind, i) => {
      // north rim of the plaza, leaving a gap for the road; faces look south at the camera
      const x = z.x + [-10.5, -5, 5, 10.5][i], zz = z.z - 5 - (i === 0 || i === 3 ? -1.5 : 0);
      const faceMat = new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.3 });
      const side = new THREE.MeshStandardMaterial({ color: '#1a2446' });
      const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.6, 0.7), [side, side, side, side, faceMat, side]));
      m.position.set(x, 1.8, zz);
      scene.add(m);
      const refresh = () => {
        faceMat.map?.dispose();
        faceMat.map = canvasTexture(monolithCanvas(kind, S('signs')[kind], lang, colors[i]));
        faceMat.emissiveMap = faceMat.map;
        faceMat.needsUpdate = true;
      };
      refresh();
      langHooks.push(refresh);
      addStatic(new CANNON.Box(new CANNON.Vec3(1.2, 1.8, 0.35)), x, 1.8, zz);
      interactions.push({
        id: `contact-${kind}`, panel: { type: 'contact', kind }, x, z: zz + 3, r: 2.6, y: 4.3, zone: 'contact',
        label: () => S('signs')[kind],
      });
    });
    decal(() => textDecalCanvas([
      { text: R().contact.title, size: 1.6, color: PALETTE.ink },
      { text: R().contact.body, size: 0.6, color: '#55648f', weight: 500, font: 'body' },
    ], lang, 26), z.x, z.z + 6.5);
  }

  // ---------------- snowfall ----------------
  const SNOW = 2200;
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(SNOW * 3);
  for (let i = 0; i < SNOW; i++) snowPos.set([(r() - 0.5) * 80, r() * 30, (r() - 0.5) * 80], i * 3);
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const flake = (() => {
    const [c, ctx] = makeCanvas(32, 32);
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.28, map: flake, transparent: true, depthWrite: false, opacity: 0.9 }));
  snow.frustumCulled = false;
  scene.add(snow);
  const snowState = new Float32Array(SNOW).map(() => r() * 6);
  animators.push((t, dt, focus) => {
    const p = snowGeo.attributes.position.array;
    for (let i = 0; i < SNOW; i++) {
      let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      y -= dt * (1.4 + (i % 7) * 0.12);
      x += Math.sin(t * 0.7 + snowState[i]) * dt * 0.5;
      if (y < 0) y += 30;
      // keep flakes in a box that follows the camera focus
      if (x - focus.x > 40) x -= 80;
      if (x - focus.x < -40) x += 80;
      if (z - focus.z > 40) z -= 80;
      if (z - focus.z < -40) z += 80;
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    }
    snowGeo.attributes.position.needsUpdate = true;
  });

  // ---------------- tyre tracks ----------------
  const TRACKS = 1400;
  const tracks = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.32, 0.5).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#9fb0d0', transparent: true, opacity: 0.55, depthWrite: false }),
    TRACKS,
  );
  tracks.renderOrder = 0;
  tracks.frustumCulled = false;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < TRACKS; i++) tracks.setMatrixAt(i, zero);
  scene.add(tracks);
  let trackIdx = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  function addTrack(x, z, yaw) {
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    _p.set(x, 0.025, z);
    tracks.setMatrixAt(trackIdx, _m.compose(_p, _q, _s));
    trackIdx = (trackIdx + 1) % TRACKS;
    tracks.instanceMatrix.needsUpdate = true;
  }

  // ---------------- per-frame ----------------
  function update(t, dt, focus) {
    for (const d of dynamics) {
      d.mesh.position.copy(d.body.position);
      d.mesh.quaternion.copy(d.body.quaternion);
    }
    for (const a of animators) a(t, dt, focus);
  }

  function setLang(l) {
    lang = l;
    langHooks.forEach((f) => f());
  }

  return { update, setLang, interactions, dynamics, addTrack, treeSpots, rockSpots };
}
