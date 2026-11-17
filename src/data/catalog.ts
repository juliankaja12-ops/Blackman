import {
  CarClass,
  CarModel,
  CarTuning,
  ComponentShopItem,
  ComponentSlot,
  ComputedCarSpecs,
  DamageState,
  EngineArchitecture,
  OwnedCar,
  PitCrewRoleKey,
  PitCrewStats,
  PitCrewUpgrades,
  PowertrainType,
  RankDefinition,
  RankId,
  TrackDefinition,
  TrackPoint,
  UniqueComponent,
} from '../types/game';

export const RANK_LADDER: RankDefinition[] = [
  {
    id: 'bronzo',
    tierIndex: 0,
    name: 'Bronzo',
    minPoints: 0,
    colorHex: '#cd7f32',
    prizeMultiplier: 1.0,
    promotionBonusCr: 0,
    rewardSummary: 'Darwin F3 & Volt-E Gen3 (EV) · Premi 1.0x',
  },
  {
    id: 'argento',
    tierIndex: 1,
    name: 'Argento',
    minPoints: 150,
    colorHex: '#cbd5e1',
    prizeMultiplier: 1.2,
    promotionBonusCr: 8000,
    rewardSummary: '+8.000 CR · Sblocca Veloce GT3 & Idra H₂-GT · Premi 1.2x',
  },
  {
    id: 'oro',
    tierIndex: 2,
    name: 'Oro',
    minPoints: 350,
    colorHex: '#fbbf24',
    prizeMultiplier: 1.45,
    promotionBonusCr: 15000,
    rewardSummary: '+15.000 CR · Sblocca Aurelia GP2 & Kinetix EV-R GT · Premi 1.45x',
  },
  {
    id: 'platino',
    tierIndex: 3,
    name: 'Platino',
    minPoints: 650,
    colorHex: '#22d3ee',
    prizeMultiplier: 1.75,
    promotionBonusCr: 25000,
    rewardSummary: '+25.000 CR · Sblocca Tempesta GT3-R & Elettra Gen4 EV · Premi 1.75x',
  },
  {
    id: 'diamante',
    tierIndex: 4,
    name: 'Diamante',
    minPoints: 1050,
    colorHex: '#60a5fa',
    prizeMultiplier: 2.1,
    promotionBonusCr: 40000,
    rewardSummary: '+40.000 CR · Sblocca Monza LMH & Solaris H₂ Le Mans · Premi 2.1x',
  },
  {
    id: 'champion',
    tierIndex: 5,
    name: 'Champion',
    minPoints: 1550,
    colorHex: '#a855f7',
    prizeMultiplier: 2.5,
    promotionBonusCr: 65000,
    rewardSummary: '+65.000 CR · Sblocca Fenice GP-X & Fulmine Hyper-EV · Premi 2.5x',
  },
  {
    id: 'gran_champion',
    tierIndex: 6,
    name: 'Gran Champion',
    minPoints: 2200,
    colorHex: '#f43f5e',
    prizeMultiplier: 3.0,
    promotionBonusCr: 100000,
    rewardSummary: '+100.000 CR · Sblocca Apex-One F1 & Boreale H₂ F1 · Premi 3.0x',
  },
  {
    id: 'unreal',
    tierIndex: 7,
    name: 'Unreal',
    minPoints: 3000,
    colorHex: '#facc15',
    prizeMultiplier: 3.8,
    promotionBonusCr: 180000,
    rewardSummary: '+180.000 CR · Sblocca Hyperion F1-X & Omega X-Tribrid · Premi 3.8x',
  },
];

export function getRankById(id: RankId): RankDefinition {
  return RANK_LADDER.find((r) => r.id === id) ?? RANK_LADDER[0];
}

export function getRankForPoints(rp: number): RankDefinition {
  const safeRp = Math.max(0, rp || 0);
  let current = RANK_LADDER[0];
  for (const rank of RANK_LADDER) {
    if (safeRp >= rank.minPoints) {
      current = rank;
    }
  }
  return current;
}

export function getNextRank(rp: number): RankDefinition | null {
  const current = getRankForPoints(rp);
  return RANK_LADDER[current.tierIndex + 1] ?? null;
}

export function isRankUnlocked(currentRankId: RankId, requiredRankId: RankId): boolean {
  return getRankById(currentRankId).tierIndex >= getRankById(requiredRankId).tierIndex;
}

export interface NpcDifficultyConfig {
  level: number;
  label: string;
  skillBase: number;
  skillStep: number;
  powerMult: number;
  speedMult: number;
  rewardMult: number;
  rpMult: number;
}

export function getNpcDifficultyConfig(level: number): NpcDifficultyConfig {
  const lvl = Math.max(1, Math.min(10, Math.round(level || 5)));
  const t = (lvl - 1) / 9; // 0..1
  const labels = [
    'Principiante',
    'Accademia',
    'Esordiente',
    'Amatoriale',
    'Competitivo',
    'Pro',
    'Esperto',
    'Élite',
    'Leggenda',
    'Unreal',
  ];
  return {
    level: lvl,
    label: labels[lvl - 1],
    skillBase: Number((0.66 + t * 0.36).toFixed(3)),
    skillStep: Number((0.022 + t * 0.012).toFixed(3)),
    powerMult: Number((0.8 + t * 0.28).toFixed(3)),
    speedMult: Number((0.84 + t * 0.22).toFixed(3)),
    rewardMult: Number((0.75 + t * 1.15).toFixed(2)),
    rpMult: Number((0.65 + t * 1.15).toFixed(2)),
  };
}

export function computeRaceRpEarned(
  position: number,
  npcLevel: number,
  cleanBonus: boolean
): number {
  const baseByPos = [120, 90, 70, 52, 38, 28];
  const base = baseByPos[Math.max(0, Math.min(5, position - 1))] ?? 25;
  const npcCfg = getNpcDifficultyConfig(npcLevel);
  const cleanMult = cleanBonus ? 1.18 : 1.0;
  return Math.round(base * npcCfg.rpMult * cleanMult);
}

export const POWERTRAIN_LABELS: Record<PowertrainType, string> = {
  ice: 'Termico ICE',
  hybrid: 'Ibrido F1/LMH',
  electric: '100% Elettrico EV',
  hydrogen: 'Idrogeno H₂',
};

export const SLOT_LABELS: Record<ComponentSlot, string> = {
  engine_block: 'Propulsore / Celle H₂ / Statore',
  turbo_mgu: 'Turbo / Inverter SiC / MGU',
  ecu: 'Centralina ECU / BMS',
  gearbox: 'Cambio / Riduttore AWD',
  brakes: 'Freni Carbon-Ceramici',
  aero_pack: 'Pacchetto Aerodinamico',
  suspension_kit: 'Sospensioni Push-Rod Titanio',
  cooling_battery: 'Raffreddamento / Serbatoi Cryo',
  differential_ers: 'Differenziale & Recupero ERS',
};

export const ENGINE_ARCHITECTURES: Record<
  EngineArchitecture,
  {
    name: string;
    description: string;
    powertrainType: PowertrainType;
    hasTurbo: boolean;
    powerMult: number;
    torqueMult: number;
    maxRpmLimit: number;
    minRpmLimit: number;
    weightDelta: number;
    soundBaseHz: number;
    soundType: 'v6_turbo' | 'v8_gt' | 'v10_scream' | 'v12_lmh' | 'ev_whine' | 'h2_turbine';
  }
> = {
  V6_HYBRID: {
    name: 'V6 1.6 Turbo Hybrid (F1 Spec)',
    description: 'Recupero energia MGU-K/H, coppia immediata ai medi regimi ed efficienza termica estrema.',
    powertrainType: 'hybrid',
    hasTurbo: true,
    powerMult: 1.06,
    torqueMult: 1.12,
    maxRpmLimit: 15000,
    minRpmLimit: 10500,
    weightDelta: -8,
    soundBaseHz: 95,
    soundType: 'v6_turbo',
  },
  V8_BITURBO: {
    name: 'V8 4.0 Biturbo GT',
    description: 'Spinta corposa ai bassi e medi regimi, ideale per uscita curva e trazione pesante.',
    powertrainType: 'ice',
    hasTurbo: true,
    powerMult: 0.98,
    torqueMult: 1.24,
    maxRpmLimit: 9500,
    minRpmLimit: 7500,
    weightDelta: 18,
    soundBaseHz: 68,
    soundType: 'v8_gt',
  },
  V10_NA: {
    name: 'V10 3.0 Aspirato (19.000 RPM)',
    description: 'Erogazione lineare purissima, allungo leggendario fino a 19.000 giri e risposta istantanea.',
    powertrainType: 'ice',
    hasTurbo: false,
    powerMult: 1.12,
    torqueMult: 0.9,
    maxRpmLimit: 19000,
    minRpmLimit: 14000,
    weightDelta: -16,
    soundBaseHz: 118,
    soundType: 'v10_scream',
  },
  V12_ENDURANCE: {
    name: 'V12 6.5 Endurance Prototipo',
    description: 'Potenza sostenuta ad alta velocità e affidabilità superiore sulle lunghe distanze.',
    powertrainType: 'ice',
    hasTurbo: true,
    powerMult: 1.08,
    torqueMult: 1.14,
    maxRpmLimit: 12000,
    minRpmLimit: 9000,
    weightDelta: 24,
    soundBaseHz: 84,
    soundType: 'v12_lmh',
  },
  EV_DUAL_MOTOR: {
    name: 'Dual-Motor Elettrico AWD 800V',
    description: '100% Elettrico a coppia istantanea piatta fin da 0 km/h, zero emissioni e rigenerazione attiva.',
    powertrainType: 'electric',
    hasTurbo: false,
    powerMult: 1.07,
    torqueMult: 1.32,
    maxRpmLimit: 18000,
    minRpmLimit: 12000,
    weightDelta: 16,
    soundBaseHz: 240,
    soundType: 'ev_whine',
  },
  EV_QUAD_HYPER: {
    name: 'Quad-Motor Hyper-EV 1200V SiC',
    description: 'Quattro motori indipendenti al carburo di silicio con torque vectoring attivo fino a 20.000 RPM.',
    powertrainType: 'electric',
    hasTurbo: false,
    powerMult: 1.16,
    torqueMult: 1.44,
    maxRpmLimit: 20000,
    minRpmLimit: 14500,
    weightDelta: 8,
    soundBaseHz: 295,
    soundType: 'ev_whine',
  },
  H2_ICE_TURBO: {
    name: 'H₂-ICE 2.4 Biturbo Idrogeno',
    description: 'Combustione diretta ad idrogeno liquido ad altissimo numero di ottani, turbo sovralimentato e vapore acqueo.',
    powertrainType: 'hydrogen',
    hasTurbo: true,
    powerMult: 1.09,
    torqueMult: 1.18,
    maxRpmLimit: 13500,
    minRpmLimit: 9500,
    weightDelta: 6,
    soundBaseHz: 106,
    soundType: 'h2_turbine',
  },
  H2_FUEL_CELL: {
    name: 'Cella a Idrogeno PEM + Supercap',
    description: 'Fuel-Cell a idrogeno criogenico accoppiata a supercondensatori da gara: erogazione fluida ed elevata autonomia.',
    powertrainType: 'hydrogen',
    hasTurbo: false,
    powerMult: 1.08,
    torqueMult: 1.28,
    maxRpmLimit: 17000,
    minRpmLimit: 11500,
    weightDelta: -4,
    soundBaseHz: 210,
    soundType: 'h2_turbine',
  },
};

export const CAR_CATALOG: CarModel[] = [
  {
    id: 'darwin_f3',
    name: 'Darwin F3-Junior',
    manufacturer: 'Scuderia Darwin',
    carClass: 'F3',
    powertrainType: 'hybrid',
    price: 0,
    requiredRank: 'bronzo',
    basePowerHp: 385,
    baseTorqueNm: 340,
    baseWeightKg: 670,
    baseDownforce: 1.9,
    baseGrip: 1.38,
    baseTopSpeedKmh: 274,
    defaultEngine: 'V6_HYBRID',
    description: 'Monoposto scuola agile e comunicativa, telaio in fibra di carbonio e aerodinamica pulita.',
    bodyStyle: 'formula',
    defaultPrimary: '#e10600',
    defaultSecondary: '#161922',
  },
  {
    id: 'volt_fe_rookie',
    name: 'Volt-E Gen3 Academy',
    manufacturer: 'Volt Motorsport',
    carClass: 'F3',
    powertrainType: 'electric',
    price: 14500,
    requiredRank: 'bronzo',
    basePowerHp: 470,
    baseTorqueNm: 540,
    baseWeightKg: 760,
    baseDownforce: 1.78,
    baseGrip: 1.41,
    baseTopSpeedKmh: 282,
    defaultEngine: 'EV_DUAL_MOTOR',
    description: 'Monoposto 100% elettrica con passaruota carenati, rigenerazione anteriore da 250 kW e scatto fulmineo.',
    bodyStyle: 'formula_e',
    defaultPrimary: '#06b6d4',
    defaultSecondary: '#0f172a',
  },
  {
    id: 'veloce_gt3',
    name: 'Veloce Corsa GT3',
    manufacturer: 'Officine Veloce',
    carClass: 'GT3',
    powertrainType: 'ice',
    price: 18000,
    requiredRank: 'argento',
    basePowerHp: 560,
    baseTorqueNm: 620,
    baseWeightKg: 1245,
    baseDownforce: 1.55,
    baseGrip: 1.35,
    baseTopSpeedKmh: 298,
    defaultEngine: 'V8_BITURBO',
    description: 'Gran Turismo da competizione con splitter pronunciato, ABS da gara e coppia esplosiva.',
    bodyStyle: 'gt3',
    defaultPrimary: '#f59e0b',
    defaultSecondary: '#111827',
  },
  {
    id: 'hydro_gt_sprint',
    name: 'Idra H₂-GT Sprint',
    manufacturer: 'Idra Engineering',
    carClass: 'GT3',
    powertrainType: 'hydrogen',
    price: 24000,
    requiredRank: 'argento',
    basePowerHp: 610,
    baseTorqueNm: 660,
    baseWeightKg: 1190,
    baseDownforce: 1.72,
    baseGrip: 1.4,
    baseTopSpeedKmh: 306,
    defaultEngine: 'H2_ICE_TURBO',
    description: 'Coupé GT alimentata a idrogeno biturbo con serbatoi criogenici integrati e scarico a vapore puro.',
    bodyStyle: 'gt3',
    defaultPrimary: '#38bdf8',
    defaultSecondary: '#f8fafc',
  },
  {
    id: 'aurelia_f2',
    name: 'Aurelia GP2 Aero',
    manufacturer: 'Aurelia Racing',
    carClass: 'F2',
    powertrainType: 'hybrid',
    price: 42000,
    requiredRank: 'oro',
    basePowerHp: 645,
    baseTorqueNm: 510,
    baseWeightKg: 755,
    baseDownforce: 2.55,
    baseGrip: 1.54,
    baseTopSpeedKmh: 318,
    defaultEngine: 'V6_HYBRID',
    description: 'Anticamera della Formula 1: effetto suolo aggressivo, DRS mobile e frenate al limite.',
    bodyStyle: 'formula',
    defaultPrimary: '#0ea5e9',
    defaultSecondary: '#0f172a',
  },
  {
    id: 'kinetix_ev_gt',
    name: 'Kinetix Tayga EV-R GT',
    manufacturer: 'Kinetix E-Division',
    carClass: 'GT3',
    powertrainType: 'electric',
    price: 46000,
    requiredRank: 'oro',
    basePowerHp: 720,
    baseTorqueNm: 860,
    baseWeightKg: 1260,
    baseDownforce: 1.92,
    baseGrip: 1.48,
    baseTopSpeedKmh: 314,
    defaultEngine: 'EV_DUAL_MOTOR',
    description: 'Granturismo elettrica 800V a doppio asse attivo con splitter sigillato e coppia istantanea da uscita tornante.',
    bodyStyle: 'gt3',
    defaultPrimary: '#22c55e',
    defaultSecondary: '#090d16',
  },
  {
    id: 'tempesta_gt3_evo',
    name: 'Tempesta GT3-R Evo',
    manufacturer: 'Scuderia Tempesta',
    carClass: 'GT3',
    powertrainType: 'ice',
    price: 58000,
    requiredRank: 'platino',
    basePowerHp: 690,
    baseTorqueNm: 710,
    baseWeightKg: 1180,
    baseDownforce: 2.05,
    baseGrip: 1.52,
    baseTopSpeedKmh: 324,
    defaultEngine: 'V8_BITURBO',
    description: 'Evoluzione GT3 a carreggiata allargata con ala a collo di cigno e differenziale elettronico.',
    bodyStyle: 'gt3',
    defaultPrimary: '#06b6d4',
    defaultSecondary: '#090d16',
  },
  {
    id: 'cryo_fe_gen4',
    name: 'Elettra Gen4 Pro AWD',
    manufacturer: 'Elettra Corse',
    carClass: 'F2',
    powertrainType: 'electric',
    price: 64000,
    requiredRank: 'platino',
    basePowerHp: 815,
    baseTorqueNm: 790,
    baseWeightKg: 785,
    baseDownforce: 2.68,
    baseGrip: 1.62,
    baseTopSpeedKmh: 332,
    defaultEngine: 'EV_QUAD_HYPER',
    description: 'Monoposto elettrica Gen4 da 600 kW con quattro inverter al carburo di silicio e ali sdoppiate.',
    bodyStyle: 'formula_e',
    defaultPrimary: '#8b5cf6',
    defaultSecondary: '#e2e8f0',
  },
  {
    id: 'valkyrie_lmh',
    name: 'Monza LMH Hypercar',
    manufacturer: 'Atelier Monza',
    carClass: 'LMH',
    powertrainType: 'ice',
    price: 85000,
    requiredRank: 'diamante',
    basePowerHp: 820,
    baseTorqueNm: 760,
    baseWeightKg: 1030,
    baseDownforce: 2.85,
    baseGrip: 1.62,
    baseTopSpeedKmh: 342,
    defaultEngine: 'V12_ENDURANCE',
    description: 'Prototipo Endurance Le Mans con pinna dorsale stabilizzatrice e spinta V12 ad alta velocità.',
    bodyStyle: 'lmh',
    defaultPrimary: '#10b981',
    defaultSecondary: '#0a0f14',
  },
  {
    id: 'solaris_h2_lmh',
    name: 'Solaris H₂-24 Le Mans',
    manufacturer: 'Solaris Hydrogen Lab',
    carClass: 'LMH',
    powertrainType: 'hydrogen',
    price: 92000,
    requiredRank: 'diamante',
    basePowerHp: 865,
    baseTorqueNm: 820,
    baseWeightKg: 995,
    baseDownforce: 3.05,
    baseGrip: 1.68,
    baseTopSpeedKmh: 348,
    defaultEngine: 'H2_FUEL_CELL',
    description: 'Prototipo endurance a idrogeno Fuel-Cell + supercondensatori, zero emissioni e autonomia da 24 Ore.',
    bodyStyle: 'lmh',
    defaultPrimary: '#0284c7',
    defaultSecondary: '#f1f5f9',
  },
  {
    id: 'fenice_f2_proto',
    name: 'Fenice GP-X Carbon',
    manufacturer: 'Reparto Fenice',
    carClass: 'F2',
    powertrainType: 'ice',
    price: 115000,
    requiredRank: 'champion',
    basePowerHp: 780,
    baseTorqueNm: 590,
    baseWeightKg: 720,
    baseDownforce: 3.1,
    baseGrip: 1.72,
    baseTopSpeedKmh: 348,
    defaultEngine: 'V10_NA',
    description: 'Monoposto sperimentale V10 da 19.000 giri: peso piuma, effetto suolo spinto e trazione Champion.',
    bodyStyle: 'formula',
    defaultPrimary: '#a855f7',
    defaultSecondary: '#111827',
  },
  {
    id: 'apex_ev_hyper',
    name: 'Fulmine Hyper-EV 1200V',
    manufacturer: 'Officina Fulmine',
    carClass: 'LMH',
    powertrainType: 'electric',
    price: 128000,
    requiredRank: 'champion',
    basePowerHp: 1090,
    baseTorqueNm: 1120,
    baseWeightKg: 1040,
    baseDownforce: 3.28,
    baseGrip: 1.76,
    baseTopSpeedKmh: 356,
    defaultEngine: 'EV_QUAD_HYPER',
    description: 'Hypercar elettrica da circuito con 4 motori indipendenti, aerodinamica attiva e canali Venturi passanti.',
    bodyStyle: 'hypercar',
    defaultPrimary: '#ec4899',
    defaultSecondary: '#090d16',
  },
  {
    id: 'apex_f1_works',
    name: 'Apex-One F1 Works',
    manufacturer: 'Darwin Works F1',
    carClass: 'F1',
    powertrainType: 'hybrid',
    price: 160000,
    requiredRank: 'gran_champion',
    basePowerHp: 1020,
    baseTorqueNm: 690,
    baseWeightKg: 798,
    baseDownforce: 3.65,
    baseGrip: 1.85,
    baseTopSpeedKmh: 362,
    defaultEngine: 'V6_HYBRID',
    description: 'La massima espressione della Formula 1: 5G laterali, ala DRS attiva e Power Unit ufficiale.',
    bodyStyle: 'formula',
    defaultPrimary: '#dc2626',
    defaultSecondary: '#f8fafc',
  },
  {
    id: 'boreale_h2_f1',
    name: 'Boreale H₂-Turbo Zero F1',
    manufacturer: 'Boreale Zero GP',
    carClass: 'F1',
    powertrainType: 'hydrogen',
    price: 175000,
    requiredRank: 'gran_champion',
    basePowerHp: 1075,
    baseTorqueNm: 760,
    baseWeightKg: 782,
    baseDownforce: 3.78,
    baseGrip: 1.89,
    baseTopSpeedKmh: 369,
    defaultEngine: 'H2_ICE_TURBO',
    description: 'Monoposto Grand Prix a idrogeno criogenico biturbo con serbatoio dorsale in titanio-carbonio.',
    bodyStyle: 'formula',
    defaultPrimary: '#0ea5e9',
    defaultSecondary: '#e0f2fe',
  },
  {
    id: 'hyperion_f1_unreal',
    name: 'Hyperion Darwin F1-X Unreal',
    manufacturer: 'Darwin Skunkworks',
    carClass: 'F1',
    powertrainType: 'ice',
    price: 240000,
    requiredRank: 'unreal',
    basePowerHp: 1180,
    baseTorqueNm: 760,
    baseWeightKg: 760,
    baseDownforce: 4.15,
    baseGrip: 1.98,
    baseTopSpeedKmh: 382,
    defaultEngine: 'V10_NA',
    description: 'Prototipo F1 senza restrizioni regolamentari riservato ai piloti Unreal: aerodinamica attiva estrema e 19.000 RPM.',
    bodyStyle: 'formula',
    defaultPrimary: '#facc15',
    defaultSecondary: '#09090b',
  },
  {
    id: 'quantum_ev_h2_unreal',
    name: 'Omega X-Tribrid Unreal',
    manufacturer: 'Quantum Lab Italia',
    carClass: 'F1',
    powertrainType: 'hydrogen',
    price: 265000,
    requiredRank: 'unreal',
    basePowerHp: 1260,
    baseTorqueNm: 1080,
    baseWeightKg: 810,
    baseDownforce: 4.28,
    baseGrip: 2.02,
    baseTopSpeedKmh: 390,
    defaultEngine: 'H2_FUEL_CELL',
    description: 'Hyper-prototipo sperimentale Fuel-Cell + Quad-Inverter da 1.260 CV con carico Venturi estremo.',
    bodyStyle: 'hypercar',
    defaultPrimary: '#38bdf8',
    defaultSecondary: '#0f172a',
  },
];

export const EMPTY_DAMAGE: DamageState = {
  frontAero: 0,
  rearAero: 0,
  engine: 0,
  suspension: 0,
  tires: 0,
  gearboxBrakes: 0,
};

export function createDefaultTuning(model: CarModel): CarTuning {
  const arch = ENGINE_ARCHITECTURES[model.defaultEngine];
  const isOpenWheel = model.bodyStyle === 'formula' || model.bodyStyle === 'formula_e';
  return {
    engineArch: model.defaultEngine,
    turboBar: !arch.hasTurbo ? 1.0 : 2.6,
    revLimitRpm: Math.round((arch.minRpmLimit + arch.maxRpmLimit) * 0.56),
    finalDrive: 3.55,
    frontWingDeg: isOpenWheel ? 20 : 14,
    rearWingDeg: isOpenWheel ? 22 : 16,
    brakeBias: 57,
    suspensionStiff: 6,
    rideHeightMm: isOpenWheel ? 28 : 42,
    primaryColor: model.defaultPrimary,
    secondaryColor: model.defaultSecondary,
    finish: 'metallic',
    raceNumber: model.carClass === 'F1' ? 16 : 27,
  };
}

export function createOwnedCar(modelId: string, instanceId: string): OwnedCar {
  const model = CAR_CATALOG.find((m) => m.id === modelId) ?? CAR_CATALOG[0];
  return {
    instanceId,
    modelId: model.id,
    customName: model.name,
    tuning: createDefaultTuning(model),
    installedParts: {},
    damage: { ...EMPTY_DAMAGE },
    mileageKm: 0,
    wins: 0,
  };
}

export function computeCarSpecs(
  model: CarModel,
  car: OwnedCar,
  inventory: UniqueComponent[]
): ComputedCarSpecs {
  const arch = ENGINE_ARCHITECTURES[car.tuning.engineArch] ?? ENGINE_ARCHITECTURES.V6_HYBRID;
  const installed = Object.values(car.installedParts)
    .map((id) => inventory.find((p) => p.id === id))
    .filter((p): p is UniqueComponent => Boolean(p));

  let partPower = 0;
  let partTorque = 0;
  let partGrip = 0;
  let partAero = 0;
  let partWeight = 0;
  let partDurability = 0;

  for (const part of installed) {
    const eff = 0.5 + (part.condition / 100) * 0.5;
    partPower += part.stats.powerDelta * eff;
    partTorque += part.stats.torqueDelta * eff;
    partGrip += part.stats.gripDelta * eff;
    partAero += part.stats.aeroDelta * eff;
    partWeight += part.stats.weightDelta;
    partDurability += part.stats.durabilityDelta;
  }

  const turboFactor = !arch.hasTurbo
    ? 1.04
    : 0.88 + (car.tuning.turboBar - 1.0) * 0.11;
  const revFactor =
    0.92 +
    ((car.tuning.revLimitRpm - arch.minRpmLimit) /
      Math.max(1000, arch.maxRpmLimit - arch.minRpmLimit)) *
      0.14;

  const powerHp = Math.round(
    model.basePowerHp * arch.powerMult * turboFactor * revFactor + partPower
  );
  const torqueNm = Math.round(
    model.baseTorqueNm * arch.torqueMult * turboFactor + partTorque
  );
  const weightKg = Math.max(580, Math.round(model.baseWeightKg + arch.weightDelta + partWeight));

  const wingLoadFactor =
    1 + ((car.tuning.frontWingDeg + car.tuning.rearWingDeg - 36) / 100) * 0.65;
  const downforceG = Number(
    (model.baseDownforce * wingLoadFactor * (1 + partAero / 100)).toFixed(2)
  );
  const gripMu = Number(
    (
      model.baseGrip *
      (1 + partGrip / 100) *
      (1 + (car.tuning.suspensionStiff - 5) * 0.008)
    ).toFixed(2)
  );

  const dragPenalty = (car.tuning.frontWingDeg + car.tuning.rearWingDeg - 36) * 0.42;
  const finalDriveSpeedDelta = (3.55 - car.tuning.finalDrive) * 26;
  const powerToWeightBoost = (powerHp / weightKg - model.basePowerHp / model.baseWeightKg) * 95;
  const topSpeedKmh = Math.round(
    Math.max(210, model.baseTopSpeedKmh + powerToWeightBoost + finalDriveSpeedDelta - dragPenalty)
  );

  const accelRatio = (powerHp / weightKg) * (car.tuning.finalDrive / 3.55);
  const zeroToHundredSec = Number(
    Math.max(1.55, Math.min(4.8, 2.95 / Math.pow(Math.max(0.35, accelRatio), 0.58))).toFixed(2)
  );

  const turboStress = !arch.hasTurbo ? 0 : Math.max(0, (car.tuning.turboBar - 2.8) * 10);
  const revStress = Math.max(
    0,
    ((car.tuning.revLimitRpm - arch.minRpmLimit) /
      Math.max(1000, arch.maxRpmLimit - arch.minRpmLimit) -
      0.7) *
      28
  );
  const reliabilityPct = Math.round(
    Math.max(42, Math.min(100, 92 + partDurability - turboStress - revStress))
  );

  const piIndex = Math.round(
    powerHp * 0.36 + downforceG * 115 + gripMu * 95 + (1400 - weightKg) * 0.18
  );

  return {
    powerHp,
    torqueNm,
    weightKg,
    topSpeedKmh,
    zeroToHundredSec,
    downforceG,
    gripMu,
    reliabilityPct,
    piIndex,
    maxRpm: car.tuning.revLimitRpm,
  };
}

export function computeRepairCost(damage: DamageState, carClass: CarClass): number {
  const classMult: Record<CarClass, number> = {
    F3: 18,
    GT3: 26,
    F2: 34,
    LMH: 48,
    F1: 65,
  };
  const totalPct =
    damage.frontAero +
    damage.rearAero +
    damage.engine +
    damage.suspension +
    damage.tires +
    damage.gearboxBrakes;
  return Math.round((totalPct / 6) * classMult[carClass]);
}

// Compute geometric track length & corner count from control points
export function analyzeTrackPoints(points: TrackPoint[]): {
  lengthKm: number;
  cornersCount: number;
  difficulty: 'Tecnico' | 'Velocissimo' | 'Misto';
  prizePool: number;
} {
  if (points.length < 3) {
    return { lengthKm: 0, cornersCount: 0, difficulty: 'Misto', prizePool: 5000 };
  }
  let totalDist = 0;
  let sharpAngles = 0;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    totalDist += Math.hypot(dx, dz);

    const v1x = p1.x - p0.x;
    const v1z = p1.z - p0.z;
    const v2x = p2.x - p1.x;
    const v2z = p2.z - p1.z;
    const len1 = Math.hypot(v1x, v1z);
    const len2 = Math.hypot(v2x, v2z);
    if (len1 > 1 && len2 > 1) {
      const dot = (v1x * v2x + v1z * v2z) / (len1 * len2);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > 0.34) sharpAngles++;
    }
  }
  const lengthKm = Number(((totalDist * 1.06) / 1000).toFixed(2));
  const cornersCount = Math.max(3, sharpAngles);
  const difficulty: 'Tecnico' | 'Velocissimo' | 'Misto' =
    cornersCount >= 11 ? 'Tecnico' : cornersCount <= 6 ? 'Velocissimo' : 'Misto';
  const prizePool = Math.round(6500 + lengthKm * 3200 + cornersCount * 450);
  return { lengthKm, cornersCount, difficulty, prizePool };
}

function buildStarterTrack(
  id: string,
  name: string,
  author: string,
  environment: TrackDefinition['environment'],
  widthMeters: number,
  laps: number,
  raw: [number, number, number?, number?][]
): TrackDefinition {
  const points: TrackPoint[] = raw.map(([x, z, el = 0, bank = 0]) => ({
    x,
    z,
    elevation: el,
    bankDeg: bank,
  }));
  const stats = analyzeTrackPoints(points);
  return {
    id,
    name,
    author,
    environment,
    widthMeters,
    laps,
    points,
    ...stats,
    isCustom: false,
  };
}

export const STARTER_TRACKS: TrackDefinition[] = [
  buildStarterTrack(
    'monza_velox',
    'Autodromo Velocità Nazionale',
    'FIA / Scuderia Darwin',
    'autodromo_day',
    15,
    3,
    [
      [0, -240, 0, 0],
      [210, -240, 0, 0],
      [330, -210, 0, 2],
      [355, -135, 2, 4],
      [270, -70, 3, 2],
      [245, 30, 1, 0],
      [340, 120, 0, 3],
      [310, 235, 0, 5],
      [140, 260, 0, 2],
      [10, 175, 2, 0],
      [-150, 225, 4, 3],
      [-310, 185, 2, 4],
      [-335, 35, 0, 2],
      [-235, -55, 0, 0],
      [-295, -165, 0, 3],
      [-185, -240, 0, 0],
    ]
  ),
  buildStarterTrack(
    'montecarlo_night',
    'Circuito Cittadino del Porto',
    'Automobile Club GP',
    'night_street',
    12,
    3,
    [
      [-120, -220, 0, 0],
      [110, -220, 0, 0],
      [220, -175, 4, 2],
      [255, -75, 9, 0],
      [165, -25, 11, 2],
      [215, 70, 8, 0],
      [135, 145, 4, 2],
      [230, 220, 1, 3],
      [80, 265, 0, 0],
      [-70, 185, 0, 0],
      [-155, 240, 0, 2],
      [-270, 155, 0, 2],
      [-235, 25, 0, 0],
      [-300, -90, 2, 2],
      [-235, -195, 1, 0],
    ]
  ),
  buildStarterTrack(
    'desert_sakhir',
    'Gran Premio delle Dune',
    'Apex International',
    'desert_sunset',
    16,
    3,
    [
      [-160, -250, 0, 0],
      [180, -250, 0, 0],
      [340, -180, 2, 3],
      [300, -45, 5, 2],
      [145, -75, 6, 0],
      [115, 40, 4, 2],
      [275, 125, 2, 3],
      [240, 250, 0, 4],
      [20, 255, 0, 0],
      [-85, 130, 3, 2],
      [-235, 195, 1, 3],
      [-345, 85, 0, 2],
      [-275, -55, 2, 0],
      [-310, -185, 0, 2],
    ]
  ),
];

export const STARTER_UNIQUE_PARTS: UniqueComponent[] = [
  {
    id: 'part_starter_turbo_01',
    serial: '#MGU-014-DRW',
    name: 'Compressore Split-Shaft Darwin',
    slot: 'turbo_mgu',
    rarity: 'Prototipo',
    compatibleClasses: 'ALL',
    stats: {
      powerDelta: 34,
      torqueDelta: 42,
      gripDelta: 0,
      aeroDelta: 0,
      weightDelta: -2,
      durabilityDelta: 4,
    },
    condition: 96,
    ownerId: 'local',
    ownerName: 'Il Tuo Team',
    originNote: 'Sviluppato al banco prova Darwin Motorsport.',
  },
  {
    id: 'part_starter_brakes_01',
    serial: '#BRK-088-BMB',
    name: 'Pinze Monoblocco Titanio 6-Pistoni',
    slot: 'brakes',
    rarity: 'Prototipo',
    compatibleClasses: 'ALL',
    stats: {
      powerDelta: 0,
      torqueDelta: 0,
      gripDelta: 4,
      aeroDelta: 0,
      weightDelta: -6,
      durabilityDelta: 7,
    },
    condition: 94,
    ownerId: 'local',
    ownerName: 'Il Tuo Team',
    originNote: 'Raffreddamento radiale ad alta dissipazione.',
  },
];

export const COMPONENT_SHOP_CATALOG: ComponentShopItem[] = [
  // engine_block
  {
    catalogId: 'shop_eng_pistons',
    name: 'Pistoni Forgiati Titanio-Alluminuro',
    slot: 'engine_block',
    rarity: 'Prototipo',
    powertrainFocus: 'ice',
    price: 8200,
    stats: { powerDelta: 42, torqueDelta: 34, gripDelta: 0, aeroDelta: 0, weightDelta: -7, durabilityDelta: 6 },
    originNote: 'Gruppo termico alleggerito da F2 con rivestimento DLC.',
  },
  {
    catalogId: 'shop_eng_stator',
    name: 'Statore Assiale Ramato 1200V',
    slot: 'engine_block',
    rarity: 'Factory',
    powertrainFocus: 'electric',
    price: 16500,
    stats: { powerDelta: 74, torqueDelta: 95, gripDelta: 0, aeroDelta: 0, weightDelta: -9, durabilityDelta: 7 },
    originNote: 'Rotore a magneti permanenti Halbach ad altissima densità di coppia.',
  },
  {
    catalogId: 'shop_eng_pem_stack',
    name: 'Stack Celle PEM Idrogeno Platino-Nano',
    slot: 'engine_block',
    rarity: 'Leggendario',
    powertrainFocus: 'hydrogen',
    price: 29000,
    stats: { powerDelta: 96, torqueDelta: 84, gripDelta: 0, aeroDelta: 0, weightDelta: -12, durabilityDelta: 11 },
    originNote: 'Membrana a scambio protonico ad altissima portata per gare Endurance.',
  },
  // turbo_mgu
  {
    catalogId: 'shop_trb_twin_inconel',
    name: 'Turbina Twin-Scroll Inconel-718',
    slot: 'turbo_mgu',
    rarity: 'Factory',
    powertrainFocus: 'ice',
    price: 15800,
    stats: { powerDelta: 68, torqueDelta: 78, gripDelta: 0, aeroDelta: 0, weightDelta: -5, durabilityDelta: 4 },
    originNote: 'Girante su cuscinetti ceramici a bassa inerzia e zero turbo-lag.',
  },
  {
    catalogId: 'shop_trb_sic_inverter',
    name: 'Doppio Inverter Carburo di Silicio SiC',
    slot: 'turbo_mgu',
    rarity: 'Factory',
    powertrainFocus: 'electric',
    price: 17400,
    stats: { powerDelta: 66, torqueDelta: 105, gripDelta: 1, aeroDelta: 0, weightDelta: -6, durabilityDelta: 8 },
    originNote: 'Efficienza di conversione al 99.2% con erogazione immediata.',
  },
  {
    catalogId: 'shop_trb_h2_comp',
    name: 'Compressore Centrifugo Idrogeno Cryo',
    slot: 'turbo_mgu',
    rarity: 'Leggendario',
    powertrainFocus: 'hydrogen',
    price: 28500,
    stats: { powerDelta: 88, torqueDelta: 92, gripDelta: 0, aeroDelta: 0, weightDelta: -7, durabilityDelta: 6 },
    originNote: 'Sovralimentazione criogenica ad alta pressione specifica per H₂.',
  },
  // ecu
  {
    catalogId: 'shop_ecu_telemetry',
    name: 'Centralina Telemetrica Corsa Evo',
    slot: 'ecu',
    rarity: 'Prototipo',
    powertrainFocus: 'all',
    price: 7500,
    stats: { powerDelta: 32, torqueDelta: 28, gripDelta: 3, aeroDelta: 0, weightDelta: -2, durabilityDelta: 8 },
    originNote: 'Mappe motore/ERS adattive in tempo reale curva per curva.',
  },
  {
    catalogId: 'shop_ecu_bms_ai',
    name: 'Modulo BMS Torque-Vectoring 1000 Hz',
    slot: 'ecu',
    rarity: 'Factory',
    powertrainFocus: 'electric',
    price: 14900,
    stats: { powerDelta: 48, torqueDelta: 65, gripDelta: 5, aeroDelta: 0, weightDelta: -3, durabilityDelta: 9 },
    originNote: 'Gestione termica celle e ripartizione coppia millisecondo per millisecondo.',
  },
  {
    catalogId: 'shop_ecu_h2_inj',
    name: 'Controller Iniezione Diretta H₂-Lambda',
    slot: 'ecu',
    rarity: 'Leggendario',
    powertrainFocus: 'hydrogen',
    price: 24500,
    stats: { powerDelta: 72, torqueDelta: 64, gripDelta: 3, aeroDelta: 0, weightDelta: -4, durabilityDelta: 10 },
    originNote: 'Dosaggio stechiometrico H₂ senza detonazione ad altissimi regimi.',
  },
  // gearbox
  {
    catalogId: 'shop_gbx_seamless',
    name: 'Cambio Seamless Carbonio 8 Rapporti',
    slot: 'gearbox',
    rarity: 'Factory',
    powertrainFocus: 'all',
    price: 18500,
    stats: { powerDelta: 22, torqueDelta: 48, gripDelta: 4, aeroDelta: 0, weightDelta: -14, durabilityDelta: 7 },
    originNote: 'Innesti a zero interruzione di coppia in 4 millisecondi.',
  },
  {
    catalogId: 'shop_gbx_ev_2spd',
    name: 'Riduttore Epicicloidale EV 2-Speed Titanio',
    slot: 'gearbox',
    rarity: 'Factory',
    powertrainFocus: 'electric',
    price: 16200,
    stats: { powerDelta: 34, torqueDelta: 72, gripDelta: 4, aeroDelta: 0, weightDelta: -12, durabilityDelta: 9 },
    originNote: 'Doppia riduzione elicoidale per massima accelerazione e V-Max oltre 350 km/h.',
  },
  {
    catalogId: 'shop_gbx_light_fly',
    name: 'Gruppo Volano & Alberi in Magnesio',
    slot: 'gearbox',
    rarity: 'Prototipo',
    powertrainFocus: 'all',
    price: 6800,
    stats: { powerDelta: 16, torqueDelta: 26, gripDelta: 2, aeroDelta: 0, weightDelta: -10, durabilityDelta: 5 },
    originNote: 'Inerzia rotazionale ridotta del 32% in scalata.',
  },
  // brakes
  {
    catalogId: 'shop_brk_ccm_r',
    name: 'Dischi Carbon-Ceramici Forati 410mm',
    slot: 'brakes',
    rarity: 'Prototipo',
    powertrainFocus: 'all',
    price: 7900,
    stats: { powerDelta: 0, torqueDelta: 0, gripDelta: 7, aeroDelta: 2, weightDelta: -8, durabilityDelta: 11 },
    originNote: 'Raffreddamento a 1.200 canali radiali anti-fading.',
  },
  {
    catalogId: 'shop_brk_f1_ccm',
    name: 'Impianto Carbon-Carbon F1 Works + Brake-by-Wire',
    slot: 'brakes',
    rarity: 'Leggendario',
    powertrainFocus: 'all',
    price: 27000,
    stats: { powerDelta: 8, torqueDelta: 10, gripDelta: 13, aeroDelta: 4, weightDelta: -14, durabilityDelta: 15 },
    originNote: 'Decelerazioni fino a 5.8 G integrate con rigenerazione MGU-K.',
  },
  {
    catalogId: 'shop_brk_calipers',
    name: 'Pinze Monoblocco Ricavate dal Pieno Ti-6Al',
    slot: 'brakes',
    rarity: 'Factory',
    powertrainFocus: 'all',
    price: 13500,
    stats: { powerDelta: 0, torqueDelta: 0, gripDelta: 9, aeroDelta: 2, weightDelta: -9, durabilityDelta: 12 },
    originNote: 'Pistoni ventilati in titanio con trattamento termoriflettente.',
  },
  // aero_pack
  {
    catalogId: 'shop_aer_venturi',
    name: 'Fondo Effetto Suolo Venturi Carbon-Prepreg',
    slot: 'aero_pack',
    rarity: 'Factory',
    powertrainFocus: 'all',
    price: 19200,
    stats: { powerDelta: 0, torqueDelta: 0, gripDelta: 6, aeroDelta: 14, weightDelta: -10, durabilityDelta: 5 },
    originNote: 'Canali sigillati ad alta depressione sotto scocca.',
  },
  {
    catalogId: 'shop_aer_drs_active',
    name: 'Ala Biplano Attiva Carbonio Ultra-Light',
    slot: 'aero_pack',
    rarity: 'Leggendario',
    powertrainFocus: 'all',
    price: 31500,
    stats: { powerDelta: 6, torqueDelta: 0, gripDelta: 9, aeroDelta: 20, weightDelta: -13, durabilityDelta: 7 },
    originNote: 'Carico verticale da qualifica con resistenza minima a DRS aperto.',
  },
  {
    catalogId: 'shop_aer_canards',
    name: 'Kit Splitter & Dive-Planes Galleria del Vento',
    slot: 'aero_pack',
    rarity: 'Prototipo',
    powertrainFocus: 'all',
    price: 6900,
    stats: { powerDelta: 0, torqueDelta: 0, gripDelta: 4, aeroDelta: 8, weightDelta: -5, durabilityDelta: 4 },
    originNote: 'Vortici controllati sull’asse anteriore per inserimenti precisi.',
  },
  // suspension_kit
  {
    catalogId: 'shop_sus_pushrod',
    name: 'Braccetti Push-Rod in Fibra di Carbonio',
    slot: 'suspension_kit',
    rarity: 'Prototipo',
    powertrainFocus: 'all',
    price: 7400,
    stats: { powerDelta: 0, torqueDelta: 0, gripDelta: 7, aeroDelta: 3, weightDelta: -9, durabilityDelta: 8 },
    originNote: 'Geometria anti-dive e anti-squat per cordoli aggressivi.',
  },
  {
    catalogId: 'shop_sus_active_hyd',
    name: 'Ammortizzatori Idraulici Attivi Heave-Spring',
    slot: 'suspension_kit',
    rarity: 'Factory',
    powertrainFocus: 'all',
    price: 15600,
    stats: { powerDelta: 0, torqueDelta: 0, gripDelta: 11, aeroDelta: 6, weightDelta: -11, durabilityDelta: 10 },
    originNote: 'Altezza da terra costante ad alta velocità sui rettilinei.',
  },
  {
    catalogId: 'shop_sus_ti_uprights',
    name: 'Portamozzi & Tiranti in Titanio F1-Spec',
    slot: 'suspension_kit',
    rarity: 'Leggendario',
    powertrainFocus: 'all',
    price: 26000,
    stats: { powerDelta: 0, torqueDelta: 0, gripDelta: 15, aeroDelta: 7, weightDelta: -15, durabilityDelta: 14 },
    originNote: 'Rigidezza torsionale +45% con sensibilità sterzo millimetrica.',
  },
  // cooling_battery
  {
    catalogId: 'shop_col_solid_state',
    name: 'Pacco Batteria Solid-State Corsa 900V',
    slot: 'cooling_battery',
    rarity: 'Leggendario',
    powertrainFocus: 'electric',
    price: 32000,
    stats: { powerDelta: 82, torqueDelta: 98, gripDelta: 2, aeroDelta: 0, weightDelta: -26, durabilityDelta: 12 },
    originNote: 'Celle allo stato solido ultraleggere senza decadimento termico.',
  },
  {
    catalogId: 'shop_col_cryo_h2',
    name: 'Serbatoi Criogenici LH₂ Fibra-Titanio',
    slot: 'cooling_battery',
    rarity: 'Factory',
    powertrainFocus: 'hydrogen',
    price: 18200,
    stats: { powerDelta: 38, torqueDelta: 44, gripDelta: 1, aeroDelta: 2, weightDelta: -18, durabilityDelta: 14 },
    originNote: 'Contenimento a 700 bar ultraleggero certificato FIA Zero-Fire.',
  },
  {
    catalogId: 'shop_col_intercooler',
    name: 'Scambiatori & Intercooler Aria-Liquido Grafene',
    slot: 'cooling_battery',
    rarity: 'Prototipo',
    powertrainFocus: 'all',
    price: 7800,
    stats: { powerDelta: 24, torqueDelta: 22, gripDelta: 0, aeroDelta: 3, weightDelta: -6, durabilityDelta: 13 },
    originNote: 'Abbatte le temperature di esercizio anche con asfalto oltre 45 °C.',
  },
  // differential_ers
  {
    catalogId: 'shop_dif_ediff',
    name: 'Differenziale Attivo Elettro-Idraulico E-Diff',
    slot: 'differential_ers',
    rarity: 'Prototipo',
    powertrainFocus: 'all',
    price: 8500,
    stats: { powerDelta: 12, torqueDelta: 32, gripDelta: 8, aeroDelta: 0, weightDelta: -4, durabilityDelta: 7 },
    originNote: 'Bloccaggio progressivo in staccata e accelerazione.',
  },
  {
    catalogId: 'shop_dif_mguk_250',
    name: 'Gruppo Recupero ERS / MGU-K Dual-Pulse',
    slot: 'differential_ers',
    rarity: 'Factory',
    powertrainFocus: 'all',
    price: 17600,
    stats: { powerDelta: 46, torqueDelta: 58, gripDelta: 6, aeroDelta: 0, weightDelta: -5, durabilityDelta: 9 },
    originNote: 'Ricarica ERS +35% in frenata e picco di spinta extra in uscita curva.',
  },
  {
    catalogId: 'shop_dif_quad_tv',
    name: 'Torque-Vectoring Tribrid Indipendente 4-Ruote',
    slot: 'differential_ers',
    rarity: 'Leggendario',
    powertrainFocus: 'all',
    price: 30500,
    stats: { powerDelta: 56, torqueDelta: 86, gripDelta: 12, aeroDelta: 2, weightDelta: -8, durabilityDelta: 11 },
    originNote: 'Controllo attivo imbardata su ogni singola ruota motrice.',
  },
];

export function instantiateShopComponent(
  item: ComponentShopItem,
  ownerId: string,
  ownerName: string
): UniqueComponent {
  const prefix = item.slot.slice(0, 3).toUpperCase();
  const serialNum = Math.floor(100 + Math.random() * 899);
  return {
    id: `comp_${item.catalogId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    serial: `#${prefix}-${serialNum}-${item.rarity[0]}`,
    name: item.name,
    slot: item.slot,
    rarity: item.rarity,
    compatibleClasses: 'ALL',
    stats: { ...item.stats },
    condition: 100,
    ownerId,
    ownerName,
    originNote: item.originNote,
  };
}

export function generateRaceRewardComponent(
  ownerId: string,
  ownerName: string,
  position: number
): UniqueComponent | null {
  if (position > 3 && Math.random() > 0.38) return null;

  const roll = Math.random();
  const rarity: UniqueComponent['rarity'] =
    position === 1 && roll > 0.6
      ? 'Leggendario'
      : roll > 0.34
      ? 'Factory'
      : 'Prototipo';

  const mult = rarity === 'Leggendario' ? 1.75 : rarity === 'Factory' ? 1.35 : 1.0;
  const slots: ComponentSlot[] = [
    'engine_block',
    'turbo_mgu',
    'ecu',
    'gearbox',
    'brakes',
    'aero_pack',
    'suspension_kit',
    'cooling_battery',
    'differential_ers',
  ];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const serialNum = Math.floor(100 + Math.random() * 899);

  const templates: Record<
    ComponentSlot,
    { names: string[]; p: number; t: number; g: number; a: number; w: number; d: number }
  > = {
    engine_block: {
      names: [
        'Monoblocco Lega Al-Li',
        'Statore Assiale EV-R 1200V',
        'Stack Celle Idrogeno PEM Corsa',
      ],
      p: 52,
      t: 46,
      g: 0,
      a: 0,
      w: -8,
      d: 6,
    },
    turbo_mgu: {
      names: [
        'Girante Ceramica MGU-H',
        'Inverter SiC Doppio Stadio',
        'Compressore Cryo Idrogeno EVO',
      ],
      p: 54,
      t: 66,
      g: 0,
      a: 0,
      w: -5,
      d: 4,
    },
    ecu: {
      names: [
        'Mappatura Telemetrica Qualifica',
        'BMS Torque-Vectoring 1000 Hz',
        'Centralina Iniezione H₂-Lambda',
      ],
      p: 38,
      t: 34,
      g: 3,
      a: 0,
      w: -2,
      d: 8,
    },
    gearbox: {
      names: [
        'Scatola Carbonio Seamless',
        'Riduttore Epicicloidale EV Titanio',
        'Rapporti Ravvicinati Titanio',
      ],
      p: 20,
      t: 48,
      g: 3,
      a: 0,
      w: -11,
      d: 6,
    },
    brakes: {
      names: [
        'Dischi Carbon-C270',
        'Pinze Monoblocco Ti-6Al',
        'Impianto Brake-by-Wire F1',
      ],
      p: 0,
      t: 0,
      g: 8,
      a: 2,
      w: -8,
      d: 10,
    },
    aero_pack: {
      names: [
        'Fondo Effetto Suolo Venturi',
        'Ala Flessibile Carbon-Prepreg',
        'Diffusore Soffiato Posteriore',
      ],
      p: 0,
      t: 0,
      g: 6,
      a: 12,
      w: -9,
      d: 4,
    },
    suspension_kit: {
      names: [
        'Push-Rod Carbonio F1-Spec',
        'Ammortizzatori Attivi Heave',
        'Portamozzi in Titanio Lavorati',
      ],
      p: 0,
      t: 0,
      g: 9,
      a: 4,
      w: -10,
      d: 9,
    },
    cooling_battery: {
      names: [
        'Celle Solid-State Corsa 900V',
        'Serbatoi Criogenici LH₂ Carbonio',
        'Intercooler Grafene Alta Portata',
      ],
      p: 36,
      t: 42,
      g: 1,
      a: 1,
      w: -14,
      d: 11,
    },
    differential_ers: {
      names: [
        'Differenziale Attivo E-Diff',
        'Gruppo MGU-K Dual-Pulse',
        'Torque-Vectoring Indipendente 4WD',
      ],
      p: 28,
      t: 48,
      g: 7,
      a: 1,
      w: -5,
      d: 8,
    },
  };

  const tpl = templates[slot];
  const name = tpl.names[Math.floor(Math.random() * tpl.names.length)];
  const prefix = slot.slice(0, 3).toUpperCase();

  return {
    id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    serial: `#${prefix}-${serialNum}-${rarity[0]}`,
    name,
    slot,
    rarity,
    compatibleClasses: 'ALL',
    stats: {
      powerDelta: Math.round(tpl.p * mult),
      torqueDelta: Math.round(tpl.t * mult),
      gripDelta: Math.round(tpl.g * mult),
      aeroDelta: Math.round(tpl.a * mult),
      weightDelta: Math.round(tpl.w * mult),
      durabilityDelta: Math.round(tpl.d * mult),
    },
    condition: Math.round(88 + Math.random() * 12),
    ownerId,
    ownerName,
    originNote: `Trofeo tecnico conquistato in pista (P${position}).`,
  };
}

export const MAX_PIT_CREW_LEVEL = 5;

export const DEFAULT_PIT_CREW: PitCrewUpgrades = {
  jackReactionLevel: 1,
  wheelGunnersLevel: 1,
  aeroMechanicsLevel: 1,
  ersSystemsLevel: 1,
};

export interface PitCrewRoleMeta {
  key: PitCrewRoleKey;
  title: string;
  specialty: string;
  description: string;
  metricLabel: string;
  formatMetric: (level: number) => string;
}

export const PIT_CREW_ROLES: PitCrewRoleMeta[] = [
  {
    key: 'jackReactionLevel',
    title: 'Addetti Sollevamento & Riflessi',
    specialty: 'Tempo di Reazione Box',
    description:
      'Addestramento neuromotorio al semaforo piazzola e sincronia sollevatore anteriore/posteriore.',
    metricLabel: 'Latenza Inizio Lavori',
    formatMetric: (lvl) => `${(0.75 - (lvl - 1) * 0.15).toFixed(2)} s`,
  },
  {
    key: 'wheelGunnersLevel',
    title: 'Avvitatori Pneumatici F1',
    specialty: 'Velocità Cambio Gomme',
    description:
      'Pistole pneumatiche ad alta coppia e coordinazione serraggio dadi centrali sulle 4 ruote.',
    metricLabel: 'Cambio 4 Pneumatici',
    formatMetric: (lvl) => `${(4.6 - (lvl - 1) * 0.68).toFixed(2)} s`,
  },
  {
    key: 'aeroMechanicsLevel',
    title: 'Ingegneri Carrozzeria & Ala',
    specialty: 'Riparazione Danni Strutturali',
    description:
      'Sostituzione rapida musetto, ala anteriore/posteriore, braccetti sospensioni e raffreddamento motore.',
    metricLabel: 'Velocità Riparazione',
    formatMetric: (lvl) => `${24 + (lvl - 1) * 10}% / sec`,
  },
  {
    key: 'ersSystemsLevel',
    title: 'Tecnici ERS, Freni & Cambio',
    specialty: 'Ricarica ERS & Revisione',
    description:
      'Ricarica rapida batteria ibrida in corsia box, spurgo pinze freni e calibrazione cambio.',
    metricLabel: 'Ricarica ERS Box',
    formatMetric: (lvl) => `${32 + (lvl - 1) * 12}% / sec`,
  },
];

export function getPitCrewUpgradeCost(role: PitCrewRoleKey, currentLevel: number): number {
  if (currentLevel >= MAX_PIT_CREW_LEVEL) return 0;
  const baseByRole: Record<PitCrewRoleKey, number> = {
    jackReactionLevel: 2600,
    wheelGunnersLevel: 3200,
    aeroMechanicsLevel: 2900,
    ersSystemsLevel: 2400,
  };
  const stepMult = Math.pow(2.05, currentLevel - 1);
  return Math.round((baseByRole[role] * stepMult) / 100) * 100;
}

export function computePitCrewStats(crew: PitCrewUpgrades): PitCrewStats {
  const jack = Math.max(1, Math.min(MAX_PIT_CREW_LEVEL, crew.jackReactionLevel || 1));
  const wheels = Math.max(1, Math.min(MAX_PIT_CREW_LEVEL, crew.wheelGunnersLevel || 1));
  const aero = Math.max(1, Math.min(MAX_PIT_CREW_LEVEL, crew.aeroMechanicsLevel || 1));
  const ers = Math.max(1, Math.min(MAX_PIT_CREW_LEVEL, crew.ersSystemsLevel || 1));

  const reactionDelaySec = Number((0.75 - (jack - 1) * 0.15).toFixed(2));
  const tireChangeTimeSec = Number((4.6 - (wheels - 1) * 0.68).toFixed(2));
  const repairRatePerSec = 24 + (aero - 1) * 10;
  const ersRechargePerSec = 32 + (ers - 1) * 12;

  const avgLevel = (jack + wheels + aero + ers) / 4;
  const teamRatingPct = Math.round((avgLevel / MAX_PIT_CREW_LEVEL) * 100);
  const pitStopTierLabel =
    avgLevel >= 4.5
      ? 'Squadra Mondiale F1'
      : avgLevel >= 3.25
      ? 'Meccanici Ufficiali Factory'
      : avgLevel >= 2
      ? 'Team Professionista'
      : 'Equipaggio Base';

  return {
    reactionDelaySec,
    tireChangeTimeSec,
    repairRatePerSec,
    ersRechargePerSec,
    pitStopTierLabel,
    teamRatingPct,
  };
}
