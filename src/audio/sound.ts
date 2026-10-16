class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private boostNode: { osc: OscillatorNode; gain: GainNode } | null = null;

  constructor() {
    this.isMuted = localStorage.getItem('snaker_muted') === 'true';
  }

  private initCtx(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('snaker_muted', String(this.isMuted));
    if (this.isMuted && this.boostNode) {
      this.stopBoostSound();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public playEat(value: number = 1): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Fréquence agréable entre 500 et 850 Hz selon la valeur
      const baseFreq = 540 + Math.min(value * 60, 350) + (Math.random() - 0.5) * 40;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.08);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignorer si audio bloqué
    }
  }

  public setBoostSound(active: boolean): void {
    if (this.isMuted) {
      this.stopBoostSound();
      return;
    }
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      if (active) {
        if (!this.boostNode) {
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(110, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.06, now + 0.15);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start();
          this.boostNode = { osc, gain };
        }
      } else {
        this.stopBoostSound();
      }
    } catch {
      // Ignorer
    }
  }

  private stopBoostSound(): void {
    if (this.boostNode && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.boostNode.gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
        const node = this.boostNode;
        setTimeout(() => {
          try {
            node.osc.stop();
            node.osc.disconnect();
          } catch {}
        }, 120);
      } catch {}
      this.boostNode = null;
    }
  }

  public playDeath(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.45);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.46);
    } catch {}
  }

  public playKill(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.setValueAtTime(800, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }
}

export const soundManager = new SoundManager();
