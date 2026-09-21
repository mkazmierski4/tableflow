import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme, View } from 'react-native';

import { palette, themeVars, type Colors, type ThemeName } from './tokens';

export type ThemePreference = 'system' | 'dark' | 'light';

const STORAGE_KEY = 'tableflow.theme';
const PREFERENCES: readonly ThemePreference[] = ['system', 'dark', 'light'];

type ThemeContextValue = {
  /** The theme actually in effect. */
  scheme: ThemeName;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Raw hex values for the places classes cannot reach (icons, status bar, animations). */
  colors: Colors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ThemeName {
  if (preference === 'system') return system === 'light' ? 'light' : 'dark';
  return preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && stored && (PREFERENCES as readonly string[]).includes(stored)) {
          setPreferenceState(stored as ThemePreference);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const scheme = resolveScheme(preference, system);
  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, preference, setPreference, colors: palette[scheme] }),
    [scheme, preference, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      {/* The CSS variables cascade to every `bg-surface`-style class below. */}
      <View style={[{ flex: 1 }, themeVars[scheme]]} className="bg-bg">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}
