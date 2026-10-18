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
  0x00f0ff, // 0: Cyan (Cyber Neon)
  0xff007f, // 1: Magenta (Cosmic Void)
  0x39ff14, // 2: Acid Lime (Toxic Emerald)
  0xffaa00, // 3: Amber
  0x9d00ff, // 4: Electric Violet
  0x00ffcc, // 5: Turquoise
  0xff3366, // 6: Coral
  0xffdd00, // 7: Gold
  // Couleurs de skins
  0xff5500, // 8: Solar Flare Primary (Orange)
  0x00e5ff, // 9: Phantom Ice Primary (Ice Cyan)
  0xffd700, // 10: Golden Emperor Primary (Gold)
  0x8a2be2, // 11: Cyber Neon Secondary (Purple)
  0x008844, // 12: Toxic Emerald Secondary (Dark Emerald)
  0x5e00b8, // 13: Cosmic Void Secondary (Dark Violet)
  0x0077b6, // 14: Phantom Ice Secondary (Deep Blue)
  0xd47a00, // 15: Golden Emperor Secondary (Dark Amber)
];

// Les 8 premières couleurs servent à l'apparition des orbes sauvages dans l'arène
export function getRandomVibrantColor(): number {
  return VIBRANT_PALETTE[Math.floor(Math.random() * 8)];
}

export function getRandomVibrantColorIndex(): { color: number; index: number } {
  const index = Math.floor(Math.random() * 8);
  return { color: VIBRANT_PALETTE[index], index };
}

export function getColorIndex(color: number): number {
  const idx = VIBRANT_PALETTE.indexOf(color);
  if (idx !== -1) return idx;

  // Recherche de la couleur la plus proche en distance RGB Euclidienne
  const r1 = (color >> 16) & 0xff;
  const g1 = (color >> 8) & 0xff;
  const b1 = color & 0xff;

  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < VIBRANT_PALETTE.length; i++) {
    const c = VIBRANT_PALETTE[i];
    const r2 = (c >> 16) & 0xff;
    const g2 = (c >> 8) & 0xff;
    const b2 = c & 0xff;
    const dist = (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

