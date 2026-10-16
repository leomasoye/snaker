import './style.css';
import { GameRenderer } from './graphics/renderer';
import { FoodManager } from './engine/food-manager';
import { ParticleSystem } from './engine/particle-system';
import { Snake } from './engine/snake';
import { BotController } from './engine/bot';
import { Minimap } from './graphics/minimap';
import { HUD } from './ui/hud';
import { Menu } from './ui/menu';
import { soundManager } from './audio/sound';
import { CONFIG, SKINS } from './config';
import { angleDiff, normalizeAngle } from './engine/math';
import type { LeaderboardEntry, SkinConfig } from './types';
import { NetworkClient } from './network/client';
import type { NetTickPayload } from './shared/protocol';

class Game {
  private renderer!: GameRenderer;
  private foodManager!: FoodManager;
  private particleSystem!: ParticleSystem;
  private minimap!: Minimap;
  private hud!: HUD;
  private menu!: Menu;
  private networkClient!: NetworkClient;

  private player: Snake | null = null;
  private bots: BotController[] = [];
  private allSnakes: Snake[] = [];
  private remoteSnakes: Map<string, Snake> = new Map();

  private isGameActive: boolean = false;
  private isMultiplayer: boolean = false;
  private localPlayerId: string = 'player';

  private lastTime: number = performance.now();
  private mouseScreenX: number = 0;
  private mouseScreenY: number = 0;
  private isMouseDown: boolean = false;
  private isSpaceDown: boolean = false;

  private nextBotId: number = 1;

  public async init(): Promise<void> {
    const appEl = document.getElementById('canvas-container')!;

    this.renderer = new GameRenderer();
    await this.renderer.init(appEl);

    this.foodManager = new FoodManager();
    this.particleSystem = new ParticleSystem();

    const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.minimap = new Minimap(minimapCanvas);

    this.hud = new HUD();
    this.menu = new Menu(
      (name, skin, mode, roomId) => this.startGame(name, skin, mode, roomId),
      () => this.pauseToMenu()
    );

    this.initInputListeners();
    this.initNetwork();

    // Démarrer la boucle de rendu
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private initNetwork(): void {
    this.networkClient = new NetworkClient();

    this.networkClient.onStatusChange = (online: boolean) => {
      const pingEl = document.getElementById('hud-ping');
      const dotEl = document.querySelector('.status-dot') as HTMLElement;
      if (pingEl && dotEl) {
        if (online) {
          pingEl.textContent = 'En Ligne • Connecté';
          dotEl.style.background = '#39ff14';
          dotEl.style.boxShadow = '0 0 8px #39ff14';
        } else {
          pingEl.textContent = 'Solo (Hors-ligne)';
          dotEl.style.background = '#ffaa00';
          dotEl.style.boxShadow = '0 0 8px #ffaa00';
          this.isMultiplayer = false;
        }
      }
    };

    this.networkClient.onPing = (pingMs: number) => {
      const pingEl = document.getElementById('hud-ping');
      if (pingEl && this.networkClient.getIsOnline()) {
        pingEl.textContent = `En Ligne • ${pingMs} ms`;
      }
    };

    this.networkClient.onWelcome = (payload) => {
      this.isMultiplayer = true;
      this.localPlayerId = payload.playerId;
      console.log(`[Multiplayer] Identifiant assigné par le serveur : ${this.localPlayerId}`);
    };

    this.networkClient.onTick = (payload: NetTickPayload) => {
      if (!this.isMultiplayer || !this.isGameActive) return;
      this.handleServerTick(payload);
    };

    this.networkClient.onDeath = (payload) => {
      if (!this.player) return;
      this.isGameActive = false;
      soundManager.setBoostSound(false);
      soundManager.playDeath();

      setTimeout(() => {
        this.menu.showGameOverModal(
          payload.finalScore,
          payload.finalLength,
          payload.finalKills,
          payload.finalRank
        );
      }, 500);
    };

    this.networkClient.connect();
  }

  private handleServerTick(payload: NetTickPayload): void {
    // 1. Mettre à jour les orbes ajoutés et supprimés par le serveur (Delta synchro)
    for (let i = 0; i < payload.addedFood.length; i++) {
      const f = payload.addedFood[i];
      this.foodManager.spawnBoostDrop(f.x, f.y, f.color);
    }
    for (let i = 0; i < payload.removedFoodIds.length; i++) {
      const id = payload.removedFoodIds[i];
      const orb = this.foodManager.getAllOrbs().find(o => o.id === id);
      if (orb) this.foodManager.removeOrb(orb);
    }

    // 2. Synchroniser les serpents
    const activeServerIds = new Set<string>();

    for (let i = 0; i < payload.snakes.length; i++) {
      const netSnake = payload.snakes[i];
      activeServerIds.add(netSnake.id);

      if (netSnake.id === this.localPlayerId && this.player) {
        // Réconciliation locale : masse et éliminations autoritaires
        this.player.mass = netSnake.mass;
        this.player.kills = netSnake.kills;

        // Si divergence de position majeure (>120px) avec le serveur, recaler
        const distSq = (netSnake.x - this.player.x) ** 2 + (netSnake.y - this.player.y) ** 2;
        if (distSq > 14400) {
          this.player.x = netSnake.x;
          this.player.y = netSnake.y;
          this.player.angle = netSnake.angle;
        }
        continue;
      }

      // Serpents distants ou bots simulés sur le serveur
      let remote = this.remoteSnakes.get(netSnake.id);
      if (!remote) {
        const skin = SKINS.find(s => s.id === netSnake.skinId) || SKINS[0];
        remote = new Snake(netSnake.id, netSnake.name, netSnake.x, netSnake.y, skin, netSnake.isBot, netSnake.mass);
        remote.remoteTargetX = netSnake.x;
        remote.remoteTargetY = netSnake.y;
        remote.remoteTargetAngle = netSnake.angle;
        this.remoteSnakes.set(netSnake.id, remote);
      } else {
        const distSq = (netSnake.x - remote.x) ** 2 + (netSnake.y - remote.y) ** 2;
        if (distSq > 40000) {
          // Téléportation / respawn franc
          remote.x = netSnake.x;
          remote.y = netSnake.y;
          remote.angle = netSnake.angle;
        }
        remote.remoteTargetX = netSnake.x;
        remote.remoteTargetY = netSnake.y;
        remote.remoteTargetAngle = netSnake.angle;
      }

      remote.isAlive = netSnake.isAlive;
      remote.speed = netSnake.speed;
      remote.mass = netSnake.mass;
      remote.radius = netSnake.radius;
      remote.isBoosting = netSnake.isBoosting;
      remote.kills = netSnake.kills;

      // Synchroniser le nombre de segments
      while (remote.segments.length < netSnake.segments.length) {
        const tail = remote.segments[remote.segments.length - 1] || remote;
        remote.segments.push({ x: tail.x, y: tail.y, angle: remote.angle });
      }
      if (remote.segments.length > netSnake.segments.length) {
        remote.segments.length = netSnake.segments.length;
      }
    }

    // Supprimer les serpents qui ont quitté l'AOI ou sont morts
    for (const [id, snake] of this.remoteSnakes.entries()) {
      if (!activeServerIds.has(id)) {
        if (!snake.isAlive) {
          this.particleSystem.emitDeathExplosion(snake.x, snake.y, snake.skin.primaryColor);
        }
        this.remoteSnakes.delete(id);
      }
    }

    // 3. Mettre à jour le classement en direct
    this.hud.updateLeaderboard(payload.leaderboard);
  }

  private initBots(): void {
    this.bots = [];
    for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
      this.spawnBot();
    }
  }

  private findSafeSpawnLocation(minDistance: number = 650): { x: number; y: number } {
    const maxAttempts = 40;
    const spawnRadius = CONFIG.WORLD_RADIUS * 0.75;
    const minDistSq = minDistance * minDistance;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * spawnRadius;
      const candX = Math.cos(angle) * dist;
      const candY = Math.sin(angle) * dist;

      let isSafe = true;

      for (let i = 0; i < this.allSnakes.length; i++) {
        const snake = this.allSnakes[i];
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

  private initInputListeners(): void {
    window.addEventListener('mousemove', (e) => {
      this.mouseScreenX = e.clientX;
      this.mouseScreenY = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
        this.updatePlayerBoost();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
        this.updatePlayerBoost();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.isSpaceDown = true;
        this.updatePlayerBoost();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpaceDown = false;
        this.updatePlayerBoost();
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.mouseScreenX = e.touches[0].clientX;
        this.mouseScreenY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.mouseScreenX = e.touches[0].clientX;
        this.mouseScreenY = e.touches[0].clientY;
      }
      if (e.touches.length > 1) {
        this.isMouseDown = true;
        this.updatePlayerBoost();
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isMouseDown = false;
      this.updatePlayerBoost();
    });
  }

  private updatePlayerBoost(): void {
    if (!this.player || !this.player.isAlive) return;
    const shouldBoost = (this.isMouseDown || this.isSpaceDown) && this.player.mass > CONFIG.MIN_BOOST_MASS;
    this.player.isBoosting = shouldBoost;
    soundManager.setBoostSound(shouldBoost);

    if (this.isMultiplayer) {
      this.networkClient.sendInput(this.player.targetAngle, shouldBoost);
    }
  }

  private startGame(
    playerName: string,
    skin: SkinConfig,
    mode: 'multiplayer' | 'solo' = 'multiplayer',
    roomId: string = 'arena-alpha'
  ): void {
    const skinIndex = SKINS.findIndex(s => s.id === skin.id);

    if (mode === 'multiplayer' && this.networkClient.getIsOnline()) {
      this.isMultiplayer = true;
      this.networkClient.sendJoin(playerName, skinIndex !== -1 ? skinIndex : 0, roomId);
      const pos = this.findSafeSpawnLocation(700);
      this.player = new Snake(this.localPlayerId, playerName, pos.x, pos.y, skin, false, CONFIG.INITIAL_MASS);
      this.isGameActive = true;
    } else {
      this.isMultiplayer = false;
      this.remoteSnakes.clear();
      if (this.bots.length === 0) {
        this.initBots();
      }
      const pos = this.findSafeSpawnLocation(700);
      this.player = new Snake('player', playerName, pos.x, pos.y, skin, false, CONFIG.INITIAL_MASS);
      this.isGameActive = true;

      // Actualiser le HUD pour indiquer le mode solo
      const pingEl = document.getElementById('hud-ping');
      const dotEl = document.querySelector('.status-dot') as HTMLElement;
      if (pingEl && dotEl) {
        pingEl.textContent = 'Solo (Entraînement)';
        dotEl.style.background = '#00f0ff';
        dotEl.style.boxShadow = '0 0 8px #00f0ff';
      }
    }
  }

  private pauseToMenu(): void {
    this.isGameActive = false;
    soundManager.setBoostSound(false);
  }

  private handlePlayerDeath(): void {
    if (!this.player) return;
    this.isGameActive = false;
    soundManager.setBoostSound(false);
    soundManager.playDeath();

    const score = this.player.mass;
    const length = this.player.segments.length;
    const kills = this.player.kills;
    const rank = this.getPlayerRank();

    setTimeout(() => {
      this.menu.showGameOverModal(score, length, kills, rank);
    }, 600);
  }

  private getPlayerRank(): number {
    if (!this.player) return this.allSnakes.length;
    const sorted = [...this.allSnakes].sort((a, b) => b.mass - a.mass);
    const idx = sorted.findIndex(s => s === this.player);
    return idx === -1 ? sorted.length : idx + 1;
  }

  private gameLoop(time: number): void {
    requestAnimationFrame((t) => this.gameLoop(t));

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.hud.updateFPS();

    if (!this.isGameActive || !this.player || !this.player.isAlive) {
      this.renderer.updateCamera(0, 0, CONFIG.INITIAL_MASS, dt);
      this.renderer.renderFood(this.foodManager);
      this.minimap.render(null, []);
      return;
    }

    // 1. Mettre à jour la direction du joueur local avec prédiction immédiate
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = this.mouseScreenX - centerX;
    const dy = this.mouseScreenY - centerY;
    if (dx * dx + dy * dy > 80) {
      this.player.targetAngle = Math.atan2(dy, dx);
    }
    this.updatePlayerBoost();

    // Envoi des inputs à haute fréquence via le protocole binaire (4 octets)
    if (this.isMultiplayer) {
      this.networkClient.sendInput(this.player.targetAngle, this.player.isBoosting);
    }

    this.player.update(
      dt,
      (x, y, color) => this.foodManager.spawnBoostDrop(x, y, color),
      (x, y, angle, color) => this.particleSystem.emitBoostTrail(x, y, angle, color)
    );

    // Si le joueur sort de l'arène
    if (!this.player.isAlive) {
      this.particleSystem.emitDeathExplosion(this.player.x, this.player.y, this.player.skin.primaryColor);
      this.foodManager.spawnCorpseFood(this.player.x, this.player.y, this.player.segments, this.player.skin.primaryColor);
      this.handlePlayerDeath();
      return;
    }

    // 2. Rassembler la liste des serpents actifs (joueur + distants ou bots locaux)
    this.allSnakes = [this.player];

    if (this.isMultiplayer) {
      const lerpSpeed = Math.min(1.0, dt * 25);
      for (const remote of this.remoteSnakes.values()) {
        if (!remote.isAlive) continue;

        // Interpolation fluide tête (élimine les saccades inter-ticks 30Hz)
        remote.x += (remote.remoteTargetX - remote.x) * lerpSpeed;
        remote.y += (remote.remoteTargetY - remote.y) * lerpSpeed;
        const diff = angleDiff(remote.remoteTargetAngle, remote.angle);
        remote.angle = normalizeAngle(remote.angle + diff * lerpSpeed);

        // Suivi physique continue des segments à 60-144 FPS (Contrainte IK)
        let leaderX = remote.x;
        let leaderY = remote.y;
        const spacing = remote.segmentSpacing;
        for (let s = 0; s < remote.segments.length; s++) {
          const seg = remote.segments[s];
          const dx = leaderX - seg.x;
          const dy = leaderY - seg.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.001) {
            seg.x = leaderX - (dx / dist) * spacing;
            seg.y = leaderY - (dy / dist) * spacing;
            seg.angle = Math.atan2(dy, dx);
          }
          leaderX = seg.x;
          leaderY = seg.y;
        }
        remote.updateAABB();

        this.allSnakes.push(remote);
      }
    } else {
      // Mode solo local : mise à jour des bots locaux
      for (let i = 0; i < this.bots.length; i++) {
        const b = this.bots[i];
        if (b.snake.isAlive) {
          this.allSnakes.push(b.snake);
        }
      }

      for (let i = 0; i < this.bots.length; i++) {
        const b = this.bots[i];
        b.update(
          dt,
          this.allSnakes,
          this.foodManager,
          (x, y, color) => this.foodManager.spawnBoostDrop(x, y, color),
          (x, y, angle, color) => this.particleSystem.emitBoostTrail(x, y, angle, color)
        );

        if (!b.snake.isAlive) {
          this.particleSystem.emitDeathExplosion(b.snake.x, b.snake.y, b.snake.skin.primaryColor);
          this.foodManager.spawnCorpseFood(b.snake.x, b.snake.y, b.snake.segments, b.snake.skin.primaryColor);
          this.bots.splice(i, 1);
          i--;
          setTimeout(() => {
            if (this.isGameActive && !this.isMultiplayer) this.spawnBot();
          }, 2500);
        }
      }

      // Collisions mortelles en solo
      for (let i = 0; i < this.allSnakes.length; i++) {
        const snakeA = this.allSnakes[i];
        if (!snakeA.isAlive) continue;

        for (let j = 0; j < this.allSnakes.length; j++) {
          if (i === j) continue;
          const snakeB = this.allSnakes[j];
          if (!snakeB.isAlive) continue;

          if (snakeB.checkHeadCollisionWithBody(snakeA.x, snakeA.y, snakeA.radius)) {
            snakeA.isAlive = false;
            snakeB.kills++;

            this.particleSystem.emitDeathExplosion(snakeA.x, snakeA.y, snakeA.skin.primaryColor);
            this.foodManager.spawnCorpseFood(snakeA.x, snakeA.y, snakeA.segments, snakeA.skin.primaryColor);

            const botIdx = this.bots.findIndex(b => b.snake === snakeA);
            if (botIdx !== -1) {
              this.bots.splice(botIdx, 1);
              setTimeout(() => {
                if (this.isGameActive && !this.isMultiplayer) this.spawnBot();
              }, 2500);
            }

            if (snakeA === this.player) {
              this.handlePlayerDeath();
            } else if (snakeB === this.player) {
              soundManager.playKill();
            }
            break;
          }
        }
      }
    }

    // 3. Détection de l'absorption d'orbes pour le joueur local
    const eatRadius = this.player.radius + 10;
    const nearbyOrbs = this.foodManager.getOrbsInRadius(this.player.x, this.player.y, eatRadius);

    for (let j = 0; j < nearbyOrbs.length; j++) {
      const orb = nearbyOrbs[j];
      this.player.eatFood(orb.value);
      this.foodManager.removeOrb(orb);
      soundManager.playEat(orb.value);
      this.particleSystem.emitEatEffect(orb.x, orb.y, orb.color);
    }

    // 4. Mettre à jour les particules
    this.particleSystem.update(dt);

    // 5. Rendu graphique optimisé
    this.renderer.updateCamera(this.player.x, this.player.y, this.player.mass, dt);
    this.renderer.renderFood(this.foodManager);
    this.renderer.renderParticles(this.particleSystem);
    this.renderer.renderSnakes(this.allSnakes);

    // 6. Rendu Minimap
    if (Math.floor(time * 0.06) % 2 === 0) {
      this.minimap.render(this.player, this.allSnakes);
    }

    // 7. Mettre à jour les statistiques joueur dans le HUD
    const rank = this.getPlayerRank();
    this.hud.updateStats(
      this.player.mass,
      this.player.segments.length,
      rank,
      this.allSnakes.length,
      this.player.kills
    );

    if (!this.isMultiplayer) {
      const sortedLeaderboard: LeaderboardEntry[] = this.allSnakes
        .map(s => ({
          name: s.name,
          score: s.mass,
          isPlayer: s === this.player,
        }))
        .sort((a, b) => b.score - a.score);
      this.hud.updateLeaderboard(sortedLeaderboard);
    }
  }
}

// Initialisation au chargement du DOM
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init().catch(console.error);
});
