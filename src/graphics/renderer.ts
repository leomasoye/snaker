import { Application, Container, Graphics, Text } from 'pixi.js';
import { CONFIG } from '../config';
import { Snake } from '../engine/snake';
import { FoodManager } from '../engine/food-manager';
import { ParticleSystem } from '../engine/particle-system';
import { VIBRANT_PALETTE } from '../engine/math';
import { clamp } from '../engine/math';

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
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
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

    const gridSpacing = CONFIG.GRID_SIZE;
    const r = CONFIG.WORLD_RADIUS;

    // Lignes de grille de fond
    for (let x = -r; x <= r; x += gridSpacing) {
      const halfH = Math.sqrt(Math.max(0, r * r - x * x));
      bg.moveTo(x, -halfH).lineTo(x, halfH).stroke({ width: 1, color: CONFIG.GRID_COLOR, alpha: 0.5 });
    }
    for (let y = -r; y <= r; y += gridSpacing) {
      const halfW = Math.sqrt(Math.max(0, r * r - y * y));
      bg.moveTo(-halfW, y).lineTo(halfW, y).stroke({ width: 1, color: CONFIG.GRID_COLOR, alpha: 0.5 });
    }

    // Barrière néon circulaire d'arène
    bg.circle(0, 0, r).stroke({ width: 14, color: CONFIG.ARENA_LINE_COLOR, alpha: 0.2 });
    bg.circle(0, 0, r).stroke({ width: 5, color: 0xffffff, alpha: 0.85 });
    bg.circle(0, 0, r).stroke({ width: 2, color: CONFIG.ARENA_LINE_COLOR, alpha: 1.0 });

    // Zone hors limites
    bg.circle(0, 0, r + 150).stroke({ width: 25, color: 0xff0055, alpha: 0.12 });
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

  public renderFood(foodManager: FoodManager, time: number): void {
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

    // Zéro allocation : batching direct par couleur de la palette
    for (let c = 0; c < VIBRANT_PALETTE.length; c++) {
      const color = VIBRANT_PALETTE[c];
      let hasOrbs = false;

      for (let i = 0; i < totalVisible; i++) {
        const orb = visibleOrbs[i];
        if (orb.color === color) {
          const pulse = Math.sin(time * 3 + orb.phase) * 0.15 + 1.0;
          const r = orb.radius * pulse;
          g.circle(orb.x, orb.y, r);
          hasOrbs = true;
        }
      }

      if (hasOrbs) {
        g.fill({ color, alpha: 0.95 });
      }
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

  public renderSnakes(snakes: Snake[]): void {
    const g = this.snakesGraphics;
    g.clear();

    const activeIds = new Set<string>();

    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const halfW = (screenW / 2) / this.cameraZoom + 150;
    const halfH = (screenH / 2) / this.cameraZoom + 150;

    const minX = this.cameraX - halfW;
    const maxX = this.cameraX + halfW;
    const minY = this.cameraY - halfH;
    const maxY = this.cameraY + halfH;

    for (let s = 0; s < snakes.length; s++) {
      const snake = snakes[s];
      if (!snake.isAlive) continue;
      activeIds.add(snake.id);

      const radius = snake.radius;
      const segments = snake.segments;
      const segCount = segments.length;

      // 1. Dessiner les segments primaires en un seul appel batché
      let hasPrimary = false;
      for (let i = 0; i < segCount; i += 2) {
        const seg = segments[i];
        // Culling écran
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

      // 2. Dessiner les segments secondaires en un seul appel batché
      let hasSecondary = false;
      for (let i = 1; i < segCount; i += 2) {
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

      // 3. Dessiner la tête (si visible)
      if (snake.x >= minX && snake.x <= maxX && snake.y >= minY && snake.y <= maxY) {
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

        // 4. Étiquette de nom
        let label = this.nameLabels.get(snake.id);
        if (!label) {
          label = new Text({
            text: snake.name,
            style: {
              fontFamily: 'Outfit, Inter, sans-serif',
              fontSize: 13,
              fontWeight: '600',
              fill: '#ffffff',
              stroke: { color: '#000000', width: 3 },
              align: 'center',
            },
          });
          label.anchor.set(0.5, 1);
          this.nameContainer.addChild(label);
          this.nameLabels.set(snake.id, label);
        }
        label.position.set(snake.x, snake.y - radius - 8);
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
