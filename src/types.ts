export interface Vector2D {
  x: number;
  y: number;
}

export interface Segment {
  x: number;
  y: number;
  angle: number;
}

export interface SkinConfig {
  id: string;
  name: string;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  eyeColor: number;
  pupilColor: number;
  glowColor: string;
}

export interface SnakeConfig {
  id: string;
  name: string;
  isBot: boolean;
  skin: SkinConfig;
  mass: number;
}

export interface FoodOrb {
  id: number;
  x: number;
  y: number;
  radius: number;
  value: number;
  color: number;
  colorIndex: number;
  glowColor: string;
  phase: number;
  isBoostDrop?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  maxLife: number;
  life: number;
  color: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  isPlayer: boolean;
}
