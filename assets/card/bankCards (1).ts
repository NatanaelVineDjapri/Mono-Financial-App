// Card look per bank. Colours are the bank's brand colour (taken from the idn-finlogos artwork).
// `fg` is the text/logo colour on the card, chosen so every card keeps at least 4.5:1 contrast
// (checked at both ends of the gradient). `slug` is also the idn-finlogos logo slug.
// Card colours are decoration on the card surface only. Amounts on a card use `fg`, never green or red.
export type BankCardStyle = { name: string; bg: string; bgEnd: string; fg: '#FFFFFF' | '#0A0A0A'; pattern: string; wordmark?: boolean; logoVerified?: boolean };

export const BANK_CARDS: Record<string, BankCardStyle> = {
  'bca': { name: 'BCA', bg: '#0060AF', bgEnd: '#00457E', fg: '#FFFFFF', pattern: 'diagonal' },
  'mandiri': { name: 'Mandiri', bg: '#003A70', bgEnd: '#002A51', fg: '#FFFFFF', pattern: 'arcs' },
  'bni': { name: 'BNI', bg: '#005E6A', bgEnd: '#00444C', fg: '#FFFFFF', pattern: 'hex' },
  'bri': { name: 'BRI', bg: '#0857C3', bgEnd: '#063F8C', fg: '#FFFFFF', pattern: 'grid' },
  'jago': { name: 'Jago', bg: '#FDAF27', bgEnd: '#FDBA45', fg: '#0A0A0A', pattern: 'ring' },
  'gopay': { name: 'GoPay', bg: '#00AED6', bgEnd: '#24B9DC', fg: '#0A0A0A', pattern: 'dots' },
  'ovo': { name: 'OVO', bg: '#5827D4', bgEnd: '#3F1C99', fg: '#FFFFFF', pattern: 'contour' },
  'dana': { name: 'DANA', bg: '#008CEB', bgEnd: '#249CEE', fg: '#0A0A0A', pattern: 'waves' },
  'shopee-pay': { name: 'ShopeePay', bg: '#E8451E', bgEnd: '#EB5F3E', fg: '#0A0A0A', pattern: 'chevrons' },
  'bsi': { name: 'BSI', bg: '#00A39D', bgEnd: '#24B0AB', fg: '#0A0A0A', pattern: 'squares' },
  'cimb-niaga': { name: 'CIMB Niaga', bg: '#790008', bgEnd: '#570006', fg: '#FFFFFF', pattern: 'stripes' },
  'seabank': { name: 'SeaBank', bg: '#EA5F00', bgEnd: '#ED7524', fg: '#0A0A0A', pattern: 'arcs' },
  'btn': { name: 'BTN', bg: '#015BFD', bgEnd: '#0142B6', fg: '#FFFFFF', pattern: 'grid' },
  'jenius': { name: 'Jenius', bg: '#00A4DE', bgEnd: '#24B1E3', fg: '#0A0A0A', pattern: 'ring' },
  'linkaja': { name: 'LinkAja', bg: '#C82023', bgEnd: '#901719', fg: '#FFFFFF', pattern: 'dots' },
  'permata': { name: 'Permata', bg: '#0064FF', bgEnd: '#0048B8', fg: '#FFFFFF', pattern: 'diagonal' },
  'danamon': { name: 'Danamon', bg: '#EF9826', bgEnd: '#F1A644', fg: '#0A0A0A', pattern: 'waves' },
  'ocbc-nisp': { name: 'OCBC NISP', bg: '#D10A10', bgEnd: '#96070C', fg: '#FFFFFF', pattern: 'chevrons' },
  'maybank': { name: 'Maybank', bg: '#FFC600', bgEnd: '#FFCE24', fg: '#0A0A0A', pattern: 'stripes' },
  'mega': { name: 'Bank Mega', bg: '#FA9D1C', bgEnd: '#FBAB3C', fg: '#0A0A0A', pattern: 'dots' },
  'muamalat': { name: 'Muamalat', bg: '#420655', bgEnd: '#30043D', fg: '#FFFFFF', pattern: 'contour' },
  'paninbank': { name: 'Panin', bg: '#006CA9', bgEnd: '#004E7A', fg: '#FFFFFF', pattern: 'hex' },
  'allo': { name: 'Allo Bank', bg: '#FFBC25', bgEnd: '#FFC544', fg: '#0A0A0A', pattern: 'ring' },
  'aladin': { name: 'Aladin', bg: '#1B21CC', bgEnd: '#131893', fg: '#FFFFFF', pattern: 'grid' },
  'blu-bca': { name: 'blu by BCA', bg: '#33CDCF', bgEnd: '#50D4D6', fg: '#0A0A0A', pattern: 'arcs' },
  'superbank': { name: 'Superbank', bg: '#AFEE01', bgEnd: '#BAF025', fg: '#0A0A0A', pattern: 'squares' },
  'uob': { name: 'UOB', bg: '#002469', bgEnd: '#001A4C', fg: '#FFFFFF', pattern: 'diagonal' },
  'dbs': { name: 'DBS', bg: '#CA171E', bgEnd: '#911116', fg: '#FFFFFF', pattern: 'dots' },
  'hsbc': { name: 'HSBC', bg: '#DB0011', bgEnd: '#9E000C', fg: '#FFFFFF', pattern: 'hex' },
  'standard-chartered': { name: 'Standard Chartered', bg: '#0473EA', bgEnd: '#0353A8', fg: '#FFFFFF', pattern: 'waves' },
  'sinarmas': { name: 'Sinarmas', bg: '#ED1D24', bgEnd: '#F03D43', fg: '#0A0A0A', pattern: 'stripes' },
  'kb-bukopin': { name: 'KB Bukopin', bg: '#FCAF16', bgEnd: '#FCBA37', fg: '#0A0A0A', pattern: 'chevrons' },
  'keb-hana-bank': { name: 'KEB Hana', bg: '#008A8B', bgEnd: '#249A9B', fg: '#0A0A0A', pattern: 'grid' },
  'btpn': { name: 'BTPN', bg: '#F58220', bgEnd: '#F6943F', fg: '#0A0A0A', pattern: 'arcs' },
  'neobank': { name: 'Neo Commerce', bg: '#FFBE00', bgEnd: '#FFC724', fg: '#0A0A0A', pattern: 'ring' },
  'citibank': { name: 'Citibank', bg: '#1C4882', bgEnd: '#14345E', fg: '#FFFFFF', pattern: 'contour' },
  'astra-pay': { name: 'AstraPay', bg: '#0045E5', bgEnd: '#0032A5', fg: '#FFFFFF', pattern: 'diagonal' },
  'doku': { name: 'DOKU', bg: '#E2261D', bgEnd: '#A31B15', fg: '#FFFFFF', pattern: 'dots' },
  'dutamoney': { name: 'Dutamoney', bg: '#009CFE', bgEnd: '#24AAFE', fg: '#0A0A0A', pattern: 'waves' },
  'i-saku': { name: 'i.saku', bg: '#3151B0', bgEnd: '#233A7F', fg: '#FFFFFF', pattern: 'grid' },
  'jakone-pay': { name: 'JakOne Pay', bg: '#D9672C', bgEnd: '#DE7C4A', fg: '#0A0A0A', pattern: 'chevrons' },
  'kaspro': { name: 'Kaspro', bg: '#961A8B', bgEnd: '#6C1364', fg: '#FFFFFF', pattern: 'hex' },
  'netzme': { name: 'Netzme', bg: '#009AD9', bgEnd: '#24A8DE', fg: '#0A0A0A', pattern: 'ring' },
  'otto-pay': { name: 'OttoPay', bg: '#0074BA', bgEnd: '#005486', fg: '#FFFFFF', pattern: 'squares' },
  'paytren': { name: 'PayTren', bg: '#2E4251', bgEnd: '#21303A', fg: '#FFFFFF', pattern: 'stripes' },
  'pospay': { name: 'Pospay', bg: '#ED6A1D', bgEnd: '#F07F3D', fg: '#0A0A0A', pattern: 'arcs' },
  'speedcash': { name: 'Speedcash', bg: '#007CC2', bgEnd: '#00598C', fg: '#FFFFFF', pattern: 'contour' },
  'truemoney': { name: 'TrueMoney', bg: '#F58220', bgEnd: '#F6943F', fg: '#0A0A0A', pattern: 'diagonal' },
  'uangku': { name: 'Uangku', bg: '#3BB8EA', bgEnd: '#56C2ED', fg: '#0A0A0A', pattern: 'dots' },
  'yukk': { name: 'YUKK', bg: '#5C2D91', bgEnd: '#422068', fg: '#FFFFFF', pattern: 'waves' },
  'stockbit': { name: 'Stockbit', bg: '#00AB6B', bgEnd: '#24B780', fg: '#0A0A0A', pattern: 'grid', wordmark: true, logoVerified: false },
};

// Stockbit: idn-finlogos has no securities-app logos, so the card shows the text wordmark "stockbit".
// Its bg colour is a PLACEHOLDER (not verified against Stockbit's brand guide): replace it with the real hex.

// Neutral graphite cards (no brand colour). Background: assets/bank-cards/<key>@3x.png, glyph: glyphs/<key>.svg
//  cash    = Cash biasa (guilloche rosette + dashed frame, banknote glyph)
//  default = account with no bank chosen (radial rings + EMV chip baked in; glyph optional)
//  valas   = Valas account (round flags USD, EUR, SGD, JPY, GBP, AUD baked in + globe glyph)
export const NEUTRAL_CARDS = {
  cash: { bg: '#2B2B2B', bgEnd: '#171717', fg: '#FFFFFF' },
  default: { bg: '#303030', bgEnd: '#1A1A1A', fg: '#FFFFFF' },
  valas: { bg: '#2B2B2B', bgEnd: '#141414', fg: '#FFFFFF' },
} as const;
