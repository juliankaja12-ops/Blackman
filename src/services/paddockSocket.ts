import {
  FireToolType,
  MarketListing,
  MultiplayerRoom,
  RemoteRacerTelemetry,
  TeamAssistType,
  TrackDefinition,
  TradeOffer,
  UniqueComponent,
} from '../types/game';

export interface PaddockSocketCallbacks {
  onConnectedChange: (connected: boolean) => void;
  onMarketUpdated: (listings: MarketListing[]) => void;
  onMarketSold: (payload: {
    listingId: string;
    sellerId: string;
    buyerId: string;
    price: number;
    listings: MarketListing[];
    trades: TradeOffer[];
  }) => void;
  onTradeUpdated: (trades: TradeOffer[]) => void;
  onTradeCompleted: (payload: {
    trade: TradeOffer;
    listings: MarketListing[];
    trades: TradeOffer[];
    sellerReceivedComponent: UniqueComponent;
    buyerReceivedComponent: UniqueComponent;
  }) => void;
  onTracksUpdated: (tracks: TrackDefinition[]) => void;
  onRoomsList: (rooms: MultiplayerRoom[]) => void;
  onRoomState: (room: MultiplayerRoom) => void;
  onRoomStarted: (room: MultiplayerRoom) => void;
  onTelemetry: (telemetry: RemoteRacerTelemetry) => void;
  onFireExtinguish?: (payload: {
    targetId: string;
    fromPlayerName: string;
    tool: FireToolType;
  }) => void;
  onTeamAssist?: (payload: {
    targetId: string;
    fromPlayerName: string;
    assistType: TeamAssistType;
  }) => void;
}

export class PaddockSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private disposed = false;
  private callbacks: PaddockSocketCallbacks;

  constructor(callbacks: PaddockSocketCallbacks) {
    this.callbacks = callbacks;
    this.connect();
  }

  public updateCallbacks(callbacks: PaddockSocketCallbacks) {
    this.callbacks = callbacks;
  }

  private connect() {
    if (this.disposed) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.callbacks.onConnectedChange(true);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        switch (msg.type) {
          case 'market:updated':
            this.callbacks.onMarketUpdated(msg.listings);
            if (msg.trades) this.callbacks.onTradeUpdated(msg.trades);
            break;
          case 'market:sold':
            this.callbacks.onMarketSold(msg);
            break;
          case 'trade:updated':
            this.callbacks.onTradeUpdated(msg.trades);
            break;
          case 'trade:completed':
            this.callbacks.onTradeCompleted(msg);
            break;
          case 'tracks:updated':
            this.callbacks.onTracksUpdated(msg.communityTracks);
            break;
          case 'rooms:list':
            this.callbacks.onRoomsList(msg.rooms);
            break;
          case 'room:joined':
          case 'room:state':
            this.callbacks.onRoomState(msg.room);
            break;
          case 'room:started':
            this.callbacks.onRoomStarted(msg.room);
            break;
          case 'race:telemetry':
            this.callbacks.onTelemetry(msg.telemetry);
            break;
          case 'race:fire_extinguish':
            this.callbacks.onFireExtinguish?.(msg);
            break;
          case 'race:team_assist':
            this.callbacks.onTeamAssist?.(msg);
            break;
        }
      } catch {
        // ignore malformed packets
      }
    };

    ws.onclose = () => {
      this.callbacks.onConnectedChange(false);
      if (!this.disposed) {
        this.reconnectTimer = window.setTimeout(() => this.connect(), 2200);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  public send(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public dispose() {
    this.disposed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }
}
