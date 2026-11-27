// Authentic visual themes, palettes, and vector patterns for ALL Indonesian bank & e-wallet physical cards.
// Supports every bank, digital wallet, securities RDN, cash, and valas account defined in the app.
import React from 'react';
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import { BANK_CARDS, NEUTRAL_CARDS } from '@/components/BankCard/bankCards';

export interface PhysicalCardTheme {
  name: string;
  cardTier: string; // e.g. "PASPOR BCA", "MANDIRI DEBIT", "GOPAY PLUS"
  bg: string;
  bgEnd: string;
  fg: '#FFFFFF' | '#0A0A0A';
  chipVariant: 'gold' | 'silver';
  accentColor: string;
  // The artwork as a memoized component: drawn once per card and left alone when only the balance or the
  // Hide amounts switch changes. Use <theme.Background />, not renderBackground() (which re-creates the tree).
  Background: React.ComponentType;
  renderBackground: () => React.ReactElement;
}

// Bespoke handcrafted backgrounds for top flagship cards
function BcaBackground() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 226" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="bca-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#004D99" />
          <Stop offset="60%" stopColor="#003366" />
          <Stop offset="100%" stopColor="#002244" />
        </LinearGradient>
        <LinearGradient id="bca-wave" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#00A3E0" stopOpacity="0.45" />
          <Stop offset="50%" stopColor="#00D2FF" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#0077C8" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect width="358" height="226" fill="url(#bca-bg)" />
      <Path
        d="M-20 230 C 80 180, 160 120, 240 140 C 300 155, 330 200, 380 190 L 380 230 Z"
        fill="url(#bca-wave)"
      />
      <Path
        d="M-30 180 C 70 120, 170 80, 260 110 C 310 125, 340 160, 390 150 L 390 230 L -30 230 Z"
        fill="#00529B"
        fillOpacity="0.3"
      />
      <Path
        d="M50 0 C 120 40, 220 80, 360 40 L 360 0 Z"
        fill="#0099FF"
        fillOpacity="0.12"
      />
    </Svg>
  );
}

function MandiriBackground() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 226" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="mandiri-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#002952" />
          <Stop offset="55%" stopColor="#001C38" />
          <Stop offset="100%" stopColor="#001124" />
        </LinearGradient>
        <LinearGradient id="mandiri-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFC72C" />
          <Stop offset="40%" stopColor="#F3A100" />
          <Stop offset="100%" stopColor="#D98000" />
        </LinearGradient>
      </Defs>
      <Rect width="358" height="226" fill="url(#mandiri-bg)" />
      <Path
        d="M-20 140 C 90 90, 190 190, 300 130 C 330 115, 350 95, 380 80 L 380 115 C 340 135, 310 155, 280 165 C 180 215, 80 135, -20 175 Z"
        fill="url(#mandiri-gold)"
        fillOpacity="0.9"
      />
      <Path
        d="M-20 155 C 80 115, 170 195, 270 150 C 310 130, 340 100, 380 90 L 380 100 C 340 115, 310 140, 270 160 C 170 205, 80 125, -20 165 Z"
        fill="#FFEAA7"
        fillOpacity="0.45"
      />
      <Path
        d="M0 0 C 150 50, 260 140, 300 230 L 0 230 Z"
        fill="#003D7A"
        fillOpacity="0.25"
      />
    </Svg>
  );
}

function JagoBackground() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 226" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="jago-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FDAF27" />
          <Stop offset="60%" stopColor="#F59E0B" />
          <Stop offset="100%" stopColor="#D97706" />
        </LinearGradient>
      </Defs>
      <Rect width="358" height="226" fill="url(#jago-bg)" />
      <Circle cx="320" cy="40" r="110" fill="#FDBA45" fillOpacity="0.4" />
      <Circle cx="340" cy="60" r="70" fill="#FFE59E" fillOpacity="0.3" />
      <Path
        d="M-30 190 C 40 160, 110 200, 180 170 C 240 145, 280 195, 370 160 L 370 230 L -30 230 Z"
        fill="#B45309"
        fillOpacity="0.18"
      />
    </Svg>
  );
}

function BniBackground() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 226" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="bni-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#006978" />
          <Stop offset="65%" stopColor="#004D56" />
          <Stop offset="100%" stopColor="#00333A" />
        </LinearGradient>
        <LinearGradient id="bni-orange" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#F15A24" />
          <Stop offset="100%" stopColor="#E04006" />
        </LinearGradient>
      </Defs>
      <Rect width="358" height="226" fill="url(#bni-bg)" />
      <Path
        d="M160 230 C 210 170, 260 140, 370 135 L 370 230 Z"
        fill="url(#bni-orange)"
        fillOpacity="0.85"
      />
      <Path
        d="M190 230 C 230 190, 270 165, 370 160 L 370 230 Z"
        fill="#FF9E1B"
        fillOpacity="0.4"
      />
      <Path
        d="M-20 60 C 80 110, 180 80, 270 140 L 270 0 L -20 0 Z"
        fill="#00838F"
        fillOpacity="0.25"
      />
    </Svg>
  );
}

function BriBackground() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 226" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="bri-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#0052CC" />
          <Stop offset="60%" stopColor="#0747A6" />
          <Stop offset="100%" stopColor="#002D6B" />
        </LinearGradient>
      </Defs>
      <Rect width="358" height="226" fill="url(#bri-bg)" />
      <Path
        d="M-30 150 Q 80 90, 200 160 T 390 120 L 390 230 L -30 230 Z"
        fill="#2684FF"
        fillOpacity="0.3"
      />
      <Path
        d="M-30 175 Q 90 120, 210 185 T 390 145 L 390 230 L -30 230 Z"
        fill="#4C9AFF"
        fillOpacity="0.22"
      />
      <Circle cx="330" cy="30" r="60" fill="#0065FF" fillOpacity="0.2" />
    </Svg>
  );
}

function BsiBackground() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 226" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="bsi-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#005E54" />
          <Stop offset="65%" stopColor="#004D45" />
          <Stop offset="100%" stopColor="#003D37" />
        </LinearGradient>
        <LinearGradient id="bsi-gold" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FFD700" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#D4AF37" stopOpacity="0.1" />
        </LinearGradient>
      </Defs>
      <Rect width="358" height="226" fill="url(#bsi-bg)" />
      <G stroke="#E5A823" strokeWidth="0.8" strokeOpacity="0.28" fill="none">
        <Path d="M280 20 L300 0 L320 20 L340 0 L360 20 L340 40 L360 60 L340 80 L320 60 L300 80 L280 60 L300 40 Z" />
        <Path d="M250 50 L270 30 L290 50 L310 30 L330 50 L310 70 L330 90 L310 110 L290 90 L270 110 L250 90 L270 70 Z" />
      </G>
      <Path
        d="M-20 180 C 100 150, 200 200, 380 150"
        stroke="url(#bsi-gold)"
        strokeWidth="2"
        fill="none"
      />
      <Path
        d="M-20 200 C 100 170, 200 220, 380 170 L 380 230 L -20 230 Z"
        fill="#002E29"
        fillOpacity="0.4"
      />
    </Svg>
  );
}

// Krom: Krom's purple, with slanted bands that echo the lean of its italic "k", a soft glow top right and a dark swell
// along the bottom edge. Static vector, like every card here.
function KromBackground() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 226" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="krom-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#7A45E8" />
          <Stop offset="55%" stopColor="#6C38D9" />
          <Stop offset="100%" stopColor="#4A22A8" />
        </LinearGradient>
        <LinearGradient id="krom-band" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      <Rect width="358" height="226" fill="url(#krom-bg)" />
      <Circle cx="330" cy="30" r="120" fill="#9A6BFF" fillOpacity="0.22" />
      <Path d="M236 -10 L276 -10 L196 236 L156 236 Z" fill="url(#krom-band)" />
      <Path d="M296 -10 L316 -10 L236 236 L216 236 Z" fill="url(#krom-band)" />
      <Path
        d="M-20 190 C 70 160, 150 205, 240 178 C 300 160, 340 175, 380 160 L 380 236 L -20 236 Z"
        fill="#2E1470"
        fillOpacity="0.38"
      />
    </Svg>
  );
}

function CashBackground() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 226" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="cash-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#2E2E2E" />
          <Stop offset="60%" stopColor="#1E1E1E" />
          <Stop offset="100%" stopColor="#121212" />
        </LinearGradient>
      </Defs>
      <Rect width="358" height="226" fill="url(#cash-bg)" />
      <G stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.08" fill="none">
        <Circle cx="179" cy="113" r="40" />
        <Circle cx="179" cy="113" r="60" />
        <Circle cx="179" cy="113" r="80" strokeDasharray="4 2" />
        <Circle cx="179" cy="113" r="100" />
        <Circle cx="179" cy="113" r="120" strokeDasharray="3 3" />
      </G>
    </Svg>
  );
}

function ValasBackground() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 358 226" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="valas-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#1B2433" />
          <Stop offset="60%" stopColor="#121924" />
          <Stop offset="100%" stopColor="#0B0F17" />
        </LinearGradient>
      </Defs>
      <Rect width="358" height="226" fill="url(#valas-bg)" />
      <G stroke="#4A729D" strokeWidth="0.7" strokeOpacity="0.2" fill="none">
        <Circle cx="300" cy="113" r="110" />
        <Path d="M190 113 Q 245 40, 300 113 T 410 113" />
        <Path d="M190 113 Q 245 186, 300 113 T 410 113" />
        <Path d="M300 3 L300 223" strokeDasharray="4 3" />
      </G>
    </Svg>
  );
}

// Dynamic vector pattern renderer for all other banks and e-wallets
function makeCardPatternBackground(
  slug: string,
  bg: string,
  bgEnd: string,
  fg: string,
  pattern: string
) {
  return function GenericPatternBackground() {
    const gradId = `grad-${slug}`;
    const strokeColor = fg === '#0A0A0A' ? '#000000' : '#FFFFFF';
    const strokeOp = fg === '#0A0A0A' ? 0.08 : 0.14;

    return (
      <Svg width="100%" height="100%" viewBox="0 0 358 226" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={bg} />
            <Stop offset="100%" stopColor={bgEnd} />
          </LinearGradient>
        </Defs>
        <Rect width="358" height="226" fill={`url(#${gradId})`} />

        {/* Pattern geometry */}
        {pattern === 'arcs' && (
          <G fill={strokeColor} fillOpacity={strokeOp}>
            <Path d="M-30 160 C 80 110, 180 200, 390 130 L 390 230 L -30 230 Z" />
            <Path d="M-30 190 C 90 140, 190 220, 390 160 L 390 230 L -30 230 Z" opacity={0.6} />
          </G>
        )}

        {pattern === 'waves' && (
          <G fill={strokeColor} fillOpacity={strokeOp}>
            <Path d="M-20 140 Q 70 80, 180 150 T 380 120 L 380 230 L -20 230 Z" />
            <Path d="M-20 170 Q 80 120, 190 180 T 380 150 L 380 230 L -20 230 Z" opacity={0.5} />
          </G>
        )}

        {pattern === 'diagonal' && (
          <G fill={strokeColor} fillOpacity={strokeOp}>
            <Path d="M-50 230 L200 -20 L270 -20 L-50 230 Z" />
            <Path d="M50 230 L300 -20 L370 -20 L-20 230 Z" opacity={0.6} />
          </G>
        )}

        {pattern === 'hex' && (
          <G stroke={strokeColor} strokeWidth="0.8" strokeOpacity={strokeOp * 1.5} fill="none">
            <Path d="M300 20 L330 20 L345 45 L330 70 L300 70 L285 45 Z" />
            <Path d="M330 70 L360 70 L375 95 L360 120 L330 120 L315 95 Z" />
            <Path d="M270 70 L300 70 L315 95 L300 120 L270 120 L255 95 Z" />
            <Path d="M300 120 L330 120 L345 145 L330 170 L300 170 L285 145 Z" />
          </G>
        )}

        {pattern === 'grid' && (
          <G stroke={strokeColor} strokeWidth="0.6" strokeOpacity={strokeOp * 1.3} fill="none">
            <Path d="M220 0 L220 226 M260 0 L260 226 M300 0 L300 226 M340 0 L340 226" />
            <Path d="M180 50 L358 50 M180 90 L358 90 M180 130 L358 130 M180 170 L358 170" />
          </G>
        )}

        {pattern === 'ring' && (
          <G stroke={strokeColor} strokeWidth="0.8" strokeOpacity={strokeOp * 1.4} fill="none">
            <Circle cx="330" cy="50" r="40" />
            <Circle cx="330" cy="50" r="70" />
            <Circle cx="330" cy="50" r="100" />
            <Circle cx="330" cy="50" r="130" strokeDasharray="3 3" />
          </G>
        )}

        {pattern === 'dots' && (
          <G fill={strokeColor} fillOpacity={strokeOp * 1.5}>
            {[260, 285, 310, 335].map((cx) =>
              [40, 65, 90, 115, 140, 165].map((cy) => (
                <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" />
              ))
            )}
          </G>
        )}

        {pattern === 'contour' && (
          <G stroke={strokeColor} strokeWidth="0.8" strokeOpacity={strokeOp * 1.5} fill="none">
            <Path d="M-20 60 C 120 40, 220 180, 380 100" />
            <Path d="M-20 100 C 130 80, 230 200, 380 130" />
            <Path d="M-20 140 C 140 120, 240 220, 380 160" />
            <Path d="M-20 180 C 150 160, 250 240, 380 190" />
          </G>
        )}

        {pattern === 'chevrons' && (
          <G fill={strokeColor} fillOpacity={strokeOp}>
            <Path d="M290 0 L320 0 L358 113 L320 226 L290 226 L328 113 Z" />
            <Path d="M240 0 L270 0 L308 113 L270 226 L240 226 L278 113 Z" opacity={0.6} />
          </G>
        )}

        {pattern === 'squares' && (
          <G fill={strokeColor} fillOpacity={strokeOp}>
            <Rect x="250" y="20" width="40" height="40" rx="6" transform="rotate(15 270 40)" />
            <Rect x="290" y="70" width="50" height="50" rx="8" transform="rotate(25 315 95)" />
            <Rect x="240" y="120" width="45" height="45" rx="6" transform="rotate(10 262 142)" />
          </G>
        )}

        {pattern === 'stripes' && (
          <G fill={strokeColor} fillOpacity={strokeOp}>
            <Rect x="260" y="0" width="12" height="226" />
            <Rect x="285" y="0" width="6" height="226" />
            <Rect x="305" y="0" width="20" height="226" opacity={0.7} />
          </G>
        )}
      </Svg>
    );
  };
}

// Metadata map for the card tier name and the chip metal
const CARD_METADATA: Record<
  string,
  { tier: string; chip?: 'gold' | 'silver'; accent?: string }
> = {
  // Flagship Banks
  bca: { tier: 'PASPOR BCA', chip: 'gold', accent: '#00A3E0' },
  mandiri: { tier: 'MANDIRI DEBIT', chip: 'gold', accent: '#FFB81C' },
  bni: { tier: 'BNI TAPLUS', chip: 'gold', accent: '#F15A24' },
  bri: { tier: 'BRITAMA DEBIT', chip: 'gold', accent: '#2684FF' },
  jago: { tier: 'JAGO DEBIT', chip: 'silver', accent: '#B45309' },
  bsi: { tier: 'HASANAH DEBIT', chip: 'gold', accent: '#E5A823' },
  'cimb-niaga': { tier: 'OCTO DEBIT', chip: 'gold', accent: '#BD0820' },
  seabank: { tier: 'SEABANK DEBIT', chip: 'silver', accent: '#FF7B24' },
  btn: { tier: 'BTN DEBIT', chip: 'gold', accent: '#015BFD' },
  jenius: { tier: 'm-Card', chip: 'silver', accent: '#33B6E5' },
  permata: { tier: 'PERMATA DEBIT', chip: 'gold', accent: '#0064FF' },
  danamon: { tier: 'DANAMON DEBIT', chip: 'gold', accent: '#EF9826' },
  'ocbc-nisp': { tier: 'OCBC NYALA', chip: 'gold', accent: '#D10A10' },
  maybank: { tier: 'MAYBANK DEBIT', chip: 'gold', accent: '#FFC600' },
  mega: { tier: 'MEGA DEBIT', chip: 'gold', accent: '#FA9D1C' },
  muamalat: { tier: 'MUAMALAT DEBIT', chip: 'gold', accent: '#420655' },
  paninbank: { tier: 'PANIN DEBIT', chip: 'gold', accent: '#006CA9' },
  allo: { tier: 'ALLO PRIME', chip: 'silver', accent: '#FFBC25' },
  aladin: { tier: 'ALADIN DEBIT', chip: 'silver', accent: '#1B21CC' },
  'blu-bca': { tier: 'blu DEBIT', chip: 'silver', accent: '#33CDCF' },
  superbank: { tier: 'SUPER DEBIT', chip: 'silver', accent: '#AFEE01' },
  uob: { tier: 'UOB ONE', chip: 'gold', accent: '#002469' },
  dbs: { tier: 'digibank', chip: 'silver', accent: '#CA171E' },
  hsbc: { tier: 'HSBC PREMIER', chip: 'gold', accent: '#DB0011' },
  'standard-chartered': { tier: 'SCB DEBIT', chip: 'silver', accent: '#0473EA' },
  sinarmas: { tier: 'SINARMAS DEBIT', chip: 'silver', accent: '#ED1D24' },
  'kb-bukopin': { tier: 'BUKOPIN DEBIT', chip: 'silver', accent: '#FCAF16' },
  'keb-hana-bank': { tier: 'HANA DEBIT', chip: 'silver', accent: '#008A8B' },
  btpn: { tier: 'BTPN SINAYA', chip: 'silver', accent: '#F58220' },
  neobank: { tier: 'NEO DEBIT', chip: 'silver', accent: '#FFBE00' },
  citibank: { tier: 'CITI PRIORITY', chip: 'gold', accent: '#1C4882' },
  krom: { tier: 'KROM DEBIT', chip: 'silver', accent: '#6C38D9' },
  stockbit: { tier: 'STOCKBIT RDN', chip: 'silver', accent: '#00AB6B' },

  // E-Wallets & Fintech
  gopay: { tier: 'GOPAY PLUS', chip: 'silver', accent: '#00AED6' },
  ovo: { tier: 'OVO PREMIER', chip: 'silver', accent: '#5827D4' },
  dana: { tier: 'DANA PREMIUM', chip: 'silver', accent: '#008CEB' },
  'shopee-pay': { tier: 'SHOPEEPAY PLUS', chip: 'silver', accent: '#E8451E' },
  linkaja: { tier: 'LINKAJA FULL', chip: 'silver', accent: '#C82023' },
  'astra-pay': { tier: 'ASTRAPAY', chip: 'silver', accent: '#0045E5' },
  doku: { tier: 'DOKU WALLET', chip: 'silver', accent: '#E2261D' },
  dutamoney: { tier: 'DUTAMONEY', chip: 'silver', accent: '#009CFE' },
  'i-saku': { tier: 'i.saku MEMBER', chip: 'silver', accent: '#3151B0' },
  'jakone-pay': { tier: 'JAKONE PAY', chip: 'silver', accent: '#D9672C' },
  kaspro: { tier: 'KASPRO PREMIUM', chip: 'silver', accent: '#961A8B' },
  netzme: { tier: 'NETZME PRO', chip: 'silver', accent: '#009AD9' },
  'otto-pay': { tier: 'OTTOPAY', chip: 'silver', accent: '#0074BA' },
  paytren: { tier: 'PAYTREN PRO', chip: 'silver', accent: '#2E4251' },
  pospay: { tier: 'POSPAY EMONEY', chip: 'silver', accent: '#ED6A1D' },
  speedcash: { tier: 'SPEEDCASH', chip: 'silver', accent: '#007CC2' },
  truemoney: { tier: 'TRUEMONEY', chip: 'silver', accent: '#F58220' },
  uangku: { tier: 'UANGKU PAY', chip: 'silver', accent: '#3BB8EA' },
  yukk: { tier: 'YUKK WALLET', chip: 'silver', accent: '#5C2D91' },

  // Cash, Valas, and Default
  cash: { tier: 'CASH WALLET', chip: 'silver', accent: '#757575' },
  valas: { tier: 'MULTI-CURRENCY', chip: 'gold', accent: '#4A729D' },
  default: { tier: 'DEBIT CARD', chip: 'gold', accent: '#9E9E9E' },
};

// Build the complete theme dictionary for all 54 bank & account types
function buildPhysicalThemes(): Record<string, PhysicalCardTheme> {
  const result: Record<string, PhysicalCardTheme> = {};

  // 1. Process all BANK_CARDS entries
  for (const [slug, style] of Object.entries(BANK_CARDS)) {
    const meta = CARD_METADATA[slug] ?? {
      // abroad the app does not say what kind of card it is: the name alone
      tier: style.abroad ? style.name.toUpperCase() : `${style.name.toUpperCase()} DEBIT`,
      chip: 'gold' as const,
      accent: style.bg,
    };

    let renderBg: () => React.ReactElement;
    if (slug === 'bca') renderBg = BcaBackground;
    else if (slug === 'mandiri') renderBg = MandiriBackground;
    else if (slug === 'jago') renderBg = JagoBackground;
    else if (slug === 'bni') renderBg = BniBackground;
    else if (slug === 'bri') renderBg = BriBackground;
    else if (slug === 'bsi') renderBg = BsiBackground;
    else if (slug === 'krom') renderBg = KromBackground;
    else {
      renderBg = makeCardPatternBackground(
        slug,
        style.bg,
        style.bgEnd,
        style.fg,
        style.pattern
      );
    }

    result[slug] = {
      name: style.name,
      cardTier: meta.tier,
      bg: style.bg,
      bgEnd: style.bgEnd,
      fg: style.fg,
      chipVariant: meta.chip ?? 'gold',
      accentColor: meta.accent ?? style.bg,
      Background: React.memo(renderBg),
      renderBackground: renderBg,
    };
  }

  // 2. Process neutral/special accounts (cash, valas, default)
  for (const [slug, style] of Object.entries(NEUTRAL_CARDS)) {
    const meta = CARD_METADATA[slug] ?? {
      tier: 'DEBIT CARD',
      chip: 'gold' as const,
      accent: style.bg,
    };

    let renderBg: () => React.ReactElement;
    if (slug === 'cash') renderBg = CashBackground;
    else if (slug === 'valas') renderBg = ValasBackground;
    else renderBg = makeCardPatternBackground(slug, style.bg, style.bgEnd, style.fg, 'ring');

    const name = slug === 'cash' ? 'Cash' : slug === 'valas' ? 'Valas' : 'Primary Account';

    result[slug] = {
      name,
      cardTier: meta.tier,
      bg: style.bg,
      bgEnd: style.bgEnd,
      fg: style.fg,
      chipVariant: meta.chip ?? 'silver',
      accentColor: meta.accent ?? '#888888',
      Background: React.memo(renderBg),
      renderBackground: renderBg,
    };
  }

  return result;
}

export const PHYSICAL_CARD_THEMES: Record<string, PhysicalCardTheme> = buildPhysicalThemes();

export function resolvePhysicalCardTheme(
  icon: string | null | undefined,
  type?: string
): PhysicalCardTheme {
  if (icon && icon in PHYSICAL_CARD_THEMES) {
    return PHYSICAL_CARD_THEMES[icon];
  }
  if (type === 'cash') return PHYSICAL_CARD_THEMES.cash;
  if (type === 'forex') return PHYSICAL_CARD_THEMES.valas;
  return PHYSICAL_CARD_THEMES.default;
}
