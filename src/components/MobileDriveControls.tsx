import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Wind, Wrench, Zap } from 'lucide-react';

export type MobileSteerMode = 'wheel' | 'tilt' | 'buttons';

export interface MobileDriveInputState {
  steer: number;        // -1 (right) .. +1 (left)
  throttle: number;     // 0 .. 1
  brake: number;        // 0 .. 1
  ers: boolean;
  drs: boolean;
  pit: boolean;
  autoGas: boolean;
}

interface MobileDriveControlsProps {
  inputRef: React.MutableRefObject<MobileDriveInputState>;
  phase: 'standby' | 'countdown' | 'racing' | 'finished';
  ersCharge: number;
  ersActive: boolean;
  drsAvailable: boolean;
  drsActive: boolean;
  nearPitWindow: boolean;
  steerMode?: MobileSteerMode;
  onSteerModeChange?: (mode: MobileSteerMode) => void;
  autoGas?: boolean;
  onAutoGasChange?: (enabled: boolean) => void;
}

const MOBILE_MODE_KEY = 'apex_darwin_mobile_steer_mode';

export function useIsMobileTouchDevice(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrowTouch =
      window.innerWidth < 1024 && (coarse || navigator.maxTouchPoints > 0 || window.innerWidth < 768);
    return narrowTouch;
  });

  useEffect(() => {
    const check = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const narrowTouch =
        window.innerWidth < 1024 &&
        (coarse || navigator.maxTouchPoints > 0 || window.innerWidth < 768);
      setIsMobile(narrowTouch);
    };
    window.addEventListener('resize', check);
    const mq = window.matchMedia('(pointer: coarse)');
    mq.addEventListener('change', check);
    return () => {
      window.removeEventListener('resize', check);
      mq.removeEventListener('change', check);
    };
  }, []);

  return isMobile;
}

export const MobileDriveControls: React.FC<MobileDriveControlsProps> = ({
  inputRef,
  phase,
  ersCharge,
  ersActive,
  drsAvailable,
  drsActive,
  nearPitWindow,
  steerMode: controlledSteerMode,
  onSteerModeChange,
  autoGas: controlledAutoGas,
  onAutoGasChange,
}) => {
  const [internalSteerMode, setInternalSteerMode] = useState<MobileSteerMode>(() => {
    try {
      const saved = localStorage.getItem(MOBILE_MODE_KEY) as MobileSteerMode | null;
      if (saved === 'wheel' || saved === 'tilt' || saved === 'buttons') return saved;
    } catch {
      // ignore
    }
    return 'wheel';
  });

  const [internalAutoGas, setInternalAutoGas] = useState(false);
  const steerMode = controlledSteerMode ?? internalSteerMode;
  const setSteerMode = (mode: MobileSteerMode) => {
    setInternalSteerMode(mode);
    onSteerModeChange?.(mode);
  };
  const autoGas = controlledAutoGas ?? internalAutoGas;
  const setAutoGas = (next: boolean | ((prev: boolean) => boolean)) => {
    const val = typeof next === 'function' ? next(autoGas) : next;
    setInternalAutoGas(val);
    onAutoGasChange?.(val);
  };

  const [visualSteer, setVisualSteer] = useState(0); // -1..+1
  const [visualThrottle, setVisualThrottle] = useState(0);
  const [visualBrake, setVisualBrake] = useState(0);
  const [tiltZeroOffset, setTiltZeroOffset] = useState(0);
  const [tiltStatus, setTiltStatus] = useState<'ready' | 'needs_permission' | 'unsupported'>('ready');

  const wheelOriginXRef = useRef<number | null>(null);
  const wheelPointerIdRef = useRef<number | null>(null);
  const btnSteerRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const rawTiltAngleRef = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(MOBILE_MODE_KEY, steerMode);
    } catch {
      // ignore
    }
    if (steerMode !== 'wheel') {
      wheelPointerIdRef.current = null;
    }
    if (steerMode !== 'buttons') {
      btnSteerRef.current = { left: false, right: false };
    }
    inputRef.current.steer = 0;
    setVisualSteer(0);
  }, [steerMode, inputRef]);

  useEffect(() => {
    inputRef.current.autoGas = autoGas;
  }, [autoGas, inputRef]);

  // Gyroscope / DeviceOrientation listener when steerMode === 'tilt'
  useEffect(() => {
    if (steerMode !== 'tilt' || phase !== 'racing') return;

    const handleOrientation = (ev: DeviceOrientationEvent) => {
      const orientAngle = window.screen?.orientation?.angle ?? 0;
      const rawGamma = ev.gamma ?? 0; // left-right in portrait
      const rawBeta = ev.beta ?? 0;   // left-right in landscape

      let tiltDeg = 0;
      if (orientAngle === 90) tiltDeg = rawBeta;
      else if (orientAngle === -90 || orientAngle === 270) tiltDeg = -rawBeta;
      else tiltDeg = rawGamma;

      rawTiltAngleRef.current = tiltDeg;
      const calibrated = tiltDeg - tiltZeroOffset;
      const deadzone = 3.0;
      let normalized = 0;
      if (Math.abs(calibrated) > deadzone) {
        const sign = Math.sign(calibrated);
        const mag = Math.min(1, (Math.abs(calibrated) - deadzone) / 26);
        // Negated because positive steer = left, positive gamma/tilt right = steer right (-1)
        normalized = -sign * mag;
      }
      inputRef.current.steer = normalized;
      setVisualSteer(normalized);
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [steerMode, phase, tiltZeroOffset, inputRef]);

  const activateTiltMode = async () => {
    const devOrient = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (!window.DeviceOrientationEvent) {
      setTiltStatus('unsupported');
      return;
    }
    if (typeof devOrient?.requestPermission === 'function') {
      try {
        const res = await devOrient.requestPermission();
        if (res !== 'granted') {
          setTiltStatus('needs_permission');
          return;
        }
      } catch {
        setTiltStatus('needs_permission');
        return;
      }
    }
    setTiltStatus('ready');
    setSteerMode('tilt');
  };

  if (phase !== 'racing' && phase !== 'countdown') return null;

  // Analog F1 Wheel Touch Handlers (left thumb)
  const updateWheelSteer = (clientX: number) => {
    if (wheelOriginXRef.current === null) return;
    const dx = clientX - wheelOriginXRef.current;
    // Left drag (dx < 0) -> positive steer (+1); Right drag (dx > 0) -> negative steer (-1)
    const maxTravelPx = 56;
    const norm = Math.max(-1, Math.min(1, -dx / maxTravelPx));
    inputRef.current.steer = norm;
    setVisualSteer(norm);
  };

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    wheelPointerIdRef.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    wheelOriginXRef.current = rect.left + rect.width * 0.5;
    updateWheelSteer(e.clientX);
  };

  const handleWheelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (wheelPointerIdRef.current !== e.pointerId) return;
    updateWheelSteer(e.clientX);
  };

  const handleWheelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (wheelPointerIdRef.current !== e.pointerId) return;
    wheelPointerIdRef.current = null;
    wheelOriginXRef.current = null;
    inputRef.current.steer = 0;
    setVisualSteer(0);
  };

  // Proportional Vertical Pedal Helper (bottom = 0.45, top = 1.0)
  const computePedalValue = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return Math.max(0.45, Math.min(1, 0.4 + relY * 0.65));
  };

  const syncButtonSteer = () => {
    const val = (btnSteerRef.current.left ? 1 : 0) - (btnSteerRef.current.right ? 1 : 0);
    inputRef.current.steer = val;
    setVisualSteer(val);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 pointer-events-none px-2.5 pb-2.5 flex items-end justify-between gap-2">
      {/* LEFT THUMB ZONE: Compact Steering */}
      <div className="pointer-events-auto touch-none select-none">
        {steerMode === 'wheel' && (
          <div
            onPointerDown={handleWheelPointerDown}
            onPointerMove={handleWheelPointerMove}
            onPointerUp={handleWheelPointerUp}
            onPointerCancel={handleWheelPointerUp}
            className="w-32 h-24 rounded-xl bg-[#0b0d11]/85 border border-white/20 flex flex-col items-center justify-center gap-1 relative touch-none select-none cursor-grab active:cursor-grabbing"
            aria-label="Volante Analogico Touch"
          >
            {/* F1 Yoke Steering Graphic */}
            <svg
              viewBox="0 0 100 64"
              className="w-20 h-14 transition-transform duration-75"
              style={{ transform: `rotate(${(-visualSteer * 42).toFixed(1)}deg)` }}
            >
              <rect x="10" y="14" width="80" height="36" rx="14" fill="none" stroke="#e2e8f0" strokeWidth="6" />
              <rect x="34" y="20" width="32" height="22" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
              <rect x="46" y="12" width="8" height="8" rx="1" fill="#e10600" />
              <circle cx="20" cy="32" r="4" fill="#e10600" />
              <circle cx="80" cy="32" r="4" fill="#38bdf8" />
            </svg>
            <div className="flex items-center justify-between w-full px-2.5 text-[10px] font-mono text-slate-400 tabular-nums">
              <span>◀ SX</span>
              <span className="text-white font-semibold">
                {Math.round(-visualSteer * 32)}°
              </span>
              <span>DX ▶</span>
            </div>
          </div>
        )}

          {steerMode === 'tilt' && (
            <div className="w-40 rounded-xl bg-[#0b0d11]/90 border border-white/20 p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-200 font-semibold">Giroscopio</span>
                <span className="font-mono text-amber-400 tabular-nums">
                  {Math.round(-visualSteer * 32)}°
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 relative overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 w-3 rounded-full bg-[#e10600]"
                  style={{ left: `calc(${50 - visualSteer * 45}% - 6px)` }}
                />
              </div>
              {tiltStatus !== 'ready' ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-amber-300">
                    {tiltStatus === 'unsupported'
                      ? 'Giroscopio non disponibile su questo browser.'
                      : 'Consenti accesso al sensore di movimento.'}
                  </div>
                  {tiltStatus === 'needs_permission' && (
                    <button
                      type="button"
                      onClick={activateTiltMode}
                      className="w-full min-h-[34px] py-1 px-2 rounded bg-[#e10600] text-[11px] font-semibold text-white cursor-pointer"
                    >
                      Attiva Sensore
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTiltZeroOffset(rawTiltAngleRef.current)}
                  className="w-full min-h-[36px] py-1 px-2 rounded bg-white/10 hover:bg-white/15 text-[11px] font-medium text-white flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Calibra Centro
                </button>
              )}
            </div>
          )}

          {steerMode === 'buttons' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  btnSteerRef.current.left = true;
                  syncButtonSteer();
                }}
                onPointerUp={() => {
                  btnSteerRef.current.left = false;
                  syncButtonSteer();
                }}
                onPointerCancel={() => {
                  btnSteerRef.current.left = false;
                  syncButtonSteer();
                }}
                className="w-16 h-16 rounded-xl bg-[#0b0d11]/90 active:bg-[#e10600] border border-white/20 text-white text-xl font-bold flex items-center justify-center touch-none select-none cursor-pointer"
                aria-label="Sterza Sinistra"
              >
                ◀
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  btnSteerRef.current.right = true;
                  syncButtonSteer();
                }}
                onPointerUp={() => {
                  btnSteerRef.current.right = false;
                  syncButtonSteer();
                }}
                onPointerCancel={() => {
                  btnSteerRef.current.right = false;
                  syncButtonSteer();
                }}
                className="w-16 h-16 rounded-xl bg-[#0b0d11]/90 active:bg-[#e10600] border border-white/20 text-white text-xl font-bold flex items-center justify-center touch-none select-none cursor-pointer"
                aria-label="Sterza Destra"
              >
                ▶
              </button>
            </div>
          )}
        </div>

        {/* RIGHT THUMB ZONE: ERS / DRS / PIT + Proportional Brake & Gas Pedals */}
        <div className="pointer-events-auto flex flex-col items-end gap-2 touch-none select-none">
          <div className="flex items-center gap-1.5">
            {nearPitWindow && phase === 'racing' && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  inputRef.current.pit = true;
                }}
                onPointerUp={() => (inputRef.current.pit = false)}
                onPointerCancel={() => (inputRef.current.pit = false)}
                className="min-h-[44px] px-3 rounded-lg bg-emerald-700 active:bg-emerald-500 border border-emerald-400/50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                PIT
              </button>
            )}
            <button
              type="button"
              disabled={!drsAvailable}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                inputRef.current.drs = true;
              }}
              onPointerUp={() => (inputRef.current.drs = false)}
              onPointerCancel={() => (inputRef.current.drs = false)}
              className={`min-h-[44px] px-3 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer ${
                drsActive
                  ? 'bg-emerald-600 border-emerald-300 text-white'
                  : drsAvailable
                  ? 'bg-amber-500 border-amber-300 text-slate-950'
                  : 'bg-[#0b0d11]/80 border-white/10 text-slate-500'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              DRS
            </button>
            <button
              type="button"
              disabled={ersCharge <= 2}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                inputRef.current.ers = true;
              }}
              onPointerUp={() => (inputRef.current.ers = false)}
              onPointerCancel={() => (inputRef.current.ers = false)}
              className={`min-h-[44px] px-3 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer ${
                ersActive
                  ? 'bg-sky-500 border-sky-300 text-slate-950'
                  : 'bg-[#0b0d11]/90 border-sky-500/40 text-sky-300 disabled:text-slate-600 disabled:border-white/10'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              ERS
            </button>
          </div>

          {/* Dual Proportional Multi-Touch Pedals */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                const val = computePedalValue(e);
                inputRef.current.brake = val;
                setVisualBrake(val);
              }}
              onPointerMove={(e) => {
                if (inputRef.current.brake <= 0) return;
                const val = computePedalValue(e);
                inputRef.current.brake = val;
                setVisualBrake(val);
              }}
              onPointerUp={() => {
                inputRef.current.brake = 0;
                setVisualBrake(0);
              }}
              onPointerCancel={() => {
                inputRef.current.brake = 0;
                setVisualBrake(0);
              }}
              className="relative w-14 h-22 rounded-xl bg-[#0b0d11]/92 border border-rose-500/50 overflow-hidden flex flex-col items-center justify-end pb-2 text-white font-bold text-[11px] touch-none select-none cursor-pointer"
              aria-label="Pedale Freno Proporzionale"
            >
              <div
                className="absolute inset-x-0 bottom-0 bg-rose-600/75 pointer-events-none"
                style={{ height: `${Math.round(visualBrake * 100)}%` }}
              />
              <span className="relative z-10 tracking-wide">FRENO</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                const val = computePedalValue(e);
                inputRef.current.throttle = val;
                setVisualThrottle(val);
              }}
              onPointerMove={(e) => {
                if (inputRef.current.throttle <= 0) return;
                const val = computePedalValue(e);
                inputRef.current.throttle = val;
                setVisualThrottle(val);
              }}
              onPointerUp={() => {
                inputRef.current.throttle = 0;
                setVisualThrottle(0);
              }}
              onPointerCancel={() => {
                inputRef.current.throttle = 0;
                setVisualThrottle(0);
              }}
              className="relative w-14 h-24 rounded-xl bg-[#0b0d11]/92 border border-emerald-500/50 overflow-hidden flex flex-col items-center justify-end pb-2 text-white font-bold text-[11px] touch-none select-none cursor-pointer"
              aria-label="Pedale Acceleratore Proporzionale"
            >
              <div
                className="absolute inset-x-0 bottom-0 bg-emerald-600/75 pointer-events-none"
                style={{
                  height: `${Math.round(
                    (autoGas && visualBrake === 0 ? 1 : visualThrottle) * 100
                  )}%`,
                }}
              />
              <span className="relative z-10 tracking-wide">
                {autoGas && visualBrake === 0 ? 'AUTO' : 'GAS'}
              </span>
            </button>
          </div>
        </div>
    </div>
  );
};
