import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeCanvas, FONTS } from './textures.js';

// A small boxy rally hatchback, built from primitives. Faces -Z.
export function buildCar() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshStandardMaterial({ color: '#14a394', roughness: 0.35, metalness: 0.2 });
  const teal = new THREE.MeshStandardMaterial({ color: '#fff4dc', roughness: 0.4, metalness: 0.1 });
  const amber = new THREE.MeshStandardMaterial({ color: '#ff9f2e', roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1d2233', roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1c2a44', roughness: 0.1, metalness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#d7dde8', roughness: 0.25, metalness: 0.9 });
  const lamp = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd36b', emissiveIntensity: 2.2 });
  const tail = new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff2a2a', emissiveIntensity: 1.4 });

  // side profile (z, y), extruded across x
  const prof = new THREE.Shape();
  const pts = [
    [-1.78, -0.3], [-1.82, 0.12], [-1.62, 0.3], [-0.78, 0.36], [-0.32, 0.86],
    [0.92, 0.88], [1.6, 0.42], [1.78, 0.3], [1.8, -0.3],
  ];
  // negate z so that after rotateY(+90deg) the nose ends up at -Z
  prof.moveTo(-pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) prof.lineTo(-p[0], p[1]);
  prof.closePath();
  const shell = new THREE.ExtrudeGeometry(prof, {
    depth: 1.5, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.08, bevelSegments: 3, curveSegments: 4,
  });
  shell.rotateY(Math.PI / 2); // extrude along +x after rotation, profile z stays z
  shell.translate(-0.75, 0, 0);
  shell.computeVertexNormals();
  const shellMesh = new THREE.Mesh(shell, paint);
  shellMesh.castShadow = true;
  body.add(shellMesh);

  const add = (geo, mat, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    m.castShadow = true;
    body.add(m);
    return m;
  };

  // windows: windshield, rear, sides
  const ws = add(new THREE.BoxGeometry(1.42, 0.62, 0.04), glass, 0, 0.62, -0.56);
  ws.rotation.x = -Math.atan2(0.46, 0.5) + 0.02;
  ws.position.set(0, 0.62, -0.53);
  const rw = add(new THREE.BoxGeometry(1.4, 0.48, 0.04), glass, 0, 0.66, 1.27);
  rw.rotation.x = Math.atan2(0.68, 0.46) - Math.PI / 2 + 0.25;
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.04, 0.38, 1.1), glass, s * 0.84, 0.62, 0.28);
    // stripes along the sides
    add(new THREE.BoxGeometry(0.03, 0.09, 3.3), teal, s * 0.845, 0.12, 0);
    add(new THREE.BoxGeometry(0.03, 0.05, 3.3), amber, s * 0.845, 0.0, 0);
    // mirrors
    add(new THREE.BoxGeometry(0.18, 0.1, 0.12), dark, s * 0.92, 0.48, -0.6);
    // mudflaps
    add(new THREE.BoxGeometry(0.34, 0.28, 0.03), dark, s * 0.72, -0.32, 1.48);
  }
  // hood + roof stripes
  add(new THREE.BoxGeometry(0.34, 0.02, 1.05), teal, 0, 0.39, -1.2, 0, -0.04);
  add(new THREE.BoxGeometry(0.34, 0.02, 1.25), teal, 0, 0.9, 0.3);
  add(new THREE.BoxGeometry(0.1, 0.021, 1.05), amber, 0.24, 0.392, -1.2, 0, -0.04);
  add(new THREE.BoxGeometry(0.1, 0.021, 1.25), amber, 0.24, 0.902, 0.3);

  // bumpers
  add(new RoundedBoxGeometry(1.75, 0.2, 0.22, 2, 0.06), dark, 0, -0.22, -1.86);
  add(new RoundedBoxGeometry(1.75, 0.2, 0.22, 2, 0.06), dark, 0, -0.22, 1.86);
  // grille
  add(new THREE.BoxGeometry(0.8, 0.16, 0.03), dark, 0, 0.12, -1.9);
  // headlights (round) + fog lamps
  const round = new THREE.CylinderGeometry(0.15, 0.15, 0.06, 18);
  round.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    add(round, lamp, s * 0.6, 0.13, -1.9);
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14).rotateX(Math.PI / 2), lamp, s * 0.42, -0.24, -1.98);
    add(new THREE.BoxGeometry(0.3, 0.14, 0.04), tail, s * 0.62, 0.22, 1.92);
  }
  // roof rack with a light bar
  add(new THREE.BoxGeometry(1.3, 0.05, 0.05), chrome, 0, 1.02, -0.2);
  add(new THREE.BoxGeometry(1.3, 0.05, 0.05), chrome, 0, 1.02, 0.75);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.12, 1.0), chrome, s * 0.62, 0.97, 0.28);
  add(new THREE.BoxGeometry(1.2, 0.18, 0.12), dark, 0, 1.12, -0.24);
  for (let i = 0; i < 4; i++) add(round, lamp, -0.45 + i * 0.3, 1.12, -0.31);
  // spare wheel on the rack
  const spare = add(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 20), dark, 0, 1.13, 0.5);
  // door roundels with a race number
  const [rc, rctx] = makeCanvas(256, 256);
  rctx.fillStyle = '#ffffff';
  rctx.beginPath();
  rctx.arc(128, 128, 120, 0, Math.PI * 2);
  rctx.fill();
  rctx.strokeStyle = '#1f9e90';
  rctx.lineWidth = 16;
  rctx.stroke();
  rctx.fillStyle = '#16213b';
  rctx.font = `800 130px ${FONTS.en.head}`;
  rctx.textAlign = 'center';
  rctx.textBaseline = 'middle';
  rctx.fillText('07', 128, 136);
  const roundel = new THREE.MeshStandardMaterial({ map: canvasTexture(rc), transparent: true, roughness: 0.5 });
  for (const s of [-1, 1]) {
    const d = add(new THREE.PlaneGeometry(0.5, 0.5), roundel, s * 0.852, 0.12 + 0.12, -0.25, (s * Math.PI) / 2);
    d.castShadow = false;
  }

  // wheels
  const wheels = [];
  const tire = new THREE.MeshStandardMaterial({ color: '#202330', roughness: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: 0.35, metalness: 0.3 });
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 22), tire);
    t.rotation.z = Math.PI / 2;
    t.castShadow = true;
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.34, 6), rim);
    r.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.36, 10), dark);
    hub.rotation.z = Math.PI / 2;
    w.add(t, r, hub);
    wheels.push(w);
  }

  // headlight beam
  const beam = new THREE.SpotLight('#ffe2a8', 16, 22, 0.5, 0.7, 1.6);
  beam.position.set(0, 0.2, -1.9);
  beam.target.position.set(0, -1.2, -9);
  body.add(beam, beam.target);
  const brakeGlow = new THREE.PointLight('#ff3030', 0, 4, 2);
  brakeGlow.position.set(0, 0.2, 2.3);
  body.add(brakeGlow);

  return { group, body, wheels, tail, brakeGlow, spare };
}
