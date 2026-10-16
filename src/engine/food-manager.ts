import type { FoodOrb } from '../types';
import { CONFIG } from '../config';
import { SpatialGrid } from './spatial-grid';
import { getColorIndex, getRandomVibrantColorIndex, randomRange } from './math';

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
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (CONFIG.WORLD_RADIUS * 0.95);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;

    const value = Math.floor(randomRange(CONFIG.MIN_FOOD_VALUE, CONFIG.MAX_FOOD_VALUE + 0.99));
    const radius = 3.5 + value * 1.4;
    const { color, index: colorIndex } = getRandomVibrantColorIndex();

    const orb: FoodOrb = {
      id: this.nextId++,
      x,
      y,
      radius,
      value,
      color,
      colorIndex,
      glowColor: `#${color.toString(16).padStart(6, '0')}`,
      phase: Math.random() * Math.PI * 2,
    };

    this.orbs.push(orb);
    this.grid.insert(orb);
    return orb;
  }

  public spawnBoostDrop(x: number, y: number, color: number): FoodOrb {
    const colorIndex = getColorIndex(color);
    const orb: FoodOrb = {
      id: this.nextId++,
      x: x + randomRange(-4, 4),
      y: y + randomRange(-4, 4),
      radius: 4.5,
      value: CONFIG.BOOST_DROP_VALUE,
      color,
      colorIndex,
      glowColor: `#${color.toString(16).padStart(6, '0')}`,
      phase: Math.random() * Math.PI * 2,
      isBoostDrop: true,
    };

    this.orbs.push(orb);
    this.grid.insert(orb);
    return orb;
  }

  private createOrbAt(x: number, y: number, value: number, color: number): FoodOrb {
    const colorIndex = getColorIndex(color);
    const orb: FoodOrb = {
      id: this.nextId++,
      x,
      y,
      radius: 5.5 + Math.min(value, 8) * 1.2,
      value,
      color,
      colorIndex,
      glowColor: `#${color.toString(16).padStart(6, '0')}`,
      phase: Math.random() * Math.PI * 2,
    };
    this.orbs.push(orb);
    this.grid.insert(orb);
    return orb;
  }

  // Éjection garantie d'orbes massifs à la mort du serpent, même s'il vient de naître !
  public spawnCorpseFood(headX: number, headY: number, segments: { x: number; y: number }[], color: number): FoodOrb[] {
    const created: FoodOrb[] = [];
    // 1. Explosion garantie de 10 à 15 orbes autour de la tête
    const headCount = Math.floor(randomRange(10, 16));
    for (let k = 0; k < headCount; k++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = randomRange(6, 45);
      const value = Math.floor(randomRange(4, 8));
      created.push(this.createOrbAt(
        headX + Math.cos(angle) * dist,
        headY + Math.sin(angle) * dist,
        value,
        color
      ));
    }

    // 2. Orbes le long des anneaux du corps (avec un minimum de 12 orbes le long de la colonne)
    const segCount = segments.length;
    if (segCount > 0) {
      const step = Math.max(1, Math.floor(segCount / 20));
      for (let i = 0; i < segCount; i += step) {
        const seg = segments[i];
        const count = Math.floor(randomRange(1, 3));
        for (let j = 0; j < count; j++) {
          const value = Math.floor(randomRange(3, 7));
          created.push(this.createOrbAt(
            seg.x + randomRange(-16, 16),
            seg.y + randomRange(-16, 16),
            value,
            color
          ));
        }
      }
    }
    return created;
  }

  public removeOrb(orb: FoodOrb): FoodOrb | null {
    this.grid.remove(orb);
    const index = this.orbs.indexOf(orb);
    if (index !== -1) {
      const last = this.orbs.pop()!;
      if (index < this.orbs.length) {
        this.orbs[index] = last;
      }
    }

    if (this.orbs.length < CONFIG.FOOD_COUNT) {
      return this.spawnRandomOrb();
    }
    return null;
  }

  public clearAll(): void {
    this.orbs = [];
    this.grid = new SpatialGrid<FoodOrb>(CONFIG.FOOD_CELL_SIZE);
  }

  public setOrbs(newOrbs: FoodOrb[]): void {
    this.clearAll();
    for (let i = 0; i < newOrbs.length; i++) {
      const o = newOrbs[i];
      this.orbs.push(o);
      this.grid.insert(o);
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
