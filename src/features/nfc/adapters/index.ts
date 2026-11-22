// The adapters, in the order they are tried. Bank DKI JakCard has none: the public notes give how to read its balance
// but not how to read its card number, and without a number the card cannot be recognised again, so it is reported as
// not supported (the issuer name stays in the schema for the day a number can be read).
import type { CardAdapter } from './common';
import { brizziAdapter } from './brizzi';
import { flazzAdapter } from './flazz';
import { mandiriAdapter } from './mandiri';
import { tapcashAdapter } from './tapcash';

export const ADAPTERS: readonly CardAdapter[] = [mandiriAdapter, flazzAdapter, tapcashAdapter, brizziAdapter];

// Every application MONO may select by name: the ones the adapters declare, and nothing else.
export const ALLOWED_AIDS: readonly (readonly number[])[] = ADAPTERS.flatMap(a => a.aids);
