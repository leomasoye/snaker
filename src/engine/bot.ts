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
    // Poids de départ varié pour un écosystème dynamique
    const initialMass = Math.floor(randomRange(30, 160));

    this.snake = new Snake(id, name, x, y, skin, true, initialMass);
    this.changeDirTimer = randomRange(0.2, 0.6);
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
    if (distFromCenter > CONFIG.WORLD_RADIUS * 0.82) {
      this.snake.setTargetDirection(0, 0);
      this.snake.isBoosting = false;
      this.snake.update(dt, onDropFood, onBoostParticle);
      return;
    }

    // 2. Détection d'obstacles (corps des autres serpents) avec sonde avant
    let dangerFound = false;
    const lookAheadDist = 80 + this.snake.speed * 0.45;
    const probeX = this.snake.x + Math.cos(this.snake.angle) * lookAheadDist;
    const probeY = this.snake.y + Math.sin(this.snake.angle) * lookAheadDist;

    for (let i = 0; i < allSnakes.length; i++) {
      const other = allSnakes[i];
      if (!other.isAlive || other === this.snake) continue;

      if (other.checkHeadCollisionWithBody(probeX, probeY, this.snake.radius + 15)) {
        dangerFound = true;
        // Virer rapidement du côté opposé
        const turnRight = Math.sin(this.snake.angle) * (probeX - this.snake.x) > 0;
        const escapeAngle = this.snake.angle + (turnRight ? -Math.PI * 0.6 : Math.PI * 0.6);
        this.snake.targetAngle = escapeAngle;
        this.snake.isBoosting = true; // boost d'urgence réflexe
        this.boostCooldown = 1.0;
        break;
      }
    }

    if (!dangerFound) {
      // 3. Volonté accrue de grandir (Recherche active et fréquente d'orbes)
      const isHungry = this.snake.mass < 300;
      const recheckInterval = isHungry ? 0.3 : 0.7;

      if (this.changeDirTimer <= 0) {
        this.changeDirTimer = randomRange(recheckInterval * 0.8, recheckInterval * 1.3);

        const viewDistance = 750; // Rayon de perception étendu
        const nearbyOrbs = foodManager.getOrbsInRadius(this.snake.x, this.snake.y, viewDistance);

        if (nearbyOrbs.length > 0) {
          let bestOrb = nearbyOrbs[0];
          let bestScore = -1;

          const len = nearbyOrbs.length;
          // Échantillonner les orbes pour trouver la pépite la plus rentable
          for (let i = 0; i < len; i++) {
            const orb = nearbyOrbs[i];
            const d = distance(this.snake.x, this.snake.y, orb.x, orb.y);
            // Pondérer fortement les orbes de haute valeur (cadavres)
            const score = (orb.value * 180) / (d + 15);
            if (score > bestScore) {
              bestScore = score;
              bestOrb = orb;
            }
          }

          this.snake.setTargetDirection(bestOrb.x, bestOrb.y);

          // Sprint turbo pour manger rapidement si la cible est de haute valeur
          if (bestOrb.value >= 3 && this.snake.mass > 35 && this.boostCooldown <= 0) {
            this.snake.isBoosting = true;
            this.boostCooldown = randomRange(1.2, 2.5);
          } else if (this.boostCooldown <= 0) {
            this.snake.isBoosting = false;
          }
        } else {
          // Errance active orientée vers l'intérieur de l'arène
          const toCenterAngle = Math.atan2(-this.snake.y, -this.snake.x);
          const wanderAngle = toCenterAngle + (Math.random() - 0.5) * 1.4;
          this.snake.targetAngle = wanderAngle;
          this.snake.isBoosting = false;
        }
      }
    }

    this.snake.update(dt, onDropFood, onBoostParticle);
  }
}
