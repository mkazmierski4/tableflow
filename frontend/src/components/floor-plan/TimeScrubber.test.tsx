import { fireEvent, render, screen } from '@testing-library/react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { TimeScrubber } from './TimeScrubber';

const LABELS = ['12:00', '12:30', '13:00', '13:30', '14:00'];

function setup(index = 2) {
  const onChange = jest.fn();
  render(
    <ThemeProvider>
      <TimeScrubber labels={LABELS} index={index} onChange={onChange} />
    </ThemeProvider>,
  );
  return onChange;
}

const layout = () =>
  fireEvent(screen.getByTestId('time-scrubber'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 32 } },
  });

describe('TimeScrubber', () => {
  it('shows the chosen time and the range', () => {
    setup(2);

    expect(screen.getByText('Time · 13:00')).toBeTruthy();
    const slider = screen.getByTestId('time-scrubber');
    expect(slider.props['aria-valuenow']).toBe(2);
    expect(slider.props['aria-valuetext']).toBe('13:00');
    expect(slider.props['aria-valuemax']).toBe(4);
  });

  it('steps with the arrows', () => {
    const onChange = setup(2);

    fireEvent.press(screen.getByRole('button', { name: 'Later' }));
    fireEvent.press(screen.getByRole('button', { name: 'Earlier' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 3);
    expect(onChange).toHaveBeenNthCalledWith(2, 1);
  });

  it('cannot step before the first step', () => {
    setup(0);
    expect(screen.getByRole('button', { name: 'Earlier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Later' })).toBeEnabled();
  });

  it('cannot step past the last step', () => {
    setup(4);
    expect(screen.getByRole('button', { name: 'Later' })).toBeDisabled();
  });

  it('can be adjusted by assistive technology', () => {
    const onChange = setup(2);
    const slider = screen.getByTestId('time-scrubber');

    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect(onChange).toHaveBeenNthCalledWith(1, 3);
    expect(onChange).toHaveBeenNthCalledWith(2, 1);
  });

  it('follows a finger dragged along the track', () => {
    const onChange = setup(0);
    layout();

    fireGestureHandler(getByGestureTestId('time-scrubber'), [
      { state: 2, x: 0 },
      { state: 4, x: 0 },
      { x: 100 },
      { x: 200 },
      { x: 400 },
      { state: 5, x: 400 },
    ]);

    // 400 px across 4 steps: 100 → 1, 200 → 2, 400 → 4.
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining([1, 2, 4]));
  });

  it('never picks outside the range', () => {
    const onChange = setup(2);
    layout();

    fireGestureHandler(getByGestureTestId('time-scrubber'), [
      { state: 2, x: -50 },
      { state: 4, x: 900 },
      { state: 5, x: 900 },
    ]);

    const picked = onChange.mock.calls.map((c) => c[0]);
    expect(Math.min(...picked)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...picked)).toBeLessThanOrEqual(4);
  });
});
