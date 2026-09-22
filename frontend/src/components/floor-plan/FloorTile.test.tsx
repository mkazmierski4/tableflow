import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { FloorTile } from './FloorTile';

const tile = (props: Partial<ComponentProps<typeof FloorTile>> = {}) => (
  <ThemeProvider>
    <FloorTile
      testID="tile"
      label="T7"
      seats={8}
      state="confirmed"
      detail="Nowak · 18:00"
      onPress={jest.fn()}
      {...props}
    />
  </ThemeProvider>
);

describe('FloorTile', () => {
  it('describes the table, its state and its occupant for screen readers', () => {
    render(tile());
    expect(
      screen.getByRole('button', { name: 'Table T7, seats 8, confirmed, Nowak · 18:00' }),
    ).toBeTruthy();
    expect(screen.getByText('T7')).toBeTruthy();
    expect(screen.getByText('Nowak · 18:00')).toBeTruthy();
  });

  it.each([
    ['free', 'free'],
    ['pending', 'pending'],
    ['seated', 'seated'],
    ['done', 'done'],
    ['no_show', 'no-show'],
  ] as const)('names the %s state', (state, word) => {
    render(tile({ state }));
    expect(screen.getByTestId('tile').props.accessibilityLabel).toContain(`, ${word}, `);
  });

  it('marks the selected table', () => {
    render(tile({ selected: true }));
    expect(screen.getByTestId('tile')).toBeSelected();
  });

  it('presses through', () => {
    const onPress = jest.fn();
    render(tile({ onPress }));
    fireEvent.press(screen.getByTestId('tile'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is inert without a handler', () => {
    render(tile({ onPress: undefined }));
    expect(screen.getByTestId('tile')).toBeDisabled();
  });

  it('re-renders into a new state', () => {
    const view = render(tile({ state: 'free' }));
    view.rerender(tile({ state: 'seated' }));
    expect(screen.getByTestId('tile').props.accessibilityLabel).toContain('seated');
  });
});
