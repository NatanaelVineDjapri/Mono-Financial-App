// Generates src/components/BankCard/cardAssets.ts from assets/bank-cards/ and from
// idn-finlogos. Metro needs a static `require(...)` for every image — it cannot resolve
// a path computed at runtime — so this script walks the png/ and glyphs/ folders once
// and writes out the literal map. Run `npm run gen-card-assets` after adding, removing
// or renaming a card asset, or after an idn-finlogos upgrade changes a brand's artwork;
// never hand-edit the generated file.
//
// Brand logos: idn-finlogos's React Native `Logo` component only forwards a `color`
// prop to react-native-svg's SvgXml, which recolours an SVG only where it already uses
// `fill="currentColor"`. Every brand mark here hardcodes literal hex fills instead (and
// some use gradients), so `color` is a no-op on them — confirmed by inspecting
// idn-finlogos's bundled icons-map.js. The fix: force every fill (including a
// gradient reference) to the card's own `fg` at generation time, then hand the result to
// `<Logo svg={...} />` (the component's documented pre-imported-string path) instead of
// `<Logo slug={...} />`. This still "uses the Logo component" as asked, it just supplies
// an already-correct single-colour string rather than relying on Logo's own recolouring,
// which does not apply here.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { BANK_CARDS } = require('../src/components/BankCard/bankCards.ts') as typeof import('../src/components/BankCard/bankCards');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PNG_DIR = join(ROOT, 'assets/bank-cards/png');
const GLYPH_DIR = join(ROOT, 'assets/bank-cards/glyphs');
// Per-slug override: an SVG rendered live instead of the PNG in CARD_ASSETS. Used when a
// PNG came out corrupt (valas@3x.png fails to parse — traced to its source SVG's
// xlink:href <use> references not surviving whatever rasterised the PNG) — rather than
// re-rasterising it myself (no SVG-to-PNG tool is available in this environment),
// react-native-svg (already a dependency, already rendering the brand logos) renders the
// SVG directly, so a slug here never touches CARD_ASSETS at all.
const SVG_BACKGROUND_DIR = join(ROOT, 'assets/bank-cards/svg-backgrounds');
const OUT_FILE = join(ROOT, 'src/components/BankCard/cardAssets.ts');
// Relative filesystem path, not a package-specifier require: idn-finlogos's "exports"
// field does not publish icons-map.js, but a build script may still read the file
// directly off disk — only an app's Metro-bundled `require('idn-finlogos/...')` is
// constrained to the published subpaths.
const ICONS_MAP_PATH = join(ROOT, 'node_modules/idn-finlogos/dist/icons-map.js');

const pngFiles = readdirSync(PNG_DIR)
  .filter(f => f.endsWith('@3x.png')) // a stray copy without the suffix is not a card picture
  .sort();
const glyphFiles = readdirSync(GLYPH_DIR)
  .filter(f => f.endsWith('.svg'))
  .sort();
const svgBackgroundFiles = readdirSync(SVG_BACKGROUND_DIR)
  .filter(f => f.endsWith('.svg'))
  .sort();

const svgBackgroundSlugs = new Set(svgBackgroundFiles.map(f => f.replace(/\.svg$/, '')));

const pngEntries = pngFiles
  .filter(file => !svgBackgroundSlugs.has(file.replace(/@3x\.png$/, ''))) // has a working SVG override instead
  .map(file => {
    const slug = file.replace(/@3x\.png$/, '');
    // Metro's asset density convention: require the UNDECORATED name and it discovers the
    // "@3x" sibling on disk itself — requiring the literal "@3x" filename fails to resolve.
    return `  '${slug}': require('../../../assets/bank-cards/png/${slug}.png'),`;
  });

const glyphEntries = glyphFiles.map(file => {
  const slug = file.replace(/\.svg$/, '');
  const svg = readFileSync(join(GLYPH_DIR, file), 'utf8').trim().replace(/`/g, '\\`');
  return `  '${slug}': \`${svg}\`,`;
});

const svgBackgroundEntries = svgBackgroundFiles.map(file => {
  const slug = file.replace(/\.svg$/, '');
  const svg = readFileSync(join(SVG_BACKGROUND_DIR, file), 'utf8').trim().replace(/`/g, '\\`');
  return `  '${slug}': \`${svg}\`,`;
});

function forceSingleFill(xml: string, fg: string): string {
  return xml.replace(/fill="(?!none")[^"]*"/g, `fill="${fg}"`);
}

// A brand's own artwork: assets/bank-logos/<slug>.svg when there is one (logos idn-finlogos does not carry), else the
// package's. Only these strings reach the app: importing the package itself would bundle all of its 500+ logos.
const LOCAL_LOGO_DIR = join(ROOT, 'assets/bank-logos');
const iconsMap: Record<string, string> = require(ICONS_MAP_PATH);
const artOf = (slug: string, art?: string): string | undefined => {
  const local = join(LOCAL_LOGO_DIR, `${slug}.svg`);
  return existsSync(local) ? readFileSync(local, 'utf8').trim() : iconsMap[art ?? slug];
};
const escape = (svg: string) => svg.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const missingLogos: string[] = [];
const artEntries: string[] = [];
const logoEntries: string[] = [];
for (const [slug, style] of Object.entries(BANK_CARDS)) {
  const raw = artOf(slug, style.art);
  if (!raw) {
    missingLogos.push(slug);
    continue;
  }
  artEntries.push(`  '${slug}': \`${escape(raw)}\`,`);
  // A plate brand is only ever drawn in its own colours.
  if (!style.plate) logoEntries.push(`  '${slug}': \`${escape(forceSingleFill(raw, style.fg))}\`,`);
}

if (missingLogos.length > 0) {
  console.error(`No artwork for: ${missingLogos.join(', ')} (add assets/bank-logos/<slug>.svg, or set \`art\` in bankCards.ts).`);
  process.exit(1);
}

const output = `// AUTO-GENERATED by tools/gen-card-assets.ts — do not hand-edit.
// Regenerate with \`npm run gen-card-assets\` after adding, removing or renaming a card asset.

// The card pictures are only used by the dev gallery's legacy BankCard. In a release build __DEV__ is false, Metro folds the
// condition away before it collects the requires, and the PNGs (about 15 MB) are not bundled into the app.
export const CARD_ASSETS: Record<string, number> = !__DEV__ ? {} : {
${pngEntries.join('\n')}
};

// Per-slug override: render this SVG live (react-native-svg) instead of looking the
// slug up in CARD_ASSETS. See this script's header comment for why (a broken PNG).
export const SVG_BACKGROUNDS: Record<string, string> = {
${svgBackgroundEntries.join('\n')}
};

export const NEUTRAL_GLYPHS: Record<string, string> = {
${glyphEntries.join('\n')}
};

// Brand logo SVGs, pre-recoloured to each card's own \`fg\` (see this script's header
// comment for why — idn-finlogos's own \`color\` prop does not work on these).
export const BRAND_LOGOS: Record<string, string> = {
${logoEntries.join('\n')}
};

// Every brand's logo in its own colours (account tiles, the bank picker, and the white plate on a card).
export const BRAND_ART: Record<string, string> = {
${artEntries.join('\n')}
};
`;

// keep the line endings the file already has, so a regeneration only shows what really changed
const eol = existsSync(OUT_FILE) && readFileSync(OUT_FILE, 'utf8').includes(String.fromCharCode(13)) ? String.fromCharCode(13, 10) : String.fromCharCode(10);
writeFileSync(OUT_FILE, output.split(String.fromCharCode(13)).join('').split(String.fromCharCode(10)).join(eol));
console.log(
  `Wrote ${pngEntries.length} card assets, ${glyphFiles.length} glyphs, ${svgBackgroundFiles.length} SVG background override(s) and ${logoEntries.length} card logos and ${artEntries.length} brand artworks to ${OUT_FILE}`,
);
