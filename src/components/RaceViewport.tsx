import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  Award,
  Camera,
  CarFront,
  CloudDrizzle,
  CloudRain,
  Droplets,
  Flame,
  Flag,
  HeartPulse,
  Home,
  Maximize2,
  MessageSquare,
  Minimize2,
  PhoneCall,
  Play,
  RotateCcw,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  Siren,
  Sun,
  Thermometer,
  Volume2,
  VolumeX,
  Wind,
  Wrench,
  X,
  ZapOff,
} from 'lucide-react';
import {
  MobileDriveControls,
  MobileDriveInputState,
  MobileSteerMode,
  useIsMobileTouchDevice,
} from './MobileDriveControls';
import { RaceAudioEngine } from '../audio/raceAudio';
import {
  CAR_CATALOG,
  ENGINE_ARCHITECTURES,
  computeCarSpecs,
  computePitCrewStats,
  computeRaceRpEarned,
  computeRepairCost,
  createDefaultTuning,
  generateRaceRewardComponent,
  getNpcDifficultyConfig,
  getRankForPoints,
  RANK_LADDER,
} from '../data/catalog';
import {
  buildCarModel3D,
  CarMeshRig,
  detectSoftwareWebGL,
  updateCarDamageVisuals,
} from '../engine/carModel3D';
import {
  animateCharacterRig,
  buildCharacter3D,
  CharacterAnimAction,
  CharacterMeshRig,
} from '../engine/character3D';
import {
  applyFireToolToCar,
  applyMechanicServiceToCar,
  applyMedicalTreatmentToDriver,
  computeAiInput,
  computeTireWearMultiplier,
  createRacerBody,
  RacerBody,
  resolveCarToCarCollisions,
  stepRacerPhysics,
} from '../engine/physicsEngine';
import {
  buildAmbulance3D,
  buildFastFireCar3D,
  buildFireTruck3D,
  buildMechanicVan3D,
  buildSafetyCar3D,
  SupportVehicleRig,
} from '../engine/supportVehicles3D';
import { buildTrack3D, BuiltTrackScene } from '../engine/trackGeometry';
import {
  CameraMode,
  ComputedCarSpecs,
  CrewTransportMode,
  DamageState,
  DrivingHandlingMode,
  FireToolType,
  MultiplayerRoom,
  OwnedCar,
  PitCrewUpgrades,
  PreRaceWeatherForecast,
  RaceHUDState,
  RaceTeamRole,
  RankDefinition,
  RankId,
  RemoteRacerTelemetry,
  SafetyCarPhase,
  SupportUnitKind,
  TeamAssistType,
  TrackDefinition,
  TrackEnvironment,
  UniqueComponent,
  WeatherCondition,
  WeatherMode,
} from '../types/game';

interface RaceViewportProps {
  playerId: string;
  driverName: string;
  credits: number;
  playerRank: RankDefinition;
  playerRankPoints: number;
  claimedRankRewards: RankId[];
  npcLevel: number;
  onChangeNpcLevel: (lvl: number) => void;
  activeCar: OwnedCar;
  inventory: UniqueComponent[];
  pitCrew: PitCrewUpgrades;
  allTracks: TrackDefinition[];
  selectedTrackId: string;
  onSelectTrackId: (id: string) => void;
  activeRoom: MultiplayerRoom | null;
  preferredRole: RaceTeamRole;
  onChangeRole: (role: RaceTeamRole) => void;
  remoteTelemetryRef: React.MutableRefObject<Map<string, RemoteRacerTelemetry>>;
  incomingFireHelpRef: React.MutableRefObject<{
    fromPlayerName: string;
    tool: FireToolType;
  } | null>;
  incomingTeamAssistRef?: React.MutableRefObject<{
    fromPlayerName: string;
    assistType: TeamAssistType;
  } | null>;
  onSendTelemetry: (t: RemoteRacerTelemetry) => void;
  onSendFireExtinguish: (targetId: string, tool: FireToolType) => void;
  onSendTeamAssist?: (targetId: string, assistType: TeamAssistType) => void;
  onDeductCredits?: (amount: number) => number;
  onRaceFinished: (result: {
    carInstanceId: string;
    finalDamage: DamageState;
    distanceKm: number;
    won: boolean;
    netCredits: number;
    rpEarned: number;
    bestLapMs: number | null;
    droppedComponent: UniqueComponent | null;
  }) => void;
  onGoToBuilder: () => void;
  onGoToGarage: () => void;
  onGoToPitCrew: () => void;
  onGoToHome: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const SAFETY_CAR_SPECS: ComputedCarSpecs = {
  powerHp: 620,
  torqueNm: 740,
  weightKg: 1580,
  topSpeedKmh: 315,
  zeroToHundredSec: 3.1,
  downforceG: 1.65,
  gripMu: 1.72,
  reliabilityPct: 99,
  piIndex: 760,
  maxRpm: 8800,
};

const FIRE_TRUCK_SPECS: ComputedCarSpecs = {
  powerHp: 640,
  torqueNm: 1450,
  weightKg: 2650,
  topSpeedKmh: 235,
  zeroToHundredSec: 4.4,
  downforceG: 1.25,
  gripMu: 1.65,
  reliabilityPct: 99,
  piIndex: 620,
  maxRpm: 6200,
};

const AMBULANCE_SPECS: ComputedCarSpecs = {
  powerHp: 560,
  torqueNm: 980,
  weightKg: 2350,
  topSpeedKmh: 245,
  zeroToHundredSec: 4.1,
  downforceG: 1.35,
  gripMu: 1.72,
  reliabilityPct: 99,
  piIndex: 660,
  maxRpm: 6800,
};

const MECHANIC_VAN_SPECS: ComputedCarSpecs = {
  powerHp: 540,
  torqueNm: 940,
  weightKg: 2420,
  topSpeedKmh: 230,
  zeroToHundredSec: 4.3,
  downforceG: 1.28,
  gripMu: 1.68,
  reliabilityPct: 99,
  piIndex: 640,
  maxRpm: 6500,
};

type RemoteEntityRig =
  | { kind: 'car'; rig: CarMeshRig; role: 'driver' }
  | {
      kind: 'support';
      rig: SupportVehicleRig;
      role: 'safety_car' | 'fire_team' | 'medical_team' | 'mechanic_team';
    };

const SETTINGS_STORAGE_KEY = 'apex_darwin_race_settings';
const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'Inseguimento',
  far: 'Ampia (Far)',
  cockpit: 'Abitacolo',
  hood: 'Cofano',
  tv: 'Camera TV',
};

const AI_DRIVERS = [
  { name: 'L. Bellini', color: '#38bdf8', sec: '#0f172a', num: 4 },
  { name: 'M. De Luca', color: '#f59e0b', sec: '#111827', num: 55 },
  { name: 'K. Lindqvist', color: '#10b981', sec: '#064e3b', num: 22 },
  { name: 'A. Moretti', color: '#a855f7', sec: '#1e1b4b', num: 77 },
  { name: 'R. Takahashi', color: '#f43f5e', sec: '#18181b', num: 11 },
];

function formatLapTime(ms: number | null): string {
  if (ms === null || ms <= 0) return '--:--.---';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function getEnvClimateBase(env: TrackEnvironment): {
  ambient: number;
  sunBoost: number;
  dampBoost: number;
  rainBoost: number;
  windBase: number;
  humidityBase: number;
} {
  switch (env) {
    case 'desert_sunset':
      return { ambient: 33, sunBoost: 17, dampBoost: 7, rainBoost: 1, windBase: 16, humidityBase: 26 };
    case 'night_street':
      return { ambient: 18, sunBoost: 6, dampBoost: 3, rainBoost: 0, windBase: 9, humidityBase: 64 };
    case 'alpine_pass':
      return { ambient: 15, sunBoost: 10, dampBoost: 4, rainBoost: 0, windBase: 19, humidityBase: 58 };
    default:
      return { ambient: 25, sunBoost: 14, dampBoost: 6, rainBoost: 1, windBase: 12, humidityBase: 46 };
  }
}

function generatePreRaceForecast(
  env: TrackEnvironment,
  mode: WeatherMode,
  seed: number
): PreRaceWeatherForecast {
  const base = getEnvClimateBase(env);
  const tempJitter = ((seed * 7 + env.length) % 5) - 2; // -2 .. +2 °C
  const ambientTempC = Math.round(base.ambient + tempJitter);

  const scenarios: {
    seq: [WeatherCondition, WeatherCondition, WeatherCondition];
    summary: string;
  }[] = [
    {
      seq: ['sunny', 'damp', 'rain'],
      summary: 'Partenza sull’asciutto caldo, annuvolamento a metà gara e pioggia nel finale.',
    },
    {
      seq: ['damp', 'rain', 'sunny'],
      summary: 'Asfalto umido iniziale, scroscio centrale e rapida schiarita con temperatura in risalita.',
    },
    {
      seq: ['sunny', 'sunny', 'damp'],
      summary: 'Asfalto molto caldo per due terzi di gara, leggero calo termico e pista umida finale.',
    },
    {
      seq: ['rain', 'damp', 'sunny'],
      summary: 'Avvio bagnato a bassa temperatura asfalto, poi traiettoria in asciugatura al sole.',
    },
  ];

  const picked =
    mode === 'dynamic'
      ? scenarios[Math.abs(seed) % scenarios.length]
      : {
          seq: [mode, mode, mode] as [WeatherCondition, WeatherCondition, WeatherCondition],
          summary:
            mode === 'sunny'
              ? 'Cielo sereno fisso: asfalto caldo e usura gomme progressivamente più severa.'
              : mode === 'damp'
              ? 'Pista umida costante: aderenza ridotta e raffreddamento moderato delle mescole.'
              : 'Pioggia costante: asfalto freddo, acqua stagnante e visibilità ridotta.',
        };

  const slotLabels = ['Partenza', 'Metà Gara', 'Finale'] as const;
  const calcSlotTemp = (cond: WeatherCondition, idx: number) => {
    const condDelta =
      cond === 'sunny' ? base.sunBoost : cond === 'damp' ? base.dampBoost : base.rainBoost;
    const progressionDrift = idx === 1 ? 1.5 : idx === 2 ? (cond === 'sunny' ? 2.5 : -1) : 0;
    return Math.round(ambientTempC + condDelta + progressionDrift);
  };
  const calcRainChance = (cond: WeatherCondition, idx: number) => {
    if (cond === 'rain') return Math.min(98, 84 + ((seed + idx * 5) % 12));
    if (cond === 'damp') return 42 + ((seed + idx * 7) % 18);
    return mode === 'dynamic' ? 12 + ((seed + idx * 4) % 14) : 5;
  };

  const slots = [0, 1, 2].map((i) => {
    const cond = picked.seq[i];
    return {
      label: slotLabels[i],
      condition: cond,
      rainChancePct: calcRainChance(cond, i),
      expectedAsphaltTempC: calcSlotTemp(cond, i),
    };
  }) as PreRaceWeatherForecast['slots'];

  const startCond = picked.seq[0];
  const windKmh = Math.round(base.windBase + (startCond === 'rain' ? 9 : startCond === 'damp' ? 4 : 0) + (seed % 5));
  const humidityPct = Math.min(
    96,
    Math.round(base.humidityBase + (startCond === 'rain' ? 36 : startCond === 'damp' ? 20 : 0))
  );

  return {
    summary: picked.summary,
    ambientTempC,
    initialAsphaltTempC: slots[0].expectedAsphaltTempC,
    windKmh,
    humidityPct,
    slots,
  };
}

export const RaceViewport: React.FC<RaceViewportProps> = ({
  playerId,
  driverName,
  credits,
  playerRank,
  playerRankPoints,
  claimedRankRewards,
  npcLevel,
  onChangeNpcLevel,
  activeCar,
  inventory,
  pitCrew,
  allTracks,
  selectedTrackId,
  onSelectTrackId,
  activeRoom,
  preferredRole,
  onChangeRole,
  remoteTelemetryRef,
  incomingFireHelpRef,
  incomingTeamAssistRef,
  onSendTelemetry,
  onSendFireExtinguish,
  onSendTeamAssist,
  onDeductCredits,
  onRaceFinished,
  onGoToBuilder,
  onGoToGarage,
  onGoToPitCrew,
  onGoToHome,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const track = useMemo(() => {
    if (activeRoom?.trackDefinition) return activeRoom.trackDefinition;
    return allTracks.find((t) => t.id === selectedTrackId) ?? allTracks[0];
  }, [activeRoom, allTracks, selectedTrackId]);

  const model = useMemo(
    () => CAR_CATALOG.find((m) => m.id === activeCar.modelId) ?? CAR_CATALOG[0],
    [activeCar.modelId]
  );
  const specs = useMemo(
    () => computeCarSpecs(model, activeCar, inventory),
    [model, activeCar, inventory]
  );
  const pitCrewStats = useMemo(() => computePitCrewStats(pitCrew), [pitCrew]);
  const npcConfig = useMemo(() => getNpcDifficultyConfig(npcLevel), [npcLevel]);

  // Active Role & Human vs NPC Team Resolution:
  // If real player(s) are on Safety Car, Fire, Medical, or Mechanic Team, NPC vehicles stay off.
  const playerRole: RaceTeamRole = useMemo(() => {
    if (activeRoom) {
      return activeRoom.players.find((p) => p.playerId === playerId)?.role ?? preferredRole;
    }
    return preferredRole;
  }, [activeRoom, playerId, preferredRole]);

  const hasHumanSafetyCar = useMemo(() => {
    if (activeRoom) {
      return activeRoom.players.some((p) => p.role === 'safety_car');
    }
    return playerRole === 'safety_car';
  }, [activeRoom, playerRole]);

  const hasHumanFireTeam = useMemo(() => {
    if (activeRoom) {
      return activeRoom.players.some((p) => p.role === 'fire_team');
    }
    return playerRole === 'fire_team';
  }, [activeRoom, playerRole]);

  const hasHumanMedicalTeam = useMemo(() => {
    if (activeRoom) {
      return activeRoom.players.some((p) => p.role === 'medical_team');
    }
    return playerRole === 'medical_team';
  }, [activeRoom, playerRole]);

  const hasHumanMechanicTeam = useMemo(() => {
    if (activeRoom) {
      return activeRoom.players.some((p) => p.role === 'mechanic_team');
    }
    return playerRole === 'mechanic_team';
  }, [activeRoom, playerRole]);

  const isMobileDevice = useIsMobileTouchDevice();
  const isMobileDeviceRef = useRef<boolean>(isMobileDevice);
  isMobileDeviceRef.current = isMobileDevice;

  const initialSettings = useMemo(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Partial<{
        cameraMode: CameraMode;
        drivingMode: DrivingHandlingMode;
        steeringSensitivity: number;
        mobileSteerMode: MobileSteerMode;
        autoGas: boolean;
      }>;
    } catch {
      // ignore
    }
    return {};
  }, []);

  const [cameraMode, setCameraMode] = useState<CameraMode>(
    initialSettings.cameraMode ?? 'chase'
  );
  const [drivingMode, setDrivingMode] = useState<DrivingHandlingMode>(
    initialSettings.drivingMode ?? 'sport'
  );
  const [steeringSensitivity, setSteeringSensitivity] = useState<number>(
    initialSettings.steeringSensitivity ?? 1.0
  );
  const [mobileSteerMode, setMobileSteerMode] = useState<MobileSteerMode>(
    initialSettings.mobileSteerMode ?? 'wheel'
  );
  const [autoGas, setAutoGas] = useState<boolean>(initialSettings.autoGas ?? false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [showRaceControlPanel, setShowRaceControlPanel] = useState(false);

  const [muted, setMuted] = useState(false);
  const [weatherModeUi, setWeatherModeUi] = useState<WeatherMode>('dynamic');
  const [forecastSeed, setForecastSeed] = useState<number>(() =>
    Math.floor(Math.random() * 100)
  );
  const [raceRunId, setRaceRunId] = useState(0);
  const [phaseTrigger, setPhaseTrigger] = useState<'standby' | 'countdown' | 'racing'>(
    activeRoom?.status === 'racing' ? 'countdown' : 'standby'
  );
  const [raceControlNote, setRaceControlNote] = useState<string | null>(null);
  const [dialogueOpen, setDialogueOpen] = useState(false);
  const [dialogueDismissedUnit, setDialogueDismissedUnit] = useState<string | null>(null);
  const [dialogueInput, setDialogueInput] = useState('');
  const [dialogueMessages, setDialogueMessages] = useState<
    { sender: 'tu' | 'team'; text: string }[]
  >([]);
  const [pendingDialogueIntent, setPendingDialogueIntent] = useState<'follow' | 'help' | null>(null);

  const weatherForecast = useMemo(
    () => generatePreRaceForecast(track.environment, weatherModeUi, forecastSeed),
    [track.environment, weatherModeUi, forecastSeed]
  );
  const forecastRef = useRef<PreRaceWeatherForecast>(weatherForecast);
  forecastRef.current = weatherForecast;

  useEffect(() => {
    if (!raceControlNote) return;
    const t = window.setTimeout(() => setRaceControlNote(null), 4200);
    return () => window.clearTimeout(t);
  }, [raceControlNote]);

  const [hud, setHud] = useState<RaceHUDState>({
    phase: 'standby',
    countdownValue: 3,
    speedKmh: 0,
    rpm: 2800,
    maxRpm: specs.maxRpm,
    gear: 1,
    throttle: 0,
    brake: 0,
    ersCharge: 100,
    ersActive: false,
    drsAvailable: false,
    drsActive: false,
    lap: 1,
    totalLaps: track.laps,
    lapTimeMs: 0,
    bestLapMs: null,
    lastLapMs: null,
    position: 1,
    totalCars: 6,
    damage: activeCar.damage,
    driverHealth: {
      health: 100,
      painLevel: 0,
      bleedingRate: 0,
      bloodLoss: 0,
      concussion: 0,
      injuryLabel: null,
      isDown: false,
    },
    offTrack: false,
    inPit: false,
    nearPitWindow: true,
    pitPhase: 'none',
    pitElapsedSec: 0,
    pitReactionRemainingSec: 0,
    pitTireProgressPct: 100,
    lastPitStopTimeSec: null,
    playerOnFire: false,
    playerFireIntensity: 0,
    anyCarOnFire: false,
    burningCarName: null,
    fireTeamDispatched: false,
    fireTeamArrived: false,
    medicalTeamDispatched: false,
    medicalTeamArrived: false,
    mechanicTeamDispatched: false,
    mechanicTeamArrived: false,
    mechanicWorkingStage: null,
    waterJetActive: false,
    safetyCarPhase: 'standby',
    playerRole,
    hasHumanSafetyCar,
    hasHumanFireTeam,
    hasHumanMedicalTeam,
    hasHumanMechanicTeam,
    nearbyTeam: null,
    weatherCondition: weatherForecast.slots[0].condition,
    weatherMode: 'dynamic',
    trackWetness:
      weatherForecast.slots[0].condition === 'rain'
        ? 1
        : weatherForecast.slots[0].condition === 'damp'
        ? 0.48
        : 0,
    visibilityPct: 100,
    gripMultiplierPct: 100,
    asphaltTempC: weatherForecast.initialAsphaltTempC,
    ambientTempC: weatherForecast.ambientTempC,
    tireWearMultiplier: computeTireWearMultiplier(
      weatherForecast.initialAsphaltTempC,
      weatherForecast.slots[0].condition === 'rain'
        ? 1
        : weatherForecast.slots[0].condition === 'damp'
        ? 0.48
        : 0
    ),
    toolCooldowns: {
      extinguisher: 0,
      water_cannon: 0,
      foam_afff: 0,
      ers_cutoff: 0,
    },
    standings: [],
    minimapPoints: [],
    racerDots: [],
  });

  useEffect(() => {
    if (activeRoom?.status === 'racing') {
      setPhaseTrigger('countdown');
      setRaceRunId((n) => n + 1);
    }
  }, [activeRoom?.status]);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  const drivingModeRef = useRef<DrivingHandlingMode>(drivingMode);
  const steerSensitivityRef = useRef<number>(steeringSensitivity);
  const weatherModeRef = useRef<WeatherMode>('dynamic');
  const audioRef = useRef<RaceAudioEngine>(new RaceAudioEngine());
  const keysRef = useRef<Record<string, boolean>>({});
  const mobileInputRef = useRef<MobileDriveInputState>({
    steer: 0,
    throttle: 0,
    brake: 0,
    ers: false,
    drs: false,
    pit: false,
    autoGas: false,
  });

  // Interactive Race Control, Medical & Mechanic Action Queue consumed inside simulation loop
  const controlActionsRef = useRef<{
    dispatchFireTeam: boolean;
    recallFireTeam: boolean;
    dispatchMedicalTeam: boolean;
    dispatchMechanicTeam: boolean;
    toggleSafetyCar: boolean;
    triggerFireDrill: boolean;
    useFireTool: FireToolType | null;
    useTeamAssist: TeamAssistType | null;
    teamOrder: {
      unitKind: Exclude<SupportUnitKind, 'safety'>;
      command: 'follow' | 'help' | 'greet' | 'recall';
      mode?: CrewTransportMode;
      costCr?: number;
    } | null;
  }>({
    dispatchFireTeam: false,
    recallFireTeam: false,
    dispatchMedicalTeam: false,
    dispatchMechanicTeam: false,
    toggleSafetyCar: false,
    triggerFireDrill: false,
    useFireTool: null,
    useTeamAssist: null,
    teamOrder: null,
  });

  const callbacksRef = useRef({
    onSendTelemetry,
    onSendFireExtinguish,
    onSendTeamAssist,
    onDeductCredits,
    onRaceFinished,
  });
  callbacksRef.current = {
    onSendTelemetry,
    onSendFireExtinguish,
    onSendTeamAssist,
    onDeductCredits,
    onRaceFinished,
  };

  // Store Rank state in a ref so post-race Rank-Up save updates never tear down the 3D scene
  const rankProgressRef = useRef({
    playerRank,
    playerRankPoints,
    claimedRankRewards,
  });
  rankProgressRef.current = { playerRank, playerRankPoints, claimedRankRewards };

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    drivingModeRef.current = drivingMode;
    steerSensitivityRef.current = steeringSensitivity;
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          cameraMode,
          drivingMode,
          steeringSensitivity,
          mobileSteerMode,
          autoGas,
        })
      );
    } catch {
      // ignore
    }
  }, [cameraMode, drivingMode, steeringSensitivity, mobileSteerMode, autoGas]);

  useEffect(() => {
    audioRef.current.setMuted(muted);
  }, [muted]);

  // Keyboard Listeners (Driving + Camera + Fire Tools + Medical + Mechanic + Dialogue)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore racing shortcuts while typing inside team dialogue input
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA')
      ) {
        if (e.code === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }
      keysRef.current[e.code] = true;
      if (e.code === 'KeyC') {
        setCameraMode((prev) => {
          const order: CameraMode[] = ['chase', 'far', 'cockpit', 'hood', 'tv'];
          return order[(order.indexOf(prev) + 1) % order.length];
        });
      } else if (e.code === 'Escape') {
        setSettingsOpen((o) => !o);
      } else if (e.code === 'KeyF') {
        controlActionsRef.current.dispatchFireTeam = true;
      } else if (e.code === 'KeyH') {
        controlActionsRef.current.dispatchMedicalTeam = true;
      } else if (e.code === 'KeyK') {
        controlActionsRef.current.dispatchMechanicTeam = true;
      } else if (e.code === 'KeyT') {
        setDialogueOpen((o) => !o);
      } else if (e.code === 'KeyY') {
        controlActionsRef.current.toggleSafetyCar = true;
      } else if (e.code === 'KeyI') {
        controlActionsRef.current.triggerFireDrill = true;
      } else if (e.code === 'KeyM') {
        const order: WeatherMode[] = ['dynamic', 'sunny', 'damp', 'rain'];
        const next = order[(order.indexOf(weatherModeRef.current) + 1) % order.length];
        weatherModeRef.current = next;
        setWeatherModeUi(next);
      } else if (e.code === 'Digit1') {
        controlActionsRef.current.useFireTool = 'extinguisher';
      } else if (e.code === 'Digit2') {
        controlActionsRef.current.useFireTool = 'water_cannon';
      } else if (e.code === 'Digit3') {
        controlActionsRef.current.useFireTool = 'foam_afff';
      } else if (e.code === 'Digit4') {
        controlActionsRef.current.useFireTool = 'ers_cutoff';
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Main 4HD Three.js Race Scene & Fixed-Timestep Simulation
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const scene = new THREE.Scene();
    const builtTrack: BuiltTrackScene = buildTrack3D(track, maxAniso);
    scene.add(builtTrack.group);

    const fogExp = new THREE.FogExp2(
      builtTrack.envConfig.fogHex,
      builtTrack.envConfig.fogDensity
    );
    scene.background = new THREE.Color(builtTrack.envConfig.skyHorizonHex);
    scene.fog = fogExp;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const sun = new THREE.DirectionalLight(
      builtTrack.envConfig.sunHex,
      builtTrack.envConfig.sunIntensity
    );
    sun.position.set(140, 220, 110);
    sun.castShadow = !isSoftwareGl;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 560;
    sun.shadow.camera.left = -130;
    sun.shadow.camera.right = 130;
    sun.shadow.camera.top = 130;
    sun.shadow.camera.bottom = -130;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);

    const hemi = new THREE.HemisphereLight(
      builtTrack.envConfig.hemiSkyHex,
      builtTrack.envConfig.hemiGroundHex,
      builtTrack.envConfig.hemiIntensity
    );
    scene.add(hemi);

    const camera = new THREE.PerspectiveCamera(
      58,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.15,
      1900
    );

    // 4HD GPU Post-Processing (Skipped on Software WebGL per threejs/SKILL.md)
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, Math.max(1, container.clientHeight)),
        0.26, // subtle photorealistic bloom on lights/flames/strobes
        0.35,
        0.86
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    // Build Racer Bodies & 3D Rigs + Flame Meshes
    const totalLaps = activeRoom ? activeRoom.laps : track.laps;
    const racers: RacerBody[] = [];
    const rigs = new Map<string, CarMeshRig>();
    const flameMeshes = new Map<string, THREE.Group>();

    const flameGeo = new THREE.ConeGeometry(0.42, 1.35, 8);
    const flameOuterMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.85,
    });
    const flameCoreMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
    });

    const nSamples = builtTrack.samples.length;
    const pitExitIdx = Math.min(nSamples - 1, 14);
    const pitBaseSample = builtTrack.samples[pitExitIdx];
    const pitGarageSample = builtTrack.samples[Math.max(0, nSamples - 8)];
    const pitSideDist = -(builtTrack.widthMeters * 0.5 + 5.5);

    const attachFlameRig = (carId: string, rootObj: THREE.Group, store: Map<string, THREE.Group>) => {
      const fGroup = new THREE.Group();
      const outer = new THREE.Mesh(flameGeo, flameOuterMat);
      outer.position.set(0, 0.85, -0.75);
      const core = new THREE.Mesh(flameGeo, flameCoreMat);
      core.scale.set(0.55, 0.72, 0.55);
      core.position.set(0, 0.78, -0.75);
      fGroup.add(outer, core);
      fGroup.visible = false;
      rootObj.add(fGroup);
      store.set(carId, fGroup);
    };

    const effectiveSpecs =
      playerRole === 'safety_car'
        ? SAFETY_CAR_SPECS
        : playerRole === 'fire_team'
        ? FIRE_TRUCK_SPECS
        : specs;

    const playerBody = createRacerBody({
      id: playerId,
      name: driverName,
      isPlayer: true,
      carClass: model.carClass,
      bodyStyle: model.bodyStyle,
      primaryColor:
        playerRole === 'safety_car'
          ? '#cbd5e1'
          : playerRole === 'fire_team'
          ? '#dc2626'
          : activeCar.tuning.primaryColor,
      secondaryColor: activeCar.tuning.secondaryColor,
      raceNumber: activeCar.tuning.raceNumber,
      specs: effectiveSpecs,
      tuning: activeCar.tuning,
      damage: playerRole === 'driver' ? activeCar.damage : undefined,
      gridSlot: activeRoom ? 0 : playerRole === 'driver' ? 5 : 0,
      samples: builtTrack.samples,
    });

    // If local player is driving Safety Car or Fire Truck, place them at Pit Exit ready to enter circuit
    if (playerRole !== 'driver') {
      const spawnSample = playerRole === 'safety_car' ? pitBaseSample : pitGarageSample;
      playerBody.x = spawnSample.pos.x + spawnSample.right.x * (pitSideDist + 2.2);
      playerBody.y = spawnSample.pos.y;
      playerBody.z = spawnSample.pos.z + spawnSample.right.z * (pitSideDist + 2.2);
      playerBody.heading = Math.atan2(spawnSample.tangent.x, spawnSample.tangent.z);
    }

    racers.push(playerBody);

    let playerCarRig: CarMeshRig | null = null;
    let playerSupportRig: SupportVehicleRig | null = null;
    let playerWaterJetTimer = 0;
    let playerStrobeActive = false;

    const playerPowertrain =
      ENGINE_ARCHITECTURES[activeCar.tuning.engineArch]?.powertrainType ?? model.powertrainType;

    if (playerRole === 'driver') {
      playerCarRig = buildCarModel3D(
        model.bodyStyle,
        model.carClass,
        activeCar.tuning,
        maxAniso,
        playerPowertrain
      );
      scene.add(playerCarRig.root);
      rigs.set(playerBody.id, playerCarRig);
      attachFlameRig(playerBody.id, playerCarRig.root, flameMeshes);
    } else if (playerRole === 'safety_car') {
      playerSupportRig = buildSafetyCar3D();
      playerSupportRig.root.position.set(playerBody.x, playerBody.y, playerBody.z);
      playerSupportRig.root.rotation.y = playerBody.heading;
      scene.add(playerSupportRig.root);
    } else {
      playerSupportRig = buildFireTruck3D();
      playerSupportRig.root.position.set(playerBody.x, playerBody.y, playerBody.z);
      playerSupportRig.root.rotation.y = playerBody.heading;
      scene.add(playerSupportRig.root);
    }

    const remoteRigs = new Map<string, RemoteEntityRig>();
    const remoteFlameMeshes = new Map<string, THREE.Group>();
    if (activeRoom) {
      let remoteFireCount = 0;
      for (const pl of activeRoom.players) {
        if (pl.playerId === playerId) continue;
        const plRole = pl.role || 'driver';
        if (plRole === 'safety_car') {
          const sRig = buildSafetyCar3D();
          scene.add(sRig.root);
          remoteRigs.set(pl.playerId, { kind: 'support', rig: sRig, role: 'safety_car' });
        } else if (plRole === 'fire_team') {
          const fRig = remoteFireCount === 0 ? buildFireTruck3D() : buildFastFireCar3D();
          remoteFireCount += 1;
          scene.add(fRig.root);
          remoteRigs.set(pl.playerId, { kind: 'support', rig: fRig, role: 'fire_team' });
        } else {
          const remoteBaseModel =
            CAR_CATALOG.find((m) => m.bodyStyle === pl.bodyStyle && m.carClass === pl.carClass) ??
            model;
          const tuning = {
            ...createDefaultTuning(remoteBaseModel),
            primaryColor: pl.primaryColor,
            secondaryColor: pl.secondaryColor,
            raceNumber: pl.raceNumber,
          };
          const rRig = buildCarModel3D(
            pl.bodyStyle,
            pl.carClass,
            tuning,
            maxAniso,
            pl.powertrainType ?? remoteBaseModel.powertrainType
          );
          scene.add(rRig.root);
          attachFlameRig(pl.playerId, rRig.root, remoteFlameMeshes);
          remoteRigs.set(pl.playerId, { kind: 'car', rig: rRig, role: 'driver' });
        }
      }
    } else {
      const npcCfg = getNpcDifficultyConfig(npcLevel);
      const classModels = CAR_CATALOG.filter((m) => m.carClass === model.carClass);
      const aiPool = classModels.length > 0 ? classModels : [model];
      AI_DRIVERS.forEach((ai, idx) => {
        const aiModel = aiPool[idx % aiPool.length] ?? model;
        const aiTuning = {
          ...createDefaultTuning(aiModel),
          primaryColor: ai.color,
          secondaryColor: ai.sec,
          raceNumber: ai.num,
        };
        const aiSpecs = {
          ...specs,
          powerHp: Math.round(specs.powerHp * npcCfg.powerMult * (0.94 + idx * 0.024)),
          topSpeedKmh: Math.round(specs.topSpeedKmh * npcCfg.speedMult * (0.95 + idx * 0.018)),
        };
        const aiBody = createRacerBody({
          id: `ai_${idx}`,
          name: ai.name,
          isPlayer: false,
          carClass: aiModel.carClass,
          bodyStyle: aiModel.bodyStyle,
          primaryColor: ai.color,
          secondaryColor: ai.sec,
          raceNumber: ai.num,
          specs: aiSpecs,
          tuning: aiTuning,
          gridSlot: idx,
          samples: builtTrack.samples,
          aiSkill: npcCfg.skillBase + idx * npcCfg.skillStep,
        });
        racers.push(aiBody);
        const aiRig = buildCarModel3D(
          aiModel.bodyStyle,
          aiModel.carClass,
          aiTuning,
          maxAniso,
          aiModel.powertrainType
        );
        scene.add(aiRig.root);
        rigs.set(aiBody.id, aiRig);
        attachFlameRig(aiBody.id, aiRig.root, flameMeshes);
      });
    }

    // Build NPC Support Teams ONLY when NO real players occupy those teams!
    const safetyCarRig: SupportVehicleRig | null = hasHumanSafetyCar ? null : buildSafetyCar3D();
    const fireTruckRig: SupportVehicleRig | null = hasHumanFireTeam ? null : buildFireTruck3D();
    const fastFireRig: SupportVehicleRig | null = hasHumanFireTeam ? null : buildFastFireCar3D();
    if (safetyCarRig) scene.add(safetyCarRig.root);
    if (fireTruckRig && fastFireRig) scene.add(fireTruckRig.root, fastFireRig.root);

    const positionAtSample = (
      rig: SupportVehicleRig,
      sFloat: number,
      latOffset: number,
      speedWheel: number,
      dt: number
    ) => {
      const wrapped = ((sFloat % 1) + 1) % 1;
      const idxF = wrapped * nSamples;
      const i0 = Math.floor(idxF) % nSamples;
      const i1 = (i0 + 1) % nSamples;
      const alpha = idxF - Math.floor(idxF);
      const a = builtTrack.samples[i0];
      const b = builtTrack.samples[i1];

      const px = THREE.MathUtils.lerp(a.pos.x, b.pos.x, alpha) + a.right.x * latOffset;
      const py = THREE.MathUtils.lerp(a.pos.y, b.pos.y, alpha);
      const pz = THREE.MathUtils.lerp(a.pos.z, b.pos.z, alpha) + a.right.z * latOffset;
      rig.root.position.set(px, py, pz);

      const tx = THREE.MathUtils.lerp(a.tangent.x, b.tangent.x, alpha);
      const tz = THREE.MathUtils.lerp(a.tangent.z, b.tangent.z, alpha);
      rig.root.rotation.y = Math.atan2(tx, tz);

      for (const w of rig.wheels) {
        w.rotation.x += speedWheel * dt;
      }
    };

    // Initial parked positions in Pit Lane for NPC teams
    const scState = {
      phase: 'standby' as SafetyCarPhase,
      s: pitBaseSample.s,
      latOffset: pitSideDist,
      speedMs: 0,
    };
    const fireTeamState = {
      dispatched: false,
      arrived: false,
      waterJetTimer: 0,
      truckS: pitGarageSample.s,
      truckLat: pitSideDist - 1.5,
      suvS: (pitGarageSample.s + 0.015) % 1,
      suvLat: pitSideDist - 1.5,
      safetyBonusEarned: 0,
    };

    if (safetyCarRig) {
      positionAtSample(safetyCarRig, scState.s, scState.latOffset, 0, 0);
    }
    if (fireTruckRig && fastFireRig) {
      positionAtSample(fireTruckRig, fireTeamState.truckS, fireTeamState.truckLat, 0, 0);
      positionAtSample(fastFireRig, fireTeamState.suvS, fireTeamState.suvLat, 0, 0);
    }

    // Spark & Smoke Particle Pool (Zero GC)
    const PARTICLE_COUNT = 52;
    const sparkGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x27272a,
      transparent: true,
      opacity: 0.62,
    });
    const particles: {
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      isSmoke: boolean;
    }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isSmoke = i >= 24;
      const m = new THREE.Mesh(sparkGeo, isSmoke ? smokeMat : sparkMat);
      m.visible = false;
      scene.add(m);
      particles.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, isSmoke });
    }
    let nextSparkIdx = 0;
    let nextSmokeIdx = 24;

    const spawnSparks = (pos: THREE.Vector3, count: number) => {
      for (let k = 0; k < count; k++) {
        const p = particles[nextSparkIdx];
        nextSparkIdx = (nextSparkIdx + 1) % 24;
        p.mesh.position.copy(pos);
        p.mesh.scale.setScalar(1);
        p.mesh.visible = true;
        p.vx = (Math.random() - 0.5) * 15;
        p.vy = 2.5 + Math.random() * 6.5;
        p.vz = (Math.random() - 0.5) * 15;
        p.life = 0.42;
      }
    };

    const spawnSmoke = (x: number, y: number, z: number, thick = false) => {
      const p = particles[nextSmokeIdx];
      nextSmokeIdx = 24 + ((nextSmokeIdx - 24 + 1) % (PARTICLE_COUNT - 24));
      p.mesh.position.set(
        x + (Math.random() - 0.5) * 0.6,
        y + 0.9,
        z + (Math.random() - 0.5) * 0.6
      );
      p.mesh.scale.setScalar(thick ? 3.8 : 2.3);
      p.mesh.visible = true;
      p.vx = (Math.random() - 0.5) * 1.6;
      p.vy = thick ? 3.2 + Math.random() * 2.2 : 1.7 + Math.random() * 1.4;
      p.vz = (Math.random() - 0.5) * 1.6;
      p.life = thick ? 1.1 : 0.72;
    };

    // 3D Carbon-Fiber Crash Debris Pool (Zero GC)
    const DEBRIS_COUNT = 24;
    const debrisGeo = new THREE.BoxGeometry(0.28, 0.04, 0.18);
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.45,
      metalness: 0.28,
    });
    const debrisPool: {
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      rx: number;
      ry: number;
      life: number;
      floorY: number;
    }[] = [];
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const m = new THREE.Mesh(debrisGeo, debrisMat);
      m.visible = false;
      m.castShadow = !isSoftwareGl;
      scene.add(m);
      debrisPool.push({ mesh: m, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, life: 0, floorY: 0 });
    }
    let nextDebrisIdx = 0;
    const spawnDebris = (pos: THREE.Vector3, count: number, severity: number) => {
      for (let k = 0; k < count; k++) {
        const d = debrisPool[nextDebrisIdx];
        nextDebrisIdx = (nextDebrisIdx + 1) % DEBRIS_COUNT;
        d.mesh.position.set(
          pos.x + (Math.random() - 0.5) * 0.8,
          pos.y + 0.25,
          pos.z + (Math.random() - 0.5) * 0.8
        );
        const s = 0.65 + Math.random() * 0.9 * severity;
        d.mesh.scale.set(s, s, s);
        d.mesh.visible = true;
        d.vx = (Math.random() - 0.5) * (10 + severity * 14);
        d.vy = 2.8 + Math.random() * (4.5 + severity * 6.5);
        d.vz = (Math.random() - 0.5) * (10 + severity * 14);
        d.rx = (Math.random() - 0.5) * 14;
        d.ry = (Math.random() - 0.5) * 14;
        d.floorY = Math.max(0.04, pos.y - 0.42);
        d.life = 1.65;
      }
    };
    const notifiedEmergencies = new Set<string>();

    // 3D Falling Rain Curtain (Single BufferGeometry Draw Call, Zero GC)
    const RAIN_COUNT = 520;
    const rainPositions = new Float32Array(RAIN_COUNT * 6);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const rx = (Math.random() - 0.5) * 76;
      const ry = Math.random() * 24;
      const rz = (Math.random() - 0.5) * 76;
      const idx = i * 6;
      rainPositions[idx] = rx;
      rainPositions[idx + 1] = ry;
      rainPositions[idx + 2] = rz;
      rainPositions[idx + 3] = rx - 0.25;
      rainPositions[idx + 4] = ry - 1.55;
      rainPositions[idx + 5] = rz + 0.18;
    }
    const rainGeo = new THREE.BufferGeometry();
    const rainPosAttr = new THREE.BufferAttribute(rainPositions, 3);
    rainGeo.setAttribute('position', rainPosAttr);
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.frustumCulled = false;
    rainLines.visible = false;
    scene.add(rainLines);

    // Wet Rear-Tire Water Spray Mist Pool (Zero GC)
    const SPRAY_COUNT = 22;
    const sprayGeo = new THREE.BoxGeometry(0.45, 0.35, 0.75);
    const sprayMat = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const sprayPool: {
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      life: number;
    }[] = [];
    for (let i = 0; i < SPRAY_COUNT; i++) {
      const m = new THREE.Mesh(sprayGeo, sprayMat);
      m.visible = false;
      scene.add(m);
      sprayPool.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    let nextSprayIdx = 0;
    const spawnTireSpray = (r: RacerBody, wetness: number) => {
      const p = sprayPool[nextSprayIdx];
      nextSprayIdx = (nextSprayIdx + 1) % SPRAY_COUNT;
      const backX = -Math.sin(r.heading) * 2.1;
      const backZ = -Math.cos(r.heading) * 2.1;
      const side = (Math.random() - 0.5) * 1.4;
      p.mesh.position.set(r.x + backX + side, r.y + 0.32, r.z + backZ);
      const s = 0.8 + wetness * 1.1;
      p.mesh.scale.set(s, s * 0.75, s * 1.3);
      p.mesh.visible = true;
      p.vx = backX * 2.8 + (Math.random() - 0.5) * 2.2;
      p.vy = 1.4 + wetness * 1.8;
      p.vz = backZ * 2.8 + (Math.random() - 0.5) * 2.2;
      p.life = 0.36;
    };

    // Pre-allocated Weather Colors (Zero GC)
    const _skyClearCol = new THREE.Color(0xffffff);
    const _skyDampCol = new THREE.Color(0x8899ab);
    const _skyRainCol = new THREE.Color(0x475569);
    const _baseFogCol = new THREE.Color(builtTrack.envConfig.fogHex);
    const _rainFogCol = new THREE.Color(builtTrack.envConfig.isNight ? 0x0b1220 : 0x5c6b7c);
    const _baseBgCol = new THREE.Color(builtTrack.envConfig.skyHorizonHex);
    const _rainBgCol = new THREE.Color(builtTrack.envConfig.isNight ? 0x09101d : 0x516072);
    const _roadDryCol = new THREE.Color(0xffffff);
    const _roadWetCol = new THREE.Color(0x8a97a8);

    const initialForecastCond =
      weatherModeRef.current === 'dynamic'
        ? forecastRef.current.slots[0].condition
        : weatherModeRef.current;
    let trackWetness =
      initialForecastCond === 'rain' ? 1.0 : initialForecastCond === 'damp' ? 0.48 : 0;
    let rainIntensity =
      initialForecastCond === 'rain' ? 1.0 : initialForecastCond === 'damp' ? 0.16 : 0;
    let activeWeatherCondition: WeatherCondition = initialForecastCond;
    let liveAmbientTempC = forecastRef.current.ambientTempC;
    let liveAsphaltTempC = forecastRef.current.initialAsphaltTempC;
    let sprayTimer = 0;

    const _camPos = new THREE.Vector3();
    const _camTarget = new THREE.Vector3();
    const _desiredCamPos = new THREE.Vector3();
    const minimapPts = builtTrack.samples
      .filter((_, idx) => idx % 4 === 0)
      .map((s) => ({ x: s.pos.x, z: s.pos.z }));

    const initFwdX = Math.sin(playerBody.heading);
    const initFwdZ = Math.cos(playerBody.heading);
    _camPos.set(
      playerBody.x - initFwdX * 7.5,
      playerBody.y + 3.1,
      playerBody.z - initFwdZ * 7.5
    );
    camera.position.copy(_camPos);
    camera.lookAt(playerBody.x, playerBody.y + 0.8, playerBody.z);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let phase: 'standby' | 'countdown' | 'racing' | 'finished' = phaseTrigger;
    let countdownElapsed = 0;
    let raceTimeMs = 0;
    let lastTick = performance.now();
    let hudTimer = 0;
    let telemetryTimer = 0;
    let smokeTimer = 0;
    let shakeIntensity = 0;
    let prevPitPhase: RacerBody['pitPhase'] = 'none';
    let frameId = 0;
    let disposed = false;

    const toolCooldowns: Record<FireToolType, number> = {
      extinguisher: 0,
      water_cannon: 0,
      foam_afff: 0,
      ers_cutoff: 0,
    };

    if (phase === 'countdown' || phase === 'racing') {
      audioRef.current.start(activeCar.tuning.engineArch);
    }

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const shortestWrapDelta = (fromS: number, toS: number) => {
      let d = toS - fromS;
      if (d > 0.5) d -= 1;
      if (d < -0.5) d += 1;
      return d;
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTick) / 1000));
      lastTick = now;

      // Cooldown tick
      (Object.keys(toolCooldowns) as FireToolType[]).forEach((t) => {
        if (toolCooldowns[t] > 0) toolCooldowns[t] = Math.max(0, toolCooldowns[t] - dt);
      });

      // Handle Start Gantry Lights during Countdown
      if (phase === 'countdown') {
        countdownElapsed += dt;
        const litCount = Math.min(5, Math.ceil((countdownElapsed / 2.6) * 5));
        builtTrack.startLightMeshes.forEach((pod, idx) => {
          (pod.material as THREE.MeshStandardMaterial).emissiveIntensity =
            idx < litCount ? 4.5 : 0;
        });
        if (countdownElapsed >= 3.0) {
          phase = 'racing';
          builtTrack.startLightMeshes.forEach((pod) => {
            (pod.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
          });
        }
      }

      // Process incoming multiplayer fire extinguish assistance on local player
      if (incomingFireHelpRef.current) {
        const help = incomingFireHelpRef.current;
        incomingFireHelpRef.current = null;
        if (playerBody.onFire) {
          const putOut = applyFireToolToCar(playerBody, help.tool);
          audioRef.current.playFireExtinguish();
          setRaceControlNote(
            putOut
              ? `${help.fromPlayerName} (Antincendio) ha spento il tuo incendio!`
              : `${help.fromPlayerName} (Antincendio) sta domando le fiamme...`
          );
        }
      }

      // Process Interactive Race Control & Fire Team Triggers
      const actions = controlActionsRef.current;
      if (actions.triggerFireDrill) {
        actions.triggerFireDrill = false;
        const target = racers.find((r) => !r.isPlayer && !r.onFire) ?? playerBody;
        target.onFire = true;
        target.fireIntensity = 68;
        target.damage.engine = Math.max(target.damage.engine, 48);
        if (!hasHumanFireTeam) {
          fireTeamState.dispatched = true;
        }
        if (!hasHumanSafetyCar && scState.phase === 'standby') {
          scState.phase = 'deployed';
        }
        audioRef.current.playSirenChirp();
        setRaceControlNote(
          hasHumanFireTeam || hasHumanSafetyCar
            ? `Emergenza incendio su ${target.name}! Intervento affidato ai Team Reali in pista.`
            : `Emergenza incendio su ${target.name}! Squadra Antincendio e Safety Car NPC in pista.`
        );
      }

      if (actions.dispatchFireTeam) {
        actions.dispatchFireTeam = false;
        if (playerRole === 'fire_team') {
          playerStrobeActive = !playerStrobeActive;
          if (playerStrobeActive) {
            audioRef.current.playSirenChirp();
            setRaceControlNote('Sirena e lampeggianti Autobotta attivati!');
          } else {
            setRaceControlNote('Lampeggianti Autobotta disattivati.');
          }
        } else if (!hasHumanFireTeam) {
          fireTeamState.dispatched = !fireTeamState.dispatched;
          if (fireTeamState.dispatched) {
            audioRef.current.playSirenChirp();
            setRaceControlNote('Autobotta e Auto Antincendio Rapida NPC inviate in pista.');
          } else {
            fireTeamState.arrived = false;
            setRaceControlNote('Squadra Antincendio NPC rientrata ai Box.');
          }
        } else {
          setRaceControlNote('Squadra Antincendio controllata da giocatori reali — NPC non attivo.');
        }
      }

      if (actions.recallFireTeam) {
        actions.recallFireTeam = false;
        fireTeamState.dispatched = false;
        fireTeamState.arrived = false;
      }

      if (actions.toggleSafetyCar) {
        actions.toggleSafetyCar = false;
        if (playerRole === 'safety_car') {
          playerStrobeActive = !playerStrobeActive;
          scState.phase = playerStrobeActive ? 'deployed' : 'standby';
          audioRef.current.playSirenChirp();
          setRaceControlNote(
            playerStrobeActive
              ? 'Safety Car (Tu) in regime di neutralizzazione — lampeggianti attivi!'
              : 'Safety Car: bandiera verde ripresa.'
          );
        } else if (!hasHumanSafetyCar) {
          if (scState.phase === 'standby') {
            scState.phase = 'deployed';
            setRaceControlNote('Direzione Gara: SAFETY CAR NPC IN PISTA.');
          } else if (scState.phase === 'deployed') {
            scState.phase = 'in_this_lap';
            setRaceControlNote('Safety Car NPC ai Box al termine del giro.');
          } else {
            scState.phase = 'standby';
          }
        } else {
          setRaceControlNote('Safety Car controllata da un giocatore reale — NPC non attivo.');
        }
      }

      if (actions.useFireTool) {
        const tool = actions.useFireTool;
        actions.useFireTool = null;
        if (toolCooldowns[tool] <= 0) {
          const localBurner =
            (playerBody.onFire ? playerBody : null) ??
            racers.find((r) => r.onFire) ??
            null;
          let remoteBurner: RemoteRacerTelemetry | null = null;
          if (!localBurner && activeRoom) {
            remoteTelemetryRef.current.forEach((tele) => {
              if (!remoteBurner && tele.onFire) remoteBurner = tele;
            });
          }

          if (localBurner) {
            if (tool === 'water_cannon') {
              if (playerRole === 'fire_team') {
                playerWaterJetTimer = 1.6;
              } else if (!hasHumanFireTeam) {
                fireTeamState.waterJetTimer = 1.4;
                fireTeamState.dispatched = true;
              }
            }
            const extinguished = applyFireToolToCar(localBurner, tool);
            toolCooldowns[tool] = tool === 'water_cannon' ? 2.5 : 1.6;
            audioRef.current.playFireExtinguish();
            if (extinguished) {
              fireTeamState.safetyBonusEarned += 1500;
              setRaceControlNote(
                `Incendio domato su ${localBurner.name}! Bonus Sicurezza +1.500 CR.`
              );
              if (!hasHumanSafetyCar && !racers.some((r) => r.onFire) && scState.phase === 'deployed') {
                scState.phase = 'in_this_lap';
              }
            }
          } else if (remoteBurner) {
            const rb = remoteBurner as RemoteRacerTelemetry;
            if (tool === 'water_cannon' && playerRole === 'fire_team') {
              playerWaterJetTimer = 1.6;
            }
            toolCooldowns[tool] = tool === 'water_cannon' ? 2.5 : 1.6;
            audioRef.current.playFireExtinguish();
            callbacksRef.current.onSendFireExtinguish(rb.playerId, tool);
            fireTeamState.safetyBonusEarned += 750;
            setRaceControlNote(
              `Intervento antincendio inviato su ${rb.playerName} (+750 CR)!`
            );
          }
        }
      }

      // Dynamic Weather Evolution (Follows Pre-Race 3-Slot Forecast + Real-Time Asphalt Temp)
      const wMode = weatherModeRef.current;
      const curForecast = forecastRef.current;
      const envClimate = getEnvClimateBase(track.environment);
      let targetWet = 0;
      let targetRain = 0;
      let targetCond: WeatherCondition = 'sunny';

      if (wMode === 'dynamic') {
        const cycleSec = (raceTimeMs / 1000) % 108;
        const slotIdx = cycleSec < 32 ? 0 : cycleSec < 70 ? 1 : 2;
        targetCond = curForecast.slots[slotIdx].condition;
      } else {
        targetCond = wMode;
      }

      targetWet = targetCond === 'rain' ? 1.0 : targetCond === 'damp' ? 0.48 : 0;
      targetRain = targetCond === 'rain' ? 1.0 : targetCond === 'damp' ? 0.18 : 0;

      const wetLerpRate = wMode === 'dynamic' ? 0.12 : 0.3;
      trackWetness = THREE.MathUtils.lerp(trackWetness, targetWet, Math.min(1, dt * wetLerpRate));
      rainIntensity = THREE.MathUtils.lerp(rainIntensity, targetRain, Math.min(1, dt * 0.65));

      // Real-time ambient & asphalt temperature evolution (sun heating vs rain cooling + micro cloud waves)
      const timeSec = raceTimeMs / 1000;
      const cloudWave = Math.sin(timeSec * 0.14) * 1.3 + Math.cos(timeSec * 0.065) * 0.9;
      const targetAmbient =
        curForecast.ambientTempC - rainIntensity * 3.4 - trackWetness * 1.4 + cloudWave * 0.3;
      liveAmbientTempC = THREE.MathUtils.lerp(liveAmbientTempC, targetAmbient, Math.min(1, dt * 0.25));

      const rubberHeat = phase === 'racing' ? Math.min(2.8, timeSec * 0.028) : 0;
      const solarAsphaltGain =
        THREE.MathUtils.lerp(envClimate.sunBoost, envClimate.rainBoost, Math.min(1, trackWetness * 0.85 + rainIntensity * 0.35));
      const targetAsphalt = liveAmbientTempC + solarAsphaltGain + rubberHeat + cloudWave;
      liveAsphaltTempC = THREE.MathUtils.lerp(liveAsphaltTempC, targetAsphalt, Math.min(1, dt * 0.22));

      if (phase === 'racing' && targetCond !== activeWeatherCondition) {
        activeWeatherCondition = targetCond;
        if (targetCond === 'rain') {
          setRaceControlNote('METEO: Pioggia in pista — asfalto in raffreddamento e grip ridotto!');
        } else if (targetCond === 'damp') {
          setRaceControlNote('METEO: Pista umida — asfalto scivoloso e scie d’acqua.');
        } else {
          setRaceControlNote('METEO: Torna il sole — temperatura asfalto in aumento!');
        }
      } else if (phase !== 'racing') {
        activeWeatherCondition = targetCond;
      }

      // Apply 3D Weather Visuals (Wet Reflective Asphalt, Storm Sky & Fog Visibility)
      const atmosFactor = Math.max(trackWetness * 0.72, rainIntensity);
      builtTrack.roadMat.roughness = THREE.MathUtils.lerp(0.9, 0.14, trackWetness);
      builtTrack.roadMat.metalness = THREE.MathUtils.lerp(0.08, 0.54, trackWetness);
      builtTrack.roadMat.color.copy(_roadDryCol).lerp(_roadWetCol, trackWetness);

      fogExp.density = THREE.MathUtils.lerp(builtTrack.envConfig.fogDensity, 0.0086, atmosFactor);
      fogExp.color.copy(_baseFogCol).lerp(_rainFogCol, atmosFactor);
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(_baseBgCol).lerp(_rainBgCol, atmosFactor);
      }

      if (trackWetness < 0.5) {
        builtTrack.skyMat.color.copy(_skyClearCol).lerp(_skyDampCol, trackWetness * 2);
      } else {
        builtTrack.skyMat.color.copy(_skyDampCol).lerp(_skyRainCol, (trackWetness - 0.5) * 2);
      }

      sun.intensity = builtTrack.envConfig.sunIntensity * (1 - rainIntensity * 0.62 - trackWetness * 0.16);
      hemi.intensity = builtTrack.envConfig.hemiIntensity * (1 - rainIntensity * 0.22);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(1.12, 0.94, rainIntensity);

      // Animate 3D Rain Streaks around Player
      rainLines.visible = rainIntensity > 0.03;
      if (rainLines.visible) {
        rainLines.position.set(playerBody.x, playerBody.y, playerBody.z);
        rainMat.opacity = rainIntensity * 0.54;
        const posArr = rainPosAttr.array as Float32Array;
        const dropDy = 32 * dt;
        const dropDx = 4.2 * dt;
        for (let i = 0; i < RAIN_COUNT; i++) {
          const idx = i * 6;
          posArr[idx] -= dropDx;
          posArr[idx + 1] -= dropDy;
          posArr[idx + 3] -= dropDx;
          posArr[idx + 4] -= dropDy;
          if (posArr[idx + 1] < 0) {
            const resetY = 23 + Math.random() * 2;
            const rx = (Math.random() - 0.5) * 76;
            const rz = (Math.random() - 0.5) * 76;
            posArr[idx] = rx;
            posArr[idx + 1] = resetY;
            posArr[idx + 2] = rz;
            posArr[idx + 3] = rx - 0.25;
            posArr[idx + 4] = resetY - 1.55;
            posArr[idx + 5] = rz + 0.18;
          }
        }
        rainPosAttr.needsUpdate = true;
      }

      if (phase === 'racing') {
        raceTimeMs += dt * 1000;

        const k = keysRef.current;
        const mIn = mobileInputRef.current;
        const mobileActive = isMobileDeviceRef.current;
        const autoGasThrottle = mobileActive && mIn.autoGas && mIn.brake === 0 ? 1 : 0;
        const throttle = Math.max(
          k['KeyW'] || k['ArrowUp'] ? 1 : 0,
          mobileActive ? mIn.throttle : 0,
          autoGasThrottle
        );
        const brake = Math.max(
          k['KeyS'] || k['ArrowDown'] ? 1 : 0,
          mobileActive ? mIn.brake : 0
        );
        const keySteer =
          (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
        const steer = THREE.MathUtils.clamp(
          keySteer + (mobileActive ? mIn.steer : 0),
          -1,
          1
        );

        const playerInput = {
          throttle,
          brake,
          steer,
          ers: Boolean(k['ShiftLeft'] || k['ShiftRight'] || (mobileActive && mIn.ers)),
          drs:
            scState.phase === 'standby' &&
            trackWetness < 0.5 &&
            Boolean(k['Space'] || (mobileActive && mIn.drs)),
          shiftUp: false,
          shiftDown: false,
          pitRepair: Boolean(k['KeyP'] || (mobileActive && mIn.pit)),
        };

        const pRes = stepRacerPhysics(
          playerBody,
          playerInput,
          builtTrack.samples,
          builtTrack.widthMeters,
          totalLaps,
          raceTimeMs,
          dt,
          pitCrewStats,
          trackWetness,
          drivingModeRef.current,
          steerSensitivityRef.current,
          liveAsphaltTempC
        );
        if (playerBody.pitPhase !== prevPitPhase) {
          if (playerBody.pitPhase === 'servicing') {
            audioRef.current.playPitWheelGun();
          } else if (playerBody.pitPhase === 'ready') {
            audioRef.current.playPitComplete();
            setRaceControlNote(
              `Pit Stop completato in ${playerBody.pitElapsedSec.toFixed(2)} s (${pitCrewStats.pitStopTierLabel})!`
            );
          }
          prevPitPhase = playerBody.pitPhase;
        }
        if (pRes.impactSeverity > 0.12 && pRes.impactPos) {
          spawnSparks(pRes.impactPos, Math.round(8 + pRes.impactSeverity * 12));
          if (pRes.impactSeverity > 0.28) {
            spawnDebris(pRes.impactPos, Math.round(4 + pRes.impactSeverity * 7), pRes.impactSeverity);
          }
          shakeIntensity = Math.min(0.45, pRes.impactSeverity * 0.48);
          audioRef.current.playImpact(pRes.impactSeverity);
          if (pRes.impactLabel && pRes.impactSeverity > 0.34) {
            setRaceControlNote(`${pRes.impactLabel} — controlla i danni o rientra ai Box [P]`);
          }
        }

        // AI Racers (capped when Safety Car is deployed — either NPC or human SC)
        let humanRemoteScDeployed = false;
        if (activeRoom && hasHumanSafetyCar) {
          remoteTelemetryRef.current.forEach((tele) => {
            if (tele.role === 'safety_car' && (tele.strobeActive || tele.speedKmh > 15)) {
              humanRemoteScDeployed = true;
            }
          });
        }
        const effectiveScActive =
          scState.phase === 'deployed' ||
          (playerRole === 'safety_car' && playerStrobeActive) ||
          humanRemoteScDeployed;
        const scSpeedCap = effectiveScActive ? 36 : undefined;
        for (const r of racers) {
          if (r.isPlayer) continue;
          const prevEmerg = r.emergencyState;
          const aiIn = computeAiInput(
            r,
            builtTrack.samples,
            builtTrack.widthMeters,
            scSpeedCap,
            trackWetness
          );
          stepRacerPhysics(
            r,
            aiIn,
            builtTrack.samples,
            builtTrack.widthMeters,
            totalLaps,
            raceTimeMs,
            dt,
            undefined,
            trackWetness,
            'sport',
            1.0,
            liveAsphaltTempC
          );
          if (r.emergencyState !== prevEmerg) {
            if (r.emergencyState === 'stopped_offtrack' && !notifiedEmergencies.has(`${r.id}_stop`)) {
              notifiedEmergencies.add(`${r.id}_stop`);
              setRaceControlNote(`${r.name} si ferma fuori pista in emergenza!`);
            } else if (r.emergencyState === 'limp_to_pit' && !notifiedEmergencies.has(`${r.id}_pit`)) {
              notifiedEmergencies.add(`${r.id}_pit`);
              setRaceControlNote(`${r.name} rientra lentamente al Pit Stop per riparazioni.`);
            }
          }
        }

        const cRes = resolveCarToCarCollisions(racers);
        if (cRes.impactSeverity > 0.12 && cRes.impactPos) {
          spawnSparks(cRes.impactPos, Math.round(6 + cRes.impactSeverity * 10));
          if (cRes.impactSeverity > 0.28) {
            spawnDebris(cRes.impactPos, Math.round(3 + cRes.impactSeverity * 6), cRes.impactSeverity);
          }
          shakeIntensity = Math.min(0.4, cRes.impactSeverity * 0.44);
          audioRef.current.playImpact(cRes.impactSeverity);
          if (cRes.impactLabel && cRes.impactSeverity > 0.34) {
            setRaceControlNote(`${cRes.impactLabel} — possibili danni aerodinamici!`);
          }
        }

        // Auto-dispatch NPC Fire Team & NPC Safety Car ONLY if NO real humans occupy those teams!
        const anyBurning = racers.some((r) => r.onFire);
        if (anyBurning && !hasHumanFireTeam && !fireTeamState.dispatched) {
          fireTeamState.dispatched = true;
          audioRef.current.playSirenChirp();
          setRaceControlNote('ALLERTA INCENDIO: Squadra Antincendio NPC in uscita!');
        }
        if (anyBurning && !hasHumanSafetyCar && scState.phase === 'standby') {
          scState.phase = 'deployed';
        }

        if (playerRole === 'driver' && playerBody.finished && phase === 'racing') {
          phase = 'finished';
          const raceDriversOnly = racers.filter(
            (r) => !(r.isPlayer && playerRole !== 'driver')
          );
          const allSorted = [...raceDriversOnly].sort(
            (a, b) => b.totalProgress - a.totalProgress
          );
          const pos = allSorted.findIndex((r) => r.isPlayer) + 1;
          const totalCars = activeRoom
            ? Math.max(
                allSorted.length,
                activeRoom.players.filter((p) => (p.role || 'driver') === 'driver').length
              )
            : allSorted.length;

          const npcCfg = getNpcDifficultyConfig(npcLevel);
          const { playerRank: curRank, playerRankPoints: curRp, claimedRankRewards: claimed } =
            rankProgressRef.current;

          const posMultipliers = [1.0, 0.68, 0.48, 0.34, 0.24, 0.18];
          const modeRewardMult = activeRoom ? 1.25 : npcCfg.rewardMult;
          const prizeGross = Math.round(
            track.prizePool *
              (posMultipliers[pos - 1] ?? 0.15) *
              curRank.prizeMultiplier *
              modeRewardMult
          );
          const avgDmg =
            (playerBody.damage.frontAero +
              playerBody.damage.rearAero +
              playerBody.damage.engine +
              playerBody.damage.suspension +
              playerBody.damage.tires +
              playerBody.damage.gearboxBrakes) /
            6;
          const cleanBonus = avgDmg < 8 ? Math.round(prizeGross * 0.2) : 0;
          const safetyBonus = fireTeamState.safetyBonusEarned;
          const repairCost = computeRepairCost(playerBody.damage, model.carClass);
          const netCredits = prizeGross + cleanBonus + safetyBonus;
          const droppedComponent = generateRaceRewardComponent(playerId, driverName, pos);

          const rpEarned = activeRoom
            ? Math.round(computeRaceRpEarned(pos, 7, cleanBonus > 0) * 1.15)
            : computeRaceRpEarned(pos, npcLevel, cleanBonus > 0);
          const nextRp = curRp + rpEarned;
          const newRank = getRankForPoints(nextRp);
          const newlyUnlockedRanks = RANK_LADDER.filter(
            (r) => nextRp >= r.minPoints && !claimed.includes(r.id)
          );
          const rankBonusCredits = newlyUnlockedRanks.reduce(
            (sum, r) => sum + r.promotionBonusCr,
            0
          );
          const newlyUnlockedIds = newlyUnlockedRanks.map((r) => r.id);
          const unlockedCarNames = CAR_CATALOG.filter((m) =>
            newlyUnlockedIds.includes(m.requiredRank)
          ).map((m) => m.name);

          setHud((prev) => ({
            ...prev,
            phase: 'finished',
            finishSummary: {
              position: pos,
              totalCars,
              totalTimeMs: raceTimeMs,
              bestLapMs: playerBody.bestLapMs,
              prizeGross,
              repairCost,
              cleanBonus,
              safetyBonus,
              netCredits,
              npcLevel: activeRoom ? 7 : npcLevel,
              rpEarned,
              rankUpTo: newRank.tierIndex > curRank.tierIndex ? newRank : null,
              rankBonusCredits,
              unlockedCarNames,
              droppedComponent,
            },
          }));

          callbacksRef.current.onRaceFinished({
            carInstanceId: activeCar.instanceId,
            finalDamage: { ...playerBody.damage },
            distanceKm: track.lengthKm * totalLaps,
            won: pos === 1,
            netCredits,
            rpEarned,
            bestLapMs: playerBody.bestLapMs,
            droppedComponent,
          });
        }
      }

      // Animate NPC Team Safety Car (ONLY when no human player is Safety Car!)
      if (safetyCarRig && !hasHumanSafetyCar) {
        if (scState.phase === 'deployed') {
          scState.speedMs = THREE.MathUtils.lerp(scState.speedMs, 38, dt * 2.5);
          scState.latOffset = THREE.MathUtils.lerp(scState.latOffset, 0, dt * 1.8);
          scState.s =
            (scState.s + (scState.speedMs / builtTrack.totalLengthMeters) * dt) % 1;
          positionAtSample(safetyCarRig, scState.s, scState.latOffset, scState.speedMs / 0.35, dt);
        } else if (scState.phase === 'in_this_lap') {
          scState.speedMs = THREE.MathUtils.lerp(scState.speedMs, 42, dt * 2);
          scState.s =
            (scState.s + (scState.speedMs / builtTrack.totalLengthMeters) * dt) % 1;
          const distToPit = Math.abs(shortestWrapDelta(scState.s, pitBaseSample.s));
          if (distToPit < 0.03) {
            scState.latOffset = THREE.MathUtils.lerp(scState.latOffset, pitSideDist, dt * 3.5);
            if (Math.abs(scState.latOffset - pitSideDist) < 0.4) {
              scState.phase = 'standby';
              scState.speedMs = 0;
              setRaceControlNote('Bandiera Verde! La Safety Car NPC è rientrata ai Box.');
            }
          }
          positionAtSample(safetyCarRig, scState.s, scState.latOffset, scState.speedMs / 0.35, dt);
        } else {
          positionAtSample(safetyCarRig, pitBaseSample.s, pitSideDist, 0, dt);
        }

        const scStrobeFlash = scState.phase === 'deployed' && Math.floor(now / 180) % 2 === 0;
        (safetyCarRig.strobeA.material as THREE.MeshStandardMaterial).emissiveIntensity =
          scState.phase === 'deployed' ? (scStrobeFlash ? 4.2 : 0.4) : 0.1;
        (safetyCarRig.strobeB.material as THREE.MeshStandardMaterial).emissiveIntensity =
          scState.phase === 'deployed' ? (scStrobeFlash ? 0.4 : 4.2) : 0.1;
      }

      // Animate NPC Team Antincendio (ONLY when no human players are on the Fire Team!)
      const burningTarget =
        racers.find((r) => r.onFire) ??
        (!hasHumanFireTeam && fireTeamState.dispatched ? playerBody : null);

      if (fireTruckRig && fastFireRig && !hasHumanFireTeam) {
        if (fireTeamState.dispatched && burningTarget) {
          const targetS = ((burningTarget.trackS % 1) + 1) % 1;
          const dTruck = shortestWrapDelta(fireTeamState.truckS, targetS);
          const dSuv = shortestWrapDelta(fireTeamState.suvS, targetS);

          const truckSpeed = Math.abs(dTruck) > 0.014 ? 44 : 0;
          const suvSpeed = Math.abs(dSuv) > 0.011 ? 52 : 0;

          if (truckSpeed > 0) {
            fireTeamState.truckS =
              (fireTeamState.truckS +
                Math.sign(dTruck) * (truckSpeed / builtTrack.totalLengthMeters) * dt +
                1) %
              1;
            fireTeamState.truckLat = THREE.MathUtils.lerp(fireTeamState.truckLat, -3.2, dt * 2);
          }
          if (suvSpeed > 0) {
            fireTeamState.suvS =
              (fireTeamState.suvS +
                Math.sign(dSuv) * (suvSpeed / builtTrack.totalLengthMeters) * dt +
                1) %
              1;
            fireTeamState.suvLat = THREE.MathUtils.lerp(fireTeamState.suvLat, 3.2, dt * 2);
          }

          fireTeamState.arrived = Math.abs(dTruck) <= 0.024;
          positionAtSample(
            fireTruckRig,
            fireTeamState.truckS,
            fireTeamState.truckLat,
            truckSpeed / 0.5,
            dt
          );
          positionAtSample(
            fastFireRig,
            fireTeamState.suvS,
            fireTeamState.suvLat,
            suvSpeed / 0.4,
            dt
          );

          if (fireTeamState.arrived && burningTarget.onFire) {
            fireTeamState.waterJetTimer = Math.max(fireTeamState.waterJetTimer, 0.2);
            burningTarget.fireIntensity = Math.max(0, burningTarget.fireIntensity - 11 * dt);
            if (burningTarget.fireIntensity <= 1) {
              burningTarget.fireIntensity = 0;
              burningTarget.onFire = false;
              fireTeamState.safetyBonusEarned += 1500;
              setRaceControlNote(
                `Squadra Antincendio NPC: fuoco spento su ${burningTarget.name}! (+1.500 CR)`
              );
              if (!hasHumanSafetyCar && !racers.some((r) => r.onFire) && scState.phase === 'deployed') {
                scState.phase = 'in_this_lap';
              }
            }
          }
          if (fireTruckRig.cannonTurret) {
            fireTruckRig.cannonTurret.lookAt(
              burningTarget.x,
              burningTarget.y + 0.6,
              burningTarget.z
            );
          }
        } else {
          fireTeamState.arrived = false;
          fireTeamState.truckS = THREE.MathUtils.lerp(
            fireTeamState.truckS,
            pitGarageSample.s,
            dt * 1.2
          );
          fireTeamState.truckLat = THREE.MathUtils.lerp(
            fireTeamState.truckLat,
            pitSideDist - 1.5,
            dt * 2
          );
          fireTeamState.suvS = THREE.MathUtils.lerp(
            fireTeamState.suvS,
            (pitGarageSample.s + 0.015) % 1,
            dt * 1.2
          );
          fireTeamState.suvLat = THREE.MathUtils.lerp(
            fireTeamState.suvLat,
            pitSideDist - 1.5,
            dt * 2
          );
          positionAtSample(fireTruckRig, fireTeamState.truckS, fireTeamState.truckLat, 0, dt);
          positionAtSample(fastFireRig, fireTeamState.suvS, fireTeamState.suvLat, 0, dt);
        }

        if (fireTeamState.waterJetTimer > 0) {
          fireTeamState.waterJetTimer = Math.max(0, fireTeamState.waterJetTimer - dt);
        }
        if (fireTruckRig.waterJet) {
          fireTruckRig.waterJet.visible = fireTeamState.waterJetTimer > 0;
        }

        const fireFlash = fireTeamState.dispatched && Math.floor(now / 140) % 2 === 0;
        for (const rig of [fireTruckRig, fastFireRig]) {
          (rig.strobeA.material as THREE.MeshStandardMaterial).emissiveIntensity =
            fireTeamState.dispatched ? (fireFlash ? 4.5 : 0.2) : 0.1;
          (rig.strobeB.material as THREE.MeshStandardMaterial).emissiveIntensity =
            fireTeamState.dispatched ? (fireFlash ? 0.2 : 4.5) : 0.1;
        }
      }

      // Sync Human-Controlled Support Vehicle Rig (when player is Safety Car or Fire Team)
      if (playerWaterJetTimer > 0) {
        playerWaterJetTimer = Math.max(0, playerWaterJetTimer - dt);
      }
      if (playerSupportRig) {
        playerSupportRig.root.position.set(playerBody.x, playerBody.y, playerBody.z);
        playerSupportRig.root.rotation.y = playerBody.heading;
        const wheelSpin = (playerBody.speedMs / 0.45) * dt;
        for (const w of playerSupportRig.wheels) {
          w.rotation.x += wheelSpin;
        }
        const pFlash = Math.floor(now / (playerRole === 'fire_team' ? 140 : 180)) % 2 === 0;
        const strobesOn = playerStrobeActive || playerBody.speedMs > 6;
        (playerSupportRig.strobeA.material as THREE.MeshStandardMaterial).emissiveIntensity =
          strobesOn ? (pFlash ? 4.4 : 0.2) : 0.1;
        (playerSupportRig.strobeB.material as THREE.MeshStandardMaterial).emissiveIntensity =
          strobesOn ? (pFlash ? 0.2 : 4.4) : 0.1;
        if (playerSupportRig.waterJet) {
          playerSupportRig.waterJet.visible = playerWaterJetTimer > 0;
        }
        if (playerSupportRig.cannonTurret && burningTarget) {
          playerSupportRig.cannonTurret.lookAt(
            burningTarget.x,
            burningTarget.y + 0.6,
            burningTarget.z
          );
        }
      }

      // Update Audio
      if (phase === 'racing' || phase === 'countdown') {
        audioRef.current.update(
          playerBody.rpm,
          playerBody.specs.maxRpm,
          playerBody.throttle,
          playerBody.slipAmount,
          activeCar.tuning.engineArch,
          playerBody.damage.engine,
          trackWetness,
          playerBody.speedMs
        );
      }

      // Sync 3D Car Meshes, Flames, Wheels, Brake Glow & Damage
      for (const r of racers) {
        const rig = rigs.get(r.id);
        if (!rig) continue;
        rig.root.position.set(r.x, r.y, r.z);
        rig.root.rotation.y = r.heading;

        rig.chassisGroup.rotation.x = THREE.MathUtils.lerp(
          rig.chassisGroup.rotation.x,
          r.chassisPitch,
          Math.min(1, dt * 12)
        );
        rig.wheels.fl.rotation.y = r.steerAngle;
        rig.wheels.fr.rotation.y = r.steerAngle;

        const spinDelta = (r.speedMs / 0.35) * dt;
        for (const w of rig.wheelSpinMeshes) {
          w.rotation.x += spinDelta;
        }

        const glow = r.brake > 0.2 && r.speedMs > 12 ? r.brake * 2.4 : 0;
        for (const disc of rig.brakeDiscs) {
          (disc.material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
        }

        if (rig.drsFlap) {
          const targetAngle = r.drsActive
            ? 0.05
            : -THREE.MathUtils.degToRad(r.tuning.rearWingDeg * 0.8);
          rig.drsFlap.rotation.x = THREE.MathUtils.lerp(
            rig.drsFlap.rotation.x,
            targetAngle,
            Math.min(1, dt * 12)
          );
        }

        if (rig.exhaustFlame) {
          const mat = rig.exhaustFlame.material as THREE.MeshBasicMaterial;
          mat.opacity =
            r.ersActive || (r.throttle > 0.8 && r.rpm > r.specs.maxRpm * 0.91) ? 0.8 : 0;
        }

        const fGroup = flameMeshes.get(r.id);
        if (fGroup) {
          fGroup.visible = r.onFire;
          if (r.onFire) {
            const flicker = 0.75 + Math.sin(now * 0.028) * 0.25;
            const s = (0.45 + (r.fireIntensity / 100) * 0.95) * flicker;
            fGroup.scale.set(s, s * 1.25, s);
          }
        }

        updateCarDamageVisuals(rig, r.damage, r.chassisRoll, r.impactZones);
      }

      // Sync Remote Multiplayer Cars & Human Support Team Vehicles
      if (activeRoom) {
        remoteTelemetryRef.current.forEach((tele, remoteId) => {
          const entry = remoteRigs.get(remoteId);
          if (!entry) return;
          entry.rig.root.position.x = THREE.MathUtils.lerp(entry.rig.root.position.x, tele.x, 0.35);
          entry.rig.root.position.y = THREE.MathUtils.lerp(entry.rig.root.position.y, tele.y, 0.35);
          entry.rig.root.position.z = THREE.MathUtils.lerp(entry.rig.root.position.z, tele.z, 0.35);
          entry.rig.root.rotation.y = tele.heading;

          if (entry.kind === 'support') {
            const wSpin = ((tele.speedKmh / 3.6) / 0.45) * dt;
            for (const w of entry.rig.wheels) w.rotation.x += wSpin;
            const flash = Math.floor(now / 160) % 2 === 0;
            const activeStrobe = Boolean(tele.strobeActive) || tele.speedKmh > 12;
            (entry.rig.strobeA.material as THREE.MeshStandardMaterial).emissiveIntensity =
              activeStrobe ? (flash ? 4.3 : 0.2) : 0.1;
            (entry.rig.strobeB.material as THREE.MeshStandardMaterial).emissiveIntensity =
              activeStrobe ? (flash ? 0.2 : 4.3) : 0.1;
            if (entry.rig.waterJet) {
              entry.rig.waterJet.visible = Boolean(tele.waterJetActive);
            }
          } else {
            const rf = remoteFlameMeshes.get(remoteId);
            if (rf) {
              rf.visible = Boolean(tele.onFire);
              if (tele.onFire) {
                const fl = 0.75 + Math.sin(now * 0.028) * 0.25;
                const sc = (0.45 + ((tele.fireIntensity ?? 60) / 100) * 0.95) * fl;
                rf.scale.set(sc, sc * 1.25, sc);
              }
            }
          }
        });

        telemetryTimer += dt;
        if (phase === 'racing' && telemetryTimer >= 0.05) {
          telemetryTimer = 0;
          const avgDmg =
            (playerBody.damage.frontAero +
              playerBody.damage.rearAero +
              playerBody.damage.engine +
              playerBody.damage.suspension +
              playerBody.damage.tires +
              playerBody.damage.gearboxBrakes) /
            6;
          callbacksRef.current.onSendTelemetry({
            playerId,
            playerName: driverName,
            role: playerRole,
            carClass: model.carClass,
            bodyStyle: model.bodyStyle,
            powertrainType: playerPowertrain,
            primaryColor: activeCar.tuning.primaryColor,
            secondaryColor: activeCar.tuning.secondaryColor,
            raceNumber: activeCar.tuning.raceNumber,
            x: playerBody.x,
            y: playerBody.y,
            z: playerBody.z,
            heading: playerBody.heading,
            speedKmh: Math.round(playerBody.speedMs * 3.6),
            lap: playerBody.lap,
            trackProgress: playerBody.trackS,
            totalProgress: playerBody.totalProgress,
            damageAvg: Math.round(avgDmg),
            finished: playerBody.finished,
            finishTimeMs: playerBody.finishTimeMs,
            onFire: playerBody.onFire,
            fireIntensity: Math.round(playerBody.fireIntensity),
            strobeActive: playerRole !== 'driver' && playerStrobeActive,
            waterJetActive: playerRole === 'fire_team' && playerWaterJetTimer > 0,
          });
        }
      }

      // Smoke Plumes for Fire & Damaged Engines + Wet Tire Water Spray
      smokeTimer += dt;
      if (smokeTimer > 0.09) {
        smokeTimer = 0;
        for (const r of racers) {
          if (r.onFire) {
            spawnSmoke(r.x, r.y, r.z, true);
          } else if (r.damage.engine > 42) {
            spawnSmoke(r.x, r.y, r.z, false);
          }
        }
      }

      sprayTimer += dt;
      if (trackWetness > 0.22 && sprayTimer > 0.06) {
        sprayTimer = 0;
        for (const r of racers) {
          if (r.speedMs > 18) {
            spawnTireSpray(r, trackWetness);
          }
        }
      }

      for (const s of sprayPool) {
        if (!s.mesh.visible) continue;
        s.life -= dt;
        if (s.life <= 0) {
          s.mesh.visible = false;
          continue;
        }
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.y += s.vy * dt;
        s.mesh.position.z += s.vz * dt;
        s.mesh.scale.addScalar(dt * 3.1);
      }

      for (const p of particles) {
        if (!p.mesh.visible) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
          continue;
        }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        if (!p.isSmoke) {
          p.vy -= 14 * dt;
        } else {
          p.mesh.scale.addScalar(dt * 2.5);
        }
      }

      for (const d of debrisPool) {
        if (!d.mesh.visible) continue;
        d.life -= dt;
        if (d.life <= 0) {
          d.mesh.visible = false;
          continue;
        }
        d.vy -= 18 * dt;
        d.mesh.position.x += d.vx * dt;
        d.mesh.position.y += d.vy * dt;
        d.mesh.position.z += d.vz * dt;
        d.mesh.rotation.x += d.rx * dt;
        d.mesh.rotation.y += d.ry * dt;
        if (d.mesh.position.y < d.floorY) {
          d.mesh.position.y = d.floorY;
          d.vy = Math.abs(d.vy) * 0.32;
          d.vx *= 0.65;
          d.vz *= 0.65;
        }
      }

      sun.position.set(playerBody.x + 95, playerBody.y + 150, playerBody.z + 80);
      sun.target.position.set(playerBody.x, playerBody.y, playerBody.z);

      shakeIntensity = Math.max(0, shakeIntensity - dt * 1.4);
      const shakeX = (Math.random() - 0.5) * shakeIntensity;
      const shakeY = (Math.random() - 0.5) * shakeIntensity;

      const fwdX = Math.sin(playerBody.heading);
      const fwdZ = Math.cos(playerBody.heading);
      const rightX = Math.cos(playerBody.heading);
      const rightZ = -Math.sin(playerBody.heading);
      const mode = cameraModeRef.current;

      if (phase === 'standby') {
        const orbitAng = now * 0.00028;
        _desiredCamPos.set(
          playerBody.x + Math.cos(orbitAng) * 8.5,
          playerBody.y + 3.1,
          playerBody.z + Math.sin(orbitAng) * 8.5
        );
        camera.position.lerp(_desiredCamPos, 1 - Math.exp(-6 * dt));
        camera.lookAt(playerBody.x, playerBody.y + 0.7, playerBody.z);
      } else if (mode === 'chase' || mode === 'far') {
        const isFar = mode === 'far';
        const speedNorm = Math.min(1, playerBody.speedMs / 95);
        const dist = (isFar ? 10.6 : 6.8) + speedNorm * (isFar ? 2.2 : 1.4);
        const heightOffset = isFar ? 3.85 : 2.45;
        _desiredCamPos.set(
          playerBody.x - fwdX * dist + rightX * (-playerBody.steerAngle * 0.95) + shakeX,
          playerBody.y + heightOffset + shakeY,
          playerBody.z - fwdZ * dist + rightZ * (-playerBody.steerAngle * 0.95)
        );
        camera.position.lerp(_desiredCamPos, 1 - Math.exp(-10 * dt));
        _camTarget.set(
          playerBody.x + fwdX * (isFar ? 10 : 8),
          playerBody.y + (isFar ? 1.1 : 0.95),
          playerBody.z + fwdZ * (isFar ? 10 : 8)
        );
        camera.lookAt(_camTarget);
        const targetFov = (isFar ? 62 : 58) + speedNorm * 16;
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-6 * dt));
        camera.updateProjectionMatrix();
      } else if (mode === 'cockpit') {
        camera.position.set(
          playerBody.x + fwdX * 0.15 + shakeX * 0.3,
          playerBody.y +
            (model.bodyStyle === 'formula' || model.bodyStyle === 'formula_e' ? 0.98 : 1.15) +
            shakeY * 0.3,
          playerBody.z + fwdZ * 0.15
        );
        _camTarget.set(
          playerBody.x + fwdX * 18,
          playerBody.y + 0.9,
          playerBody.z + fwdZ * 18
        );
        camera.lookAt(_camTarget);
        camera.fov = 72;
        camera.updateProjectionMatrix();
      } else if (mode === 'hood') {
        camera.position.set(
          playerBody.x + fwdX * 1.25 + shakeX * 0.3,
          playerBody.y + 0.85 + shakeY * 0.3,
          playerBody.z + fwdZ * 1.25
        );
        _camTarget.set(
          playerBody.x + fwdX * 22,
          playerBody.y + 0.65,
          playerBody.z + fwdZ * 22
        );
        camera.lookAt(_camTarget);
        camera.fov = 68;
        camera.updateProjectionMatrix();
      } else {
        _desiredCamPos.set(playerBody.x + 14, playerBody.y + 15, playerBody.z + 14);
        camera.position.lerp(_desiredCamPos, 1 - Math.exp(-4 * dt));
        camera.lookAt(playerBody.x, playerBody.y + 0.5, playerBody.z);
        camera.fov = 50;
        camera.updateProjectionMatrix();
      }

      if (composer && !isSoftwareGl) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      hudTimer += dt;
      if (hudTimer >= 0.065) {
        hudTimer = 0;

        const standingsList: {
          id: string;
          name: string;
          isPlayer: boolean;
          progress: number;
          lap: number;
          carClass: typeof model.carClass;
          damagePct: number;
          x: number;
          z: number;
          color: string;
          onFire: boolean;
        }[] = racers
          .filter((r) => !(r.isPlayer && playerRole !== 'driver'))
          .map((r) => ({
            id: r.id,
            name: r.name,
            isPlayer: r.isPlayer,
            progress: r.totalProgress,
            lap: r.lap,
            carClass: r.carClass,
            damagePct: Math.round(
              (r.damage.frontAero +
                r.damage.rearAero +
                r.damage.engine +
                r.damage.suspension +
                r.damage.tires +
                r.damage.gearboxBrakes) /
                6
            ),
            x: r.x,
            z: r.z,
            color: r.isPlayer ? '#e10600' : r.primaryColor,
            onFire: r.onFire,
          }));

        const extraSupportDots: { id: string; x: number; z: number; isPlayer: boolean; color: string }[] = [];
        if (playerRole !== 'driver') {
          extraSupportDots.push({
            id: playerBody.id,
            x: playerBody.x,
            z: playerBody.z,
            isPlayer: true,
            color: playerRole === 'safety_car' ? '#facc15' : '#ef4444',
          });
        }

        let remoteBurningName: string | null = null;
        if (activeRoom) {
          remoteTelemetryRef.current.forEach((tele) => {
            if ((tele.role || 'driver') === 'driver') {
              standingsList.push({
                id: tele.playerId,
                name: tele.playerName,
                isPlayer: false,
                progress: tele.totalProgress,
                lap: tele.lap,
                carClass: tele.carClass,
                damagePct: tele.damageAvg,
                x: tele.x,
                z: tele.z,
                color: tele.primaryColor,
                onFire: Boolean(tele.onFire),
              });
              if (tele.onFire && !remoteBurningName) remoteBurningName = tele.playerName;
            } else {
              extraSupportDots.push({
                id: tele.playerId,
                x: tele.x,
                z: tele.z,
                isPlayer: false,
                color: tele.role === 'safety_car' ? '#facc15' : '#ef4444',
              });
            }
          });
        }

        standingsList.sort((a, b) => b.progress - a.progress);
        const playerPos =
          playerRole === 'driver'
            ? standingsList.findIndex((s) => s.isPlayer) + 1
            : 0;
        const leaderProg = standingsList[0]?.progress ?? 0;
        const firstBurning = racers.find((r) => r.onFire) ?? null;

        setHud((prev) => ({
          ...prev,
          phase,
          countdownValue: Math.max(1, Math.ceil(3 - countdownElapsed)),
          speedKmh: Math.round(playerBody.speedMs * 3.6),
          rpm: Math.round(playerBody.rpm),
          maxRpm: playerBody.specs.maxRpm,
          gear: playerBody.gear,
          throttle: playerBody.throttle,
          brake: playerBody.brake,
          ersCharge: Math.round(playerBody.ersCharge),
          ersActive: playerBody.ersActive,
          drsAvailable:
            playerRole === 'driver' &&
            scState.phase === 'standby' &&
            trackWetness < 0.5 &&
            playerBody.inDrsZone,
          drsActive: playerBody.drsActive,
          lap: playerBody.lap,
          totalLaps,
          lapTimeMs: phase === 'racing' ? raceTimeMs - playerBody.lapStartMs : 0,
          bestLapMs: playerBody.bestLapMs,
          lastLapMs: playerBody.lastLapMs,
          position: Math.max(1, playerPos),
          totalCars: standingsList.length,
          damage: { ...playerBody.damage },
          offTrack: playerBody.offTrack,
          inPit: playerBody.inPit,
          nearPitWindow: playerBody.nearPitWindow,
          pitPhase: playerBody.pitPhase,
          pitElapsedSec: Number(playerBody.pitElapsedSec.toFixed(2)),
          pitReactionRemainingSec: Number(playerBody.pitReactionRemainingSec.toFixed(2)),
          pitTireProgressPct: Math.round(playerBody.pitTireProgress),
          lastPitStopTimeSec: playerBody.lastPitStopTimeSec,
          playerOnFire: playerBody.onFire,
          playerFireIntensity: Math.round(playerBody.fireIntensity),
          anyCarOnFire: Boolean(firstBurning || remoteBurningName),
          burningCarName: firstBurning ? firstBurning.name : remoteBurningName,
          fireTeamDispatched:
            playerRole === 'fire_team' ? playerStrobeActive : fireTeamState.dispatched,
          fireTeamArrived: !hasHumanFireTeam && fireTeamState.arrived,
          waterJetActive:
            playerRole === 'fire_team'
              ? playerWaterJetTimer > 0
              : !hasHumanFireTeam && fireTeamState.waterJetTimer > 0,
          safetyCarPhase: scState.phase,
          playerRole,
          hasHumanSafetyCar,
          hasHumanFireTeam,
          weatherCondition:
            trackWetness > 0.65 ? 'rain' : trackWetness > 0.2 ? 'damp' : 'sunny',
          weatherMode: weatherModeRef.current,
          trackWetness: Number(trackWetness.toFixed(2)),
          visibilityPct: Math.round(100 - Math.min(54, rainIntensity * 38 + trackWetness * 16)),
          gripMultiplierPct: Math.round(
            Math.max(
              45,
              (1 - trackWetness * 0.34 - (playerBody.damage.tires / 100) * trackWetness * 0.22) *
                100
            )
          ),
          asphaltTempC: Number(liveAsphaltTempC.toFixed(1)),
          ambientTempC: Number(liveAmbientTempC.toFixed(1)),
          tireWearMultiplier: computeTireWearMultiplier(liveAsphaltTempC, trackWetness),
          toolCooldowns: { ...toolCooldowns },
          standings: standingsList.map((s, idx) => ({
            id: s.id,
            name: s.name,
            isPlayer: s.isPlayer,
            position: idx + 1,
            gapText:
              idx === 0
                ? 'LEADER'
                : `+${((leaderProg - s.progress) * 42).toFixed(1)}s`,
            lap: s.lap,
            carClass: s.carClass,
            damagePct: s.damagePct,
            onFire: s.onFire,
          })),
          minimapPoints: minimapPts,
          racerDots: [
            ...standingsList.map((s) => ({
              id: s.id,
              x: s.x,
              z: s.z,
              isPlayer: s.isPlayer,
              color: s.onFire ? '#f97316' : s.color,
            })),
            ...extraSupportDots,
            ...(safetyCarRig && !hasHumanSafetyCar && scState.phase !== 'standby'
              ? [
                  {
                    id: 'npc_safety_car',
                    x: safetyCarRig.root.position.x,
                    z: safetyCarRig.root.position.z,
                    isPlayer: false,
                    color: '#facc15',
                  },
                ]
              : []),
            ...(fireTruckRig && !hasHumanFireTeam && fireTeamState.dispatched
              ? [
                  {
                    id: 'npc_fire_truck',
                    x: fireTruckRig.root.position.x,
                    z: fireTruckRig.root.position.z,
                    isPlayer: false,
                    color: '#ef4444',
                  },
                ]
              : []),
          ],
        }));
      }

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    if (isSoftwareGl) afterDraw(tick);
    else frameId = requestAnimationFrame(tick);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
      bloomPass?.resolution.set(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      audioRef.current.stop();
      sparkGeo.dispose();
      sparkMat.dispose();
      smokeMat.dispose();
      debrisGeo.dispose();
      debrisMat.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      sprayGeo.dispose();
      sprayMat.dispose();
      flameGeo.dispose();
      flameOuterMat.dispose();
      flameCoreMat.dispose();
      builtTrack.dispose();
      envTex.dispose();
      playerSupportRig?.dispose();
      safetyCarRig?.dispose();
      fireTruckRig?.dispose();
      fastFireRig?.dispose();
      rigs.forEach((r) => r.dispose());
      remoteRigs.forEach((entry) => entry.rig.dispose());
      composer?.dispose();
      renderer.dispose();
    };
  }, [track, activeCar, model, specs, pitCrewStats, playerId, driverName, activeRoom, playerRole, hasHumanSafetyCar, hasHumanFireTeam, npcLevel, phaseTrigger, raceRunId]);

  const startRace = () => {
    setRaceControlNote(null);
    setPhaseTrigger('countdown');
    setRaceRunId((n) => n + 1);
  };

  const resetToStandby = () => {
    setRaceControlNote(null);
    setPhaseTrigger('standby');
    setRaceRunId((n) => n + 1);
  };

  const minimapBounds = useMemo(() => {
    if (hud.minimapPoints.length === 0) return { path: '', mapPt: () => ({ x: 50, y: 50 }) };
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const p of hud.minimapPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const span = Math.max(1, Math.max(maxX - minX, maxZ - minZ));
    const mapPt = (wx: number, wz: number) => ({
      x: 12 + ((wx - minX) / span) * 96,
      y: 12 + ((wz - minZ) / span) * 96,
    });
    const path =
      hud.minimapPoints
        .map((p, i) => {
          const m = mapPt(p.x, p.z);
          return `${i === 0 ? 'M' : 'L'}${m.x.toFixed(1)},${m.y.toFixed(1)}`;
        })
        .join(' ') + ' Z';
    return { path, mapPt };
  }, [hud.minimapPoints]);

  const rpmRatio = Math.min(1, hud.rpm / Math.max(3000, hud.maxRpm));

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden bg-[#0b0d11]">
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Top HUD Bar (Sleek, Edge-Hugging & Unobstructed) */}
      <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-3 sm:left-3 sm:right-3 flex items-start justify-between gap-2 pointer-events-none">
        {/* Top-Left: Ultra-Compact Position, Lap & Time Pill (+ On-Demand Standings) */}
        <div className="pointer-events-auto flex flex-col gap-1.5">
          <div className="bg-[#0b0d11]/88 border border-white/10 rounded-lg px-2.5 py-1.5 flex items-center gap-2.5 sm:gap-3.5">
            {hud.playerRole === 'driver' ? (
              <div className="font-display text-lg sm:text-xl font-bold text-white tabular-nums leading-none">
                P{hud.position}
                <span className="text-[11px] text-slate-400 font-normal">/{hud.totalCars}</span>
              </div>
            ) : (
              <div
                className={`font-display text-xs sm:text-sm font-bold leading-none ${
                  hud.playerRole === 'safety_car' ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {hud.playerRole === 'safety_car' ? 'SAFETY CAR' : 'ANTINCENDIO'}
              </div>
            )}

            <div className="h-4 w-px bg-white/10" />

            <div className="font-mono text-xs text-white font-semibold tabular-nums">
              G{hud.lap}/{hud.totalLaps}
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="font-mono text-xs text-slate-200 tabular-nums">
              {formatLapTime(hud.lapTimeMs)}
            </div>

            {hud.standings.length > 0 && hud.phase !== 'standby' && (
              <button
                type="button"
                onClick={() => setShowStandings((s) => !s)}
                className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                  showStandings
                    ? 'bg-[#e10600] text-white'
                    : 'bg-white/10 hover:bg-white/15 text-slate-300'
                }`}
                title="Mostra/Nascondi Classifica"
              >
                {showStandings ? 'Chiudi' : 'Classifica'}
              </button>
            )}
          </div>

          {/* Live Compact Weather, Asphalt Temperature & Tire Wear Indicator */}
          {hud.phase !== 'standby' && (
            <div className="bg-[#0b0d11]/88 border border-white/10 rounded-lg px-2.5 py-1 flex items-center gap-2 text-[10px] font-mono tabular-nums w-fit">
              {hud.weatherCondition === 'rain' ? (
                <CloudRain className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              ) : hud.weatherCondition === 'damp' ? (
                <CloudDrizzle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="flex items-center gap-1">
                <Thermometer
                  className={`w-3 h-3 shrink-0 ${
                    hud.asphaltTempC >= 44
                      ? 'text-rose-400'
                      : hud.asphaltTempC >= 37
                      ? 'text-amber-400'
                      : hud.asphaltTempC < 22
                      ? 'text-sky-400'
                      : 'text-emerald-400'
                  }`}
                />
                <span className="text-slate-400 hidden sm:inline">Asfalto</span>
                <span
                  className={`font-bold ${
                    hud.asphaltTempC >= 44
                      ? 'text-rose-400'
                      : hud.asphaltTempC >= 37
                      ? 'text-amber-400'
                      : hud.asphaltTempC < 22
                      ? 'text-sky-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {hud.asphaltTempC.toFixed(1)}°C
                </span>
              </span>
              <div className="h-3 w-px bg-white/10" />
              <span
                className={`${
                  hud.tireWearMultiplier >= 1.35
                    ? 'text-rose-400 font-semibold'
                    : hud.tireWearMultiplier >= 1.12
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }`}
                title="Moltiplicatore degrado pneumatici dovuto a temperatura asfalto e umidità"
              >
                Usura x{hud.tireWearMultiplier.toFixed(2)}
              </span>
            </div>
          )}

          {showStandings && hud.standings.length > 0 && hud.phase !== 'standby' && (
            <div className="hidden sm:block bg-[#0b0d11]/92 border border-white/10 rounded-lg p-2 w-56 space-y-1">
              {hud.bestLapMs && (
                <div className="flex items-center justify-between text-[10px] font-mono pb-1 border-b border-white/10">
                  <span className="text-slate-400">Miglior Giro</span>
                  <span className="text-emerald-400 font-semibold">{formatLapTime(hud.bestLapMs)}</span>
                </div>
              )}
              {hud.standings.slice(0, 6).map((row) => (
                <div
                  key={row.id}
                  className={`flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded ${
                    row.isPlayer ? 'bg-[#e10600]/25 text-white font-semibold' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate flex items-center gap-1">
                    <span className="font-mono mr-1 text-slate-400">{row.position}.</span>
                    {row.name}
                    {row.onFire && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
                  </span>
                  <span className="font-mono tabular-nums text-[10px] text-slate-400 shrink-0 ml-2">
                    {row.gapText}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center Top: Standby Setup OR Countdown OR Ultra-Slim Top-Edge Alert Ticker (Never blocks windshield) */}
        <div className="flex flex-col items-center gap-1.5 max-w-xl w-full">
          {hud.phase === 'racing' &&
            (hud.safetyCarPhase !== 'standby' ||
              hud.anyCarOnFire ||
              hud.playerOnFire ||
              hud.damage.engine >= 68 ||
              hud.damage.suspension >= 68 ||
              hud.damage.frontAero >= 70 ||
              hud.damage.tires >= 82 ||
              Boolean(raceControlNote)) && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {hud.safetyCarPhase !== 'standby' && (
                  <div className="bg-amber-500 text-slate-950 px-2.5 py-1 rounded border border-amber-300 flex items-center gap-1.5 text-[11px] font-bold">
                    <Siren className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {hud.safetyCarPhase === 'deployed' ? 'SAFETY CAR IN PISTA' : 'SC AI BOX'}
                    </span>
                  </div>
                )}
                {hud.anyCarOnFire && (
                  <div className="bg-rose-950/95 border border-orange-500 text-orange-200 px-2.5 py-1 rounded flex items-center gap-1.5 text-[11px] font-semibold">
                    <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span>INCENDIO: {hud.burningCarName}</span>
                  </div>
                )}
                {!hud.inPit &&
                  (hud.playerOnFire || hud.damage.engine >= 94 || hud.damage.suspension >= 94) && (
                    <div className="bg-rose-700 border border-rose-300 text-white px-2.5 py-1 rounded text-[11px] font-bold">
                      EMERGENZA: Accosta fuori pista o ferma l’auto!
                    </div>
                  )}
                {!hud.inPit &&
                  !hud.playerOnFire &&
                  hud.damage.engine < 94 &&
                  hud.damage.suspension < 94 &&
                  (hud.damage.engine >= 68 ||
                    hud.damage.suspension >= 68 ||
                    hud.damage.frontAero >= 70 ||
                    hud.damage.tires >= 82) && (
                    <div className="bg-amber-950/95 border border-amber-400/70 text-amber-200 px-2.5 py-1 rounded text-[11px] font-semibold">
                      DANNI GRAVI: Rientra al Pit Stop {hud.nearPitWindow ? '(Premi P ora)' : 'a fine giro'}
                    </div>
                  )}
                {raceControlNote && (
                  <div className="bg-[#0b0d11]/90 border border-white/15 px-2.5 py-1 rounded text-[11px] text-slate-200">
                    {raceControlNote}
                  </div>
                )}
              </div>
            )}

          {hud.phase === 'standby' && (
            <div className="fixed inset-x-3 top-28 z-30 md:static md:inset-auto md:z-auto pointer-events-auto bg-[#0b0d11]/92 border border-white/15 rounded-lg p-3.5 sm:p-4 max-w-xl mx-auto w-auto md:w-full space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#12161f] border border-white/10 text-[10px] font-mono font-bold"
                      style={{ color: playerRank.colorHex }}
                    >
                      <Award className="w-3 h-3" />
                      Rank {playerRank.name} ({playerRankPoints} RP · Premi x{playerRank.prizeMultiplier.toFixed(2)})
                    </span>
                  </div>
                  <h1 className="font-display text-lg font-bold text-white">
                    {activeRoom ? `Gara Online: ${activeRoom.name}` : track.name}
                  </h1>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    {track.lengthKm} km · {track.cornersCount} curve · {track.laps} giri · Premio P1:{' '}
                    <span className="text-amber-400 font-semibold">
                      {Math.round(
                        track.prizePool *
                          playerRank.prizeMultiplier *
                          (activeRoom ? 1.25 : npcConfig.rewardMult)
                      ).toLocaleString('it-IT')}{' '}
                      CR
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-slate-400">Budget</div>
                  <div className="font-mono font-bold text-amber-400 tabular-nums">
                    {credits.toLocaleString('it-IT')} CR
                  </div>
                </div>
              </div>

              {!activeRoom && (
                <div className="bg-[#12161f] border border-white/10 rounded-md px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-semibold">
                      Livello Piloti NPC: <span className="text-white">{npcConfig.level}/10 — {npcConfig.label}</span>
                    </span>
                    <span className="font-mono text-amber-400">
                      Premi x{npcConfig.rewardMult.toFixed(2)} · RP x{npcConfig.rpMult.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={npcLevel}
                    onChange={(e) => onChangeNpcLevel(Number(e.target.value))}
                    className="w-full accent-[#e10600] cursor-pointer"
                    aria-label="Difficoltà Piloti NPC da 1 a 10"
                  />
                </div>
              )}

              {!activeRoom && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={track.id}
                    onChange={(e) => onSelectTrackId(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 rounded bg-[#12161f] border border-white/10 text-xs text-white focus:outline-none focus:border-[#e10600]"
                  >
                    {allTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.lengthKm} km · {t.isCustom ? 'Disegnato da Te' : 'Ufficiale'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={onGoToBuilder}
                    className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
                  >
                    Disegna Nuovo
                  </button>
                  <button
                    type="button"
                    onClick={onGoToGarage}
                    className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
                  >
                    Assetto ({activeCar.customName})
                  </button>
                  <button
                    type="button"
                    onClick={onGoToPitCrew}
                    className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 text-xs font-medium text-emerald-300 cursor-pointer whitespace-nowrap"
                  >
                    Pit Crew ({(pitCrewStats.reactionDelaySec + pitCrewStats.tireChangeTimeSec).toFixed(2)}s)
                  </button>
                </div>
              )}

              {/* Pre-Race Team Role Selector (Driver vs Human Safety Car / Fire Team) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Ruolo in Pista:</span>
                  <span className="text-slate-300 font-medium">
                    {activeRoom
                      ? 'Scelto nella stanza online'
                      : 'Team vuoti = veicoli NPC automatici'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['driver', 'Pilota F1/GT', CarFront],
                      ['safety_car', 'Team Safety Car', Siren],
                      ['fire_team', 'Team Antincendio', Flame],
                    ] as const
                  ).map(([rId, label, Icon]) => (
                    <button
                      key={rId}
                      type="button"
                      disabled={Boolean(activeRoom)}
                      onClick={() => onChangeRole(rId)}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-[11px] font-semibold border transition-colors ${
                        playerRole === rId
                          ? 'bg-[#e10600] border-[#ff3b30] text-white'
                          : 'bg-[#12161f] border-white/10 text-slate-300 hover:text-white disabled:opacity-50'
                      } ${activeRoom ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-0.5">
                  <div className="px-2 py-1 rounded bg-[#12161f] border border-white/5 flex justify-between">
                    <span className="text-slate-400">Safety Car:</span>
                    <span className={hasHumanSafetyCar ? 'text-emerald-400 font-semibold' : 'text-amber-300'}>
                      {hasHumanSafetyCar ? 'Reale (NPC Off)' : 'NPC'}
                    </span>
                  </div>
                  <div className="px-2 py-1 rounded bg-[#12161f] border border-white/5 flex justify-between">
                    <span className="text-slate-400">Antincendio:</span>
                    <span className={hasHumanFireTeam ? 'text-emerald-400 font-semibold' : 'text-amber-300'}>
                      {hasHumanFireTeam ? 'Reale (NPC Off)' : 'NPC'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pre-Race Weather Mode Selector & Live Forecast */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">Meteo Sessione:</span>
                  <div className="grid grid-cols-4 gap-1 bg-[#12161f] p-1 rounded border border-white/10">
                    {(
                      [
                        ['dynamic', 'Dinamico'],
                        ['sunny', 'Sole'],
                        ['damp', 'Umido'],
                        ['rain', 'Pioggia'],
                      ] as const
                    ).map(([mId, label]) => (
                      <button
                        key={mId}
                        type="button"
                        onClick={() => {
                          weatherModeRef.current = mId;
                          setWeatherModeUi(mId);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
                          weatherModeUi === mId
                            ? 'bg-[#e10600] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pre-Race Weather Forecast & Track Temp Card */}
                <div className="bg-[#12161f] border border-white/10 rounded-md p-2.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                      Previsioni Meteo Pre-Gara
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-slate-300 tabular-nums">
                      <span>Aria {weatherForecast.ambientTempC}°C</span>
                      <span>·</span>
                      <span className="text-amber-300 font-semibold">
                        Asfalto {weatherForecast.initialAsphaltTempC}°C
                      </span>
                      <span>·</span>
                      <span className="hidden sm:inline-flex items-center gap-0.5">
                        <Wind className="w-3 h-3 text-slate-400" />
                        {weatherForecast.windKmh} km/h
                      </span>
                      {weatherModeUi === 'dynamic' && (
                        <button
                          type="button"
                          onClick={() => setForecastSeed((s) => s + 1)}
                          className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 font-sans cursor-pointer"
                          title="Genera nuova previsione meteo"
                        >
                          Aggiorna
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {weatherForecast.slots.map((slot) => (
                      <div
                        key={slot.label}
                        className="bg-[#0b0d11] border border-white/5 rounded px-2 py-1.5 text-[10px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-slate-400 font-medium">
                          <span>{slot.label}</span>
                          {slot.condition === 'rain' ? (
                            <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                          ) : slot.condition === 'damp' ? (
                            <CloudDrizzle className="w-3.5 h-3.5 text-amber-300" />
                          ) : (
                            <Sun className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </div>
                        <div className="flex items-center justify-between font-mono tabular-nums">
                          <span className="text-white font-semibold">
                            {slot.expectedAsphaltTempC}°C
                          </span>
                          <span className="text-sky-300">{slot.rainChancePct}% pg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-snug">
                    {weatherForecast.summary}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onGoToHome}
                  className="px-3.5 py-2.5 rounded-md bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Home className="w-3.5 h-3.5" />
                  Home
                </button>
                <button
                  type="button"
                  onClick={startRace}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#e10600] hover:bg-[#ff1e17] text-sm font-bold text-white cursor-pointer transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Avvia Semaforo di Partenza
                </button>
              </div>
            </div>
          )}

          {hud.phase === 'countdown' && (
            <div className="bg-[#0b0d11]/92 border border-white/15 rounded-lg px-8 py-5 text-center">
              <div className="text-xs text-slate-400 mb-2">Semaforo FIA</div>
              <div className="flex items-center justify-center gap-3 mb-2">
                {[3, 2, 1].map((light) => (
                  <div
                    key={light}
                    className={`w-5 h-5 rounded-full border ${
                      hud.countdownValue <= light
                        ? 'bg-[#e10600] border-rose-400'
                        : 'bg-slate-800 border-white/10'
                    }`}
                  />
                ))}
              </div>
              <div className="font-display text-4xl font-bold text-white tabular-nums">
                {hud.countdownValue}
              </div>
            </div>
          )}
        </div>

        {/* Right: Compact Minimap + Toolbar + On-Demand Race Control & Weather Popover */}
        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setCameraMode((prev) => {
                  const order: CameraMode[] = ['chase', 'far', 'cockpit', 'hood', 'tv'];
                  return order[(order.indexOf(prev) + 1) % order.length];
                })
              }
              className="flex items-center gap-1 px-2 py-1.5 rounded bg-[#0b0d11]/90 border border-white/10 text-xs text-slate-200 hover:text-white cursor-pointer"
              title="Cambia Camera (Tasto C)"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{CAMERA_LABELS[cameraMode]}</span>
            </button>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="p-1.5 rounded bg-[#0b0d11]/90 border border-white/10 text-slate-200 hover:text-white cursor-pointer"
              aria-label={muted ? 'Attiva Audio' : 'Silenzia Audio'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="p-1.5 rounded bg-[#0b0d11]/90 border border-white/10 text-slate-200 hover:text-white cursor-pointer"
                title={isFullscreen ? 'Esci da Schermo Intero' : 'Schermo Intero'}
                aria-label={isFullscreen ? 'Esci da Schermo Intero' : 'Schermo Intero'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
            {hud.phase !== 'standby' && (
              <button
                type="button"
                onClick={resetToStandby}
                className="p-1.5 rounded bg-[#0b0d11]/90 border border-white/10 text-slate-200 hover:text-white cursor-pointer"
                title="Riavvia Sessione"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowRaceControlPanel((v) => !v)}
              className={`hidden md:flex items-center gap-1 px-2 py-1.5 rounded border text-xs font-medium cursor-pointer transition-colors ${
                showRaceControlPanel || hud.safetyCarPhase !== 'standby' || hud.anyCarOnFire
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-[#0b0d11]/90 border-white/10 text-slate-200 hover:text-white'
              }`}
              title="Direzione Gara, Safety Car, Antincendio & Meteo"
            >
              <Siren className="w-3.5 h-3.5" />
              <span>Gara</span>
            </button>
            <button
              type="button"
              onClick={onGoToHome}
              className="flex items-center gap-1 px-2 py-1.5 rounded bg-[#0b0d11]/90 border border-white/10 text-xs text-slate-200 hover:text-white cursor-pointer"
              title="Torna alla Home"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Home</span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-semibold cursor-pointer transition-colors ${
                settingsOpen
                  ? 'bg-[#e10600] border-[#ff3b30] text-white'
                  : 'bg-[#0b0d11]/95 border-white/15 text-white hover:bg-[#161b26]'
              }`}
              title="Impostazioni Visuale & Modalità di Guida (ESC)"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Impostazioni</span>
            </button>
          </div>

          <div className="bg-[#0b0d11]/88 border border-white/10 rounded-lg p-1">
            <svg viewBox="0 0 120 120" className="w-14 h-14 sm:w-20 sm:h-20">
              <path
                d={minimapBounds.path}
                fill="none"
                stroke="#334155"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              {hud.racerDots.map((dot) => {
                const pt = minimapBounds.mapPt(dot.x, dot.z);
                return (
                  <circle
                    key={dot.id}
                    cx={pt.x}
                    cy={pt.y}
                    r={dot.isPlayer ? 4.4 : 3}
                    fill={dot.color}
                    stroke="#0b0d11"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
          </div>

          {/* On-Demand Direzione Gara & Meteo Popover (Closed while driving for clear screen) */}
          {showRaceControlPanel && (
            <div className="hidden md:block bg-[#0b0d11]/95 border border-white/15 rounded-lg p-2.5 w-60 space-y-1.5 text-xs shadow-xl">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                <span>Direzione Gara &amp; Sicurezza</span>
                <button
                  type="button"
                  onClick={() => setShowRaceControlPanel(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {hud.hasHumanSafetyCar && hud.playerRole !== 'safety_car' ? (
                <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                  <span className="flex items-center gap-1.5">
                    <Siren className="w-3.5 h-3.5" />
                    SC Reale in Pista (NPC Off)
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => (controlActionsRef.current.toggleSafetyCar = true)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                    hud.safetyCarPhase !== 'standby'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Siren className="w-3.5 h-3.5" />
                    {hud.playerRole === 'safety_car'
                      ? hud.safetyCarPhase === 'deployed'
                        ? 'Spegni Lampeggianti SC [Y]'
                        : 'Attiva Lampeggianti SC [Y]'
                      : hud.safetyCarPhase === 'standby'
                      ? 'Chiama Safety Car NPC [Y]'
                      : hud.safetyCarPhase === 'deployed'
                      ? 'Rientra Safety Car NPC [Y]'
                      : 'SC ai Box...'}
                  </span>
                </button>
              )}

              {hud.hasHumanFireTeam && hud.playerRole !== 'fire_team' ? (
                <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Team Antincendio Reale (NPC Off)
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => (controlActionsRef.current.dispatchFireTeam = true)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                    hud.fireTeamDispatched
                      ? 'bg-rose-600 text-white'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    {hud.playerRole === 'fire_team'
                      ? hud.fireTeamDispatched
                        ? 'Spegni Sirena/Fari [F]'
                        : 'Attiva Sirena/Fari [F]'
                      : hud.fireTeamDispatched
                      ? 'Richiama Antincendio NPC [F]'
                      : 'Squadra Antincendio NPC [F]'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => (controlActionsRef.current.triggerFireDrill = true)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-orange-950/70 hover:bg-orange-900/80 border border-orange-500/40 text-orange-200 text-[11px] font-medium cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  Simula Incendio Auto [I]
                </span>
              </button>

              {/* Live Weather Telemetry & Quick Override */}
              <div className="pt-2 mt-1 border-t border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                    {hud.weatherCondition === 'rain' ? (
                      <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                    ) : hud.weatherCondition === 'damp' ? (
                      <CloudDrizzle className="w-3.5 h-3.5 text-amber-300" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    {hud.weatherCondition === 'rain'
                      ? 'Pioggia'
                      : hud.weatherCondition === 'damp'
                      ? 'Pista Umida'
                      : 'Soleggiato'}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                    Grip {hud.gripMultiplierPct}% · Vis. {hud.visibilityPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-300 bg-white/5 rounded px-2 py-1">
                  <span>Asfalto {hud.asphaltTempC.toFixed(1)}°C</span>
                  <span>Aria {hud.ambientTempC.toFixed(0)}°C</span>
                  <span className="text-amber-300">Usura x{hud.tireWearMultiplier.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  {(
                    [
                      ['dynamic', 'Auto'],
                      ['sunny', 'Sole'],
                      ['damp', 'Umida'],
                      ['rain', 'Piogg.'],
                    ] as const
                  ).map(([mId, label]) => (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => {
                        weatherModeRef.current = mId;
                        setWeatherModeUi(mId);
                      }}
                      className={`py-1 rounded font-medium cursor-pointer transition-colors whitespace-nowrap ${
                        weatherModeUi === mId
                          ? 'bg-sky-600 text-white'
                          : 'bg-white/10 hover:bg-white/15 text-slate-300'
                      }`}
                      title="Cambia Meteo [M]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom HUD (Compact, Low-Profile Edge Layout — Clear Windshield & Car View) */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 flex flex-wrap items-end justify-between gap-2 pointer-events-none">
        {/* Bottom-Left: Compact Single-Row Damage Strip + Active Fire/Pit Tools */}
        <div className="pointer-events-auto flex flex-col gap-1.5">
          {(hud.anyCarOnFire || hud.fireTeamDispatched || hud.playerRole === 'fire_team') && (
            <div className="bg-[#0b0d11]/92 border border-orange-500/50 rounded-lg p-2 w-60 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-orange-300 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Antincendio
                </span>
                {hud.playerOnFire && (
                  <span className="font-mono text-rose-400 font-bold tabular-nums">
                    {hud.playerFireIntensity}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <button
                  type="button"
                  disabled={!hud.anyCarOnFire || hud.toolCooldowns.extinguisher > 0}
                  onClick={() => (controlActionsRef.current.useFireTool = 'extinguisher')}
                  className="flex items-center gap-1 px-1.5 py-1 rounded bg-rose-700 hover:bg-rose-600 disabled:bg-white/10 disabled:text-slate-500 text-white font-medium cursor-pointer"
                >
                  <ShieldAlert className="w-3 h-3 shrink-0" />
                  <span className="truncate">[1] CO₂</span>
                </button>
                <button
                  type="button"
                  disabled={!hud.anyCarOnFire || hud.toolCooldowns.water_cannon > 0}
                  onClick={() => (controlActionsRef.current.useFireTool = 'water_cannon')}
                  className="flex items-center gap-1 px-1.5 py-1 rounded bg-sky-700 hover:bg-sky-600 disabled:bg-white/10 disabled:text-slate-500 text-white font-medium cursor-pointer"
                >
                  <Droplets className="w-3 h-3 shrink-0" />
                  <span className="truncate">[2] Lancia</span>
                </button>
                <button
                  type="button"
                  disabled={!hud.anyCarOnFire || hud.toolCooldowns.foam_afff > 0}
                  onClick={() => (controlActionsRef.current.useFireTool = 'foam_afff')}
                  className="flex items-center gap-1 px-1.5 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:bg-white/10 disabled:text-slate-500 text-white font-medium cursor-pointer"
                >
                  <Shield className="w-3 h-3 shrink-0" />
                  <span className="truncate">[3] Schiuma</span>
                </button>
                <button
                  type="button"
                  disabled={!hud.anyCarOnFire || hud.toolCooldowns.ers_cutoff > 0}
                  onClick={() => (controlActionsRef.current.useFireTool = 'ers_cutoff')}
                  className="flex items-center gap-1 px-1.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 disabled:bg-white/10 disabled:text-slate-500 text-white font-medium cursor-pointer"
                >
                  <ZapOff className="w-3 h-3 shrink-0" />
                  <span className="truncate">[4] Cut ERS</span>
                </button>
              </div>
            </div>
          )}

          {hud.inPit && (
            <div className="bg-[#0b0d11]/95 border border-emerald-500/60 rounded-lg px-3 py-2 w-60 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-emerald-400">
                  {hud.pitPhase === 'reacting'
                    ? 'REAZIONE PIT CREW...'
                    : hud.pitPhase === 'servicing'
                    ? 'CAMBIO GOMME & RIPARAZ.'
                    : 'VIA LIBERA! RILASCIA [P]'}
                </span>
                <span className="font-mono text-sm font-bold text-white tabular-nums">
                  {hud.pitElapsedSec.toFixed(2)}s
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full ${
                    hud.pitPhase === 'ready'
                      ? 'bg-emerald-400'
                      : hud.pitPhase === 'reacting'
                      ? 'bg-amber-400'
                      : 'bg-[#e10600]'
                  }`}
                  style={{
                    width:
                      hud.pitPhase === 'reacting'
                        ? `${Math.max(10, 100 - (hud.pitReactionRemainingSec / Math.max(0.1, pitCrewStats.reactionDelaySec)) * 100)}%`
                        : `${hud.pitTireProgressPct}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Ultra-Compact Single-Strip Car Health Bar */}
          <div
            className={`bg-[#0b0d11]/88 border border-white/10 rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-[10px] font-mono tabular-nums ${
              isMobileDevice && hud.phase === 'racing' ? 'hidden md:flex' : ''
            }`}
          >
            {(
              [
                ['AA', hud.damage.frontAero],
                ['AP', hud.damage.rearAero],
                ['MOT', hud.damage.engine],
                ['SOS', hud.damage.suspension],
                ['GOM', hud.damage.tires],
                ['FRN', hud.damage.gearboxBrakes],
              ] as const
            ).map(([shortLabel, val]) => {
              const hp = Math.max(0, Math.round(100 - val));
              const textColor =
                hp > 70 ? 'text-emerald-400' : hp > 35 ? 'text-amber-400' : 'text-rose-400';
              return (
                <div key={shortLabel} className="flex items-center gap-0.5">
                  <span className="text-slate-400">{shortLabel}</span>
                  <span className={`font-semibold ${textColor}`}>{hp}%</span>
                </div>
              );
            })}
            {hud.nearPitWindow && hud.phase === 'racing' && (
              <button
                type="button"
                onPointerDown={() => (mobileInputRef.current.pit = true)}
                onPointerUp={() => (mobileInputRef.current.pit = false)}
                onPointerLeave={() => (mobileInputRef.current.pit = false)}
                className="ml-1 px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-sans font-semibold cursor-pointer"
              >
                PIT [P]
              </button>
            )}
          </div>
        </div>

        {/* Bottom-Center (Desktop) / Slim Bottom Dash: Compact Speed, Gear, RPM, DRS/ERS */}
        <div
          className={`pointer-events-auto bg-[#0b0d11]/88 border border-white/15 rounded-lg px-3.5 py-1.5 min-w-[220px] sm:min-w-[250px] space-y-1 ${
            isMobileDevice && hud.phase === 'racing' ? 'fixed top-12 left-1/2 -translate-x-1/2 z-20 py-1 px-3' : ''
          }`}
        >
          <div className="grid grid-cols-15 gap-0.5">
            {Array.from({ length: 15 }).map((_, i) => {
              const threshold = (i + 1) / 15;
              const lit = rpmRatio >= threshold;
              const col =
                i < 5 ? 'bg-emerald-500' : i < 10 ? 'bg-rose-500' : 'bg-sky-400';
              return <div key={i} className={`h-1 rounded-xs ${lit ? col : 'bg-white/10'}`} />;
            })}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums leading-none">
              {hud.speedKmh}
              <span className="text-[10px] text-slate-400 font-normal ml-1">km/h</span>
            </div>

            <div className="font-display text-xl sm:text-2xl font-bold text-amber-400 leading-none">
              {hud.gear}
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums">
              <span
                className={
                  hud.drsActive
                    ? 'text-emerald-400 font-bold'
                    : hud.drsAvailable
                    ? 'text-amber-400 font-semibold'
                    : 'text-slate-500'
                }
              >
                DRS
              </span>
              <span className={hud.ersActive ? 'text-sky-400 font-bold' : 'text-slate-300'}>
                ERS {hud.ersCharge}%
              </span>
            </div>
          </div>
        </div>

        {/* Bottom-Right: Compact Standby Controls Hint only when NOT actively racing */}
        {!isMobileDevice && hud.phase === 'standby' && (
          <div className="pointer-events-auto bg-[#0b0d11]/88 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-slate-400 font-mono">
            W/S Gas-Freno · A/D Sterzo · Shift ERS · Spazio DRS · P Box · C Cam · ESC Impostazioni
          </div>
        )}
      </div>

      {/* Pro Mobile-Only Touch & Gyroscope Driving System */}
      {isMobileDevice && (
        <MobileDriveControls
          inputRef={mobileInputRef}
          phase={hud.phase}
          ersCharge={hud.ersCharge}
          ersActive={hud.ersActive}
          drsAvailable={hud.drsAvailable}
          drsActive={hud.drsActive}
          nearPitWindow={hud.nearPitWindow}
          steerMode={mobileSteerMode}
          onSteerModeChange={setMobileSteerMode}
          autoGas={autoGas}
          onAutoGasChange={setAutoGas}
        />
      )}

      {/* Top-Right Settings Modal: Visuale & Modalità di Guida */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/65 flex items-start justify-end p-3 sm:p-6"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="bg-[#12161f] border border-white/15 rounded-xl w-full max-w-sm p-4 sm:p-5 space-y-4 mt-12 sm:mt-10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#e10600]" />
                <h2 className="font-display text-base font-bold text-white">
                  Impostazioni Guida &amp; Visuale
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
                aria-label="Chiudi Impostazioni"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Camera View Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Visuale Camera</span>
                <span className="font-mono text-[11px] text-amber-400">
                  {CAMERA_LABELS[cameraMode]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {(
                  [
                    ['chase', 'Inseguimento'],
                    ['far', 'Esterna Ampia (Far)'],
                    ['cockpit', 'Abitacolo Pilota'],
                    ['hood', 'Cofano / Muso'],
                    ['tv', 'Camera TV Circuito'],
                  ] as const
                ).map(([modeId, label]) => (
                  <button
                    key={modeId}
                    type="button"
                    onClick={() => setCameraMode(modeId)}
                    className={`px-2.5 py-2 rounded border font-medium text-left cursor-pointer transition-colors ${
                      cameraMode === modeId
                        ? 'bg-[#e10600] border-[#ff3b30] text-white'
                        : 'bg-[#0b0d11] border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Driving Physics Mode Selector */}
            <div className="space-y-2 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Modalità di Guida (Fisica)</span>
                <span className="text-[11px] font-mono text-emerald-400">
                  {drivingMode === 'assist'
                    ? 'ABS + TC + ESP'
                    : drivingMode === 'sport'
                    ? 'Bilanciata'
                    : 'Simulazione Pura'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {(
                  [
                    ['assist', 'Assistita'],
                    ['sport', 'Sport'],
                    ['sim', 'Sim Pro'],
                  ] as const
                ).map(([mId, label]) => (
                  <button
                    key={mId}
                    type="button"
                    onClick={() => setDrivingMode(mId)}
                    className={`px-2.5 py-2 rounded border font-semibold cursor-pointer transition-colors ${
                      drivingMode === mId
                        ? 'bg-[#e10600] border-[#ff3b30] text-white'
                        : 'bg-[#0b0d11] border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                {drivingMode === 'assist'
                  ? 'ABS, Controllo Trazione e Stabilità attivi per curve pulite su asciutto e bagnato.'
                  : drivingMode === 'sport'
                  ? 'Trasferimento di carico realistico, trail-braking e leggero controllo trazione in uscita.'
                  : 'Nessun aiuto elettronico: bloccaggio freni al limite, sovrasterzo di potenza e fisica pura.'}
              </p>
            </div>

            {/* Steering Sensitivity */}
            <div className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Sensibilità Sterzo</span>
                <span className="font-mono text-amber-400 tabular-nums">
                  {Math.round(steeringSensitivity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.65}
                max={1.45}
                step={0.05}
                value={steeringSensitivity}
                onChange={(e) => setSteeringSensitivity(Number(e.target.value))}
                className="w-full accent-[#e10600] cursor-pointer"
              />
            </div>

            {/* Touch / Steering Controls Mode & Auto Gas */}
            <div className="space-y-2 pt-1 border-t border-white/10">
              <div className="text-xs font-semibold text-slate-200">
                Controlli Sterzo Touch (Mobile)
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {(
                  [
                    ['wheel', 'Volante F1'],
                    ['tilt', 'Giroscopio'],
                    ['buttons', 'Frecce'],
                  ] as const
                ).map(([sId, label]) => (
                  <button
                    key={sId}
                    type="button"
                    onClick={() => setMobileSteerMode(sId)}
                    className={`px-2 py-2 rounded border font-medium cursor-pointer transition-colors ${
                      mobileSteerMode === sId
                        ? 'bg-sky-600 border-sky-400 text-white'
                        : 'bg-[#0b0d11] border-white/10 text-slate-300 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAutoGas((a) => !a)}
                className={`w-full py-2 px-3 rounded border text-xs font-semibold flex items-center justify-between cursor-pointer ${
                  autoGas
                    ? 'bg-emerald-700/80 border-emerald-400 text-white'
                    : 'bg-[#0b0d11] border-white/10 text-slate-300'
                }`}
              >
                <span>Accelerazione Automatica (Auto Gas)</span>
                <span className="font-mono">{autoGas ? 'ATTIVA' : 'OFF'}</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onGoToHome();
                }}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-md bg-[#0b0d11] border border-white/15 hover:bg-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                Torna alla Home
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="flex-1 py-2.5 rounded-md bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
              >
                Applica e Torna in Pista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Race Podium & Rewards Modal */}
      {hud.phase === 'finished' && hud.finishSummary && (
        <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#12161f] border border-white/15 rounded-lg max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="text-xs text-slate-400">Bandiera a Scacchi · {track.name}</div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Arrivo in P{hud.finishSummary.position} su {hud.finishSummary.totalCars}
                </h2>
              </div>
              <Flag className="w-7 h-7 text-[#e10600]" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono tabular-nums">
              <div className="bg-[#0b0d11] p-3 rounded border border-white/5">
                <div className="text-slate-400 font-sans">Tempo Totale</div>
                <div className="text-base font-bold text-white">
                  {formatLapTime(hud.finishSummary.totalTimeMs)}
                </div>
              </div>
              <div className="bg-[#0b0d11] p-3 rounded border border-white/5">
                <div className="text-slate-400 font-sans">Miglior Giro</div>
                <div className="text-base font-bold text-emerald-400">
                  {formatLapTime(hud.finishSummary.bestLapMs)}
                </div>
              </div>
            </div>

            <div className="bg-[#0b0d11] rounded-md p-4 border border-white/10 space-y-2 text-xs font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-300 font-sans">
                  Premio Posizione (Rank {playerRank.name} · NPC Lv.{hud.finishSummary.npcLevel})
                </span>
                <span className="text-white">
                  +{hud.finishSummary.prizeGross.toLocaleString('it-IT')} CR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300 font-sans">Bonus Guida Pulita</span>
                <span className="text-emerald-400">
                  +{hud.finishSummary.cleanBonus.toLocaleString('it-IT')} CR
                </span>
              </div>
              {hud.finishSummary.safetyBonus > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-300 font-sans">Bonus Intervento Antincendio</span>
                  <span className="text-sky-400">
                    +{hud.finishSummary.safetyBonus.toLocaleString('it-IT')} CR
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-300 font-sans">Punti Rank Guadagnati</span>
                <span className="text-amber-300 font-bold">
                  +{hud.finishSummary.rpEarned} RP
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/10 text-sm font-bold">
                <span className="text-white font-sans">Totale Crediti Gara</span>
                <span className="text-amber-400">
                  +{hud.finishSummary.netCredits.toLocaleString('it-IT')} CR
                </span>
              </div>
              {hud.finishSummary.repairCost > 0 && (
                <div className="text-[11px] text-rose-400 font-sans pt-1">
                  Danni subiti in gara: stima riparazione in Officina{' '}
                  {hud.finishSummary.repairCost.toLocaleString('it-IT')} CR.
                </div>
              )}
            </div>

            {hud.finishSummary.rankUpTo && (
              <div
                className="rounded-md p-3.5 text-xs space-y-1.5 border"
                style={{
                  borderColor: `${hud.finishSummary.rankUpTo.colorHex}88`,
                  backgroundColor: `${hud.finishSummary.rankUpTo.colorHex}18`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="font-display text-sm font-bold flex items-center gap-1.5"
                    style={{ color: hud.finishSummary.rankUpTo.colorHex }}
                  >
                    <Award className="w-4 h-4" />
                    PROMOZIONE RANK: {hud.finishSummary.rankUpTo.name.toUpperCase()}!
                  </span>
                  {(hud.finishSummary.rankBonusCredits ?? 0) > 0 && (
                    <span className="font-mono font-bold text-amber-300">
                      +{hud.finishSummary.rankBonusCredits?.toLocaleString('it-IT')} CR Bonus
                    </span>
                  )}
                </div>
                <div className="text-slate-200">
                  Nuovo moltiplicatore premi:{' '}
                  <strong className="font-mono text-emerald-400">
                    x{hud.finishSummary.rankUpTo.prizeMultiplier.toFixed(2)}
                  </strong>
                </div>
                {hud.finishSummary.unlockedCarNames &&
                  hud.finishSummary.unlockedCarNames.length > 0 && (
                    <div className="text-white font-semibold">
                      Nuove Auto Sbloccate in Concessionaria:{' '}
                      <span className="text-amber-300">
                        {hud.finishSummary.unlockedCarNames.join(', ')}
                      </span>
                    </div>
                  )}
              </div>
            )}

            {hud.finishSummary.droppedComponent && (
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-md p-3.5 text-xs space-y-1">
                <div className="font-semibold text-amber-300">
                  Componente Unico Sbloccato ({hud.finishSummary.droppedComponent.rarity})
                </div>
                <div className="text-white font-semibold">
                  {hud.finishSummary.droppedComponent.name}{' '}
                  <span className="font-mono text-slate-400">
                    {hud.finishSummary.droppedComponent.serial}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Aggiunto al tuo inventario: puoi montarlo in Officina o scambiarlo sul Mercato.
                </div>
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onGoToHome}
                className="py-2.5 px-3.5 rounded bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer flex items-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                Home
              </button>
              <button
                type="button"
                onClick={onGoToGarage}
                className="flex-1 py-2.5 px-4 rounded bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
              >
                Vai in Officina
              </button>
              <button
                type="button"
                onClick={startRace}
                className="flex-1 py-2.5 px-4 rounded bg-[#e10600] hover:bg-[#ff1e17] text-xs font-semibold text-white cursor-pointer"
              >
                Corri Ancora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
