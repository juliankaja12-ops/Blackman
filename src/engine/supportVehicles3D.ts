import * as THREE from 'three';

export interface SupportVehicleRig {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  strobeA: THREE.Mesh;
  strobeB: THREE.Mesh;
  cannonTurret?: THREE.Group;
  waterJet?: THREE.Mesh;
  dispose: () => void;
}

function createExtrudedProfile(
  shape: THREE.Shape,
  width: number,
  bevelThickness = 0.05,
  bevelSize = 0.04,
  bevelSegments = 3
): THREE.ExtrudeGeometry {
  const innerDepth = Math.max(0.02, width - bevelThickness * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: innerDepth,
    bevelEnabled: bevelThickness > 0 && bevelSize > 0,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments: 14,
  });
  geo.translate(0, 0, -innerDepth / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function addWheel(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  radius: number,
  width: number,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  caliperMat: THREE.Material,
  disposables: { dispose: () => void }[]
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const halfW = width * 0.5;
  const lathePts = [
    new THREE.Vector2(radius * 0.56, -halfW * 0.9),
    new THREE.Vector2(radius * 0.9, -halfW),
    new THREE.Vector2(radius, -halfW * 0.76),
    new THREE.Vector2(radius, halfW * 0.76),
    new THREE.Vector2(radius * 0.9, halfW),
    new THREE.Vector2(radius * 0.56, halfW * 0.9),
  ];
  const tGeo = new THREE.LatheGeometry(lathePts, 24);
  tGeo.rotateZ(Math.PI / 2);
  disposables.push(tGeo);
  const tire = new THREE.Mesh(tGeo, tireMat);
  tire.castShadow = true;
  g.add(tire);

  const rGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width * 0.9, 16);
  rGeo.rotateZ(Math.PI / 2);
  disposables.push(rGeo);
  const rim = new THREE.Mesh(rGeo, rimMat);
  g.add(rim);

  const sideSign = x >= 0 ? 1 : -1;
  for (let s = 0; s < 5; s++) {
    const spokeGeo = new THREE.BoxGeometry(0.035, radius * 0.88, 0.04);
    disposables.push(spokeGeo);
    const spoke = new THREE.Mesh(spokeGeo, caliperMat);
    spoke.position.x = sideSign * (width * 0.44);
    spoke.rotation.x = (s / 5) * Math.PI;
    g.add(spoke);
  }

  parent.add(g);
  return g;
}

/**
 * Autobotta Antincendio (Sculpted Heavy Circuit Fire Tanker with Roof Water/Foam Cannon)
 */
export function buildFireTruck3D(): SupportVehicleRig {
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const redPaint = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xdc2626,
      metalness: 0.48,
      roughness: 0.22,
      clearcoat: 0.95,
    })
  );
  const stripeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x713f12,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    })
  );
  const tankWhiteMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xf1f5f9,
      metalness: 0.38,
      roughness: 0.24,
      clearcoat: 0.85,
    })
  );
  const aluminumMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.86,
      roughness: 0.25,
    })
  );
  const darkFrameMat = track(
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7, metalness: 0.35 })
  );
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.06,
      metalness: 0.12,
      transparent: true,
      opacity: 0.84,
      clearcoat: 1.0,
    })
  );
  const tireMat = track(
    new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.86, metalness: 0.05 })
  );
  const rimMat = track(
    new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.88, roughness: 0.2 })
  );
  const hlMat = track(
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 2.2 })
  );
  const tlMat = track(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 })
  );

  // 1. Heavy Chassis Frame & Side Steps
  const frameGeo = track(new THREE.BoxGeometry(2.34, 0.34, 7.25));
  const frame = new THREE.Mesh(frameGeo, darkFrameMat);
  frame.position.set(0, 0.58, 0);
  frame.castShadow = true;
  root.add(frame);

  // 2. Sculpted Sloped Fire Cab (ExtrudeGeometry)
  const cabShape = new THREE.Shape();
  cabShape.moveTo(1.12, 0.72);
  cabShape.lineTo(3.48, 0.72);
  cabShape.lineTo(3.55, 1.52);
  cabShape.lineTo(3.22, 2.58);
  cabShape.lineTo(1.18, 2.62);
  cabShape.lineTo(1.12, 0.72);
  const cabGeo = track(createExtrudedProfile(cabShape, 2.36, 0.08, 0.06, 3));
  const cab = new THREE.Mesh(cabGeo, redPaint);
  cab.castShadow = true;
  root.add(cab);

  // Sloped Wraparound Windshield & Side Cab Windows
  const windshieldGeo = track(new THREE.BoxGeometry(2.08, 0.82, 0.08));
  const windshield = new THREE.Mesh(windshieldGeo, glassMat);
  windshield.position.set(0, 2.02, 3.38);
  windshield.rotation.x = -0.26;
  root.add(windshield);

  for (const side of [-1, 1]) {
    const sideWinGeo = track(new THREE.BoxGeometry(0.06, 0.7, 1.45));
    const sideWin = new THREE.Mesh(sideWinGeo, glassMat);
    sideWin.position.set(side * 1.18, 2.04, 2.25);
    root.add(sideWin);

    // Truck Side Mirrors
    const mirrorGeo = track(new THREE.BoxGeometry(0.12, 0.34, 0.1));
    const mirror = new THREE.Mesh(mirrorGeo, darkFrameMat);
    mirror.position.set(side * 1.32, 1.95, 3.05);
    root.add(mirror);
  }

  // Front Grille, Heavy Bullbar & Emergency LED Headlights
  const grilleGeo = track(new THREE.BoxGeometry(1.48, 0.56, 0.1));
  const grille = new THREE.Mesh(grilleGeo, aluminumMat);
  grille.position.set(0, 1.18, 3.55);
  root.add(grille);

  const bumperGeo = track(new THREE.BoxGeometry(2.46, 0.36, 0.32));
  const bumper = new THREE.Mesh(bumperGeo, stripeMat);
  bumper.position.set(0, 0.64, 3.6);
  root.add(bumper);

  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.14, 0.08)), hlMat);
    hl.position.set(side * 0.92, 1.05, 3.56);
    const tl = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.16, 0.08)), tlMat);
    tl.position.set(side * 0.92, 0.88, -3.62);
    root.add(hl, tl);
  }

  // 3. Sculpted Equipment Lockers Body + Ribbed Aluminum Roll-Up Bays
  const lockerGeo = track(new THREE.BoxGeometry(2.38, 1.38, 4.58));
  const locker = new THREE.Mesh(lockerGeo, redPaint);
  locker.position.set(0, 1.48, -1.26);
  locker.castShadow = true;
  root.add(locker);

  for (const side of [-1, 1]) {
    for (const bz of [-2.6, -1.25, 0.1]) {
      const bayGeo = track(new THREE.BoxGeometry(0.06, 0.96, 1.08));
      const bay = new THREE.Mesh(bayGeo, aluminumMat);
      bay.position.set(side * 1.2, 1.48, bz);
      root.add(bay);
    }
    const stripGeo = track(new THREE.BoxGeometry(0.06, 0.14, 4.55));
    const strip = new THREE.Mesh(stripGeo, stripeMat);
    strip.position.set(side * 1.21, 0.92, -1.26);
    root.add(strip);
  }

  // 4. Pressurized Cylindrical Water & AFFF Foam Tank with Hemispherical End Caps
  const tankGeo = track(new THREE.CylinderGeometry(0.9, 0.9, 4.0, 22));
  tankGeo.rotateX(Math.PI / 2);
  const tank = new THREE.Mesh(tankGeo, tankWhiteMat);
  tank.position.set(0, 2.34, -1.35);
  tank.castShadow = true;
  root.add(tank);

  for (const capZ of [-3.35, 0.65]) {
    const capGeo = track(new THREE.SphereGeometry(0.9, 18, 14));
    capGeo.scale(1, 1, 0.35);
    const cap = new THREE.Mesh(capGeo, tankWhiteMat);
    cap.position.set(0, 2.34, capZ);
    root.add(cap);
  }

  for (const tz of [-2.7, -1.35, 0.0]) {
    const strapGeo = track(new THREE.TorusGeometry(0.92, 0.035, 8, 24));
    const strap = new THREE.Mesh(strapGeo, aluminumMat);
    strap.position.set(0, 2.34, tz);
    root.add(strap);
  }

  // 5. Roof-Mounted Articulated Water/Foam Monitor Cannon
  const cannonTurret = new THREE.Group();
  cannonTurret.position.set(0, 2.74, 1.9);
  const turretBaseGeo = track(new THREE.CylinderGeometry(0.24, 0.32, 0.34, 14));
  cannonTurret.add(new THREE.Mesh(turretBaseGeo, aluminumMat));

  const nozzleGeo = track(new THREE.CylinderGeometry(0.085, 0.135, 0.98, 12));
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzle = new THREE.Mesh(nozzleGeo, darkFrameMat);
  nozzle.position.set(0, 0.22, 0.36);
  cannonTurret.add(nozzle);

  const jetGeo = track(new THREE.ConeGeometry(0.55, 11, 14, 1, true));
  jetGeo.translate(0, 5.5, 0);
  jetGeo.rotateX(Math.PI / 2);
  const jetMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    })
  );
  const waterJet = new THREE.Mesh(jetGeo, jetMat);
  waterJet.position.set(0, 0.22, 0.84);
  waterJet.visible = false;
  cannonTurret.add(waterJet);
  root.add(cannonTurret);

  // 6. Aerodynamic Emergency Lightbar
  const strobeAMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x3b82f6,
      emissiveIntensity: 3.0,
    })
  );
  const strobeBMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.2,
    })
  );
  const barBaseGeo = track(new THREE.BoxGeometry(1.9, 0.08, 0.34));
  const barBase = new THREE.Mesh(barBaseGeo, darkFrameMat);
  barBase.position.set(0, 2.66, 2.8);
  root.add(barBase);

  const barGeo = track(new THREE.BoxGeometry(0.86, 0.16, 0.28));
  const strobeA = new THREE.Mesh(barGeo, strobeAMat);
  strobeA.position.set(0.48, 2.75, 2.8);
  const strobeB = new THREE.Mesh(barGeo, strobeBMat);
  strobeB.position.set(-0.48, 2.75, 2.8);
  root.add(strobeA, strobeB);

  // 7. 6 Heavy Rescue Wheels
  const wheels: THREE.Object3D[] = [];
  for (const wz of [2.35, -1.1, -2.55]) {
    for (const side of [-1, 1]) {
      wheels.push(
        addWheel(root, side * 1.18, 0.54, wz, 0.54, 0.38, tireMat, rimMat, darkFrameMat, disposables)
      );
    }
  }

  return {
    root,
    wheels,
    strobeA,
    strobeB,
    cannonTurret,
    waterJet,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

/**
 * Auto Antincendio Rapida (Sculpted Fast Medical & Fire Intervention SUV with Rescue Tools)
 */
export function buildFastFireCar3D(): SupportVehicleRig {
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const redMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xe11d48,
      metalness: 0.55,
      roughness: 0.2,
      clearcoat: 1.0,
    })
  );
  const yellowMat = track(
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.28, metalness: 0.22 })
  );
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.06,
      transparent: true,
      opacity: 0.85,
      clearcoat: 1.0,
    })
  );
  const darkMat = track(
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.68, metalness: 0.32 })
  );
  const tireMat = track(
    new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.85 })
  );
  const rimMat = track(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.18 })
  );
  const hlMat = track(
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 2.2 })
  );
  const tlMat = track(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 })
  );

  // Sculpted Extruded SUV Body Profile
  const suvShape = new THREE.Shape();
  suvShape.moveTo(-2.22, 0.3);
  suvShape.lineTo(-2.18, 1.08);
  suvShape.lineTo(-1.82, 1.52);
  suvShape.lineTo(0.32, 1.52);
  suvShape.quadraticCurveTo(0.82, 1.1, 1.25, 0.98);
  suvShape.quadraticCurveTo(1.98, 0.88, 2.22, 0.58);
  suvShape.lineTo(2.24, 0.3);
  suvShape.lineTo(-2.22, 0.3);
  const bodyGeo = track(createExtrudedProfile(suvShape, 1.94, 0.07, 0.06, 3));
  const body = new THREE.Mesh(bodyGeo, redMat);
  body.castShadow = true;
  root.add(body);

  // High-visibility safety stripe & rocker panels
  const stripeGeo = track(new THREE.BoxGeometry(1.98, 0.14, 4.38));
  const stripe = new THREE.Mesh(stripeGeo, yellowMat);
  stripe.position.set(0, 0.66, 0);
  root.add(stripe);

  // Tinted Cabin Glazing
  const winShape = new THREE.Shape();
  winShape.moveTo(-1.85, 1.04);
  winShape.lineTo(-1.58, 1.46);
  winShape.lineTo(0.28, 1.46);
  winShape.lineTo(0.95, 1.02);
  winShape.lineTo(-1.85, 1.04);
  const cabinGeo = track(createExtrudedProfile(winShape, 1.82, 0.05, 0.04, 2));
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  root.add(cabin);

  // Front Bullbar + LED Headlights + Taillights
  const bullGeo = track(new THREE.BoxGeometry(1.66, 0.3, 0.22));
  const bull = new THREE.Mesh(bullGeo, darkMat);
  bull.position.set(0, 0.52, 2.26);
  root.add(bull);

  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.1, 0.08)), hlMat);
    hl.position.set(side * 0.68, 0.72, 2.2);
    const tl = new THREE.Mesh(track(new THREE.BoxGeometry(0.36, 0.1, 0.08)), tlMat);
    tl.position.set(side * 0.68, 0.88, -2.22);
    root.add(hl, tl);
  }

  // Roof Rescue Rack with Pressurized Fire Extinguisher Cylinders
  const rackGeo = track(new THREE.BoxGeometry(1.5, 0.07, 1.85));
  const rack = new THREE.Mesh(rackGeo, darkMat);
  rack.position.set(0, 1.56, -0.42);
  root.add(rack);

  for (const tx of [-0.4, 0.4]) {
    const extGeo = track(new THREE.CylinderGeometry(0.11, 0.11, 0.68, 12));
    extGeo.rotateX(Math.PI / 2);
    const ext = new THREE.Mesh(extGeo, yellowMat);
    ext.position.set(tx, 1.68, -0.6);
    root.add(ext);
  }

  // Flashing Lightbar
  const strobeAMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x3b82f6,
      emissiveIntensity: 3.0,
    })
  );
  const strobeBMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.2,
    })
  );
  const barGeo = track(new THREE.BoxGeometry(0.68, 0.13, 0.24));
  const strobeA = new THREE.Mesh(barGeo, strobeAMat);
  strobeA.position.set(0.36, 1.63, 0.25);
  const strobeB = new THREE.Mesh(barGeo, strobeBMat);
  strobeB.position.set(-0.36, 1.63, 0.25);
  root.add(strobeA, strobeB);

  const wheels: THREE.Object3D[] = [];
  for (const [wx, wz] of [
    [0.98, 1.38],
    [-0.98, 1.38],
    [0.98, -1.38],
    [-0.98, -1.38],
  ]) {
    wheels.push(addWheel(root, wx, 0.4, wz, 0.4, 0.3, tireMat, rimMat, redMat, disposables));
  }

  return {
    root,
    wheels,
    strobeA,
    strobeB,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

/**
 * Team Safety Car FIA (Sculpted GT Interceptor Coupe with Amber/Green Lightbar)
 */
export function buildSafetyCar3D(): SupportVehicleRig {
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const silverMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      metalness: 0.9,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
    })
  );
  const carbonMat = track(
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.48, metalness: 0.32 })
  );
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x090d16,
      roughness: 0.05,
      metalness: 0.12,
      transparent: true,
      opacity: 0.85,
      clearcoat: 1.0,
    })
  );
  const tireMat = track(
    new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.85 })
  );
  const rimMat = track(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.18 })
  );
  const caliperMat = track(
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.28 })
  );

  // Sculpted Long-Hood GT Safety Car Silhouette
  const gtShape = new THREE.Shape();
  gtShape.moveTo(-2.22, 0.2);
  gtShape.lineTo(-2.18, 0.78);
  gtShape.quadraticCurveTo(-1.4, 0.86, -0.82, 1.15);
  gtShape.quadraticCurveTo(-0.22, 1.16, 0.35, 0.78);
  gtShape.quadraticCurveTo(1.25, 0.74, 2.2, 0.42);
  gtShape.lineTo(2.24, 0.2);
  gtShape.lineTo(-2.22, 0.2);
  const bodyGeo = track(createExtrudedProfile(gtShape, 1.88, 0.08, 0.07, 3));
  const body = new THREE.Mesh(bodyGeo, silverMat);
  body.castShadow = true;
  root.add(body);

  // Flared GT Fenders
  const fenderShape = new THREE.Shape();
  fenderShape.moveTo(-2.16, 0.22);
  fenderShape.lineTo(-2.05, 0.68);
  fenderShape.quadraticCurveTo(-1.4, 0.82, -0.8, 0.62);
  fenderShape.lineTo(0.84, 0.58);
  fenderShape.quadraticCurveTo(1.42, 0.78, 2.08, 0.56);
  fenderShape.lineTo(2.18, 0.24);
  fenderShape.lineTo(-2.16, 0.22);
  const fenderGeo = track(createExtrudedProfile(fenderShape, 0.38, 0.05, 0.04, 3));
  for (const side of [-1, 1]) {
    const fender = new THREE.Mesh(fenderGeo, silverMat);
    fender.position.set(side * 0.78, 0, 0);
    fender.castShadow = true;
    root.add(fender);

    // Side mirrors
    const mirror = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.07, 0.11)), carbonMat);
    mirror.position.set(side * 0.92, 0.78, 0.56);
    root.add(mirror);
  }

  // Carbon Aero Splitter, Side Skirts & Rear Diffuser
  const splitterGeo = track(new THREE.BoxGeometry(2.0, 0.05, 0.48));
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.16, 2.16);
  root.add(splitter);

  const skirtGeo = track(new THREE.BoxGeometry(2.0, 0.06, 3.6));
  const skirt = new THREE.Mesh(skirtGeo, carbonMat);
  skirt.position.set(0, 0.16, 0);
  root.add(skirt);

  // Fastback Cabin Canopy
  const canopyShape = new THREE.Shape();
  canopyShape.moveTo(-1.08, 0.72);
  canopyShape.quadraticCurveTo(-0.48, 1.12, 0.08, 1.08);
  canopyShape.quadraticCurveTo(0.54, 0.86, 0.78, 0.68);
  canopyShape.lineTo(-1.08, 0.72);
  const canopyGeo = track(createExtrudedProfile(canopyShape, 1.38, 0.06, 0.05, 3));
  const cabin = new THREE.Mesh(canopyGeo, glassMat);
  cabin.position.y = 0.04;
  root.add(cabin);

  // Swan-Neck Rear GT Wing
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.34, 0.16)), carbonMat);
    strut.position.set(side * 0.46, 0.92, -1.96);
    const endP = new THREE.Mesh(track(new THREE.BoxGeometry(0.036, 0.3, 0.42)), carbonMat);
    endP.position.set(side * 0.92, 1.0, -2.02);
    root.add(strut, endP);
  }
  const wingGeo = track(new THREE.BoxGeometry(1.86, 0.05, 0.32));
  const wing = new THREE.Mesh(wingGeo, carbonMat);
  wing.position.set(0, 1.06, -2.02);
  root.add(wing);

  // Panamericana Front Grille + LED Matrix Headlights & Taillights
  const grille = new THREE.Mesh(track(new THREE.BoxGeometry(1.12, 0.2, 0.08)), carbonMat);
  grille.position.set(0, 0.36, 2.22);
  root.add(grille);

  const hlMat = track(
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 2.2 })
  );
  const tlMat = track(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 })
  );
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.08, 0.1)), hlMat);
    hl.position.set(side * 0.68, 0.5, 2.18);
    hl.rotation.y = side * -0.2;
    const tl = new THREE.Mesh(track(new THREE.BoxGeometry(0.4, 0.075, 0.08)), tlMat);
    tl.position.set(side * 0.64, 0.6, -2.22);
    root.add(hl, tl);
  }

  // FIA Safety Car Amber + Green Aerodynamic Roof Lightbar
  const strobeAMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 3.2,
    })
  );
  const strobeBMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 0.4,
    })
  );
  const barGeo = track(new THREE.BoxGeometry(0.62, 0.11, 0.24));
  const strobeA = new THREE.Mesh(barGeo, strobeAMat);
  strobeA.position.set(0.34, 1.2, -0.22);
  const strobeB = new THREE.Mesh(barGeo, strobeBMat);
  strobeB.position.set(-0.34, 1.2, -0.22);
  root.add(strobeA, strobeB);

  const wheels: THREE.Object3D[] = [];
  for (const [wx, wz] of [
    [0.95, 1.42],
    [-0.95, 1.42],
    [0.95, -1.42],
    [-0.95, -1.42],
  ]) {
    wheels.push(addWheel(root, wx, 0.35, wz, 0.35, 0.3, tireMat, rimMat, caliperMat, disposables));
  }

  return {
    root,
    wheels,
    strobeA,
    strobeB,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

/**
 * Team Emergenza Sanitaria (Ambulanza MSA Circuito 118 con barella e croce medica 3D)
 */
export function buildAmbulance3D(): SupportVehicleRig {
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const whiteMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      metalness: 0.25,
      roughness: 0.2,
      clearcoat: 0.95,
    })
  );
  const limeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      emissive: 0x365314,
      emissiveIntensity: 0.25,
      roughness: 0.3,
    })
  );
  const redCrossMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.3,
      roughness: 0.28,
    })
  );
  const darkMat = track(
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.65, metalness: 0.3 })
  );
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.06,
      metalness: 0.15,
      transparent: true,
      opacity: 0.84,
      clearcoat: 1.0,
    })
  );
  const tireMat = track(new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.86 }));
  const rimMat = track(
    new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.88, roughness: 0.2 })
  );
  const hlMat = track(
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 2.2 })
  );
  const tlMat = track(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 })
  );

  // Sculpted High-Roof Ambulance Sprinter Silhouette
  const ambShape = new THREE.Shape();
  ambShape.moveTo(-2.55, 0.32);
  ambShape.lineTo(-2.5, 2.38);
  ambShape.lineTo(0.85, 2.38);
  ambShape.quadraticCurveTo(1.52, 2.15, 1.98, 1.48);
  ambShape.quadraticCurveTo(2.45, 1.32, 2.58, 0.72);
  ambShape.lineTo(2.58, 0.32);
  ambShape.lineTo(-2.55, 0.32);
  const bodyGeo = track(createExtrudedProfile(ambShape, 2.08, 0.07, 0.06, 3));
  const body = new THREE.Mesh(bodyGeo, whiteMat);
  body.castShadow = true;
  root.add(body);

  // Front Windshield + Side Cab Windows
  const ws = new THREE.Mesh(track(new THREE.BoxGeometry(1.76, 0.72, 0.08)), glassMat);
  ws.position.set(0, 1.78, 1.72);
  ws.rotation.x = -0.45;
  root.add(ws);

  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.56, 0.92)), glassMat);
    sw.position.set(side * 1.04, 1.72, 1.32);
    const mirror = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 0.24, 0.08)), darkMat);
    mirror.position.set(side * 1.15, 1.56, 1.76);
    const stripe = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.24, 4.9)), limeMat);
    stripe.position.set(side * 1.05, 0.88, -0.02);
    // Red Medical Cross on Side Doors
    const crossV = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.52, 0.16)), redCrossMat);
    crossV.position.set(side * 1.05, 1.62, -0.85);
    const crossH = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.16, 0.52)), redCrossMat);
    crossH.position.set(side * 1.05, 1.62, -0.85);
    root.add(sw, mirror, stripe, crossV, crossH);
  }

  // Roof Medical Cross + Rear Step & Bumpers
  const rCrossV = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.05, 0.78)), redCrossMat);
  rCrossV.position.set(0, 2.41, -0.95);
  const rCrossH = new THREE.Mesh(track(new THREE.BoxGeometry(0.78, 0.05, 0.22)), redCrossMat);
  rCrossH.position.set(0, 2.41, -0.95);
  const frontBumper = new THREE.Mesh(track(new THREE.BoxGeometry(2.08, 0.28, 0.22)), darkMat);
  frontBumper.position.set(0, 0.44, 2.54);
  const rearStep = new THREE.Mesh(track(new THREE.BoxGeometry(2.06, 0.2, 0.28)), limeMat);
  rearStep.position.set(0, 0.36, -2.58);
  root.add(rCrossV, rCrossH, frontBumper, rearStep);

  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.12, 0.08)), hlMat);
    hl.position.set(side * 0.72, 0.8, 2.54);
    const tl = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.42, 0.08)), tlMat);
    tl.position.set(side * 0.84, 0.96, -2.54);
    root.add(hl, tl);
  }

  // Blue / Ice-White Emergency Strobe Bar (Front & Rear)
  const strobeAMat = track(
    new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x3b82f6, emissiveIntensity: 3.4 })
  );
  const strobeBMat = track(
    new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x38bdf8, emissiveIntensity: 0.4 })
  );
  const barGeo = track(new THREE.BoxGeometry(0.76, 0.14, 0.26));
  const strobeA = new THREE.Mesh(barGeo, strobeAMat);
  strobeA.position.set(0.42, 2.46, 0.65);
  const strobeB = new THREE.Mesh(barGeo, strobeBMat);
  strobeB.position.set(-0.42, 2.46, 0.65);
  root.add(strobeA, strobeB);

  const wheels: THREE.Object3D[] = [];
  for (const [wx, wz] of [
    [1.02, 1.56],
    [-1.02, 1.56],
    [1.02, -1.52],
    [-1.02, -1.52],
  ]) {
    wheels.push(addWheel(root, wx, 0.42, wz, 0.42, 0.3, tireMat, rimMat, redCrossMat, disposables));
  }

  return {
    root,
    wheels,
    strobeA,
    strobeB,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

/**
 * Team Meccanici (Furgone Officina Mobile Paddock con gomme di scorta, compressore e fari lavoro)
 */
export function buildMechanicVan3D(): SupportVehicleRig {
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const slateMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.52,
      roughness: 0.24,
      clearcoat: 0.9,
    })
  );
  const racingRedMat = track(
    new THREE.MeshStandardMaterial({ color: 0xe10600, roughness: 0.3, metalness: 0.25 })
  );
  const steelMat = track(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.24 })
  );
  const darkMat = track(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72, metalness: 0.2 })
  );
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x090d16,
      roughness: 0.06,
      transparent: true,
      opacity: 0.84,
      clearcoat: 1.0,
    })
  );
  const tireMat = track(new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.86 }));
  const rimMat = track(
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.82, roughness: 0.22 })
  );
  const hlMat = track(
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef3c7, emissiveIntensity: 2.2 })
  );
  const tlMat = track(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 })
  );

  const vanShape = new THREE.Shape();
  vanShape.moveTo(-2.45, 0.3);
  vanShape.lineTo(-2.4, 2.15);
  vanShape.lineTo(0.75, 2.15);
  vanShape.quadraticCurveTo(1.38, 1.98, 1.86, 1.38);
  vanShape.quadraticCurveTo(2.34, 1.24, 2.46, 0.7);
  vanShape.lineTo(2.46, 0.3);
  vanShape.lineTo(-2.45, 0.3);
  const vanGeo = track(createExtrudedProfile(vanShape, 2.02, 0.07, 0.06, 3));
  const body = new THREE.Mesh(vanGeo, slateMat);
  body.castShadow = true;
  root.add(body);

  const ws = new THREE.Mesh(track(new THREE.BoxGeometry(1.7, 0.66, 0.08)), glassMat);
  ws.position.set(0, 1.62, 1.6);
  ws.rotation.x = -0.45;
  root.add(ws);

  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 0.52, 0.88)), glassMat);
    sw.position.set(side * 1.01, 1.58, 1.22);
    const stripe = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.22, 4.7)), racingRedMat);
    stripe.position.set(side * 1.02, 0.86, 0);
    const toolCabinet = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.88, 1.65)), steelMat);
    toolCabinet.position.set(side * 1.01, 1.46, -0.85);
    root.add(sw, stripe, toolCabinet);
  }

  // Roof Workshop Rack + Spare Tires & Fuel/Oil Drum Props
  const rack = new THREE.Mesh(track(new THREE.BoxGeometry(1.68, 0.07, 2.55)), steelMat);
  rack.position.set(0, 2.19, -0.85);
  root.add(rack);

  for (const rz of [-1.6, -1.05]) {
    const spareTire = new THREE.Mesh(track(new THREE.TorusGeometry(0.28, 0.11, 10, 18)), tireMat);
    spareTire.rotation.x = Math.PI / 2;
    spareTire.position.set(-0.35, 2.33, rz);
    root.add(spareTire);
  }
  const compressor = new THREE.Mesh(track(new THREE.CylinderGeometry(0.18, 0.18, 0.72, 12)), racingRedMat);
  compressor.rotation.z = Math.PI / 2;
  compressor.position.set(0.36, 2.36, -1.35);
  root.add(compressor);

  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.12, 0.08)), hlMat);
    hl.position.set(side * 0.7, 0.76, 2.42);
    const tl = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.36, 0.08)), tlMat);
    tl.position.set(side * 0.82, 0.9, -2.44);
    root.add(hl, tl);
  }

  const frontBumper = new THREE.Mesh(track(new THREE.BoxGeometry(2.04, 0.26, 0.2)), darkMat);
  frontBumper.position.set(0, 0.42, 2.44);
  root.add(frontBumper);

  // Amber Service Warning Bar
  const strobeAMat = track(
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 3.2 })
  );
  const strobeBMat = track(
    new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 0.4 })
  );
  const barGeo = track(new THREE.BoxGeometry(0.68, 0.12, 0.24));
  const strobeA = new THREE.Mesh(barGeo, strobeAMat);
  strobeA.position.set(0.38, 2.23, 0.56);
  const strobeB = new THREE.Mesh(barGeo, strobeBMat);
  strobeB.position.set(-0.38, 2.23, 0.56);
  root.add(strobeA, strobeB);

  const wheels: THREE.Object3D[] = [];
  for (const [wx, wz] of [
    [0.98, 1.5],
    [-0.98, 1.5],
    [0.98, -1.48],
    [-0.98, -1.48],
  ]) {
    wheels.push(addWheel(root, wx, 0.4, wz, 0.4, 0.3, tireMat, rimMat, racingRedMat, disposables));
  }

  return {
    root,
    wheels,
    strobeA,
    strobeB,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

