// Card look per bank. Colours are the bank's brand colour (taken from the idn-finlogos artwork).
// `fg` is the text/logo colour on the card, chosen so every card keeps at least 4.5:1 contrast
// (checked at both ends of the gradient). The key is what accounts.icon stores, so a key is never renamed.
// Card colours are decoration on the card surface only. Amounts on a card use `fg`, never green or red.
//
// Logos come from assets/bank-logos/<key>.svg when that file exists, otherwise from idn-finlogos under `art` (or the key).
// tools/gen-card-assets.ts copies only those into cardAssets.ts, so the app does not carry the whole logo package.
//   wallet  offered for an E-wallet account (the rest are offered for Bank and Savings)
//   abroad  not offered under Indonesia (see features/accounts/countries.ts)
//   plate   the logo keeps its own colours on a small white plate; without it the logo is drawn in `fg`
export type BankCardStyle = {
  name: string;
  bg: string;
  bgEnd: string;
  fg: '#FFFFFF' | '#0A0A0A';
  pattern: string;
  art?: string;
  wallet?: boolean;
  abroad?: boolean;
  plate?: boolean;
};

export const BANK_CARDS: Record<string, BankCardStyle> = {
  'bca': { name: 'BCA', bg: '#0060AF', bgEnd: '#00457E', fg: '#FFFFFF', pattern: 'diagonal' },
  'mandiri': { name: 'Mandiri', bg: '#003A70', bgEnd: '#002A51', fg: '#FFFFFF', pattern: 'arcs' },
  'bni': { name: 'BNI', bg: '#005E6A', bgEnd: '#00444C', fg: '#FFFFFF', pattern: 'hex' },
  'bri': { name: 'BRI', bg: '#0857C3', bgEnd: '#063F8C', fg: '#FFFFFF', pattern: 'grid' },
  'jago': { name: 'Jago', bg: '#FDAF27', bgEnd: '#FDBA45', fg: '#0A0A0A', pattern: 'ring' },
  'gopay': { name: 'GoPay', bg: '#00AED6', bgEnd: '#24B9DC', fg: '#0A0A0A', pattern: 'dots', wallet: true },
  'ovo': { name: 'OVO', bg: '#5827D4', bgEnd: '#3F1C99', fg: '#FFFFFF', pattern: 'contour', wallet: true },
  'dana': { name: 'DANA', bg: '#008CEB', bgEnd: '#249CEE', fg: '#0A0A0A', pattern: 'waves', wallet: true },
  'shopee-pay': { name: 'ShopeePay', bg: '#E8451E', bgEnd: '#EB5F3E', fg: '#0A0A0A', pattern: 'chevrons', wallet: true },
  'bsi': { name: 'BSI', bg: '#00A39D', bgEnd: '#24B0AB', fg: '#0A0A0A', pattern: 'squares' },
  'cimb-niaga': { name: 'CIMB Niaga', bg: '#790008', bgEnd: '#570006', fg: '#FFFFFF', pattern: 'stripes' },
  'seabank': { name: 'SeaBank', bg: '#EA5F00', bgEnd: '#ED7524', fg: '#0A0A0A', pattern: 'arcs' },
  'btn': { name: 'BTN', bg: '#015BFD', bgEnd: '#0142B6', fg: '#FFFFFF', pattern: 'grid' },
  'jenius': { name: 'Jenius', bg: '#00A4DE', bgEnd: '#24B1E3', fg: '#0A0A0A', pattern: 'ring' },
  'linkaja': { name: 'LinkAja', bg: '#C82023', bgEnd: '#901719', fg: '#FFFFFF', pattern: 'dots', wallet: true },
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
  'astra-pay': { name: 'AstraPay', bg: '#0045E5', bgEnd: '#0032A5', fg: '#FFFFFF', pattern: 'diagonal', wallet: true },
  'doku': { name: 'DOKU', bg: '#E2261D', bgEnd: '#A31B15', fg: '#FFFFFF', pattern: 'dots', wallet: true },
  'dutamoney': { name: 'Dutamoney', bg: '#009CFE', bgEnd: '#24AAFE', fg: '#0A0A0A', pattern: 'waves', wallet: true },
  'i-saku': { name: 'i.saku', bg: '#3151B0', bgEnd: '#233A7F', fg: '#FFFFFF', pattern: 'grid', wallet: true },
  'jakone-pay': { name: 'JakOne Pay', bg: '#D9672C', bgEnd: '#DE7C4A', fg: '#0A0A0A', pattern: 'chevrons', wallet: true },
  'kaspro': { name: 'Kaspro', bg: '#961A8B', bgEnd: '#6C1364', fg: '#FFFFFF', pattern: 'hex', wallet: true },
  'netzme': { name: 'Netzme', bg: '#009AD9', bgEnd: '#24A8DE', fg: '#0A0A0A', pattern: 'ring', wallet: true },
  'otto-pay': { name: 'OttoPay', bg: '#0074BA', bgEnd: '#005486', fg: '#FFFFFF', pattern: 'squares', wallet: true },
  'paytren': { name: 'PayTren', bg: '#2E4251', bgEnd: '#21303A', fg: '#FFFFFF', pattern: 'stripes', wallet: true },
  'pospay': { name: 'Pospay', bg: '#ED6A1D', bgEnd: '#F07F3D', fg: '#0A0A0A', pattern: 'arcs', wallet: true },
  'speedcash': { name: 'Speedcash', bg: '#007CC2', bgEnd: '#00598C', fg: '#FFFFFF', pattern: 'contour', wallet: true },
  'truemoney': { name: 'TrueMoney', bg: '#F58220', bgEnd: '#F6943F', fg: '#0A0A0A', pattern: 'diagonal', wallet: true },
  'uangku': { name: 'Uangku', bg: '#3BB8EA', bgEnd: '#56C2ED', fg: '#0A0A0A', pattern: 'dots', wallet: true },
  'yukk': { name: 'YUKK', bg: '#5C2D91', bgEnd: '#422068', fg: '#FFFFFF', pattern: 'waves', wallet: true },
  // Krom: the purple of krom.id's own mark. Stockbit: the green of the stripe in its app icon (assets/bank-logos/stockbit.svg,
  // redrawn from that icon: neither logo package carries it).
  'krom': { name: 'Krom', bg: '#6C38D9', bgEnd: '#4A22A8', fg: '#FFFFFF', pattern: 'diagonal', plate: true },
  'stockbit': { name: 'Stockbit', bg: '#00AB6B', bgEnd: '#24B780', fg: '#0A0A0A', pattern: 'grid', wallet: true, plate: true },
  // Banks and e-wallets outside Indonesia. An account that uses one is still a rupiah account: only the look changes.
  'chase': { name: 'Chase', bg: '#0F6FB8', bgEnd: '#0B5592', fg: '#FFFFFF', pattern: 'hex', abroad: true, plate: true },
  'bank-of-america': { name: 'Bank of America', bg: '#012169', bgEnd: '#001747', fg: '#FFFFFF', pattern: 'diagonal', abroad: true, plate: true },
  'wells-fargo': { name: 'Wells Fargo', bg: '#C41B24', bgEnd: '#93141B', fg: '#FFFFFF', pattern: 'stripes', abroad: true, plate: true },
  'capital-one': { name: 'Capital One', bg: '#004977', bgEnd: '#003354', fg: '#FFFFFF', pattern: 'arcs', abroad: true, plate: true },
  'us-bank': { name: 'U.S. Bank', bg: '#0C2074', bgEnd: '#081650', fg: '#FFFFFF', pattern: 'grid', abroad: true, plate: true },
  'american-express': { name: 'American Express', bg: '#0063B8', bgEnd: '#00478A', fg: '#FFFFFF', pattern: 'contour', abroad: true, plate: true },
  'discover': { name: 'Discover', bg: '#FF6000', bgEnd: '#FF7A2E', fg: '#0A0A0A', pattern: 'ring', abroad: true, plate: true },
  'paypal': { name: 'PayPal', bg: '#003087', bgEnd: '#002262', fg: '#FFFFFF', pattern: 'waves', wallet: true, abroad: true, plate: true },
  'venmo': { name: 'Venmo', bg: '#008CFF', bgEnd: '#249CFF', fg: '#0A0A0A', pattern: 'waves', wallet: true, abroad: true, plate: true },
  'cash-app': { name: 'Cash App', bg: '#00C244', bgEnd: '#24CB5E', fg: '#0A0A0A', pattern: 'dots', wallet: true, abroad: true, plate: true },
  'zelle': { name: 'Zelle', bg: '#6D1ED4', bgEnd: '#4E1598', fg: '#FFFFFF', pattern: 'diagonal', wallet: true, abroad: true, plate: true },
  'robinhood': { name: 'Robinhood', bg: '#1E2124', bgEnd: '#101214', fg: '#FFFFFF', pattern: 'grid', wallet: true, abroad: true, plate: true },
  'deutsche-bank': { name: 'Deutsche Bank', bg: '#0018A8', bgEnd: '#001178', fg: '#FFFFFF', pattern: 'squares', abroad: true, plate: true },
  'commerzbank': { name: 'Commerzbank', bg: '#FFCC33', bgEnd: '#FFD455', fg: '#0A0A0A', pattern: 'hex', abroad: true, plate: true },
  'ing': { name: 'ING', bg: '#FF6200', bgEnd: '#FF7D2E', fg: '#0A0A0A', pattern: 'arcs', art: 'ing-bank', abroad: true, plate: true },
  'n26': { name: 'N26', bg: '#48AC98', bgEnd: '#5BB7A4', fg: '#0A0A0A', pattern: 'grid', abroad: true, plate: true },
  'bunq': { name: 'bunq', bg: '#3394D7', bgEnd: '#4DA3DD', fg: '#0A0A0A', pattern: 'stripes', abroad: true, plate: true },
  'bnp-paribas': { name: 'BNP Paribas', bg: '#00754F', bgEnd: '#005439', fg: '#FFFFFF', pattern: 'contour', abroad: true, plate: true },
  'santander': { name: 'Santander', bg: '#CC0000', bgEnd: '#930000', fg: '#FFFFFF', pattern: 'waves', abroad: true, plate: true },
  'unicredit': { name: 'UniCredit', bg: '#A80005', bgEnd: '#790004', fg: '#FFFFFF', pattern: 'diagonal', abroad: true, plate: true },
  'revolut': { name: 'Revolut', bg: '#191C1F', bgEnd: '#0D0F11', fg: '#FFFFFF', pattern: 'ring', abroad: true, plate: true },
  'barclays': { name: 'Barclays', bg: '#00395D', bgEnd: '#002942', fg: '#FFFFFF', pattern: 'arcs', abroad: true, plate: true },
  'lloyds': { name: 'Lloyds', bg: '#006A4D', bgEnd: '#004C37', fg: '#FFFFFF', pattern: 'stripes', abroad: true, plate: true },
  'natwest': { name: 'NatWest', bg: '#42145F', bgEnd: '#2F0E44', fg: '#FFFFFF', pattern: 'hex', abroad: true, plate: true },
  'monzo': { name: 'Monzo', bg: '#14233C', bgEnd: '#0E1829', fg: '#FFFFFF', pattern: 'diagonal', abroad: true, plate: true },
  'starling': { name: 'Starling', bg: '#6935D3', bgEnd: '#4B2698', fg: '#FFFFFF', pattern: 'dots', abroad: true, plate: true },
  'klarna': { name: 'Klarna', bg: '#FFB3C7', bgEnd: '#FFC2D2', fg: '#0A0A0A', pattern: 'ring', wallet: true, abroad: true, plate: true },
  'wise': { name: 'Wise', bg: '#9FE870', bgEnd: '#AFEC86', fg: '#0A0A0A', pattern: 'waves', wallet: true, abroad: true, plate: true },
  'skrill': { name: 'Skrill', bg: '#862165', bgEnd: '#611849', fg: '#FFFFFF', pattern: 'chevrons', wallet: true, abroad: true, plate: true },
  'payoneer': { name: 'Payoneer', bg: '#22222C', bgEnd: '#141419', fg: '#FFFFFF', pattern: 'contour', wallet: true, abroad: true, plate: true },
  'western-union': { name: 'Western Union', bg: '#FFDD00', bgEnd: '#FFE22E', fg: '#0A0A0A', pattern: 'stripes', wallet: true, abroad: true, plate: true },
  'icbc': { name: 'ICBC', bg: '#B80010', bgEnd: '#85000B', fg: '#FFFFFF', pattern: 'ring', abroad: true, plate: true },
  'ccb': { name: 'China Construction Bank', bg: '#005C9F', bgEnd: '#004273', fg: '#FFFFFF', pattern: 'squares', art: 'ccb-indonesia', abroad: true, plate: true },
  'bank-of-china': { name: 'Bank of China', bg: '#A71E32', bgEnd: '#781624', fg: '#FFFFFF', pattern: 'dots', abroad: true, plate: true },
  'bank-of-communications': { name: 'Bank of Communications', bg: '#1D3C7A', bgEnd: '#142B58', fg: '#FFFFFF', pattern: 'grid', abroad: true, plate: true },
  'alipay': { name: 'Alipay', bg: '#0F5FD6', bgEnd: '#0A449A', fg: '#FFFFFF', pattern: 'waves', wallet: true, abroad: true, plate: true },
  'wechat-pay': { name: 'WeChat Pay', bg: '#07C160', bgEnd: '#29CA77', fg: '#0A0A0A', pattern: 'dots', wallet: true, abroad: true, plate: true },
  'grab-pay': { name: 'GrabPay', bg: '#00B14F', bgEnd: '#24BC68', fg: '#0A0A0A', pattern: 'chevrons', wallet: true, abroad: true, plate: true },
  'mufg': { name: 'MUFG', bg: '#B8000D', bgEnd: '#850009', fg: '#FFFFFF', pattern: 'arcs', abroad: true, plate: true },
  'smbc': { name: 'SMBC', bg: '#004831', bgEnd: '#003323', fg: '#FFFFFF', pattern: 'hex', abroad: true, plate: true },
  'mizuho': { name: 'Mizuho', bg: '#001E76', bgEnd: '#001555', fg: '#FFFFFF', pattern: 'contour', art: 'mizuho-bank', abroad: true, plate: true },
  'rakuten': { name: 'Rakuten Bank', bg: '#BF0000', bgEnd: '#890000', fg: '#FFFFFF', pattern: 'dots', abroad: true, plate: true },
  'shinhan': { name: 'Shinhan Bank', bg: '#0046B4', bgEnd: '#003281', fg: '#FFFFFF', pattern: 'ring', art: 'shinhan-bank', abroad: true, plate: true },
  'bangkok-bank': { name: 'Bangkok Bank', bg: '#1E4598', bgEnd: '#15316D', fg: '#FFFFFF', pattern: 'diagonal', abroad: true, plate: true },
  'kasikornbank': { name: 'KBank', bg: '#00693A', bgEnd: '#004B2A', fg: '#FFFFFF', pattern: 'waves', abroad: true, plate: true },
  'commbank': { name: 'CommBank', bg: '#FFCC00', bgEnd: '#FFD42E', fg: '#0A0A0A', pattern: 'squares', art: 'commonwealth', abroad: true, plate: true },
  'westpac': { name: 'Westpac', bg: '#B8001F', bgEnd: '#850016', fg: '#FFFFFF', pattern: 'chevrons', abroad: true, plate: true },
  'anz': { name: 'ANZ', bg: '#004165', bgEnd: '#002E48', fg: '#FFFFFF', pattern: 'arcs', abroad: true, plate: true },
};

// Neutral graphite cards (no brand colour). Background: assets/bank-cards/<key>@3x.png, glyph: glyphs/<key>.svg
//  cash    = Cash biasa (guilloche rosette + dashed frame, banknote glyph)
//  default = account with no bank chosen (radial rings + EMV chip baked in; glyph optional)
//  valas   = Valas account (round flags USD, EUR, SGD, JPY, GBP, AUD baked in + globe glyph)
export const NEUTRAL_CARDS = {
  cash: { bg: '#2B2B2B', bgEnd: '#171717', fg: '#FFFFFF' },
  default: { bg: '#303030', bgEnd: '#1A1A1A', fg: '#FFFFFF' },
  valas: { bg: '#2B2B2B', bgEnd: '#141414', fg: '#FFFFFF' },
} as const;
