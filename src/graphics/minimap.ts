import { Snake } from '../engine/snake';
import { CONFIG } from '../config';

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size: number = 160;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get minimap 2d context');
    this.ctx = ctx;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.size * dpr;
    this.canvas.height = this.size * dpr;
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    this.ctx.scale(dpr, dpr);
  }

  public render(player: Snake | null, allSnakes: Snake[]): void {
    const ctx = this.ctx;
    const center = this.size / 2;
    const radarRadius = (this.size / 2) - 8;
    const scale = radarRadius / CONFIG.WORLD_RADIUS;

    ctx.clearRect(0, 0, this.size, this.size);

    // 1. Fond du radar circulaire avec dégradé subtil
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radarRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(7, 10, 22, 0.75)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.stroke();

    // Cercles concentriques intérieurs
    ctx.beginPath();
    ctx.arc(center, center, radarRadius * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.stroke();

    // Réticule en croix
    ctx.beginPath();
    ctx.moveTo(center - radarRadius, center);
    ctx.lineTo(center + radarRadius, center);
    ctx.moveTo(center, center - radarRadius);
    ctx.lineTo(center, center + radarRadius);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.stroke();

    // Masque circulaire
    ctx.clip();

    // 2. Dessiner les autres serpents
    for (const snake of allSnakes) {
      if (!snake.isAlive || snake === player) continue;

      const mx = center + snake.x * scale;
      const my = center + snake.y * scale;

      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = snake.skin.glowColor;
      ctx.fill();
    }

    // 3. Dessiner le joueur avec effet lumineux & direction
    if (player && player.isAlive) {
      const px = center + player.x * scale;
      const py = center + player.y * scale;

      // Halo pulsant
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();

      // Point central
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Aiguille de direction
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(
        px + Math.cos(player.angle) * 9,
        py + Math.sin(player.angle) * 9
      );
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }
}
