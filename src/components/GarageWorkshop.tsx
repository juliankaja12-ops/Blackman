import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Wrench, Cpu, Wind, Palette, ShieldAlert, Check, Users, Timer, ShoppingCart } from 'lucide-react';
import {
  CAR_CATALOG,
  COMPONENT_SHOP_CATALOG,
  computeCarSpecs,
  computePitCrewStats,
  computeRepairCost,
  EMPTY_DAMAGE,
  ENGINE_ARCHITECTURES,
  getPitCrewUpgradeCost,
  MAX_PIT_CREW_LEVEL,
  PIT_CREW_ROLES,
  POWERTRAIN_LABELS,
  SLOT_LABELS,
} from '../data/catalog';
import {
  buildCarModel3D,
  CarMeshRig,
  detectSoftwareWebGL,
  updateCarDamageVisuals,
} from '../engine/carModel3D';
import {
  CarTuning,
  ComponentShopItem,
  ComponentSlot,
  EngineArchitecture,
  OwnedCar,
  PitCrewRoleKey,
  PitCrewUpgrades,
  UniqueComponent,
} from '../types/game';

interface GarageWorkshopProps {
  credits: number;
  garage: OwnedCar[];
  activeCarId: string;
  inventory: UniqueComponent[];
  pitCrew: PitCrewUpgrades;
  requestedSubTab?: 'engine' | 'aero' | 'livery' | 'parts' | 'pitcrew';
  onSelectCar: (instanceId: string) => void;
  onUpdateCar: (car: OwnedCar) => void;
  onRepairCar: (instanceId: string, cost: number) => void;
  onUpgradePitCrew: (role: PitCrewRoleKey, cost: number) => void;
  onBuyComponent: (item: ComponentShopItem, autoEquipCarId?: string) => void;
}

const PRESET_COLORS = [
  '#e10600',
  '#0ea5e9',
  '#f59e0b',
  '#10b981',
  '#f8fafc',
  '#1e293b',
  '#6366f1',
  '#fb7185',
];

export const GarageWorkshop: React.FC<GarageWorkshopProps> = ({
  credits,
  garage,
  activeCarId,
  inventory,
  pitCrew,
  requestedSubTab,
  onSelectCar,
  onUpdateCar,
  onRepairCar,
  onUpgradePitCrew,
  onBuyComponent,
}) => {
  const activeCar = useMemo(
    () => garage.find((c) => c.instanceId === activeCarId) ?? garage[0],
    [garage, activeCarId]
  );
  const model = useMemo(
    () => CAR_CATALOG.find((m) => m.id === activeCar.modelId) ?? CAR_CATALOG[0],
    [activeCar.modelId]
  );
  const specs = useMemo(
    () => computeCarSpecs(model, activeCar, inventory),
    [model, activeCar, inventory]
  );
  const repairCost = useMemo(
    () => computeRepairCost(activeCar.damage, model.carClass),
    [activeCar.damage, model.carClass]
  );
  const pitStats = useMemo(() => computePitCrewStats(pitCrew), [pitCrew]);

  const [subTab, setSubTab] = useState<'engine' | 'aero' | 'livery' | 'parts' | 'pitcrew'>(
    requestedSubTab ?? 'engine'
  );
  const [shopSlotFilter, setShopSlotFilter] = useState<ComponentSlot | 'ALL'>('ALL');
  const [cameraPreset, setCameraPreset] = useState<'three_quarter' | 'front' | 'rear' | 'top'>('three_quarter');

  // Interactive Pit Crew Dry-Run Stopwatch Simulator
  const [simRunning, setSimRunning] = useState(false);
  const [simElapsedSec, setSimElapsedSec] = useState(0);
  const [simPhaseLabel, setSimPhaseLabel] = useState<'idle' | 'reacting' | 'tires' | 'done'>('idle');
  const [simProgressPct, setSimProgressPct] = useState(0);

  useEffect(() => {
    if (requestedSubTab) {
      setSubTab(requestedSubTab);
    }
  }, [requestedSubTab]);

  useEffect(() => {
    if (!simRunning) return;
    const startMs = performance.now();
    const totalSec = pitStats.reactionDelaySec + pitStats.tireChangeTimeSec;
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - startMs) / 1000;
      if (elapsed >= totalSec) {
        setSimElapsedSec(totalSec);
        setSimProgressPct(100);
        setSimPhaseLabel('done');
        setSimRunning(false);
        window.clearInterval(timer);
        return;
      }
      setSimElapsedSec(elapsed);
      if (elapsed < pitStats.reactionDelaySec) {
        setSimPhaseLabel('reacting');
        setSimProgressPct(0);
      } else {
        setSimPhaseLabel('tires');
        const workElapsed = elapsed - pitStats.reactionDelaySec;
        setSimProgressPct(Math.min(100, (workElapsed / pitStats.tireChangeTimeSec) * 100));
      }
    }, 30);
    return () => window.clearInterval(timer);
  }, [simRunning, pitStats.reactionDelaySec, pitStats.tireChangeTimeSec]);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rigRef = useRef<CarMeshRig | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const isSoftwareGlRef = useRef<boolean>(false);
  const targetCamPosRef = useRef<THREE.Vector3 | null>(null);

  // Initialize 3D Showroom WebGL Scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    isSoftwareGlRef.current = isSoftwareGl;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1016);
    scene.fog = new THREE.FogExp2(0x0d1016, 0.032);
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      120
    );
    camera.position.set(4.6, 2.2, 4.8);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3.2;
    controls.maxDistance = 10.5;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 0.55, 0);
    controlsRef.current = controls;

    // 3-Point Studio Lighting
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.1);
    keyLight.position.set(6, 9, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.85);
    scene.add(hemi);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.1);
    rimLight.position.set(-6, 4, -6);
    scene.add(rimLight);

    // Showroom Turntable Platform & Floor
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x11151d,
      roughness: 0.55,
      metalness: 0.25,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    scene.add(floor);

    const discGeo = new THREE.CylinderGeometry(3.2, 3.3, 0.06, 48);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      roughness: 0.42,
      metalness: 0.45,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.03;
    disc.receiveShadow = true;
    scene.add(disc);

    const ringGeo = new THREE.RingGeometry(3.22, 3.28, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe10600, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.065;
    scene.add(ring);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
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

    const requestRender = () => {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        lastTime = now;

        if (targetCamPosRef.current) {
          camera.position.lerp(targetCamPosRef.current, 1 - Math.exp(-8 * dt));
          if (camera.position.distanceTo(targetCamPosRef.current) < 0.03) {
            targetCamPosRef.current = null;
          } else {
            renderDirty = true;
          }
        }

        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    requestRenderRef.current = requestRender;

    controls.addEventListener('start', () => {
      targetCamPosRef.current = null;
    });
    controls.addEventListener('change', requestRender);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      envTex.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      discGeo.dispose();
      discMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      rigRef.current?.dispose();
      renderer.dispose();
    };
  }, []);

  // Rebuild 3D car whenever model, livery, wings, or damage changes
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || !renderer) return;

    if (rigRef.current) {
      scene.remove(rigRef.current.root);
      rigRef.current.dispose();
    }

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const archPt =
      ENGINE_ARCHITECTURES[activeCar.tuning.engineArch]?.powertrainType ?? model.powertrainType;
    const rig = buildCarModel3D(
      model.bodyStyle,
      model.carClass,
      activeCar.tuning,
      maxAniso,
      archPt
    );
    rig.root.position.y = 0.06 + (activeCar.tuning.rideHeightMm - 28) * 0.0012;
    updateCarDamageVisuals(rig, activeCar.damage);
    scene.add(rig.root);
    rigRef.current = rig;
    requestRenderRef.current();
  }, [model.bodyStyle, model.carClass, model.powertrainType, activeCar.tuning, activeCar.damage]);

  const applyCameraPreset = (preset: typeof cameraPreset) => {
    setCameraPreset(preset);
    const map: Record<typeof cameraPreset, THREE.Vector3> = {
      three_quarter: new THREE.Vector3(4.6, 2.2, 4.8),
      front: new THREE.Vector3(0.2, 1.35, 5.4),
      rear: new THREE.Vector3(-0.3, 1.55, -5.2),
      top: new THREE.Vector3(0.1, 6.2, 0.8),
    };
    targetCamPosRef.current = map[preset];
    requestRenderRef.current();
  };

  const updateTuning = (patch: Partial<CarTuning>) => {
    onUpdateCar({
      ...activeCar,
      tuning: { ...activeCar.tuning, ...patch },
    });
  };

  const equipPart = (slot: ComponentSlot, partId: string | undefined) => {
    const nextParts = { ...activeCar.installedParts };
    if (!partId) {
      delete nextParts[slot];
    } else {
      nextParts[slot] = partId;
    }
    onUpdateCar({
      ...activeCar,
      installedParts: nextParts,
    });
  };

  const currentArch = ENGINE_ARCHITECTURES[activeCar.tuning.engineArch] ?? ENGINE_ARCHITECTURES.V6_HYBRID;
  const isEvOrPem =
    currentArch.powertrainType === 'electric' || activeCar.tuning.engineArch === 'H2_FUEL_CELL';

  // Build SVG Dyno Torque & Power Curve points
  const dynoPaths = useMemo(() => {
    const maxRpm = specs.maxRpm;
    const ptsPower: string[] = [];
    const ptsTorque: string[] = [];
    for (let i = 0; i <= 20; i++) {
      const r = i / 20;
      const x = 16 + r * 268;
      // Instant flat torque for Electric/Fuel-Cell vs sinusoidal peak for Combustion
      const torqueNorm = isEvOrPem
        ? Math.max(0.55, 0.98 - r * 0.28)
        : 0.52 + 0.48 * Math.sin(Math.pow(r, 0.85) * Math.PI * 0.88);
      const powerNorm = isEvOrPem ? Math.min(1, 0.25 + r * 0.82) : r * torqueNorm * 1.18;
      const yT = 108 - Math.min(1, torqueNorm) * 84;
      const yP = 108 - Math.min(1, powerNorm) * 84;
      ptsTorque.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yT.toFixed(1)}`);
      ptsPower.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yP.toFixed(1)}`);
    }
    return {
      powerPath: ptsPower.join(' '),
      torquePath: ptsTorque.join(' '),
      maxRpm,
    };
  }, [specs.maxRpm, isEvOrPem]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#0b0d11]">
      {/* Left: 3D Showroom Viewport */}
      <div className="relative flex-1 min-h-[360px] bg-[#0d1016]">
        <div ref={mountRef} className="w-full h-full" />

        {/* Top-left Car Switcher & Specs Summary */}
        <div className="absolute top-4 left-4 right-4 flex flex-wrap items-start justify-between gap-3 pointer-events-none">
          <div className="pointer-events-auto bg-[#0d1016]/90 border border-white/10 rounded-lg px-4 py-3 flex items-center gap-4">
            <div>
              <div className="text-[11px] text-slate-400">
                {model.manufacturer} · Classe {model.carClass} ·{' '}
                <span className="text-sky-400 font-semibold">
                  {POWERTRAIN_LABELS[currentArch.powertrainType]}
                </span>
              </div>
              <select
                value={activeCar.instanceId}
                onChange={(e) => onSelectCar(e.target.value)}
                className="mt-0.5 bg-transparent font-display text-base font-bold text-white focus:outline-none cursor-pointer"
              >
                {garage.map((c) => (
                  <option key={c.instanceId} value={c.instanceId} className="bg-[#12161f]">
                    {c.customName} (#{c.tuning.raceNumber})
                  </option>
                ))}
              </select>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
              <div>
                <div className="text-slate-400">Potenza</div>
                <div className="text-white font-semibold">{specs.powerHp} CV</div>
              </div>
              <div>
                <div className="text-slate-400">Peso</div>
                <div className="text-white font-semibold">{specs.weightKg} kg</div>
              </div>
              <div>
                <div className="text-slate-400">V. Max</div>
                <div className="text-white font-semibold">{specs.topSpeedKmh} km/h</div>
              </div>
              <div>
                <div className="text-slate-400">PI</div>
                <div className="text-amber-400 font-semibold">{specs.piIndex}</div>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto bg-[#0d1016]/90 border border-white/10 rounded-lg px-4 py-2.5 text-right">
            <div className="text-[11px] text-slate-400">Budget Scuderia</div>
            <div className="font-mono text-base font-bold text-amber-400 tabular-nums">
              {credits.toLocaleString('it-IT')} CR
            </div>
          </div>
        </div>

        {/* Bottom-Center Compact Camera Dock */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#0d1016]/90 border border-white/10 rounded-lg p-1 flex items-center gap-1">
          {(
            [
              ['three_quarter', 'Vista 3/4'],
              ['front', 'Muso & Ala'],
              ['rear', 'Diffusore'],
              ['top', 'Dall’Alto'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyCameraPreset(id)}
              className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                cameraPreset === id
                  ? 'bg-[#e10600] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Engineering & Customization Console */}
      <aside className="w-full lg:w-[440px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#12161f] flex flex-col overflow-hidden">
        {/* Sub-navigation */}
        <div className="grid grid-cols-5 border-b border-white/10 bg-[#0d1016]">
          {(
            [
              ['engine', 'Motore', Cpu],
              ['aero', 'Assetto', Wind],
              ['livery', 'Livrea', Palette],
              ['parts', 'Pezzi', Wrench],
              ['pitcrew', 'Pit Crew', Users],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                subTab === id
                  ? 'border-[#e10600] text-white bg-[#12161f]'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {subTab === 'engine' && (
            <>
              <div>
                <h2 className="font-display text-base font-bold text-white mb-2">
                  Architettura Propulsore
                </h2>
                <div className="space-y-2">
                  {(Object.keys(ENGINE_ARCHITECTURES) as EngineArchitecture[]).map((key) => {
                    const arch = ENGINE_ARCHITECTURES[key];
                    const selected = activeCar.tuning.engineArch === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const clampedRev = Math.max(
                            arch.minRpmLimit,
                            Math.min(arch.maxRpmLimit, activeCar.tuning.revLimitRpm)
                          );
                          updateTuning({
                            engineArch: key,
                            revLimitRpm: clampedRev,
                            turboBar: !arch.hasTurbo ? 1.0 : Math.max(1.4, activeCar.tuning.turboBar),
                          });
                        }}
                        className={`w-full text-left p-3 rounded-md border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#e10600]/12 border-[#e10600] text-white'
                            : 'bg-[#0b0d11] border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                          <span className="truncate">{arch.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                                arch.powertrainType === 'electric'
                                  ? 'bg-cyan-500/20 text-cyan-300'
                                  : arch.powertrainType === 'hydrogen'
                                  ? 'bg-sky-500/20 text-sky-300'
                                  : arch.powertrainType === 'hybrid'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-orange-500/20 text-orange-300'
                              }`}
                            >
                              {POWERTRAIN_LABELS[arch.powertrainType]}
                            </span>
                            {selected && <Check className="w-3.5 h-3.5 text-[#e10600]" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{arch.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dyno Curve */}
              <div className="bg-[#0b0d11] border border-white/10 rounded-md p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-white">Banco Prova Coppia / Potenza</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {specs.powerHp} CV · {specs.torqueNm} Nm
                  </span>
                </div>
                <svg viewBox="0 0 300 120" className="w-full h-28">
                  <line x1="16" y1="108" x2="286" y2="108" stroke="#272c38" strokeWidth="1" />
                  <line x1="16" y1="20" x2="16" y2="108" stroke="#272c38" strokeWidth="1" />
                  <path d={dynoPaths.torquePath} fill="none" stroke="#f59e0b" strokeWidth="2" />
                  <path d={dynoPaths.powerPath} fill="none" stroke="#e10600" strokeWidth="2.5" />
                  <text x="18" y="16" fill="#e10600" fontSize="9" fontFamily="monospace">
                    CV ({specs.powerHp})
                  </text>
                  <text x="95" y="16" fill="#f59e0b" fontSize="9" fontFamily="monospace">
                    Nm ({specs.torqueNm})
                  </text>
                  <text x="225" y="118" fill="#64748b" fontSize="9" fontFamily="monospace">
                    {dynoPaths.maxRpm} RPM
                  </text>
                </svg>
              </div>

              {/* Engine Sliders */}
              <div className="space-y-4">
                {currentArch.hasTurbo && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">Pressione Turbocompressore</span>
                      <span className="font-mono text-white tabular-nums">
                        {activeCar.tuning.turboBar.toFixed(1)} bar
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.2}
                      max={4.0}
                      step={0.1}
                      value={activeCar.tuning.turboBar}
                      onChange={(e) => updateTuning({ turboBar: Number(e.target.value) })}
                      className="w-full accent-[#e10600]"
                    />
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Limitatore Giri (RPM)</span>
                    <span className="font-mono text-white tabular-nums">
                      {activeCar.tuning.revLimitRpm.toLocaleString('it-IT')} RPM
                    </span>
                  </div>
                  <input
                    type="range"
                    min={currentArch.minRpmLimit}
                    max={currentArch.maxRpmLimit}
                    step={250}
                    value={activeCar.tuning.revLimitRpm}
                    onChange={(e) => updateTuning({ revLimitRpm: Number(e.target.value) })}
                    className="w-full accent-[#e10600]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Rapporto Finale Cambio</span>
                    <span className="font-mono text-white tabular-nums">
                      {activeCar.tuning.finalDrive.toFixed(2)} : 1
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2.9}
                    max={4.3}
                    step={0.05}
                    value={activeCar.tuning.finalDrive}
                    onChange={(e) => updateTuning({ finalDrive: Number(e.target.value) })}
                    className="w-full accent-[#e10600]"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                    <span>Velocità Max (Monza)</span>
                    <span>Accelerazione (Cittadino)</span>
                  </div>
                </div>
              </div>

              {/* Calculated Telemetry Summary */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-xs font-mono tabular-nums">
                <div className="bg-[#0b0d11] p-2.5 rounded">
                  <div className="text-[11px] text-slate-400">0–100 km/h</div>
                  <div className="text-white font-semibold">{specs.zeroToHundredSec} s</div>
                </div>
                <div className="bg-[#0b0d11] p-2.5 rounded">
                  <div className="text-[11px] text-slate-400">Carico Aero</div>
                  <div className="text-white font-semibold">{specs.downforceG} G</div>
                </div>
                <div className="bg-[#0b0d11] p-2.5 rounded">
                  <div className="text-[11px] text-slate-400">Affidabilità</div>
                  <div className="text-white font-semibold">{specs.reliabilityPct}%</div>
                </div>
              </div>
            </>
          )}

          {subTab === 'aero' && (
            <div className="space-y-4">
              <h2 className="font-display text-base font-bold text-white">
                Aerodinamica &amp; Geometria Sospensioni
              </h2>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Incidenza Ala Anteriore</span>
                  <span className="font-mono text-white tabular-nums">
                    {activeCar.tuning.frontWingDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={35}
                  value={activeCar.tuning.frontWingDeg}
                  onChange={(e) => updateTuning({ frontWingDeg: Number(e.target.value) })}
                  className="w-full accent-[#e10600]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Incidenza Ala Posteriore</span>
                  <span className="font-mono text-white tabular-nums">
                    {activeCar.tuning.rearWingDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  value={activeCar.tuning.rearWingDeg}
                  onChange={(e) => updateTuning({ rearWingDeg: Number(e.target.value) })}
                  className="w-full accent-[#e10600]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Ripartizione Frenata (Ant.)</span>
                  <span className="font-mono text-white tabular-nums">
                    {activeCar.tuning.brakeBias}% / {100 - activeCar.tuning.brakeBias}%
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={65}
                  value={activeCar.tuning.brakeBias}
                  onChange={(e) => updateTuning({ brakeBias: Number(e.target.value) })}
                  className="w-full accent-[#e10600]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Rigidezza Molle &amp; Barre</span>
                  <span className="font-mono text-white tabular-nums">
                    Livello {activeCar.tuning.suspensionStiff}/10
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={activeCar.tuning.suspensionStiff}
                  onChange={(e) => updateTuning({ suspensionStiff: Number(e.target.value) })}
                  className="w-full accent-[#e10600]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Altezza da Terra (Ride Height)</span>
                  <span className="font-mono text-white tabular-nums">
                    {activeCar.tuning.rideHeightMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={68}
                  value={activeCar.tuning.rideHeightMm}
                  onChange={(e) => updateTuning({ rideHeightMm: Number(e.target.value) })}
                  className="w-full accent-[#e10600]"
                />
              </div>
            </div>
          )}

          {subTab === 'livery' && (
            <div className="space-y-4">
              <h2 className="font-display text-base font-bold text-white">
                Livrea Ufficiale &amp; Finiture
              </h2>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    Nome Vettura Team
                  </label>
                  <input
                    type="text"
                    value={activeCar.customName}
                    maxLength={32}
                    onChange={(e) =>
                      onUpdateCar({ ...activeCar, customName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded bg-[#0b0d11] border border-white/10 text-sm text-white focus:outline-none focus:border-[#e10600]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Numero</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={activeCar.tuning.raceNumber}
                    onChange={(e) =>
                      updateTuning({
                        raceNumber: Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                      })
                    }
                    className="w-full px-3 py-2 rounded bg-[#0b0d11] border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-[#e10600]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  Colore Primario Scocca
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => updateTuning({ primaryColor: hex })}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded border-2 cursor-pointer ${
                        activeCar.tuning.primaryColor === hex
                          ? 'border-white scale-110'
                          : 'border-white/20'
                      }`}
                      aria-label={`Colore primario ${hex}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={activeCar.tuning.primaryColor}
                    onChange={(e) => updateTuning({ primaryColor: e.target.value })}
                    className="w-8 h-7 bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  Colore Secondario &amp; Ali
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => updateTuning({ secondaryColor: hex })}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded border-2 cursor-pointer ${
                        activeCar.tuning.secondaryColor === hex
                          ? 'border-white scale-110'
                          : 'border-white/20'
                      }`}
                      aria-label={`Colore secondario ${hex}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={activeCar.tuning.secondaryColor}
                    onChange={(e) => updateTuning({ secondaryColor: e.target.value })}
                    className="w-8 h-7 bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">
                  Finitura Vernice PBR
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['metallic', 'Metallizzato'],
                      ['matte_carbon', 'Opaco Racing'],
                      ['chrome', 'Cromato'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => updateTuning({ finish: id })}
                      className={`py-2 px-2 rounded text-xs font-medium border cursor-pointer transition-colors ${
                        activeCar.tuning.finish === id
                          ? 'bg-[#e10600]/15 border-[#e10600] text-white'
                          : 'bg-[#0b0d11] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {subTab === 'parts' && (
            <div className="space-y-5">
              {/* Damage Inspection & Repair */}
              <div className="bg-[#0b0d11] border border-white/10 rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <h3 className="font-display text-sm font-bold text-white">
                      Integrità Strutturale &amp; Danni
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    {Math.round(activeCar.mileageKm)} km percorsi
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(
                    [
                      ['Ala Anteriore', activeCar.damage.frontAero],
                      ['Ala Posteriore', activeCar.damage.rearAero],
                      ['Motore & Turbo', activeCar.damage.engine],
                      ['Sospensioni', activeCar.damage.suspension],
                      ['Pneumatici', activeCar.damage.tires],
                      ['Cambio & Freni', activeCar.damage.gearboxBrakes],
                    ] as const
                  ).map(([label, dmg]) => {
                    const health = Math.max(0, Math.round(100 - dmg));
                    const color =
                      health > 75
                        ? 'bg-emerald-500'
                        : health > 40
                        ? 'bg-amber-500'
                        : 'bg-rose-500';
                    return (
                      <div key={label} className="p-2 rounded bg-[#12161f] border border-white/5">
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-300">{label}</span>
                          <span className="font-mono text-white tabular-nums">{health}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className={`h-full ${color}`} style={{ width: `${health}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={repairCost === 0 || credits < repairCost}
                  onClick={() => onRepairCar(activeCar.instanceId, repairCost)}
                  className="w-full py-2 px-3 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-white/10 disabled:text-slate-500 text-slate-950 text-xs font-semibold cursor-pointer transition-colors"
                >
                  {repairCost === 0
                    ? 'Vettura al 100% — Nessuna Riparazione Necessaria'
                    : credits < repairCost
                    ? `Crediti Insufficienti (${repairCost.toLocaleString('it-IT')} CR)`
                    : `Ripara & Sostituisci Componenti (${repairCost.toLocaleString('it-IT')} CR)`}
                </button>
              </div>

              {/* Unique Serialized Components Slots */}
              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold text-white">
                  Componenti Unici Installati
                </h3>
                {(Object.keys(SLOT_LABELS) as ComponentSlot[]).map((slot) => {
                  const equippedId = activeCar.installedParts[slot];
                  const equippedPart = inventory.find((p) => p.id === equippedId);
                  const availableForSlot = inventory.filter((p) => p.slot === slot);

                  return (
                    <div
                      key={slot}
                      className="p-3 rounded-md bg-[#0b0d11] border border-white/10 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">{SLOT_LABELS[slot]}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {equippedPart ? equippedPart.serial : 'Componente di Serie'}
                        </span>
                      </div>

                      <select
                        value={equippedId ?? ''}
                        onChange={(e) => equipPart(slot, e.target.value || undefined)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#12161f] border border-white/10 text-xs text-white focus:outline-none focus:border-[#e10600]"
                      >
                        <option value="">Componente Standard Factory (0 CR)</option>
                        {availableForSlot.map((part) => (
                          <option key={part.id} value={part.id}>
                            {part.name} [{part.rarity}] ({part.serial})
                          </option>
                        ))}
                      </select>

                      {equippedPart && (
                        <div className="text-[11px] text-emerald-400 font-mono tabular-nums">
                          {equippedPart.stats.powerDelta > 0 && `+${equippedPart.stats.powerDelta} CV · `}
                          {equippedPart.stats.torqueDelta > 0 && `+${equippedPart.stats.torqueDelta} Nm · `}
                          {equippedPart.stats.gripDelta > 0 && `+${equippedPart.stats.gripDelta}% Grip · `}
                          {equippedPart.stats.aeroDelta > 0 && `+${equippedPart.stats.aeroDelta}% Aero · `}
                          {equippedPart.stats.weightDelta !== 0 && `${equippedPart.stats.weightDelta} kg`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Official Aftermarket & Works Component Shop */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-[#e10600]" />
                    <h3 className="font-display text-sm font-bold text-white">
                      Negozio Componenti ({COMPONENT_SHOP_CATALOG.length} Parti)
                    </h3>
                  </div>
                  <select
                    value={shopSlotFilter}
                    onChange={(e) => setShopSlotFilter(e.target.value as ComponentSlot | 'ALL')}
                    className="px-2 py-1 rounded bg-[#0b0d11] border border-white/10 text-[11px] text-white focus:outline-none"
                  >
                    <option value="ALL">Tutti i Reparti</option>
                    {(Object.keys(SLOT_LABELS) as ComponentSlot[]).map((sl) => (
                      <option key={sl} value={sl}>
                        {SLOT_LABELS[sl]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  {COMPONENT_SHOP_CATALOG.filter(
                    (item) => shopSlotFilter === 'ALL' || item.slot === shopSlotFilter
                  ).map((item) => {
                    const canAfford = credits >= item.price;
                    return (
                      <div
                        key={item.catalogId}
                        className="p-3 rounded-md bg-[#0b0d11] border border-white/10 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="font-semibold text-sky-400">
                            {item.rarity} · {SLOT_LABELS[item.slot]}
                          </span>
                          <span className="font-mono text-amber-400 font-bold">
                            {item.price.toLocaleString('it-IT')} CR
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-white">{item.name}</div>
                        <p className="text-[11px] text-slate-400">{item.originNote}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-emerald-400 tabular-nums">
                          {item.stats.powerDelta > 0 && <span>+{item.stats.powerDelta} CV</span>}
                          {item.stats.torqueDelta > 0 && <span>+{item.stats.torqueDelta} Nm</span>}
                          {item.stats.gripDelta > 0 && <span>+{item.stats.gripDelta}% Grip</span>}
                          {item.stats.aeroDelta > 0 && <span>+{item.stats.aeroDelta}% Aero</span>}
                          {item.stats.weightDelta !== 0 && <span>{item.stats.weightDelta} kg</span>}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onBuyComponent(item, activeCar.instanceId)}
                            className="flex-1 py-1.5 px-2.5 rounded bg-[#e10600] hover:bg-[#ff1e17] disabled:bg-white/10 disabled:text-slate-500 text-[11px] font-semibold text-white cursor-pointer"
                          >
                            {canAfford ? 'Acquista & Monta' : 'Crediti Insufficienti'}
                          </button>
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onBuyComponent(item)}
                            className="py-1.5 px-2.5 rounded bg-white/10 hover:bg-white/15 disabled:opacity-40 text-[11px] font-medium text-white cursor-pointer"
                          >
                            + Inventario
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {subTab === 'pitcrew' && (
            <div className="space-y-5">
              {/* Pit Crew Overview & Live Timing Benchmark */}
              <div className="bg-[#0b0d11] border border-white/10 rounded-md p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-400">
                      {pitStats.pitStopTierLabel} · Livello Complessivo {pitStats.teamRatingPct}%
                    </div>
                    <h2 className="font-display text-base font-bold text-white">
                      Gestione Squadra Pit Crew
                    </h2>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-[10px] text-slate-400">Stop Stimato (4 Gomme)</div>
                    <div className="text-base font-bold text-emerald-400">
                      {(pitStats.reactionDelaySec + pitStats.tireChangeTimeSec).toFixed(2)} s
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                  <div className="p-2.5 rounded bg-[#12161f] border border-white/5">
                    <div className="text-[11px] text-slate-400 font-sans">Reazione Box</div>
                    <div className="text-white font-semibold">{pitStats.reactionDelaySec.toFixed(2)} s</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#12161f] border border-white/5">
                    <div className="text-[11px] text-slate-400 font-sans">Cambio Gomme</div>
                    <div className="text-white font-semibold">{pitStats.tireChangeTimeSec.toFixed(2)} s</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#12161f] border border-white/5">
                    <div className="text-[11px] text-slate-400 font-sans">Riparazioni Danni</div>
                    <div className="text-white font-semibold">{pitStats.repairRatePerSec}% / sec</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#12161f] border border-white/5">
                    <div className="text-[11px] text-slate-400 font-sans">Ricarica ERS Box</div>
                    <div className="text-white font-semibold">{pitStats.ersRechargePerSec}% / sec</div>
                  </div>
                </div>

                {/* Live Pit Stop Simulator */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-amber-400" />
                      {simPhaseLabel === 'idle' && 'Test Cronometro Sosta Box'}
                      {simPhaseLabel === 'reacting' && 'Reazione Sollevatori...'}
                      {simPhaseLabel === 'tires' && 'Avvitatori in Azione (4 Ruote)...'}
                      {simPhaseLabel === 'done' && 'Via Libera! Sosta Completata'}
                    </span>
                    <span className="font-mono font-bold text-amber-400 tabular-nums">
                      {simElapsedSec.toFixed(2)} s
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-none ${
                        simPhaseLabel === 'done' ? 'bg-emerald-500' : 'bg-[#e10600]'
                      }`}
                      style={{ width: `${simProgressPct}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSimElapsedSec(0);
                      setSimProgressPct(0);
                      setSimPhaseLabel('reacting');
                      setSimRunning(true);
                    }}
                    className="w-full py-2 px-3 rounded bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer transition-colors"
                  >
                    {simRunning ? 'Riavvia Cronometro Pit Stop' : 'Simula Pit Stop Box'}
                  </button>
                </div>
              </div>

              {/* 4 Crew Upgrade Stations */}
              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold text-white">
                  Addestramento &amp; Attrezzatura Reparti
                </h3>
                {PIT_CREW_ROLES.map((role) => {
                  const currentLevel = pitCrew[role.key] || 1;
                  const isMax = currentLevel >= MAX_PIT_CREW_LEVEL;
                  const nextCost = getPitCrewUpgradeCost(role.key, currentLevel);
                  const canAfford = credits >= nextCost;

                  return (
                    <div
                      key={role.key}
                      className="p-3.5 rounded-md bg-[#0b0d11] border border-white/10 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-white">{role.title}</div>
                          <div className="text-[11px] text-slate-400">{role.specialty}</div>
                        </div>
                        <div className="text-right font-mono text-xs tabular-nums">
                          <span className="text-white font-semibold">
                            Liv. {currentLevel}/{MAX_PIT_CREW_LEVEL}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {role.description}
                      </p>

                      {/* 5 Level Pips */}
                      <div className="grid grid-cols-5 gap-1">
                        {Array.from({ length: MAX_PIT_CREW_LEVEL }).map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-1.5 rounded-xs ${
                              idx < currentLevel ? 'bg-[#e10600]' : 'bg-white/10'
                            }`}
                          />
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono tabular-nums pt-0.5">
                        <span className="text-slate-400 font-sans">{role.metricLabel}</span>
                        <div>
                          <span className="text-white font-semibold">
                            {role.formatMetric(currentLevel)}
                          </span>
                          {!isMax && (
                            <span className="text-emerald-400 ml-2">
                              → {role.formatMetric(currentLevel + 1)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isMax || !canAfford}
                        onClick={() => onUpgradePitCrew(role.key, nextCost)}
                        className="w-full py-2 px-3 rounded bg-[#e10600] hover:bg-[#ff1e17] disabled:bg-white/10 disabled:text-slate-500 text-xs font-semibold text-white cursor-pointer transition-colors whitespace-nowrap"
                      >
                        {isMax
                          ? 'Reparto al Livello Massimo F1'
                          : !canAfford
                          ? `Crediti Insufficienti (${nextCost.toLocaleString('it-IT')} CR)`
                          : `Potenzia al Livello ${currentLevel + 1} · ${nextCost.toLocaleString('it-IT')} CR`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
