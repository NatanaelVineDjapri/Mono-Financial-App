// A brand's logo in its own colours, sized to its own shape inside the box it is given. Used on white: account tiles,
// the bank picker, and the plate a card puts under it.
import { SvgXml } from 'react-native-svg';

import { BRAND_ART } from './cardAssets';

// Width over height, read from the viewBox: a wordmark is wide, a symbol square.
export function logoRatio(slug: string): number {
  const box = /viewBox="([^"]+)"/.exec(BRAND_ART[slug] ?? '')?.[1].trim().split(/[\s,]+/).map(Number);
  return box && box[2] > 0 && box[3] > 0 ? box[2] / box[3] : 1;
}

export function BrandLogo({ slug, width, height, testID }: { slug: string; width: number; height: number; testID?: string }) {
  return <SvgXml xml={BRAND_ART[slug]} width={width} height={height} preserveAspectRatio="xMidYMid meet" testID={testID} />;
}
