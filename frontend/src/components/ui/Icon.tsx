import { Platform } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import type { ColorToken } from '@/theme/tokens';

const PATHS = {
  search: (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Path d="m20 20-3.5-3.5" />
    </>
  ),
  calendar: (
    <>
      <Rect x="3" y="5" width="18" height="16" rx="3" />
      <Path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  users: (
    <>
      <Circle cx="9" cy="8" r="3.5" />
      <Path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
    </>
  ),
  'chevron-left': <Path d="m15 6-6 6 6 6" />,
  'chevron-right': <Path d="m9 6 6 6-6 6" />,
  'chevron-down': <Path d="m6 9 6 6 6-6" />,
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  x: <Path d="M6 6l12 12M18 6 6 18" />,
  'map-pin': (
    <>
      <Path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <Circle cx="12" cy="10" r="2.5" />
    </>
  ),
  compass: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  list: (
    <>
      <Rect x="4" y="3" width="16" height="18" rx="3" />
      <Path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  user: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" />
    </>
  ),
  grid: (
    <>
      <Rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <Rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <Rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </>
  ),
  help: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M9.5 9.2a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 2" />
      {/* A zero-length, round-capped stroke draws a filled dot — the standard trick for a
          question mark's point without needing a per-instance fill colour in a static path set. */}
      <Path d="M12 17.01v.01" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

type IconProps = {
  name: IconName;
  size?: number;
  /** A theme token, or a raw colour from a navigator (tab bars pass one). */
  color?: ColorToken | (string & {});
  strokeWidth?: number;
};

// Web forwards unknown props to the DOM (React warns about `importantForAccessibility`),
// so hide the decorative glyph from assistive tech with the DOM-native attribute there.
const HIDDEN =
  Platform.OS === 'web'
    ? ({ 'aria-hidden': true } as const)
    : ({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      } as const);

/** Decorative by default: pair it with a text label or an `accessibilityLabel` on the control. */
export function Icon({ name, size = 20, color = 'fg2', strokeWidth = 1.75 }: IconProps) {
  const { colors } = useTheme();
  const stroke = color in colors ? colors[color as ColorToken] : color;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...HIDDEN}
    >
      {PATHS[name]}
    </Svg>
  );
}
