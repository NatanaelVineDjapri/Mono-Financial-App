// Type scale from TYPOGRAPHY.md section 7. Colour-neutral on purpose: spread a colour at
// the call site, e.g. `{ ...MonoText.body, color: MonoColors.textSecond }`.
// Android needs one font family name per weight, so never use fontWeight with these.
const UI = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semi: 'IBMPlexSans_600SemiBold',
};
const SERIF = 'Newsreader_400Regular';
const MONO = 'IBMPlexMono_500Medium';
const tab = { fontVariant: ['tabular-nums'] } as const;

// Consolidated to two display sizes per the TYPOGRAPHY.md engineering note
// (displayL 48 for Overview, displayS 40 for everything else; displayM dropped).
export const MonoText = {
  displayL: { fontFamily: SERIF, fontSize: 48, lineHeight: 52, letterSpacing: -0.48, ...tab },
  displayS: { fontFamily: SERIF, fontSize: 40, lineHeight: 44, letterSpacing: -0.4, ...tab },
  titleL: { fontFamily: SERIF, fontSize: 32, lineHeight: 36 },
  figureXL: { fontFamily: UI.medium, fontSize: 44, lineHeight: 52, letterSpacing: -0.44, ...tab },
  figureL: { fontFamily: UI.medium, fontSize: 32, lineHeight: 40, ...tab },
  figureM: { fontFamily: UI.medium, fontSize: 22, lineHeight: 28, ...tab },
  figureS: { fontFamily: UI.medium, fontSize: 17, lineHeight: 24, ...tab },
  figureRow: { fontFamily: UI.medium, fontSize: 14, lineHeight: 20, ...tab },
  titleM: { fontFamily: UI.semi, fontSize: 17, lineHeight: 24 },
  h2: { fontFamily: UI.semi, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: UI.regular, fontSize: 15, lineHeight: 22, ...tab },
  bodyStrong: { fontFamily: UI.semi, fontSize: 15, lineHeight: 22 },
  bodyS: { fontFamily: UI.regular, fontSize: 13, lineHeight: 18, ...tab },
  caption: { fontFamily: UI.regular, fontSize: 12, lineHeight: 16, ...tab },
  label: { fontFamily: UI.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.88 },
  mono: { fontFamily: MONO, fontSize: 13, lineHeight: 18 },
} as const;
