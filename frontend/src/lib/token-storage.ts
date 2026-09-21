import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'tableflow.access-token';

/**
 * Native: the OS keychain/keystore (expo-secure-store).
 * Web: localStorage, the only persistent option; it is readable by any script on the
 * page, which is why tokens are short-lived (60 min) and never logged.
 */
export const tokenStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(KEY) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(KEY);
  },

  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(KEY, token);
      } catch {
        // Storage blocked (private mode): the session simply will not survive a reload.
      }
      return;
    }
    await SecureStore.setItemAsync(KEY, token);
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(KEY);
      } catch {
        // nothing stored
      }
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  },
};
