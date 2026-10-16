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
import { CONFIG } from './config';
import type { LeaderboardEntry, SkinConfig } from './types';

class Game {
  private renderer!: GameRenderer;
  private foodManager!: FoodManager;
  private particleSystem!: ParticleSystem;
  private minimap!: Minimap;
  private hud!: HUD;
  private menu!: Menu;

  private player: Snake | null = null;
  private bots: BotController[] = [];
  private allSnakes: Snake[] = [];

  private isGameActive: boolean = false;
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
    this.menu = new Menu((name, skin) => this.startGame(name, skin));

    this.initInputListeners();

    // Démarrer la boucle de rendu
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private initBots(): void {
    this.bots = [];
    for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
      this.spawnBot();
    }
  }

  // Trouve un emplacement de spawn sécurisé, éloigné de tous les serpents vivants
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

        // Éloignement de la tête
        const dxHead = snake.x - candX;
        const dyHead = snake.y - candY;
        if (dxHead * dxHead + dyHead * dyHead < minDistSq) {
          isSafe = false;
          break;
        }

        // Éloignement des segments du corps
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

    // Emplacement de repli sûr
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
  }

  private startGame(playerName: string, skin: SkinConfig): void {
    if (this.bots.length === 0) {
      this.initBots();
    }

    const pos = this.findSafeSpawnLocation(700);
    this.player = new Snake('player', playerName, pos.x, pos.y, skin, false, CONFIG.INITIAL_MASS);
    this.isGameActive = true;
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

    // Mode menu d'accueil : rendu d'ambiance ultra-léger pour préserver les ressources CPU/GPU
    if (!this.isGameActive || !this.player || !this.player.isAlive) {
      this.renderer.updateCamera(0, 0, CONFIG.INITIAL_MASS, dt);
      this.renderer.renderFood(this.foodManager, time * 0.001);
      this.minimap.render(null, []);
      return;
    }

    // 1. Mettre à jour la direction du joueur (visée stable par rapport au centre de l'écran)
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = this.mouseScreenX - centerX;
    const dy = this.mouseScreenY - centerY;
    if (dx * dx + dy * dy > 80) {
      this.player.targetAngle = Math.atan2(dy, dx);
    }
    this.updatePlayerBoost();

    this.player.update(
      dt,
      (x, y, color) => this.foodManager.spawnBoostDrop(x, y, color),
      (x, y, angle, color) => this.particleSystem.emitBoostTrail(x, y, angle, color)
    );

    // Si le joueur heurte la frontière de l'arène
    if (!this.player.isAlive) {
      this.particleSystem.emitDeathExplosion(this.player.x, this.player.y, this.player.skin.primaryColor);
      this.foodManager.spawnCorpseFood(this.player.segments, this.player.skin.primaryColor);
      this.handlePlayerDeath();
      return;
    }

    // 2. Mettre à jour la liste des serpents actifs
    this.allSnakes = [this.player];
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      if (b.snake.isAlive) {
        this.allSnakes.push(b.snake);
      }
    }

    // 3. Mettre à jour les bots IA
    for (let i = 0; i < this.bots.length; i++) {
      const b = this.bots[i];
      b.update(
        dt,
        this.allSnakes,
        this.foodManager,
        (x, y, color) => this.foodManager.spawnBoostDrop(x, y, color),
        (x, y, angle, color) => this.particleSystem.emitBoostTrail(x, y, angle, color)
      );

      // Si le bot meurt
      if (!b.snake.isAlive) {
        this.particleSystem.emitDeathExplosion(b.snake.x, b.snake.y, b.snake.skin.primaryColor);
        this.foodManager.spawnCorpseFood(b.snake.segments, b.snake.skin.primaryColor);
        this.bots.splice(i, 1);
        i--;

        // Respawn dans une zone sécurisée après 2.5 secondes
        setTimeout(() => {
          if (this.isGameActive) this.spawnBot();
        }, 2500);
      }
    }

    // 4. Détection des collisions & absorption d'orbes
    for (let s = 0; s < this.allSnakes.length; s++) {
      const snake = this.allSnakes[s];
      if (!snake.isAlive) continue;

      const eatRadius = snake.radius + 10;
      const nearbyOrbs = this.foodManager.getOrbsInRadius(snake.x, snake.y, eatRadius);

      for (let j = 0; j < nearbyOrbs.length; j++) {
        const orb = nearbyOrbs[j];
        snake.eatFood(orb.value);
        this.foodManager.removeOrb(orb);

        if (snake === this.player) {
          soundManager.playEat(orb.value);
          this.particleSystem.emitEatEffect(orb.x, orb.y, orb.color);
        }
      }
    }

    // 5. Détection des collisions mortelles (Tête contre Corps d'un autre serpent)
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
          this.foodManager.spawnCorpseFood(snakeA.segments, snakeA.skin.primaryColor);

          if (snakeA === this.player) {
            this.handlePlayerDeath();
          } else if (snakeB === this.player) {
            soundManager.playKill();
          }
          break;
        }
      }
    }

    // 6. Mettre à jour les particules
    this.particleSystem.update(dt);

    // 7. Rendu graphique optimisé
    this.renderer.updateCamera(this.player.x, this.player.y, this.player.mass, dt);
    this.renderer.renderFood(this.foodManager, time * 0.001);
    this.renderer.renderParticles(this.particleSystem);
    this.renderer.renderSnakes(this.allSnakes);

    // 8. Rendu Minimap
    this.minimap.render(this.player, this.allSnakes);

    // 9. Mettre à jour le Leaderboard et les statistiques
    const rank = this.getPlayerRank();
    this.hud.updateStats(
      this.player.mass,
      this.player.segments.length,
      rank,
      this.allSnakes.length,
      this.player.kills
    );

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

// Initialisation au chargement du DOM
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init().catch(console.error);
});
