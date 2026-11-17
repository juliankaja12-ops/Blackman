import React, { useState } from 'react';
import { Award, BatteryCharging, Check, CarFront, Flame, Fuel, Gauge, Lock, ShieldCheck, Zap } from 'lucide-react';
import {
  CAR_CATALOG,
  ENGINE_ARCHITECTURES,
  getRankById,
  isRankUnlocked,
  POWERTRAIN_LABELS,
} from '../data/catalog';
import { CarClass, CarModel, OwnedCar, PowertrainType, RankDefinition } from '../types/game';

interface DealershipProps {
  credits: number;
  garage: OwnedCar[];
  playerRank: RankDefinition;
  playerRankPoints: number;
  nextRank: RankDefinition | null;
  onBuyCar: (model: CarModel) => void;
  onSelectCarAndGoToGarage: (instanceId: string) => void;
}

const POWERTRAIN_BADGE_STYLE: Record<PowertrainType, string> = {
  ice: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  hybrid: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  electric: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35',
  hydrogen: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
};

export const Dealership: React.FC<DealershipProps> = ({
  credits,
  garage,
  playerRank,
  playerRankPoints,
  nextRank,
  onBuyCar,
  onSelectCarAndGoToGarage,
}) => {
  const [filterClass, setFilterClass] = useState<CarClass | 'ALL'>('ALL');
  const [filterPowertrain, setFilterPowertrain] = useState<PowertrainType | 'ALL'>('ALL');
  const [heroImgError, setHeroImgError] = useState(false);

  const visibleModels = CAR_CATALOG.filter((m) => {
    if (filterClass !== 'ALL' && m.carClass !== filterClass) return false;
    if (filterPowertrain !== 'ALL' && m.powertrainType !== filterPowertrain) return false;
    return true;
  });

  const rpProgressPct = nextRank
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((playerRankPoints - playerRank.minPoints) /
              Math.max(1, nextRank.minPoints - playerRank.minPoints)) *
              100
          )
        )
      )
    : 100;

  return (
    <div className="flex-1 overflow-y-auto bg-[#0b0d11] p-6">
      <div className="max-w-[1320px] mx-auto space-y-6">
        {/* Hero Banner */}
        <div className="relative rounded-lg overflow-hidden border border-white/10 bg-[#12161f] min-h-[210px] flex items-end">
          {!heroImgError ? (
            <img
              src="/src/assets/images/env_desert_sunset_1794815216149.jpg"
              alt="Griglia di partenza auto da corsa Formula 1"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgError(true)}
              className="absolute inset-0 w-full h-full object-cover opacity-55"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-[#171c28] via-[#12161f] to-[#231214]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d11] via-[#0b0d11]/60 to-transparent" />
          <div className="relative z-10 w-full p-6 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#0b0d11]/90 border border-white/15 text-xs">
                <Award className="w-3.5 h-3.5" style={{ color: playerRank.colorHex }} />
                <span className="font-bold" style={{ color: playerRank.colorHex }}>
                  Rank {playerRank.name}
                </span>
                <span className="text-slate-400 font-mono">· {playerRankPoints} RP</span>
                <span className="text-emerald-400 font-mono">
                  · Premi x{playerRank.prizeMultiplier.toFixed(2)}
                </span>
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-white text-balance">
                Concessionaria Ufficiale: Termiche, Elettriche &amp; Idrogeno
              </h1>
              <p className="text-sm text-slate-300">
                16 prototipi e monoposto da gara fra motori Termici/Ibridi, 100% Elettrici 800V/1200V e Celle a Idrogeno criogeniche.
              </p>
              {nextRank && (
                <div className="max-w-md space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-300">
                    <span>
                      Prossimo: <strong style={{ color: nextRank.colorHex }}>{nextRank.name}</strong> ({nextRank.minPoints} RP)
                    </span>
                    <span>{rpProgressPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${rpProgressPct}%`, backgroundColor: nextRank.colorHex }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="bg-[#0d1016]/90 border border-white/10 rounded-md px-4 py-2.5 text-right">
              <div className="text-[11px] text-slate-400">Crediti Disponibili</div>
              <div className="font-mono text-xl font-bold text-amber-400 tabular-nums">
                {credits.toLocaleString('it-IT')} CR
              </div>
            </div>
          </div>
        </div>

        {/* Category & Powertrain Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#12161f] border border-white/10 rounded-md overflow-x-auto">
              {(['ALL', 'F3', 'GT3', 'F2', 'LMH', 'F1'] as const).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setFilterClass(cls)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    filterClass === cls
                      ? 'bg-[#e10600] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cls === 'ALL' ? 'Tutte' : cls}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#12161f] border border-white/10 rounded-md overflow-x-auto">
              {(
                [
                  ['ALL', 'Tutti i Motori'],
                  ['ice', 'Termico ICE'],
                  ['hybrid', 'Ibrido'],
                  ['electric', 'Elettrico EV'],
                  ['hydrogen', 'Idrogeno H₂'],
                ] as const
              ).map(([pt, label]) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setFilterPowertrain(pt)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    filterPowertrain === pt
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Vetture visibili: <span className="font-mono text-white font-semibold">{visibleModels.length}</span> · Garage:{' '}
            <span className="font-mono text-white font-semibold">{garage.length}</span>
          </div>
        </div>

        {/* Vehicle Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleModels.map((model) => {
            const ownedInstance = garage.find((g) => g.modelId === model.id);
            const reqRank = getRankById(model.requiredRank);
            const rankUnlocked = isRankUnlocked(playerRank.id, model.requiredRank);
            const canAfford = credits >= model.price;
            const arch = ENGINE_ARCHITECTURES[model.defaultEngine];
            const PtIcon =
              model.powertrainType === 'electric'
                ? BatteryCharging
                : model.powertrainType === 'hydrogen'
                ? Zap
                : model.powertrainType === 'hybrid'
                ? Flame
                : Fuel;

            return (
              <div
                key={model.id}
                className={`bg-[#12161f] border rounded-lg p-5 flex flex-col justify-between gap-4 ${
                  rankUnlocked || ownedInstance ? 'border-white/10' : 'border-white/5 opacity-90'
                }`}
              >
                <div className="space-y-3">
                  {/* Stylized Vector Chassis Header */}
                  <div className="h-32 rounded-md bg-[#0b0d11] border border-white/5 flex items-center justify-between px-4 relative overflow-hidden">
                    <div className="min-w-0 pr-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400 truncate">
                          {model.manufacturer} · {model.carClass}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                            POWERTRAIN_BADGE_STYLE[model.powertrainType]
                          }`}
                        >
                          <PtIcon className="w-2.5 h-2.5" />
                          {POWERTRAIN_LABELS[model.powertrainType]}
                        </span>
                      </div>
                      <h2 className="font-display text-lg font-bold text-white truncate">
                        {model.name}
                      </h2>
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono">
                        {rankUnlocked || ownedInstance ? (
                          <span style={{ color: reqRank.colorHex }}>
                            Rank {reqRank.name} · Sbloccata
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-300">
                            <Lock className="w-3 h-3" />
                            Richiede Rank {reqRank.name} ({reqRank.minPoints} RP)
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className="w-12 h-12 rounded-md flex items-center justify-center border border-white/10 shrink-0"
                      style={{ backgroundColor: `${model.defaultPrimary}22` }}
                    >
                      <CarFront className="w-6 h-6" style={{ color: model.defaultPrimary }} />
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {model.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums pt-2 border-t border-white/10">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Potenza Base</span>
                      <span className="text-white font-semibold">{model.basePowerHp} CV</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Coppia Max</span>
                      <span className="text-white font-semibold">{model.baseTorqueNm} Nm</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Velocità Max</span>
                      <span className="text-white font-semibold">{model.baseTopSpeedKmh} km/h</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Peso / Aero</span>
                      <span className="text-white font-semibold">
                        {model.baseWeightKg} kg · {model.baseDownforce} G
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{arch.name}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-slate-400">Prezzo Listino</div>
                    <div className="font-mono text-base font-bold text-amber-400 tabular-nums">
                      {model.price === 0 ? 'Inclusa' : `${model.price.toLocaleString('it-IT')} CR`}
                    </div>
                  </div>

                  {ownedInstance ? (
                    <button
                      type="button"
                      onClick={() => onSelectCarAndGoToGarage(ownedInstance.instanceId)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer transition-colors"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Apri in Officina
                    </button>
                  ) : !rankUnlocked ? (
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white/5 border border-white/10 text-slate-400 text-xs font-semibold cursor-not-allowed"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      Rank {reqRank.name}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyCar(model)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#e10600] hover:bg-[#ff1e17] disabled:bg-white/10 disabled:text-slate-500 text-xs font-semibold text-white cursor-pointer transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {canAfford ? 'Acquista Telaio' : 'Fondi Insufficienti'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

