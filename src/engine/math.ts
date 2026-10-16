export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
}

export function distanceSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function normalizeAngle(angle: number): number {
  while (angle <= -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

export function angleDiff(target: number, current: number): number {
  return normalizeAngle(target - current);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function circleIntersectsCircle(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const rSum = r1 + r2;
  return distanceSq(x1, y1, x2, y2) <= rSum * rSum;
}

export const VIBRANT_PALETTE = [
  0x00f0ff, // Cyan
  0xff007f, // Magenta
  0x39ff14, // Acid Lime
  0xffaa00, // Amber
  0x9d00ff, // Electric Violet
  0x00ffcc, // Turquoise
  0xff3366, // Coral
  0xffdd00, // Gold
];

export function getRandomVibrantColor(): number {
  return VIBRANT_PALETTE[Math.floor(Math.random() * VIBRANT_PALETTE.length)];
}
