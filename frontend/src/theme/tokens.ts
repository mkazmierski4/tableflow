import { vars } from 'nativewind';

/** Mirrors the "Foundations" board of the approved design. */
export type ThemeName = 'dark' | 'light';

export const palette = {
  dark: {
    bg: '#0B1220',
    surface: '#111B2E',
    raised: '#17233A',
    line: '#22304A',
    nav: '#0F1830',
    fg: '#E8EDF7',
    fg2: '#A3B0C8',
    muted: '#8391AD',
    accent: '#2DD4BF',
    'on-accent': '#06231F',
    pending: '#B39DFB',
    confirmed: '#7DB7FF',
    seated: '#FBBF24',
    completed: '#94A3B8',
    danger: '#FB7185',
  },
  light: {
    bg: '#F6F7FB',
    surface: '#FFFFFF',
    raised: '#F1F3F9',
    line: '#E2E7F0',
    nav: '#FFFFFF',
    fg: '#0F1A2E',
    fg2: '#4A5876',
    muted: '#5F6B85',
    accent: '#0F766E',
    'on-accent': '#FFFFFF',
    pending: '#6D28D9',
    confirmed: '#1D4ED8',
    seated: '#B45309',
    completed: '#4A5876',
    danger: '#BE123C',
  },
} as const;

export type ColorToken = keyof (typeof palette)['dark'];
export type Colors = Record<ColorToken, string>;

/** `#0B1220` → `11 18 32`, the channel format Tailwind's `<alpha-value>` expects. */
export function hexToChannels(hex: string): string {
  const value = hex.replace('#', '');
  const n = parseInt(value, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function toVars(colors: Colors) {
  return vars(
    Object.fromEntries(
      Object.entries(colors).map(([token, hex]) => [`--color-${token}`, hexToChannels(hex)]),
    ),
  );
}

export const themeVars = {
  dark: toVars(palette.dark),
  light: toVars(palette.light),
} as const;
