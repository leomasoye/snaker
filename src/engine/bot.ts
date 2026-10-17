import { Snake } from './snake';
import { FoodManager } from './food-manager';
import { CONFIG, SKINS } from '../config';
import { angleDiff, distance, normalizeAngle, randomRange } from './math';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

const EASY_BOT_NAMES = [
  'PixelBoa', 'SlowNoodle', 'ChillyWorm', 'BobaSnake', 'Sprout', 'SlothWorm', 'PuffTail'
];

const MEDIUM_BOT_NAMES = [
  'ShadowWorm', 'CyberSerpent', 'EchoViper', 'NovaFang', 'CosmoCobra', 'PulseDragon', 'AstralAnac'
];

const HARD_BOT_NAMES = [
  '⚡ ViperX', '👑 Chronos', '🔥 ApexTitan', '⚔️ Zenith', '⚡ NeonStalker', '🔥 QuantumPython', '💀 VoidReaper'
];

export class BotController {
  public snake: Snake;
  public difficulty: BotDifficulty;
  private changeDirTimer: number = 0;
  private boostCooldown: number = 0;

  // Cible de nourriture actuellement verrouillée pour un suivi fluide chaque frame
  private targetFoodX: number | null = null;
  private targetFoodY: number | null = null;
  private targetFoodValue: number = 0;

  constructor(id: string, x: number, y: number, difficulty?: BotDifficulty) {
    if (!difficulty) {
      const roll = Math.random();
      if (roll < 0.25) this.difficulty = 'easy';
      else if (roll < 0.75) this.difficulty = 'medium';
      else this.difficulty = 'hard';
    } else {
      this.difficulty = difficulty;
    }

    let name: string;
    let initialMass: number;

    if (this.difficulty === 'easy') {
      name = EASY_BOT_NAMES[Math.floor(Math.random() * EASY_BOT_NAMES.length)];
      initialMass = Math.floor(randomRange(35, 75));
    } else if (this.difficulty === 'medium') {
      name = MEDIUM_BOT_NAMES[Math.floor(Math.random() * MEDIUM_BOT_NAMES.length)];
      initialMass = Math.floor(randomRange(70, 160));
    } else {
      name = HARD_BOT_NAMES[Math.floor(Math.random() * HARD_BOT_NAMES.length)];
      initialMass = Math.floor(randomRange(150, 320));
    }

    const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
    this.snake = new Snake(id, name, x, y, skin, true, initialMass);
    this.changeDirTimer = randomRange(0.1, 0.4);
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

    // 2. Détection d'obstacles avec système de 3 sondes (moustache avant, gauche, droite)
    const speedMult = this.difficulty === 'hard' ? 0.55 : this.difficulty === 'medium' ? 0.45 : 0.35;
    const baseDist = this.difficulty === 'hard' ? 120 : this.difficulty === 'medium' ? 85 : 65;
    const lookAheadDist = baseDist + this.snake.speed * speedMult;

    // Sonde centrale
    const probeCenterX = this.snake.x + Math.cos(this.snake.angle) * lookAheadDist;
    const probeCenterY = this.snake.y + Math.sin(this.snake.angle) * lookAheadDist;

    // Sonde gauche
    const leftAngle = this.snake.angle - 0.45;
    const probeLeftX = this.snake.x + Math.cos(leftAngle) * (lookAheadDist * 0.85);
    const probeLeftY = this.snake.y + Math.sin(leftAngle) * (lookAheadDist * 0.85);

    // Sonde droite
    const rightAngle = this.snake.angle + 0.45;
    const probeRightX = this.snake.x + Math.cos(rightAngle) * (lookAheadDist * 0.85);
    const probeRightY = this.snake.y + Math.sin(rightAngle) * (lookAheadDist * 0.85);

    let centerBlocked = false;
    let leftBlocked = false;
    let rightBlocked = false;
    const hitRadius = this.snake.radius + 14;

    for (let i = 0; i < allSnakes.length; i++) {
      const other = allSnakes[i];
      if (!other.isAlive || other === this.snake) continue;

      if (!centerBlocked && other.checkHeadCollisionWithBody(probeCenterX, probeCenterY, hitRadius)) {
        centerBlocked = true;
      }
      if (!leftBlocked && other.checkHeadCollisionWithBody(probeLeftX, probeLeftY, hitRadius)) {
        leftBlocked = true;
      }
      if (!rightBlocked && other.checkHeadCollisionWithBody(probeRightX, probeRightY, hitRadius)) {
        rightBlocked = true;
      }

      if (centerBlocked && leftBlocked && rightBlocked) break;
    }

    let dangerFound = false;

    if (centerBlocked || leftBlocked || rightBlocked) {
      dangerFound = true;
      this.targetFoodX = null; // abandonner la nourriture en cas de danger

      if (centerBlocked) {
        if (!leftBlocked && rightBlocked) {
          // Virer à gauche
          this.snake.targetAngle = normalizeAngle(this.snake.angle - 1.25);
        } else if (!rightBlocked && leftBlocked) {
          // Virer à droite
          this.snake.targetAngle = normalizeAngle(this.snake.angle + 1.25);
        } else {
          // Si les deux côtés sont identiques, virer du côté le plus ouvert
          const turnLeft = Math.sin(this.snake.angle) > 0;
          this.snake.targetAngle = normalizeAngle(this.snake.angle + (turnLeft ? -1.35 : 1.35));
        }

        // Boost d'urgence pour les bots médium et hard
        if (this.difficulty !== 'easy' && this.snake.mass > 25) {
          this.snake.isBoosting = true;
          this.boostCooldown = 0.8;
        }
      } else if (leftBlocked) {
        // Obstacle sur le flanc gauche, dévier doucement à droite
        this.snake.targetAngle = normalizeAngle(this.snake.angle + 0.65);
      } else if (rightBlocked) {
        // Obstacle sur le flanc droit, dévier doucement à gauche
        this.snake.targetAngle = normalizeAngle(this.snake.angle - 0.65);
      }
    }

    // 3. Comportement offensif ou recherche de nourriture si aucun danger direct
    if (!dangerFound) {
      let didOffensiveAction = false;

      // Manœuvre agressive pour bots Hard (interception / couper la route)
      if (this.difficulty === 'hard') {
        let bestTargetSnake: Snake | null = null;
        let closestDist = 480;

        for (let i = 0; i < allSnakes.length; i++) {
          const other = allSnakes[i];
          if (!other.isAlive || other === this.snake) continue;

          const d = distance(this.snake.x, this.snake.y, other.x, other.y);
          if (d < closestDist) {
            // Vérifier si l'ennemi est devant nous
            const angleToEnemy = Math.atan2(other.y - this.snake.y, other.x - this.snake.x);
            const diff = Math.abs(angleDiff(angleToEnemy, this.snake.angle));
            if (diff < Math.PI * 0.45) {
              closestDist = d;
              bestTargetSnake = other;
            }
          }
        }

        if (bestTargetSnake) {
          // Calculer l'interception : prédire où sera la tête ennemie dans 0.45s
          const leadTime = 0.45;
          const leadDist = bestTargetSnake.speed * leadTime;
          const interceptX = bestTargetSnake.x + Math.cos(bestTargetSnake.angle) * leadDist;
          const interceptY = bestTargetSnake.y + Math.sin(bestTargetSnake.angle) * leadDist;

          // Se placer légèrement devant sa trajectoire pour couper sa route
          const cutOffsetAngle = bestTargetSnake.angle + Math.PI / 2;
          const cutX = interceptX + Math.cos(cutOffsetAngle) * (this.snake.radius * 1.5);
          const cutY = interceptY + Math.sin(cutOffsetAngle) * (this.snake.radius * 1.5);

          this.snake.setTargetDirection(cutX, cutY);
          this.snake.isBoosting = this.snake.mass > 40;
          didOffensiveAction = true;
        }
      }

      if (!didOffensiveAction) {
        // Recherche active et continue d'orbes
        const scanInterval = this.difficulty === 'hard' ? 0.25 : this.difficulty === 'medium' ? 0.45 : 0.8;

        if (this.changeDirTimer <= 0 || this.targetFoodX === null) {
          this.changeDirTimer = randomRange(scanInterval * 0.8, scanInterval * 1.25);

          const viewDistance = this.difficulty === 'hard' ? 950 : this.difficulty === 'medium' ? 700 : 450;
          const nearbyOrbs = foodManager.getOrbsInRadius(this.snake.x, this.snake.y, viewDistance);

          if (nearbyOrbs.length > 0) {
            let bestOrb = nearbyOrbs[0];
            let bestScore = -1;

            const len = nearbyOrbs.length;
            for (let i = 0; i < len; i++) {
              const orb = nearbyOrbs[i];
              const d = distance(this.snake.x, this.snake.y, orb.x, orb.y);
              // Multiplicateur très fort pour les orbes de cadavres
              const corpseMultiplier = orb.value >= 5 ? 2.5 : 1.0;
              const score = ((orb.value * 220) / (d + 20)) * corpseMultiplier;

              if (score > bestScore) {
                bestScore = score;
                bestOrb = orb;
              }
            }

            this.targetFoodX = bestOrb.x;
            this.targetFoodY = bestOrb.y;
            this.targetFoodValue = bestOrb.value;
          } else {
            this.targetFoodX = null;
            this.targetFoodY = null;

            // Errance active orientée vers l'intérieur de l'arène
            const toCenterAngle = Math.atan2(-this.snake.y, -this.snake.x);
            const wanderAngle = toCenterAngle + (Math.random() - 0.5) * 1.4;
            this.snake.targetAngle = wanderAngle;
            this.snake.isBoosting = false;
          }
        }

        // Suivi continu fluide chaque frame vers la cible d'orbe
        if (this.targetFoodX !== null && this.targetFoodY !== null) {
          this.snake.setTargetDirection(this.targetFoodX, this.targetFoodY);

          // Si l'orbe est atteint, réinitialiser pour cibler le suivant
          const distToFood = distance(this.snake.x, this.snake.y, this.targetFoodX, this.targetFoodY);
          if (distToFood < this.snake.radius + 15) {
            this.targetFoodX = null;
            this.targetFoodY = null;
            this.changeDirTimer = 0; // Rééchantillonner immédiatement
          }

          // Sprint turbo pour manger rapidement les orbes massifs de cadavres
          const boostMinVal = this.difficulty === 'hard' ? 3 : 5;
          if (
            this.difficulty !== 'easy' &&
            this.targetFoodValue >= boostMinVal &&
            this.snake.mass > 35 &&
            this.boostCooldown <= 0
          ) {
            this.snake.isBoosting = true;
            this.boostCooldown = randomRange(1.0, 2.2);
          } else if (this.boostCooldown <= 0) {
            this.snake.isBoosting = false;
          }
        }
      }
    }

    this.snake.update(dt, onDropFood, onBoostParticle);
  }
}
