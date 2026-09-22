import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { Screen } from './Screen';

function renderScreen(props: Partial<React.ComponentProps<typeof Screen>> = {}) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider>
        <Screen {...props}>
          <Text>content</Text>
        </Screen>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('Screen', () => {
  it('claims the top safe area by default', () => {
    renderScreen();
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).toEqual(['top', 'left', 'right']);
  });

  it('leaves the top safe area to a parent when embedded (topInset=false)', () => {
    renderScreen({ topInset: false });
    expect(screen.UNSAFE_getByType(SafeAreaView).props.edges).toEqual(['left', 'right']);
  });
});
