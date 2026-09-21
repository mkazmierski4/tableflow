import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test-utils';

import { BottomSheet, Button, FilterChip, Input, SegmentedControl, StatusChip, TableTile } from '.';

const render = (ui: React.ReactElement) => renderWithProviders(ui, { withAuth: false });

describe('Button', () => {
  it('calls onPress and exposes its label as a button', () => {
    const onPress = jest.fn();
    render(<Button label="Reserve" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Reserve' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled or loading', () => {
    const onPress = jest.fn();
    const { rerender } = render(<Button label="Reserve" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole('button', { name: 'Reserve' }));
    rerender(<Button label="Reserve" onPress={onPress} loading />);
    fireEvent.press(screen.getByRole('button', { name: 'Reserve' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reports busy state to assistive tech while loading', () => {
    render(<Button label="Save" onPress={jest.fn()} loading />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeBusy();
  });
});

describe('Input', () => {
  it('is reachable by its label and reports typing', () => {
    const onChangeText = jest.fn();
    render(<Input label="Email" value="" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'ann@example.com');
    expect(onChangeText).toHaveBeenCalledWith('ann@example.com');
  });

  it('shows an error as an alert, in place of the hint', () => {
    render(
      <Input
        label="Email"
        value=""
        onChangeText={jest.fn()}
        hint="We never share it"
        error="Enter a valid e-mail."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid e-mail.');
    expect(screen.queryByText('We never share it')).toBeNull();
  });

  it('shows the hint when there is no error', () => {
    render(<Input label="Email" value="" onChangeText={jest.fn()} hint="We never share it" />);
    expect(screen.getByText('We never share it')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ] as const;

  it('marks the current option selected and reports changes', () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        accessibilityLabel="Mode"
        options={options}
        value="a"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Alpha' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Beta' })).not.toBeSelected();

    fireEvent.press(screen.getByRole('tab', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('FilterChip', () => {
  it('reflects the selected state and handles presses', () => {
    const onPress = jest.fn();
    const { rerender } = render(<FilterChip label="Open now" onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Open now' })).not.toBeSelected();

    rerender(<FilterChip label="Open now" selected onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Open now' })).toBeSelected();

    fireEvent.press(screen.getByRole('button', { name: 'Open now' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('StatusChip', () => {
  it.each([
    ['pending', 'Pending'],
    ['confirmed', 'Confirmed'],
    ['seated', 'Seated'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
    ['no_show', 'No-show'],
  ] as const)('labels %s as %s', (status, label) => {
    render(<StatusChip status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });
});

describe('TableTile', () => {
  it('describes the table and its state for screen readers', () => {
    render(<TableTile label="T7" seats={8} state="confirmed" />);
    expect(screen.getByRole('button', { name: 'Table T7, seats 8, confirmed' })).toBeTruthy();
  });

  it('is only interactive when given a handler', () => {
    const onPress = jest.fn();
    render(
      <>
        <TableTile label="T1" seats={4} state="free" onPress={onPress} />
        <TableTile label="T2" seats={2} state="free" />
      </>,
    );
    fireEvent.press(screen.getByRole('button', { name: /Table T1/ }));
    fireEvent.press(screen.getByRole('button', { name: /Table T2/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('BottomSheet', () => {
  it('renders its title and content only while visible', () => {
    const { rerender } = render(
      <BottomSheet visible={false} title="City" onClose={jest.fn()}>
        <Text>Options</Text>
      </BottomSheet>,
    );
    expect(screen.queryByText('Options')).toBeNull();

    rerender(
      <BottomSheet visible title="City" onClose={jest.fn()}>
        <Text>Options</Text>
      </BottomSheet>,
    );
    expect(screen.getByText('City')).toBeTruthy();
    expect(screen.getByText('Options')).toBeTruthy();
  });

  it('closes from the close button and from the backdrop', () => {
    const onClose = jest.fn();
    render(
      <BottomSheet visible title="City" onClose={onClose}>
        <Text>Options</Text>
      </BottomSheet>,
    );
    for (const close of screen.getAllByRole('button', { name: 'Close' })) fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
