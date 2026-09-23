import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export type HotkeyMap = Record<string, () => void>;

/** `true` on a Mac, where shortcuts use ⌘ instead of Ctrl. Safe to call on native (always false). */
export function isMac(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform;
  return /mac/i.test(platform ?? navigator.platform ?? navigator.userAgent);
}

/** How a `mod+…` binding reads on this platform: `⌘K` on a Mac, `Ctrl K` elsewhere. */
export function modLabel(key: string): string {
  return isMac() ? `⌘${key.toUpperCase()}` : `Ctrl ${key.toUpperCase()}`;
}

function isTyping(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Enter and Space already activate a focused control; a shortcut must not fire on top of that. */
function isControl(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.closest('button, a, [role="button"], [role="radio"], [role="tab"]') !== null;
}

/** The map key a keydown event should be looked up by: `mod+k`, or the plain key otherwise. */
function eventKey(event: KeyboardEvent): string {
  const modHeld = isMac() ? event.metaKey : event.ctrlKey;
  const letter = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return modHeld ? `mod+${letter}` : letter;
}

/**
 * Keyboard shortcuts for the web app. Keys are matched by `KeyboardEvent.key` (letters are
 * case-insensitive); prefix a binding with `mod+` for Ctrl (Windows/Linux) or ⌘ (Mac) — e.g.
 * `mod+k`. Plain shortcuts do not fire while typing in a field, except `Escape`, and never with
 * Alt held or an unrelated Ctrl/Meta combination, so browser and system shortcuts keep working.
 * `Enter` yields to a focused button or radio. On native this hook does nothing.
 */
export function useHotkeys(keys: HotkeyMap, enabled = true): void {
  const latest = useRef(keys);
  useEffect(() => {
    latest.current = keys;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.repeat) return;
      const key = eventKey(event);
      const usesMod = key.startsWith('mod+');
      // A plain binding must not fire with an unrelated modifier held (e.g. Ctrl+S); a mod
      // binding has already matched exactly the modifier it asked for.
      if (!usesMod && (event.ctrlKey || event.metaKey)) return;
      const handler = latest.current[key];
      if (!handler) return;
      // A mod+ combo is unambiguous even while typing (that is the point of e.g. mod+k); a plain
      // letter is not, and Escape always gets through so a field can still be dismissed with it.
      if (isTyping(event.target) && event.key !== 'Escape' && !usesMod) return;
      if (event.key === 'Enter' && isControl(event.target)) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
