import { Snake } from '../engine/snake';
import { CONFIG } from '../config';

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size: number = 160;
  private scanAngle: number = 0;

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

  public render(
    player: Snake | null,
    allSnakes: Snake[],
    leaderSnakeId: string = '',
    dt: number = 0.016,
    cameraZoom: number = 1.0,
    screenWidth: number = 1920,
    screenHeight: number = 1080
  ): void {
    const ctx = this.ctx;
    const center = this.size / 2;
    const radarRadius = (this.size / 2) - 8;
    const scale = radarRadius / CONFIG.WORLD_RADIUS;

    // Progression continue du faisceau de balayage radar (360° à ~105°/sec)
    this.scanAngle = (this.scanAngle + dt * 1.85) % (Math.PI * 2);

    ctx.clearRect(0, 0, this.size, this.size);

    ctx.save();

    // 1. Découpage circulaire strict du radar
    ctx.beginPath();
    ctx.arc(center, center, radarRadius, 0, Math.PI * 2);

    // Fond avec dégradé radial néon spatial
    const bgGrad = ctx.createRadialGradient(center, center, 0, center, center, radarRadius);
    bgGrad.addColorStop(0, 'rgba(10, 18, 36, 0.88)');
    bgGrad.addColorStop(0.7, 'rgba(5, 10, 24, 0.92)');
    bgGrad.addColorStop(1, 'rgba(3, 6, 16, 0.98)');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Clip pour tout le contenu interne
    ctx.clip();

    // 2. Cercles concentriques de portée tactique (25%, 50%, 75%)
    const rings = [0.25, 0.5, 0.75];
    for (const fraction of rings) {
      ctx.beginPath();
      ctx.arc(center, center, radarRadius * fraction, 0, Math.PI * 2);
      ctx.strokeStyle = fraction === 0.5 ? 'rgba(0, 240, 255, 0.18)' : 'rgba(0, 240, 255, 0.09)';
      ctx.lineWidth = 1;
      if (fraction !== 0.5) {
        ctx.setLineDash([3, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Réticule en croix tactique
    ctx.beginPath();
    ctx.moveTo(center - radarRadius, center);
    ctx.lineTo(center - 8, center);
    ctx.moveTo(center + 8, center);
    ctx.lineTo(center + radarRadius, center);
    ctx.moveTo(center, center - radarRadius);
    ctx.lineTo(center, center - 8);
    ctx.moveTo(center, center + 8);
    ctx.lineTo(center, center + radarRadius);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Balayage Radar 360° (Faisceau lumineux rotatif avec traînée dégradée)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radarRadius, this.scanAngle - 0.75, this.scanAngle);
    ctx.closePath();
    const sweepGrad = ctx.createRadialGradient(center, center, 0, center, center, radarRadius);
    sweepGrad.addColorStop(0, 'rgba(0, 240, 255, 0.28)');
    sweepGrad.addColorStop(0.75, 'rgba(0, 240, 255, 0.09)');
    sweepGrad.addColorStop(1, 'rgba(0, 240, 255, 0.01)');
    ctx.fillStyle = sweepGrad;
    ctx.fill();

    // Ligne frontale du faisceau
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(
      center + Math.cos(this.scanAngle) * radarRadius,
      center + Math.sin(this.scanAngle) * radarRadius
    );
    ctx.strokeStyle = 'rgba(0, 255, 230, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 5. Dessiner les autres serpents (avec mise en valeur du LEADER #1 et taille selon masse)
    for (const snake of allSnakes) {
      if (!snake.isAlive || snake === player) continue;

      const mx = center + snake.x * scale;
      const my = center + snake.y * scale;

      const isLeader = leaderSnakeId !== '' && snake.id === leaderSnakeId;

      if (isLeader) {
        // Couronne / halo doré pulsant pour le Leader #1
        const pulse = 1 + 0.25 * Math.sin(Date.now() * 0.009);
        ctx.beginPath();
        ctx.arc(mx, my, 6 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Mini icône couronne au-dessus
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', mx, my - 7);
      } else {
        // Serpent normal : rayon proportionnel à la masse (de 2px à 5px)
        const blipRadius = Math.max(2.0, Math.min(5.0, 1.8 + Math.sqrt(snake.mass) * 0.04));

        ctx.beginPath();
        ctx.arc(mx, my, blipRadius + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = snake.skin.glowColor + '44';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(mx, my, blipRadius, 0, Math.PI * 2);
        ctx.fillStyle = snake.skin.glowColor;
        ctx.fill();
      }
    }

    // 6. Dessiner le joueur local
    if (player && player.isAlive) {
      const px = center + player.x * scale;
      const py = center + player.y * scale;
      const isPlayerLeader = leaderSnakeId !== '' && player.id === leaderSnakeId;

      // Champ de vision (Viewport / Caméra sur la carte globale)
      const vw = Math.min(radarRadius * 1.8, (screenWidth / cameraZoom) * scale);
      const vh = Math.min(radarRadius * 1.8, (screenHeight / cameraZoom) * scale);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - vw / 2, py - vh / 2, vw, vh);

      // Halo pulsant joueur
      const playerPulse = 6 + 1.2 * Math.sin(Date.now() * 0.008);
      ctx.beginPath();
      ctx.arc(px, py, playerPulse, 0, Math.PI * 2);
      ctx.fillStyle = isPlayerLeader ? 'rgba(255, 215, 0, 0.35)' : 'rgba(0, 240, 255, 0.3)';
      ctx.fill();

      // Point central joueur
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = isPlayerLeader ? '#ffd700' : '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Aiguille de direction
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(
        px + Math.cos(player.angle) * 10,
        py + Math.sin(player.angle) * 10
      );
      ctx.strokeStyle = isPlayerLeader ? '#ffd700' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (isPlayerLeader) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', px, py - 8);
      }
    }

    // 7. Repères cardinaux subtils (N, S, E, O)
    ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.font = '700 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', center, center - radarRadius + 7);
    ctx.fillText('S', center, center + radarRadius - 7);
    ctx.fillText('E', center + radarRadius - 7, center);
    ctx.fillText('O', center - radarRadius + 7, center);

    // 8. Alerte visuelle de proximité des bordures létales
    let isNearDanger = false;
    if (player && player.isAlive) {
      const distFromCenter = Math.hypot(player.x, player.y);
      const dangerThreshold = CONFIG.WORLD_RADIUS - 400;
      if (distFromCenter > dangerThreshold) {
        isNearDanger = true;
        const dangerFactor = Math.min(1.0, (distFromCenter - dangerThreshold) / 350);
        const dangerPulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.015);
        ctx.beginPath();
        ctx.arc(center, center, radarRadius - 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 45, 85, ${0.4 + 0.6 * dangerPulse * dangerFactor})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 45, 85, ${0.8 + 0.2 * dangerPulse})`;
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText('⚠ BORDURE', center, center + radarRadius - 18);
      }
    }

    ctx.restore();

    // 9. Anneau extérieur & contour néon du radar
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radarRadius, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = isNearDanger
      ? 'rgba(255, 45, 85, 0.9)'
      : 'rgba(0, 240, 255, 0.55)';
    ctx.stroke();

    // 4 graduations extérieures d'angle
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(
        center + Math.cos(a) * (radarRadius - 3),
        center + Math.sin(a) * (radarRadius - 3)
      );
      ctx.lineTo(
        center + Math.cos(a) * (radarRadius + 3),
        center + Math.sin(a) * (radarRadius + 3)
      );
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}

