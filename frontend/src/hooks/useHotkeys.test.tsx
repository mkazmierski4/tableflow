import { render } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { isMac, modLabel, useHotkeys, type HotkeyMap } from './useHotkeys';

type Listener = (event: Partial<KeyboardEvent>) => void;
let listener: Listener | null = null;

function Harness({ keys, enabled = true }: { keys: HotkeyMap; enabled?: boolean }) {
  useHotkeys(keys, enabled);
  return <Text>host</Text>;
}

const press = (key: string, extra: Partial<KeyboardEvent> = {}) => {
  const event = { key, preventDefault: jest.fn(), target: null, ...extra };
  listener?.(event);
  return event;
};

describe('useHotkeys', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    listener = null;
    Platform.OS = 'web';
    (globalThis as { window?: unknown }).window = {
      addEventListener: (_: string, fn: Listener) => (listener = fn),
      removeEventListener: () => (listener = null),
    };
  });
  afterEach(() => {
    // The stub stays: Testing Library unmounts after this hook and the cleanup still needs it.
    Platform.OS = originalOS;
  });

  it('runs the handler of a key, ignoring letter case', () => {
    const n = jest.fn();
    render(<Harness keys={{ n }} />);

    const event = press('N');
    press('n');

    expect(n).toHaveBeenCalledTimes(2);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('matches named keys exactly', () => {
    const left = jest.fn();
    const esc = jest.fn();
    render(<Harness keys={{ ArrowLeft: left, Escape: esc }} />);

    press('ArrowLeft');
    press('Escape');
    press('ArrowRight');

    expect(left).toHaveBeenCalledTimes(1);
    expect(esc).toHaveBeenCalledTimes(1);
  });

  it('leaves keys without a handler alone', () => {
    render(<Harness keys={{ n: jest.fn() }} />);
    expect(press('x').preventDefault).not.toHaveBeenCalled();
  });

  it('does not steal browser and system shortcuts', () => {
    const n = jest.fn();
    render(<Harness keys={{ n }} />);

    press('n', { ctrlKey: true });
    press('n', { metaKey: true });
    press('n', { altKey: true });
    press('n', { repeat: true });

    expect(n).not.toHaveBeenCalled();
  });

  it('is off when disabled', () => {
    render(<Harness keys={{ n: jest.fn() }} enabled={false} />);
    expect(listener).toBeNull();
  });

  it('always uses the latest handlers', () => {
    const first = jest.fn();
    const second = jest.fn();
    const view = render(<Harness keys={{ n: first }} />);
    view.rerender(<Harness keys={{ n: second }} />);

    press('n');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does nothing on native', () => {
    Platform.OS = 'ios';
    render(<Harness keys={{ n: jest.fn() }} />);
    expect(listener).toBeNull();
  });

  it('stops listening when unmounted', () => {
    const view = render(<Harness keys={{ n: jest.fn() }} />);
    expect(listener).not.toBeNull();
    view.unmount();
    expect(listener).toBeNull();
  });

  describe('mod+ bindings', () => {
    it('fires a mod+ binding on Ctrl (the default, non-Mac, platform)', () => {
      const k = jest.fn();
      render(<Harness keys={{ 'mod+k': k }} />);

      press('k', { ctrlKey: true });

      expect(k).toHaveBeenCalledTimes(1);
    });

    it('does not fire a mod+ binding on a plain key press', () => {
      const k = jest.fn();
      render(<Harness keys={{ 'mod+k': k }} />);

      press('k');

      expect(k).not.toHaveBeenCalled();
    });

    it('fires a mod+ binding while typing, unlike a plain shortcut', () => {
      // This test environment has no real DOM, so isTyping's `instanceof HTMLElement` check
      // needs a minimal stand-in to see a target as "a field" at all.
      class FakeHTMLElement {
        tagName: string;
        isContentEditable = false;
        constructor(tagName: string) {
          this.tagName = tagName;
        }
      }
      (globalThis as { HTMLElement?: unknown }).HTMLElement = FakeHTMLElement;
      try {
        const k = jest.fn();
        const n = jest.fn();
        render(<Harness keys={{ 'mod+k': k, n }} />);
        const input = new FakeHTMLElement('INPUT') as unknown as EventTarget;

        press('k', { ctrlKey: true, target: input });
        press('n', { target: input });

        expect(k).toHaveBeenCalledTimes(1);
        expect(n).not.toHaveBeenCalled();
      } finally {
        delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
      }
    });
  });

  describe('isMac / modLabel', () => {
    afterEach(() => {
      delete (globalThis as { navigator?: unknown }).navigator;
    });

    it('reads Ctrl by default, without a navigator', () => {
      expect(isMac()).toBe(false);
      expect(modLabel('k')).toBe('Ctrl K');
    });

    it('reads ⌘ on a Mac platform', () => {
      (globalThis as { navigator?: unknown }).navigator = { platform: 'MacIntel', userAgent: '' };
      expect(isMac()).toBe(true);
      expect(modLabel('k')).toBe('⌘K');
    });

    it('fires a mod+ binding on ⌘ when the platform is a Mac', () => {
      (globalThis as { navigator?: unknown }).navigator = { platform: 'MacIntel', userAgent: '' };
      const k = jest.fn();
      render(<Harness keys={{ 'mod+k': k }} />);

      press('k', { metaKey: true });
      expect(k).toHaveBeenCalledTimes(1); // the ⌘ press itself must be what fired it

      press('k', { ctrlKey: true }); // the "wrong" modifier on a Mac must not also fire it
      expect(k).toHaveBeenCalledTimes(1);
    });

    it('is false on native, regardless of navigator', () => {
      Platform.OS = 'ios';
      (globalThis as { navigator?: unknown }).navigator = { platform: 'MacIntel', userAgent: '' };
      expect(isMac()).toBe(false);
    });
  });
});
