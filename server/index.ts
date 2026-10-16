import { WebSocketServer, WebSocket } from 'ws';
import { GameRoom } from './game-room';
import { BinaryProtocol, NetWelcomePayload, OPCODES } from '../src/shared/protocol';
import { CONFIG } from '../src/config';

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });
const gameRoom = new GameRoom();

let nextPlayerNumber = 1;

console.log(`===============================================`);
console.log(`  SNAKER SERVEUR MULTIJOUEUR TEMPS RÉEL ACTIF  `);
console.log(`  Port: ${PORT} | Tickrate: 30 Ticks/sec         `);
console.log(`===============================================`);

gameRoom.start();

wss.on('connection', (ws: WebSocket) => {
  const playerId = `p_${nextPlayerNumber++}`;
  let hasJoined = false;

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

    // 1. C2S_JOIN
    if (opcode === OPCODES.C2S_JOIN) {
      const { name, skinIndex } = BinaryProtocol.decodeJoin(arrayBuffer);
      const snake = gameRoom.addPlayer(playerId, name, skinIndex, ws);
      hasJoined = true;

      // Envoyer le paquet WELCOME avec l'état complet initial
      const welcomePayload: NetWelcomePayload = {
        playerId,
        worldRadius: CONFIG.WORLD_RADIUS,
        snakes: gameRoom.getAllSnakes().map(s => ({
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
        food: gameRoom.getFullInitialFood(),
      };

      const welcomePacket = BinaryProtocol.encodeJsonPacket(OPCODES.S2C_WELCOME, welcomePayload);
      ws.send(welcomePacket);
    }

    // 2. C2S_INPUT (Paquet binaire ultra-compact de 4 octets à 30-60 Hz)
    else if (opcode === OPCODES.C2S_INPUT && hasJoined) {
      const { angle, isBoosting } = BinaryProtocol.decodeInput(arrayBuffer);
      gameRoom.handlePlayerInput(playerId, angle, isBoosting);
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
      gameRoom.removePlayer(playerId);
    }
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket] Erreur joueur ${playerId}:`, err.message);
  });
});
