export type AppTab = 'home' | 'race' | 'builder' | 'garage' | 'dealership' | 'marketplace';

export type CameraMode = 'chase' | 'far' | 'cockpit' | 'hood' | 'tv';

export type DrivingHandlingMode = 'assist' | 'sport' | 'sim';

export type CarClass = 'F3' | 'GT3' | 'F2' | 'LMH' | 'F1';

export type PowertrainType = 'ice' | 'hybrid' | 'electric' | 'hydrogen';

export type BodyStyle = 'formula' | 'formula_e' | 'gt3' | 'lmh' | 'hypercar';

export type EngineArchitecture =
  | 'V6_HYBRID'
  | 'V8_BITURBO'
  | 'V10_NA'
  | 'V12_ENDURANCE'
  | 'EV_DUAL_MOTOR'
  | 'EV_QUAD_HYPER'
  | 'H2_ICE_TURBO'
  | 'H2_FUEL_CELL';

export type ComponentSlot =
  | 'engine_block'
  | 'turbo_mgu'
  | 'ecu'
  | 'gearbox'
  | 'brakes'
  | 'aero_pack'
  | 'suspension_kit'
  | 'cooling_battery'
  | 'differential_ers';

export type ComponentRarity = 'Standard' | 'Prototipo' | 'Factory' | 'Leggendario';

export interface ComponentStats {
  powerDelta: number;      // CV
  torqueDelta: number;     // Nm
  gripDelta: number;       // %
  aeroDelta: number;       // %
  weightDelta: number;     // kg (negative is lighter)
  durabilityDelta: number; // %
}

export interface UniqueComponent {
  id: string;
  serial: string;
  name: string;
  slot: ComponentSlot;
  rarity: ComponentRarity;
  compatibleClasses: CarClass[] | 'ALL';
  stats: ComponentStats;
  condition: number; // 0-100
  ownerId: string;
  ownerName: string;
  originNote: string;
}

export interface ComponentShopItem {
  catalogId: string;
  name: string;
  slot: ComponentSlot;
  rarity: ComponentRarity;
  powertrainFocus: PowertrainType | 'all';
  price: number;
  stats: ComponentStats;
  originNote: string;
}

export interface DamageState {
  frontAero: number;     // 0 = intact, 100 = destroyed
  rearAero: number;      // 0..100
  engine: number;        // 0..100
  suspension: number;    // 0..100
  tires: number;         // 0..100
  gearboxBrakes: number; // 0..100
}

export interface CarTuning {
  engineArch: EngineArchitecture;
  turboBar: number;        // 1.0 - 4.2 bar (or electric boost scalar)
  revLimitRpm: number;     // 7500 - 20000
  finalDrive: number;      // 2.8 - 4.4 (higher = acceleration, lower = top speed)
  frontWingDeg: number;    // 5 - 35 deg
  rearWingDeg: number;     // 5 - 40 deg
  brakeBias: number;       // 50 - 65 % front
  suspensionStiff: number; // 1 - 10
  rideHeightMm: number;    // 18 - 70 mm
  primaryColor: string;
  secondaryColor: string;
  finish: 'metallic' | 'matte_carbon' | 'chrome';
  raceNumber: number;
}

export type RankId =
  | 'bronzo'
  | 'argento'
  | 'oro'
  | 'platino'
  | 'diamante'
  | 'champion'
  | 'gran_champion'
  | 'unreal';

export interface RankDefinition {
  id: RankId;
  tierIndex: number;
  name: string;
  minPoints: number;
  colorHex: string;
  prizeMultiplier: number;
  promotionBonusCr: number;
  rewardSummary: string;
}

export interface CarModel {
  id: string;
  name: string;
  manufacturer: string;
  carClass: CarClass;
  powertrainType: PowertrainType;
  price: number;
  requiredRank: RankId;
  basePowerHp: number;
  baseTorqueNm: number;
  baseWeightKg: number;
  baseDownforce: number; // 1.0 - 4.5 G peak aero
  baseGrip: number;      // 1.0 - 2.1 mu
  baseTopSpeedKmh: number;
  defaultEngine: EngineArchitecture;
  description: string;
  bodyStyle: BodyStyle;
  defaultPrimary: string;
  defaultSecondary: string;
}

export interface OwnedCar {
  instanceId: string;
  modelId: string;
  customName: string;
  tuning: CarTuning;
  installedParts: Partial<Record<ComponentSlot, string>>;
  damage: DamageState;
  mileageKm: number;
  wins: number;
}

export interface ComputedCarSpecs {
  powerHp: number;
  torqueNm: number;
  weightKg: number;
  topSpeedKmh: number;
  zeroToHundredSec: number;
  downforceG: number;
  gripMu: number;
  reliabilityPct: number;
  piIndex: number;
  maxRpm: number;
}

export type TrackEnvironment =
  | 'autodromo_day'
  | 'night_street'
  | 'desert_sunset'
  | 'alpine_pass';

export interface TrackPoint {
  x: number;
  z: number;
  elevation: number;
  bankDeg: number;
}

export interface TrackDefinition {
  id: string;
  name: string;
  author: string;
  environment: TrackEnvironment;
  widthMeters: number;
  laps: number;
  points: TrackPoint[];
  lengthKm: number;
  cornersCount: number;
  difficulty: 'Tecnico' | 'Velocissimo' | 'Misto';
  prizePool: number;
  isCustom: boolean;
}

export interface MarketListing {
  id: string;
  component: UniqueComponent;
  sellerId: string;
  sellerName: string;
  price: number;
  listedAt: number;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  toListingId: string;
  targetComponent: UniqueComponent;
  offeredComponent: UniqueComponent;
  offeredCredits: number;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export type RaceTeamRole =
  | 'driver'
  | 'safety_car'
  | 'fire_team'
  | 'medical_team'
  | 'mechanic_team';

export interface DriverHealthState {
  health: number;       // 100 = healthy, 0 = critical
  painLevel: number;    // 0 = no pain, 100 = extreme pain
  bleedingRate: number; // 0 = none, 1..100 = active blood loss severity
  bloodLoss: number;    // 0..100 cumulative blood lost
  concussion: number;   // 0..100 impact shock
  injuryLabel: string | null;
  isDown: boolean;      // driver exited wrecked car / incapacitated on shoulder
}

export type SupportUnitKind = 'fire' | 'medical' | 'mechanic' | 'safety';
export type CrewTransportMode = 'foot' | 'vehicle';
export type TeamAssistType = 'medical_aid' | 'mechanic_service';

export interface MultiplayerPlayerInfo {
  playerId: string;
  playerName: string;
  role: RaceTeamRole;
  carName: string;
  carClass: CarClass;
  bodyStyle: BodyStyle;
  powertrainType?: PowertrainType;
  primaryColor: string;
  secondaryColor: string;
  raceNumber: number;
  ready: boolean;
  piIndex: number;
}

export interface MultiplayerRoom {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  trackId: string;
  trackName: string;
  trackDefinition: TrackDefinition;
  laps: number;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  players: MultiplayerPlayerInfo[];
  createdAt: number;
}

export interface RemoteRacerTelemetry {
  playerId: string;
  playerName: string;
  role: RaceTeamRole;
  carClass: CarClass;
  bodyStyle: BodyStyle;
  powertrainType?: PowertrainType;
  primaryColor: string;
  secondaryColor: string;
  raceNumber: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  speedKmh: number;
  lap: number;
  trackProgress: number;
  totalProgress: number;
  damageAvg: number;
  finished: boolean;
  finishTimeMs: number | null;
  onFire?: boolean;
  fireIntensity?: number;
  strobeActive?: boolean;
  waterJetActive?: boolean;
  driverHealthPct?: number;
  driverBleeding?: boolean;
}

export type SafetyCarPhase = 'standby' | 'deployed' | 'in_this_lap';

export type WeatherCondition = 'sunny' | 'damp' | 'rain';
export type WeatherMode = 'dynamic' | WeatherCondition;

export interface WeatherForecastSlot {
  label: string;
  condition: WeatherCondition;
  rainChancePct: number;
  expectedAsphaltTempC: number;
}

export interface PreRaceWeatherForecast {
  summary: string;
  ambientTempC: number;
  initialAsphaltTempC: number;
  windKmh: number;
  humidityPct: number;
  slots: [WeatherForecastSlot, WeatherForecastSlot, WeatherForecastSlot];
}

export type FireToolType = 'extinguisher' | 'water_cannon' | 'foam_afff' | 'ers_cutoff';

export type PitCrewRoleKey =
  | 'jackReactionLevel'
  | 'wheelGunnersLevel'
  | 'aeroMechanicsLevel'
  | 'ersSystemsLevel';

export interface PitCrewUpgrades {
  jackReactionLevel: number;  // 1..5
  wheelGunnersLevel: number;  // 1..5
  aeroMechanicsLevel: number; // 1..5
  ersSystemsLevel: number;    // 1..5
}

export interface PitCrewStats {
  reactionDelaySec: number;
  tireChangeTimeSec: number;
  repairRatePerSec: number;
  ersRechargePerSec: number;
  pitStopTierLabel: string;
  teamRatingPct: number;
}

export type PitStopPhase = 'none' | 'reacting' | 'servicing' | 'ready';

export interface NearbyTeamInfo {
  unitId: string;
  kind: SupportUnitKind;
  teamName: string;
  locationLabel: string; // e.g. 'Pit Lane' or 'In Pista'
  canInteract: boolean;  // false for safety car!
  helpCostCr: number;
  followCostCr: number;
  currentOrder: 'idle' | 'responding' | 'working' | 'follow_foot' | 'follow_car';
}

export interface RaceHUDState {
  phase: 'standby' | 'countdown' | 'racing' | 'finished';
  countdownValue: number;
  speedKmh: number;
  rpm: number;
  maxRpm: number;
  gear: number;
  throttle: number;
  brake: number;
  ersCharge: number; // 0-100
  ersActive: boolean;
  drsAvailable: boolean;
  drsActive: boolean;
  lap: number;
  totalLaps: number;
  lapTimeMs: number;
  bestLapMs: number | null;
  lastLapMs: number | null;
  position: number;
  totalCars: number;
  damage: DamageState;
  driverHealth: DriverHealthState;
  offTrack: boolean;
  inPit: boolean;
  nearPitWindow: boolean;
  pitPhase: PitStopPhase;
  pitElapsedSec: number;
  pitReactionRemainingSec: number;
  pitTireProgressPct: number;
  lastPitStopTimeSec: number | null;
  playerOnFire: boolean;
  playerFireIntensity: number;
  anyCarOnFire: boolean;
  burningCarName: string | null;
  fireTeamDispatched: boolean;
  fireTeamArrived: boolean;
  medicalTeamDispatched: boolean;
  medicalTeamArrived: boolean;
  mechanicTeamDispatched: boolean;
  mechanicTeamArrived: boolean;
  mechanicWorkingStage: string | null;
  waterJetActive: boolean;
  safetyCarPhase: SafetyCarPhase;
  playerRole: RaceTeamRole;
  hasHumanSafetyCar: boolean;
  hasHumanFireTeam: boolean;
  hasHumanMedicalTeam: boolean;
  hasHumanMechanicTeam: boolean;
  nearbyTeam: NearbyTeamInfo | null;
  weatherCondition: WeatherCondition;
  weatherMode: WeatherMode;
  trackWetness: number; // 0..1
  visibilityPct: number; // 0..100
  gripMultiplierPct: number; // e.g. 100%, 84%, 68%
  asphaltTempC: number;
  ambientTempC: number;
  tireWearMultiplier: number; // e.g. 0.85 .. 1.85
  toolCooldowns: Record<FireToolType, number>;
  standings: {
    id: string;
    name: string;
    isPlayer: boolean;
    position: number;
    gapText: string;
    lap: number;
    carClass: CarClass;
    damagePct: number;
    onFire?: boolean;
  }[];
  minimapPoints: { x: number; z: number }[];
  racerDots: { id: string; x: number; z: number; isPlayer: boolean; color: string }[];
  finishSummary?: {
    position: number;
    totalCars: number;
    totalTimeMs: number;
    bestLapMs: number | null;
    prizeGross: number;
    repairCost: number;
    cleanBonus: number;
    safetyBonus: number;
    netCredits: number;
    npcLevel: number;
    rpEarned: number;
    rankUpTo?: RankDefinition | null;
    rankBonusCredits?: number;
    unlockedCarNames?: string[];
    droppedComponent: UniqueComponent | null;
  };
}

export interface DriverProfile {
  playerId: string;
  driverName: string;
  credits: number;
  wins: number;
  racesCompleted: number;
  bestLapRecordMs: number | null;
  rankPoints: number;
  claimedRankRewards: RankId[];
}
