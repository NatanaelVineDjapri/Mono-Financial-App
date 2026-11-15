// EMV Microchip component replicating real metallic smart card chips (ISO/IEC 7816).
// Rendered purely with react-native-svg for authentic metallic finish & etched traces.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export interface EmvChipProps {
  variant?: 'gold' | 'silver';
  width?: number;
  height?: number;
  testID?: string;
}

function EmvChipImpl({
  variant = 'gold',
  width = 44,
  height = 34,
  testID = 'emv-chip',
}: EmvChipProps) {
  const isGold = variant === 'gold';

  // Metallic palette stops
  const baseGradId = `chip-grad-${variant}`;
  const strokeColor = isGold ? '#876211' : '#6A7280';
  const strokeHighlight = isGold ? '#FFE8A3' : '#FFFFFF';

  return (
    <View style={[styles.container, { width, height }]} testID={testID}>
      <Svg width={width} height={height} viewBox="0 0 44 34" fill="none">
        <Defs>
          {isGold ? (
            <LinearGradient id={baseGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#ECC86B" />
              <Stop offset="30%" stopColor="#DFB045" />
              <Stop offset="55%" stopColor="#F9E29B" />
              <Stop offset="80%" stopColor="#C99426" />
              <Stop offset="100%" stopColor="#B37D14" />
            </LinearGradient>
          ) : (
            <LinearGradient id={baseGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#E5E7EB" />
              <Stop offset="35%" stopColor="#D1D5DB" />
              <Stop offset="60%" stopColor="#F3F4F6" />
              <Stop offset="85%" stopColor="#9CA3AF" />
              <Stop offset="100%" stopColor="#6B7280" />
            </LinearGradient>
          )}
        </Defs>

        {/* Outer chip plate */}
        <Rect
          x="0.5"
          y="0.5"
          width="43"
          height="33"
          rx="5"
          fill={`url(#${baseGradId})`}
          stroke={strokeColor}
          strokeWidth="0.8"
        />

        {/* Outer bevel highlight */}
        <Rect
          x="1.5"
          y="1.5"
          width="41"
          height="31"
          rx="4"
          fill="none"
          stroke={strokeHighlight}
          strokeWidth="0.5"
          strokeOpacity="0.6"
        />

        {/* Etched contact pad patterns (standard ISO 7816 8-contact microchip layout) */}
        {/* Left top & bottom horizontal cutouts */}
        <Path d="M1 11H13" stroke={strokeColor} strokeWidth="0.9" />
        <Path d="M1 23H13" stroke={strokeColor} strokeWidth="0.9" />

        {/* Right top & bottom horizontal cutouts */}
        <Path d="M31 11H43" stroke={strokeColor} strokeWidth="0.9" />
        <Path d="M31 23H43" stroke={strokeColor} strokeWidth="0.9" />

        {/* Center contact pad loop */}
        <Rect
          x="14"
          y="7"
          width="16"
          height="20"
          rx="3.5"
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.9"
        />

        {/* Center horizontal divider connecting pads */}
        <Path d="M14 17H30" stroke={strokeColor} strokeWidth="0.9" />

        {/* Subtle center inner circle */}
        <Rect
          x="19"
          y="12"
          width="6"
          height="10"
          rx="2"
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.7"
          strokeOpacity="0.7"
        />
      </Svg>
    </View>
  );
}

export const EmvChip = React.memo(EmvChipImpl);

const styles = StyleSheet.create({
  container: {
    borderRadius: 6,
    overflow: 'hidden',
  },
});
