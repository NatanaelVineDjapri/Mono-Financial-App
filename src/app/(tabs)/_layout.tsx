// DESIGN.md sections 8/9: the five bottom tabs, drawn with our own custom TabBar (never
// the OS tab bar) so the amber indicator and typography match the design on every
// platform — hence `expo-router/js-tabs` (the JS-rendered, React Navigation-backed
// navigator) rather than `expo-router/native-tabs`.
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';

import type { IconName } from '@/components/Icon';
import { TabBar, type TabBarItem } from '@/components/TabBar';
import { tabLabel, type TabKey } from '@/i18n/id';

const TAB_ROUTES: { name: string; key: TabKey; icon: IconName }[] = [
  { name: 'index', key: 'overview', icon: 'overview' },
  { name: 'transactions', key: 'transactions', icon: 'flow' },
  { name: 'accounts', key: 'accounts', icon: 'bank' },
  { name: 'budgets', key: 'budgets', icon: 'pie' },
  { name: 'more', key: 'more', icon: 'dots' },
];

function CustomTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const items: TabBarItem[] = TAB_ROUTES.map(r => ({ key: r.name, label: tabLabel(r.key), icon: r.icon }));
  const activeKey = state.routes[state.index]?.name ?? TAB_ROUTES[0].name;

  return (
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
