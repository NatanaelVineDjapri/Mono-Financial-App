// Which apps have a parser of their own (docs/IMPORT_PLAN.md, section 6). An app is listed here
// only when a parser module for it exists AND that parser is tested with real sample texts from
// that app: a format is never invented. The list is EMPTY until real samples arrive (the dev
// sampler at /dev/import-sampler is how they are collected).
//
// An app that is not listed is still read, by the general parser, and everything it finds is
// marked "Ditebak" on the review screen. Only a listed app is called "Didukung penuh".
import type { SupportedLevel } from '../../../data/repo/importApps';

export interface InstitutionEntry {
  institution: string; // shown as the app's name in "Didukung penuh"
}

export const FULL_SUPPORT: Readonly<Record<string, InstitutionEntry>> = {};

export function supportLevel(pkg: string): SupportedLevel {
  return Object.prototype.hasOwnProperty.call(FULL_SUPPORT, pkg) ? 'full' : 'generic';
}
