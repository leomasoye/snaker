import { GameRoom } from './game-room';

export interface RoomSummary {
  id: string;
  name: string;
  playerCount: number;
  botCount: number;
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();

  constructor() {
    // Salles publiques de départ
    this.createRoom('arena-alpha', 'Arène Alpha (Principale)');
    this.createRoom('arena-beta', 'Arène Bêta (Rapide)');
  }

  public createRoom(id: string, name: string): GameRoom {
    let room = this.rooms.get(id);
    if (!room) {
      room = new GameRoom(id, name);
      room.start();
      this.rooms.set(id, room);
      console.log(`[RoomManager] Salle instanciée : ${name} [${id}]`);
    }
    return room;
  }

  public getOrCreateRoom(id: string, name?: string): GameRoom {
    let room = this.rooms.get(id);
    if (!room) {
      const roomName = name || (id === 'arena-beta' ? 'Arène Bêta (Rapide)' : `Arène ${id}`);
      room = this.createRoom(id, roomName);
    }
    return room;
  }

  public getRoom(id: string): GameRoom | undefined {
    return this.rooms.get(id);
  }

  public getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values());
  }

  public getRoomsSummary(): RoomSummary[] {
    return this.getAllRooms().map(r => ({
      id: r.roomId,
      name: r.roomName,
      playerCount: r.getPlayerCount(),
      botCount: r.getBotCount(),
    }));
  }
}
