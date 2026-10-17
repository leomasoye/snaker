import { BinaryProtocol, OPCODES, type NetDeathPayload, type NetKillPayload, type NetTickPayload, type NetWelcomePayload } from '../shared/protocol';

export type OnWelcomeCallback = (payload: NetWelcomePayload) => void;
export type OnTickCallback = (payload: NetTickPayload) => void;
export type OnDeathCallback = (payload: NetDeathPayload) => void;
export type OnKillCallback = (payload: NetKillPayload) => void;
export type OnPingCallback = (pingMs: number) => void;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private serverUrl: string;

  private pingIntervalId: number | null = null;
  private lastInputBoost: boolean = false;
  private lastInputSentTime: number = 0;

  // Callbacks
  public onWelcome?: OnWelcomeCallback;
  public onTick?: OnTickCallback;
  public onDeath?: OnDeathCallback;
  public onKill?: OnKillCallback;
  public onPing?: OnPingCallback;
  public onStatusChange?: (online: boolean) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      const isHttps = window.location.protocol === 'https:';
      const wsProto = isHttps ? 'wss:' : 'ws:';
      if (window.location.port === '5173' || isHttps) {
        this.serverUrl = `${wsProto}//${window.location.host}/ws`;
      } else {
        const host = window.location.hostname || 'localhost';
        this.serverUrl = `ws://${host}:3001`;
      }
    } else {
      this.serverUrl = 'ws://localhost:3001';
    }
  }

  public connect(): void {
    if (this.isConnected || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.serverUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        console.log('[NetworkClient] Connecté au serveur multijoueur temps réel');
        if (this.onStatusChange) this.onStatusChange(true);
        this.startPingLoop();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          this.handleBinaryMessage(event.data);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.isConnecting = false;
        console.log('[NetworkClient] Déconnecté du serveur multijoueur');
        if (this.onStatusChange) this.onStatusChange(false);
        this.stopPingLoop();

        // Tentative de reconnexion automatique après 3 secondes
        setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.isConnecting = false;
        if (this.onStatusChange) this.onStatusChange(false);
      };
    } catch {
      this.isConnected = false;
      this.isConnecting = false;
      if (this.onStatusChange) this.onStatusChange(false);
    }
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingIntervalId = window.setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        const pingPacket = BinaryProtocol.encodePing(performance.now());
        this.ws.send(pingPacket);
      }
    }, 1000);
  }

  private stopPingLoop(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  public sendJoin(name: string, skinIndex: number, roomId: string = 'arena-alpha'): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const packet = BinaryProtocol.encodeJoin(name, skinIndex, roomId);
    this.ws.send(packet);
  }

  public sendInput(angle: number, isBoosting: boolean): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const now = performance.now();
    // Limiter l'envoi d'inputs à 30 Hz (toutes les ~33 ms) sauf si le boost change d'état
    if (now - this.lastInputSentTime < 33 && isBoosting === this.lastInputBoost) {
      return;
    }

    this.lastInputBoost = isBoosting;
    this.lastInputSentTime = now;

    const packet = BinaryProtocol.encodeInput(angle, isBoosting);
    this.ws.send(packet);
  }

  private handleBinaryMessage(buffer: ArrayBuffer): void {
    if (buffer.byteLength === 0) return;
    const view = new DataView(buffer);
    const opcode = view.getUint8(0);

    // S2C_PONG
    if (opcode === OPCODES.S2C_PONG) {
      const clientTime = view.getFloat64(1, true);
      const pingMs = Math.round(performance.now() - clientTime);
      if (this.onPing) this.onPing(pingMs);
    }

    // S2C_TICK (Décodage binaire ultra-rapide)
    else if (opcode === OPCODES.S2C_TICK) {
      const payload = BinaryProtocol.decodeTickBinary(buffer);
      if (this.onTick) this.onTick(payload);
    }

    // S2C_WELCOME
    else if (opcode === OPCODES.S2C_WELCOME) {
      const { payload } = BinaryProtocol.decodeJsonPacket<NetWelcomePayload>(buffer);
      if (this.onWelcome) this.onWelcome(payload);
    }

    // S2C_DEATH
    else if (opcode === OPCODES.S2C_DEATH) {
      const { payload } = BinaryProtocol.decodeJsonPacket<NetDeathPayload>(buffer);
      if (this.onDeath) this.onDeath(payload);
    }

    // S2C_KILL_FEED
    else if (opcode === OPCODES.S2C_KILL_FEED) {
      const { payload } = BinaryProtocol.decodeJsonPacket<NetKillPayload>(buffer);
      if (this.onKill) this.onKill(payload);
    }
  }

  public getIsOnline(): boolean {
    return this.isConnected;
  }
}
