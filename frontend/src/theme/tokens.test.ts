import { hexToChannels, palette, type ColorToken } from './tokens';
import { resolveScheme } from './ThemeProvider';

/** WCAG relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = hexToChannels(hex)
    .split(' ')
    .map((channel) => {
      const c = Number(channel) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('hexToChannels', () => {
  it('converts hex to space-separated channels', () => {
    expect(hexToChannels('#0B1220')).toBe('11 18 32');
    expect(hexToChannels('#FFFFFF')).toBe('255 255 255');
  });
});

describe('palette', () => {
  it('defines the same tokens in both themes', () => {
    expect(Object.keys(palette.light).sort()).toEqual(Object.keys(palette.dark).sort());
  });

  it.each(['dark', 'light'] as const)('%s: text meets 4.5:1 on its surfaces', (theme) => {
    const colors = palette[theme];
    const textTokens: ColorToken[] = ['fg', 'fg2', 'muted', 'accent', 'danger'];
    const grounds: ColorToken[] = ['bg', 'surface', 'raised'];
    for (const text of textTokens) {
      for (const ground of grounds) {
        expect(contrast(colors[text], colors[ground])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(['dark', 'light'] as const)('%s: status colours are readable on the surface', (theme) => {
    const colors = palette[theme];
    for (const status of ['pending', 'confirmed', 'seated', 'completed'] as const) {
      expect(contrast(colors[status], colors.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['dark', 'light'] as const)('%s: text on the accent fill is readable', (theme) => {
    expect(contrast(palette[theme]['on-accent'], palette[theme].accent)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

describe('resolveScheme', () => {
  it('follows the system unless overridden', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark'); // dark-slate is the default look
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});
