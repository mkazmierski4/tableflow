import { MotiView } from 'moti';
import type { ReactNode } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

type RevealProps = {
  children: ReactNode;
  /** Milliseconds before the entrance starts (used to stagger siblings). */
  delay?: number;
};

/** Fades in and rises 16 px. With reduced motion it is a short fade, with no movement. */
export function Reveal({ children, delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion();
  return (
    <MotiView
      from={{ opacity: 0, translateY: reduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        type: 'timing',
        duration: reduceMotion ? 120 : 320,
        delay: reduceMotion ? 0 : delay,
      }}
    >
      {children}
    </MotiView>
  );
}
