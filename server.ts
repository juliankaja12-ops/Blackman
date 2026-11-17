import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import {
  FireToolType,
  MarketListing,
  MultiplayerPlayerInfo,
  MultiplayerRoom,
  RaceTeamRole,
  RemoteRacerTelemetry,
  TrackDefinition,
  TradeOffer,
  UniqueComponent,
} from './src/types/game';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'paddock_state.json');

interface PersistedServerState {
  listings: MarketListing[];
  trades: TradeOffer[];
  communityTracks: TrackDefinition[];
}

function createInitialListings(): MarketListing[] {
  const now = Date.now();
  const factoryParts: { comp: UniqueComponent; price: number }[] = [
    {
      comp: {
        id: 'mkt_part_01',
        serial: '#TUR-904-L',
        name: 'Turbina Ibrida MGU-H Titanio-Alluminuro',
        slot: 'turbo_mgu',
        rarity: 'Leggendario',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 88, torqueDelta: 96, gripDelta: 0, aeroDelta: 0, weightDelta: -6, durabilityDelta: 6 },
        condition: 98,
        ownerId: 'constructor_aurelia',
        ownerName: 'Aurelia Factory Team',
        originNote: 'Specifica da qualifica Q3, omologata FIA.',
      },
      price: 46000,
    },
    {
      comp: {
        id: 'mkt_part_02',
        serial: '#AER-412-F',
        name: 'Fondo Venturi Carbonio High-Rake',
        slot: 'aero_pack',
        rarity: 'Factory',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 0, torqueDelta: 0, gripDelta: 8, aeroDelta: 15, weightDelta: -10, durabilityDelta: 5 },
        condition: 95,
        ownerId: 'constructor_monza',
        ownerName: 'Atelier Monza',
        originNote: 'Galleria del vento scala 1:1 — massimo carico aerodinamico.',
      },
      price: 29500,
    },
    {
      comp: {
        id: 'mkt_part_03',
        serial: '#ECU-219-P',
        name: 'Centralina Telemetrica Corsa Evo',
        slot: 'ecu',
        rarity: 'Prototipo',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 34, torqueDelta: 29, gripDelta: 2, aeroDelta: 0, weightDelta: -2, durabilityDelta: 9 },
        condition: 92,
        ownerId: 'constructor_veloce',
        ownerName: 'Officine Veloce',
        originNote: 'Anticipo accensione ottimizzato per benzine sintetiche.',
      },
      price: 14800,
    },
    {
      comp: {
        id: 'mkt_part_04',
        serial: '#GBX-771-F',
        name: 'Cambio Seamless Titanio 8 Rapporti',
        slot: 'gearbox',
        rarity: 'Factory',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 24, torqueDelta: 52, gripDelta: 4, aeroDelta: 0, weightDelta: -14, durabilityDelta: 7 },
        condition: 97,
        ownerId: 'constructor_aurelia',
        ownerName: 'Aurelia Factory Team',
        originNote: 'Cambiata in 4 millisecondi senza taglio di coppia.',
      },
      price: 33000,
    },
    {
      comp: {
        id: 'mkt_part_05',
        serial: '#ENG-880-L',
        name: 'Monoblocco Pre-Camera F1 Works',
        slot: 'engine_block',
        rarity: 'Leggendario',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 94, torqueDelta: 74, gripDelta: 0, aeroDelta: 0, weightDelta: -12, durabilityDelta: 8 },
        condition: 99,
        ownerId: 'constructor_monza',
        ownerName: 'Atelier Monza',
        originNote: 'Pistoni in lega aerospaziale a bassissimo attrito.',
      },
      price: 54000,
    },
    {
      comp: {
        id: 'mkt_part_06',
        serial: '#BRK-305-P',
        name: 'Dischi Carbon-Ceramici Raffreddati',
        slot: 'brakes',
        rarity: 'Prototipo',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 0, torqueDelta: 0, gripDelta: 7, aeroDelta: 2, weightDelta: -8, durabilityDelta: 12 },
        condition: 94,
        ownerId: 'constructor_veloce',
        ownerName: 'Officine Veloce',
        originNote: 'Resistenza al fading oltre 1.100 °C.',
      },
      price: 16200,
    },
    {
      comp: {
        id: 'mkt_part_07',
        serial: '#SUS-618-F',
        name: 'Sospensioni Attive Push-Rod Titanio',
        slot: 'suspension_kit',
        rarity: 'Factory',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 0, torqueDelta: 0, gripDelta: 12, aeroDelta: 4, weightDelta: -9, durabilityDelta: 7 },
        condition: 96,
        ownerId: 'constructor_aurelia',
        ownerName: 'Aurelia Factory Team',
        originNote: 'Barre di torsione progressive per cordoli ad alta velocità.',
      },
      price: 27800,
    },
    {
      comp: {
        id: 'mkt_part_08',
        serial: '#BAT-920-L',
        name: 'Pacco Batteria Solid-State 900V Cryo',
        slot: 'cooling_battery',
        rarity: 'Leggendario',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 62, torqueDelta: 88, gripDelta: 2, aeroDelta: 0, weightDelta: -18, durabilityDelta: 10 },
        condition: 98,
        ownerId: 'constructor_volt',
        ownerName: 'Voltworks Division',
        originNote: 'Scarica continua a 600 kW senza derating termico.',
      },
      price: 49500,
    },
    {
      comp: {
        id: 'mkt_part_09',
        serial: '#H2C-511-F',
        name: 'Stack Fuel-Cell & Serbatoio H₂ 700 bar',
        slot: 'engine_block',
        rarity: 'Factory',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 74, torqueDelta: 82, gripDelta: 0, aeroDelta: 1, weightDelta: -11, durabilityDelta: 9 },
        condition: 97,
        ownerId: 'constructor_boreale',
        ownerName: 'Boreale Cryo Lab',
        originNote: 'Membrana PEM ad alta densità per prototipi Idrogeno.',
      },
      price: 38400,
    },
    {
      comp: {
        id: 'mkt_part_10',
        serial: '#ERS-742-L',
        name: 'Differenziale E-LSD & Torque Vectoring',
        slot: 'differential_ers',
        rarity: 'Leggendario',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 30, torqueDelta: 70, gripDelta: 11, aeroDelta: 0, weightDelta: -7, durabilityDelta: 8 },
        condition: 99,
        ownerId: 'constructor_monza',
        ownerName: 'Atelier Monza',
        originNote: 'Ripartizione attiva coppia ruota-per-ruota in 2 ms.',
      },
      price: 44000,
    },
    {
      comp: {
        id: 'mkt_part_11',
        serial: '#EVS-409-P',
        name: 'Inverter SiC 1200V & Turbo-Idrogeno',
        slot: 'turbo_mgu',
        rarity: 'Prototipo',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 46, torqueDelta: 64, gripDelta: 0, aeroDelta: 0, weightDelta: -5, durabilityDelta: 8 },
        condition: 95,
        ownerId: 'constructor_volt',
        ownerName: 'Voltworks Division',
        originNote: 'Semiconduttori al carburo di silicio per EV & H₂.',
      },
      price: 21500,
    },
    {
      comp: {
        id: 'mkt_part_12',
        serial: '#RAD-318-P',
        name: 'Radiatori Microcanali & Cryo-Chiller',
        slot: 'cooling_battery',
        rarity: 'Prototipo',
        compatibleClasses: 'ALL',
        stats: { powerDelta: 18, torqueDelta: 22, gripDelta: 1, aeroDelta: 3, weightDelta: -6, durabilityDelta: 14 },
        condition: 94,
        ownerId: 'constructor_boreale',
        ownerName: 'Boreale Cryo Lab',
        originNote: 'Mantiene temperatura celle e olio sotto soglia critica.',
      },
      price: 15900,
    },
  ];

  return factoryParts.map((item, idx) => ({
    id: `listing_${idx + 1}`,
    component: item.comp,
    sellerId: item.comp.ownerId,
    sellerName: item.comp.ownerName,
    price: item.price,
    listedAt: now - idx * 360000,
  }));
}

function loadState(): PersistedServerState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedServerState;
      const seed = createInitialListings();
      let listings = parsed.listings?.length ? parsed.listings : seed;
      // Backfill new-slot factory listings if upgrading from older 6-slot state file
      if (
        parsed.listings?.length &&
        !parsed.listings.some((l) => l.component?.slot === 'cooling_battery')
      ) {
        const existingIds = new Set(parsed.listings.map((l) => l.id));
        listings = [...parsed.listings, ...seed.filter((s) => !existingIds.has(s.id))];
      }
      return {
        listings,
        trades: parsed.trades ?? [],
        communityTracks: parsed.communityTracks ?? [],
      };
    }
  } catch (err) {
    console.warn('Could not load paddock state, using initial seed:', err);
  }
  return {
    listings: createInitialListings(),
    trades: [],
    communityTracks: [],
  };
}

function saveState(state: PersistedServerState) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist paddock state:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const state = loadState();
  const rooms = new Map<string, MultiplayerRoom>();
  const socketToClient = new Map<WebSocket, { playerId: string; roomId: string | null }>();

  function broadcastAll(payload: unknown) {
    const msg = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  function broadcastRoom(roomId: string, payload: unknown, exclude?: WebSocket) {
    const msg = JSON.stringify(payload);
    for (const [client, meta] of socketToClient.entries()) {
      if (client !== exclude && meta.roomId === roomId && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  function broadcastRoomsList() {
    broadcastAll({
      type: 'rooms:list',
      rooms: Array.from(rooms.values()),
    });
  }

  // REST Endpoints
  app.get('/api/state', (_req, res) => {
    res.json({
      listings: state.listings,
      trades: state.trades,
      communityTracks: state.communityTracks,
      rooms: Array.from(rooms.values()),
    });
  });

  app.post('/api/market/list', (req, res) => {
    const { component, sellerId, sellerName, price } = req.body as {
      component: UniqueComponent;
      sellerId: string;
      sellerName: string;
      price: number;
    };
    if (!component || !sellerId || typeof price !== 'number' || price < 500) {
      res.status(400).json({ error: 'Dati inserzione non validi.' });
      return;
    }
    const listing: MarketListing = {
      id: `listing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      component: { ...component, ownerId: sellerId, ownerName: sellerName },
      sellerId,
      sellerName,
      price: Math.round(price),
      listedAt: Date.now(),
    };
    state.listings.unshift(listing);
    saveState(state);
    broadcastAll({ type: 'market:updated', listings: state.listings });
    res.json({ listing });
  });

  app.post('/api/market/buy', (req, res) => {
    const { listingId, buyerId, buyerName } = req.body as {
      listingId: string;
      buyerId: string;
      buyerName: string;
    };
    const idx = state.listings.findIndex((l) => l.id === listingId);
    if (idx === -1) {
      res.status(404).json({ error: 'Componente già venduto o rimosso.' });
      return;
    }
    const [listing] = state.listings.splice(idx, 1);
    const boughtComponent: UniqueComponent = {
      ...listing.component,
      ownerId: buyerId,
      ownerName: buyerName,
    };
    // Cancel pending trades targeting this sold listing
    state.trades = state.trades.map((t) =>
      t.toListingId === listingId && t.status === 'pending'
        ? { ...t, status: 'declined' }
        : t
    );
    saveState(state);
    broadcastAll({
      type: 'market:sold',
      listingId,
      sellerId: listing.sellerId,
      buyerId,
      price: listing.price,
      listings: state.listings,
      trades: state.trades,
    });
    res.json({ component: boughtComponent, price: listing.price });
  });

  app.post('/api/market/cancel', (req, res) => {
    const { listingId, sellerId } = req.body as { listingId: string; sellerId: string };
    const idx = state.listings.findIndex(
      (l) => l.id === listingId && l.sellerId === sellerId
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Inserzione non trovata.' });
      return;
    }
    const [removed] = state.listings.splice(idx, 1);
    saveState(state);
    broadcastAll({ type: 'market:updated', listings: state.listings });
    res.json({ component: removed.component });
  });

  app.post('/api/trades/propose', (req, res) => {
    const {
      fromPlayerId,
      fromPlayerName,
      toListingId,
      offeredComponent,
      offeredCredits,
    } = req.body as {
      fromPlayerId: string;
      fromPlayerName: string;
      toListingId: string;
      offeredComponent: UniqueComponent;
      offeredCredits: number;
    };

    const listingIdx = state.listings.findIndex((l) => l.id === toListingId);
    if (listingIdx === -1) {
      res.status(404).json({ error: 'Inserzione non più disponibile.' });
      return;
    }
    const listing = state.listings[listingIdx];

    const offer: TradeOffer = {
      id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromPlayerId,
      fromPlayerName,
      toListingId,
      targetComponent: listing.component,
      offeredComponent,
      offeredCredits: Math.max(0, Math.round(offeredCredits || 0)),
      status: 'pending',
      createdAt: Date.now(),
    };

    // If seller is an NPC constructor, auto-evaluate fairness immediately
    if (listing.sellerId.startsWith('constructor_')) {
      const rarityVal: Record<UniqueComponent['rarity'], number> = {
        Standard: 4000,
        Prototipo: 14000,
        Factory: 28000,
        Leggendario: 46000,
      };
      const offeredEstimate =
        rarityVal[offeredComponent.rarity] * (offeredComponent.condition / 100) +
        offer.offeredCredits;

      if (offeredEstimate >= listing.price * 0.88) {
        offer.status = 'accepted';
        state.listings.splice(listingIdx, 1);
        // Constructor relists the player's traded component!
        state.listings.unshift({
          id: `listing_${Date.now()}_rel`,
          component: {
            ...offeredComponent,
            ownerId: listing.sellerId,
            ownerName: listing.sellerName,
          },
          sellerId: listing.sellerId,
          sellerName: listing.sellerName,
          price: Math.round(rarityVal[offeredComponent.rarity] * 1.1),
          listedAt: Date.now(),
        });
        state.trades.unshift(offer);
        saveState(state);
        broadcastAll({
          type: 'market:updated',
          listings: state.listings,
          trades: state.trades,
        });
        res.json({
          offer,
          autoAccepted: true,
          receivedComponent: {
            ...listing.component,
            ownerId: fromPlayerId,
            ownerName: fromPlayerName,
          },
        });
        return;
      } else {
        offer.status = 'declined';
        state.trades.unshift(offer);
        saveState(state);
        res.json({
          offer,
          autoAccepted: false,
          reason: `Valore stimato (${Math.round(offeredEstimate)} CR) inferiore alla richiesta del costruttore (${Math.round(listing.price * 0.88)} CR). Aggiungi crediti o un componente superiore.`,
        });
        return;
      }
    }

    // Player-to-player live offer
    state.trades.unshift(offer);
    saveState(state);
    broadcastAll({ type: 'trade:updated', trades: state.trades });
    res.json({ offer, autoAccepted: false });
  });

  app.post('/api/trades/respond', (req, res) => {
    const { tradeId, sellerId, accept } = req.body as {
      tradeId: string;
      sellerId: string;
      accept: boolean;
    };
    const trade = state.trades.find((t) => t.id === tradeId);
    if (!trade || trade.status !== 'pending') {
      res.status(404).json({ error: 'Proposta non trovata o già chiusa.' });
      return;
    }
    const listingIdx = state.listings.findIndex(
      (l) => l.id === trade.toListingId && l.sellerId === sellerId
    );
    if (listingIdx === -1) {
      res.status(403).json({ error: 'Non sei autorizzato o inserzione scaduta.' });
      return;
    }

    if (!accept) {
      trade.status = 'declined';
      saveState(state);
      broadcastAll({ type: 'trade:updated', trades: state.trades });
      res.json({ trade });
      return;
    }

    const [listing] = state.listings.splice(listingIdx, 1);
    trade.status = 'accepted';
    saveState(state);

    broadcastAll({
      type: 'trade:completed',
      trade,
      listings: state.listings,
      trades: state.trades,
      sellerReceivedComponent: {
        ...trade.offeredComponent,
        ownerId: listing.sellerId,
        ownerName: listing.sellerName,
      },
      buyerReceivedComponent: {
        ...listing.component,
        ownerId: trade.fromPlayerId,
        ownerName: trade.fromPlayerName,
      },
    });
    res.json({
      trade,
      receivedComponent: {
        ...trade.offeredComponent,
        ownerId: listing.sellerId,
        ownerName: listing.sellerName,
      },
    });
  });

  app.post('/api/tracks/publish', (req, res) => {
    const track = req.body as TrackDefinition;
    if (!track || !track.id || !track.points || track.points.length < 4) {
      res.status(400).json({ error: 'Circuito non valido.' });
      return;
    }
    const existingIdx = state.communityTracks.findIndex((t) => t.id === track.id);
    if (existingIdx >= 0) {
      state.communityTracks[existingIdx] = track;
    } else {
      state.communityTracks.unshift(track);
    }
    saveState(state);
    broadcastAll({ type: 'tracks:updated', communityTracks: state.communityTracks });
    res.json({ track });
  });

  // WebSocket Multiplayer & Live Sync
  wss.on('connection', (ws) => {
    socketToClient.set(ws, { playerId: '', roomId: null });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          playerId?: string;
          roomId?: string;
          roomName?: string;
          player?: MultiplayerPlayerInfo;
          track?: TrackDefinition;
          laps?: number;
          ready?: boolean;
          role?: RaceTeamRole;
          targetId?: string;
          fromPlayerName?: string;
          tool?: FireToolType;
          telemetry?: RemoteRacerTelemetry;
        };

        const meta = socketToClient.get(ws);
        if (!meta) return;

        if (msg.playerId) {
          meta.playerId = msg.playerId;
        }

        switch (msg.type) {
          case 'room:create': {
            if (!msg.player || !msg.track) break;
            const roomId = `room_${Date.now().toString(36)}`;
            const safeRole: RaceTeamRole =
              msg.player.role === 'safety_car' ||
              msg.player.role === 'fire_team' ||
              msg.player.role === 'medical_team' ||
              msg.player.role === 'mechanic_team'
                ? msg.player.role
                : 'driver';
            const room: MultiplayerRoom = {
              id: roomId,
              name: msg.roomName || `GP ${msg.track.name}`,
              hostId: msg.player.playerId,
              hostName: msg.player.playerName,
              trackId: msg.track.id,
              trackName: msg.track.name,
              trackDefinition: msg.track,
              laps: msg.laps || msg.track.laps || 3,
              status: 'waiting',
              players: [{ ...msg.player, role: safeRole, ready: true }],
              createdAt: Date.now(),
            };
            rooms.set(roomId, room);
            meta.roomId = roomId;
            meta.playerId = msg.player.playerId;
            broadcastRoomsList();
            ws.send(JSON.stringify({ type: 'room:joined', room }));
            break;
          }

          case 'room:join': {
            if (!msg.roomId || !msg.player) break;
            const room = rooms.get(msg.roomId);
            if (!room || room.status !== 'waiting') break;
            const safeRole: RaceTeamRole =
              msg.player.role === 'safety_car' ||
              msg.player.role === 'fire_team' ||
              msg.player.role === 'medical_team' ||
              msg.player.role === 'mechanic_team'
                ? msg.player.role
                : 'driver';
            if (!room.players.some((p) => p.playerId === msg.player!.playerId)) {
              room.players.push({ ...msg.player, role: safeRole, ready: false });
            }
            meta.roomId = room.id;
            meta.playerId = msg.player.playerId;
            broadcastRoomsList();
            broadcastRoom(room.id, { type: 'room:state', room });
            break;
          }

          case 'room:leave': {
            if (meta.roomId) {
              const room = rooms.get(meta.roomId);
              if (room) {
                room.players = room.players.filter((p) => p.playerId !== meta.playerId);
                if (room.players.length === 0) {
                  rooms.delete(room.id);
                } else {
                  if (room.hostId === meta.playerId) {
                    room.hostId = room.players[0].playerId;
                    room.hostName = room.players[0].playerName;
                  }
                  broadcastRoom(room.id, { type: 'room:state', room });
                }
              }
              meta.roomId = null;
              broadcastRoomsList();
            }
            break;
          }

          case 'room:ready': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room) break;
            const p = room.players.find((pl) => pl.playerId === meta.playerId);
            if (p) p.ready = Boolean(msg.ready);
            broadcastRoom(room.id, { type: 'room:state', room });
            broadcastRoomsList();
            break;
          }

          case 'room:role': {
            if (!meta.roomId || !msg.role) break;
            const room = rooms.get(meta.roomId);
            if (!room || room.status !== 'waiting') break;
            const p = room.players.find((pl) => pl.playerId === meta.playerId);
            if (
              p &&
              (msg.role === 'driver' ||
                msg.role === 'safety_car' ||
                msg.role === 'fire_team' ||
                msg.role === 'medical_team' ||
                msg.role === 'mechanic_team')
            ) {
              p.role = msg.role;
              broadcastRoom(room.id, { type: 'room:state', room });
              broadcastRoomsList();
            }
            break;
          }

          case 'room:start': {
            if (!meta.roomId) break;
            const room = rooms.get(meta.roomId);
            if (!room || room.hostId !== meta.playerId) break;
            room.status = 'racing';
            broadcastRoom(room.id, { type: 'room:started', room });
            broadcastRoomsList();
            break;
          }

          case 'race:telemetry': {
            if (!meta.roomId || !msg.telemetry) break;
            broadcastRoom(
              meta.roomId,
              { type: 'race:telemetry', telemetry: msg.telemetry },
              ws
            );
            break;
          }

          case 'race:fire_extinguish': {
            if (!meta.roomId || !msg.targetId || !msg.tool) break;
            broadcastRoom(
              meta.roomId,
              {
                type: 'race:fire_extinguish',
                targetId: msg.targetId,
                fromPlayerName: msg.fromPlayerName || 'Team Antincendio',
                tool: msg.tool,
              },
              ws
            );
            break;
          }

          case 'race:team_assist': {
            if (!meta.roomId || !msg.targetId) break;
            broadcastRoom(
              meta.roomId,
              {
                type: 'race:team_assist',
                targetId: msg.targetId,
                fromPlayerName: msg.fromPlayerName || 'Team Emergenza',
                assistType: (msg as { assistType?: string }).assistType || 'medical_aid',
              },
              ws
            );
            break;
          }
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });

    ws.on('close', () => {
      const meta = socketToClient.get(ws);
      if (meta?.roomId) {
        const room = rooms.get(meta.roomId);
        if (room) {
          room.players = room.players.filter((p) => p.playerId !== meta.playerId);
          if (room.players.length === 0) {
            rooms.delete(room.id);
          } else {
            if (room.hostId === meta.playerId) {
              room.hostId = room.players[0].playerId;
              room.hostName = room.players[0].playerName;
            }
            broadcastRoom(room.id, { type: 'room:state', room });
          }
          broadcastRoomsList();
        }
      }
      socketToClient.delete(ws);
    });
  });

  // Vite dev middleware or production static dist
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Darwin GP server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
