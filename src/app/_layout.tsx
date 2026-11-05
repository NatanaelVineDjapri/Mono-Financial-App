import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader';
import { useFonts } from 'expo-font';
import { Slot, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { navTheme } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const pathname = usePathname();
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_500Medium,
    Newsreader_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // AppTabs (web: expo-router/ui's <Tabs>) only knows the two declared tab routes ("/"
  // and "/explore") and corrects any other path back to the initial one — so a route
  // outside the tab bar (like the __DEV__-only /dev/gallery) must render through a plain
  // <Slot/> instead, or it never stays put. Real tab-bar routes still go through AppTabs.
  const isTabRoute = pathname === '/' || pathname === '/explore';

  // The design has one (dark) palette, so the app theme is forced rather than
  // following the system colour scheme.
  return (
    <ThemeProvider value={navTheme}>
      <AnimatedSplashOverlay />
      {isTabRoute ? <AppTabs /> : <Slot />}
    </ThemeProvider>
  );
}
