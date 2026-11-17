import * as THREE from 'three';
import { ENGINE_ARCHITECTURES } from '../data/catalog';
import { BodyStyle, CarClass, CarTuning, DamageState, PowertrainType } from '../types/game';

export interface CarMeshRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  frontAeroGroup: THREE.Group;
  rearAeroGroup: THREE.Group;
  wheels: {
    fl: THREE.Group;
    fr: THREE.Group;
    rl: THREE.Group;
    rr: THREE.Group;
  };
  wheelSpinMeshes: THREE.Object3D[];
  brakeDiscs: THREE.Mesh[];
  drsFlap: THREE.Mesh | null;
  exhaustFlame: THREE.Mesh | null;
  paintMaterials: THREE.MeshPhysicalMaterial[];
  dispose: () => void;
}

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createCarbonTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#14171d';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      ctx.fillStyle = (x + y) % 16 === 0 ? '#222833' : '#101318';
      ctx.fillRect(x, y, 4, 4);
      ctx.fillStyle = (x + y) % 16 === 0 ? '#101318' : '#1c222d';
      ctx.fillRect(x + 4, y + 4, 4, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createTireSidewallTexture(
  maxAnisotropy: number,
  stripeColor: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#14161a';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle tread grain ring
  ctx.strokeStyle = '#1f232b';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(128, 128, 110, 0, Math.PI * 2);
  ctx.stroke();

  // Compound sidewall stripe (Red for ICE/Hybrid, Cyan for EV, Ice-Blue for H2)
  ctx.strokeStyle = stripeColor;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0.25, Math.PI - 0.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 128, 92, Math.PI + 0.25, Math.PI * 2 - 0.25);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Extrudes a 2D side silhouette (sx = world +Z forward, sy = world +Y up)
 * centered symmetrically along world X in [-width/2, +width/2].
 */
function createSideProfileGeometry(
  shape: THREE.Shape,
  width: number,
  bevelThickness = 0.04,
  bevelSize = 0.035,
  bevelSegments = 3,
  curveSegments = 14
): THREE.ExtrudeGeometry {
  const innerDepth = Math.max(0.02, width - bevelThickness * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: innerDepth,
    bevelEnabled: bevelThickness > 0 && bevelSize > 0,
    bevelThickness,
    bevelSize,
    bevelSegments,
    curveSegments,
  });
  geo.translate(0, 0, -innerDepth / 2);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export function buildCarModel3D(
  bodyStyle: BodyStyle,
  carClass: CarClass,
  tuning: CarTuning,
  maxAnisotropy = 4,
  explicitPowertrain?: PowertrainType
): CarMeshRig {
  const powertrain: PowertrainType =
    explicitPowertrain ??
    ENGINE_ARCHITECTURES[tuning.engineArch]?.powertrainType ??
    'hybrid';

  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  const frontAeroGroup = new THREE.Group();
  const rearAeroGroup = new THREE.Group();
  root.add(chassisGroup);
  chassisGroup.add(frontAeroGroup);
  chassisGroup.add(rearAeroGroup);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const stripeHex =
    powertrain === 'electric'
      ? '#22d3ee'
      : powertrain === 'hydrogen'
      ? '#7dd3fc'
      : '#e10600';

  const carbonTex = track(createCarbonTexture(maxAnisotropy));
  const sidewallTex = track(createTireSidewallTexture(maxAnisotropy, stripeHex));

  const finishProps =
    tuning.finish === 'chrome'
      ? { metalness: 0.94, roughness: 0.11, clearcoat: 1.0, clearcoatRoughness: 0.05 }
      : tuning.finish === 'matte_carbon'
      ? { metalness: 0.24, roughness: 0.64, clearcoat: 0.12, clearcoatRoughness: 0.6 }
      : { metalness: 0.68, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.08 };

  const primaryMat = track(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(tuning.primaryColor),
      ...finishProps,
    })
  );
  const secondaryMat = track(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(tuning.secondaryColor),
      metalness: 0.48,
      roughness: 0.3,
      clearcoat: 0.78,
    })
  );
  const carbonMat = track(
    new THREE.MeshStandardMaterial({
      map: carbonTex,
      roughness: 0.45,
      metalness: 0.26,
    })
  );
  const titaniumMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xa1a8b3,
      metalness: 0.92,
      roughness: 0.2,
      anisotropy: 0.75,
    })
  );
  const rubberMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x15171c,
      roughness: 0.86,
      metalness: 0.05,
    })
  );
  const rimMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xd4d8e0,
      metalness: 0.9,
      roughness: 0.18,
      clearcoat: 0.5,
    })
  );
  const caliperMat = track(
    new THREE.MeshStandardMaterial({
      color:
        powertrain === 'electric'
          ? 0x06b6d4
          : powertrain === 'hydrogen'
          ? 0x38bdf8
          : 0xef4444,
      metalness: 0.45,
      roughness: 0.3,
    })
  );
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x09101c,
      metalness: 0.14,
      roughness: 0.06,
      clearcoat: 1.0,
      opacity: 0.84,
      transparent: true,
    })
  );
  const powertrainGlowMat = track(
    new THREE.MeshStandardMaterial({
      color: powertrain === 'electric' ? 0x22d3ee : powertrain === 'hydrogen' ? 0x7dd3fc : 0xef4444,
      emissive:
        powertrain === 'electric'
          ? 0x06b6d4
          : powertrain === 'hydrogen'
          ? 0x38bdf8
          : 0xb91c1c,
      emissiveIntensity: powertrain === 'electric' || powertrain === 'hydrogen' ? 1.5 : 0.4,
      roughness: 0.25,
    })
  );
  const headlightMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 2.2,
    })
  );
  const taillightMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xef4444,
      emissiveIntensity: 2.0,
    })
  );

  const brakeDiscs: THREE.Mesh[] = [];
  const wheelSpinMeshes: THREE.Object3D[] = [];
  let drsFlap: THREE.Mesh | null = null;
  let exhaustFlame: THREE.Mesh | null = null;

  // Sculpted Racing Wheel with Lathe Tire Profile, 10-Spoke Alloy Rim, Brake Rotor & Caliper
  const createWheel = (radius: number, width: number, isLeftSide: boolean): THREE.Group => {
    const steerPivot = new THREE.Group();
    const spinGroup = new THREE.Group();
    steerPivot.add(spinGroup);
    wheelSpinMeshes.push(spinGroup);

    const halfW = width * 0.5;
    const lathePts = [
      new THREE.Vector2(radius * 0.58, -halfW * 0.92),
      new THREE.Vector2(radius * 0.9, -halfW),
      new THREE.Vector2(radius, -halfW * 0.78),
      new THREE.Vector2(radius, halfW * 0.78),
      new THREE.Vector2(radius * 0.9, halfW),
      new THREE.Vector2(radius * 0.58, halfW * 0.92),
    ];
    const tireGeo = track(new THREE.LatheGeometry(lathePts, 28));
    tireGeo.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeo, rubberMat);
    tireMesh.castShadow = true;
    tireMesh.receiveShadow = true;
    spinGroup.add(tireMesh);

    const sidewallGeo = track(
      new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, width + 0.008, 24)
    );
    sidewallGeo.rotateZ(Math.PI / 2);
    const sidewallMat = track(
      new THREE.MeshStandardMaterial({ map: sidewallTex, roughness: 0.75, metalness: 0.06 })
    );
    const sidewallMesh = new THREE.Mesh(sidewallGeo, sidewallMat);
    spinGroup.add(sidewallMesh);

    // Deep-dish barrel rim
    const barrelGeo = track(
      new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width * 0.92, 20, 1, true)
    );
    barrelGeo.rotateZ(Math.PI / 2);
    const barrelMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x272c36,
        metalness: 0.82,
        roughness: 0.25,
        side: THREE.DoubleSide,
      })
    );
    spinGroup.add(new THREE.Mesh(barrelGeo, barrelMat));

    const hubCapGeo = track(
      new THREE.CylinderGeometry(radius * 0.2, radius * 0.22, width * 0.96, 12)
    );
    hubCapGeo.rotateZ(Math.PI / 2);
    spinGroup.add(new THREE.Mesh(hubCapGeo, secondaryMat));

    // Center-lock nut
    const nutGeo = track(
      new THREE.CylinderGeometry(radius * 0.08, radius * 0.09, width + 0.02, 6)
    );
    nutGeo.rotateZ(Math.PI / 2);
    spinGroup.add(new THREE.Mesh(nutGeo, caliperMat));

    // 5 Dual Spokes (10-spoke motorsport star)
    const sideSign = isLeftSide ? 1 : -1;
    for (let s = 0; s < 5; s++) {
      const angle = (s / 5) * Math.PI * 2;
      for (const offset of [-0.04, 0.04]) {
        const spokeGeo = track(new THREE.BoxGeometry(0.036, radius * 0.44, 0.026));
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        const rMid = radius * 0.37;
        spoke.position.set(
          sideSign * (width * 0.34),
          Math.cos(angle + offset) * rMid,
          Math.sin(angle + offset) * rMid
        );
        spoke.rotation.x = -(angle + offset);
        spinGroup.add(spoke);
      }
    }

    // Glowing Carbon-Ceramic Brake Rotor
    const discGeo = track(new THREE.CylinderGeometry(radius * 0.47, radius * 0.47, 0.034, 22));
    discGeo.rotateZ(Math.PI / 2);
    const discMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x3f3f46,
        emissive: 0xff4500,
        emissiveIntensity: 0,
        metalness: 0.68,
        roughness: 0.36,
      })
    );
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.x = sideSign * (width * 0.06);
    steerPivot.add(disc);
    brakeDiscs.push(disc);

    // 6-Piston Brake Caliper
    const calGeo = track(new THREE.BoxGeometry(0.08, radius * 0.28, radius * 0.16));
    const caliper = new THREE.Mesh(calGeo, caliperMat);
    caliper.position.set(sideSign * (width * 0.07), 0.04, -radius * 0.36);
    steerPivot.add(caliper);

    return steerPivot;
  };

  const addSideMirrors = (xPos: number, yPos: number, zPos: number) => {
    for (const side of [-1, 1]) {
      const stalkGeo = track(new THREE.BoxGeometry(0.16, 0.028, 0.04));
      const stalk = new THREE.Mesh(stalkGeo, carbonMat);
      stalk.position.set(side * (xPos - 0.06), yPos - 0.02, zPos);
      stalk.rotation.z = side * 0.24;
      chassisGroup.add(stalk);

      const capGeo = track(new THREE.BoxGeometry(0.14, 0.068, 0.11));
      const cap = new THREE.Mesh(capGeo, primaryMat);
      cap.position.set(side * (xPos + 0.02), yPos + 0.01, zPos);
      chassisGroup.add(cap);
    }
  };

  const addRearDiffuserStrakes = (zRear: number, width: number, yFloor: number) => {
    const baseGeo = track(new THREE.BoxGeometry(width, 0.05, 0.42));
    const base = new THREE.Mesh(baseGeo, carbonMat);
    base.position.set(0, yFloor + 0.04, zRear);
    base.rotation.x = 0.22;
    chassisGroup.add(base);

    for (let i = -3; i <= 3; i++) {
      const strakeGeo = track(new THREE.BoxGeometry(0.025, 0.16, 0.38));
      const strake = new THREE.Mesh(strakeGeo, carbonMat);
      strake.position.set((i / 3) * (width * 0.42), yFloor + 0.08, zRear - 0.04);
      chassisGroup.add(strake);
    }

    // Center FIA Rain Light
    const rainLightGeo = track(new THREE.BoxGeometry(0.065, 0.12, 0.04));
    const rainLight = new THREE.Mesh(rainLightGeo, taillightMat);
    rainLight.position.set(0, yFloor + 0.22, zRear - 0.18);
    chassisGroup.add(rainLight);
  };

  const isOpenWheel = bodyStyle === 'formula' || bodyStyle === 'formula_e';

  if (isOpenWheel) {
    const isFE = bodyStyle === 'formula_e';
    const scale = carClass === 'F1' ? 1.04 : carClass === 'F2' ? 0.99 : 0.93;
    chassisGroup.scale.setScalar(scale);

    // 1. Sculpted Extruded Monocoque Tub + Tapered Needle Nose
    const tubShape = new THREE.Shape();
    tubShape.moveTo(-1.82, 0.16);
    tubShape.lineTo(-1.62, 0.56);
    tubShape.quadraticCurveTo(-0.95, 0.72, -0.2, 0.88);
    tubShape.lineTo(0.08, 0.88);
    tubShape.quadraticCurveTo(0.18, 0.62, 0.22, 0.56);
    tubShape.lineTo(0.65, 0.54);
    tubShape.quadraticCurveTo(1.38, 0.44, 2.28, 0.22);
    tubShape.lineTo(2.34, 0.16);
    tubShape.lineTo(-1.82, 0.16);

    const tubGeo = track(createSideProfileGeometry(tubShape, 0.56, 0.06, 0.05, 3, 14));
    const tub = new THREE.Mesh(tubGeo, primaryMat);
    tub.castShadow = true;
    tub.receiveShadow = true;
    chassisGroup.add(tub);

    // Nosecone Upper Accent Stripe
    const noseStripeGeo = track(new THREE.BoxGeometry(0.24, 0.04, 1.48));
    const noseStripe = new THREE.Mesh(noseStripeGeo, secondaryMat);
    noseStripe.position.set(0, 0.41, 1.44);
    noseStripe.rotation.x = 0.2;
    chassisGroup.add(noseStripe);

    // 2. Sculpted Carbon Underfloor & Bargeboards
    const floorShape = new THREE.Shape();
    floorShape.moveTo(-1.85, 0.12);
    floorShape.lineTo(1.15, 0.12);
    floorShape.lineTo(1.15, 0.16);
    floorShape.lineTo(-1.85, 0.17);
    floorShape.lineTo(-1.85, 0.12);
    const floorGeo = track(createSideProfileGeometry(floorShape, 1.66, 0.015, 0.015, 1, 6));
    const floor = new THREE.Mesh(floorGeo, carbonMat);
    floor.castShadow = true;
    floor.receiveShadow = true;
    chassisGroup.add(floor);

    // 3. Sculpted Undercut Sidepods (Extruded Swept Profile)
    const podShape = new THREE.Shape();
    podShape.moveTo(-1.42, 0.2);
    podShape.quadraticCurveTo(-0.85, 0.24, -0.3, 0.22);
    podShape.lineTo(0.62, 0.18);
    podShape.lineTo(0.72, 0.48);
    podShape.quadraticCurveTo(0.1, 0.52, -0.55, 0.46);
    podShape.quadraticCurveTo(-1.15, 0.38, -1.42, 0.28);
    podShape.lineTo(-1.42, 0.2);

    const podGeo = track(createSideProfileGeometry(podShape, 0.44, 0.045, 0.04, 3, 12));
    for (const side of [-1, 1]) {
      const pod = new THREE.Mesh(podGeo, primaryMat);
      pod.position.set(side * 0.52, 0, 0);
      pod.castShadow = true;
      chassisGroup.add(pod);

      // Carbon intake or High-Voltage EV Cooling Louver
      const intakeGeo = track(new THREE.BoxGeometry(0.32, 0.18, 0.08));
      const intake = new THREE.Mesh(
        intakeGeo,
        powertrain === 'electric' ? powertrainGlowMat : carbonMat
      );
      intake.position.set(side * 0.54, 0.35, 0.69);
      chassisGroup.add(intake);

      // Sidepod aerodynamic livery fin
      const railGeo = track(new THREE.BoxGeometry(0.04, 0.06, 1.42));
      const rail = new THREE.Mesh(
        railGeo,
        powertrain === 'electric' || powertrain === 'hydrogen' ? powertrainGlowMat : secondaryMat
      );
      rail.position.set(side * 0.77, 0.36, -0.2);
      chassisGroup.add(rail);
    }

    // 4. Dorsal Engine Cover, Airbox / Hydrogen Cryo Tank & Shark Fin
    if (powertrain === 'hydrogen') {
      // Cryogenic Cylindrical Dorsal H2 Tank Cowl + Titanium Straps
      const h2TankGeo = track(new THREE.CylinderGeometry(0.17, 0.19, 1.28, 16));
      h2TankGeo.rotateX(Math.PI / 2);
      const h2Tank = new THREE.Mesh(h2TankGeo, secondaryMat);
      h2Tank.position.set(0, 0.78, -0.58);
      h2Tank.castShadow = true;
      chassisGroup.add(h2Tank);

      for (const tz of [-0.95, -0.58, -0.22]) {
        const bandGeo = track(new THREE.TorusGeometry(0.185, 0.018, 8, 20));
        const band = new THREE.Mesh(bandGeo, powertrainGlowMat);
        band.position.set(0, 0.78, tz);
        chassisGroup.add(band);
      }
    } else if (powertrain !== 'electric') {
      // F1 Airbox Snorkel & T-Cam
      const scoopGeo = track(new THREE.CylinderGeometry(0.14, 0.19, 0.42, 12));
      scoopGeo.rotateX(Math.PI / 2);
      const scoop = new THREE.Mesh(scoopGeo, secondaryMat);
      scoop.position.set(0, 0.88, -0.02);
      chassisGroup.add(scoop);

      const mouthGeo = track(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12));
      mouthGeo.rotateX(Math.PI / 2);
      const mouth = new THREE.Mesh(mouthGeo, carbonMat);
      mouth.position.set(0, 0.89, 0.18);
      chassisGroup.add(mouth);
    }

    // Shark fin + Broadcast T-Cam
    const sharkGeo = track(new THREE.BoxGeometry(0.035, 0.26, 1.05));
    const shark = new THREE.Mesh(sharkGeo, secondaryMat);
    shark.position.set(0, 0.82, -0.92);
    chassisGroup.add(shark);

    const tCamPoleGeo = track(new THREE.BoxGeometry(0.04, 0.14, 0.06));
    const tCamPole = new THREE.Mesh(tCamPoleGeo, carbonMat);
    tCamPole.position.set(0, 1.04, -0.05);
    const tCamBarGeo = track(new THREE.BoxGeometry(0.28, 0.035, 0.05));
    const tCamBar = new THREE.Mesh(tCamBarGeo, carbonMat);
    tCamBar.position.set(0, 1.11, -0.05);
    chassisGroup.add(tCamPole, tCamBar);

    // 5. Open Cockpit, Racing Seat, Steering Wheel, Driver Helmet & TubeGeometry Halo
    const cockpitRecessGeo = track(new THREE.BoxGeometry(0.42, 0.08, 0.65));
    const cockpitRecess = new THREE.Mesh(cockpitRecessGeo, carbonMat);
    cockpitRecess.position.set(0, 0.56, 0.34);
    chassisGroup.add(cockpitRecess);

    const steeringGeo = track(new THREE.BoxGeometry(0.22, 0.11, 0.035));
    const steering = new THREE.Mesh(steeringGeo, carbonMat);
    steering.position.set(0, 0.63, 0.56);
    steering.rotation.x = -0.35;
    chassisGroup.add(steering);

    const helmetGeo = track(new THREE.SphereGeometry(0.155, 20, 18));
    const helmet = new THREE.Mesh(helmetGeo, secondaryMat);
    helmet.position.set(0, 0.67, 0.24);
    chassisGroup.add(helmet);

    const visorGeo = track(new THREE.CylinderGeometry(0.158, 0.158, 0.065, 16, 1, false, -0.8, 1.6));
    const visor = new THREE.Mesh(visorGeo, glassMat);
    visor.position.set(0, 0.68, 0.25);
    chassisGroup.add(visor);

    // TubeGeometry Titanium Halo Arch + Center Pylon
    const haloCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.26, 0.66, 0.06),
      new THREE.Vector3(-0.24, 0.78, 0.36),
      new THREE.Vector3(0, 0.8, 0.62),
      new THREE.Vector3(0.24, 0.78, 0.36),
      new THREE.Vector3(0.26, 0.66, 0.06),
    ]);
    const haloTubeGeo = track(new THREE.TubeGeometry(haloCurve, 28, 0.026, 10, false));
    chassisGroup.add(new THREE.Mesh(haloTubeGeo, titaniumMat));

    const pylonCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.8, 0.62),
      new THREE.Vector3(0, 0.68, 0.69),
      new THREE.Vector3(0, 0.53, 0.76),
    ]);
    const pylonGeo = track(new THREE.TubeGeometry(pylonCurve, 10, 0.024, 8, false));
    chassisGroup.add(new THREE.Mesh(pylonGeo, titaniumMat));

    addSideMirrors(0.46, 0.66, 0.58);

    // Formula-E Aerodynamic Wheel Fenders / Shrouds
    if (isFE) {
      for (const [fx, fz, r] of [
        [0.86, 1.48, 0.39],
        [-0.86, 1.48, 0.39],
        [0.86, -1.34, 0.41],
        [-0.86, -1.34, 0.41],
      ]) {
        const fenderGeo = track(
          new THREE.CylinderGeometry(r, r, 0.38, 18, 1, false, -Math.PI * 0.45, Math.PI * 0.9)
        );
        fenderGeo.rotateZ(Math.PI / 2);
        const fender = new THREE.Mesh(fenderGeo, primaryMat);
        fender.position.set(fx, 0.36, fz);
        fender.castShadow = true;
        chassisGroup.add(fender);
      }
    }

    // 6. Multi-Element Front Wing Assembly (Damageable)
    const fwMainGeo = track(new THREE.BoxGeometry(1.94, 0.036, 0.38));
    const fwMain = new THREE.Mesh(fwMainGeo, carbonMat);
    fwMain.position.set(0, 0.16, 2.38);
    fwMain.castShadow = true;
    frontAeroGroup.add(fwMain);

    for (let cascade = 0; cascade < 2; cascade++) {
      const flapGeo = track(new THREE.BoxGeometry(1.86 - cascade * 0.12, 0.026, 0.15));
      const flap = new THREE.Mesh(flapGeo, cascade === 0 ? primaryMat : secondaryMat);
      flap.position.set(0, 0.21 + cascade * 0.045, 2.26 - cascade * 0.11);
      flap.rotation.x = -THREE.MathUtils.degToRad(tuning.frontWingDeg * 0.8);
      frontAeroGroup.add(flap);
    }

    const endplateShape = new THREE.Shape();
    endplateShape.moveTo(2.05, 0.13);
    endplateShape.lineTo(2.58, 0.13);
    endplateShape.lineTo(2.54, 0.26);
    endplateShape.quadraticCurveTo(2.3, 0.38, 2.02, 0.36);
    endplateShape.lineTo(2.05, 0.13);
    const endplateGeo = track(createSideProfileGeometry(endplateShape, 0.04, 0.008, 0.008, 1, 8));
    for (const side of [-1, 1]) {
      const ep = new THREE.Mesh(endplateGeo, secondaryMat);
      ep.position.set(side * 0.97, 0, 0);
      frontAeroGroup.add(ep);
    }

    // 7. Swan-Neck Rear Wing Assembly + Active DRS Flap (Damageable)
    if (isFE) {
      // Formula-E Twin Angled Rear Aero Wings
      for (const side of [-1, 1]) {
        const finWingGeo = track(new THREE.BoxGeometry(0.55, 0.045, 0.32));
        const finWing = new THREE.Mesh(finWingGeo, primaryMat);
        finWing.position.set(side * 0.45, 0.84, -1.78);
        finWing.rotation.z = side * -0.28;
        finWing.rotation.x = -THREE.MathUtils.degToRad(tuning.rearWingDeg * 0.6);
        rearAeroGroup.add(finWing);
      }
      const drsGeo = track(new THREE.BoxGeometry(1.1, 0.036, 0.16));
      drsFlap = new THREE.Mesh(drsGeo, secondaryMat);
      drsFlap.position.set(0, 0.88, -1.86);
      rearAeroGroup.add(drsFlap);
    } else {
      for (const side of [-1, 1]) {
        const strutCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.18, 0.44, -1.66),
          new THREE.Vector3(side * 0.18, 0.72, -1.74),
          new THREE.Vector3(side * 0.18, 0.9, -1.82),
        ]);
        const strutGeo = track(new THREE.TubeGeometry(strutCurve, 12, 0.022, 6, false));
        rearAeroGroup.add(new THREE.Mesh(strutGeo, carbonMat));

        const rwEndShape = new THREE.Shape();
        rwEndShape.moveTo(-2.04, 0.56);
        rwEndShape.lineTo(-1.62, 0.56);
        rwEndShape.lineTo(-1.58, 0.98);
        rwEndShape.lineTo(-2.06, 0.98);
        rwEndShape.lineTo(-2.04, 0.56);
        const rwEndGeo = track(createSideProfileGeometry(rwEndShape, 0.036, 0.008, 0.008, 1, 6));
        const rwEnd = new THREE.Mesh(rwEndGeo, secondaryMat);
        rwEnd.position.set(side * 0.6, 0, 0);
        rearAeroGroup.add(rwEnd);
      }

      const rwMainGeo = track(new THREE.BoxGeometry(1.18, 0.045, 0.26));
      const rwMain = new THREE.Mesh(rwMainGeo, carbonMat);
      rwMain.position.set(0, 0.84, -1.82);
      rwMain.castShadow = true;
      rearAeroGroup.add(rwMain);

      const drsGeo = track(new THREE.BoxGeometry(1.16, 0.036, 0.17));
      drsFlap = new THREE.Mesh(drsGeo, primaryMat);
      drsFlap.position.set(0, 0.94, -1.88);
      drsFlap.rotation.x = -THREE.MathUtils.degToRad(tuning.rearWingDeg * 0.8);
      rearAeroGroup.add(drsFlap);
    }

    addRearDiffuserStrakes(-1.82, 1.15, 0.12);

    // Exhaust Pipe & Flame / Electric Diffuser Pulse
    if (powertrain !== 'electric') {
      const exhaustGeo = track(new THREE.CylinderGeometry(0.055, 0.065, 0.28, 14));
      exhaustGeo.rotateX(Math.PI / 2);
      const exhaust = new THREE.Mesh(exhaustGeo, titaniumMat);
      exhaust.position.set(0, 0.42, -1.78);
      chassisGroup.add(exhaust);

      const flameColor = powertrain === 'hydrogen' ? 0x7dd3fc : 0x38bdf8;
      const flameMat = track(
        new THREE.MeshBasicMaterial({ color: flameColor, transparent: true, opacity: 0 })
      );
      const flameGeo = track(new THREE.ConeGeometry(0.055, 0.44, 10));
      flameGeo.rotateX(-Math.PI / 2);
      exhaustFlame = new THREE.Mesh(flameGeo, flameMat);
      exhaustFlame.position.set(0, 0.42, -2.02);
      chassisGroup.add(exhaustFlame);
    } else {
      // Subtle cyan kinetic diffuser pulse bar for Electric open-wheel
      const pulseMat = track(
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0 })
      );
      const pulseGeo = track(new THREE.BoxGeometry(0.85, 0.045, 0.22));
      exhaustFlame = new THREE.Mesh(pulseGeo, pulseMat);
      exhaustFlame.position.set(0, 0.22, -1.94);
      chassisGroup.add(exhaustFlame);
    }

    // 8. Realistic Suspension Double-Wishbone A-Arms & 4 Wide Slick Wheels
    const fl = createWheel(0.34, 0.34, true);
    fl.position.set(0.86, 0.34, 1.48);
    const fr = createWheel(0.34, 0.34, false);
    fr.position.set(-0.86, 0.34, 1.48);
    const rl = createWheel(0.36, 0.42, true);
    rl.position.set(0.86, 0.36, -1.34);
    const rr = createWheel(0.36, 0.42, false);
    rr.position.set(-0.86, 0.36, -1.34);
    chassisGroup.add(fl, fr, rl, rr);

    for (const side of [-1, 1]) {
      for (const wz of [1.48, -1.34]) {
        for (const zSpread of [-0.14, 0.14]) {
          const armCurve = new THREE.LineCurve3(
            new THREE.Vector3(side * 0.24, 0.34, wz + zSpread),
            new THREE.Vector3(side * 0.78, 0.34, wz)
          );
          const armGeo = track(new THREE.TubeGeometry(armCurve, 2, 0.018, 6, false));
          chassisGroup.add(new THREE.Mesh(armGeo, carbonMat));
        }
      }
    }

    return {
      root,
      chassisGroup,
      frontAeroGroup,
      rearAeroGroup,
      wheels: { fl, fr, rl, rr },
      wheelSpinMeshes,
      brakeDiscs,
      drsFlap,
      exhaustFlame,
      paintMaterials: [primaryMat, secondaryMat],
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  } else {
    // Sculpted Closed-Cockpit GT3 / LMH / Hypercar Prototypes
    const isLmh = bodyStyle === 'lmh';
    const isHyper = bodyStyle === 'hypercar';

    // 1. Sculpted Main Body Side Silhouette (Beveled ExtrudeGeometry)
    const bodyShape = new THREE.Shape();
    if (isLmh || isHyper) {
      bodyShape.moveTo(-2.22, 0.18);
      bodyShape.lineTo(-2.14, 0.64);
      bodyShape.quadraticCurveTo(-1.35, 0.72, -0.75, 0.86);
      bodyShape.quadraticCurveTo(-0.05, 1.06, 0.62, 0.64);
      bodyShape.quadraticCurveTo(1.55, 0.56, 2.24, 0.28);
      bodyShape.lineTo(2.26, 0.16);
      bodyShape.lineTo(-2.22, 0.18);
    } else {
      // Aggressive GT3 Coupe Silhouette
      bodyShape.moveTo(-2.22, 0.2);
      bodyShape.lineTo(-2.18, 0.76);
      bodyShape.lineTo(-1.45, 0.82);
      bodyShape.quadraticCurveTo(-0.75, 1.16, 0.05, 1.14);
      bodyShape.quadraticCurveTo(0.68, 0.84, 1.38, 0.68);
      bodyShape.quadraticCurveTo(2.05, 0.58, 2.24, 0.3);
      bodyShape.lineTo(2.22, 0.18);
      bodyShape.lineTo(-2.22, 0.2);
    }

    const centerBodyGeo = track(
      createSideProfileGeometry(bodyShape, isLmh || isHyper ? 1.18 : 1.54, 0.08, 0.07, 3, 16)
    );
    const centerBody = new THREE.Mesh(centerBodyGeo, primaryMat);
    centerBody.castShadow = true;
    centerBody.receiveShadow = true;
    chassisGroup.add(centerBody);

    // Center Racing Livery Stripe
    const stripeGeo = track(
      createSideProfileGeometry(bodyShape, 0.44, 0.085, 0.075, 2, 12)
    );
    const stripe = new THREE.Mesh(stripeGeo, secondaryMat);
    stripe.position.y = 0.008;
    chassisGroup.add(stripe);

    // Flared Wheel-Arch Fender Pontoons (Left & Right)
    const fenderShape = new THREE.Shape();
    fenderShape.moveTo(-2.18, 0.22);
    fenderShape.lineTo(-2.05, 0.66);
    fenderShape.quadraticCurveTo(-1.42, 0.82, -0.82, 0.62);
    fenderShape.lineTo(0.84, 0.58);
    fenderShape.quadraticCurveTo(1.42, 0.78, 2.08, 0.56);
    fenderShape.lineTo(2.2, 0.24);
    fenderShape.lineTo(-2.18, 0.22);

    const fenderGeo = track(createSideProfileGeometry(fenderShape, 0.42, 0.06, 0.05, 3, 14));
    for (const side of [-1, 1]) {
      const fender = new THREE.Mesh(fenderGeo, primaryMat);
      fender.position.set(side * 0.76, 0, 0);
      fender.castShadow = true;
      fender.receiveShadow = true;
      chassisGroup.add(fender);

      // Side Aero Intake / EV Cooling Vent
      const ventGeo = track(new THREE.BoxGeometry(0.06, 0.2, 0.92));
      const vent = new THREE.Mesh(
        ventGeo,
        powertrain === 'electric' || powertrain === 'hydrogen' ? powertrainGlowMat : carbonMat
      );
      vent.position.set(side * 0.98, 0.42, -0.18);
      chassisGroup.add(vent);
    }

    // Wraparound Tinted Glass Canopy + Interior Roll Cage
    const canopyShape = new THREE.Shape();
    canopyShape.moveTo(-0.92, 0.72);
    canopyShape.quadraticCurveTo(-0.3, 1.07, 0.28, 1.04);
    canopyShape.quadraticCurveTo(0.76, 0.84, 0.98, 0.64);
    canopyShape.lineTo(-0.92, 0.72);
    const canopyGeo = track(
      createSideProfileGeometry(canopyShape, isLmh || isHyper ? 1.08 : 1.38, 0.06, 0.05, 3, 14)
    );
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    canopy.position.set(0, 0.04, 0);
    chassisGroup.add(canopy);

    // LMH / Hypercar Dorsal Shark Fin & Hydrogen Cryo Dome
    if (isLmh || isHyper || powertrain === 'hydrogen') {
      const finShape = new THREE.Shape();
      finShape.moveTo(-1.95, 0.66);
      finShape.lineTo(-1.92, 1.04);
      finShape.lineTo(-0.78, 1.02);
      finShape.lineTo(-0.78, 0.74);
      finShape.lineTo(-1.95, 0.66);
      const finGeo = track(createSideProfileGeometry(finShape, 0.05, 0.01, 0.01, 1, 6));
      chassisGroup.add(new THREE.Mesh(finGeo, secondaryMat));

      if (powertrain === 'hydrogen') {
        for (const side of [-1, 1]) {
          const tankGeo = track(new THREE.CylinderGeometry(0.14, 0.14, 1.05, 14));
          tankGeo.rotateX(Math.PI / 2);
          const tank = new THREE.Mesh(tankGeo, powertrainGlowMat);
          tank.position.set(side * 0.24, 0.78, -1.22);
          chassisGroup.add(tank);
        }
      }
    }

    // Carbon Side Skirts & Underfloor
    const skirtGeo = track(new THREE.BoxGeometry(2.02, 0.06, 3.7));
    const skirt = new THREE.Mesh(skirtGeo, carbonMat);
    skirt.position.set(0, 0.14, 0);
    chassisGroup.add(skirt);

    addSideMirrors(0.86, 0.74, 0.64);

    // Sculpted LED Matrix Headlights & Full-Width Taillight Bar
    for (const side of [-1, 1]) {
      const hlGeo = track(new THREE.BoxGeometry(0.36, 0.075, 0.12));
      const hl = new THREE.Mesh(hlGeo, headlightMat);
      hl.position.set(side * 0.7, 0.48, 2.15);
      hl.rotation.y = side * -0.22;
      chassisGroup.add(hl);
    }

    const tailBarGeo = track(new THREE.BoxGeometry(1.66, 0.055, 0.08));
    const tailBar = new THREE.Mesh(tailBarGeo, taillightMat);
    tailBar.position.set(0, 0.62, -2.18);
    chassisGroup.add(tailBar);

    if (powertrain !== 'electric') {
      // Front Aero Radiator Grille
      const grilleGeo = track(new THREE.BoxGeometry(1.18, 0.16, 0.08));
      const grille = new THREE.Mesh(grilleGeo, carbonMat);
      grille.position.set(0, 0.3, 2.21);
      chassisGroup.add(grille);
    } else {
      // Closed EV Aero Nose Light Bar
      const evNoseGeo = track(new THREE.BoxGeometry(1.12, 0.045, 0.06));
      const evNose = new THREE.Mesh(evNoseGeo, powertrainGlowMat);
      evNose.position.set(0, 0.36, 2.22);
      chassisGroup.add(evNose);
    }

    // Front Splitter & Canard Dive-Planes (Damageable)
    const splitterGeo = track(new THREE.BoxGeometry(2.0, 0.05, 0.52));
    const splitter = new THREE.Mesh(splitterGeo, carbonMat);
    splitter.position.set(0, 0.14, 2.18);
    frontAeroGroup.add(splitter);

    for (const side of [-1, 1]) {
      const canardGeo = track(new THREE.BoxGeometry(0.18, 0.028, 0.24));
      const canard = new THREE.Mesh(canardGeo, primaryMat);
      canard.position.set(side * 0.96, 0.32, 2.02);
      canard.rotation.z = side * 0.25;
      frontAeroGroup.add(canard);
    }

    // Swan-Neck Rear GT/LMH Wing + Active Flap (Damageable)
    for (const side of [-1, 1]) {
      const strutCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.46, 0.72, -1.9),
        new THREE.Vector3(side * 0.46, 1.0, -1.96),
        new THREE.Vector3(side * 0.46, 1.12, -2.04),
      ]);
      const strutGeo = track(new THREE.TubeGeometry(strutCurve, 10, 0.026, 6, false));
      rearAeroGroup.add(new THREE.Mesh(strutGeo, carbonMat));

      const endGeo = track(new THREE.BoxGeometry(0.036, 0.34, 0.46));
      const endPlate = new THREE.Mesh(endGeo, secondaryMat);
      endPlate.position.set(side * 0.96, 1.0, -2.02);
      rearAeroGroup.add(endPlate);
    }
    const wingGeo = track(new THREE.BoxGeometry(1.92, 0.048, 0.34));
    drsFlap = new THREE.Mesh(wingGeo, carbonMat);
    drsFlap.position.set(0, 1.08, -2.04);
    drsFlap.rotation.x = -THREE.MathUtils.degToRad(tuning.rearWingDeg * 0.7);
    rearAeroGroup.add(drsFlap);

    addRearDiffuserStrakes(-2.08, 1.56, 0.12);

    // Twin Titanium Exhaust Tips + Flame (or EV Kinetic Pulse)
    if (powertrain !== 'electric') {
      for (const side of [-1, 1]) {
        const pipeGeo = track(new THREE.CylinderGeometry(0.05, 0.055, 0.22, 12));
        pipeGeo.rotateX(Math.PI / 2);
        const pipe = new THREE.Mesh(pipeGeo, titaniumMat);
        pipe.position.set(side * 0.32, 0.28, -2.22);
        chassisGroup.add(pipe);
      }

      const flameColor = powertrain === 'hydrogen' ? 0x7dd3fc : 0xf97316;
      const flameMat = track(
        new THREE.MeshBasicMaterial({ color: flameColor, transparent: true, opacity: 0 })
      );
      const flameGeo = track(new THREE.ConeGeometry(0.065, 0.46, 10));
      flameGeo.rotateX(-Math.PI / 2);
      exhaustFlame = new THREE.Mesh(flameGeo, flameMat);
      exhaustFlame.position.set(0, 0.28, -2.42);
      chassisGroup.add(exhaustFlame);
    } else {
      const pulseMat = track(
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0 })
      );
      const pulseGeo = track(new THREE.BoxGeometry(1.1, 0.05, 0.24));
      exhaustFlame = new THREE.Mesh(pulseGeo, pulseMat);
      exhaustFlame.position.set(0, 0.22, -2.24);
      chassisGroup.add(exhaustFlame);
    }

    // 4 Realistic GT/Prototype Wheels
    const fl = createWheel(0.35, 0.32, true);
    fl.position.set(0.95, 0.35, 1.42);
    const fr = createWheel(0.35, 0.32, false);
    fr.position.set(-0.95, 0.35, 1.42);
    const rl = createWheel(0.36, 0.37, true);
    rl.position.set(0.95, 0.36, -1.4);
    const rr = createWheel(0.36, 0.37, false);
    rr.position.set(-0.95, 0.36, -1.4);
    chassisGroup.add(fl, fr, rl, rr);

    return {
      root,
      chassisGroup,
      frontAeroGroup,
      rearAeroGroup,
      wheels: { fl, fr, rl, rr },
      wheelSpinMeshes,
      brakeDiscs,
      drsFlap,
      exhaustFlame,
      paintMaterials: [primaryMat, secondaryMat],
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }
}

export interface ImpactZonesVisual {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
  nose: number;
  rear: number;
}

export function updateCarDamageVisuals(
  rig: CarMeshRig,
  damage: DamageState,
  chassisRoll = 0,
  impactZones?: ImpactZonesVisual
) {
  const fNorm = THREE.MathUtils.clamp(damage.frontAero / 100, 0, 1);
  const rNorm = THREE.MathUtils.clamp(damage.rearAero / 100, 0, 1);
  const sNorm = THREE.MathUtils.clamp(damage.suspension / 100, 0, 1);
  const flNorm = THREE.MathUtils.clamp((impactZones?.fl ?? damage.suspension * 0.7) / 100, 0, 1);
  const frNorm = THREE.MathUtils.clamp((impactZones?.fr ?? damage.suspension * 0.4) / 100, 0, 1);
  const rlNorm = THREE.MathUtils.clamp((impactZones?.rl ?? damage.suspension * 0.4) / 100, 0, 1);
  const rrNorm = THREE.MathUtils.clamp((impactZones?.rr ?? damage.suspension * 0.3) / 100, 0, 1);
  const noseNorm = THREE.MathUtils.clamp((impactZones?.nose ?? damage.frontAero) / 100, 0, 1);

  const avgDmg =
    (damage.frontAero +
      damage.rearAero +
      damage.engine +
      damage.suspension +
      damage.tires +
      damage.gearboxBrakes) /
    600;

  // Stage-by-stage Front Wing / Splitter asymmetric droop & twist -> detachment above 88%
  rig.frontAeroGroup.visible = damage.frontAero < 88;
  if (rig.frontAeroGroup.visible) {
    const lrTwist = (flNorm - frNorm) * 0.28 + fNorm * 0.08;
    rig.frontAeroGroup.rotation.z = lrTwist;
    rig.frontAeroGroup.rotation.x = fNorm * 0.22 + noseNorm * 0.08;
    rig.frontAeroGroup.position.y = -(fNorm * 0.085);
    rig.frontAeroGroup.position.z = -noseNorm * 0.09;
    rig.frontAeroGroup.scale.z = 1 - noseNorm * 0.14;
  }

  // Stage-by-stage Rear Wing droop & twist -> detachment above 88%
  rig.rearAeroGroup.visible = damage.rearAero < 88;
  if (rig.rearAeroGroup.visible) {
    const lrRearTwist = (rrNorm - rlNorm) * 0.26 - rNorm * 0.08;
    rig.rearAeroGroup.rotation.z = lrRearTwist;
    rig.rearAeroGroup.rotation.x = rNorm * 0.24;
    rig.rearAeroGroup.position.y = -rNorm * 0.06;
  }

  // Asymmetric wheel camber skew on the exact corner that absorbed suspension impact
  rig.wheels.fl.rotation.z = flNorm * 0.28 + sNorm * 0.06;
  rig.wheels.fr.rotation.z = -(frNorm * 0.28 + sNorm * 0.05);
  rig.wheels.rl.rotation.z = rlNorm * 0.22;
  rig.wheels.rr.rotation.z = -rrNorm * 0.22;

  const sideSag = (flNorm + rlNorm - (frNorm + rrNorm)) * 0.032;
  rig.chassisGroup.rotation.z = chassisRoll + sideSag;
  rig.chassisGroup.position.y = -(sNorm * 0.045);

  // Progressive body paint scuffing & charring wear (restores clean gloss when repaired in pit)
  for (const mat of rig.paintMaterials) {
    if (!mat.userData.baseColor) {
      mat.userData.baseColor = mat.color.clone();
      mat.userData.baseRoughness = mat.roughness;
    }
    const baseCol = mat.userData.baseColor as THREE.Color;
    const baseRough = mat.userData.baseRoughness as number;
    const scuff = THREE.MathUtils.clamp(avgDmg * 1.25, 0, 0.78);
    mat.color.copy(baseCol).lerp(_scuffTintColor, scuff * 0.56);
    mat.roughness = THREE.MathUtils.clamp(baseRough + scuff * 0.48, 0.05, 0.95);
  }
}

const _scuffTintColor = new THREE.Color('#27272a');
