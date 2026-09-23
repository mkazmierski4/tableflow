import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { ShortcutsSheet, type ShortcutGroup } from './ShortcutsSheet';

const GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    items: [
      { keys: ['N'], label: 'New reservation' },
      { keys: ['Ctrl', 'K'], label: 'Search' },
    ],
  },
  {
    title: 'Selected table',
    items: [{ keys: ['Esc'], label: 'Close panel' }],
  },
];

describe('ShortcutsSheet', () => {
  it('lists every group and its shortcuts when open', () => {
    renderWithProviders(<ShortcutsSheet visible groups={GROUPS} onClose={jest.fn()} />, {
      withAuth: false,
    });

    expect(screen.getByText('Keyboard shortcuts')).toBeTruthy();
    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.getByText('New reservation')).toBeTruthy();
    expect(screen.getByText('N')).toBeTruthy();
    expect(screen.getByText('Search')).toBeTruthy();
    expect(screen.getByText('Ctrl')).toBeTruthy();
    expect(screen.getByText('K')).toBeTruthy();
    expect(screen.getByText('Selected table')).toBeTruthy();
    expect(screen.getByText('Close panel')).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<ShortcutsSheet visible={false} groups={GROUPS} onClose={jest.fn()} />, {
      withAuth: false,
    });

    expect(screen.queryByText('Keyboard shortcuts')).toBeNull();
  });

  it('closes from its own close button', () => {
    const onClose = jest.fn();
    renderWithProviders(<ShortcutsSheet visible groups={GROUPS} onClose={onClose} />, {
      withAuth: false,
    });

    fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[0]!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
