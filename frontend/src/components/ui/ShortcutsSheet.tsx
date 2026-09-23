import { View } from 'react-native';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Kbd } from './Kbd';

export type ShortcutEntry = { keys: string[]; label: string };
export type ShortcutGroup = { title: string; items: ShortcutEntry[] };

type ShortcutsSheetProps = {
  visible: boolean;
  onClose: () => void;
  groups: ShortcutGroup[];
};

/**
 * The `?` overlay: every shortcut a screen binds via `useHotkeys`, so it never has to be
 * discovered by accident. Each screen builds its own `groups` next to its real bindings (see
 * e.g. `FloorScreen`), so the list shown here cannot drift from what actually works.
 */
export function ShortcutsSheet({ visible, onClose, groups }: ShortcutsSheetProps) {
  return (
    <BottomSheet visible={visible} title="Keyboard shortcuts" onClose={onClose}>
      <View className="gap-5 pt-1">
        {groups.map((group) => (
          <View key={group.title} className="gap-2.5">
            <AppText variant="label" className="uppercase tracking-wider">
              {group.title}
            </AppText>
            <View className="gap-2">
              {group.items.map((item) => (
                <View
                  key={item.label}
                  className="flex-row items-center justify-between gap-3 py-0.5"
                >
                  <AppText variant="body" className="flex-1">
                    {item.label}
                  </AppText>
                  <View className="flex-row gap-1.5">
                    {item.keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}
