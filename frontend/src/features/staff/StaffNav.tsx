import { useRouter, usePathname, type Href } from 'expo-router';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import { cn } from '@/lib/cn';

export const WIDE_BREAKPOINT = 1024;

/** The console layout (side rail, floor plan with a details column) needs a desktop-sized window. */
export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

const ITEMS: { label: string; icon: IconName; href: Href }[] = [
  { label: 'Today', icon: 'list', href: '/today' },
  { label: 'Floor', icon: 'grid', href: '/floor' },
  { label: 'Account', icon: 'user', href: '/account' },
];

/**
 * The console's persistent chrome: a side rail on wide screens, a bottom tab bar on phones.
 * Rendered once, in `(staff)/_layout.tsx`, around the routed content — never inside a screen —
 * so switching between Today, Floor and Account never remounts it.
 */
export function StaffNav() {
  const router = useRouter();
  const pathname = usePathname();
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
        const current = pathname.startsWith(item.href as string);
        return (
          <Pressable
            key={item.href as string}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            aria-selected={current}
            onPress={() => router.replace(item.href)}
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
