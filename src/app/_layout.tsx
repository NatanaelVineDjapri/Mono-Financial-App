import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHideAmounts } from '@/components/hide-amounts-store';
import { SplashBrand } from '@/components/SplashBrand';
import { ToastHost } from '@/components/ToastHost';
import { DbProvider, useDb } from '@/data/db/DbProvider';
import { getSetting } from '@/data/repo/settings';
import { ImportSync } from '@/features/import/ImportSync';
import { initialLanguage, useLanguage } from '@/i18n/lang';
import { navTheme } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

// SQLite reads never go stale behind our back — every write already calls
// invalidateAfterWrite() (src/data/queryKeys.ts), so react-query only needs to refetch
// when told to, not on a timer. A failed query is a real bug, not a flaky network call,
// so it isn't worth retrying either.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, retry: 0 } },
});

// Hidden-amounts mode (CLAUDE.md rule 12) starts from the existing `hide_on_launch`
// setting — there is no UI to change it yet (that toggle is Phase 7), only this
// initial read.
function HiddenAmountsInit() {
  const db = useDb();

  useEffect(() => {
    let cancelled = false;
    getSetting(db, 'hide_on_launch').then(value => {
      if (!cancelled) useHideAmounts.getState().setHidden(value === '1');
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  return null;
}

// The UI language (settings.language, English until the person picks another). It is read before
// anything is drawn, so a person who chose Indonesian never sees a flash of English; and the tree
// below is drawn again when the language changes, because the text is read at render time.
function LanguageGate({ children }: { children: ReactNode }) {
  const db = useDb();
  const language = useLanguage(s => s.language);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSetting(db, 'language')
      .then(value => {
        if (!cancelled) useLanguage.getState().setLanguage(initialLanguage(value));
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
  return <Fragment key={language}>{children}</Fragment>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
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

  // The design has one (dark) palette, so the app theme is forced rather than
  // following the system colour scheme.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navTheme}>
            <SplashBrand />
            <DbProvider>
              <HiddenAmountsInit />
              <ImportSync />
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
              </LanguageGate>
            </DbProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
