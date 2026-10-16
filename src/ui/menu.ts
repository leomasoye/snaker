import { SKINS } from '../config';
import type { SkinConfig } from '../types';

const FUN_NAMES = [
  'ViperPrime', 'CyberWorm', 'NeonStalker', 'CosmicBoa', 'PixelPython',
  'SolarFang', 'ToxicTitan', 'HyperGlider', 'QuantumTail', 'AstroViper',
  'GhostDragon', 'OmegaSerpent', 'ZenithGlow', 'NovaStriker', 'ShadowPulse'
];

export class Menu {
  private startModal: HTMLElement;
  private gameOverModal: HTMLElement;
  private nameInput: HTMLInputElement;
  private playBtn: HTMLButtonElement;
  private restartBtn: HTMLButtonElement;
  private backMenuBtn: HTMLButtonElement | null;
  private randomNameBtn: HTMLButtonElement | null;
  private hudMenuBtn: HTMLButtonElement | null;
  private skinContainer: HTMLElement;

  private selectedSkinIndex: number = 0;
  private onPlayCallback: (name: string, skin: SkinConfig) => void;
  private onOpenMenuCallback?: () => void;

  constructor(
    onPlay: (name: string, skin: SkinConfig) => void,
    onOpenMenu?: () => void
  ) {
    this.onPlayCallback = onPlay;
    this.onOpenMenuCallback = onOpenMenu;

    this.startModal = document.getElementById('start-modal')!;
    this.gameOverModal = document.getElementById('game-over-modal')!;
    this.nameInput = document.getElementById('player-name-input') as HTMLInputElement;
    this.playBtn = document.getElementById('btn-play') as HTMLButtonElement;
    this.restartBtn = document.getElementById('btn-restart') as HTMLButtonElement;
    this.backMenuBtn = document.getElementById('btn-back-menu') as HTMLButtonElement | null;
    this.randomNameBtn = document.getElementById('btn-random-name') as HTMLButtonElement | null;
    this.hudMenuBtn = document.getElementById('btn-hud-menu') as HTMLButtonElement | null;
    this.skinContainer = document.getElementById('skin-selector')!;

    this.initSkinSelector();
    this.initEvents();
  }

  private initSkinSelector(): void {
    this.skinContainer.innerHTML = '';

    SKINS.forEach((skin, index) => {
      const card = document.createElement('button');
      card.className = `skin-card ${index === this.selectedSkinIndex ? 'selected' : ''}`;
      card.type = 'button';
      card.innerHTML = `
        <div class="skin-swatch" style="background: linear-gradient(135deg, ${this.hexToCss(skin.primaryColor)}, ${this.hexToCss(skin.secondaryColor)})">
          <div class="swatch-accent" style="background: ${this.hexToCss(skin.accentColor)}"></div>
        </div>
        <span class="skin-name">${skin.name}</span>
      `;

      card.addEventListener('click', () => {
        this.selectedSkinIndex = index;
        document.querySelectorAll('.skin-card').forEach((el, i) => {
          el.classList.toggle('selected', i === index);
        });
      });

      this.skinContainer.appendChild(card);
    });
  }

  private initEvents(): void {
    const handleStart = () => {
      const name = this.nameInput.value.trim() || 'ViperPrime';
      const skin = SKINS[this.selectedSkinIndex] || SKINS[0];
      this.hideStartModal();
      this.onPlayCallback(name, skin);
    };

    this.playBtn.addEventListener('click', handleStart);
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleStart();
    });

    if (this.randomNameBtn) {
      this.randomNameBtn.addEventListener('click', () => {
        const randomName = FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)];
        this.nameInput.value = randomName;
      });
    }

    if (this.hudMenuBtn) {
      this.hudMenuBtn.addEventListener('click', () => {
        if (this.onOpenMenuCallback) {
          this.onOpenMenuCallback();
        }
        this.showStartModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.startModal.classList.contains('hidden')) {
          if (this.onOpenMenuCallback) {
            this.onOpenMenuCallback();
          }
          this.showStartModal();
        } else {
          handleStart();
        }
      }
    });

    this.restartBtn.addEventListener('click', () => {
      this.hideGameOverModal();
      const name = this.nameInput.value.trim() || 'ViperPrime';
      const skin = SKINS[this.selectedSkinIndex] || SKINS[0];
      this.onPlayCallback(name, skin);
    });

    if (this.backMenuBtn) {
      this.backMenuBtn.addEventListener('click', () => {
        this.hideGameOverModal();
        if (this.onOpenMenuCallback) {
          this.onOpenMenuCallback();
        }
        this.showStartModal();
      });
    }
  }

  public showStartModal(): void {
    this.startModal.classList.remove('hidden');
    this.gameOverModal.classList.add('hidden');
    this.nameInput.focus();
  }

  public hideStartModal(): void {
    this.startModal.classList.add('hidden');
  }

  public showGameOverModal(score: number, length: number, kills: number, rank: number): void {
    document.getElementById('go-final-score')!.textContent = Math.floor(score).toLocaleString();
    document.getElementById('go-final-length')!.textContent = length.toLocaleString();
    document.getElementById('go-final-kills')!.textContent = kills.toString();
    document.getElementById('go-final-rank')!.textContent = `#${rank}`;

    this.gameOverModal.classList.remove('hidden');
  }

  public hideGameOverModal(): void {
    this.gameOverModal.classList.add('hidden');
  }

  private hexToCss(hex: number): string {
    return `#${hex.toString(16).padStart(6, '0')}`;
  }
}
