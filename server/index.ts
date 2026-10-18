import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './room-manager';
import { BinaryProtocol, NetWelcomePayload, OPCODES } from '../src/shared/protocol';
import { CONFIG } from '../src/config';

const PORT = 3001;
// Écoute sur 0.0.0.0 pour permettre les connexions depuis d'autres PC du réseau local (Wi-Fi/LAN)
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });
const roomManager = new RoomManager();

let nextPlayerNumber = 1;

console.log(`===============================================`);
console.log(`  SNAKER SERVEUR MULTIJOUEUR TEMPS RÉEL ACTIF  `);
console.log(`  Port: ${PORT} | Interface: 0.0.0.0 (LAN Ready) `);
console.log(`  Salles Actives: Alpha & Bêta (Multi-Rooms)    `);
console.log(`===============================================`);

wss.on('connection', (ws: WebSocket) => {
  const playerId = `p_${nextPlayerNumber++}`;
  let hasJoined = false;
  let currentRoom = roomManager.getRoom('arena-alpha')!;

  ws.binaryType = 'arraybuffer';

  ws.on('message', (data: Buffer | ArrayBuffer) => {
    let arrayBuffer: ArrayBuffer;
    if (data instanceof ArrayBuffer) {
      arrayBuffer = data;
    } else if (Buffer.isBuffer(data)) {
      arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } else {
      return;
    }

    if (arrayBuffer.byteLength === 0) return;

    const view = new DataView(arrayBuffer);
    const opcode = view.getUint8(0);

    // 1. C2S_JOIN (avec support multi-salles)
    if (opcode === OPCODES.C2S_JOIN) {
      const { name, skinIndex, roomId } = BinaryProtocol.decodeJoin(arrayBuffer);
      currentRoom = roomManager.getOrCreateRoom(roomId);
      currentRoom.addPlayer(playerId, name, skinIndex, ws);
      hasJoined = true;

      // Envoyer le paquet WELCOME avec l'état complet initial de la salle choisie
      const welcomePayload: NetWelcomePayload = {
        playerId,
        worldRadius: CONFIG.WORLD_RADIUS,
        snakes: currentRoom.getAllSnakes().map(s => ({
          id: s.id,
          name: s.name,
          skinId: s.skin.id,
          isBot: s.isBot,
          isAlive: s.isAlive,
          x: s.x,
          y: s.y,
          angle: s.angle,
          radius: s.radius,
          mass: s.mass,
          speed: s.speed,
          isBoosting: s.isBoosting,
          kills: s.kills,
          segments: s.segments.map(seg => ({ x: seg.x, y: seg.y, angle: seg.angle })),
        })),
        food: currentRoom.getFullInitialFood(),
      };

      const welcomePacket = BinaryProtocol.encodeJsonPacket(OPCODES.S2C_WELCOME, welcomePayload);
      ws.send(welcomePacket);
    }

    // 2. C2S_INPUT (Paquet binaire ultra-compact de 4 à 8 octets à 30-60 Hz)
    else if (opcode === OPCODES.C2S_INPUT && hasJoined) {
      const { angle, isBoosting, posX, posY } = BinaryProtocol.decodeInput(arrayBuffer);
      currentRoom.handlePlayerInput(playerId, angle, isBoosting, posX, posY);
    }

    // 3. C2S_PING (Calcul du temps de latence réseau aller-retour RTT)
    else if (opcode === OPCODES.C2S_PING) {
      const clientTime = BinaryProtocol.decodePing(arrayBuffer);
      // Répondre avec S2C_PONG
      const pongBuffer = new ArrayBuffer(9);
      const pongView = new DataView(pongBuffer);
      pongView.setUint8(0, OPCODES.S2C_PONG);
      pongView.setFloat64(1, clientTime, true);
      ws.send(pongBuffer);
    }
  });

  ws.on('close', () => {
    if (hasJoined) {
      currentRoom.removePlayer(playerId);
    }
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] Erreur joueur ${playerId}:`, err.message);
  });
});
