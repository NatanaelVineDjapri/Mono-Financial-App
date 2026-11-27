import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { preventScreenCaptureAsync } from 'expo-screen-capture';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { SplashBrand } from '@/components/SplashBrand';
import { ToastHost } from '@/components/ToastHost';
import { setNumberFormat, useNumberFormat } from '@/core/money';
import { DbProvider, useDb } from '@/data/db/DbProvider';
import { getSetting } from '@/data/repo/settings';
import { useBlockScreenshots } from '@/features/ai_chat/useBlockScreenshots';
import { FxAutoUpdate } from '@/features/fx/FxAutoUpdate';
import { ImportSync } from '@/features/import/ImportSync';
import { ReadyOnOtherRoute } from '@/features/startup/ReadyOnOtherRoute';
import { RecurringConfirmHost } from '@/features/recurring/RecurringConfirmHost';
import { NotificationsInit } from '@/features/notifications/NotificationsInit';
import { initialLanguage, useLanguage } from '@/i18n/lang';
import { navTheme } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

// Block from the very first frame (splash, fonts and DB still loading). BlockScreenshotsInit
// below releases the 'app' tag only if the person turned the setting off.
preventScreenCaptureAsync('app').catch(() => {});

// SQLite reads never go stale behind our back — every write already calls
// invalidateAfterWrite() (src/data/queryKeys.ts), so react-query only needs to refetch
// when told to, not on a timer. A failed query is a real bug, not a flaky network call,
// so it isn't worth retrying either.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: 0 } },
});

// "Block screenshots" (settings.block_screenshots, on by default) covers the whole app, not
// just the AI screens: FLAG_SECURE also hides the app in the recent-apps preview.
function BlockScreenshotsInit() {
  useBlockScreenshots('app');
  return null;
}

// The UI language, the number format and Hide amounts on launch (CLAUDE.md rule 12: `hide_on_launch` starts the mode). They are
// read before anything is drawn, so a person who chose Indonesian or international format never sees a flash of defaults, and
// one who hides amounts on launch never sees a figure for a moment before they are hidden; and the tree below is drawn again
// when the language or the format changes, because text and figures are read at render time.
function LanguageGate({ children }: { children: ReactNode }) {
  const db = useDb();
  const language = useLanguage(s => s.language);
  const numberFormat = useNumberFormat(s => s.numberFormat);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSetting(db, 'language'), getSetting(db, 'number_format'), getSetting(db, 'hide_on_launch')])
      .then(([langVal, numVal, hideVal]) => {
        if (!cancelled) {
          useLanguage.getState().setLanguage(initialLanguage(langVal));
          if (numVal === 'en_US' || numVal === 'id_ID') {
            setNumberFormat(numVal);
          }
          useHideAmounts.getState().setHidden(hideVal === '1');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  if (!loaded) return null;
  return <Fragment key={`${language}-${numberFormat}`}>{children}</Fragment>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // The design has one (dark) palette, so the app theme is forced rather than
  // following the system colour scheme.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navTheme}>
            <SplashBrand />
            <DbProvider>
              <BlockScreenshotsInit />
              <NotificationsInit />
              <ImportSync />
              <FxAutoUpdate />
              <LanguageGate>
              {/* A real Stack (not Slot) so the (tabs) navigator stays mounted underneath
                  every sibling route (account/[id], budget/*, tx/[id], ai-chat, dev) — pushed
                  with an absolute path from inside a tab. Without this, popping back off one
                  of those screens re-created the tabs navigator from scratch and always landed
                  back on its first tab (Overview) instead of the tab the user actually came
                  from. Every screen below already draws its own header, so the native one is
                  off everywhere. */}
                <Stack screenOptions={{ headerShown: false }} />
                <ToastHost />
                <ReadyOnOtherRoute />
                <RecurringConfirmHost />
              </LanguageGate>
            </DbProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
