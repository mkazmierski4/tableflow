import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export type HotkeyMap = Record<string, () => void>;

function isTyping(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Enter and Space already activate a focused control; a shortcut must not fire on top of that. */
function isControl(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.closest('button, a, [role="button"], [role="radio"], [role="tab"]') !== null;
}

/**
 * Keyboard shortcuts for the web console. Keys are matched by `KeyboardEvent.key` (letters are
 * case-insensitive). Shortcuts do not fire while typing in a field, except `Escape`, and never
 * with Ctrl/Meta/Alt held, so browser and system shortcuts keep working. `Enter` yields to a focused
 * button or radio. On native it does nothing.
 */
export function useHotkeys(keys: HotkeyMap, enabled = true): void {
  const latest = useRef(keys);
  useEffect(() => {
    latest.current = keys;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const handler = latest.current[key] ?? latest.current[event.key];
      if (!handler) return;
      if (isTyping(event.target) && event.key !== 'Escape') return;
      if (event.key === 'Enter' && isControl(event.target)) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
