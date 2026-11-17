import * as THREE from 'three';
import { TrackDefinition, TrackEnvironment } from '../types/game';

export interface TrackSample {
  s: number;
  distance: number;
  pos: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  normal: THREE.Vector3;
  curvature: number;
  bankRad: number;
}

export interface BuiltTrackScene {
  group: THREE.Group;
  samples: TrackSample[];
  totalLengthMeters: number;
  widthMeters: number;
  envConfig: EnvironmentPalette;
  startLightMeshes: THREE.Mesh[];
  roadMat: THREE.MeshStandardMaterial;
  skyMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export interface EnvironmentPalette {
  skyTopHex: number;
  skyHorizonHex: number;
  fogHex: number;
  fogDensity: number;
  groundHex: number;
  groundAltHex: number;
  sunHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  isNight: boolean;
}

export const ENV_PALETTES: Record<TrackEnvironment, EnvironmentPalette> = {
  autodromo_day: {
    skyTopHex: 0x2563eb,
    skyHorizonHex: 0xbad9f7,
    fogHex: 0xaed2f2,
    fogDensity: 0.00095,
    groundHex: 0x2d4a22,
    groundAltHex: 0x3b5d2d,
    sunHex: 0xfff5e0,
    sunIntensity: 2.0,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x364928,
    hemiIntensity: 0.85,
    isNight: false,
  },
  night_street: {
    skyTopHex: 0x050811,
    skyHorizonHex: 0x131d33,
    fogHex: 0x0b1120,
    fogDensity: 0.00145,
    groundHex: 0x141820,
    groundAltHex: 0x1e2430,
    sunHex: 0xdbeafe,
    sunIntensity: 1.25,
    hemiSkyHex: 0x3b4d6b,
    hemiGroundHex: 0x0f172a,
    hemiIntensity: 0.9,
    isNight: true,
  },
  desert_sunset: {
    skyTopHex: 0x4c1d3d,
    skyHorizonHex: 0xf59e6c,
    fogHex: 0xdc8858,
    fogDensity: 0.0011,
    groundHex: 0x8f663c,
    groundAltHex: 0xa87b4c,
    sunHex: 0xffb366,
    sunIntensity: 2.15,
    hemiSkyHex: 0xfdba74,
    hemiGroundHex: 0x5c3e24,
    hemiIntensity: 0.8,
    isNight: false,
  },
  alpine_pass: {
    skyTopHex: 0x1d4ed8,
    skyHorizonHex: 0xcbe5f5,
    fogHex: 0xbdd9ec,
    fogDensity: 0.0011,
    groundHex: 0x334d36,
    groundAltHex: 0x456348,
    sunHex: 0xfef9c3,
    sunIntensity: 1.95,
    hemiSkyHex: 0xbae6fd,
    hemiGroundHex: 0x2f3e2e,
    hemiIntensity: 0.85,
    isNight: false,
  },
};

function create4HDAsphaltTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughnessSetup: {
    roughCanvas.height = 512;
    break roughnessSetup;
  }
  const rCtx = roughCanvas.getContext('2d')!;

  const normCanvas = document.createElement('canvas');
  normCanvas.width = 512;
  normCanvas.height = 512;
  const nCtx = normCanvas.getContext('2d')!;

  // Base deep charcoal asphalt
  ctx.fillStyle = '#20232a';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(205,205,205)';
  rCtx.fillRect(0, 0, 512, 512);
  nCtx.fillStyle = 'rgb(128,128,255)';
  nCtx.fillRect(0, 0, 512, 512);

  // High-detail mineral aggregate grain
  for (let i = 0; i < 48000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 22 + Math.floor(Math.random() * 34);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, 2, 2);

    if (i < 22000) {
      const nx = Math.random() * 512;
      const ny = Math.random() * 512;
      const dx = 112 + Math.floor(Math.random() * 32);
      const dy = 112 + Math.floor(Math.random() * 32);
      nCtx.fillStyle = `rgb(${dx},${dy},250)`;
      nCtx.fillRect(nx, ny, 2, 2);

      const rv = 165 + Math.floor(Math.random() * 65);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(nx, ny, 2, 2);
    }
  }

  // Rubberized Racing Groove + Subtle Skid Streaks
  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, 'rgba(10,12,16,0)');
  grad.addColorStop(0.24, 'rgba(10,12,16,0.34)');
  grad.addColorStop(0.5, 'rgba(8,10,14,0.52)');
  grad.addColorStop(0.76, 'rgba(10,12,16,0.34)');
  grad.addColorStop(1, 'rgba(10,12,16,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Glossy rubber groove in roughness map (lower roughness in racing line)
  const rGrad = rCtx.createLinearGradient(0, 0, 512, 0);
  rGrad.addColorStop(0, 'rgba(220,220,220,0)');
  rGrad.addColorStop(0.5, 'rgba(120,120,120,0.45)');
  rGrad.addColorStop(1, 'rgba(220,220,220,0)');
  rCtx.fillStyle = rGrad;
  rCtx.fillRect(0, 0, 512, 512);

  // Fine longitudinal rubber tire marks
  ctx.strokeStyle = 'rgba(8, 9, 12, 0.35)';
  ctx.lineWidth = 3;
  for (let t = 0; t < 18; t++) {
    const tx = 220 + Math.random() * 580;
    ctx.beginPath();
    ctx.moveTo(tx, 0);
    ctx.lineTo(tx + (Math.random() - 0.5) * 14, size);
    ctx.stroke();
  }

  // Crisp FIA White Track Limit Edge Lines
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(28, 0, 18, size);
  ctx.fillRect(size - 46, 0, 18, size);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const normalMap = new THREE.CanvasTexture(normCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, normalMap, roughnessMap };
}

function create4HDGroundTexture(
  palette: EnvironmentPalette,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const baseCol = new THREE.Color(palette.groundHex);
  const altCol = new THREE.Color(palette.groundAltHex);
  ctx.fillStyle = `#${baseCol.getHexString()}`;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 6;
    ctx.fillStyle = i % 2 === 0 ? `#${altCol.getHexString()}` : 'rgba(0,0,0,0.12)';
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, y, r, r);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createKerbTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#f8fafc';
    ctx.fillRect(0, i * 128, 256, 128);
    // Subtle kerb ridge shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, i * 128, 256, 10);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createCheckeredTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const size = 32;
  for (let y = 0; y < 128; y += size) {
    for (let x = 0; x < 512; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? '#f8fafc' : '#111827';
      ctx.fillRect(x, y, size, size);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSkyDomeTexture(palette: EnvironmentPalette): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const top = new THREE.Color(palette.skyTopHex);
  const hor = new THREE.Color(palette.skyHorizonHex);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, `#${top.getHexString()}`);
  grad.addColorStop(0.48, `#${hor.getHexString()}`);
  grad.addColorStop(0.55, `#${hor.getHexString()}`);
  grad.addColorStop(1, `#${new THREE.Color(palette.groundHex).getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  if (palette.isNight) {
    // Crisp starfield in upper sky hemisphere
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 240; i++) {
      ctx.globalAlpha = 0.35 + Math.random() * 0.65;
      ctx.fillRect(Math.random() * 512, Math.random() * 210, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  } else {
    // Soft atmospheric clouds band
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let c = 0; c < 36; c++) {
      const cx = Math.random() * 512;
      const cy = 120 + Math.random() * 105;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 28 + Math.random() * 55, 6 + Math.random() * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBrakingBoardTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#e10600';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 118, 118);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 64, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildTrack3D(
  track: TrackDefinition,
  maxAnisotropy = 4
): BuiltTrackScene {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const trackDisp = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const envConfig = ENV_PALETTES[track.environment];

  // 1. 4HD Atmospheric Sky Dome
  const skyTex = trackDisp(createSkyDomeTexture(envConfig));
  const skyGeo = trackDisp(new THREE.SphereGeometry(1650, 32, 24));
  const skyMat = trackDisp(
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyDome);

  const controlVecs = track.points.map(
    (p) => new THREE.Vector3(p.x, p.elevation, p.z)
  );
  const curve = new THREE.CatmullRomCurve3(controlVecs, true, 'catmullrom', 0.45);
  const totalLengthMeters = curve.getLength();
  const sampleCount = Math.max(300, Math.min(600, Math.round(totalLengthMeters / 4.2)));

  const samples: TrackSample[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < sampleCount; i++) {
    const s = i / sampleCount;
    const pos = curve.getPointAt(s);
    const tangent = curve.getTangentAt(s).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const ptFloat = s * track.points.length;
    const pIdx0 = Math.floor(ptFloat) % track.points.length;
    const pIdx1 = (pIdx0 + 1) % track.points.length;
    const frac = ptFloat - Math.floor(ptFloat);
    const bankDeg = THREE.MathUtils.lerp(
      track.points[pIdx0].bankDeg,
      track.points[pIdx1].bankDeg,
      frac
    );
    const bankRad = THREE.MathUtils.degToRad(bankDeg);
    const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();

    samples.push({
      s,
      distance: s * totalLengthMeters,
      pos,
      tangent,
      right,
      normal,
      curvature: 0,
      bankRad,
    });
  }

  for (let i = 0; i < sampleCount; i++) {
    const prev = samples[(i - 2 + sampleCount) % sampleCount];
    const next = samples[(i + 2) % sampleCount];
    samples[i].curvature = prev.tangent.angleTo(next.tangent);
  }

  const halfW = track.widthMeters * 0.5;
  const shoulderW = halfW + 4.8;

  const roadVerts: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const runoffVerts: number[] = [];
  const runoffUvs: number[] = [];
  const runoffIndices: number[] = [];

  const cornerKerbVerts: number[] = [];
  const cornerKerbUvs: number[] = [];
  const cornerKerbIndices: number[] = [];

  const vergeVerts: number[] = [];
  const vergeIndices: number[] = [];

  const leftWallVerts: number[] = [];
  const rightWallVerts: number[] = [];
  const wallUvs: number[] = [];
  const wallIndices: number[] = [];

  const segRepeat = totalLengthMeters / 16;

  for (let i = 0; i <= sampleCount; i++) {
    const samp = samples[i % sampleCount];
    const bankLift = Math.sin(samp.bankRad) * halfW;

    const pL = samp.pos.clone().addScaledVector(samp.right, -halfW);
    pL.y += 0.045 - bankLift;
    const pR = samp.pos.clone().addScaledVector(samp.right, halfW);
    pR.y += 0.045 + bankLift;

    roadVerts.push(pL.x, pL.y, pL.z, pR.x, pR.y, pR.z);
    const vCoord = (i / sampleCount) * segRepeat;
    roadUvs.push(0, vCoord, 1, vCoord);

    // Wider Runoff / Gravel Trap Apron around outside corners
    const isCorner = samp.curvature > 0.055;
    const extraShoulder = isCorner ? shoulderW + 2.4 : shoulderW;
    const rL = samp.pos.clone().addScaledVector(samp.right, -extraShoulder);
    rL.y += 0.015 - bankLift * 1.1;
    const rR = samp.pos.clone().addScaledVector(samp.right, extraShoulder);
    rR.y += 0.015 + bankLift * 1.1;
    runoffVerts.push(rL.x, rL.y, rL.z, rR.x, rR.y, rR.z);
    runoffUvs.push(0, vCoord, 1, vCoord);

    // Armco / TecPro Safety Barriers (pushed out slightly in corners for runoff realism)
    const wBaseL = samp.pos.clone().addScaledVector(samp.right, -extraShoulder);
    const wTopL = wBaseL.clone();
    wTopL.y += 1.25;
    leftWallVerts.push(wBaseL.x, wBaseL.y, wBaseL.z, wTopL.x, wTopL.y, wTopL.z);

    const wBaseR = samp.pos.clone().addScaledVector(samp.right, extraShoulder);
    const wTopR = wBaseR.clone();
    wTopR.y += 1.25;
    rightWallVerts.push(wBaseR.x, wBaseR.y, wBaseR.z, wTopR.x, wTopR.y, wTopR.z);
    wallUvs.push(0, vCoord, 1, vCoord);

    if (i < sampleCount) {
      const idx = i * 2;
      roadIndices.push(idx, idx + 2, idx + 1, idx + 1, idx + 2, idx + 3);
      runoffIndices.push(idx, idx + 2, idx + 1, idx + 1, idx + 2, idx + 3);
      wallIndices.push(idx, idx + 2, idx + 1, idx + 1, idx + 2, idx + 3);

      // Build FIA Red/White Kerbs ONLY on corners / chicanes (or clean concrete verge on straights)
      const nextSamp = samples[(i + 1) % sampleCount];
      const avgCurv = (samp.curvature + nextSamp.curvature) * 0.5;
      const bankNext = Math.sin(nextSamp.bankRad) * halfW;

      for (const side of [-1, 1] as const) {
        const innerOff = side * (halfW - 0.12);
        const outerOff = side * (halfW + 1.18);

        const aIn = samp.pos.clone().addScaledVector(samp.right, innerOff);
        aIn.y += 0.058 + side * bankLift;
        const aOut = samp.pos.clone().addScaledVector(samp.right, outerOff);
        aOut.y += 0.072 + side * bankLift;

        const bIn = nextSamp.pos.clone().addScaledVector(nextSamp.right, innerOff);
        bIn.y += 0.058 + side * bankNext;
        const bOut = nextSamp.pos.clone().addScaledVector(nextSamp.right, outerOff);
        bOut.y += 0.072 + side * bankNext;

        if (avgCurv > 0.042) {
          const base = cornerKerbVerts.length / 3;
          cornerKerbVerts.push(
            aOut.x, aOut.y, aOut.z,
            aIn.x, aIn.y, aIn.z,
            bOut.x, bOut.y, bOut.z,
            bIn.x, bIn.y, bIn.z
          );
          cornerKerbUvs.push(0, vCoord * 2.2, 1, vCoord * 2.2, 0, (vCoord + 0.2) * 2.2, 1, (vCoord + 0.2) * 2.2);
          cornerKerbIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        } else {
          const base = vergeVerts.length / 3;
          vergeVerts.push(
            aOut.x, aOut.y - 0.015, aOut.z,
            aIn.x, aIn.y - 0.01, aIn.z,
            bOut.x, bOut.y - 0.015, bOut.z,
            bIn.x, bIn.y - 0.01, bIn.z
          );
          vergeIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        }
      }
    }
  }

  const asphaltTexSet = create4HDAsphaltTextures(maxAnisotropy);
  trackDisp(asphaltTexSet.map);
  trackDisp(asphaltTexSet.normalMap);
  trackDisp(asphaltTexSet.roughnessMap);

  const kerbTex = trackDisp(createKerbTexture(maxAnisotropy));
  const checkerTex = trackDisp(createCheckeredTexture(maxAnisotropy));
  const groundTex = trackDisp(create4HDGroundTexture(envConfig, maxAnisotropy));

  // Road Mesh with Normal + Roughness PBR Maps
  const roadGeo = trackDisp(new THREE.BufferGeometry());
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();
  const roadMat = trackDisp(
    new THREE.MeshStandardMaterial({
      map: asphaltTexSet.map,
      normalMap: asphaltTexSet.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: asphaltTexSet.roughnessMap,
      roughness: 0.9,
      metalness: 0.08,
      side: THREE.DoubleSide,
    })
  );
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Parallel Realistic FIA Pit Lane Ribbon (along main straight s = 0.91 .. 0.09)
  const pitVerts: number[] = [];
  const pitIndices: number[] = [];
  const pitSamples: TrackSample[] = [];
  for (let i = Math.floor(sampleCount * 0.91); i < sampleCount; i++) pitSamples.push(samples[i]);
  for (let i = 0; i <= Math.floor(sampleCount * 0.09); i++) pitSamples.push(samples[i]);
  if (pitSamples.length >= 6) {
    for (let i = 0; i < pitSamples.length; i++) {
      const samp = pitSamples[i];
      const blendT = Math.min(1, i / 5, (pitSamples.length - 1 - i) / 5);
      const centerOff = -(halfW + 1.5 + blendT * 5.2);
      const pL = samp.pos.clone().addScaledVector(samp.right, centerOff - 2.4);
      pL.y += 0.038;
      const pR = samp.pos.clone().addScaledVector(samp.right, centerOff + 2.4);
      pR.y += 0.038;
      pitVerts.push(pL.x, pL.y, pL.z, pR.x, pR.y, pR.z);
      if (i < pitSamples.length - 1) {
        const idx = i * 2;
        pitIndices.push(idx, idx + 2, idx + 1, idx + 1, idx + 2, idx + 3);
      }
    }
    const pitGeo = trackDisp(new THREE.BufferGeometry());
    pitGeo.setAttribute('position', new THREE.Float32BufferAttribute(pitVerts, 3));
    pitGeo.setIndex(pitIndices);
    pitGeo.computeVertexNormals();
    const pitMat = trackDisp(
      new THREE.MeshStandardMaterial({
        color: 0x2a2f3a,
        roughness: 0.86,
        metalness: 0.08,
        side: THREE.DoubleSide,
      })
    );
    const pitMesh = new THREE.Mesh(pitGeo, pitMat);
    pitMesh.receiveShadow = true;
    group.add(pitMesh);
  }

  // Runoff Shoulder / Gravel Strip
  const runoffGeo = trackDisp(new THREE.BufferGeometry());
  runoffGeo.setAttribute('position', new THREE.Float32BufferAttribute(runoffVerts, 3));
  runoffGeo.setAttribute('uv', new THREE.Float32BufferAttribute(runoffUvs, 2));
  runoffGeo.setIndex(runoffIndices);
  runoffGeo.computeVertexNormals();
  const runoffMat = trackDisp(
    new THREE.MeshStandardMaterial({
      color: track.environment === 'desert_sunset' ? 0xa38057 : 0x525866,
      roughness: 0.94,
      metalness: 0.03,
      side: THREE.DoubleSide,
    })
  );
  const runoffMesh = new THREE.Mesh(runoffGeo, runoffMat);
  runoffMesh.receiveShadow = true;
  group.add(runoffMesh);

  // Corner FIA Red/White Kerbs
  if (cornerKerbVerts.length > 0) {
    const kerbMat = trackDisp(
      new THREE.MeshStandardMaterial({
        map: kerbTex,
        roughness: 0.58,
        metalness: 0.05,
        side: THREE.DoubleSide,
      })
    );
    const kGeo = trackDisp(new THREE.BufferGeometry());
    kGeo.setAttribute('position', new THREE.Float32BufferAttribute(cornerKerbVerts, 3));
    kGeo.setAttribute('uv', new THREE.Float32BufferAttribute(cornerKerbUvs, 2));
    kGeo.setIndex(cornerKerbIndices);
    kGeo.computeVertexNormals();
    const kMesh = new THREE.Mesh(kGeo, kerbMat);
    kMesh.receiveShadow = true;
    group.add(kMesh);
  }

  // Straight Track Edge Concrete Verges
  if (vergeVerts.length > 0) {
    const vergeMat = trackDisp(
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.78,
        side: THREE.DoubleSide,
      })
    );
    const vGeo = trackDisp(new THREE.BufferGeometry());
    vGeo.setAttribute('position', new THREE.Float32BufferAttribute(vergeVerts, 3));
    vGeo.setIndex(vergeIndices);
    vGeo.computeVertexNormals();
    const vMesh = new THREE.Mesh(vGeo, vergeMat);
    vMesh.receiveShadow = true;
    group.add(vMesh);
  }

  // Steel/Concrete Safety Barriers
  const wallMat = trackDisp(
    new THREE.MeshStandardMaterial({
      color: envConfig.isNight ? 0x475569 : 0xe2e8f0,
      roughness: 0.45,
      metalness: 0.45,
      side: THREE.DoubleSide,
    })
  );
  for (const verts of [leftWallVerts, rightWallVerts]) {
    const wGeo = trackDisp(new THREE.BufferGeometry());
    wGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    wGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
    wGeo.setIndex(wallIndices);
    wGeo.computeVertexNormals();
    const wMesh = new THREE.Mesh(wGeo, wallMat);
    wMesh.castShadow = true;
    wMesh.receiveShadow = true;
    group.add(wMesh);
  }

  // Extensive 4HD Textured Ground Plane
  const groundGeo = trackDisp(new THREE.PlaneGeometry(3800, 3800));
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = trackDisp(
    new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.94,
      metalness: 0.02,
    })
  );
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.15;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // Start/Finish Checkered Line & Overhead Gantry with 5 Start Light Pods + FIA Starting Grid Slots
  const startSample = samples[0];
  const startMat = trackDisp(
    new THREE.MeshStandardMaterial({
      map: checkerTex,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const startLineGeo = trackDisp(new THREE.PlaneGeometry(track.widthMeters - 0.4, 3.6));
  startLineGeo.rotateX(-Math.PI / 2);
  const startLine = new THREE.Mesh(startLineGeo, startMat);
  startLine.position.copy(startSample.pos);
  startLine.position.y += 0.07;
  const startYaw = Math.atan2(startSample.tangent.x, startSample.tangent.z);
  startLine.rotation.y = startYaw;
  group.add(startLine);

  // Painted FIA Starting Grid Slots (10 staggered boxes behind finish line)
  const gridLineMat = trackDisp(
    new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const gridBarGeo = trackDisp(new THREE.PlaneGeometry(2.1, 0.24));
  gridBarGeo.rotateX(-Math.PI / 2);
  for (let slot = 0; slot < 10; slot++) {
    const backM = 8 + slot * 8;
    const sIdx = (sampleCount - Math.round((backM / totalLengthMeters) * sampleCount) + sampleCount) % sampleCount;
    const samp = samples[sIdx];
    const sideOff = slot % 2 === 0 ? -2.8 : 2.8;
    const boxPos = samp.pos.clone().addScaledVector(samp.right, sideOff);
    const gMesh = new THREE.Mesh(gridBarGeo, gridLineMat);
    gMesh.position.set(boxPos.x, boxPos.y + 0.075, boxPos.z);
    gMesh.rotation.y = Math.atan2(samp.tangent.x, samp.tangent.z);
    group.add(gMesh);
  }

  const gantryGroup = new THREE.Group();
  gantryGroup.position.copy(startSample.pos);
  gantryGroup.rotation.y = startYaw;
  const gantryMat = trackDisp(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 })
  );
  const bannerMat = trackDisp(
    new THREE.MeshStandardMaterial({
      color: 0xe10600,
      emissive: 0x500000,
      roughness: 0.3,
    })
  );
  const postGeo = trackDisp(new THREE.BoxGeometry(0.75, 7.6, 0.75));
  const postL = new THREE.Mesh(postGeo, gantryMat);
  postL.position.set(-(halfW + 2.0), 3.8, 0);
  const postR = new THREE.Mesh(postGeo, gantryMat);
  postR.position.set(halfW + 2.0, 3.8, 0);
  const beamGeo = trackDisp(new THREE.BoxGeometry(track.widthMeters + 4.8, 1.4, 0.85));
  const beam = new THREE.Mesh(beamGeo, bannerMat);
  beam.position.set(0, 7.1, 0);
  gantryGroup.add(postL, postR, beam);

  // 5 FIA Start Light Pods
  const startLightMeshes: THREE.Mesh[] = [];
  const podGeo = trackDisp(new THREE.SphereGeometry(0.24, 12, 12));
  for (let i = -2; i <= 2; i++) {
    const podMat = trackDisp(
      new THREE.MeshStandardMaterial({
        color: 0x220404,
        emissive: 0xff0000,
        emissiveIntensity: 0,
      })
    );
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.set(i * 1.15, 6.2, -0.45);
    gantryGroup.add(pod);
    startLightMeshes.push(pod);
  }
  group.add(gantryGroup);

  // Mid-Circuit FIA Sponsor Arch Bridge (adds spatial depth & realism)
  const midSamp = samples[Math.floor(sampleCount * 0.5)];
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.copy(midSamp.pos);
  bridgeGroup.rotation.y = Math.atan2(midSamp.tangent.x, midSamp.tangent.z);
  const bPostL = new THREE.Mesh(postGeo, gantryMat);
  bPostL.position.set(-(halfW + 2.2), 3.8, 0);
  const bPostR = new THREE.Mesh(postGeo, gantryMat);
  bPostR.position.set(halfW + 2.2, 3.8, 0);
  const bArchMat = trackDisp(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.6 })
  );
  const bBeam = new THREE.Mesh(
    trackDisp(new THREE.BoxGeometry(track.widthMeters + 5.2, 1.25, 1.1)),
    bArchMat
  );
  bBeam.position.set(0, 7.1, 0);
  bridgeGroup.add(bPostL, bPostR, bBeam);
  group.add(bridgeGroup);

  // Pit Garages, Race Control Tower & Grandstands along Start/Finish Straight
  const paddockComplex = new THREE.Group();
  paddockComplex.position.copy(startSample.pos);
  paddockComplex.rotation.y = startYaw;

  const pitWallMat = trackDisp(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.45 })
  );
  const pitRoofMat = trackDisp(
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.5 })
  );
  const glassTowerMat = trackDisp(
    new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      emissive: envConfig.isNight ? 0x1e3a8a : 0x000000,
      emissiveIntensity: envConfig.isNight ? 0.6 : 0,
      roughness: 0.1,
      metalness: 0.2,
    })
  );

  // Paddock Garage Building on Pit Side
  const garageBox = new THREE.Mesh(
    trackDisp(new THREE.BoxGeometry(10, 6.5, 64)),
    pitWallMat
  );
  garageBox.position.set(-(halfW + 15.5), 3.25, -14);
  garageBox.castShadow = true;
  garageBox.receiveShadow = true;
  paddockComplex.add(garageBox);

  const garageAwning = new THREE.Mesh(
    trackDisp(new THREE.BoxGeometry(12.5, 0.5, 65)),
    pitRoofMat
  );
  garageAwning.position.set(-(halfW + 14.5), 6.65, -14);
  paddockComplex.add(garageAwning);

  // FIA Race Control Tower
  const tower = new THREE.Mesh(
    trackDisp(new THREE.BoxGeometry(7.5, 16, 7.5)),
    glassTowerMat
  );
  tower.position.set(-(halfW + 16), 8, 25);
  tower.castShadow = true;
  paddockComplex.add(tower);

  // Main Grandstand opposite Pit Lane
  const grandstand = new THREE.Mesh(
    trackDisp(new THREE.BoxGeometry(11, 8.5, 56)),
    pitWallMat
  );
  grandstand.position.set(halfW + 14.5, 4.2, -10);
  grandstand.castShadow = true;
  paddockComplex.add(grandstand);

  const standRoof = new THREE.Mesh(
    trackDisp(new THREE.BoxGeometry(13, 0.45, 58)),
    pitRoofMat
  );
  standRoof.position.set(halfW + 14, 9.5, -10);
  standRoof.rotation.z = 0.14;
  paddockComplex.add(standRoof);

  group.add(paddockComplex);

  // 150m / 100m / 50m Braking Marker Boards before Sharp Corners
  const boardTex150 = trackDisp(createBrakingBoardTexture('150'));
  const boardTex100 = trackDisp(createBrakingBoardTexture('100'));
  const boardTex50 = trackDisp(createBrakingBoardTexture('50'));
  const boardGeo = trackDisp(new THREE.BoxGeometry(1.5, 1.35, 0.16));
  const boardMats = [
    trackDisp(new THREE.MeshStandardMaterial({ map: boardTex150, roughness: 0.4 })),
    trackDisp(new THREE.MeshStandardMaterial({ map: boardTex100, roughness: 0.4 })),
    trackDisp(new THREE.MeshStandardMaterial({ map: boardTex50, roughness: 0.4 })),
  ];
  let lastBrakingPlaced = -40;
  for (let i = 24; i < sampleCount - 8; i++) {
    const prevC = samples[(i - 8 + sampleCount) % sampleCount].curvature;
    const hereC = samples[i].curvature;
    if (hereC > 0.095 && prevC < 0.05 && i - lastBrakingPlaced > 32) {
      lastBrakingPlaced = i;
      // Place 150, 100, 50m boards back along straight on outer edge
      const stepPer50 = Math.max(4, Math.round(50 / (totalLengthMeters / sampleCount)));
      [3, 2, 1].forEach((mult, mIdx) => {
        const bIdx = (i - mult * stepPer50 + sampleCount) % sampleCount;
        const bs = samples[bIdx];
        const bMesh = new THREE.Mesh(boardGeo, boardMats[mIdx]);
        const pos = bs.pos.clone().addScaledVector(bs.right, halfW + 2.4);
        bMesh.position.set(pos.x, pos.y + 0.95, pos.z);
        bMesh.rotation.y = Math.atan2(bs.tangent.x, bs.tangent.z);
        group.add(bMesh);
      });
    }
  }

  // Instanced Perimeter Trees / Floodlights & Natural Foliage
  const propCount = 150;
  const propGeo = trackDisp(
    envConfig.isNight
      ? new THREE.CylinderGeometry(0.18, 0.32, 13, 8)
      : track.environment === 'desert_sunset'
      ? new THREE.DodecahedronGeometry(4.2, 1)
      : new THREE.ConeGeometry(3.8, 11.5, 8)
  );
  const propMat = trackDisp(
    new THREE.MeshStandardMaterial({
      color: envConfig.isNight
        ? 0x94a3b8
        : track.environment === 'desert_sunset'
        ? 0x9a6f47
        : 0x1e4d2b,
      roughness: 0.85,
      metalness: envConfig.isNight ? 0.65 : 0.05,
    })
  );
  const instProps = new THREE.InstancedMesh(propGeo, propMat, propCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < propCount; i++) {
    const sIdx = Math.floor((i / propCount) * sampleCount);
    const samp = samples[sIdx];
    const side = i % 2 === 0 ? 1 : -1;
    const distOut = shoulderW + 13 + (i % 7) * 8;
    const p = samp.pos.clone().addScaledVector(samp.right, side * distOut);
    dummy.position.set(
      p.x,
      envConfig.isNight ? 6.5 : track.environment === 'desert_sunset' ? 1.8 : 5.3,
      p.z
    );
    const sc = 0.82 + ((i * 19) % 42) / 100;
    dummy.scale.set(sc, sc, sc);
    dummy.rotation.y = i * 1.1;
    dummy.updateMatrix();
    instProps.setMatrixAt(i, dummy.matrix);
  }
  instProps.instanceMatrix.needsUpdate = true;
  instProps.computeBoundingSphere();
  group.add(instProps);

  // Stadium Floodlight Heads at Night
  if (envConfig.isNight) {
    const lampGeo = trackDisp(new THREE.BoxGeometry(1.8, 0.7, 0.5));
    const lampMat = trackDisp(
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
    );
    const lampInst = new THREE.InstancedMesh(lampGeo, lampMat, 36);
    for (let i = 0; i < 36; i++) {
      const sIdx = Math.floor((i / 36) * sampleCount);
      const samp = samples[sIdx];
      const side = i % 2 === 0 ? 1 : -1;
      const p = samp.pos.clone().addScaledVector(samp.right, side * (shoulderW + 11));
      dummy.position.set(p.x, 13.0, p.z);
      dummy.scale.setScalar(1);
      dummy.rotation.y = Math.atan2(samp.tangent.x, samp.tangent.z);
      dummy.updateMatrix();
      lampInst.setMatrixAt(i, dummy.matrix);
    }
    lampInst.instanceMatrix.needsUpdate = true;
    lampInst.computeBoundingSphere();
    group.add(lampInst);
  }

  return {
    group,
    samples,
    totalLengthMeters,
    widthMeters: track.widthMeters,
    envConfig,
    startLightMeshes,
    roadMat,
    skyMat,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

export interface TrackProjection {
  sampleIndex: number;
  s: number;
  lateralOffset: number;
  closestPos: THREE.Vector3;
  tangent: THREE.Vector3;
  curvatureAhead: number;
  inDrsZone: boolean;
}

export function projectOntoTrack(
  x: number,
  z: number,
  samples: TrackSample[],
  hintIndex?: number
): TrackProjection {
  const n = samples.length;
  let bestIdx = 0;
  let bestDistSq = Infinity;

  if (hintIndex !== undefined) {
    const windowRadius = 26;
    for (let offset = -windowRadius; offset <= windowRadius; offset++) {
      const idx = (hintIndex + offset + n) % n;
      const dx = x - samples[idx].pos.x;
      const dz = z - samples[idx].pos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = idx;
      }
    }
    if (bestDistSq > 1800) {
      for (let i = 0; i < n; i++) {
        const dx = x - samples[i].pos.x;
        const dz = z - samples[i].pos.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = i;
        }
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const dx = x - samples[i].pos.x;
      const dz = z - samples[i].pos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
  }

  const samp = samples[bestIdx];
  const dx = x - samp.pos.x;
  const dz = z - samp.pos.z;
  const lateralOffset = dx * samp.right.x + dz * samp.right.z;

  let maxCurv = 0;
  for (let k = 2; k <= 14; k++) {
    const c = samples[(bestIdx + k) % n].curvature;
    if (c > maxCurv) maxCurv = c;
  }

  const inDrsZone = maxCurv < 0.08 && samp.curvature < 0.06;

  return {
    sampleIndex: bestIdx,
    s: samp.s,
    lateralOffset,
    closestPos: samp.pos,
    tangent: samp.tangent,
    curvatureAhead: maxCurv,
    inDrsZone,
  };
}
