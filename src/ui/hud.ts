import type { LeaderboardEntry } from '../types';
import { soundManager } from '../audio/sound';

export class HUD {
  private leaderboardListEl: HTMLElement;
  private scoreEl: HTMLElement;
  private lengthEl: HTMLElement;
  private rankEl: HTMLElement;
  private killsEl: HTMLElement;
  private fpsEl: HTMLElement;
  private soundBtnEl: HTMLButtonElement;

  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  private currentFps: number = 60;

  constructor() {
    this.leaderboardListEl = document.getElementById('leaderboard-list')!;
    this.scoreEl = document.getElementById('hud-score')!;
    this.lengthEl = document.getElementById('hud-length')!;
    this.rankEl = document.getElementById('hud-rank')!;
    this.killsEl = document.getElementById('hud-kills')!;
    this.fpsEl = document.getElementById('hud-fps')!;
    this.soundBtnEl = document.getElementById('btn-sound') as HTMLButtonElement;

    this.soundBtnEl.addEventListener('click', () => {
      const isMuted = soundManager.toggleMute();
      this.soundBtnEl.innerHTML = isMuted ? '🔇' : '🔊';
      this.soundBtnEl.title = isMuted ? 'Activer le son' : 'Couper le son';
    });
    this.soundBtnEl.innerHTML = soundManager.getIsMuted() ? '🔇' : '🔊';
  }

  public updateFPS(): void {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
      if (this.fpsEl) {
        this.fpsEl.textContent = `${this.currentFps} FPS`;
      }
    }
  }

  public updateStats(score: number, length: number, rank: number, total: number, kills: number): void {
    if (this.scoreEl) this.scoreEl.textContent = Math.floor(score).toLocaleString();
    if (this.lengthEl) this.lengthEl.textContent = length.toLocaleString();
    if (this.rankEl) this.rankEl.textContent = `#${rank} / ${total}`;
    if (this.killsEl) this.killsEl.textContent = kills.toString();
  }

  public updateLeaderboard(entries: LeaderboardEntry[]): void {
    if (!this.leaderboardListEl) return;

    let html = '';
    const maxShow = Math.min(10, entries.length);

    for (let i = 0; i < maxShow; i++) {
      const item = entries[i];
      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
      const playerClass = item.isPlayer ? 'is-player' : '';

      html += `
        <div class="leaderboard-item ${rankClass} ${playerClass}">
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-name">${this.escapeHtml(item.name)}</span>
          <span class="lb-score">${Math.floor(item.score)}</span>
        </div>
      `;
    }

    this.leaderboardListEl.innerHTML = html;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
