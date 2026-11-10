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
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { IconName } from '@/components/Icon';
import { TabBar, type TabBarItem } from '@/components/TabBar';
import { useTabBarVisibility } from '@/components/tab-bar-visibility-store';
import { aiEntryRoute, useAiConfigured } from '@/features/ai_chat/aiEntry';
import { recordViaChatLabel, tabLabel, type TabKey } from '@/i18n/id';

const TAB_ROUTES: { name: string; key: TabKey; icon: IconName }[] = [
  { name: 'index', key: 'overview', icon: 'overview' },
  { name: 'transactions', key: 'transactions', icon: 'flow' },
  { name: 'accounts', key: 'accounts', icon: 'bank' },
  { name: 'budgets', key: 'budgets', icon: 'pie' },
];

function CustomTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const router = useRouter();
  const aiConfigured = useAiConfigured();
  const hidden = useTabBarVisibility(s => s.hidden);
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
  }

  if (!mounted) return null;

  const items: TabBarItem[] = TAB_ROUTES.map(r => ({ key: r.name, label: tabLabel(r.key), icon: r.icon }));
  const activeKey = state.routes[state.index]?.name ?? TAB_ROUTES[0].name;

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
        <TabBar
          items={items}
          activeKey={activeKey}
          onPress={name => {
            const route = state.routes.find(r => r.name === name);
            if (route) navigateToTab(route.key);
          }}
          fabLabel={recordViaChatLabel()}
          onFabPress={() => router.push(aiEntryRoute(aiConfigured) as never)}
          testID="tab-bar"
        />
      </Animated.View>
    )
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={props => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {TAB_ROUTES.map(r => (
        <Tabs.Screen key={r.name} name={r.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Over the screens, not below them; box-none so the transparent strip around the bar
  // passes touches through to the content underneath.
  host: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' },
});
