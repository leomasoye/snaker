export const OPCODES = {
  // Client -> Server
  C2S_JOIN: 1,
  C2S_INPUT: 2,
  C2S_PING: 3,

  // Server -> Client
  S2C_PONG: 9,
  S2C_WELCOME: 10,
  S2C_TICK: 11,
  S2C_DEATH: 12,
  S2C_KILL_FEED: 13,
} as const;

export interface NetSegment {
  x: number;
  y: number;
  angle: number;
}

export interface NetSnake {
  id: string;
  name: string;
  skinId: string;
  isBot: boolean;
  isAlive: boolean;
  x: number;
  y: number;
  angle: number;
  radius: number;
  mass: number;
  speed: number;
  isBoosting: boolean;
  kills: number;
  segments: NetSegment[];
}

export interface NetFoodOrb {
  id: number;
  x: number;
  y: number;
  radius: number;
  value: number;
  color: number;
  colorIndex: number;
}

export interface NetLeaderboardEntry {
  name: string;
  score: number;
  isPlayer: boolean;
}

export interface NetTickPayload {
  tick: number;
  snakes: NetSnake[];
  addedFood: NetFoodOrb[];
  removedFoodIds: number[];
  leaderboard: NetLeaderboardEntry[];
}

export interface NetWelcomePayload {
  playerId: string;
  worldRadius: number;
  snakes: NetSnake[];
  food: NetFoodOrb[];
}

export interface NetDeathPayload {
  killerName: string;
  finalScore: number;
  finalLength: number;
  finalKills: number;
  finalRank: number;
}

// Sérialiseur et Désérialiseur Binaire Compact
export class BinaryProtocol {
  private static textEncoder = new TextEncoder();
  private static textDecoder = new TextDecoder();

  // --- C2S Encode / Decode ---

  // C2S_JOIN: [OpCode: 1B, SkinIdx: 1B, NameLen: 1B, NameUTF8: NB]
  public static encodeJoin(name: string, skinIndex: number): ArrayBuffer {
    const nameBytes = this.textEncoder.encode(name.slice(0, 16));
    const buffer = new ArrayBuffer(3 + nameBytes.length);
    const view = new DataView(buffer);
    view.setUint8(0, OPCODES.C2S_JOIN);
    view.setUint8(1, skinIndex & 0xff);
    view.setUint8(2, nameBytes.length);
    new Uint8Array(buffer, 3).set(nameBytes);
    return buffer;
  }

  public static decodeJoin(buffer: ArrayBuffer): { name: string; skinIndex: number } {
    const view = new DataView(buffer);
    const skinIndex = view.getUint8(1);
    const nameLen = view.getUint8(2);
    const name = this.textDecoder.decode(new Uint8Array(buffer, 3, nameLen));
    return { name, skinIndex };
  }

  // C2S_INPUT: [OpCode: 1B, AngleScaled: 2B (uint16: 0-65535 -> 0-2pi), Boost: 1B] -> Total 4B
  public static encodeInput(angle: number, isBoosting: boolean): ArrayBuffer {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint8(0, OPCODES.C2S_INPUT);
    // Normaliser angle [0, 2PI] vers Uint16 [0, 65535]
    let normAngle = angle % (Math.PI * 2);
    if (normAngle < 0) normAngle += Math.PI * 2;
    const uint16Angle = Math.round((normAngle / (Math.PI * 2)) * 65535);
    view.setUint16(1, uint16Angle, true);
    view.setUint8(3, isBoosting ? 1 : 0);
    return buffer;
  }

  public static decodeInput(buffer: ArrayBuffer): { angle: number; isBoosting: boolean } {
    const view = new DataView(buffer);
    const uint16Angle = view.getUint16(1, true);
    const angle = (uint16Angle / 65535) * (Math.PI * 2);
    const isBoosting = view.getUint8(3) === 1;
    return { angle, isBoosting };
  }

  // C2S_PING / S2C_PONG
  public static encodePing(time: number): ArrayBuffer {
    const buffer = new ArrayBuffer(9);
    const view = new DataView(buffer);
    view.setUint8(0, OPCODES.C2S_PING);
    view.setFloat64(1, time, true);
    return buffer;
  }

  public static decodePing(buffer: ArrayBuffer): number {
    const view = new DataView(buffer);
    return view.getFloat64(1, true);
  }

  // --- S2C_TICK Binary Serialization (Ultra-compact & Zero-GC) ---
  public static encodeTickBinary(payload: NetTickPayload): ArrayBuffer {
    // 1. Calculer la taille exacte requise
    let totalSize = 1 + 4 + 2; // Opcode (1) + Tick (4) + SnakeCount (2)

    const encodedNames: Uint8Array[] = [];
    for (let i = 0; i < payload.snakes.length; i++) {
      const s = payload.snakes[i];
      const nameBytes = this.textEncoder.encode(s.name.slice(0, 16));
      encodedNames.push(nameBytes);

      // Id string len (1) + Id bytes + flags (1) + skinIdLen (1) + skinId bytes + x (4) + y (4) + angle (2) + radius (2) + mass (4) + speed (2) + kills (2) + segCount (2) + segments (5 * N)
      const idBytes = this.textEncoder.encode(s.id.slice(0, 16));
      const skinBytes = this.textEncoder.encode(s.skinId.slice(0, 16));
      totalSize += 1 + idBytes.length + 1 + 1 + skinBytes.length + 4 + 4 + 2 + 2 + 4 + 2 + 2 + 1 + nameBytes.length + 2 + (s.segments.length * 5);
    }

    // Food added: count (2) + 11 * count
    totalSize += 2 + payload.addedFood.length * 11;

    // Food removed: count (2) + 4 * count
    totalSize += 2 + payload.removedFoodIds.length * 4;

    // Leaderboard: count (1)
    totalSize += 1;
    const encodedLbNames: Uint8Array[] = [];
    for (let i = 0; i < payload.leaderboard.length; i++) {
      const lb = payload.leaderboard[i];
      const lbNameBytes = this.textEncoder.encode(lb.name.slice(0, 16));
      encodedLbNames.push(lbNameBytes);
      totalSize += 4 + 1 + 1 + lbNameBytes.length; // score (4) + isPlayer (1) + nameLen (1) + name
    }

    // 2. Allouer le buffer et écrire les données binaires
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    let offset = 0;
    view.setUint8(offset++, OPCODES.S2C_TICK);
    view.setUint32(offset, payload.tick, true);
    offset += 4;
    view.setUint16(offset, payload.snakes.length, true);
    offset += 2;

    for (let i = 0; i < payload.snakes.length; i++) {
      const s = payload.snakes[i];
      const nameBytes = encodedNames[i];
      const idBytes = this.textEncoder.encode(s.id.slice(0, 16));
      const skinBytes = this.textEncoder.encode(s.skinId.slice(0, 16));

      // ID
      view.setUint8(offset++, idBytes.length);
      uint8View.set(idBytes, offset);
      offset += idBytes.length;

      // Skin ID
      view.setUint8(offset++, skinBytes.length);
      uint8View.set(skinBytes, offset);
      offset += skinBytes.length;

      // Flags: bit 0: isAlive, bit 1: isBot, bit 2: isBoosting
      let flags = 0;
      if (s.isAlive) flags |= 1;
      if (s.isBot) flags |= 2;
      if (s.isBoosting) flags |= 4;
      view.setUint8(offset++, flags);

      // Pos & Angle
      view.setFloat32(offset, s.x, true);
      offset += 4;
      view.setFloat32(offset, s.y, true);
      offset += 4;

      let normAngle = s.angle % (Math.PI * 2);
      if (normAngle < 0) normAngle += Math.PI * 2;
      view.setUint16(offset, Math.round((normAngle / (Math.PI * 2)) * 65535), true);
      offset += 2;

      // Radius (* 10 pour préserver 0.1px de précision sur uint16)
      view.setUint16(offset, Math.round(s.radius * 10), true);
      offset += 2;

      // Mass, Speed (* 10), Kills
      view.setUint32(offset, Math.round(s.mass), true);
      offset += 4;
      view.setUint16(offset, Math.round(s.speed * 10), true);
      offset += 2;
      view.setUint16(offset, s.kills, true);
      offset += 2;

      // Name
      view.setUint8(offset++, nameBytes.length);
      uint8View.set(nameBytes, offset);
      offset += nameBytes.length;

      // Segments
      view.setUint16(offset, s.segments.length, true);
      offset += 2;

      for (let j = 0; j < s.segments.length; j++) {
        const seg = s.segments[j];
        view.setInt16(offset, Math.round(seg.x), true);
        offset += 2;
        view.setInt16(offset, Math.round(seg.y), true);
        offset += 2;

        let segNormAngle = seg.angle % (Math.PI * 2);
        if (segNormAngle < 0) segNormAngle += Math.PI * 2;
        view.setUint8(offset++, Math.round((segNormAngle / (Math.PI * 2)) * 255));
      }
    }

    // Food added
    view.setUint16(offset, payload.addedFood.length, true);
    offset += 2;
    for (let i = 0; i < payload.addedFood.length; i++) {
      const f = payload.addedFood[i];
      view.setUint32(offset, f.id, true);
      offset += 4;
      view.setInt16(offset, Math.round(f.x), true);
      offset += 2;
      view.setInt16(offset, Math.round(f.y), true);
      offset += 2;
      view.setUint8(offset++, Math.round(f.radius * 10));
      view.setUint8(offset++, Math.min(f.value, 255));
      view.setUint8(offset++, f.colorIndex & 0xff);
    }

    // Food removed
    view.setUint16(offset, payload.removedFoodIds.length, true);
    offset += 2;
    for (let i = 0; i < payload.removedFoodIds.length; i++) {
      view.setUint32(offset, payload.removedFoodIds[i], true);
      offset += 4;
    }

    // Leaderboard
    view.setUint8(offset++, payload.leaderboard.length);
    for (let i = 0; i < payload.leaderboard.length; i++) {
      const lb = payload.leaderboard[i];
      const nameBytes = encodedLbNames[i];
      view.setUint32(offset, Math.round(lb.score), true);
      offset += 4;
      view.setUint8(offset++, lb.isPlayer ? 1 : 0);
      view.setUint8(offset++, nameBytes.length);
      uint8View.set(nameBytes, offset);
      offset += nameBytes.length;
    }

    return buffer;
  }

  public static decodeTickBinary(buffer: ArrayBuffer): NetTickPayload {
    const view = new DataView(buffer);
    let offset = 1; // Sauter opcode

    const tick = view.getUint32(offset, true);
    offset += 4;

    const snakesCount = view.getUint16(offset, true);
    offset += 2;

    const snakes: NetSnake[] = [];
    for (let i = 0; i < snakesCount; i++) {
      const idLen = view.getUint8(offset++);
      const id = this.textDecoder.decode(new Uint8Array(buffer, offset, idLen));
      offset += idLen;

      const skinIdLen = view.getUint8(offset++);
      const skinId = this.textDecoder.decode(new Uint8Array(buffer, offset, skinIdLen));
      offset += skinIdLen;

      const flags = view.getUint8(offset++);
      const isAlive = (flags & 1) !== 0;
      const isBot = (flags & 2) !== 0;
      const isBoosting = (flags & 4) !== 0;

      const x = view.getFloat32(offset, true);
      offset += 4;
      const y = view.getFloat32(offset, true);
      offset += 4;

      const uint16Angle = view.getUint16(offset, true);
      offset += 2;
      const angle = (uint16Angle / 65535) * (Math.PI * 2);

      const radius = view.getUint16(offset, true) / 10;
      offset += 2;

      const mass = view.getUint32(offset, true);
      offset += 4;

      const speed = view.getUint16(offset, true) / 10;
      offset += 2;

      const kills = view.getUint16(offset, true);
      offset += 2;

      const nameLen = view.getUint8(offset++);
      const name = this.textDecoder.decode(new Uint8Array(buffer, offset, nameLen));
      offset += nameLen;

      const segCount = view.getUint16(offset, true);
      offset += 2;

      const segments: NetSegment[] = [];
      for (let j = 0; j < segCount; j++) {
        const segX = view.getInt16(offset, true);
        offset += 2;
        const segY = view.getInt16(offset, true);
        offset += 2;
        const segAngleByte = view.getUint8(offset++);
        const segAngle = (segAngleByte / 255) * (Math.PI * 2);

        segments.push({ x: segX, y: segY, angle: segAngle });
      }

      snakes.push({
        id,
        name,
        skinId,
        isBot,
        isAlive,
        x,
        y,
        angle,
        radius,
        mass,
        speed,
        isBoosting,
        kills,
        segments,
      });
    }

    // Food added
    const foodAddedCount = view.getUint16(offset, true);
    offset += 2;
    const addedFood: NetFoodOrb[] = [];
    for (let i = 0; i < foodAddedCount; i++) {
      const id = view.getUint32(offset, true);
      offset += 4;
      const x = view.getInt16(offset, true);
      offset += 2;
      const y = view.getInt16(offset, true);
      offset += 2;
      const radius = view.getUint8(offset++) / 10;
      const value = view.getUint8(offset++);
      const colorIndex = view.getUint8(offset++);

      const VIBRANT_PALETTE = [0x00f0ff, 0xff007f, 0x39ff14, 0xffaa00, 0x9d00ff, 0x00ffcc, 0xff3366, 0xffdd00];
      addedFood.push({
        id,
        x,
        y,
        radius,
        value,
        colorIndex,
        color: VIBRANT_PALETTE[colorIndex % VIBRANT_PALETTE.length] || 0x00f0ff,
      });
    }

    // Food removed
    const foodRemovedCount = view.getUint16(offset, true);
    offset += 2;
    const removedFoodIds: number[] = [];
    for (let i = 0; i < foodRemovedCount; i++) {
      removedFoodIds.push(view.getUint32(offset, true));
      offset += 4;
    }

    // Leaderboard
    const lbCount = view.getUint8(offset++);
    const leaderboard: NetLeaderboardEntry[] = [];
    for (let i = 0; i < lbCount; i++) {
      const score = view.getUint32(offset, true);
      offset += 4;
      const isPlayer = view.getUint8(offset++) === 1;
      const nameLen = view.getUint8(offset++);
      const name = this.textDecoder.decode(new Uint8Array(buffer, offset, nameLen));
      offset += nameLen;

      leaderboard.push({ name, score, isPlayer });
    }

    return {
      tick,
      snakes,
      addedFood,
      removedFoodIds,
      leaderboard,
    };
  }

  // --- S2C JSON Payload pour les paquets complexes (Welcomes) ---
  public static encodeJsonPacket(opcode: number, payload: unknown): ArrayBuffer {
    const jsonStr = JSON.stringify(payload);
    const jsonBytes = this.textEncoder.encode(jsonStr);
    const buffer = new ArrayBuffer(1 + jsonBytes.length);
    const view = new DataView(buffer);
    view.setUint8(0, opcode);
    new Uint8Array(buffer, 1).set(jsonBytes);
    return buffer;
  }

  public static decodeJsonPacket<T>(buffer: ArrayBuffer): { opcode: number; payload: T } {
    const view = new DataView(buffer);
    const opcode = view.getUint8(0);
    const jsonStr = this.textDecoder.decode(new Uint8Array(buffer, 1));
    return { opcode, payload: JSON.parse(jsonStr) as T };
  }
}

