import { useEffect, useMemo, useRef, useState } from 'react';
import { Dealership } from './components/Dealership';
import { GarageWorkshop } from './components/GarageWorkshop';
import { HomeHub } from './components/HomeHub';
import { MarketplaceOnline } from './components/MarketplaceOnline';
import { RaceViewport } from './components/RaceViewport';
import { TopNav } from './components/TopNav';
import { TrackBuilder } from './components/TrackBuilder';
import {
  CAR_CATALOG,
  computeCarSpecs,
  createOwnedCar,
  EMPTY_DAMAGE,
  ENGINE_ARCHITECTURES,
  getNextRank,
  getRankForPoints,
  instantiateShopComponent,
  isRankUnlocked,
  MAX_PIT_CREW_LEVEL,
  RANK_LADDER,
} from './data/catalog';
import {
  getAllAvailableTracks,
  getInitialSaveState,
  LocalSaveState,
  persistSaveState,
} from './services/localPersistence';
import { PaddockSocketClient } from './services/paddockSocket';
import {
  AppTab,
  CarModel,
  ComponentShopItem,
  DamageState,
  FireToolType,
  MarketListing,
  MultiplayerRoom,
  OwnedCar,
  PitCrewRoleKey,
  RaceTeamRole,
  RemoteRacerTelemetry,
  TeamAssistType,
  TrackDefinition,
  TradeOffer,
  UniqueComponent,
} from './types/game';

export default function App() {
  const [save, setSave] = useState<LocalSaveState>(() => getInitialSaveState());
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [garageSubTab, setGarageSubTab] = useState<'engine' | 'aero' | 'livery' | 'parts' | 'pitcrew'>('engine');
  const [marketSection, setMarketSection] = useState<'market' | 'multiplayer'>('market');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('monza_velox');
  const [npcLevel, setNpcLevel] = useState<number>(5);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Server-backed live paddock state
  const [wsConnected, setWsConnected] = useState(false);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [trades, setTrades] = useState<TradeOffer[]>([]);
  const [communityTracks, setCommunityTracks] = useState<TrackDefinition[]>([]);
  const [rooms, setRooms] = useState<MultiplayerRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<MultiplayerRoom | null>(null);
  const [preferredRole, setPreferredRole] = useState<RaceTeamRole>('driver');

  const remoteTelemetryRef = useRef<Map<string, RemoteRacerTelemetry>>(new Map());
  const incomingFireHelpRef = useRef<{
    fromPlayerName: string;
    tool: FireToolType;
  } | null>(null);
  const incomingTeamAssistRef = useRef<{
    fromPlayerName: string;
    assistType: TeamAssistType;
  } | null>(null);
  const socketRef = useRef<PaddockSocketClient | null>(null);

  // Persist save changes to localStorage
  useEffect(() => {
    persistSaveState(save);
  }, [save]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore if iframe restricts Fullscreen API
    }
  };

  const activeCar = useMemo(
    () => save.garage.find((c) => c.instanceId === save.activeCarId) ?? save.garage[0],
    [save.garage, save.activeCarId]
  );

  const activeModel = useMemo(
    () => CAR_CATALOG.find((m) => m.id === activeCar.modelId) ?? CAR_CATALOG[0],
    [activeCar.modelId]
  );

  const activeSpecs = useMemo(
    () => computeCarSpecs(activeModel, activeCar, save.inventory),
    [activeModel, activeCar, save.inventory]
  );

  const allTracks = useMemo(
    () => getAllAvailableTracks(save.customTracks, communityTracks),
    [save.customTracks, communityTracks]
  );

  const playerRank = useMemo(
    () => getRankForPoints(save.profile.rankPoints),
    [save.profile.rankPoints]
  );
  const nextRank = useMemo(
    () => getNextRank(save.profile.rankPoints),
    [save.profile.rankPoints]
  );

  // Initial REST fetch + WebSocket subscription
  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then((data) => {
        if (data.listings) setListings(data.listings);
        if (data.trades) setTrades(data.trades);
        if (data.communityTracks) setCommunityTracks(data.communityTracks);
        if (data.rooms) setRooms(data.rooms);
      })
      .catch(() => {
        // Server will sync on reconnect
      });

    const client = new PaddockSocketClient({
      onConnectedChange: setWsConnected,
      onMarketUpdated: (nextListings) => setListings(nextListings),
      onMarketSold: (payload) => {
        setListings(payload.listings);
        setTrades(payload.trades);
        if (payload.sellerId === save.profile.playerId) {
          setSave((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              credits: prev.profile.credits + payload.price,
            },
          }));
        }
      },
      onTradeUpdated: (nextTrades) => setTrades(nextTrades),
      onTradeCompleted: (payload) => {
        setListings(payload.listings);
        setTrades(payload.trades);
        if (payload.trade.fromPlayerId === save.profile.playerId) {
          setSave((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              credits: Math.max(0, prev.profile.credits - payload.trade.offeredCredits),
            },
            inventory: [
              payload.buyerReceivedComponent,
              ...prev.inventory.filter((p) => p.id !== payload.trade.offeredComponent.id),
            ],
          }));
        }
      },
      onTracksUpdated: (nextTracks) => setCommunityTracks(nextTracks),
      onRoomsList: (nextRooms) => setRooms(nextRooms),
      onRoomState: (room) => setActiveRoom(room),
      onRoomStarted: (room) => {
        remoteTelemetryRef.current.clear();
        setActiveRoom(room);
        setActiveTab('race');
      },
      onTelemetry: (tele) => {
        remoteTelemetryRef.current.set(tele.playerId, tele);
      },
      onFireExtinguish: (payload) => {
        if (payload.targetId === save.profile.playerId) {
          incomingFireHelpRef.current = {
            fromPlayerName: payload.fromPlayerName,
            tool: payload.tool,
          };
        }
      },
      onTeamAssist: (payload) => {
        if (payload.targetId === save.profile.playerId) {
          incomingTeamAssistRef.current = {
            fromPlayerName: payload.fromPlayerName,
            assistType: payload.assistType,
          };
        }
      },
    });
    socketRef.current = client;

    return () => {
      client.dispose();
    };
  }, []);

  // Keep socket callbacks fresh with current playerId
  useEffect(() => {
    socketRef.current?.updateCallbacks({
      onConnectedChange: setWsConnected,
      onMarketUpdated: (nextListings) => setListings(nextListings),
      onMarketSold: (payload) => {
        setListings(payload.listings);
        setTrades(payload.trades);
        if (payload.sellerId === save.profile.playerId) {
          setSave((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              credits: prev.profile.credits + payload.price,
            },
          }));
        }
      },
      onTradeUpdated: (nextTrades) => setTrades(nextTrades),
      onTradeCompleted: (payload) => {
        setListings(payload.listings);
        setTrades(payload.trades);
        if (payload.trade.fromPlayerId === save.profile.playerId) {
          setSave((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              credits: Math.max(0, prev.profile.credits - payload.trade.offeredCredits),
            },
            inventory: [
              payload.buyerReceivedComponent,
              ...prev.inventory.filter((p) => p.id !== payload.trade.offeredComponent.id),
            ],
          }));
        }
      },
      onTracksUpdated: (nextTracks) => setCommunityTracks(nextTracks),
      onRoomsList: (nextRooms) => setRooms(nextRooms),
      onRoomState: (room) => setActiveRoom(room),
      onRoomStarted: (room) => {
        remoteTelemetryRef.current.clear();
        setActiveRoom(room);
        setActiveTab('race');
      },
      onTelemetry: (tele) => {
        remoteTelemetryRef.current.set(tele.playerId, tele);
      },
      onFireExtinguish: (payload) => {
        if (payload.targetId === save.profile.playerId) {
          incomingFireHelpRef.current = {
            fromPlayerName: payload.fromPlayerName,
            tool: payload.tool,
          };
        }
      },
      onTeamAssist: (payload) => {
        if (payload.targetId === save.profile.playerId) {
          incomingTeamAssistRef.current = {
            fromPlayerName: payload.fromPlayerName,
            assistType: payload.assistType,
          };
        }
      },
    });
  }, [save.profile.playerId]);

  const handleSaveTrackAndRace = (track: TrackDefinition) => {
    setSave((prev) => {
      const exists = prev.customTracks.some((t) => t.id === track.id);
      return {
        ...prev,
        customTracks: exists ? prev.customTracks : [track, ...prev.customTracks],
      };
    });
    setSelectedTrackId(track.id);
    setActiveRoom(null);
    setActiveTab('race');
  };

  const handleSaveTrackOnly = (track: TrackDefinition) => {
    setSave((prev) => ({
      ...prev,
      customTracks: [track, ...prev.customTracks],
    }));
  };

  const handlePublishTrackOnline = async (track: TrackDefinition) => {
    handleSaveTrackOnly(track);
    await fetch('/api/tracks/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(track),
    });
  };

  const handleDeleteCustomTrack = (id: string) => {
    setSave((prev) => ({
      ...prev,
      customTracks: prev.customTracks.filter((t) => t.id !== id),
    }));
    if (selectedTrackId === id) {
      setSelectedTrackId('monza_velox');
    }
  };

  const handleUpdateCar = (updated: OwnedCar) => {
    setSave((prev) => ({
      ...prev,
      garage: prev.garage.map((c) => (c.instanceId === updated.instanceId ? updated : c)),
    }));
  };

  const handleRepairCar = (instanceId: string, cost: number) => {
    setSave((prev) => {
      if (prev.profile.credits < cost) return prev;
      return {
        ...prev,
        profile: { ...prev.profile, credits: prev.profile.credits - cost },
        garage: prev.garage.map((c) =>
          c.instanceId === instanceId ? { ...c, damage: { ...EMPTY_DAMAGE } } : c
        ),
      };
    });
  };

  const handleDeductCredits = (amount: number): number => {
    if (amount <= 0) return 0;
    let charged = 0;
    setSave((prev) => {
      charged = Math.min(prev.profile.credits, Math.round(amount));
      return {
        ...prev,
        profile: {
          ...prev.profile,
          credits: Math.max(0, prev.profile.credits - charged),
        },
      };
    });
    return charged;
  };

  const handleUpgradePitCrew = (role: PitCrewRoleKey, cost: number) => {
    setSave((prev) => {
      const current = prev.pitCrew[role] || 1;
      if (current >= MAX_PIT_CREW_LEVEL || prev.profile.credits < cost) return prev;
      return {
        ...prev,
        profile: { ...prev.profile, credits: prev.profile.credits - cost },
        pitCrew: {
          ...prev.pitCrew,
          [role]: current + 1,
        },
      };
    });
  };

  const handleBuyComponent = (item: ComponentShopItem, autoEquipCarId?: string) => {
    setSave((prev) => {
      if (prev.profile.credits < item.price) return prev;
      const newPart = instantiateShopComponent(
        item,
        prev.profile.playerId,
        prev.profile.driverName
      );
      return {
        ...prev,
        profile: { ...prev.profile, credits: prev.profile.credits - item.price },
        inventory: [newPart, ...prev.inventory],
        garage: autoEquipCarId
          ? prev.garage.map((c) =>
              c.instanceId === autoEquipCarId
                ? {
                    ...c,
                    installedParts: {
                      ...c.installedParts,
                      [item.slot]: newPart.id,
                    },
                  }
                : c
            )
          : prev.garage,
      };
    });
  };

  const handleBuyCar = (model: CarModel) => {
    let bought = false;
    setSave((prev) => {
      const currentRank = getRankForPoints(prev.profile.rankPoints);
      if (
        !isRankUnlocked(currentRank.id, model.requiredRank) ||
        prev.profile.credits < model.price
      ) {
        return prev;
      }
      bought = true;
      const newCar = createOwnedCar(
        model.id,
        `car_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`
      );
      return {
        ...prev,
        profile: { ...prev.profile, credits: prev.profile.credits - model.price },
        garage: [...prev.garage, newCar],
        activeCarId: newCar.instanceId,
      };
    });
    if (bought) {
      setActiveTab('garage');
    }
  };

  const handleRaceFinished = (result: {
    carInstanceId: string;
    finalDamage: DamageState;
    distanceKm: number;
    won: boolean;
    netCredits: number;
    rpEarned: number;
    bestLapMs: number | null;
    droppedComponent: UniqueComponent | null;
  }) => {
    setSave((prev) => {
      const newRp = prev.profile.rankPoints + (result.rpEarned || 0);
      const claimed = prev.profile.claimedRankRewards || ['bronzo'];
      const newlyReached = RANK_LADDER.filter(
        (r) => newRp >= r.minPoints && !claimed.includes(r.id)
      );
      const rankPromoBonus = newlyReached.reduce((sum, r) => sum + r.promotionBonusCr, 0);
      const nextClaimed =
        newlyReached.length > 0
          ? [...claimed, ...newlyReached.map((r) => r.id)]
          : claimed;

      return {
        ...prev,
        profile: {
          ...prev.profile,
          credits: prev.profile.credits + result.netCredits + rankPromoBonus,
          wins: prev.profile.wins + (result.won ? 1 : 0),
          racesCompleted: prev.profile.racesCompleted + 1,
          rankPoints: newRp,
          claimedRankRewards: nextClaimed,
          bestLapRecordMs:
            result.bestLapMs &&
            (prev.profile.bestLapRecordMs === null ||
              result.bestLapMs < prev.profile.bestLapRecordMs)
              ? result.bestLapMs
              : prev.profile.bestLapRecordMs,
        },
        garage: prev.garage.map((c) =>
          c.instanceId === result.carInstanceId
            ? {
                ...c,
                damage: result.finalDamage,
                mileageKm: c.mileageKm + result.distanceKm,
                wins: c.wins + (result.won ? 1 : 0),
              }
            : c
        ),
        inventory: result.droppedComponent
          ? [result.droppedComponent, ...prev.inventory]
          : prev.inventory,
      };
    });
  };

  // Marketplace Handlers
  const handleBuyListing = async (listing: MarketListing) => {
    if (save.profile.credits < listing.price) return;
    const res = await fetch('/api/market/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId: listing.id,
        buyerId: save.profile.playerId,
        buyerName: save.profile.driverName,
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { component: UniqueComponent; price: number };
    setSave((prev) => ({
      ...prev,
      profile: { ...prev.profile, credits: prev.profile.credits - data.price },
      inventory: [data.component, ...prev.inventory],
    }));
  };

  const handleListComponent = async (component: UniqueComponent, price: number) => {
    const res = await fetch('/api/market/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component,
        sellerId: save.profile.playerId,
        sellerName: save.profile.driverName,
        price,
      }),
    });
    if (!res.ok) return;
    setSave((prev) => ({
      ...prev,
      inventory: prev.inventory.filter((p) => p.id !== component.id),
    }));
  };

  const handleCancelListing = async (listingId: string) => {
    const res = await fetch('/api/market/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId,
        sellerId: save.profile.playerId,
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { component: UniqueComponent };
    setSave((prev) => ({
      ...prev,
      inventory: [data.component, ...prev.inventory],
    }));
  };

  const handleProposeTrade = async (
    listing: MarketListing,
    offeredComponent: UniqueComponent,
    offeredCredits: number
  ): Promise<string | null> => {
    const res = await fetch('/api/trades/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromPlayerId: save.profile.playerId,
        fromPlayerName: save.profile.driverName,
        toListingId: listing.id,
        offeredComponent,
        offeredCredits,
      }),
    });
    const data = await res.json();
    if (!res.ok) return data.error || 'Errore nella proposta.';

    if (data.autoAccepted && data.receivedComponent) {
      setSave((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          credits: Math.max(0, prev.profile.credits - offeredCredits),
        },
        inventory: [
          data.receivedComponent,
          ...prev.inventory.filter((p) => p.id !== offeredComponent.id),
        ],
      }));
      return `Scambio accettato dal costruttore! Hai ottenuto ${data.receivedComponent.name}.`;
    }
    if (data.reason) {
      return data.reason;
    }
    return 'Proposta di scambio inviata al pilota online.';
  };

  const handleRespondTrade = async (trade: TradeOffer, accept: boolean) => {
    const res = await fetch('/api/trades/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId: trade.id,
        sellerId: save.profile.playerId,
        accept,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (accept && data.receivedComponent) {
      setSave((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          credits: prev.profile.credits + trade.offeredCredits,
        },
        inventory: [data.receivedComponent, ...prev.inventory],
      }));
    }
  };

  // Multiplayer Room Handlers
  const buildPlayerInfo = (roleOverride?: RaceTeamRole) => ({
    playerId: save.profile.playerId,
    playerName: save.profile.driverName,
    role: roleOverride ?? preferredRole,
    carName: activeCar.customName,
    carClass: activeModel.carClass,
    bodyStyle: activeModel.bodyStyle,
    powertrainType:
      ENGINE_ARCHITECTURES[activeCar.tuning.engineArch]?.powertrainType ??
      activeModel.powertrainType,
    primaryColor: activeCar.tuning.primaryColor,
    secondaryColor: activeCar.tuning.secondaryColor,
    raceNumber: activeCar.tuning.raceNumber,
    ready: false,
    piIndex: activeSpecs.piIndex,
  });

  const handleChangeTeamRole = (role: RaceTeamRole) => {
    setPreferredRole(role);
    if (activeRoom && activeRoom.status === 'waiting') {
      socketRef.current?.send({
        type: 'room:role',
        playerId: save.profile.playerId,
        role,
      });
    }
  };

  const handleCreateRoom = (roomName: string, track: TrackDefinition, laps: number) => {
    socketRef.current?.send({
      type: 'room:create',
      playerId: save.profile.playerId,
      roomName,
      track,
      laps,
      player: buildPlayerInfo(),
    });
  };

  const handleJoinRoom = (roomId: string) => {
    socketRef.current?.send({
      type: 'room:join',
      playerId: save.profile.playerId,
      roomId,
      player: buildPlayerInfo(),
    });
  };

  const handleLeaveRoom = () => {
    socketRef.current?.send({
      type: 'room:leave',
      playerId: save.profile.playerId,
    });
    setActiveRoom(null);
  };

  const handleToggleReady = (ready: boolean) => {
    socketRef.current?.send({
      type: 'room:ready',
      playerId: save.profile.playerId,
      ready,
    });
  };

  const handleStartRoomRace = () => {
    socketRef.current?.send({
      type: 'room:start',
      playerId: save.profile.playerId,
    });
  };

  const isFullscreenViewport = activeTab === 'home' || activeTab === 'race';

  return (
    <div className="h-[100dvh] w-screen flex flex-col overflow-hidden bg-[#0b0d11] text-[#f4f5f7]">
      {!isFullscreenViewport && (
        <TopNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onQuickRace={() => setActiveTab('race')}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {activeTab === 'home' && (
        <HomeHub
          profile={save.profile}
          playerRank={playerRank}
          nextRank={nextRank}
          npcLevel={npcLevel}
          onChangeNpcLevel={setNpcLevel}
          activeCar={activeCar}
          inventory={save.inventory}
          pitCrew={save.pitCrew}
          allTracks={allTracks}
          selectedTrackId={selectedTrackId}
          onSelectTrackId={setSelectedTrackId}
          activeRoom={activeRoom}
          wsConnected={wsConnected}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onStartSinglePlayer={() => {
            if (activeRoom) {
              handleLeaveRoom();
            }
            setActiveTab('race');
          }}
          onOpenRaces={() => setActiveTab('race')}
          onOpenMultiplayer={() => {
            setMarketSection('multiplayer');
            setActiveTab('marketplace');
          }}
          onOpenMarket={() => {
            setMarketSection('market');
            setActiveTab('marketplace');
          }}
          onSelectTab={setActiveTab}
          onGoToPitCrew={() => {
            setGarageSubTab('pitcrew');
            setActiveTab('garage');
          }}
        />
      )}

      {activeTab === 'race' && (
        <RaceViewport
          playerId={save.profile.playerId}
          driverName={save.profile.driverName}
          credits={save.profile.credits}
          playerRank={playerRank}
          playerRankPoints={save.profile.rankPoints}
          claimedRankRewards={save.profile.claimedRankRewards}
          npcLevel={npcLevel}
          onChangeNpcLevel={setNpcLevel}
          activeCar={activeCar}
          inventory={save.inventory}
          pitCrew={save.pitCrew}
          allTracks={allTracks}
          selectedTrackId={selectedTrackId}
          onSelectTrackId={setSelectedTrackId}
          activeRoom={activeRoom}
          preferredRole={preferredRole}
          onChangeRole={handleChangeTeamRole}
          remoteTelemetryRef={remoteTelemetryRef}
          incomingFireHelpRef={incomingFireHelpRef}
          incomingTeamAssistRef={incomingTeamAssistRef}
          onSendTelemetry={(telemetry) =>
            socketRef.current?.send({
              type: 'race:telemetry',
              playerId: save.profile.playerId,
              telemetry,
            })
          }
          onSendFireExtinguish={(targetId, tool) =>
            socketRef.current?.send({
              type: 'race:fire_extinguish',
              playerId: save.profile.playerId,
              fromPlayerName: save.profile.driverName,
              targetId,
              tool,
            })
          }
          onSendTeamAssist={(targetId, assistType) =>
            socketRef.current?.send({
              type: 'race:team_assist',
              playerId: save.profile.playerId,
              fromPlayerName: save.profile.driverName,
              targetId,
              assistType,
            })
          }
          onDeductCredits={handleDeductCredits}
          onRaceFinished={handleRaceFinished}
          onGoToBuilder={() => setActiveTab('builder')}
          onGoToGarage={() => {
            setGarageSubTab('engine');
            setActiveTab('garage');
          }}
          onGoToPitCrew={() => {
            setGarageSubTab('pitcrew');
            setActiveTab('garage');
          }}
          onGoToHome={() => setActiveTab('home')}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {activeTab === 'builder' && (
        <TrackBuilder
          driverName={save.profile.driverName}
          customTracks={save.customTracks}
          onSaveAndRace={handleSaveTrackAndRace}
          onSaveOnly={handleSaveTrackOnly}
          onPublishOnline={handlePublishTrackOnline}
          onDeleteCustomTrack={handleDeleteCustomTrack}
        />
      )}

      {activeTab === 'garage' && (
        <GarageWorkshop
          credits={save.profile.credits}
          garage={save.garage}
          activeCarId={save.activeCarId}
          inventory={save.inventory}
          pitCrew={save.pitCrew}
          requestedSubTab={garageSubTab}
          onSelectCar={(id) => setSave((prev) => ({ ...prev, activeCarId: id }))}
          onUpdateCar={handleUpdateCar}
          onRepairCar={handleRepairCar}
          onUpgradePitCrew={handleUpgradePitCrew}
          onBuyComponent={handleBuyComponent}
        />
      )}

      {activeTab === 'dealership' && (
        <Dealership
          credits={save.profile.credits}
          garage={save.garage}
          playerRank={playerRank}
          playerRankPoints={save.profile.rankPoints}
          nextRank={nextRank}
          onBuyCar={handleBuyCar}
          onSelectCarAndGoToGarage={(id) => {
            setSave((prev) => ({ ...prev, activeCarId: id }));
            setActiveTab('garage');
          }}
        />
      )}

      {activeTab === 'marketplace' && (
        <MarketplaceOnline
          playerId={save.profile.playerId}
          driverName={save.profile.driverName}
          credits={save.profile.credits}
          wsConnected={wsConnected}
          inventory={save.inventory}
          garage={save.garage}
          listings={listings}
          trades={trades}
          rooms={rooms}
          activeRoom={activeRoom}
          preferredRole={preferredRole}
          allTracks={allTracks}
          onChangeDriverName={(name) =>
            setSave((prev) => ({
              ...prev,
              profile: { ...prev.profile, driverName: name },
            }))
          }
          onChangeRole={handleChangeTeamRole}
          onBuyListing={handleBuyListing}
          onListComponent={handleListComponent}
          onCancelListing={handleCancelListing}
          onProposeTrade={handleProposeTrade}
          onRespondTrade={handleRespondTrade}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onLeaveRoom={handleLeaveRoom}
          onToggleReady={handleToggleReady}
          onStartRoomRace={handleStartRoomRace}
          requestedSection={marketSection}
        />
      )}
    </div>
  );
}
