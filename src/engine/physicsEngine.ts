import * as THREE from 'three';
import {
  BodyStyle,
  CarClass,
  CarTuning,
  ComputedCarSpecs,
  DamageState,
  DriverHealthState,
  DrivingHandlingMode,
  FireToolType,
  PitCrewStats,
  PitStopPhase,
} from '../types/game';
import { computePitCrewStats, DEFAULT_PIT_CREW, EMPTY_DAMAGE, ENGINE_ARCHITECTURES } from '../data/catalog';
import { projectOntoTrack, TrackSample } from './trackGeometry';

export interface RacerBody {
  id: string;
  name: string;
  isPlayer: boolean;
  carClass: CarClass;
  bodyStyle: BodyStyle;
  primaryColor: string;
  secondaryColor: string;
  raceNumber: number;
  specs: ComputedCarSpecs;
  tuning: CarTuning;

  // Dynamic Physics State
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number; // radians, 0 = +Z
  angularVel: number;
  steerAngle: number;
  speedMs: number;
  rpm: number;
  gear: number; // 1..8
  throttle: number;
  brake: number;
  ersCharge: number; // 0..100
  ersActive: boolean;
  drsActive: boolean;
  inDrsZone: boolean;
  slipAmount: number;
  offTrack: boolean;
  inPit: boolean;
  nearPitWindow: boolean;
  pitPhase: PitStopPhase;
  pitElapsedSec: number;
  pitReactionRemainingSec: number;
  pitTireProgress: number; // 0..100
  lastPitStopTimeSec: number | null;

  // Progress & Laps
  sampleHint: number;
  trackS: number;
  prevS: number;
  lap: number;
  totalProgress: number;
  lapStartMs: number;
  bestLapMs: number | null;
  lastLapMs: number | null;
  finished: boolean;
  finishTimeMs: number | null;

  // Suspension attitude & weight transfer (radians)
  chassisPitch: number;
  chassisRoll: number;

  // Subsystem Damage (0..100) & Progressive Structural Fatigue
  damage: DamageState;
  crashCount: number;
  structuralIntegrity: number; // 100 fresh -> 0 fatigued after repeated hits
  crashCooldownSec: number; // gates discrete crash ticks during barrier slides
  impactZones: {
    fl: number;
    fr: number;
    rl: number;
    rr: number;
    nose: number;
    rear: number;
  };
  lastImpactLabel: string | null;

  // Fire & Safety Mechanics
  onFire: boolean;
  fireIntensity: number; // 0..100
  foamShieldSec: number;
  emergencyState: 'none' | 'limp_to_pit' | 'stopped_offtrack' | 'pitting';
  emergencySide: number; // -1 or +1 off-track shoulder side

  // Driver Physical Trauma, Pain & Bleeding State
  driverHealth: DriverHealthState;

  // AI parameters
  aiLaneOffset: number;
  aiSkill: number; // 0.85 .. 1.04
}

export interface RaceControlInput {
  throttle: number; // 0..1
  brake: number;    // 0..1
  steer: number;    // -1 (right) .. +1 (left)
  ers: boolean;
  drs: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
  pitRepair: boolean;
}

export interface PhysicsStepResult {
  impactSeverity: number;
  impactPos: THREE.Vector3 | null;
  impactLabel?: string | null;
}

const GEAR_RATIOS = [0, 3.25, 2.38, 1.84, 1.48, 1.23, 1.05, 0.91, 0.8];

export function createRacerBody(params: {
  id: string;
  name: string;
  isPlayer: boolean;
  carClass: CarClass;
  bodyStyle: BodyStyle;
  primaryColor: string;
  secondaryColor: string;
  raceNumber: number;
  specs: ComputedCarSpecs;
  tuning: CarTuning;
  damage?: DamageState;
  gridSlot: number;
  samples: TrackSample[];
  aiSkill?: number;
}): RacerBody {
  const n = params.samples.length;
  // Place grid behind start line (s=0) staggered left/right
  const backMeters = 6 + params.gridSlot * 8;
  const approxPerSample = 5;
  const startIdx = (n - Math.round(backMeters / approxPerSample) + n) % n;
  const samp = params.samples[startIdx];
  const sideOffset = params.gridSlot % 2 === 0 ? -2.8 : 2.8;
  const pos = samp.pos.clone().addScaledVector(samp.right, sideOffset);
  const heading = Math.atan2(samp.tangent.x, samp.tangent.z);

  return {
    id: params.id,
    name: params.name,
    isPlayer: params.isPlayer,
    carClass: params.carClass,
    bodyStyle: params.bodyStyle,
    primaryColor: params.primaryColor,
    secondaryColor: params.secondaryColor,
    raceNumber: params.raceNumber,
    specs: params.specs,
    tuning: params.tuning,
    x: pos.x,
    y: pos.y,
    z: pos.z,
    vx: 0,
    vz: 0,
    heading,
    angularVel: 0,
    steerAngle: 0,
    speedMs: 0,
    rpm: 2800,
    gear: 1,
    throttle: 0,
    brake: 0,
    ersCharge: 100,
    ersActive: false,
    drsActive: false,
    inDrsZone: false,
    slipAmount: 0,
    offTrack: false,
    inPit: false,
    nearPitWindow: true,
    pitPhase: 'none',
    pitElapsedSec: 0,
    pitReactionRemainingSec: 0,
    pitTireProgress: 100,
    lastPitStopTimeSec: null,
    sampleHint: startIdx,
    trackS: samp.s - 1, // starts slightly negative before line
    prevS: samp.s,
    lap: 1,
    totalProgress: -0.02 - params.gridSlot * 0.005,
    lapStartMs: 0,
    bestLapMs: null,
    lastLapMs: null,
    finished: false,
    finishTimeMs: null,
    chassisPitch: 0,
    chassisRoll: 0,
    damage: params.damage ? { ...params.damage } : { ...EMPTY_DAMAGE },
    crashCount: 0,
    structuralIntegrity: 100,
    crashCooldownSec: 0,
    impactZones: { fl: 0, fr: 0, rl: 0, rr: 0, nose: 0, rear: 0 },
    lastImpactLabel: null,
    onFire: false,
    fireIntensity: 0,
    foamShieldSec: 0,
    emergencyState: 'none',
    emergencySide: params.gridSlot % 2 === 0 ? -1 : 1,
    driverHealth: {
      health: 100,
      painLevel: 0,
      bleedingRate: 0,
      bloodLoss: 0,
      concussion: 0,
      injuryLabel: null,
      isDown: false,
    },
    aiLaneOffset: sideOffset * 0.55,
    aiSkill: params.aiSkill ?? 0.94,
  };
}

export function applyImpactTraumaToDriver(
  car: RacerBody,
  impactSpeedMs: number,
  frontDot: number,
  fireBurn = false
): number {
  const h = car.driverHealth;
  if (fireBurn) {
    h.painLevel = Math.min(100, h.painLevel + 4.5);
    h.health = Math.max(8, h.health - 1.8);
    h.bleedingRate = Math.min(100, h.bleedingRate + 1.2);
    if (!h.injuryLabel) h.injuryLabel = 'Ustioni & Intossicazione Fumo';
    return 0;
  }

  if (impactSpeedMs < 7.5) return 0;

  // Higher G-forces on frontal/side hits vs rear hits; cockpit halo reduces extreme head hits
  const dirMult = frontDot > 0.35 ? 1.18 : Math.abs(frontDot) < 0.35 ? 1.1 : 0.86;
  const gNorm = Math.pow(THREE.MathUtils.clamp((impactSpeedMs - 6) / 38, 0, 1.35), 1.32);
  const painSpike = (5 + gNorm * 36) * dirMult;
  const hpDrop = (2.5 + gNorm * 20) * dirMult;

  h.painLevel = Math.min(100, h.painLevel + painSpike);
  h.health = Math.max(5, h.health - hpDrop);
  h.concussion = Math.min(100, h.concussion + gNorm * 32 * dirMult);

  if (impactSpeedMs > 15 || car.crashCount >= 2) {
    const cutAdd = (4 + gNorm * 24) * dirMult;
    h.bleedingRate = Math.min(100, h.bleedingRate + cutAdd);
    h.bloodLoss = Math.min(100, h.bloodLoss + cutAdd * 0.42);
  }

  if (h.bleedingRate >= 28 || h.painLevel >= 72) {
    h.injuryLabel =
      frontDot > 0.35
        ? 'Trauma Cranico & Emorragia'
        : 'Frattura Costale & Ferite Lacero-Contuse';
  } else if (h.bleedingRate > 8 || h.painLevel >= 38) {
    h.injuryLabel = 'Contusione & Taglio Sanguinante';
  } else {
    h.injuryLabel = 'Contusione da Impatto';
  }

  if (h.health <= 26 || (h.painLevel >= 82 && car.damage.engine >= 75)) {
    h.isDown = true;
  }

  return painSpike;
}

export function computeTireWearMultiplier(
  asphaltTempC: number,
  trackWetness: number
): number {
  const wetness = THREE.MathUtils.clamp(trackWetness, 0, 1);
  // Optimal track window around 26-34 °C; hot asphalt (>35 °C) accelerates rubber thermal degradation
  const thermalLoad =
    asphaltTempC >= 34
      ? 1 + Math.min(0.95, (asphaltTempC - 34) * 0.044)
      : Math.max(0.74, 1 - (34 - asphaltTempC) * 0.013);
  const wetCooling = 1 - wetness * 0.24;
  return Number(Math.max(0.65, thermalLoad * wetCooling).toFixed(2));
}

export function stepRacerPhysics(
  car: RacerBody,
  input: RaceControlInput,
  samples: TrackSample[],
  trackWidthMeters: number,
  totalLaps: number,
  raceTimeMs: number,
  dt: number,
  pitCrewStats?: PitCrewStats,
  trackWetness = 0,
  handlingMode: DrivingHandlingMode = 'sport',
  steerSensitivity = 1.0,
  asphaltTempC = 34
): PhysicsStepResult {
  let impactSeverity = 0;
  let impactPos: THREE.Vector3 | null = null;
  let impactLabel: string | null = null;

  if (car.crashCooldownSec > 0) {
    car.crashCooldownSec = Math.max(0, car.crashCooldownSec - dt);
  }

  if (car.finished) {
    // Gentle coast down after finish line
    car.vx *= Math.max(0, 1 - 1.8 * dt);
    car.vz *= Math.max(0, 1 - 1.8 * dt);
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    car.speedMs = Math.hypot(car.vx, car.vz);
    return { impactSeverity: 0, impactPos: null };
  }

  const proj = projectOntoTrack(car.x, car.z, samples, car.sampleHint);
  car.sampleHint = proj.sampleIndex;
  car.inDrsZone = proj.inDrsZone;

  const halfTrack = trackWidthMeters * 0.5;
  const barrierLimit = halfTrack + 3.6;
  const absLat = Math.abs(proj.lateralOffset);
  car.offTrack = absLat > halfTrack + 0.6;
  // Smooth progressive transition over kerbs & grass runoff (prevents sudden jerks)
  const offTrackBlend = THREE.MathUtils.clamp((absLat - (halfTrack + 0.45)) / 1.8, 0, 1);

  // Pit stop crew service: Reaction delay -> Tire Change & Structural Repairs -> Release
  const crewStats = pitCrewStats ?? computePitCrewStats(DEFAULT_PIT_CREW);
  const nearPitStraight = proj.s < 0.08 || proj.s > 0.92;
  car.nearPitWindow = nearPitStraight;

  if (input.pitRepair && nearPitStraight && car.speedMs < 26) {
    car.inPit = true;
    car.emergencyState = 'pitting';
    car.vx *= Math.max(0, 1 - 5.5 * dt);
    car.vz *= Math.max(0, 1 - 5.5 * dt);
    car.angularVel *= Math.max(0, 1 - 8 * dt);
    // Gently align car into the parallel pit lane box
    const pitBoxLat = -(halfTrack + 5.2);
    const pitLatErr = proj.lateralOffset - pitBoxLat;
    if (Math.abs(pitLatErr) > 0.25) {
      const sRight = samples[proj.sampleIndex].right;
      car.x -= sRight.x * pitLatErr * Math.min(1, dt * 2.5);
      car.z -= sRight.z * pitLatErr * Math.min(1, dt * 2.5);
    }

    if (car.pitPhase === 'none') {
      car.pitPhase = 'reacting';
      car.pitElapsedSec = 0;
      car.pitReactionRemainingSec = crewStats.reactionDelaySec;
      car.pitTireProgress = car.damage.tires > 0.5 ? 0 : 100;
    } else if (car.pitPhase === 'reacting') {
      car.pitElapsedSec += dt;
      car.pitReactionRemainingSec = Math.max(0, car.pitReactionRemainingSec - dt);
      if (car.pitReactionRemainingSec <= 0.001) {
        car.pitReactionRemainingSec = 0;
        car.pitPhase = 'servicing';
      }
    } else if (car.pitPhase === 'servicing') {
      car.pitElapsedSec += dt;

      if (car.pitTireProgress < 100) {
        const tireRate = 100 / Math.max(0.8, crewStats.tireChangeTimeSec);
        car.pitTireProgress = Math.min(100, car.pitTireProgress + tireRate * dt);
        if (car.pitTireProgress >= 100) {
          car.damage.tires = 0;
        }
      } else {
        car.damage.tires = Math.max(0, car.damage.tires - crewStats.repairRatePerSec * dt);
      }

      const repairRate = crewStats.repairRatePerSec * dt;
      car.damage.frontAero = Math.max(0, car.damage.frontAero - repairRate);
      car.damage.rearAero = Math.max(0, car.damage.rearAero - repairRate);
      car.damage.engine = Math.max(0, car.damage.engine - repairRate * 0.95);
      car.damage.suspension = Math.max(0, car.damage.suspension - repairRate);
      car.structuralIntegrity = Math.min(100, car.structuralIntegrity + repairRate * 1.1);
      car.impactZones.fl = Math.max(0, car.impactZones.fl - repairRate * 1.2);
      car.impactZones.fr = Math.max(0, car.impactZones.fr - repairRate * 1.2);
      car.impactZones.rl = Math.max(0, car.impactZones.rl - repairRate * 1.2);
      car.impactZones.rr = Math.max(0, car.impactZones.rr - repairRate * 1.2);
      car.impactZones.nose = Math.max(0, car.impactZones.nose - repairRate * 1.2);
      car.impactZones.rear = Math.max(0, car.impactZones.rear - repairRate * 1.2);

      const sysRate = (crewStats.repairRatePerSec * 0.55 + crewStats.ersRechargePerSec * 0.45) * dt;
      car.damage.gearboxBrakes = Math.max(0, car.damage.gearboxBrakes - sysRate);
      car.ersCharge = Math.min(100, car.ersCharge + crewStats.ersRechargePerSec * dt);

      if (car.onFire) {
        car.fireIntensity = Math.max(0, car.fireIntensity - 55 * dt);
        if (car.fireIntensity <= 1) {
          car.onFire = false;
          car.fireIntensity = 0;
        }
      }

      const allDone =
        car.pitTireProgress >= 100 &&
        car.damage.frontAero < 0.5 &&
        car.damage.rearAero < 0.5 &&
        car.damage.engine < 0.5 &&
        car.damage.suspension < 0.5 &&
        car.damage.tires < 0.5 &&
        car.damage.gearboxBrakes < 0.5 &&
        car.ersCharge >= 99.5;

      if (allDone) {
        car.pitPhase = 'ready';
        car.crashCount = 0;
        car.structuralIntegrity = 100;
        car.impactZones = { fl: 0, fr: 0, rl: 0, rr: 0, nose: 0, rear: 0 };
        car.lastPitStopTimeSec = Number(car.pitElapsedSec.toFixed(2));
        car.emergencyState = 'none';
      }
    }
  } else {
    if (car.inPit && car.pitPhase === 'servicing' && car.pitTireProgress >= 100) {
      car.lastPitStopTimeSec = Number(car.pitElapsedSec.toFixed(2));
    }
    car.inPit = false;
    car.pitPhase = 'none';
    car.pitReactionRemainingSec = 0;
    if (car.emergencyState === 'pitting') {
      car.emergencyState = 'none';
    }
  }

  // Evaluate Emergency / Retirement / Limp-to-Pit status
  if (!car.inPit) {
    const catastrophicFailure =
      car.damage.engine >= 94 ||
      car.damage.suspension >= 94 ||
      car.driverHealth.isDown ||
      car.driverHealth.health <= 24;
    const needsPitService =
      car.damage.frontAero >= 70 ||
      car.damage.rearAero >= 72 ||
      car.damage.suspension >= 68 ||
      car.damage.engine >= 68 ||
      car.damage.tires >= 82 ||
      car.driverHealth.bleedingRate > 18;

    if (car.onFire || catastrophicFailure) {
      car.emergencyState = 'stopped_offtrack';
    } else if (needsPitService) {
      car.emergencyState = 'limp_to_pit';
    } else if (car.emergencyState !== 'none') {
      car.emergencyState = 'none';
    }
  }

  // Track forward & right vectors in car local frame
  const fwdX = Math.sin(car.heading);
  const fwdZ = Math.cos(car.heading);
  const rightX = Math.cos(car.heading);
  const rightZ = -Math.sin(car.heading);

  const forwardSpeed = car.vx * fwdX + car.vz * fwdZ;
  const lateralSpeed = car.vx * rightX + car.vz * rightZ;

  // ERS & DRS states (rear wing heavy damage disables DRS)
  const archSpec = ENGINE_ARCHITECTURES[car.tuning.engineArch] ?? ENGINE_ARCHITECTURES.V6_HYBRID;
  const isElectricDrivetrain =
    archSpec.powertrainType === 'electric' || car.tuning.engineArch === 'H2_FUEL_CELL';
  car.ersActive = input.ers && car.ersCharge > 2 && input.throttle > 0.2;
  if (car.ersActive) {
    car.ersCharge = Math.max(0, car.ersCharge - (isElectricDrivetrain ? 14 : 18) * dt);
  } else {
    const regenRate = isElectricDrivetrain ? 18 : 11;
    car.ersCharge = Math.min(100, car.ersCharge + (input.brake * regenRate + 2.5) * dt);
  }
  car.drsActive = input.drs && car.inDrsZone && forwardSpeed > 32 && car.damage.rearAero < 65;

  // Subsystem Damage Modifiers
  const misfirePulse =
    car.damage.engine > 58
      ? 1 - Math.max(0, Math.sin(raceTimeMs * 0.022)) * ((car.damage.engine - 58) / 42) * 0.18
      : 1.0;
  const engineHealth = Math.max(0.28, 1 - (car.damage.engine / 100) * 0.72) * misfirePulse;
  const frontAeroHealth = Math.max(0.28, 1 - (car.damage.frontAero / 100) * 0.72);
  const rearAeroHealth = Math.max(0.28, 1 - (car.damage.rearAero / 100) * 0.72);
  const tireHealth = Math.max(0.42, 1 - (car.damage.tires / 100) * 0.58);
  const brakeHealth = Math.max(0.36, 1 - (car.damage.gearboxBrakes / 100) * 0.64);

  // Asymmetric left/right suspension pull scaled smoothly by speed (prevents stationary pull)
  const asymSuspDiff = (car.impactZones.fl + car.impactZones.rl - (car.impactZones.fr + car.impactZones.rr)) / 200;
  const rawPullMag =
    car.damage.suspension > 16
      ? ((car.damage.suspension - 16) / 84) * 0.048 * (Math.abs(asymSuspDiff) > 0.02 ? Math.sign(asymSuspDiff) : 1)
      : 0;
  const suspensionPull = rawPullMag * Math.min(1, Math.abs(forwardSpeed) / 16);

  car.throttle = input.throttle;
  car.brake = input.brake;

  // Engine RPM & Realistic Sequential Gearbox
  const maxRpm = car.specs.maxRpm;
  const topSpeedMs = car.specs.topSpeedKmh / 3.6;
  const targetRatioSpeed = Math.max(0, forwardSpeed) / topSpeedMs;
  const idealGear = Math.max(1, Math.min(8, Math.floor(targetRatioSpeed * 7.6) + 1));
  if (Math.abs(idealGear - car.gear) >= 1) {
    car.gear = idealGear;
  }

  const gearTopMs = (topSpeedMs / GEAR_RATIOS[car.gear]) * 0.85;
  const rpmNorm = THREE.MathUtils.clamp(
    0.22 + (Math.max(0, forwardSpeed) / Math.max(12, gearTopMs)) * 0.78,
    0.18,
    1.03
  );
  car.rpm = THREE.MathUtils.lerp(car.rpm, rpmNorm * maxRpm, Math.min(1, dt * 13));

  // Wet track & asphalt temperature tire grip multipliers
  const wetness = THREE.MathUtils.clamp(trackWetness, 0, 1);
  const wornInWetPenalty = wetness > 0.25 ? (car.damage.tires / 100) * wetness * 0.22 : 0;
  const thermalGripMult =
    asphaltTempC < 21
      ? Math.max(0.93, 1 - (21 - asphaltTempC) * 0.008)
      : asphaltTempC > 44
      ? Math.max(0.92, 1 - (asphaltTempC - 44) * 0.006)
      : 1.02;
  const wetGripMult = Math.max(0.45, (1 - wetness * 0.31 - wornInWetPenalty) * thermalGripMult);
  const wetBrakeMult = Math.max(0.55, 1 - wetness * 0.24);

  // Aero downforce load (scales quadratically with speed and intact wings)
  const avgAeroHealth = (frontAeroHealth + rearAeroHealth) * 0.5;
  const aeroSpeedFactor = Math.min(1.55, (Math.max(0, forwardSpeed) / 76) ** 2);
  const downforceLoad = 1 + car.specs.downforceG * 0.28 * avgAeroHealth * aeroSpeedFactor;

  // Traction Control & Electronic Stability Modulation
  const absActive = handlingMode === 'assist' || handlingMode === 'sport';
  const tcStrength = handlingMode === 'assist' ? 0.96 : handlingMode === 'sport' ? 0.68 : 0.08;
  const escStrength = handlingMode === 'assist' ? 0.92 : handlingMode === 'sport' ? 0.62 : 0.2;
  const cornerLoadFrac = Math.min(1, Math.abs(car.steerAngle) * 2.2);

  // Longitudinal Force + Engine Braking (Instant flat torque curve for Electric / Fuel-Cell)
  const mass = car.specs.weightKg;
  const ersBoost = car.ersActive ? 1.22 : 1.0;
  const drsSpeedBonus = car.drsActive ? 1.09 : 1.0;
  const effectivePowerWatts = car.specs.powerHp * 745.7 * engineHealth * ersBoost;

  const torqueBand = isElectricDrivetrain
    ? 0.96 + 0.14 * (1 - Math.min(1, forwardSpeed / Math.max(20, topSpeedMs)))
    : 0.72 + 0.36 * Math.sin(Math.min(1, rpmNorm) * Math.PI * 0.88);
  const rawDriveAccel =
    (effectivePowerWatts / (mass * Math.max(isElectricDrivetrain ? 10 : 13, Math.abs(forwardSpeed) + (isElectricDrivetrain ? 10 : 13)))) *
    torqueBand *
    (car.tuning.finalDrive / 3.55);

  const rearTractionCeiling = 18.6 * tireHealth * wetGripMult * (1 + downforceLoad * 0.16);
  const excessTorque = Math.max(0, rawDriveAccel * input.throttle - rearTractionCeiling * (1 - cornerLoadFrac * 0.24));
  const powerOversteerFactor =
    excessTorque > 0.3 ? (1 - tcStrength) * Math.min(0.65, excessTorque * 0.14) : 0;

  const driveForce =
    input.throttle * Math.min(rearTractionCeiling * (1 + tcStrength * 0.14), rawDriveAccel);

  // Braking Force (with realistic lockup penalty in 'sim' mode)
  const lockupPenalty =
    !absActive && input.brake > 0.9 && forwardSpeed < 32 ? 0.85 - wetness * 0.1 : 1.0;
  const maxBrakeDecel =
    26.0 * tireHealth * brakeHealth * downforceLoad * wetBrakeMult * lockupPenalty;
  const brakeForce = input.brake * maxBrakeDecel;

  // Aero Drag, Engine Braking & Smooth Surface Resistance
  const dragCoeff = (car.drsActive ? 0.68 : 1.0) * (1 / drsSpeedBonus);
  const aeroDrag = 0.0014 * dragCoeff * forwardSpeed * Math.abs(forwardSpeed);
  const engineBraking =
    input.throttle < 0.05 && input.brake < 0.05 && forwardSpeed > 2 ? 1.4 : 0;
  const wetRollingDrag = wetness * 0.014 * forwardSpeed;
  const offTrackDrag = offTrackBlend * (0.056 * forwardSpeed + Math.sign(forwardSpeed) * 3.8);
  const surfaceDrag = 0.008 * forwardSpeed + offTrackDrag + wetRollingDrag + engineBraking;

  let newForward = forwardSpeed + (driveForce - aeroDrag - surfaceDrag) * dt;
  if (input.brake > 0.05) {
    if (newForward > 0.4) {
      newForward = Math.max(0, newForward - brakeForce * dt);
    } else if (input.throttle < 0.1) {
      newForward = Math.max(-18, newForward - input.brake * 8.5 * dt);
    }
  }

  let maxAllowedMs =
    topSpeedMs * engineHealth * ersBoost * drsSpeedBonus * (1 - wetness * 0.05);
  if (car.onFire || car.damage.engine >= 94 || car.damage.suspension >= 94) {
    // Critical failure / active fire forces emergency coast-down / limp speed to pull over or pit
    maxAllowedMs = Math.min(maxAllowedMs, car.onFire ? 18 : 22);
  }
  newForward = Math.min(maxAllowedMs, newForward);

  // Weight Transfer & Trail Braking
  const longAccel = (newForward - forwardSpeed) / Math.max(0.004, dt);
  const brakeWeightShift = THREE.MathUtils.clamp(-longAccel / 22, -0.35, 0.45);
  const trailBrakeTurnBoost = 1 + Math.max(0, brakeWeightShift) * 0.18 * frontAeroHealth;

  // Progressive Speed-Adaptive Steering + Smooth Slew-Rate Damping + Realistic Pain Tremor
  const sens = THREE.MathUtils.clamp(steerSensitivity, 0.6, 1.5);
  const absSpd = Math.abs(forwardSpeed);
  const speedSteerCurve =
    1 /
    (1 +
      absSpd * (handlingMode === 'sim' ? 0.028 : 0.033) +
      absSpd * absSpd * (handlingMode === 'sim' ? 0.00038 : 0.00046));
  const painTremor =
    car.driverHealth.painLevel > 35
      ? Math.sin(raceTimeMs * 0.017) * ((car.driverHealth.painLevel - 35) / 65) * 0.06
      : 0;
  const steerInput = THREE.MathUtils.clamp(input.steer * sens + painTremor, -1, 1);
  const targetSteer = steerInput * 0.56 * speedSteerCurve + suspensionPull;

  // Faster return-to-center than turn-in so tapping keys feels smooth & planted
  const isReturningCenter = Math.abs(targetSteer) < Math.abs(car.steerAngle);
  const painReactionScale =
    car.driverHealth.painLevel > 40 ? 1 - ((car.driverHealth.painLevel - 40) / 60) * 0.28 : 1;
  const steerSlewRate = (isReturningCenter ? 14.5 : 8.5) * painReactionScale;
  car.steerAngle = THREE.MathUtils.lerp(
    car.steerAngle,
    targetSteer,
    Math.min(1, dt * steerSlewRate)
  );

  // Lateral Grip & Pacejka Slip Curve (needed before yaw clamping)
  const assistStability = handlingMode === 'assist' ? 1.24 : handlingMode === 'sport' ? 1.1 : 0.98;
  const slipAngleRatio = Math.abs(lateralSpeed) / Math.max(6, absSpd * 0.28);
  const peakSlipCurve =
    slipAngleRatio <= 1.0
      ? 1.0
      : Math.max(0.62, 1.0 - (slipAngleRatio - 1.0) * (handlingMode === 'assist' ? 0.08 : 0.2));

  const lateralGrip =
    car.specs.gripMu *
    assistStability *
    tireHealth *
    rearAeroHealth *
    wetGripMult *
    peakSlipCurve *
    (1 - offTrackBlend * 0.42) *
    downforceLoad;

  // Physical Centripetal Acceleration Limit on Yaw Rate (prevents unnatural spin-out at 250+ km/h!)
  const kinematicYaw =
    (newForward / 2.95) *
    Math.tan(car.steerAngle) *
    frontAeroHealth *
    trailBrakeTurnBoost *
    (1 - offTrackBlend * 0.24) *
    (1 - wetness * 0.11);
  const maxLatAccel = lateralGrip * 11.4;
  const maxPhysicalYaw =
    absSpd > 9 ? maxLatAccel / Math.max(9, absSpd) : 1.75;
  const clampedBaseYaw = THREE.MathUtils.clamp(
    kinematicYaw,
    -maxPhysicalYaw,
    maxPhysicalYaw
  );

  // ESC / Self-Aligning Counter-Yaw Damping when sliding laterally
  const driftRatio = THREE.MathUtils.clamp(lateralSpeed / Math.max(8, absSpd), -0.65, 0.65);
  const escCounterYaw = -driftRatio * (0.65 + escStrength * 1.45);
  const oversteerYaw =
    powerOversteerFactor * Math.sign(car.steerAngle || 0.001) * 0.36;

  const targetYawRate = clampedBaseYaw + oversteerYaw + escCounterYaw;
  // Rotational Inertia Smoothing (chassis mass resists sudden yaw snaps)
  const yawResponseRate = handlingMode === 'assist' ? 13.5 : handlingMode === 'sport' ? 11.5 : 9.5;
  car.angularVel = THREE.MathUtils.lerp(
    car.angularVel,
    targetYawRate,
    Math.min(1, dt * yawResponseRate)
  );
  car.heading += car.angularVel * dt;

  // Strong, planted lateral tire bite
  const lateralDamp = Math.exp(-lateralGrip * (6.8 + escStrength * 1.6) * dt);
  const newLateral = lateralSpeed * lateralDamp;
  car.slipAmount = Math.min(
    1.5,
    Math.abs(lateralSpeed) / Math.max(7, absSpd * 0.36) +
      wetness * 0.12 +
      powerOversteerFactor * 0.4
  );

  // Dynamic Suspension Pitch (nose dive / squat) & Body Roll (cornering G)
  const latAccel = car.angularVel * newForward;
  const stiffnessDamp = THREE.MathUtils.clamp(1.2 - car.tuning.suspensionStiff * 0.055, 0.55, 1.15);
  const targetPitch = THREE.MathUtils.clamp(-longAccel * 0.0016 * stiffnessDamp, -0.042, 0.042);
  const targetRoll = THREE.MathUtils.clamp(latAccel * 0.0022 * stiffnessDamp, -0.065, 0.065);
  car.chassisPitch = THREE.MathUtils.lerp(car.chassisPitch, targetPitch, Math.min(1, dt * 11));
  car.chassisRoll = THREE.MathUtils.lerp(car.chassisRoll, targetRoll, Math.min(1, dt * 10));

  // Progressive Thermal Tire Degradation & High-RPM Engine Wear
  if (!car.inPit && Math.abs(newForward) > 8) {
    const thermalWearMult = computeTireWearMultiplier(asphaltTempC, wetness);
    const highSpeedThermalAbrasion =
      Math.max(0, asphaltTempC - 33) * 0.0042 * Math.min(1.4, absSpd / 65);
    const tireWearRate =
      ((car.slipAmount * 0.25 + input.brake * 0.1 + offTrackBlend * 0.45) * thermalWearMult +
        highSpeedThermalAbrasion) *
      dt;
    car.damage.tires = Math.min(100, car.damage.tires + tireWearRate);
    if (rpmNorm > 0.96 && input.throttle > 0.8 && wetness < 0.6) {
      const heatStress = asphaltTempC > 42 ? 1.25 : 1.0;
      car.damage.engine = Math.min(100, car.damage.engine + 0.14 * heatStress * dt);
    }
  }

  // Reconstruct world velocity
  const nFwdX = Math.sin(car.heading);
  const nFwdZ = Math.cos(car.heading);
  const nRightX = Math.cos(car.heading);
  const nRightZ = -Math.sin(car.heading);

  car.vx = nFwdX * newForward + nRightX * newLateral;
  car.vz = nFwdZ * newForward + nRightZ * newLateral;

  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.y = THREE.MathUtils.lerp(car.y, proj.closestPos.y, Math.min(1, dt * 16));
  car.speedMs = Math.hypot(car.vx, car.vz);

  // Realistic Barrier / Tecpro Guardrail Collision Physics (Crumple Absorption, Yaw Deflection & Left/Right Zone Damage)
  const postProj = projectOntoTrack(car.x, car.z, samples, car.sampleHint);
  if (Math.abs(postProj.lateralOffset) > barrierLimit) {
    const sign = Math.sign(postProj.lateralOffset);
    const excess = Math.abs(postProj.lateralOffset) - barrierLimit;
    const rightVec = samples[postProj.sampleIndex].right;

    // Push car cleanly inside barrier
    car.x -= rightVec.x * sign * excess;
    car.z -= rightVec.z * sign * excess;

    const wallNormalX = -rightVec.x * sign;
    const wallNormalZ = -rightVec.z * sign;
    const intoWallSpeed = -(car.vx * wallNormalX + car.vz * wallNormalZ);

    if (intoWallSpeed > 1.5) {
      impactPos = new THREE.Vector3(car.x, car.y + 0.45, car.z);

      // Deflect cleanly along barrier with energy absorption & friction scrub
      const restitution = intoWallSpeed > 20 ? 1.26 : 1.1;
      const scrapeScrub = intoWallSpeed > 20 ? 0.74 : 0.91;
      car.vx = (car.vx + wallNormalX * intoWallSpeed * restitution) * scrapeScrub;
      car.vz = (car.vz + wallNormalZ * intoWallSpeed * restitution) * scrapeScrub;

      // Determine exact chassis impact side (Front / Rear / Left / Right)
      const frontDot = -(nFwdX * wallNormalX + nFwdZ * wallNormalZ); // +1 nose hit, -1 rear hit
      const rightDot = -(nRightX * wallNormalX + nRightZ * wallNormalZ); // +1 right hit, -1 left hit
      const frontWeight = THREE.MathUtils.clamp((frontDot + 0.25) * 1.05, 0.1, 1.0);
      const rearWeight = THREE.MathUtils.clamp((-frontDot + 0.25) * 1.05, 0.1, 1.0);
      const sideWeight = 1.0 - Math.abs(frontDot) * 0.5;
      const hitRightSide = rightDot >= 0;

      // Glancing wall impact induces realistic yaw bounce + suspension shock jolt
      const yawTorque = rightDot * Math.sign(frontDot || 1) * Math.min(1.6, intoWallSpeed * 0.048);
      car.angularVel = THREE.MathUtils.clamp(car.angularVel + yawTorque, -2.4, 2.4);
      car.chassisPitch = THREE.MathUtils.clamp(car.chassisPitch + frontDot * 0.04, -0.06, 0.06);
      car.chassisRoll = THREE.MathUtils.clamp(car.chassisRoll - rightDot * 0.055, -0.09, 0.09);

      if (intoWallSpeed < 5.5 || car.crashCooldownSec > 0) {
        // Continuous barrier scrape / mild brush -> sparks & sidepod scuffing without stacking crash events
        impactSeverity = Math.min(0.28, intoWallSpeed / 32);
        const scrapeDmg = Math.min(1.4, (intoWallSpeed / 12) * dt * 16);
        car.damage.frontAero = Math.min(100, car.damage.frontAero + scrapeDmg * frontWeight * 0.8);
        car.damage.tires = Math.min(100, car.damage.tires + scrapeDmg * 0.6);
        if (hitRightSide) {
          car.impactZones.fr = Math.min(100, car.impactZones.fr + scrapeDmg * frontWeight);
          car.impactZones.rr = Math.min(100, car.impactZones.rr + scrapeDmg * rearWeight);
        } else {
          car.impactZones.fl = Math.min(100, car.impactZones.fl + scrapeDmg * frontWeight);
          car.impactZones.rl = Math.min(100, car.impactZones.rl + scrapeDmg * rearWeight);
        }
      } else {
        // Primary High-Energy Barrier Crash
        car.crashCooldownSec = 0.42;
        impactSeverity = Math.min(1, intoWallSpeed / 44);
        car.crashCount += 1;
        car.structuralIntegrity = Math.max(
          0,
          car.structuralIntegrity - Math.min(26, intoWallSpeed * 0.52)
        );
        const fatigueMult = 0.48 + (1 - car.structuralIntegrity / 100) * 0.82;
        const energyNorm = Math.pow(THREE.MathUtils.clamp((intoWallSpeed - 4) / 42, 0, 1.2), 1.38);
        const baseHitDmg = (4.8 + energyNorm * 26) * fatigueMult;

        car.damage.frontAero = Math.min(100, car.damage.frontAero + baseHitDmg * frontWeight * 0.95);
        car.damage.rearAero = Math.min(100, car.damage.rearAero + baseHitDmg * rearWeight * 0.85);
        car.damage.suspension = Math.min(100, car.damage.suspension + baseHitDmg * sideWeight * 0.78);
        car.damage.tires = Math.min(100, car.damage.tires + baseHitDmg * 0.38);
        car.damage.gearboxBrakes = Math.min(
          100,
          car.damage.gearboxBrakes + baseHitDmg * rearWeight * 0.44
        );
        const engineShare = intoWallSpeed > 28 || car.crashCount >= 2 ? 0.54 : 0.2;
        car.damage.engine = Math.min(100, car.damage.engine + baseHitDmg * engineShare);

        // Record localized asymmetric zone deformation
        if (frontDot > 0.45) {
          car.impactZones.nose = Math.min(100, car.impactZones.nose + baseHitDmg * 1.15);
          impactLabel = hitRightSide ? 'Urto Muso Destro' : 'Urto Muso Sinistro';
        } else if (frontDot < -0.45) {
          car.impactZones.rear = Math.min(100, car.impactZones.rear + baseHitDmg * 1.15);
          impactLabel = 'Urto Posteriore / Cambio';
        } else {
          impactLabel = hitRightSide ? 'Urto Fiancata Destra' : 'Urto Fiancata Sinistra';
        }
        if (hitRightSide) {
          car.impactZones.fr = Math.min(100, car.impactZones.fr + baseHitDmg * frontWeight);
          car.impactZones.rr = Math.min(100, car.impactZones.rr + baseHitDmg * rearWeight);
        } else {
          car.impactZones.fl = Math.min(100, car.impactZones.fl + baseHitDmg * frontWeight);
          car.impactZones.rl = Math.min(100, car.impactZones.rl + baseHitDmg * rearWeight);
        }
        car.lastImpactLabel = impactLabel;
        applyImpactTraumaToDriver(car, intoWallSpeed, frontDot, false);
      }

      if (car.damage.engine >= 84 && car.crashCount >= 2 && car.foamShieldSec <= 0 && !car.onFire) {
        car.onFire = true;
        car.fireIntensity = Math.max(car.fireIntensity, 50);
      }
    }
  }

  // Fire progression & thermal damage tick + active bleeding & pain dynamics
  if (car.foamShieldSec > 0) {
    car.foamShieldSec = Math.max(0, car.foamShieldSec - dt);
  }
  if (car.damage.engine >= 86 && car.crashCount >= 2 && car.foamShieldSec <= 0 && !car.onFire) {
    car.onFire = true;
    car.fireIntensity = 52;
  }
  if (car.onFire) {
    car.fireIntensity = Math.min(100, car.fireIntensity + 3.0 * dt);
    car.damage.engine = Math.min(98, car.damage.engine + 1.6 * dt);
    car.damage.tires = Math.min(98, car.damage.tires + 0.8 * dt);
    applyImpactTraumaToDriver(car, 0, 0, true);
    if (car.fireIntensity <= 0.5) {
      car.onFire = false;
      car.fireIntensity = 0;
    }
  }

  // Realistic Bleeding Drain & Slow Natural Adrenaline Pain Recovery
  if (car.driverHealth.bleedingRate > 0) {
    const drainPerSec = (car.driverHealth.bleedingRate / 100) * 1.45;
    car.driverHealth.bloodLoss = Math.min(100, car.driverHealth.bloodLoss + drainPerSec * 1.3 * dt);
    car.driverHealth.health = Math.max(4, car.driverHealth.health - drainPerSec * dt);
    car.driverHealth.painLevel = Math.min(100, car.driverHealth.painLevel + drainPerSec * 0.45 * dt);
    if (car.driverHealth.health <= 22) {
      car.driverHealth.isDown = true;
    }
  } else if (car.driverHealth.painLevel > 0) {
    car.driverHealth.painLevel = Math.max(0, car.driverHealth.painLevel - 0.9 * dt);
  }
  if (car.driverHealth.concussion > 0) {
    car.driverHealth.concussion = Math.max(0, car.driverHealth.concussion - 1.8 * dt);
  }

  // Lap & Progress Tracking (wrap-around s from >0.88 to <0.12)
  const newS = postProj.s;
  if (car.prevS > 0.85 && newS < 0.15) {
    // Crossed Start/Finish forward
    if (car.totalProgress > car.lap - 0.35) {
      const lapDuration = raceTimeMs - car.lapStartMs;
      if (car.lapStartMs > 0 && lapDuration > 4000) {
        car.lastLapMs = lapDuration;
        if (car.bestLapMs === null || lapDuration < car.bestLapMs) {
          car.bestLapMs = lapDuration;
        }
      }
      car.lapStartMs = raceTimeMs;
      if (car.lap >= totalLaps) {
        car.finished = true;
        car.finishTimeMs = raceTimeMs;
      } else {
        car.lap += 1;
      }
    }
  } else if (car.prevS < 0.15 && newS > 0.85 && car.lap > 1) {
    // Crossed backward
    car.lap = Math.max(1, car.lap - 1);
  }
  car.prevS = newS;
  car.trackS = newS;
  car.totalProgress = (car.lap - 1) + newS;

  return { impactSeverity, impactPos, impactLabel };
}

export function resolveCarToCarCollisions(cars: RacerBody[]): PhysicsStepResult {
  let maxImpact = 0;
  let impactPos: THREE.Vector3 | null = null;
  let impactLabel: string | null = null;

  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);
      // Fast broadphase check
      if (dist <= 0.001 || dist > 4.8) continue;

      // Oriented chassis footprint check (length ~4.5m, width ~1.95m)
      const ux = dx / dist;
      const uz = dz / dist;
      const aAlign = Math.abs(Math.sin(a.heading) * ux + Math.cos(a.heading) * uz);
      const bAlign = Math.abs(Math.sin(b.heading) * ux + Math.cos(b.heading) * uz);
      const aRadius = 0.98 + aAlign * 1.25;
      const bRadius = 0.98 + bAlign * 1.25;
      const minDist = (aRadius + bRadius) * 0.96;

      if (dist < minDist) {
        const nx = ux;
        const nz = uz;
        const overlap = minDist - dist;
        const invMassA = 1 / Math.max(400, a.specs.weightKg);
        const invMassB = 1 / Math.max(400, b.specs.weightKg);
        const invSum = invMassA + invMassB;
        const shareA = invMassA / invSum;
        const shareB = invMassB / invSum;

        a.x -= nx * overlap * shareA;
        a.z -= nz * overlap * shareA;
        b.x += nx * overlap * shareB;
        b.z += nz * overlap * shareB;

        const rvx = b.vx - a.vx;
        const rvz = b.vz - a.vz;
        const velAlongNormal = rvx * nx + rvz * nz;

        if (velAlongNormal < 0) {
          // Mass-weighted impulse with realistic energy loss (restitution ~ 0.38)
          const impulse = -(1.38 * velAlongNormal) / invSum;
          a.vx -= nx * impulse * invMassA;
          a.vz -= nz * impulse * invMassA;
          b.vx += nx * impulse * invMassB;
          b.vz += nz * impulse * invMassB;

          const impactVel = Math.abs(velAlongNormal);
          const sev = Math.min(1, impactVel / 34);
          if (sev > 0.08) {
            maxImpact = Math.max(maxImpact, sev);
            impactPos = new THREE.Vector3((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 + 0.5, (a.z + b.z) * 0.5);

            // Directional axes for both cars
            const aFwdDot = Math.sin(a.heading) * nx + Math.cos(a.heading) * nz;
            const aRightDot = Math.cos(a.heading) * nx - Math.sin(a.heading) * nz;
            const bFwdDot = Math.sin(b.heading) * -nx + Math.cos(b.heading) * -nz;
            const bRightDot = Math.cos(b.heading) * -nx - Math.sin(b.heading) * -nz;

            // Off-center rotational torque & suspension jolt
            a.angularVel = THREE.MathUtils.clamp(
              a.angularVel + aRightDot * aFwdDot * Math.min(1.4, impactVel * 0.055),
              -2.2,
              2.2
            );
            b.angularVel = THREE.MathUtils.clamp(
              b.angularVel + bRightDot * bFwdDot * Math.min(1.4, impactVel * 0.055),
              -2.2,
              2.2
            );
            a.chassisRoll = THREE.MathUtils.clamp(a.chassisRoll - aRightDot * 0.045, -0.08, 0.08);
            b.chassisRoll = THREE.MathUtils.clamp(b.chassisRoll - bRightDot * 0.045, -0.08, 0.08);

            if (impactVel < 5.0) {
              // Mild wheel-to-wheel rub -> light scuffing
              const rub = (impactVel / 5.0) * 1.6;
              a.damage.tires = Math.min(100, a.damage.tires + rub);
              b.damage.tires = Math.min(100, b.damage.tires + rub);
            } else {
              const applyCarImpact = (
                car: RacerBody,
                fwdDot: number,
                rightDot: number,
                massShare: number
              ) => {
                if (car.crashCooldownSec > 0) return;
                car.crashCooldownSec = 0.32;
                car.crashCount += 1;
                const scaledImpact = impactVel * (0.65 + massShare * 0.7);
                car.structuralIntegrity = Math.max(
                  0,
                  car.structuralIntegrity - Math.min(18, scaledImpact * 0.42)
                );
                const fatigue = 0.48 + (1 - car.structuralIntegrity / 100) * 0.75;
                const baseDmg = sev * (0.7 + massShare * 0.65) * 13.5 * fatigue;

                const fW = fwdDot > 0.15 ? 0.98 : 0.2;
                const rW = fwdDot < -0.15 ? 0.95 : 0.18;
                car.damage.frontAero = Math.min(100, car.damage.frontAero + baseDmg * fW);
                car.damage.rearAero = Math.min(100, car.damage.rearAero + baseDmg * rW);
                car.damage.suspension = Math.min(100, car.damage.suspension + baseDmg * 0.56);
                car.damage.gearboxBrakes = Math.min(100, car.damage.gearboxBrakes + baseDmg * rW * 0.35);

                if (fwdDot > 0.45) car.impactZones.nose = Math.min(100, car.impactZones.nose + baseDmg);
                if (fwdDot < -0.45) car.impactZones.rear = Math.min(100, car.impactZones.rear + baseDmg);
                if (rightDot >= 0) {
                  car.impactZones.fr = Math.min(100, car.impactZones.fr + baseDmg * fW);
                  car.impactZones.rr = Math.min(100, car.impactZones.rr + baseDmg * rW);
                } else {
                  car.impactZones.fl = Math.min(100, car.impactZones.fl + baseDmg * fW);
                  car.impactZones.rl = Math.min(100, car.impactZones.rl + baseDmg * rW);
                }

                if (car.isPlayer) {
                  impactLabel =
                    fwdDot > 0.4
                      ? 'Contatto Anteriore'
                      : fwdDot < -0.4
                      ? 'Tamponamento Posteriore'
                      : rightDot >= 0
                      ? 'Contatto Ruota Destra'
                      : 'Contatto Ruota Sinistra';
                  car.lastImpactLabel = impactLabel;
                }

                applyImpactTraumaToDriver(car, scaledImpact, fwdDot, false);

                if (car.damage.engine >= 84 && car.crashCount >= 2 && car.foamShieldSec <= 0 && !car.onFire) {
                  car.onFire = true;
                  car.fireIntensity = 52;
                }
              };

              applyCarImpact(a, aFwdDot, aRightDot, shareA);
              applyCarImpact(b, bFwdDot, bRightDot, shareB);
            }
          }
        }
      }
    }
  }
  return { impactSeverity: maxImpact, impactPos, impactLabel };
}

export function applyFireToolToCar(car: RacerBody, tool: FireToolType): boolean {
  if (!car.onFire) return false;
  switch (tool) {
    case 'extinguisher':
      car.fireIntensity = Math.max(0, car.fireIntensity - 34);
      car.damage.engine = Math.max(0, car.damage.engine - 6);
      break;
    case 'water_cannon':
      car.fireIntensity = Math.max(0, car.fireIntensity - 46);
      car.damage.tires = Math.max(0, car.damage.tires - 8);
      break;
    case 'foam_afff':
      car.fireIntensity = Math.max(0, car.fireIntensity - 38);
      car.foamShieldSec = 18;
      break;
    case 'ers_cutoff':
      car.fireIntensity = Math.max(0, car.fireIntensity - 42);
      car.damage.engine = Math.max(0, car.damage.engine - 10);
      car.foamShieldSec = Math.max(car.foamShieldSec, 10);
      break;
  }
  if (car.fireIntensity <= 1) {
    car.fireIntensity = 0;
    car.onFire = false;
    return true; // Fire fully extinguished!
  }
  return false;
}

export function applyMedicalTreatmentToDriver(car: RacerBody): void {
  car.driverHealth.bleedingRate = 0;
  car.driverHealth.bloodLoss = Math.max(0, car.driverHealth.bloodLoss * 0.25);
  car.driverHealth.painLevel = Math.max(0, Math.min(18, car.driverHealth.painLevel * 0.25));
  car.driverHealth.concussion = 0;
  car.driverHealth.health = Math.min(100, Math.max(88, car.driverHealth.health + 55));
  car.driverHealth.isDown = false;
  car.driverHealth.injuryLabel = null;
  if (!car.onFire && car.damage.engine < 90 && car.damage.suspension < 90) {
    car.emergencyState = 'none';
  }
}

export function applyMechanicServiceToCar(car: RacerBody): void {
  if (car.onFire) {
    car.onFire = false;
    car.fireIntensity = 0;
  }
  car.damage.frontAero = 0;
  car.damage.rearAero = 0;
  car.damage.engine = 0;
  car.damage.suspension = 0;
  car.damage.tires = 0;
  car.damage.gearboxBrakes = 0;
  car.crashCount = 0;
  car.structuralIntegrity = 100;
  car.impactZones = { fl: 0, fr: 0, rl: 0, rr: 0, nose: 0, rear: 0 };
  car.ersCharge = 100;
  car.lastImpactLabel = null;
  if (!car.driverHealth.isDown && car.driverHealth.health > 24) {
    car.emergencyState = 'none';
  }
}

export function computeAiInput(
  ai: RacerBody,
  samples: TrackSample[],
  trackWidthMeters: number,
  safetyCarSpeedLimitMs?: number,
  trackWetness = 0
): RaceControlInput {
  const n = samples.length;
  const lookAheadSteps = Math.max(4, Math.min(14, Math.round(ai.speedMs * 0.16)));
  const targetIdx = (ai.sampleHint + lookAheadSteps) % n;
  const targetSample = samples[targetIdx];

  // Check if AI must stop off-track in emergency (fire or catastrophic wreck)
  if (ai.emergencyState === 'stopped_offtrack' || ai.onFire) {
    const emergencyShoulder = (trackWidthMeters * 0.5 + 1.85) * ai.emergencySide;
    const tx = targetSample.pos.x + targetSample.right.x * emergencyShoulder;
    const tz = targetSample.pos.z + targetSample.right.z * emergencyShoulder;
    const angleToTarget = Math.atan2(tx - ai.x, tz - ai.z);
    let angleDiff = angleToTarget - ai.heading;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const proj = projectOntoTrack(ai.x, ai.z, samples, ai.sampleHint);
    const alreadyOffShoulder = Math.abs(proj.lateralOffset) > trackWidthMeters * 0.5 + 0.9;
    const brake = ai.speedMs > 1.2 ? (alreadyOffShoulder ? 0.92 : 0.45) : 1.0;
    const throttle = alreadyOffShoulder || ai.speedMs < 6 ? 0 : 0.18;

    return {
      throttle,
      brake,
      steer: alreadyOffShoulder && ai.speedMs < 3 ? 0 : THREE.MathUtils.clamp(angleDiff * 1.8, -1, 1),
      ers: false,
      drs: false,
      shiftUp: false,
      shiftDown: false,
      pitRepair: false,
    };
  }

  // Check if AI is limping back to the Pit Stop for repairs & tire change
  const isLimpingToPit = ai.emergencyState === 'limp_to_pit' || ai.inPit;
  const nearPitStraight = ai.trackS < 0.08 || ai.trackS > 0.91;
  const pitLaneTarget = -(trackWidthMeters * 0.5 + 4.4);

  const desiredLane = isLimpingToPit
    ? nearPitStraight
      ? pitLaneTarget
      : -(trackWidthMeters * 0.34)
    : THREE.MathUtils.clamp(
        ai.aiLaneOffset,
        -(trackWidthMeters * 0.34),
        trackWidthMeters * 0.34
      );
  const tx = targetSample.pos.x + targetSample.right.x * desiredLane;
  const tz = targetSample.pos.z + targetSample.right.z * desiredLane;

  const angleToTarget = Math.atan2(tx - ai.x, tz - ai.z);
  let angleDiff = angleToTarget - ai.heading;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  const steer = THREE.MathUtils.clamp(angleDiff * 2.2, -1, 1);

  let upcomingCurv = 0;
  for (let k = 2; k <= 16; k++) {
    const c = samples[(ai.sampleHint + k) % n].curvature;
    if (c > upcomingCurv) upcomingCurv = c;
  }

  let maxCornerSpeed =
    THREE.MathUtils.clamp(85 / Math.max(0.06, upcomingCurv * 3.4), 24, 98) *
    ai.aiSkill *
    (1 - THREE.MathUtils.clamp(trackWetness, 0, 1) * 0.24);

  if (safetyCarSpeedLimitMs !== undefined) {
    maxCornerSpeed = Math.min(maxCornerSpeed, safetyCarSpeedLimitMs);
  }

  let pitRepair = false;
  if (isLimpingToPit) {
    maxCornerSpeed = Math.min(maxCornerSpeed, nearPitStraight ? 16 : 36);
    if (nearPitStraight && ai.speedMs < 24) {
      pitRepair = true;
      maxCornerSpeed = 0;
    }
  }

  let throttle = 1.0;
  let brake = 0;
  if (pitRepair) {
    throttle = 0;
    brake = 0.85;
  } else if (ai.speedMs > maxCornerSpeed + 5) {
    throttle = 0;
    brake = THREE.MathUtils.clamp((ai.speedMs - maxCornerSpeed) / 22, 0.2, 1);
  } else if (ai.speedMs > maxCornerSpeed) {
    throttle = 0.45;
  }

  return {
    throttle,
    brake,
    steer,
    ers: !isLimpingToPit && safetyCarSpeedLimitMs === undefined && upcomingCurv < 0.08 && ai.ersCharge > 35,
    drs: !isLimpingToPit && safetyCarSpeedLimitMs === undefined && upcomingCurv < 0.06,
    shiftUp: false,
    shiftDown: false,
    pitRepair,
  };
}
