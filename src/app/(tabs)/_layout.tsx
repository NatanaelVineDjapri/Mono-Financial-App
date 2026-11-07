// DESIGN.md sections 8/9: the five bottom tabs, drawn with our own custom TabBar (never
// the OS tab bar) so the amber indicator and typography match the design on every
// platform — hence `expo-router/js-tabs` (the JS-rendered, React Navigation-backed
// navigator) rather than `expo-router/native-tabs`.
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { IconName } from '@/components/Icon';
import { TabBar, type TabBarItem } from '@/components/TabBar';
import { useTabBarVisibility } from '@/components/tab-bar-visibility-store';
import { tabLabel, type TabKey } from '@/i18n/id';

const TAB_ROUTES: { name: string; key: TabKey; icon: IconName }[] = [
  { name: 'index', key: 'overview', icon: 'overview' },
  { name: 'transactions', key: 'transactions', icon: 'flow' },
  { name: 'accounts', key: 'accounts', icon: 'bank' },
  { name: 'budgets', key: 'budgets', icon: 'pie' },
  { name: 'more', key: 'more', icon: 'dots' },
];

function CustomTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
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
          bottomInset={insets.bottom}
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
