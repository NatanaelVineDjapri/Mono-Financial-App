// DESIGN.md "Bottom navigation": four tabs (Overview, Transactions, Accounts, Budgets) and a
// gold "+" in the middle of the bar that opens the AI chat. Drawn with our own custom
// TabBar (never the OS tab bar) so the bar matches the design on every platform — hence
// `expo-router/js-tabs` (the JS-rendered, React Navigation-backed navigator) rather than
// `expo-router/native-tabs`. More is not a tab: it is the pushed route /more.
//
// The bar floats over the screens (absolute, transparent zone), so each tab screen pads its
// scroll content by `useTabBarClearance()`.
import { useRouter } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { IconName } from '@/components/Icon';
import { TabBar, fabCenterFromBottom, type TabBarItem } from '@/components/TabBar';
import { TabFabMenu, type TabFabMenuItem } from '@/components/TabFabMenu';
import { useTabBarVisibility } from '@/components/tab-bar-visibility-store';
import { aiEntryRoute, useAiConfigured } from '@/features/ai_chat/aiEntry';
import {
  addMenuAiAccessibilityLabel,
  addMenuManualAccessibilityLabel,
  addMenuScanAccessibilityLabel,
  addTransactionLabel,
  closeAddMenuLabel,
  tabLabel,
  type TabKey,
} from '@/i18n';

const TAB_ROUTES: { name: string; key: TabKey; icon: IconName }[] = [
  { name: 'index', key: 'overview', icon: 'overview' },
  { name: 'transactions', key: 'transactions', icon: 'flow' },
  { name: 'accounts', key: 'accounts', icon: 'bank' },
  { name: 'budgets', key: 'budgets', icon: 'pie' },
];

function CustomTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const aiConfigured = useAiConfigured();
  const hidden = useTabBarVisibility(s => s.hidden);
  // The three-way add menu that fans out from the centre +.
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // The Android back button closes the menu before it does anything else.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setMenuOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [menuOpen]);
  // Same two-state pattern as Sheet.tsx: `hidden` directly gates the Animated.View's own
  // JSX presence (that's what gives Reanimated an actual unmount to animate `exiting`
  // against — returning null a level up, before it ever renders, skipped that unmount
  // entirely and made the bar vanish instantly instead of fading). `mounted` just lags
  // behind to keep this function returning the wrapper until that exit finishes.
  const [mounted, setMounted] = useState(!hidden);
  const [prevHidden, setPrevHidden] = useState(hidden);
  if (hidden !== prevHidden) {
    setPrevHidden(hidden);
    if (!hidden) setMounted(true);
    if (hidden) setMenuOpen(false); // a sheet is taking over the screen: the menu must not linger
  }

  if (!mounted) return null;

  const items: TabBarItem[] = TAB_ROUTES.map(r => ({ key: r.name, label: tabLabel(r.key), icon: r.icon }));
  const activeKey = state.routes[state.index]?.name ?? TAB_ROUTES[0].name;

  const choose = (open: () => void) => () => {
    setMenuOpen(false);
    open();
  };
  const menuItems: TabFabMenuItem[] = [
    {
      key: 'scan',
      accessibilityLabel: addMenuScanAccessibilityLabel(),
      icon: 'scan',
      onPress: choose(() => router.push('/tx/scan' as never)),
    },
    {
      key: 'ai',
      accessibilityLabel: addMenuAiAccessibilityLabel(),
      icon: 'chat',
      onPress: choose(() => router.push(aiEntryRoute(aiConfigured) as never)),
    },
    {
      key: 'manual',
      accessibilityLabel: addMenuManualAccessibilityLabel(),
      icon: 'pencil',
      onPress: choose(() => router.push('/tx/add' as never)),
    },
  ];

  return (
    !hidden && (
      <Animated.View
        style={styles.host}
        entering={FadeIn}
        exiting={FadeOut.withCallback(finished => {
          'worklet';
          if (finished) scheduleOnRN(setMounted, false);
        })}
      >
        <TabFabMenu
          open={menuOpen}
          items={menuItems}
          centerFromBottom={fabCenterFromBottom(insets.bottom)}
          onClose={closeMenu}
          closeLabel={closeAddMenuLabel()}
          testID="tab-fab-menu"
        />
        <TabBar
          items={items}
          activeKey={activeKey}
          onPress={name => {
            setMenuOpen(false);
            const route = state.routes.find(r => r.name === name);
            if (route) navigateToTab(route.key);
          }}
          fabLabel={addTransactionLabel()}
          fabOpen={menuOpen}
          onFabPress={() => setMenuOpen(open => !open)}
          testID="tab-bar"
        />
      </Animated.View>
    )
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={props => <CustomTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'none' }}>
      {TAB_ROUTES.map(r => (
        <Tabs.Screen key={r.name} name={r.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
    // Always as tall as the screen (the bar sits at its bottom), so opening the add menu changes
  // nothing about the bar's layout: it never shifts. box-none everywhere except the bar itself
  // and the menu, so touches reach the content underneath.
  host: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'box-none', justifyContent: 'flex-end' },
});
