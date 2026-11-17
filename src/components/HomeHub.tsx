import React from 'react';
import {
  ArrowRight,
  Award,
  CarFront,
  Compass,
  Flag,
  Globe,
  Maximize2,
  Minimize2,
  Play,
  ShoppingBag,
  Trophy,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import {
  CAR_CATALOG,
  computeCarSpecs,
  computePitCrewStats,
  getNpcDifficultyConfig,
  RANK_LADDER,
} from '../data/catalog';
import {
  AppTab,
  DriverProfile,
  MultiplayerRoom,
  OwnedCar,
  PitCrewUpgrades,
  RankDefinition,
  TrackDefinition,
  UniqueComponent,
} from '../types/game';

interface HomeHubProps {
  profile: DriverProfile;
  playerRank: RankDefinition;
  nextRank: RankDefinition | null;
  npcLevel: number;
  onChangeNpcLevel: (lvl: number) => void;
  activeCar: OwnedCar;
  inventory: UniqueComponent[];
  pitCrew: PitCrewUpgrades;
  allTracks: TrackDefinition[];
  selectedTrackId: string;
  onSelectTrackId: (id: string) => void;
  activeRoom: MultiplayerRoom | null;
  wsConnected: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onStartSinglePlayer: () => void;
  onOpenRaces: () => void;
  onOpenMultiplayer: () => void;
  onOpenMarket: () => void;
  onSelectTab: (tab: AppTab) => void;
  onGoToPitCrew: () => void;
}

function formatBestLap(ms: number | null): string {
  if (!ms || ms <= 0) return '--:--.---';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export const HomeHub: React.FC<HomeHubProps> = ({
  profile,
  playerRank,
  nextRank,
  npcLevel,
  onChangeNpcLevel,
  activeCar,
  inventory,
  pitCrew,
  allTracks,
  selectedTrackId,
  onSelectTrackId,
  activeRoom,
  wsConnected,
  isFullscreen,
  onToggleFullscreen,
  onStartSinglePlayer,
  onOpenRaces,
  onOpenMultiplayer,
  onOpenMarket,
  onSelectTab,
  onGoToPitCrew,
}) => {
  const model = CAR_CATALOG.find((m) => m.id === activeCar.modelId) ?? CAR_CATALOG[0];
  const specs = computeCarSpecs(model, activeCar, inventory);
  const pitStats = computePitCrewStats(pitCrew);
  const selectedTrack = allTracks.find((t) => t.id === selectedTrackId) ?? allTracks[0];
  const npcConfig = getNpcDifficultyConfig(npcLevel);

  const avgDamage = Math.round(
    (activeCar.damage.frontAero +
      activeCar.damage.rearAero +
      activeCar.damage.engine +
      activeCar.damage.suspension +
      activeCar.damage.tires +
      activeCar.damage.gearboxBrakes) /
      6
  );

  const rpProgressPct = nextRank
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((profile.rankPoints - playerRank.minPoints) /
              Math.max(1, nextRank.minPoints - playerRank.minPoints)) *
              100
          )
        )
      )
    : 100;

  return (
    <div className="relative flex-1 h-full w-full overflow-y-auto bg-[#0b0d11] flex flex-col justify-between p-4 sm:p-8">
      {/* Subtle Motorsport Grid Backdrop */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 15%, rgba(225,6,0,0.22), transparent 45%), radial-gradient(circle at 85% 80%, rgba(14,165,233,0.16), transparent 45%)',
        }}
      />

      <div className="relative z-10 max-w-[1360px] w-full mx-auto flex-1 flex flex-col justify-between gap-5">
        {/* Top Fullscreen Bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-8 rounded-sm bg-[#e10600]" />
            <div>
              <h1 className="font-display text-xl sm:text-3xl font-bold tracking-tight text-white">
                Apex Darwin GP
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                <span>{profile.driverName}</span>
                <span>·</span>
                <span className={wsConnected ? 'text-emerald-400' : 'text-amber-400'}>
                  {wsConnected ? 'Online Pronti' : 'Offline Locale'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="bg-[#12161f] border border-white/10 rounded-lg px-3.5 py-2 flex items-center gap-4 text-xs font-mono tabular-nums">
              <div>
                <div className="text-[10px] text-slate-400 font-sans">Crediti</div>
                <div className="text-amber-400 font-bold text-sm">
                  {profile.credits.toLocaleString('it-IT')} CR
                </div>
              </div>
              <div className="h-6 w-px bg-white/10" />
              <div>
                <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-400" /> Vittorie
                </div>
                <div className="text-white font-bold text-sm">
                  {profile.wins}/{profile.racesCompleted}
                </div>
              </div>
              <div className="hidden sm:block h-6 w-px bg-white/10" />
              <div className="hidden sm:block">
                <div className="text-[10px] text-slate-400 font-sans">Best Lap</div>
                <div className="text-emerald-400 font-bold text-sm">
                  {formatBestLap(profile.bestLapRecordMs)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#12161f] hover:bg-[#1a202d] border border-white/15 text-xs font-semibold text-white cursor-pointer transition-colors"
              title={isFullscreen ? 'Esci da Schermo Intero' : 'Attiva Schermo Intero'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Esci Schermo Intero</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Schermo Intero</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Competitive Rank Ladder & Next Rank Rewards Strip */}
        <section className="rounded-xl border border-white/10 bg-[#12161f]/90 p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-lg border flex items-center justify-center shrink-0"
              style={{
                borderColor: `${playerRank.colorHex}66`,
                backgroundColor: `${playerRank.colorHex}1c`,
              }}
            >
              <Award className="w-6 h-6" style={{ color: playerRank.colorHex }} />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Rank Attuale:</span>
                <span
                  className="font-display text-base font-bold"
                  style={{ color: playerRank.colorHex }}
                >
                  {playerRank.name}
                </span>
                <span className="font-mono text-xs text-slate-300">
                  ({profile.rankPoints.toLocaleString('it-IT')} RP)
                </span>
                <span className="font-mono text-[11px] text-emerald-400 font-semibold">
                  Premi x{playerRank.prizeMultiplier.toFixed(2)}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                {nextRank ? (
                  <>
                    Prossimo Rank:{' '}
                    <strong style={{ color: nextRank.colorHex }}>{nextRank.name}</strong> (
                    {nextRank.minPoints} RP) → {nextRank.rewardSummary}
                  </>
                ) : (
                  <span className="text-amber-300 font-semibold">
                    Rank Massimo Unreal Raggiunto! Tutti i telai e bonus 3.8x sbloccati.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="lg:w-80 space-y-1.5">
            <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
              {RANK_LADDER.map((r) => {
                const reached = profile.rankPoints >= r.minPoints;
                return (
                  <span
                    key={r.id}
                    title={`${r.name} (${r.minPoints} RP): ${r.rewardSummary}`}
                    className={`px-1.5 py-0.5 rounded truncate ${
                      r.id === playerRank.id
                        ? 'font-bold text-slate-950'
                        : reached
                        ? 'text-slate-200 bg-white/10'
                        : 'text-slate-500 bg-white/5'
                    }`}
                    style={r.id === playerRank.id ? { backgroundColor: r.colorHex } : undefined}
                  >
                    {r.name === 'Gran Champion' ? 'GC' : r.name.slice(0, 3)}
                  </span>
                );
              })}
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${rpProgressPct}%`,
                  backgroundColor: nextRank ? nextRank.colorHex : playerRank.colorHex,
                }}
              />
            </div>
          </div>
        </section>

        {/* Active Multiplayer Room Alert if connected */}
        {activeRoom && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/35 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-sm font-bold text-white">
                  Stanza Online Attiva: {activeRoom.name} ({activeRoom.players.length} giocatori)
                </div>
                <div className="text-xs text-slate-300">
                  Circuito: {activeRoom.trackName} · Stato: {activeRoom.status}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                activeRoom.status === 'racing' ? onOpenRaces() : onOpenMultiplayer()
              }
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
            >
              Rientra nella Stanza
            </button>
          </div>
        )}

        {/* CORE 4 HOME MODES: Singolo · Multiplayer · Gare · Crea Circuito */}
        <section className="space-y-3 my-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Menu Principale — Seleziona Modalità
            </span>
            <span className="text-xs text-slate-400">
              Vettura attiva:{' '}
              <strong className="text-white">{activeCar.customName}</strong> (PI {specs.piIndex})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. SINGOLO (with 1-10 NPC Difficulty Scale) */}
            <div className="rounded-2xl border border-[#e10600]/45 bg-gradient-to-b from-[#231015] to-[#12161f] hover:border-[#e10600] p-6 flex flex-col justify-between gap-4 transition-all min-h-[220px]">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-[#e10600] text-white flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <span className="font-mono text-[11px] font-bold text-rose-300">
                  NPC Lv.{npcConfig.level}/10
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400 font-semibold">
                  Modalità Off-Line / IA 1–10
                </div>
                <h2 className="font-display text-2xl font-bold text-white">Singolo</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Scala i Rank (Bronzo → Unreal) battendo piloti NPC da livello 1 a 10 per premi più ricchi e nuove auto.
                </p>

                <div className="bg-[#0b0d11]/85 border border-white/10 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-semibold">
                      Piloti NPC: <span className="text-white">{npcConfig.label}</span>
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
                    aria-label="Livello Piloti NPC da 1 a 10"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-500">
                    <span>1 (Facile)</span>
                    <span>5 (Pro)</span>
                    <span>10 (Unreal)</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onStartSinglePlayer}
                className="w-full py-2 px-3 rounded-lg bg-[#e10600] hover:bg-[#ff1e17] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Avvia Gara Singola
              </button>
            </div>

            {/* 2. MULTIPLAYER */}
            <button
              type="button"
              onClick={onOpenMultiplayer}
              className="group text-left rounded-2xl border border-emerald-500/35 bg-gradient-to-b from-[#0e211b] to-[#12161f] hover:border-emerald-400 p-6 flex flex-col justify-between gap-6 cursor-pointer transition-all min-h-[220px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Globe className="w-6 h-6" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  Stanze Online Live
                </div>
                <h2 className="font-display text-2xl font-bold text-white">Multiplayer</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Crea o entra in una stanza con giocatori reali: scegli il ruolo di Pilota, Safety Car o Squadra Antincendio.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <Users className="w-3.5 h-3.5" />
                Apri Lobby Multiplayer
              </div>
            </button>

            {/* 3. GARE */}
            <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-b from-[#211a0f] to-[#12161f] hover:border-amber-400 p-6 flex flex-col justify-between gap-4 transition-all min-h-[220px]">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center">
                  <Flag className="w-6 h-6" />
                </div>
                <span className="font-mono text-[11px] text-amber-300 font-bold">
                  P1: {selectedTrack.prizePool.toLocaleString('it-IT')} CR
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  Gran Premi &amp; Circuiti
                </div>
                <h2 className="font-display text-2xl font-bold text-white">Gare</h2>
                <select
                  value={selectedTrack.id}
                  onChange={(e) => onSelectTrackId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#0b0d11] border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {allTracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.lengthKm} km · {t.laps} giri)
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={onOpenRaces}
                className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Vai alla Griglia di Gara
              </button>
            </div>

            {/* 4. CREA CIRCUITO */}
            <button
              type="button"
              onClick={() => onSelectTab('builder')}
              className="group text-left rounded-2xl border border-sky-500/35 bg-gradient-to-b from-[#0e1a29] to-[#12161f] hover:border-sky-400 p-6 flex flex-col justify-between gap-6 cursor-pointer transition-all min-h-[220px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center">
                  <Compass className="w-6 h-6" />
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                  Editor CAD FIA 3D
                </div>
                <h2 className="font-display text-2xl font-bold text-white">Crea Circuito</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Disegna curve realistiche, corsia box, paraboliche e dislivelli altimetrici per poi correrci subito in 3D.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300">
                <Compass className="w-3.5 h-3.5" />
                Apri Editor Tracciati
              </div>
            </button>
          </div>
        </section>

        {/* Bottom Paddock Strip: Officina, Pit Crew, Concessionaria, Mercato */}
        <footer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => onSelectTab('garage')}
            className="bg-[#12161f] hover:bg-[#171c28] border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer text-left transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Wrench className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Officina &amp; Motore</div>
                <div className="text-[11px] text-slate-400 font-mono truncate">
                  {specs.powerHp} CV · Integrità {Math.max(0, 100 - avgDamage)}%
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onGoToPitCrew}
            className="bg-[#12161f] hover:bg-[#171c28] border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer text-left transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Users className="w-5 h-5 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Gestione Pit Crew</div>
                <div className="text-[11px] text-slate-400 font-mono truncate">
                  Sosta {(pitStats.reactionDelaySec + pitStats.tireChangeTimeSec).toFixed(2)}s · {pitStats.pitStopTierLabel}
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('dealership')}
            className="bg-[#12161f] hover:bg-[#171c28] border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer text-left transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <CarFront className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Concessionaria</div>
                <div className="text-[11px] text-slate-400 truncate">
                  Acquista F3, GT3, F2, LMH e F1
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onOpenMarket}
            className="bg-[#12161f] hover:bg-[#171c28] border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer text-left transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ShoppingBag className="w-5 h-5 text-purple-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Mercato Componenti</div>
                <div className="text-[11px] text-slate-400 truncate">
                  Scambia parti uniche online
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
          </button>
        </footer>
      </div>
    </div>
  );
};
