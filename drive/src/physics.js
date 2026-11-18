import * as CANNON from 'cannon-es';

// Car tuning. Forward is -Z in local space (three.js convention: car faces -Z).
export const CAR = {
  chassis: new CANNON.Vec3(0.85, 0.32, 1.7), // half extents
  mass: 160,
  wheelRadius: 0.42,
  wheelY: 0.15,
  wheelX: 0.82,
  wheelZFront: -1.12,
  wheelZRear: 1.1,
  engine: 420,
  boost: 1.75,
  brake: 14,
  maxSteer: 0.52,
  topSpeed: 21, // m/s soft cap
};

export function createPhysics() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.25;
  world.defaultContactMaterial.restitution = 0.05;

  const groundMat = new CANNON.Material('ground');
  const wheelMat = new CANNON.Material('wheel');
  world.addContactMaterial(new CANNON.ContactMaterial(groundMat, wheelMat, { friction: 0.3, restitution: 0 }));

  // a thick box instead of a Plane: SAP broadphase and vehicle raycasts are unreliable with infinite planes
  const ground = new CANNON.Body({ mass: 0, material: groundMat, shape: new CANNON.Box(new CANNON.Vec3(200, 1, 200)) });
  ground.position.set(0, -1, 0);
  ground.updateAABB();
  world.addBody(ground);

  return { world, groundMat, wheelMat, CANNON };
}

export function createVehicle(world, spawn = { x: 0, z: 0, yaw: 0 }) {
  const chassisBody = new CANNON.Body({ mass: CAR.mass, allowSleep: false });
  chassisBody.addShape(new CANNON.Box(CAR.chassis), new CANNON.Vec3(0, 0, 0));
  // cabin as a smaller box so the roof collides
  chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(0.7, 0.28, 0.85)), new CANNON.Vec3(0, 0.55, 0.2));
  chassisBody.angularDamping = 0.35;
  chassisBody.linearDamping = 0.05;
  chassisBody.position.set(spawn.x, 1.6, spawn.z);
  chassisBody.quaternion.setFromEuler(0, spawn.yaw, 0);

  const vehicle = new CANNON.RaycastVehicle({
    chassisBody,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2,
  });

  const base = {
    radius: CAR.wheelRadius,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: 38,
    suspensionRestLength: 0.65,
    frictionSlip: 2.1,
    dampingRelaxation: 2.6,
    dampingCompression: 4.2,
    maxSuspensionForce: 1e5,
    rollInfluence: 0.04,
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    maxSuspensionTravel: 0.35,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true,
  };
  const pts = [
    [-CAR.wheelX, CAR.wheelZFront], // 0 front left
    [CAR.wheelX, CAR.wheelZFront], // 1 front right
    [-CAR.wheelX, CAR.wheelZRear], // 2 rear left
    [CAR.wheelX, CAR.wheelZRear], // 3 rear right
  ];
  for (const [x, z] of pts) {
    vehicle.addWheel({ ...base, chassisConnectionPointLocal: new CANNON.Vec3(x, CAR.wheelY, z) });
  }
  vehicle.addToWorld(world);
  return vehicle;
}

const _fwd = new CANNON.Vec3();
// input: { throttle: -1..1, steer: -1..1 (positive = left), brake: bool, boost: bool }
export function driveVehicle(vehicle, input, state) {
  const body = vehicle.chassisBody;
  body.quaternion.vmult(new CANNON.Vec3(0, 0, -1), _fwd);
  const speed = body.velocity.dot(_fwd); // + when moving forward
  state.speed = speed;

  // steering eases in, and tightens less at speed
  const steerTarget = input.steer * CAR.maxSteer * (1 - Math.min(Math.abs(speed) / 40, 0.45));
  state.steer += (steerTarget - state.steer) * 0.25;
  vehicle.setSteeringValue(state.steer, 0);
  vehicle.setSteeringValue(state.steer, 1);

  let force = 0;
  const boost = input.boost ? CAR.boost : 1;
  const cap = CAR.topSpeed * (input.boost ? 1.45 : 1);
  if (input.throttle > 0 && speed < cap) force = CAR.engine * boost * input.throttle;
  if (input.throttle < 0) {
    // brake first if rolling forward, then reverse
    if (speed > 1) force = 0;
    else if (speed > -8) force = CAR.engine * 0.6 * input.throttle;
  }
  for (let i = 0; i < 4; i++) vehicle.applyEngineForce(i >= 2 ? force : force * 0.6, i);

  const braking = input.brake ? CAR.brake : input.throttle < 0 && speed > 1 ? CAR.brake * 0.8 : input.throttle === 0 ? 1.2 : 0;
  for (let i = 0; i < 4; i++) vehicle.setBrake(input.brake && i < 2 ? braking * 0.25 : braking, i);
  // handbrake = slidey rear
  vehicle.wheelInfos[2].frictionSlip = vehicle.wheelInfos[3].frictionSlip = input.brake ? 0.9 : 2.1;
  return speed;
}
