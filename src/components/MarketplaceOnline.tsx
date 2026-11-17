import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CarFront,
  Check,
  Flame,
  HeartPulse,
  Plus,
  ShoppingBag,
  Siren,
  Tag,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { SLOT_LABELS } from '../data/catalog';
import {
  ComponentRarity,
  ComponentSlot,
  MarketListing,
  MultiplayerRoom,
  OwnedCar,
  RaceTeamRole,
  TrackDefinition,
  TradeOffer,
  UniqueComponent,
} from '../types/game';

interface MarketplaceOnlineProps {
  playerId: string;
  driverName: string;
  credits: number;
  wsConnected: boolean;
  inventory: UniqueComponent[];
  garage: OwnedCar[];
  listings: MarketListing[];
  trades: TradeOffer[];
  rooms: MultiplayerRoom[];
  activeRoom: MultiplayerRoom | null;
  preferredRole: RaceTeamRole;
  allTracks: TrackDefinition[];
  onChangeDriverName: (name: string) => void;
  onChangeRole: (role: RaceTeamRole) => void;
  onBuyListing: (listing: MarketListing) => Promise<void>;
  onListComponent: (component: UniqueComponent, price: number) => Promise<void>;
  onCancelListing: (listingId: string) => Promise<void>;
  onProposeTrade: (
    listing: MarketListing,
    offeredComponent: UniqueComponent,
    offeredCredits: number
  ) => Promise<string | null>;
  onRespondTrade: (trade: TradeOffer, accept: boolean) => Promise<void>;
  onCreateRoom: (roomName: string, track: TrackDefinition, laps: number) => void;
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
  onToggleReady: (ready: boolean) => void;
  onStartRoomRace: () => void;
  requestedSection?: 'market' | 'multiplayer';
}

const ROLE_LABELS: Record<RaceTeamRole, string> = {
  driver: 'Pilota Gara',
  safety_car: 'Safety Car',
  fire_team: 'Antincendio',
  medical_team: 'Emergenza Sanitaria',
  mechanic_team: 'Team Meccanici',
};

const RARITY_TEXT_COLOR: Record<ComponentRarity, string> = {
  Standard: 'text-slate-400',
  Prototipo: 'text-sky-400',
  Factory: 'text-amber-400',
  Leggendario: 'text-rose-400',
};

export const MarketplaceOnline: React.FC<MarketplaceOnlineProps> = ({
  playerId,
  driverName,
  credits,
  wsConnected,
  inventory,
  garage,
  listings,
  trades,
  rooms,
  activeRoom,
  preferredRole,
  allTracks,
  onChangeDriverName,
  onChangeRole,
  onBuyListing,
  onListComponent,
  onCancelListing,
  onProposeTrade,
  onRespondTrade,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleReady,
  onStartRoomRace,
  requestedSection,
}) => {
  const [section, setSection] = useState<'market' | 'multiplayer'>(requestedSection ?? 'market');
  const [slotFilter, setSlotFilter] = useState<ComponentSlot | 'ALL'>('ALL');
  const [rarityFilter, setRarityFilter] = useState<ComponentRarity | 'ALL'>('ALL');

  React.useEffect(() => {
    if (requestedSection) {
      setSection(requestedSection);
    }
  }, [requestedSection]);

  // Selling state
  const [sellPartId, setSellPartId] = useState<string>('');
  const [sellPrice, setSellPrice] = useState<number>(12000);
  const [marketNotice, setMarketNotice] = useState<string | null>(null);

  // Swap modal state
  const [swapTarget, setSwapTarget] = useState<MarketListing | null>(null);
  const [swapOfferPartId, setSwapOfferPartId] = useState<string>('');
  const [swapExtraCredits, setSwapExtraCredits] = useState<number>(0);

  // Multiplayer room creation state
  const [roomName, setRoomName] = useState(`Stanza GP di ${driverName}`);
  const [selectedTrackId, setSelectedTrackId] = useState(allTracks[0]?.id ?? '');
  const [roomLaps, setRoomLaps] = useState(3);

  const equippedIds = useMemo(() => {
    const set = new Set<string>();
    for (const car of garage) {
      for (const id of Object.values(car.installedParts)) {
        if (id) set.add(id);
      }
    }
    return set;
  }, [garage]);

  const unequippedInventory = useMemo(
    () => inventory.filter((p) => !equippedIds.has(p.id)),
    [inventory, equippedIds]
  );

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (slotFilter !== 'ALL' && l.component.slot !== slotFilter) return false;
      if (rarityFilter !== 'ALL' && l.component.rarity !== rarityFilter) return false;
      return true;
    });
  }, [listings, slotFilter, rarityFilter]);

  const incomingTrades = useMemo(() => {
    const myListingIds = new Set(
      listings.filter((l) => l.sellerId === playerId).map((l) => l.id)
    );
    return trades.filter(
      (t) => t.status === 'pending' && myListingIds.has(t.toListingId)
    );
  }, [trades, listings, playerId]);

  const myOutgoingTrades = useMemo(
    () => trades.filter((t) => t.fromPlayerId === playerId).slice(0, 6),
    [trades, playerId]
  );

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const part = unequippedInventory.find((p) => p.id === sellPartId);
    if (!part || sellPrice < 500) return;
    await onListComponent(part, sellPrice);
    setSellPartId('');
    setMarketNotice(`Componente ${part.serial} messo in vendita sul mercato.`);
  };

  const handleConfirmSwap = async () => {
    if (!swapTarget) return;
    const offerPart = unequippedInventory.find((p) => p.id === swapOfferPartId);
    if (!offerPart) return;
    if (swapExtraCredits > credits) {
      setMarketNotice('Crediti insufficienti per il conguaglio.');
      return;
    }
    const feedback = await onProposeTrade(swapTarget, offerPart, swapExtraCredits);
    setSwapTarget(null);
    setSwapOfferPartId('');
    setSwapExtraCredits(0);
    setMarketNotice(feedback || 'Proposta di scambio inviata.');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0b0d11] p-6">
      <div className="max-w-[1380px] mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">
              Paddock Online &amp; Mercato Componenti Unici
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Scambia pezzi serializzati con altri piloti o gareggia in stanze multiplayer sincronizzate in tempo reale.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-[#12161f] border border-white/10 rounded-md px-3 py-1.5 text-xs">
              <span className="text-slate-400">Pilota:</span>
              <input
                type="text"
                value={driverName}
                maxLength={22}
                onChange={(e) => onChangeDriverName(e.target.value)}
                className="bg-transparent text-white font-semibold w-32 focus:outline-none border-b border-transparent focus:border-[#e10600]"
              />
            </div>

            <div className="bg-[#12161f] border border-white/10 rounded-md px-3.5 py-1.5 text-xs font-mono tabular-nums">
              <span className="text-slate-400 mr-2">Budget:</span>
              <span className="text-amber-400 font-bold">
                {credits.toLocaleString('it-IT')} CR
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#12161f] border border-white/10 rounded-md">
              <button
                type="button"
                onClick={() => setSection('market')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  section === 'market'
                    ? 'bg-[#e10600] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Mercato Componenti
              </button>
              <button
                type="button"
                onClick={() => setSection('multiplayer')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  section === 'multiplayer'
                    ? 'bg-[#e10600] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Gare Multiplayer ({rooms.length})
              </button>
            </div>
          </div>
        </div>

        {marketNotice && (
          <div className="bg-[#12161f] border border-amber-500/40 rounded-md px-4 py-2.5 flex items-center justify-between text-xs text-amber-200">
            <span>{marketNotice}</span>
            <button
              type="button"
              onClick={() => setMarketNotice(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {section === 'market' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 8 cols: Live Marketplace Listings */}
            <div className="lg:col-span-8 space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#12161f] border border-white/10 rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      'ALL',
                      'engine_block',
                      'turbo_mgu',
                      'ecu',
                      'gearbox',
                      'brakes',
                      'aero_pack',
                      'suspension_kit',
                      'cooling_battery',
                      'differential_ers',
                    ] as const
                  ).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlotFilter(s)}
                      className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                        slotFilter === s
                          ? 'bg-[#e10600] text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s === 'ALL' ? 'Tutti i Reparti' : SLOT_LABELS[s].split(' / ')[0]}
                    </button>
                  ))}
                </div>
                <select
                  value={rarityFilter}
                  onChange={(e) => setRarityFilter(e.target.value as ComponentRarity | 'ALL')}
                  className="px-2.5 py-1 rounded bg-[#0b0d11] border border-white/10 text-xs text-white focus:outline-none"
                >
                  <option value="ALL">Tutte le Rarità</option>
                  <option value="Prototipo">Prototipo</option>
                  <option value="Factory">Factory</option>
                  <option value="Leggendario">Leggendario</option>
                </select>
              </div>

              {/* Listings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredListings.map((listing) => {
                  const comp = listing.component;
                  const isMine = listing.sellerId === playerId;
                  const canBuy = !isMine && credits >= listing.price;

                  return (
                    <div
                      key={listing.id}
                      className="bg-[#12161f] border border-white/10 rounded-lg p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-semibold ${RARITY_TEXT_COLOR[comp.rarity]}`}>
                            {comp.rarity} · {SLOT_LABELS[comp.slot]}
                          </span>
                          <span className="font-mono text-slate-400">{comp.serial}</span>
                        </div>
                        <h3 className="font-display text-base font-bold text-white">
                          {comp.name}
                        </h3>
                        <p className="text-[11px] text-slate-400">{comp.originNote}</p>

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono text-emerald-400 tabular-nums pt-1">
                          {comp.stats.powerDelta !== 0 && <span>+{comp.stats.powerDelta} CV</span>}
                          {comp.stats.torqueDelta !== 0 && <span>+{comp.stats.torqueDelta} Nm</span>}
                          {comp.stats.gripDelta !== 0 && <span>+{comp.stats.gripDelta}% Grip</span>}
                          {comp.stats.aeroDelta !== 0 && <span>+{comp.stats.aeroDelta}% Aero</span>}
                          {comp.stats.weightDelta !== 0 && <span>{comp.stats.weightDelta} kg</span>}
                          <span className="text-slate-400">Stato {comp.condition}%</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-slate-400">
                            Venditore: {isMine ? 'Tu' : listing.sellerName}
                          </div>
                          <div className="font-mono text-base font-bold text-amber-400 tabular-nums">
                            {listing.price.toLocaleString('it-IT')} CR
                          </div>
                        </div>

                        {isMine ? (
                          <button
                            type="button"
                            onClick={() => onCancelListing(listing.id)}
                            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-xs font-medium text-white cursor-pointer"
                          >
                            Ritira
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={unequippedInventory.length === 0}
                              onClick={() => {
                                setSwapTarget(listing);
                                setSwapOfferPartId(unequippedInventory[0]?.id ?? '');
                                setSwapExtraCredits(0);
                              }}
                              title={
                                unequippedInventory.length === 0
                                  ? 'Serve almeno un componente smontato in inventario per proporre uno scambio'
                                  : 'Proponi scambio componente'
                              }
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/15 disabled:opacity-40 text-xs font-medium text-white cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              Scambia
                            </button>
                            <button
                              type="button"
                              disabled={!canBuy}
                              onClick={() => onBuyListing(listing)}
                              className="px-3.5 py-1.5 rounded bg-[#e10600] hover:bg-[#ff1e17] disabled:bg-white/10 disabled:text-slate-500 text-xs font-semibold text-white cursor-pointer"
                            >
                              Acquista
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 4 cols: Sell Your Component & Trade Offers */}
            <div className="lg:col-span-4 space-y-5">
              {/* List Component Form */}
              <form
                onSubmit={handleSellSubmit}
                className="bg-[#12161f] border border-white/10 rounded-lg p-5 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#e10600]" />
                  <h2 className="font-display text-base font-bold text-white">
                    Vendi un Tuo Componente Unico
                  </h2>
                </div>
                <p className="text-xs text-slate-400">
                  Puoi mettere in vendita o offrire in scambio qualsiasi componente smontato dal tuo inventario ({unequippedInventory.length} disponibili).
                </p>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Seleziona Componente
                  </label>
                  <select
                    value={sellPartId}
                    onChange={(e) => setSellPartId(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0b0d11] border border-white/10 text-xs text-white focus:outline-none"
                  >
                    <option value="">-- Scegli dall’inventario --</option>
                    {unequippedInventory.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.serial}) [{p.rarity}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Prezzo Richiesto (CR)
                  </label>
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={sellPrice}
                    onChange={(e) => setSellPrice(Math.max(500, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded bg-[#0b0d11] border border-white/10 text-xs font-mono text-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!sellPartId}
                  className="w-full py-2 px-4 rounded bg-[#e10600] hover:bg-[#ff1e17] disabled:bg-white/10 disabled:text-slate-500 text-xs font-semibold text-white cursor-pointer"
                >
                  Pubblica sul Mercato
                </button>
              </form>

              {/* Incoming Player Trade Offers */}
              <div className="bg-[#12161f] border border-white/10 rounded-lg p-5 space-y-3">
                <h3 className="font-display text-sm font-bold text-white">
                  Proposte di Scambio Ricevute ({incomingTrades.length})
                </h3>
                {incomingTrades.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Nessuna proposta attiva sulle tue inserzioni.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {incomingTrades.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded bg-[#0b0d11] border border-white/10 space-y-2 text-xs"
                      >
                        <div className="text-slate-300">
                          <span className="font-semibold text-white">{t.fromPlayerName}</span> offre{' '}
                          <span className="text-sky-400 font-semibold">{t.offeredComponent.name}</span>
                          {t.offeredCredits > 0 && ` + ${t.offeredCredits.toLocaleString('it-IT')} CR`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Per il tuo: {t.targetComponent.name} ({t.targetComponent.serial})
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onRespondTrade(t, true)}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Accetta
                          </button>
                          <button
                            type="button"
                            onClick={() => onRespondTrade(t, false)}
                            className="flex-1 py-1.5 rounded bg-white/10 hover:bg-white/15 text-slate-200 font-medium cursor-pointer"
                          >
                            Rifiuta
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing Trade Log */}
              {myOutgoingTrades.length > 0 && (
                <div className="bg-[#12161f] border border-white/10 rounded-lg p-5 space-y-2">
                  <h3 className="font-display text-sm font-bold text-white">
                    Le Tue Proposte Inviate
                  </h3>
                  {myOutgoingTrades.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0"
                    >
                      <span className="truncate text-slate-300 mr-2">
                        {t.targetComponent.name}
                      </span>
                      <span
                        className={`font-mono shrink-0 ${
                          t.status === 'accepted'
                            ? 'text-emerald-400'
                            : t.status === 'declined'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {t.status === 'accepted'
                          ? 'Accettato'
                          : t.status === 'declined'
                          ? 'Rifiutato'
                          : 'In attesa'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Multiplayer Online Lobby Section */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 bg-[#12161f] border border-white/10 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-white">
                  Crea Stanza Multiplayer
                </h2>
                <span
                  className={`text-xs font-medium ${
                    wsConnected ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {wsConnected ? 'Server Connesso' : 'Connessione...'}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nome Stanza</label>
                  <input
                    type="text"
                    value={roomName}
                    maxLength={40}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0b0d11] border border-white/10 text-sm text-white focus:outline-none focus:border-[#e10600]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Circuito (inclusi i tuoi disegni!)
                  </label>
                  <select
                    value={selectedTrackId}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0b0d11] border border-white/10 text-sm text-white focus:outline-none focus:border-[#e10600]"
                  >
                    {allTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.lengthKm} km · {t.isCustom ? 'Personale' : 'Ufficiale'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Numero di Giri ({roomLaps})
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={roomLaps}
                    onChange={(e) => setRoomLaps(Number(e.target.value))}
                    className="w-full accent-[#e10600]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">
                    Il Tuo Ruolo in Pista
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(
                      [
                        ['driver', 'Pilota', CarFront],
                        ['safety_car', 'Safety Car', Siren],
                        ['fire_team', 'Antincendio', Flame],
                        ['medical_team', 'Sanitaria 118', HeartPulse],
                        ['mechanic_team', 'Meccanici', Wrench],
                      ] as const
                    ).map(([rId, label, Icon]) => (
                      <button
                        key={rId}
                        type="button"
                        onClick={() => onChangeRole(rId)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded text-xs font-semibold border cursor-pointer transition-colors ${
                          preferredRole === rId
                            ? 'bg-[#e10600] border-[#ff3b30] text-white'
                            : 'bg-[#0b0d11] border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Se nessun giocatore sceglie Safety Car, Antincendio, Emergenza Sanitaria o Meccanici, entrano in pista i team NPC automatici.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!wsConnected || Boolean(activeRoom)}
                  onClick={() => {
                    const tr = allTracks.find((t) => t.id === selectedTrackId) ?? allTracks[0];
                    if (tr) onCreateRoom(roomName, tr, roomLaps);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-[#e10600] hover:bg-[#ff1e17] disabled:bg-white/10 disabled:text-slate-500 text-xs font-semibold text-white cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Apri Stanza Online
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-5">
              {/* Active Room Panel */}
              {activeRoom && (
                <div className="bg-[#12161f] border border-[#e10600]/60 rounded-lg p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[#e10600] font-semibold">
                        Stanza Attiva · {activeRoom.trackName}
                      </div>
                      <h3 className="font-display text-lg font-bold text-white">
                        {activeRoom.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={onLeaveRoom}
                      className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-xs text-white cursor-pointer"
                    >
                      Esci dalla Stanza
                    </button>
                  </div>

                  {/* Team Coverage Status (NPC vs Real Human Teams) */}
                  {(() => {
                    const humanSc = activeRoom.players.filter((p) => p.role === 'safety_car').length;
                    const humanFire = activeRoom.players.filter((p) => p.role === 'fire_team').length;
                    const humanMed = activeRoom.players.filter((p) => p.role === 'medical_team').length;
                    const humanMech = activeRoom.players.filter((p) => p.role === 'mechanic_team').length;
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded bg-[#0b0d11] border border-white/10 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <Siren className="w-3.5 h-3.5 text-amber-400" />
                            Safety Car
                          </span>
                          <span className={`font-semibold ${humanSc > 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                            {humanSc > 0 ? `${humanSc} Reale (NPC Off)` : 'NPC'}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-[#0b0d11] border border-white/10 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <Flame className="w-3.5 h-3.5 text-orange-400" />
                            Antincendio
                          </span>
                          <span className={`font-semibold ${humanFire > 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                            {humanFire > 0 ? `${humanFire} Reale (NPC Off)` : 'NPC'}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-[#0b0d11] border border-white/10 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <HeartPulse className="w-3.5 h-3.5 text-lime-400" />
                            Emergenza Sanitaria
                          </span>
                          <span className={`font-semibold ${humanMed > 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                            {humanMed > 0 ? `${humanMed} Reale (NPC Off)` : 'NPC'}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-[#0b0d11] border border-white/10 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <Wrench className="w-3.5 h-3.5 text-sky-400" />
                            Team Meccanici
                          </span>
                          <span className={`font-semibold ${humanMech > 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                            {humanMech > 0 ? `${humanMech} Reale (NPC Off)` : 'NPC'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Change My Role Inside Active Waiting Room */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-[#0b0d11] border border-white/10 text-xs">
                    <span className="text-slate-400">Cambia team:</span>
                    <div className="flex flex-wrap items-center gap-1">
                      {(['driver', 'safety_car', 'fire_team', 'medical_team', 'mechanic_team'] as const).map((rId) => {
                        const myRole =
                          activeRoom.players.find((p) => p.playerId === playerId)?.role ??
                          preferredRole;
                        return (
                          <button
                            key={rId}
                            type="button"
                            onClick={() => onChangeRole(rId)}
                            className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                              myRole === rId
                                ? 'bg-[#e10600] text-white'
                                : 'bg-white/10 text-slate-300 hover:text-white'
                            }`}
                          >
                            {ROLE_LABELS[rId]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {activeRoom.players.map((pl) => (
                      <div
                        key={pl.playerId}
                        className="flex items-center justify-between p-2.5 rounded bg-[#0b0d11] border border-white/5 text-xs"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: pl.primaryColor }}
                          />
                          <span className="font-semibold text-white">
                            {pl.playerName} (#{pl.raceNumber})
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pl.role === 'safety_car'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : pl.role === 'fire_team'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {ROLE_LABELS[pl.role || 'driver']}
                          </span>
                          {pl.role === 'driver' && (
                            <span className="text-slate-400">
                              {pl.carName} · PI {pl.piIndex}
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-semibold ${
                            pl.ready ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {pl.ready ? 'Pronto' : 'In preparazione'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    {activeRoom.hostId === playerId ? (
                      <button
                        type="button"
                        onClick={onStartRoomRace}
                        className="flex-1 py-2.5 px-4 rounded bg-[#e10600] hover:bg-[#ff1e17] text-xs font-semibold text-white cursor-pointer"
                      >
                        Avvia Gara Online per Tutti
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const me = activeRoom.players.find((p) => p.playerId === playerId);
                          onToggleReady(!me?.ready);
                        }}
                        className="flex-1 py-2.5 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white cursor-pointer"
                      >
                        Segna Pronto / Non Pronto
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Available Rooms List */}
              <div className="bg-[#12161f] border border-white/10 rounded-lg p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-white">
                  Stanze Aperte sul Server ({rooms.length})
                </h2>
                {rooms.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">
                    Nessuna stanza multiplayer attiva al momento. Creane una qui a sinistra per invitare altri piloti o aprire un altro browser per testare il multiplayer dal vivo!
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {rooms.map((rm) => (
                      <div
                        key={rm.id}
                        className="flex items-center justify-between p-3 rounded bg-[#0b0d11] border border-white/10"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white">{rm.name}</div>
                          <div className="text-xs text-slate-400">
                            Host: {rm.hostName} · {rm.trackName} · {rm.laps} giri ·{' '}
                            {rm.players.length} piloti
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={rm.status !== 'waiting' || activeRoom?.id === rm.id}
                          onClick={() => onJoinRoom(rm.id)}
                          className="px-3.5 py-1.5 rounded bg-[#e10600] hover:bg-[#ff1e17] disabled:bg-white/10 disabled:text-slate-500 text-xs font-semibold text-white cursor-pointer"
                        >
                          {activeRoom?.id === rm.id
                            ? 'Dentro'
                            : rm.status === 'waiting'
                            ? 'Entra'
                            : 'In Corsa'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Component Swap Modal */}
      {swapTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#12161f] border border-white/15 rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white">
                Proponi Scambio Componente
              </h3>
              <button
                type="button"
                onClick={() => setSwapTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded bg-[#0b0d11] border border-white/10 text-xs space-y-1">
              <div className="text-slate-400">Richiedi:</div>
              <div className="font-semibold text-white">
                {swapTarget.component.name} ({swapTarget.component.serial})
              </div>
              <div className="text-amber-400 font-mono">
                Valore stimato: {swapTarget.price.toLocaleString('it-IT')} CR
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Offri dal tuo Inventario
              </label>
              <select
                value={swapOfferPartId}
                onChange={(e) => setSwapOfferPartId(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0b0d11] border border-white/10 text-xs text-white focus:outline-none"
              >
                {unequippedInventory.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.rarity}] ({p.serial})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Conguaglio Aggiuntivo (CR)
              </label>
              <input
                type="number"
                min={0}
                max={credits}
                step={500}
                value={swapExtraCredits}
                onChange={(e) => setSwapExtraCredits(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded bg-[#0b0d11] border border-white/10 text-xs font-mono text-white focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSwapTarget(null)}
                className="flex-1 py-2 rounded bg-white/10 hover:bg-white/15 text-xs text-white cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={!swapOfferPartId}
                onClick={handleConfirmSwap}
                className="flex-1 py-2 rounded bg-[#e10600] hover:bg-[#ff1e17] text-xs font-semibold text-white cursor-pointer"
              >
                Invia Proposta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
