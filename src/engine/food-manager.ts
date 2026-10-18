import type { FoodOrb } from '../types';
import { CONFIG } from '../config';
import { SpatialGrid } from './spatial-grid';
import { getColorIndex, getRandomVibrantColorIndex, randomRange, VIBRANT_PALETTE } from './math';

export class FoodManager {
  private orbs: FoodOrb[] = [];
  private idMap: Map<number, FoodOrb> = new Map();
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
    this.idMap.set(orb.id, orb);
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
    this.idMap.set(orb.id, orb);
    this.grid.insert(orb);
    return orb;
  }

  public getOrbById(id: number): FoodOrb | undefined {
    return this.idMap.get(id);
  }

  public addServerOrb(f: {
    id: number;
    x: number;
    y: number;
    radius: number;
    value: number;
    color?: number;
    colorIndex?: number;
  }): FoodOrb {
    const existing = this.idMap.get(f.id);
    if (existing) {
      return existing;
    }

    const orbColor = f.color !== undefined
      ? f.color
      : (f.colorIndex !== undefined ? (VIBRANT_PALETTE[f.colorIndex] || 0x00f0ff) : 0x00f0ff);
    const orbColorIndex = f.colorIndex !== undefined ? f.colorIndex : getColorIndex(orbColor);

    const orb: FoodOrb = {
      id: f.id,
      x: f.x,
      y: f.y,
      radius: f.radius,
      value: f.value,
      color: orbColor,
      colorIndex: orbColorIndex,
      glowColor: `#${orbColor.toString(16).padStart(6, '0')}`,
      phase: Math.random() * Math.PI * 2,
    };

    this.orbs.push(orb);
    this.idMap.set(orb.id, orb);
    this.grid.insert(orb);
    return orb;
  }

  public createOrbAt(x: number, y: number, value: number, color: number, customRadius?: number): FoodOrb {
    const colorIndex = getColorIndex(color);
    const radius = customRadius !== undefined ? customRadius : Math.min(22, 5.5 + Math.sqrt(value) * 3.2);
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
    this.idMap.set(orb.id, orb);
    this.grid.insert(orb);
    return orb;
  }

  // Éjection massive et généreuse d'orbes imposants à la mort du serpent
  public spawnCorpseFood(
    headX: number,
    headY: number,
    segments: { x: number; y: number }[],
    color: number,
    mass: number = 100
  ): FoodOrb[] {
    const created: FoodOrb[] = [];
    const totalRewardMass = Math.max(90, Math.floor(mass * 0.72));

    // 1. Explosion massive de 12 à 18 gros orbes autour de la tête
    const headFoodQuota = Math.floor(totalRewardMass * 0.38);
    const headCount = Math.floor(randomRange(12, 19));
    const avgHeadVal = Math.max(5, Math.floor(headFoodQuota / headCount));

    for (let k = 0; k < headCount; k++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = randomRange(8, 55);
      const value = Math.max(4, Math.floor(randomRange(avgHeadVal * 0.7, avgHeadVal * 1.35)));
      const orbRadius = Math.min(22, 5.5 + Math.sqrt(value) * 3.2);

      created.push(this.createOrbAt(
        headX + Math.cos(angle) * dist,
        headY + Math.sin(angle) * dist,
        value,
        color,
        orbRadius
      ));
    }

    // 2. Orbes denses et massifs le long des anneaux du corps
    const segCount = segments.length;
    if (segCount > 0) {
      const bodyFoodQuota = totalRewardMass - headFoodQuota;
      // Densité adaptée selon la longueur du serpent
      const step = Math.max(1, Math.floor(segCount / 24));
      const dropsAlongBody = Math.floor(segCount / step);
      const avgBodyVal = Math.max(4, Math.floor(bodyFoodQuota / Math.max(1, dropsAlongBody * 1.5)));

      for (let i = 0; i < segCount; i += step) {
        const seg = segments[i];
        const count = Math.floor(randomRange(1, 3));
        for (let j = 0; j < count; j++) {
          const value = Math.max(3, Math.floor(randomRange(avgBodyVal * 0.7, avgBodyVal * 1.4)));
          const orbRadius = Math.min(20, 5.0 + Math.sqrt(value) * 3.0);

          created.push(this.createOrbAt(
            seg.x + randomRange(-18, 18),
            seg.y + randomRange(-18, 18),
            value,
            color,
            orbRadius
          ));
        }
      }
    }

    return created;
  }

  public removeOrb(orb: FoodOrb): FoodOrb | null {
    this.grid.remove(orb);
    this.idMap.delete(orb.id);
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

  public removeOrbById(id: number): FoodOrb | null {
    const orb = this.idMap.get(id);
    if (orb) {
      return this.removeOrb(orb);
    }
    return null;
  }

  public clearAll(): void {
    this.orbs = [];
    this.idMap.clear();
    this.grid = new SpatialGrid<FoodOrb>(CONFIG.FOOD_CELL_SIZE);
  }

  public setOrbs(newOrbs: FoodOrb[]): void {
    this.clearAll();
    for (let i = 0; i < newOrbs.length; i++) {
      const o = newOrbs[i];
      this.orbs.push(o);
      this.idMap.set(o.id, o);
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
