import type { SkinConfig } from './types';

export const CONFIG = {
  // Monde de jeu (Arène circulaire)
  WORLD_RADIUS: 3000,
  ARENA_LINE_COLOR: 0x00f0ff,
  BACKGROUND_COLOR: 0x070914,
  GRID_SIZE: 100,
  GRID_COLOR: 0x111728,

  // Physique du serpent (Hyper-fluide & ultra-réactif)
  BASE_SPEED: 260,         // pixels par seconde
  BOOST_SPEED: 520,        // pixels par seconde en boost
  TURN_SPEED: 7.2,         // radians par seconde (réactivité vive)
  BASE_RADIUS: 16,         // rayon initial
  SEGMENT_SPACING: 6.2,    // espacement très dense pour un corps continu
  BASE_SEGMENT_COUNT: 28,  // longueur initiale

  // Économie de masse & boost
  INITIAL_MASS: 35,
  BOOST_MASS_CONSUMPTION_RATE: 14,
  MIN_BOOST_MASS: 18,
  MASS_TO_RADIUS_FACTOR: 0.15,
  MAX_RADIUS: 48,

  // Nourriture & Orbes
  FOOD_COUNT: 1200,
  FOOD_CELL_SIZE: 180,
  MIN_FOOD_VALUE: 1,
  MAX_FOOD_VALUE: 4,
  BOOST_DROP_VALUE: 2,

  // Caméra
  CAMERA_LERP: 0.18,
  BASE_ZOOM: 1.0,
  MIN_ZOOM: 0.6,

  // IA Bots
  BOT_COUNT: 12,
  BOT_VIEW_DISTANCE: 450,
};

export const SKINS: SkinConfig[] = [
  {
    id: 'cyber-cyan',
    name: 'Cyber Neon',
    primaryColor: 0x00f0ff,
    secondaryColor: 0x8a2be2,
    accentColor: 0x00ffff,
    eyeColor: 0xffffff,
    pupilColor: 0x060813,
    glowColor: '#00f0ff',
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    primaryColor: 0xff5500,
    secondaryColor: 0xffaa00,
    accentColor: 0xffdd00,
    eyeColor: 0xffffff,
    pupilColor: 0x2b0500,
    glowColor: '#ff5500',
  },
  {
    id: 'toxic-emerald',
    name: 'Toxic Emerald',
    primaryColor: 0x39ff14,
    secondaryColor: 0x008844,
    accentColor: 0x88ff66,
    eyeColor: 0xffffff,
    pupilColor: 0x00240d,
    glowColor: '#39ff14',
  },
  {
    id: 'cosmic-void',
    name: 'Cosmic Void',
    primaryColor: 0xff007f,
    secondaryColor: 0x5e00b8,
    accentColor: 0xff66cc,
    eyeColor: 0xffffff,
    pupilColor: 0x140026,
    glowColor: '#ff007f',
  },
  {
    id: 'phantom-ice',
    name: 'Phantom Ice',
    primaryColor: 0x00e5ff,
    secondaryColor: 0x0077b6,
    accentColor: 0x90e0ef,
    eyeColor: 0xffffff,
    pupilColor: 0x03045e,
    glowColor: '#00e5ff',
  },
  {
    id: 'golden-emperor',
    name: 'Golden Emperor',
    primaryColor: 0xffd700,
    secondaryColor: 0xd47a00,
    accentColor: 0xfff080,
    eyeColor: 0xffffff,
    pupilColor: 0x221300,
    glowColor: '#ffd700',
  },
];
