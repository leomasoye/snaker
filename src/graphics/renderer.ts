import { Application, Container, Graphics, Text } from 'pixi.js';
import { CONFIG } from '../config';
import { Snake } from '../engine/snake';
import { FoodManager } from '../engine/food-manager';
import { ParticleSystem } from '../engine/particle-system';
import { VIBRANT_PALETTE } from '../engine/math';
import { clamp } from '../engine/math';
import type { FoodOrb } from '../types';

export class GameRenderer {
  public app: Application;
  private worldContainer: Container;
  private bgGraphics: Graphics;
  private foodGraphics: Graphics;
  private particlesGraphics: Graphics;
  private snakesGraphics: Graphics;

  // Cache des étiquettes de noms
  private nameLabels: Map<string, Text> = new Map();
  private nameContainer: Container;

  // Pré-allocation des bacs de couleurs d'orbes pour un coût mémoire 0
  private foodBuckets: FoodOrb[][] = Array.from({ length: VIBRANT_PALETTE.length }, () => []);

  // Caméra
  public cameraX: number = 0;
  public cameraY: number = 0;
  public cameraZoom: number = 1.0;

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();
    this.bgGraphics = new Graphics();
    this.foodGraphics = new Graphics();
    this.particlesGraphics = new Graphics();
    this.snakesGraphics = new Graphics();
    this.nameContainer = new Container();
  }

  public async init(parentElement: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: window,
      backgroundColor: CONFIG.BACKGROUND_COLOR,
      antialias: false,               // Élimine le coût MSAA très lourd sur GPU intégré
      resolution: 1,                   // Ratio 1:1 pour éviter de rendre en 4K sur laptop
      autoDensity: false,
      powerPreference: 'high-performance',
    });

    parentElement.appendChild(this.app.canvas);

    this.worldContainer.addChild(this.bgGraphics);
    this.worldContainer.addChild(this.foodGraphics);
    this.worldContainer.addChild(this.particlesGraphics);
    this.worldContainer.addChild(this.snakesGraphics);
    this.worldContainer.addChild(this.nameContainer);

    this.app.stage.addChild(this.worldContainer);

    this.renderBackgroundStatic();
  }

  private renderBackgroundStatic(): void {
    const bg = this.bgGraphics;
    bg.clear();

    const r = CONFIG.WORLD_RADIUS;

    // Fond plein
    bg.circle(0, 0, r + 200).fill({ color: CONFIG.BACKGROUND_COLOR });

    // Cercles concentriques de repère spatiaux (léger et épuré)
    for (let rad = 500; rad < r; rad += 600) {
      bg.circle(0, 0, rad).stroke({ width: 1.5, color: CONFIG.GRID_COLOR, alpha: 0.6 });
    }

    // Axes orthogonaux légers
    bg.moveTo(-r, 0).lineTo(r, 0).stroke({ width: 1.5, color: CONFIG.GRID_COLOR, alpha: 0.7 });
    bg.moveTo(0, -r).lineTo(0, r).stroke({ width: 1.5, color: CONFIG.GRID_COLOR, alpha: 0.7 });

    // Barrière néon circulaire d'arène (3 couches lumineuses)
    bg.circle(0, 0, r).stroke({ width: 14, color: CONFIG.ARENA_LINE_COLOR, alpha: 0.22 });
    bg.circle(0, 0, r).stroke({ width: 5, color: 0xffffff, alpha: 0.85 });
    bg.circle(0, 0, r).stroke({ width: 2, color: CONFIG.ARENA_LINE_COLOR, alpha: 1.0 });

    // Zone hors limites
    bg.circle(0, 0, r + 120).stroke({ width: 20, color: 0xff0055, alpha: 0.12 });
  }

  public updateCamera(targetX: number, targetY: number, targetMass: number, dt: number): void {
    this.cameraX = targetX;
    this.cameraY = targetY;

    // Dézoom dynamique fluide
    const targetZoom = clamp(
      CONFIG.BASE_ZOOM - (targetMass / 1800) * (CONFIG.BASE_ZOOM - CONFIG.MIN_ZOOM),
      CONFIG.MIN_ZOOM,
      CONFIG.BASE_ZOOM
    );
    const zoomFactor = 1 - Math.exp(-4 * dt);
    this.cameraZoom += (targetZoom - this.cameraZoom) * zoomFactor;

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    this.worldContainer.scale.set(this.cameraZoom);
    this.worldContainer.pivot.set(this.cameraX, this.cameraY);
    this.worldContainer.position.set(screenW / 2, screenH / 2);
  }

  public renderFood(foodManager: FoodManager): void {
    const g = this.foodGraphics;
    g.clear();

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const halfW = (screenW / 2) / this.cameraZoom + 80;
    const halfH = (screenH / 2) / this.cameraZoom + 80;

    const minX = this.cameraX - halfW;
    const maxX = this.cameraX + halfW;
    const minY = this.cameraY - halfH;
    const maxY = this.cameraY + halfH;

    // Viewport Culling rapide
    const visibleOrbs = foodManager.getOrbsInRect(minX, minY, maxX, maxY);
    const totalVisible = visibleOrbs.length;
    if (totalVisible === 0) return;

    // 1. Distribution en une passe unique dans les 8 bacs de couleurs (Zéro allocation)
    for (let i = 0; i < totalVisible; i++) {
      const orb = visibleOrbs[i];
      const idx = orb.colorIndex;
      if (idx >= 0 && idx < 8) {
        this.foodBuckets[idx].push(orb);
      }
    }

    // 2. Dessiner chaque couleur en un seul appel GPU batché
    for (let c = 0; c < 8; c++) {
      const bucket = this.foodBuckets[c];
      const bLen = bucket.length;
      if (bLen === 0) continue;

      for (let i = 0; i < bLen; i++) {
        const orb = bucket[i];
        g.circle(orb.x, orb.y, orb.radius);
      }
      g.fill({ color: VIBRANT_PALETTE[c], alpha: 0.95 });
      bucket.length = 0; // Réinitialiser sans réallouer
    }
  }

  public renderParticles(particleSystem: ParticleSystem): void {
    const g = this.particlesGraphics;
    g.clear();

    const particles = particleSystem.getActiveParticles();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      g.circle(p.x, p.y, p.radius).fill({ color: p.color, alpha: p.alpha });
    }
  }

  public renderSnakes(snakes: Snake[], leaderSnakeId?: string): void {
    const g = this.snakesGraphics;
    g.clear();

    const activeIds = new Set<string>();

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const halfW = (screenW / 2) / this.cameraZoom + 120;
    const halfH = (screenH / 2) / this.cameraZoom + 120;

    const minX = this.cameraX - halfW;
    const maxX = this.cameraX + halfW;
    const minY = this.cameraY - halfH;
    const maxY = this.cameraY + halfH;

    for (let s = 0; s < snakes.length; s++) {
      const snake = snakes[s];
      if (!snake.isAlive) continue;
      activeIds.add(snake.id);

      // 1. Broadphase Culling : si le serpent entier est hors de l'écran, passer directement
      if (
        snake.maxX < minX ||
        snake.minX > maxX ||
        snake.maxY < minY ||
        snake.minY > maxY
      ) {
        continue;
      }

      const radius = snake.radius;
      const segments = snake.segments;
      const segCount = segments.length;

      // Pas de tracé adaptatif : garantit un chevauchement solide de 50%+ sans sur-tessellation CPU
      const stride = this.cameraZoom < 0.75 ? 4 : 2;

      // 2. Dessiner les segments primaires en un seul appel batché
      let hasPrimary = false;
      for (let i = 0; i < segCount; i += stride * 2) {
        const seg = segments[i];
        if (seg.x < minX || seg.x > maxX || seg.y < minY || seg.y > maxY) continue;

        let taper = 1.0;
        if (i > segCount - 14) {
          taper = 0.4 + 0.6 * ((segCount - 1 - i) / 14);
        }
        g.circle(seg.x, seg.y, radius * taper);
        hasPrimary = true;
      }
      if (hasPrimary) {
        g.fill({ color: snake.skin.primaryColor, alpha: 0.98 });
      }

      // 3. Dessiner les segments secondaires en un seul appel batché
      let hasSecondary = false;
      for (let i = stride; i < segCount; i += stride * 2) {
        const seg = segments[i];
        if (seg.x < minX || seg.x > maxX || seg.y < minY || seg.y > maxY) continue;

        let taper = 1.0;
        if (i > segCount - 14) {
          taper = 0.4 + 0.6 * ((segCount - 1 - i) / 14);
        }
        g.circle(seg.x, seg.y, radius * taper);
        hasSecondary = true;
      }
      if (hasSecondary) {
        g.fill({ color: snake.skin.secondaryColor, alpha: 0.98 });
      }

      // 4. Dessiner la tête (si visible)
      if (snake.x >= minX && snake.x <= maxX && snake.y >= minY && snake.y <= maxY) {
        const isLeader = snake.id === leaderSnakeId;

        // Tête pleine
        g.circle(snake.x, snake.y, radius * 1.1).fill({ color: snake.skin.primaryColor, alpha: 1.0 });

        // Yeux expressifs
        const eyeOffsetAngle = 0.65;
        const eyeDist = radius * 0.65;
        const eyeRadius = radius * 0.36;
        const pupilRadius = eyeRadius * 0.52;

        const leftEyeAngle = snake.angle - eyeOffsetAngle;
        const rightEyeAngle = snake.angle + eyeOffsetAngle;

        const leftEyeX = snake.x + Math.cos(leftEyeAngle) * eyeDist;
        const leftEyeY = snake.y + Math.sin(leftEyeAngle) * eyeDist;
        const rightEyeX = snake.x + Math.cos(rightEyeAngle) * eyeDist;
        const rightEyeY = snake.y + Math.sin(rightEyeAngle) * eyeDist;

        // Blanc des yeux
        g.circle(leftEyeX, leftEyeY, eyeRadius);
        g.circle(rightEyeX, rightEyeY, eyeRadius);
        g.fill({ color: snake.skin.eyeColor });

        // Pupilles orientées vers la cible
        const pupilLookDist = eyeRadius * 0.38;
        const pupilAngle = snake.targetAngle;

        const leftPupilX = leftEyeX + Math.cos(pupilAngle) * pupilLookDist;
        const leftPupilY = leftEyeY + Math.sin(pupilAngle) * pupilLookDist;
        const rightPupilX = rightEyeX + Math.cos(pupilAngle) * pupilLookDist;
        const rightPupilY = rightEyeY + Math.sin(pupilAngle) * pupilLookDist;

        g.circle(leftPupilX, leftPupilY, pupilRadius);
        g.circle(rightPupilX, rightPupilY, pupilRadius);
        g.fill({ color: snake.skin.pupilColor });

        // Reflet blanc
        const catchDist = pupilRadius * 0.35;
        g.circle(leftPupilX - catchDist, leftPupilY - catchDist, pupilRadius * 0.35);
        g.circle(rightPupilX - catchDist, rightPupilY - catchDist, pupilRadius * 0.35);
        g.fill({ color: 0xffffff });

        let crownCenterY = snake.y - radius - 14;

        // 5. Couronne Royale sur la tête du Premier Joueur (#1)
        if (isLeader) {
          const crownBob = Math.sin(performance.now() * 0.005) * 3;
          crownCenterY += crownBob;
          const crownCenterX = snake.x;
          const crownWidth = Math.max(26, radius * 1.35);
          const crownHeight = Math.max(16, radius * 0.85);
          const cHalfW = crownWidth / 2;
          const cHalfH = crownHeight / 2;

          // Halo doré lumineux
          g.circle(crownCenterX, crownCenterY, crownWidth * 0.75).fill({ color: 0xffd700, alpha: 0.22 });

          // Silhouette royale de la couronne dorée (3 pointes majestueuses)
          g.poly([
            crownCenterX - cHalfW, crownCenterY + cHalfH,
            crownCenterX - cHalfW * 0.95, crownCenterY - cHalfH * 0.6,
            crownCenterX - cHalfW * 0.42, crownCenterY + cHalfH * 0.1,
            crownCenterX, crownCenterY - cHalfH * 1.15,
            crownCenterX + cHalfW * 0.42, crownCenterY + cHalfH * 0.1,
            crownCenterX + cHalfW * 0.95, crownCenterY - cHalfH * 0.6,
            crownCenterX + cHalfW, crownCenterY + cHalfH,
          ]);
          g.fill({ color: 0xffcc00, alpha: 1.0 });
          g.stroke({ width: 2, color: 0xfff077 });

          // Bandeau inférieur doré orné
          g.roundRect(crownCenterX - cHalfW * 0.88, crownCenterY + cHalfH * 0.35, cHalfW * 1.76, cHalfH * 0.65, 3)
           .fill({ color: 0xdf9800 });

          // Joyaux précieux sur les sommets
          // Pointe centrale (Diamant cyan étincelant)
          g.circle(crownCenterX, crownCenterY - cHalfH * 1.15, 3.2).fill({ color: 0x00f0ff });
          g.circle(crownCenterX, crownCenterY - cHalfH * 1.15, 1.2).fill({ color: 0xffffff });

          // Pointes latérales (Rubis carmin)
          g.circle(crownCenterX - cHalfW * 0.95, crownCenterY - cHalfH * 0.6, 2.4).fill({ color: 0xff0055 });
          g.circle(crownCenterX + cHalfW * 0.95, crownCenterY - cHalfH * 0.6, 2.4).fill({ color: 0xff0055 });

          // Joyaux incrustés sur le bandeau
          g.circle(crownCenterX - cHalfW * 0.45, crownCenterY + cHalfH * 0.68, 1.6).fill({ color: 0x00ffcc });
          g.circle(crownCenterX, crownCenterY + cHalfH * 0.68, 1.8).fill({ color: 0xff0055 });
          g.circle(crownCenterX + cHalfW * 0.45, crownCenterY + cHalfH * 0.68, 1.6).fill({ color: 0x00ffcc });
        }

        // 6. Étiquette de nom
        let label = this.nameLabels.get(snake.id);
        if (!label) {
          label = new Text({
            text: (isLeader ? '👑 ' : '') + snake.name,
            style: {
              fontFamily: 'Outfit, Inter, sans-serif',
              fontSize: 13,
              fontWeight: '700',
              fill: isLeader ? '#ffd700' : '#ffffff',
              stroke: { color: '#000000', width: 3 },
              align: 'center',
            },
          });
          label.anchor.set(0.5, 1);
          this.nameContainer.addChild(label);
          this.nameLabels.set(snake.id, label);
        } else {
          label.text = (isLeader ? '👑 ' : '') + snake.name;
          label.style.fill = isLeader ? '#ffd700' : '#ffffff';
        }

        if (isLeader) {
          label.position.set(snake.x, crownCenterY - (radius * 0.85) / 2 - 8);
        } else {
          label.position.set(snake.x, snake.y - radius - 8);
        }
        label.visible = true;
      }
    }

    // Nettoyer les étiquettes des serpents morts
    for (const [id, label] of this.nameLabels.entries()) {
      if (!activeIds.has(id)) {
        this.nameContainer.removeChild(label);
        label.destroy();
        this.nameLabels.delete(id);
      }
    }
  }

  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const worldX = (screenX - screenW / 2) / this.cameraZoom + this.cameraX;
    const worldY = (screenY - screenH / 2) / this.cameraZoom + this.cameraY;
    return { x: worldX, y: worldY };
  }
}
