import type { Segment, SkinConfig } from '../types';
import { CONFIG } from '../config';
import { angleDiff, clamp, distanceSq, normalizeAngle } from './math';

export class Snake {
  public id: string;
  public name: string;
  public isBot: boolean;
  public skin: SkinConfig;
  public isAlive: boolean = true;

  // Position et cinématique de la tête
  public x: number;
  public y: number;
  public angle: number;
  public targetAngle: number;
  public speed: number = CONFIG.BASE_SPEED;

  // Propriétés de taille & masse
  public mass: number;
  public radius: number = CONFIG.BASE_RADIUS;
  public segmentSpacing: number = CONFIG.SEGMENT_SPACING;

  // Segments du corps
  public segments: Segment[] = [];

  // Système de croissance progressive lors de l'avancement
  public pendingGrowth: number = 0;
  private growthDistAccumulator: number = 0;

  // Boost
  public isBoosting: boolean = false;
  private boostDropTimer: number = 0;

  // Statistiques
  public kills: number = 0;

  constructor(
    id: string,
    name: string,
    x: number,
    y: number,
    skin: SkinConfig,
    isBot: boolean = false,
    initialMass: number = CONFIG.INITIAL_MASS
  ) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.skin = skin;
    this.isBot = isBot;
    this.mass = initialMass;

    this.updateRadius();

    // Initialiser les segments alignés derrière la tête
    const initialSegments = this.getDesiredSegmentCount();
    for (let i = 0; i < initialSegments; i++) {
      const d = (i + 1) * this.segmentSpacing;
      this.segments.push({
        x: this.x - Math.cos(this.angle) * d,
        y: this.y - Math.sin(this.angle) * d,
        angle: this.angle,
      });
    }

    this.updateAABB();
  }

  // Échelle équilibrée : la longueur croît de façon continue avec la racine carrée de la masse
  public getDesiredSegmentCount(): number {
    return Math.floor(CONFIG.BASE_SEGMENT_COUNT + Math.sqrt(this.mass) * 5.5);
  }

  public updateRadius(): void {
    this.radius = clamp(
      CONFIG.BASE_RADIUS + Math.sqrt(this.mass) * CONFIG.MASS_TO_RADIUS_FACTOR,
      CONFIG.BASE_RADIUS,
      CONFIG.MAX_RADIUS
    );
    this.segmentSpacing = this.radius * 0.45;
  }

  public setTargetDirection(targetX: number, targetY: number): void {
    this.targetAngle = Math.atan2(targetY - this.y, targetX - this.x);
  }

  public update(
    dt: number,
    onDropFood?: (x: number, y: number, color: number) => void,
    onBoostParticle?: (x: number, y: number, angle: number, color: number) => void
  ): void {
    if (!this.isAlive) return;

    // 1. Vitesse et consommation de masse en boost
    const canBoost = this.isBoosting && this.mass > CONFIG.MIN_BOOST_MASS;
    this.speed = canBoost ? CONFIG.BOOST_SPEED : CONFIG.BASE_SPEED;

    if (canBoost) {
      this.mass -= CONFIG.BOOST_MASS_CONSUMPTION_RATE * dt;
      this.updateRadius();

      // En boost, réduire progressivement les segments excédentaires
      const targetSegs = this.getDesiredSegmentCount();
      if (this.segments.length > targetSegs + 2) {
        this.segments.pop();
      }

      // Éjection d'orbes derrière la queue
      this.boostDropTimer += dt;
      if (this.boostDropTimer >= 0.12) {
        this.boostDropTimer = 0;
        const tail = this.segments[this.segments.length - 1];
        if (tail && onDropFood) {
          onDropFood(tail.x, tail.y, this.skin.primaryColor);
        }
      }

      // Particules de boost
      if (onBoostParticle && this.segments.length > 0) {
        const tail = this.segments[this.segments.length - 1];
        onBoostParticle(tail.x, tail.y, tail.angle, this.skin.accentColor);
      }
    } else {
      this.boostDropTimer = 0;
    }

    // 2. Croissance progressive : Nouveaux segments ajoutés UNIQUEMENT lorsque le serpent avance
    const moveDistTotal = this.speed * dt;
    this.growthDistAccumulator += moveDistTotal;

    const maxSegments = this.getDesiredSegmentCount();
    while (
      this.growthDistAccumulator >= this.segmentSpacing &&
      this.pendingGrowth >= 1 &&
      this.segments.length < maxSegments + 30
    ) {
      this.growthDistAccumulator -= this.segmentSpacing;
      this.pendingGrowth -= 1;
      const tail = this.segments[this.segments.length - 1];
      if (tail) {
        // Le segment reste au sol pendant que le reste du serpent avance
        this.segments.push({
          x: tail.x,
          y: tail.y,
          angle: tail.angle,
        });
      }
    }

    // 3. Intégration physique par sous-étapes (Sub-stepping pour zéro saccade)
    const subSteps = canBoost ? 3 : 2;
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      // Rotation angulaire proportionnelle
      const diff = angleDiff(this.targetAngle, this.angle);
      const turnRate = CONFIG.TURN_SPEED * (canBoost ? 1.15 : 1.0);
      const maxTurn = turnRate * subDt;
      this.angle = normalizeAngle(this.angle + clamp(diff, -maxTurn, maxTurn));

      // Avancement de la tête
      const moveDist = this.speed * subDt;
      this.x += Math.cos(this.angle) * moveDist;
      this.y += Math.sin(this.angle) * moveDist;

      // Suivi géométrique continu des segments (Contrainte de distance IK)
      let leaderX = this.x;
      let leaderY = this.y;

      const segLen = this.segments.length;
      const spacing = this.segmentSpacing;

      for (let i = 0; i < segLen; i++) {
        const seg = this.segments[i];
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
    }

    // 4. Vérification collision bordure du monde circulaire
    if (this.x * this.x + this.y * this.y > CONFIG.WORLD_RADIUS * CONFIG.WORLD_RADIUS) {
      this.isAlive = false;
    }

    // 5. Mettre à jour la Bounding Box pour le Broadphase des collisions
    this.updateAABB();
  }

  // Bounding box Axis-Aligned pour éliminer 95% des tests de collisions à distance
  public minX: number = 0;
  public maxX: number = 0;
  public minY: number = 0;
  public maxY: number = 0;

  public updateAABB(): void {
    let minX = this.x;
    let maxX = this.x;
    let minY = this.y;
    let maxY = this.y;

    const segs = this.segments;
    const len = segs.length;
    for (let i = 0; i < len; i += 2) {
      const s = segs[i];
      if (s.x < minX) minX = s.x;
      else if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      else if (s.y > maxY) maxY = s.y;
    }

    const pad = this.radius + 30;
    this.minX = minX - pad;
    this.maxX = maxX + pad;
    this.minY = minY - pad;
    this.maxY = maxY + pad;
  }

  public eatFood(value: number): void {
    this.mass += value;
    this.updateRadius();
    // Accumulation de croissance : se déploie au fur et à mesure que le serpent avance
    this.pendingGrowth += value * 0.45;
  }

  public checkHeadCollisionWithBody(otherHeadX: number, otherHeadY: number, otherHeadRadius: number): boolean {
    if (!this.isAlive) return false;

    // 1. Broadphase AABB ultra-rapide en O(1)
    if (
      otherHeadX < this.minX ||
      otherHeadX > this.maxX ||
      otherHeadY < this.minY ||
      otherHeadY > this.maxY
    ) {
      return false;
    }

    // 2. Narrowphase : tester les segments par pas de 2
    const startIdx = 4;
    const threshold = this.radius * 0.8 + otherHeadRadius * 0.8;
    const thresholdSq = threshold * threshold;
    const len = this.segments.length;

    for (let i = startIdx; i < len; i += 2) {
      const seg = this.segments[i];
      if (distanceSq(otherHeadX, otherHeadY, seg.x, seg.y) < thresholdSq) {
        return true;
      }
    }
    return false;
  }
}
