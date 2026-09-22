import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { SWIPE_THRESHOLD, SwipeRow, swipeOutcome } from './SwipeRow';

describe('swipeOutcome', () => {
  it('needs a full threshold of travel in one direction', () => {
    expect(swipeOutcome(0)).toBeNull();
    expect(swipeOutcome(SWIPE_THRESHOLD - 1)).toBeNull();
    expect(swipeOutcome(-(SWIPE_THRESHOLD - 1))).toBeNull();
    expect(swipeOutcome(SWIPE_THRESHOLD)).toBe('right');
    expect(swipeOutcome(-SWIPE_THRESHOLD)).toBe('left');
    expect(swipeOutcome(400)).toBe('right');
  });

  it('uses a 96 px threshold by default', () => {
    expect(SWIPE_THRESHOLD).toBe(96);
  });
});

function setup() {
  const seat = jest.fn();
  const cancel = jest.fn();
  render(
    <SwipeRow
      testID="row"
      right={{ label: 'Seat', tone: 'accent', onSwipe: seat }}
      left={{ label: 'Cancel', tone: 'danger', onSwipe: cancel }}
    >
      <Text>Nowak</Text>
    </SwipeRow>,
  );
  return { seat, cancel, gesture: () => getByGestureTestId('row') };
}

/** A drag from the start to `dx` in a few steps, released there. */
const drag = (gesture: ReturnType<typeof getByGestureTestId>, dx: number) =>
  fireGestureHandler(gesture, [
    { state: 2 /* BEGAN */ },
    { state: 4 /* ACTIVE */, translationX: dx / 2 },
    { translationX: dx },
    { state: 5 /* END */, translationX: dx },
  ]);

describe('SwipeRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs the right action when released past the threshold', () => {
    const { seat, cancel, gesture } = setup();
    drag(gesture(), 140);
    expect(seat).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('runs the left action when dragged the other way', () => {
    const { seat, cancel, gesture } = setup();
    drag(gesture(), -140);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(seat).not.toHaveBeenCalled();
  });

  it('does nothing when released short of the threshold', () => {
    const { seat, cancel, gesture } = setup();
    drag(gesture(), 80);
    drag(gesture(), -80);
    expect(seat).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('gives a haptic tick when the threshold is crossed, once per crossing', () => {
    const { gesture } = setup();
    fireGestureHandler(gesture(), [
      { state: 2 },
      { state: 4, translationX: 50 },
      { translationX: 100 },
      { translationX: 120 },
      { translationX: 60 },
      { translationX: 110 },
      { state: 5, translationX: 110 },
    ]);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2); // in, out, in again
  });

  it('exposes the actions to assistive technology', () => {
    const { seat, cancel } = setup();
    const row = screen.getByTestId('row');
    expect(row.props.accessibilityActions).toEqual([
      { name: 'swipe-right', label: 'Seat' },
      { name: 'swipe-left', label: 'Cancel' },
    ]);

    fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'swipe-right' } });
    fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'swipe-left' } });

    expect(seat).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('is a plain view without actions', () => {
    render(
      <SwipeRow testID="plain">
        <Text>Just text</Text>
      </SwipeRow>,
    );
    expect(screen.getByTestId('plain').props.accessibilityActions).toBeUndefined();
    expect(screen.getByText('Just text')).toBeTruthy();
  });
});
