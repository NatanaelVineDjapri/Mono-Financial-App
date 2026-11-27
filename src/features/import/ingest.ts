// Notifications from the native listener into the review queue, one at a time (docs/IMPORT_PLAN.md, section 6).
// Three arrivals share one path: the live event (the app is open), the queue the service filled while the app was
// closed, and what is still in the notification shade (both read at start and on every return to the front). Each one is parsed by the domain, which
// stores only the parsed fields; this file never keeps, logs or rethrows a notification's text.
import type { Db } from '../../data/db/types';
import { enqueueNotification, pruneOldQueue, type EnqueueOptions, type IncomingNotification } from '../../domain/importQueue';

export interface Ingestor {
  // Queue one notification; resolves when it has been handled (never rejects).
  push: (raw: IncomingNotification, options?: EnqueueOptions) => Promise<void>;
  // Resolves when everything pushed so far has been handled.
  idle: () => Promise<void>;
}

// `onAdded` runs after a notification became a queue row (to refresh the screens).
export function createIngestor(db: Db, onAdded: () => void): Ingestor {
  let chain: Promise<void> = Promise.resolve();
  const push = (raw: IncomingNotification, options?: EnqueueOptions): Promise<void> => {
    chain = chain.then(async () => {
      try {
        if ((await enqueueNotification(db, raw, options)) === 'added') onAdded();
      } catch {
        // One bad notification never stops the next one, and nothing about it is logged.
      }
    });
    return chain;
  };
  return { push, idle: () => chain };
}

// Old rejected and saved rows are only there to stop a notification coming back twice; clear the old ones.
export async function prune(db: Db): Promise<void> {
  try {
    await pruneOldQueue(db);
  } catch {
    // Nothing to do: the next start tries again.
  }
}
