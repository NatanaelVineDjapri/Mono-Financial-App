// The entrance when the app is opened (asked for by the owner): once per launch, after the splash lifts, the first
// screen's pieces rise into place and its main numbers count up. Armed by the splash (so a screen drawn on its own, as
// in tests, is simply there) and over a moment after the screen is ready: what appears later does not animate.
import { create } from 'zustand';

import { useAppReady } from './appReady';

export const INTRO_MS = 2000; // how long after "ready" the entrance is still on

export const useIntro = create<{ playing: boolean }>(() => ({ playing: false }));

let armed = false;

export function armIntro(): void {
  if (armed) return;
  armed = true;
  useIntro.setState({ playing: true });
  const finish = () => setTimeout(() => useIntro.setState({ playing: false }), INTRO_MS);
  if (useAppReady.getState().ready) {
    finish();
    return;
  }
  const unsubscribe = useAppReady.subscribe(state => {
    if (!state.ready) return;
    unsubscribe();
    finish();
  });
}

// For tests only.
export function resetIntro(): void {
  armed = false;
  useIntro.setState({ playing: false });
}
