import { WebSocket } from 'ws';
import { Snake } from '../src/engine/snake';
import { BotController } from '../src/engine/bot';
import { FoodManager } from '../src/engine/food-manager';
import { CONFIG, SKINS } from '../src/config';
import { BinaryProtocol, NetFoodOrb, NetSnake, NetTickPayload, OPCODES } from '../src/shared/protocol';

interface ConnectedPlayer {
  id: string;
  name: string;
  ws: WebSocket;
  snake: Snake;
  lastInputTime: number;
}

export class GameRoom {
  private players: Map<string, ConnectedPlayer> = new Map();
  private bots: BotController[] = [];
  private foodManager: FoodManager;
  private tickCount: number = 0;
  private intervalId: NodeJS.Timeout | null = null;

  // Delta trackers pour la nourriture (évite d'envoyer 1200 orbes à chaque tick !)
  private addedFoodDelta: NetFoodOrb[] = [];
  private removedFoodIdsDelta: number[] = [];

  private nextBotId: number = 1;

  constructor() {
    this.foodManager = new FoodManager();
    this.initBots();
  }

  private initBots(): void {
    this.bots = [];
    for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
      this.spawnBot();
    }
  }

  private findSafeSpawnLocation(minDistance: number = 650): { x: number; y: number } {
    const maxAttempts = 35;
    const spawnRadius = CONFIG.WORLD_RADIUS * 0.75;
    const minDistSq = minDistance * minDistance;

    const allSnakes = this.getAllSnakes();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * spawnRadius;
      const candX = Math.cos(angle) * dist;
      const candY = Math.sin(angle) * dist;

      let isSafe = true;

      for (let i = 0; i < allSnakes.length; i++) {
        const snake = allSnakes[i];
        if (!snake.isAlive) continue;

        const dxHead = snake.x - candX;
        const dyHead = snake.y - candY;
        if (dxHead * dxHead + dyHead * dyHead < minDistSq) {
          isSafe = false;
          break;
        }

        const segs = snake.segments;
        for (let s = 0; s < segs.length; s += 3) {
          const seg = segs[s];
          const dx = seg.x - candX;
          const dy = seg.y - candY;
          if (dx * dx + dy * dy < minDistSq) {
            isSafe = false;
            break;
          }
        }

        if (!isSafe) break;
      }

      if (isSafe) {
        return { x: candX, y: candY };
      }
    }

    const fallbackAngle = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(fallbackAngle) * (CONFIG.WORLD_RADIUS * 0.6),
      y: Math.sin(fallbackAngle) * (CONFIG.WORLD_RADIUS * 0.6),
    };
  }

  private spawnBot(): void {
    const pos = this.findSafeSpawnLocation(600);
    const bot = new BotController(`bot_${this.nextBotId++}`, pos.x, pos.y);
    this.bots.push(bot);
  }

  public getAllSnakes(): Snake[] {
    const list: Snake[] = [];
    for (const p of this.players.values()) {
      if (p.snake.isAlive) {
        list.push(p.snake);
      }
    }
    for (let i = 0; i < this.bots.length; i++) {
      if (this.bots[i].snake.isAlive) {
        list.push(this.bots[i].snake);
      }
    }
    return list;
  }

  public addPlayer(id: string, name: string, skinIndex: number, ws: WebSocket): Snake {
    const safePos = this.findSafeSpawnLocation(700);
    const skin = SKINS[skinIndex % SKINS.length] || SKINS[0];
    const snake = new Snake(id, name, safePos.x, safePos.y, skin, false, CONFIG.INITIAL_MASS);

    this.players.set(id, {
      id,
      name,
      ws,
      snake,
      lastInputTime: Date.now(),
    });

    console.log(`[GameRoom] Joueur connecté : ${name} (${id}) à (${Math.round(safePos.x)}, ${Math.round(safePos.y)})`);
    return snake;
  }

  public removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      if (player.snake.isAlive) {
        // Faire tomber sa nourriture pour les autres joueurs
        this.foodManager.spawnCorpseFood(
          player.snake.x,
          player.snake.y,
          player.snake.segments,
          player.snake.skin.primaryColor
        );
      }
      this.players.delete(id);
      console.log(`[GameRoom] Joueur déconnecté : ${player.name} (${id})`);
    }
  }

  public handlePlayerInput(id: string, angle: number, isBoosting: boolean): void {
    const player = this.players.get(id);
    if (player && player.snake.isAlive) {
      player.snake.targetAngle = angle;
      player.snake.isBoosting = isBoosting;
      player.lastInputTime = Date.now();
    }
  }

  public start(): void {
    if (this.intervalId) return;
    const tickIntervalMs = 1000 / 30; // 30 Ticks par seconde

    this.intervalId = setInterval(() => {
      this.tick(tickIntervalMs / 1000);
    }, tickIntervalMs);

    console.log('[GameRoom] Simulation serveur démarrée à 30 Ticks/sec');
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(dt: number): void {
    this.tickCount++;
    this.addedFoodDelta = [];
    this.removedFoodIdsDelta = [];

    const allSnakes = this.getAllSnakes();

    // 1. Mettre à jour les serpents des joueurs humains
    for (const player of this.players.values()) {
      if (!player.snake.isAlive) continue;

      player.snake.update(
        dt,
        (x, y, color) => {
          const orb = this.foodManager.spawnBoostDrop(x, y, color);
          this.addedFoodDelta.push({
            id: orb.id,
            x: orb.x,
            y: orb.y,
            radius: orb.radius,
            value: orb.value,
            color: orb.color,
            colorIndex: orb.colorIndex,
          });
        }
      );

      // Si le joueur sort de l'arène
      if (!player.snake.isAlive) {
        this.handleSnakeDeath(player.snake, 'Bordure d\'Arène');
      }
    }

    // 2. Mettre à jour les bots IA
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      b.update(
        dt,
        allSnakes,
        this.foodManager,
        (x, y, color) => {
          const orb = this.foodManager.spawnBoostDrop(x, y, color);
          this.addedFoodDelta.push({
            id: orb.id,
            x: orb.x,
            y: orb.y,
            radius: orb.radius,
            value: orb.value,
            color: orb.color,
            colorIndex: orb.colorIndex,
          });
        }
      );

      // Si le bot meurt (bordure)
      if (!b.snake.isAlive) {
        this.handleSnakeDeath(b.snake, 'Bordure d\'Arène');
        this.bots.splice(i, 1);
        i--;
        setTimeout(() => this.spawnBot(), 2500);
      }
    }

    // 3. Détection de l'absorption d'orbes
    for (let s = 0; s < allSnakes.length; s++) {
      const snake = allSnakes[s];
      if (!snake.isAlive) continue;

      const eatRadius = snake.radius + 10;
      const nearbyOrbs = this.foodManager.getOrbsInRadius(snake.x, snake.y, eatRadius);

      for (let j = 0; j < nearbyOrbs.length; j++) {
        const orb = nearbyOrbs[j];
        snake.eatFood(orb.value);
        this.foodManager.removeOrb(orb);
        this.removedFoodIdsDelta.push(orb.id);
      }
    }

    // 4. Détection des collisions mortelles (Tête contre Corps adverse)
    for (let i = 0; i < allSnakes.length; i++) {
      const snakeA = allSnakes[i];
      if (!snakeA.isAlive) continue;

      for (let j = 0; j < allSnakes.length; j++) {
        if (i === j) continue;
        const snakeB = allSnakes[j];
        if (!snakeB.isAlive) continue;

        if (snakeB.checkHeadCollisionWithBody(snakeA.x, snakeA.y, snakeA.radius)) {
          snakeA.isAlive = false;
          snakeB.kills++;

          this.handleSnakeDeath(snakeA, snakeB.name);

          // Si c'est un bot éliminé, le retirer
          const botIdx = this.bots.findIndex(b => b.snake === snakeA);
          if (botIdx !== -1) {
            this.bots.splice(botIdx, 1);
            setTimeout(() => this.spawnBot(), 2500);
          }
          break;
        }
      }
    }

    // 5. Diffusion du Snapshot Binaire à tous les clients
    this.broadcastTick();
  }

  private handleSnakeDeath(deadSnake: Snake, killerName: string): void {
    // Éjection massive d'orbes
    this.foodManager.spawnCorpseFood(
      deadSnake.x,
      deadSnake.y,
      deadSnake.segments,
      deadSnake.skin.primaryColor
    );

    // Notifier le joueur s'il est humain
    const player = this.players.get(deadSnake.id);
    if (player && player.ws.readyState === WebSocket.OPEN) {
      const rank = this.getSnakeRank(deadSnake);
      const packet = BinaryProtocol.encodeJsonPacket(OPCODES.S2C_DEATH, {
        killerName,
        finalScore: deadSnake.mass,
        finalLength: deadSnake.segments.length,
        finalKills: deadSnake.kills,
        finalRank: rank,
      });
      player.ws.send(packet);
    }
  }

  private getSnakeRank(targetSnake: Snake): number {
    const all = this.getAllSnakes().sort((a, b) => b.mass - a.mass);
    const idx = all.findIndex(s => s === targetSnake);
    return idx === -1 ? all.length : idx + 1;
  }

  private broadcastTick(): void {
    if (this.players.size === 0) return;

    const allSnakes = this.getAllSnakes();

    // 1. Leaderboard global (calculé 1 seule fois par tick)
    const sortedSnakes = [...allSnakes].sort((a, b) => b.mass - a.mass);
    const maxShow = Math.min(10, sortedSnakes.length);
    const leaderboard = sortedSnakes.slice(0, maxShow).map(s => ({
      name: s.name,
      score: s.mass,
      isPlayer: !s.isBot,
    }));

    // Cache pour éviter de recréer les NetSnake si plusieurs joueurs les voient
    const netSnakeCache = new Map<string, NetSnake>();
    const getNetSnake = (s: Snake): NetSnake => {
      let cached = netSnakeCache.get(s.id);
      if (!cached) {
        cached = {
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
        };
        netSnakeCache.set(s.id, cached);
      }
      return cached;
    };

    // 2. Diffusion par Area of Interest (AOI) pour chaque joueur
    for (const player of this.players.values()) {
      if (player.ws.readyState !== WebSocket.OPEN) continue;

      const pSnake = player.snake;
      // Zone visible + marge de sécurité de 500px pour une apparition fluide
      const halfW = 2200;
      const halfH = 1500;
      const minX = pSnake.x - halfW;
      const maxX = pSnake.x + halfW;
      const minY = pSnake.y - halfH;
      const maxY = pSnake.y + halfH;

      // Le joueur local est TOUJOURS inclus
      const aoiSnakes: NetSnake[] = [getNetSnake(pSnake)];

      for (let i = 0; i < allSnakes.length; i++) {
        const other = allSnakes[i];
        if (other === pSnake) continue;

        // Test d'intersection AABB en O(1)
        if (
          other.maxX < minX ||
          other.minX > maxX ||
          other.maxY < minY ||
          other.minY > maxY
        ) {
          continue;
        }

        aoiSnakes.push(getNetSnake(other));
      }

      // Nourriture ajoutée dans l'AOI du joueur
      const aoiAddedFood = this.addedFoodDelta.filter(
        f => f.x >= minX && f.x <= maxX && f.y >= minY && f.y <= maxY
      );

      const payload: NetTickPayload = {
        tick: this.tickCount,
        snakes: aoiSnakes,
        addedFood: aoiAddedFood,
        removedFoodIds: this.removedFoodIdsDelta,
        leaderboard,
      };

      // Encodage binaire compact ultra-rapide (ArrayBuffer)
      const packet = BinaryProtocol.encodeTickBinary(payload);
      player.ws.send(packet);
    }
  }

  public getFullInitialFood(): NetFoodOrb[] {
    return this.foodManager.getAllOrbs().map(orb => ({
      id: orb.id,
      x: orb.x,
      y: orb.y,
      radius: orb.radius,
      value: orb.value,
      color: orb.color,
      colorIndex: orb.colorIndex,
    }));
  }
}
