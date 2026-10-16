import type { Particle } from '../types';
import { randomRange } from './math';

export class ParticleSystem {
  private particles: Particle[] = [];
  private pool: Particle[] = [];
  private maxParticles: number = 800;

  constructor() {
    // Pré-allouer le pool pour éviter le garbage collector
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 0,
        alpha: 1,
        maxLife: 1,
        life: 0,
        color: 0xffffff,
      });
    }
  }

  public emitBoostTrail(x: number, y: number, angle: number, color: number): void {
    if (this.pool.length === 0) return;
    const p = this.pool.pop()!;

    const speed = randomRange(20, 70);
    // Éjection vers l'arrière du serpent avec légère dispersion
    const spread = (Math.random() - 0.5) * 0.8;
    const emitAngle = angle + Math.PI + spread;

    p.x = x + (Math.random() - 0.5) * 6;
    p.y = y + (Math.random() - 0.5) * 6;
    p.vx = Math.cos(emitAngle) * speed;
    p.vy = Math.sin(emitAngle) * speed;
    p.radius = randomRange(2.5, 5.5);
    p.alpha = 0.85;
    p.maxLife = randomRange(0.25, 0.45);
    p.life = 0;
    p.color = color;

    this.particles.push(p);
  }

  public emitEatEffect(x: number, y: number, color: number): void {
    const count = 6;
    for (let i = 0; i < count; i++) {
      if (this.pool.length === 0) break;
      const p = this.pool.pop()!;
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(30, 90);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.radius = randomRange(2, 4);
      p.alpha = 1;
      p.maxLife = randomRange(0.2, 0.35);
      p.life = 0;
      p.color = color;

      this.particles.push(p);
    }
  }

  public emitDeathExplosion(x: number, y: number, color: number): void {
    const count = 25;
    for (let i = 0; i < count; i++) {
      if (this.pool.length === 0) break;
      const p = this.pool.pop()!;
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(60, 220);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.radius = randomRange(3, 7);
      p.alpha = 1;
      p.maxLife = randomRange(0.4, 0.7);
      p.life = 0;
      p.color = color;

      this.particles.push(p);
    }
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        // Recycler dans le pool
        this.particles.splice(i, 1);
        this.pool.push(p);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.alpha = 1 - (p.life / p.maxLife);
    }
  }

  public getActiveParticles(): readonly Particle[] {
    return this.particles;
  }
}
