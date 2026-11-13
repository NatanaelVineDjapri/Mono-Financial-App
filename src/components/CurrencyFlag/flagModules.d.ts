// The flags are compiled to CommonJS by the package, with their type declarations in a second
// tree (`lib/typescript`) instead of next to the `.js`. Importing the package root would type
// them, but it also re-exports all ~400 flags through `export *`, which Metro cannot tree-shake
// (~500 KB instead of the ~131 KB currencyFlags.ts pulls in). So the deep import stays and the
// shape is declared here once.
declare module 'react-native-svg-circle-country-flags/lib/commonjs/flags/*' {
  import type { ComponentType } from 'react';
  import type { SvgProps } from 'react-native-svg';

  const Flag: ComponentType<SvgProps>;
  export default Flag;
}
