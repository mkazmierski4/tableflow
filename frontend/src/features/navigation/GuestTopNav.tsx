import { useRouter, usePathname, type Href } from 'expo-router';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import { cn } from '@/lib/cn';

type NavItem = { href: Href; label: string; icon: IconName };

const ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Explore', icon: 'compass' },
  { href: '/reservations', label: 'Reservations', icon: 'list' },
  { href: '/profile', label: 'Profile', icon: 'user' },
];

/** Below this width the three links and the wordmark no longer fit on one line as text. */
const NARROW_BREAKPOINT = 640;

/**
 * The web equivalent of the native bottom tab bar: a slim, persistent top bar (logo, nav links,
 * profile) instead of a mobile-style bar stretched across a desktop window. It renders once in
 * `(tabs)/_layout.tsx`, around a `Slot`, so switching pages never remounts or reflows it. Below
 * `NARROW_BREAKPOINT` the labels drop to icons so a narrow browser window never clips a link.
 */
export function GuestTopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const narrow = useWindowDimensions().width < NARROW_BREAKPOINT;

  return (
    <View className="border-b border-line bg-nav">
      <View
        className={cn(
          'mx-auto w-full max-w-[960px] flex-row items-center justify-between py-2.5',
          narrow ? 'px-4' : 'px-6',
        )}
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="TableFlow, home"
          onPress={() => router.navigate('/')}
          className="flex-row items-center gap-2.5"
        >
          <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-accent">
            <Icon name="grid" size={17} color="on-accent" strokeWidth={2} />
          </View>
          {narrow ? null : (
            <AppText variant="heading" className="text-base">
              TableFlow
            </AppText>
          )}
        </Pressable>

        <View accessibilityRole="tablist" accessibilityLabel="Explore" className="flex-row gap-1">
          {ITEMS.map((item) => {
            // "/" also matches a restaurant's own route while inside Explore's stack, so only
            // the leading segment counts (an empty segment set means Explore, the home route).
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href as string);
            return (
              <Pressable
                key={item.href as string}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                aria-selected={active}
                onPress={() => router.navigate(item.href)}
                className={cn(
                  'h-10 flex-row items-center justify-center gap-2 rounded-full',
                  narrow ? 'w-10' : 'px-4',
                  active && 'bg-accent/15',
                )}
              >
                <Icon name={item.icon} size={18} color={active ? 'accent' : 'muted'} />
                {narrow ? null : (
                  <AppText
                    variant={active ? 'chipActive' : 'chip'}
                    tone={active ? 'accent' : 'fg2'}
                  >
                    {item.label}
                  </AppText>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
