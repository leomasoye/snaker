import { Snake } from './snake';
import { FoodManager } from './food-manager';
import { CONFIG, SKINS } from '../config';
import { distance, randomRange } from './math';

const BOT_NAMES = [
  'ViperX', 'ShadowWorm', 'NeonStalker', 'CosmoCobra', 'PixelBoa',
  'QuantumPython', 'NovaFang', 'TitanGlow', 'CyberSerpent', 'Zenith',
  'PulseDragon', 'AstralAnac', 'HyperTail', 'EchoViper', 'Chronos'
];

export class BotController {
  public snake: Snake;
  private changeDirTimer: number = 0;
  private boostCooldown: number = 0;

  constructor(id: string, x: number, y: number) {
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
    const initialMass = Math.floor(randomRange(25, 120));

    this.snake = new Snake(id, name, x, y, skin, true, initialMass);
    this.changeDirTimer = randomRange(1, 3);
  }

  public update(
    dt: number,
    allSnakes: Snake[],
    foodManager: FoodManager,
    onDropFood?: (x: number, y: number, color: number) => void,
    onBoostParticle?: (x: number, y: number, angle: number, color: number) => void
  ): void {
    if (!this.snake.isAlive) return;

    this.changeDirTimer -= dt;
    this.boostCooldown -= dt;

    // 1. Évitement de la frontière de l'arène (priorité absolue)
    const distFromCenter = Math.hypot(this.snake.x, this.snake.y);
    if (distFromCenter > CONFIG.WORLD_RADIUS * 0.85) {
      // Revenir vers le centre de l'arène (0, 0)
      this.snake.setTargetDirection(0, 0);
      this.snake.isBoosting = false;
      this.snake.update(dt, onDropFood, onBoostParticle);
      return;
    }

    // 2. Détection d'obstacles (corps des autres serpents)
    let dangerFound = false;
    const lookAheadDist = 80 + this.snake.speed * 0.4;
    const probeX = this.snake.x + Math.cos(this.snake.angle) * lookAheadDist;
    const probeY = this.snake.y + Math.sin(this.snake.angle) * lookAheadDist;

    for (const other of allSnakes) {
      if (!other.isAlive) continue;
      // Ne pas vérifier la tête avec nos propres segments proches
      if (other.checkHeadCollisionWithBody(probeX, probeY, this.snake.radius + 15)) {
        dangerFound = true;
        // Virer brusquement à gauche ou à droite
        const turnRight = Math.sin(this.snake.angle) * (probeX - this.snake.x) > 0;
        const escapeAngle = this.snake.angle + (turnRight ? -Math.PI * 0.55 : Math.PI * 0.55);
        this.snake.targetAngle = escapeAngle;
        this.snake.isBoosting = true; // boost d'urgence pour s'échapper
        break;
      }
    }

    if (!dangerFound) {
      // 3. Recherche de nourriture
      if (this.changeDirTimer <= 0) {
        this.changeDirTimer = randomRange(0.8, 2.0);

        const nearbyOrbs = foodManager.getOrbsInRadius(this.snake.x, this.snake.y, CONFIG.BOT_VIEW_DISTANCE);
        if (nearbyOrbs.length > 0) {
          // Trouver l'orbe avec le meilleur ratio valeur / distance
          let bestOrb = nearbyOrbs[0];
          let bestScore = -1;

          for (const orb of nearbyOrbs) {
            const d = distance(this.snake.x, this.snake.y, orb.x, orb.y);
            const score = (orb.value * 100) / (d + 20);
            if (score > bestScore) {
              bestScore = score;
              bestOrb = orb;
            }
          }

          this.snake.setTargetDirection(bestOrb.x, bestOrb.y);

          // Si c'est un orbe de grande valeur et qu'on est assez lourd, activer le boost
          if (bestOrb.value >= 4 && this.snake.mass > 40 && this.boostCooldown <= 0) {
            this.snake.isBoosting = true;
            this.boostCooldown = randomRange(2.0, 4.0);
          } else {
            this.snake.isBoosting = false;
          }
        } else {
          // Navigation d'ambiance aléatoire
          const wanderAngle = this.snake.angle + (Math.random() - 0.5) * 1.2;
          this.snake.targetAngle = wanderAngle;
          this.snake.isBoosting = false;
        }
      }
    }

    this.snake.update(dt, onDropFood, onBoostParticle);
  }
}
