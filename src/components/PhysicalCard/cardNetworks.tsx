// The contactless (NFC) glyph on the card artwork, drawn with react-native-svg so it stays sharp at any density.
// (The card network badges were removed: the app does not know which network a card uses.)
import React from 'react';
import Svg, { G, Path } from 'react-native-svg';

function ContactlessGlyphImpl({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  // ISO/IEC 14443 Contactless RFID Waves )))
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.9}>
        <Path d="M7 6.5C8.8 8.1 10 10.4 10 13C10 15.6 8.8 17.9 7 19.5" />
        <Path d="M12 4C14.5 6.2 16 9.4 16 13C16 16.6 14.5 19.8 12 22" />
        <Path d="M17 1.5C20.2 4.3 22 8.4 22 13C22 17.6 20.2 21.7 17 24.5" />
      </G>
    </Svg>
  );
}

export const ContactlessGlyph = React.memo(ContactlessGlyphImpl);
