import type { FoodOrb } from '../types';
import { CONFIG } from '../config';
import { SpatialGrid } from './spatial-grid';
import { getRandomVibrantColor, randomRange } from './math';

export class FoodManager {
  private orbs: FoodOrb[] = [];
  private grid: SpatialGrid<FoodOrb>;
  private nextId: number = 1;

  constructor() {
    this.grid = new SpatialGrid<FoodOrb>(CONFIG.FOOD_CELL_SIZE);
    this.initWorldFood();
  }

  private initWorldFood(): void {
    for (let i = 0; i < CONFIG.FOOD_COUNT; i++) {
      this.spawnRandomOrb();
    }
  }

  public spawnRandomOrb(): FoodOrb {
    // Coordonnées aléatoires à l'intérieur du disque de l'arène
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (CONFIG.WORLD_RADIUS * 0.95);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    const value = Math.floor(randomRange(CONFIG.MIN_FOOD_VALUE, CONFIG.MAX_FOOD_VALUE + 0.99));
    const radius = 3.5 + value * 1.5;
    const color = getRandomVibrantColor();

    const orb: FoodOrb = {
      id: this.nextId++,
      x,
      y,
      radius,
      value,
      color,
      glowColor: `#${color.toString(16).padStart(6, '0')}`,
      phase: Math.random() * Math.PI * 2,
    };

    this.orbs.push(orb);
    this.grid.insert(orb);
    return orb;
  }

  public spawnBoostDrop(x: number, y: number, color: number): FoodOrb {
    const orb: FoodOrb = {
      id: this.nextId++,
      x: x + randomRange(-4, 4),
      y: y + randomRange(-4, 4),
      radius: 4.5,
      value: CONFIG.BOOST_DROP_VALUE,
      color,
      glowColor: `#${color.toString(16).padStart(6, '0')}`,
      phase: Math.random() * Math.PI * 2,
      isBoostDrop: true,
    };

    this.orbs.push(orb);
    this.grid.insert(orb);
    return orb;
  }

  public spawnCorpseFood(segments: { x: number; y: number }[], color: number): void {
    // Pour chaque segment ou tous les 2 segments, faire jaillir de gros orbes brillants
    const step = Math.max(1, Math.floor(segments.length / 40));
    for (let i = 0; i < segments.length; i += step) {
      const seg = segments[i];
      const count = Math.floor(randomRange(1, 3));
      for (let j = 0; j < count; j++) {
        const value = Math.floor(randomRange(4, 10));
        const orb: FoodOrb = {
          id: this.nextId++,
          x: seg.x + randomRange(-15, 15),
          y: seg.y + randomRange(-15, 15),
          radius: 6 + value * 1.2,
          value,
          color,
          glowColor: `#${color.toString(16).padStart(6, '0')}`,
          phase: Math.random() * Math.PI * 2,
        };
        this.orbs.push(orb);
        this.grid.insert(orb);
      }
    }
  }

  public removeOrb(orb: FoodOrb): void {
    this.grid.remove(orb);
    const index = this.orbs.indexOf(orb);
    if (index !== -1) {
      // Fast swap and pop pour éviter le décalage de tout le tableau
      const last = this.orbs.pop()!;
      if (index < this.orbs.length) {
        this.orbs[index] = last;
      }
    }

    // Réapprovisionner les orbes de base pour garder la carte dense
    if (this.orbs.length < CONFIG.FOOD_COUNT) {
      this.spawnRandomOrb();
    }
  }

  public getOrbsInRadius(x: number, y: number, radius: number): FoodOrb[] {
    return this.grid.queryRadius(x, y, radius);
  }

  public getOrbsInRect(minX: number, minY: number, maxX: number, maxY: number): FoodOrb[] {
    return this.grid.queryRect(minX, minY, maxX, maxY);
  }

  public getAllOrbs(): readonly FoodOrb[] {
    return this.orbs;
  }
}
