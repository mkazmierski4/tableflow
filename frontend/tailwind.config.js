/** @type {import('tailwindcss').Config} */

// Every colour is an RGB triple exposed as a CSS variable by `src/theme/tokens.ts`,
// so one class (`bg-surface`) follows the active theme with no `dark:` variants.
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),
        nav: token('nav'),
        fg: token('fg'),
        fg2: token('fg2'),
        muted: token('muted'),
        accent: token('accent'),
        'on-accent': token('on-accent'),
        pending: token('pending'),
        confirmed: token('confirmed'),
        seated: token('seated'),
        completed: token('completed'),
        danger: token('danger'),
      },
      fontFamily: {
        // One family per loaded font file: React Native does not synthesise weights.
        display: ['BricolageGrotesque_700Bold'],
        sans: ['DMSans_400Regular'],
        'sans-medium': ['DMSans_500Medium'],
        'sans-semibold': ['DMSans_600SemiBold'],
      },
      borderRadius: {
        chip: '12px',
        button: '14px',
        card: '20px',
      },
    },
  },
  plugins: [],
};
