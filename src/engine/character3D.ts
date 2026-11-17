import * as THREE from 'three';

export type CharacterRoleStyle = 'driver' | 'fire' | 'medical' | 'mechanic' | 'safety';

export type CrewToolProp =
  | 'none'
  | 'extinguisher'
  | 'hose'
  | 'medkit'
  | 'defib'
  | 'oil_can'
  | 'fuel_nozzle'
  | 'wrench';

export type CharacterAnimAction =
  | 'idle'
  | 'walking'
  | 'limping'
  | 'working_fire'
  | 'working_medical'
  | 'working_mechanic_oil'
  | 'working_mechanic_fuel'
  | 'working_mechanic_wrench'
  | 'waving'
  | 'injured_ground';

export interface CharacterMeshRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  toolGroup: THREE.Group;
  bloodMeshes: THREE.Mesh[];
  groundBloodPool: THREE.Mesh;
  activeTool: CrewToolProp;
  setTool: (tool: CrewToolProp) => void;
  setBloodLevel: (bloodLossPct: number, bleedingRate: number) => void;
  dispose: () => void;
}

const SUIT_COLORS: Record<
  CharacterRoleStyle,
  { suit: number; accent: number; helmet: number; visor: number }
> = {
  driver: { suit: 0xe10600, accent: 0xf8fafc, helmet: 0xf8fafc, visor: 0x0f172a },
  fire: { suit: 0xcbd5e1, accent: 0xef4444, helmet: 0xfacc15, visor: 0xd97706 },
  medical: { suit: 0xf8fafc, accent: 0x84cc16, helmet: 0xffffff, visor: 0x1e293b },
  mechanic: { suit: 0x1e293b, accent: 0xe10600, helmet: 0x0f172a, visor: 0x334155 },
  safety: { suit: 0x475569, accent: 0xf59e0b, helmet: 0xf59e0b, visor: 0x0f172a },
};

function buildToolMesh(
  tool: CrewToolProp,
  disposables: { dispose: () => void }[]
): THREE.Group {
  const g = new THREE.Group();
  if (tool === 'none') return g;

  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  if (tool === 'extinguisher') {
    const redMat = track(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.5 }));
    const blackMat = track(new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 }));
    const cyl = new THREE.Mesh(track(new THREE.CylinderGeometry(0.068, 0.068, 0.38, 12)), redMat);
    cyl.position.set(0, -0.1, 0.08);
    const valve = new THREE.Mesh(track(new THREE.CylinderGeometry(0.024, 0.028, 0.06, 8)), blackMat);
    valve.position.set(0, 0.11, 0.08);
    const horn = new THREE.Mesh(track(new THREE.ConeGeometry(0.045, 0.18, 10)), blackMat);
    horn.rotation.x = Math.PI * 0.55;
    horn.position.set(0, 0.06, 0.24);
    g.add(cyl, valve, horn);
  } else if (tool === 'hose') {
    const steelMat = track(new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 }));
    const redMat = track(new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 }));
    const pipe = new THREE.Mesh(track(new THREE.CylinderGeometry(0.032, 0.042, 0.42, 10)), steelMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(0, 0, 0.2);
    const tip = new THREE.Mesh(track(new THREE.ConeGeometry(0.055, 0.1, 10)), redMat);
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(0, 0, 0.42);
    g.add(pipe, tip);
  } else if (tool === 'medkit' || tool === 'defib') {
    const whiteMat = track(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32 }));
    const crossMat = track(
      new THREE.MeshStandardMaterial({
        color: tool === 'defib' ? 0xf59e0b : 0xef4444,
        emissive: tool === 'defib' ? 0x92400e : 0x991b1b,
        emissiveIntensity: 0.35,
      })
    );
    const box = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.26, 0.34)), whiteMat);
    box.position.set(0, -0.14, 0.05);
    const c1 = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 0.14, 0.04)), crossMat);
    c1.position.set(0, -0.14, 0.05);
    const c2 = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 0.04, 0.14)), crossMat);
    c2.position.set(0, -0.14, 0.05);
    g.add(box, c1, c2);
  } else if (tool === 'oil_can') {
    const oilBodyMat = track(new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.4, roughness: 0.3 }));
    const capMat = track(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }));
    const bottle = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.24, 0.18)), oilBodyMat);
    bottle.position.set(0, -0.08, 0.08);
    const spout = new THREE.Mesh(track(new THREE.CylinderGeometry(0.014, 0.026, 0.18, 8)), capMat);
    spout.rotation.x = Math.PI * 0.32;
    spout.position.set(0, 0.07, 0.16);
    g.add(bottle, spout);
  } else if (tool === 'fuel_nozzle') {
    const canMat = track(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36, metalness: 0.25 }));
    const metalMat = track(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 }));
    const tank = new THREE.Mesh(track(new THREE.CylinderGeometry(0.095, 0.095, 0.32, 12)), canMat);
    tank.position.set(0, -0.12, 0.1);
    const nozzle = new THREE.Mesh(track(new THREE.CylinderGeometry(0.016, 0.022, 0.24, 8)), metalMat);
    nozzle.rotation.x = Math.PI * 0.42;
    nozzle.position.set(0, 0.06, 0.2);
    g.add(tank, nozzle);
  } else if (tool === 'wrench') {
    const chromeMat = track(new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.92, roughness: 0.18 }));
    const gripMat = track(new THREE.MeshStandardMaterial({ color: 0xe10600, roughness: 0.55 }));
    const shaft = new THREE.Mesh(track(new THREE.BoxGeometry(0.036, 0.045, 0.36)), chromeMat);
    shaft.position.set(0, 0.02, 0.16);
    const head = new THREE.Mesh(track(new THREE.CylinderGeometry(0.052, 0.052, 0.055, 10)), chromeMat);
    head.position.set(0, 0.02, 0.34);
    const handle = new THREE.Mesh(track(new THREE.BoxGeometry(0.042, 0.13, 0.05)), gripMat);
    handle.position.set(0, -0.05, 0.04);
    g.add(shaft, head, handle);
  }

  return g;
}

export function buildCharacter3D(
  roleStyle: CharacterRoleStyle,
  customSuitHex?: string,
  initialTool: CrewToolProp = 'none'
): CharacterMeshRig {
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const palette = SUIT_COLORS[roleStyle];
  const suitColor = customSuitHex ? new THREE.Color(customSuitHex) : new THREE.Color(palette.suit);

  const suitMat = track(
    new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.65, metalness: 0.08 })
  );
  const accentMat = track(
    new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.45, metalness: 0.18 })
  );
  const helmetMat = track(
    new THREE.MeshPhysicalMaterial({
      color: palette.helmet,
      roughness: 0.18,
      metalness: 0.25,
      clearcoat: 0.95,
    })
  );
  const visorMat = track(
    new THREE.MeshPhysicalMaterial({
      color: palette.visor,
      roughness: 0.06,
      metalness: 0.85,
      clearcoat: 1.0,
    })
  );
  const gloveBootMat = track(
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.78, metalness: 0.1 })
  );
  const bloodMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x8b0000,
      emissive: 0x3b0000,
      emissiveIntensity: 0.35,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.92,
    })
  );

  // Body pivot around hip/pelvis height (y = 0.92)
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.92;
  root.add(bodyPivot);

  // Pelvis & Torso
  const torso = new THREE.Mesh(track(new THREE.BoxGeometry(0.42, 0.54, 0.24)), suitMat);
  torso.position.set(0, 0.27, 0);
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Reflective / Team Stripe on chest & back
  const stripe = new THREE.Mesh(track(new THREE.BoxGeometry(0.44, 0.11, 0.255)), accentMat);
  stripe.position.set(0, 0.34, 0);
  bodyPivot.add(stripe);

  if (roleStyle === 'medical') {
    const crossMat = track(new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 }));
    const vBar = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.18, 0.265)), crossMat);
    vBar.position.set(0, 0.34, 0);
    const hBar = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 0.05, 0.265)), crossMat);
    hBar.position.set(0, 0.34, 0);
    bodyPivot.add(vBar, hBar);
  }

  // Head & Safety Helmet
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.68, 0);
  const helmet = new THREE.Mesh(track(new THREE.SphereGeometry(0.155, 16, 12)), helmetMat);
  helmet.scale.set(0.95, 1.05, 1.06);
  helmet.castShadow = true;
  const visor = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.1, 0.12)), visorMat);
  visor.position.set(0, 0.015, 0.115);
  headGroup.add(helmet, visor);
  bodyPivot.add(headGroup);

  // Articulated Arms
  const makeArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.27, 0.48, 0);
    const upper = new THREE.Mesh(track(new THREE.CylinderGeometry(0.068, 0.058, 0.44, 10)), suitMat);
    upper.position.set(0, -0.2, 0);
    upper.castShadow = true;
    const glove = new THREE.Mesh(track(new THREE.SphereGeometry(0.058, 10, 8)), gloveBootMat);
    glove.position.set(0, -0.45, 0);
    armPivot.add(upper, glove);
    bodyPivot.add(armPivot);
    return armPivot;
  };

  const leftArmPivot = makeArm(1);
  const rightArmPivot = makeArm(-1);

  // Tool attachment socket in right hand
  const toolGroup = new THREE.Group();
  toolGroup.position.set(0, -0.45, 0.02);
  rightArmPivot.add(toolGroup);

  // Articulated Legs
  const makeLeg = (side: -1 | 1) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.12, 0, 0);
    const thigh = new THREE.Mesh(track(new THREE.CylinderGeometry(0.088, 0.07, 0.78, 10)), suitMat);
    thigh.position.set(0, -0.4, 0);
    thigh.castShadow = true;
    const boot = new THREE.Mesh(track(new THREE.BoxGeometry(0.13, 0.12, 0.24)), gloveBootMat);
    boot.position.set(0, -0.84, 0.04);
    legPivot.add(thigh, boot);
    bodyPivot.add(legPivot);
    return legPivot;
  };

  const leftLegPivot = makeLeg(1);
  const rightLegPivot = makeLeg(-1);

  // Blood Stains & Injury Splatter Overlay (hidden until bleeding/hurt)
  const bloodMeshes: THREE.Mesh[] = [];
  const bloodChest = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.22, 0.265)), bloodMat);
  bloodChest.position.set(-0.04, 0.26, 0.01);
  bloodChest.visible = false;
  bodyPivot.add(bloodChest);
  bloodMeshes.push(bloodChest);

  const bloodShoulder = new THREE.Mesh(track(new THREE.SphereGeometry(0.095, 10, 8)), bloodMat);
  bloodShoulder.position.set(0.2, 0.42, 0.05);
  bloodShoulder.visible = false;
  bodyPivot.add(bloodShoulder);
  bloodMeshes.push(bloodShoulder);

  const bloodLeg = new THREE.Mesh(track(new THREE.CylinderGeometry(0.092, 0.075, 0.34, 8)), bloodMat);
  bloodLeg.position.set(-0.12, -0.34, 0.01);
  bloodLeg.visible = false;
  bodyPivot.add(bloodLeg);
  bloodMeshes.push(bloodLeg);

  const groundPoolGeo = track(new THREE.CylinderGeometry(0.55, 0.58, 0.022, 16));
  const groundBloodPool = new THREE.Mesh(groundPoolGeo, bloodMat);
  groundBloodPool.position.set(0, 0.025, 0.05);
  groundBloodPool.visible = false;
  root.add(groundBloodPool);

  let activeTool: CrewToolProp = 'none';
  let currentToolChild: THREE.Group | null = null;
  let toolDisposables: { dispose: () => void }[] = [];

  const setTool = (tool: CrewToolProp) => {
    if (tool === activeTool && currentToolChild) return;
    if (currentToolChild) {
      toolGroup.remove(currentToolChild);
      toolDisposables.forEach((d) => d.dispose());
      toolDisposables = [];
      currentToolChild = null;
    }
    activeTool = tool;
    if (tool !== 'none') {
      currentToolChild = buildToolMesh(tool, toolDisposables);
      toolGroup.add(currentToolChild);
    }
  };

  setTool(initialTool);

  const setBloodLevel = (bloodLossPct: number, bleedingRate: number) => {
    const intensity = Math.max(bloodLossPct, bleedingRate * 1.1);
    bloodChest.visible = intensity > 10;
    bloodShoulder.visible = intensity > 26;
    bloodLeg.visible = intensity > 42;
    const sc = THREE.MathUtils.clamp(0.45 + intensity / 90, 0.45, 1.35);
    bloodChest.scale.set(sc, sc, 1);
    groundBloodPool.visible = bleedingRate > 12 || bloodLossPct > 35;
    const poolScale = THREE.MathUtils.clamp(0.35 + bloodLossPct / 75, 0.35, 1.45);
    groundBloodPool.scale.set(poolScale, 1, poolScale);
  };

  return {
    root,
    bodyPivot,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    toolGroup,
    bloodMeshes,
    groundBloodPool,
    activeTool,
    setTool,
    setBloodLevel,
    dispose: () => {
      toolDisposables.forEach((d) => d.dispose());
      disposables.forEach((d) => d.dispose());
    },
  };
}

export function animateCharacterRig(
  rig: CharacterMeshRig,
  action: CharacterAnimAction,
  timeSec: number,
  seed = 0
) {
  const t = timeSec + seed * 1.7;
  // Reset baseline transforms gently
  rig.bodyPivot.position.y = 0.92;
  rig.bodyPivot.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);
  rig.leftArmPivot.rotation.set(0, 0, 0);
  rig.rightArmPivot.rotation.set(0, 0, 0);
  rig.leftLegPivot.rotation.set(0, 0, 0);
  rig.rightLegPivot.rotation.set(0, 0, 0);

  switch (action) {
    case 'walking': {
      const stride = Math.sin(t * 7.2);
      rig.leftLegPivot.rotation.x = stride * 0.58;
      rig.rightLegPivot.rotation.x = -stride * 0.58;
      rig.leftArmPivot.rotation.x = -stride * 0.46;
      rig.rightArmPivot.rotation.x = rig.activeTool !== 'none' ? -0.45 : stride * 0.46;
      rig.bodyPivot.position.y = 0.92 + Math.abs(Math.cos(t * 7.2)) * 0.04;
      break;
    }
    case 'limping': {
      const limpCycle = Math.sin(t * 3.8);
      rig.leftLegPivot.rotation.x = limpCycle * 0.35;
      rig.rightLegPivot.rotation.x = Math.max(-0.15, -limpCycle * 0.18);
      rig.bodyPivot.rotation.z = 0.14 + Math.sin(t * 3.8) * 0.08;
      rig.bodyPivot.rotation.x = 0.22; // hunched forward in pain
      rig.leftArmPivot.rotation.x = -0.65;
      rig.leftArmPivot.rotation.z = -0.42; // clutching ribs/chest in pain
      rig.rightArmPivot.rotation.x = -0.35;
      rig.bodyPivot.position.y = 0.84 + Math.max(0, limpCycle) * 0.05;
      break;
    }
    case 'injured_ground': {
      rig.bodyPivot.position.y = 0.36;
      rig.bodyPivot.rotation.x = 0.52 + Math.sin(t * 2.2) * 0.04;
      rig.bodyPivot.rotation.z = 0.18;
      rig.leftLegPivot.rotation.x = -1.25;
      rig.rightLegPivot.rotation.x = -1.1;
      rig.leftArmPivot.rotation.x = -0.85;
      rig.leftArmPivot.rotation.z = -0.35; // holding wounded torso
      rig.rightArmPivot.rotation.x = -0.5;
      rig.headGroup.rotation.x = 0.28 + Math.sin(t * 1.8) * 0.08;
      break;
    }
    case 'working_fire': {
      rig.bodyPivot.rotation.x = 0.14;
      rig.rightArmPivot.rotation.x = -1.22 + Math.sin(t * 6.5) * 0.08;
      rig.rightArmPivot.rotation.y = Math.sin(t * 4.2) * 0.32;
      rig.leftArmPivot.rotation.x = -1.1;
      rig.leftArmPivot.rotation.z = -0.2;
      rig.leftLegPivot.rotation.x = -0.18;
      rig.rightLegPivot.rotation.x = 0.2;
      break;
    }
    case 'working_medical': {
      // Kneeling beside driver treating wounds & bleeding
      rig.bodyPivot.position.y = 0.52;
      rig.bodyPivot.rotation.x = 0.42;
      rig.leftLegPivot.rotation.x = -1.15;
      rig.rightLegPivot.rotation.x = -0.85;
      rig.rightArmPivot.rotation.x = -1.15 + Math.sin(t * 5.0) * 0.2;
      rig.leftArmPivot.rotation.x = -1.1 - Math.sin(t * 5.0) * 0.18;
      rig.headGroup.rotation.x = 0.32;
      break;
    }
    case 'working_mechanic_oil':
    case 'working_mechanic_fuel': {
      // Leaning over engine bay/tank pouring oil or fuel
      rig.bodyPivot.position.y = 0.85;
      rig.bodyPivot.rotation.x = 0.34;
      rig.rightArmPivot.rotation.x = -1.38 + Math.sin(t * 3.4) * 0.12;
      rig.rightArmPivot.rotation.z = 0.16;
      rig.leftArmPivot.rotation.x = -0.85;
      rig.headGroup.rotation.x = 0.24;
      break;
    }
    case 'working_mechanic_wrench': {
      // Rapid wrenching & tightening wheel/engine bolts
      rig.bodyPivot.position.y = 0.72;
      rig.bodyPivot.rotation.x = 0.32;
      rig.leftLegPivot.rotation.x = -0.45;
      rig.rightLegPivot.rotation.x = 0.25;
      rig.rightArmPivot.rotation.x = -1.28 + Math.sin(t * 14) * 0.16;
      rig.rightArmPivot.rotation.z = Math.cos(t * 14) * 0.14;
      rig.leftArmPivot.rotation.x = -0.92;
      break;
    }
    case 'waving': {
      rig.rightArmPivot.rotation.z = 2.55;
      rig.rightArmPivot.rotation.x = -0.35 + Math.sin(t * 9.5) * 0.35;
      rig.headGroup.rotation.z = Math.sin(t * 4) * 0.08;
      break;
    }
    case 'idle':
    default: {
      rig.bodyPivot.position.y = 0.92 + Math.sin(t * 2.2) * 0.015;
      rig.rightArmPivot.rotation.x = rig.activeTool !== 'none' ? -0.45 : -0.06;
      rig.leftArmPivot.rotation.x = 0.04;
      break;
    }
  }
}
