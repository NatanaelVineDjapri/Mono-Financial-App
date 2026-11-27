// The countries the bank picker offers and the banks and e-wallets under each. The brands themselves (name, colours,
// logo) are src/components/BankCard/bankCards.ts. Choosing a bank from another country changes only the icon and the
// card: the account is still a rupiah account (foreign money belongs in the Valas account).
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';
import Au from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Au';
import Cn from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Cn';
import Eu from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Eu';
import Gb from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Gb';
import Id from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Id';
import Jp from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Jp';
import Kr from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Kr';
import Sg from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sg';
import Th from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Th';
import Us from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Us';

import { BANK_CARDS } from '@/components/BankCard/bankCards';

export type BankCountryId = 'id' | 'us' | 'eu' | 'gb' | 'cn' | 'sg' | 'jp' | 'kr' | 'th' | 'au';

export interface BankCountry {
  id: BankCountryId;
  Flag: ComponentType<SvgProps>;
  slugs: readonly string[]; // banks and e-wallets together; brandsFor() splits them by the account type
}

export const BANK_COUNTRIES: readonly BankCountry[] = [
  { id: 'id', Flag: Id, slugs: Object.keys(BANK_CARDS).filter(slug => !BANK_CARDS[slug].abroad) },
  {
    id: 'us',
    Flag: Us,
    slugs: ['chase', 'bank-of-america', 'wells-fargo', 'citibank', 'capital-one', 'us-bank', 'american-express', 'discover', 'paypal', 'venmo', 'cash-app', 'zelle', 'robinhood', 'wise', 'payoneer', 'western-union'],
  },
  {
    id: 'eu',
    Flag: Eu,
    slugs: ['deutsche-bank', 'commerzbank', 'ing', 'n26', 'bunq', 'bnp-paribas', 'santander', 'unicredit', 'revolut', 'klarna', 'paypal', 'wise', 'skrill'],
  },
  { id: 'gb', Flag: Gb, slugs: ['hsbc', 'barclays', 'lloyds', 'natwest', 'standard-chartered', 'monzo', 'starling', 'revolut', 'paypal', 'wise'] },
  { id: 'cn', Flag: Cn, slugs: ['icbc', 'ccb', 'bank-of-china', 'bank-of-communications', 'alipay', 'wechat-pay'] },
  { id: 'sg', Flag: Sg, slugs: ['dbs', 'uob', 'standard-chartered', 'citibank', 'hsbc', 'maybank', 'grab-pay', 'paypal', 'wise'] },
  { id: 'jp', Flag: Jp, slugs: ['mufg', 'smbc', 'mizuho', 'rakuten', 'paypal'] },
  { id: 'kr', Flag: Kr, slugs: ['shinhan', 'keb-hana-bank'] },
  { id: 'th', Flag: Th, slugs: ['bangkok-bank', 'kasikornbank'] },
  { id: 'au', Flag: Au, slugs: ['commbank', 'westpac', 'anz', 'paypal'] },
];
