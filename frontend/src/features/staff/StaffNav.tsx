import { useRouter, type Href } from 'expo-router';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import { cn } from '@/lib/cn';

export const WIDE_BREAKPOINT = 1024;

/** The console layout (side rail, floor plan with a details column) needs a desktop-sized window. */
export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

type Section = 'floor' | 'today';

const ITEMS: { key: Section | 'profile'; label: string; icon: IconName; href: Href }[] = [
  { key: 'today', label: 'Today', icon: 'list', href: '/today' },
  { key: 'floor', label: 'Floor', icon: 'grid', href: '/floor' },
  { key: 'profile', label: 'Profile', icon: 'user', href: '/profile' },
];

/** Side rail on wide screens, tab bar on phones. */
export function StaffNav({ active }: { active: Section }) {
  const router = useRouter();
  const wide = useIsWide();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Staff"
      className={cn(
        'border-line bg-nav',
        wide
          ? 'w-[72px] items-center gap-2 border-r py-5'
          : 'h-[68px] flex-row items-center justify-around border-t',
      )}
    >
      {ITEMS.map((item) => {
        const current = item.key === active;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            aria-selected={current}
            onPress={() =>
              item.key === 'profile' ? router.navigate(item.href) : router.replace(item.href)
            }
            className={cn(
              'items-center justify-center rounded-2xl',
              wide ? 'h-12 w-12' : 'h-14 flex-1 gap-0.5',
              current && wide && 'bg-accent/15',
            )}
          >
            <Icon name={item.icon} size={22} color={current ? 'accent' : 'muted'} />
            {wide ? null : (
              <AppText variant="badge" tone={current ? 'accent' : 'muted'}>
                {item.label}
              </AppText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
