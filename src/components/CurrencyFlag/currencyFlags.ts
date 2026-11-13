// Which flag to draw for each currency in CURRENCY_LIST (src/core/currencyList.ts).
//
// One flag per currency: the country whose money it is, not every country that accepts it.
// USD is the United States and CHF Switzerland even though both circulate further afield.
// A currency that belongs to a monetary union instead of a country has no national flag at
// all, so it is absent here on purpose and CurrencyFlag falls back to the code disc: XAF and
// XOF (the two CFA francs), XCD (East Caribbean), XPF (CFP) and XCG (the 2025 Caribbean
// guilder that replaced ANG).
//
// Artwork is HatScripts/circle-flags, shipped by react-native-svg-circle-country-flags and
// drawn with react-native-svg. The package root re-exports all ~400 flags through `export *`,
// which Metro cannot tree-shake, so every entry below imports its own compiled module: these
// 146 flags cost ~131 KB instead of ~500 KB. A currency added to CURRENCY_LIST with
// no line here fails CurrencyFlag.test.tsx instead of quietly rendering nothing.
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import Ae from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ae';
import Af from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Af';
import Al from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Al';
import Am from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Am';
import Ao from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ao';
import Ar from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ar';
import Au from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Au';
import Aw from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Aw';
import Az from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Az';
import Ba from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ba';
import Bb from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bb';
import Bd from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bd';
import Bg from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bg';
import Bh from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bh';
import Bi from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bi';
import Bm from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bm';
import Bn from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bn';
import Bo from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bo';
import Br from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Br';
import Bs from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bs';
import Bt from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bt';
import Bw from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bw';
import By from 'react-native-svg-circle-country-flags/lib/commonjs/flags/By';
import Bz from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Bz';
import Ca from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ca';
import Cd from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Cd';
import Ch from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ch';
import Cl from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Cl';
import Cn from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Cn';
import Co from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Co';
import Cr from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Cr';
import Cu from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Cu';
import Cv from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Cv';
import Cw from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Cw';
import Cz from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Cz';
import Dj from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Dj';
import Dk from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Dk';
import Do from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Do';
import Dz from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Dz';
import Eg from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Eg';
import Er from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Er';
import Et from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Et';
import Eu from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Eu';
import Fj from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Fj';
import Fk from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Fk';
import Gb from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Gb';
import Ge from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ge';
import Gh from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Gh';
import Gi from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Gi';
import Gm from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Gm';
import Gn from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Gn';
import Gt from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Gt';
import Gy from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Gy';
import Hk from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Hk';
import Hn from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Hn';
import Ht from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ht';
import Hu from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Hu';
import Il from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Il';
import In from 'react-native-svg-circle-country-flags/lib/commonjs/flags/In';
import Iq from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Iq';
import Is from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Is';
import Jm from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Jm';
import Jo from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Jo';
import Jp from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Jp';
import Ke from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ke';
import Kg from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Kg';
import Kh from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Kh';
import Km from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Km';
import Kr from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Kr';
import Kw from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Kw';
import Ky from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ky';
import Kz from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Kz';
import La from 'react-native-svg-circle-country-flags/lib/commonjs/flags/La';
import Lb from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Lb';
import Lk from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Lk';
import Lr from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Lr';
import Ls from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ls';
import Ly from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ly';
import Ma from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ma';
import Md from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Md';
import Mg from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mg';
import Mk from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mk';
import Mm from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mm';
import Mn from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mn';
import Mo from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mo';
import Mr from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mr';
import Mu from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mu';
import Mv from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mv';
import Mw from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mw';
import Mx from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mx';
import My from 'react-native-svg-circle-country-flags/lib/commonjs/flags/My';
import Mz from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Mz';
import Na from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Na';
import Ng from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ng';
import Ni from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ni';
import No from 'react-native-svg-circle-country-flags/lib/commonjs/flags/No';
import Np from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Np';
import Nz from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Nz';
import Om from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Om';
import Pa from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Pa';
import Pe from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Pe';
import Pg from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Pg';
import Ph from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ph';
import Pk from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Pk';
import Pl from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Pl';
import Py from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Py';
import Qa from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Qa';
import Ro from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ro';
import Rs from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Rs';
import Ru from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ru';
import Rw from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Rw';
import Sa from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sa';
import Sb from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sb';
import Sc from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sc';
import Sd from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sd';
import Se from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Se';
import Sg from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sg';
import Sh from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sh';
import Sl from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sl';
import So from 'react-native-svg-circle-country-flags/lib/commonjs/flags/So';
import Sr from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sr';
import Ss from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ss';
import St from 'react-native-svg-circle-country-flags/lib/commonjs/flags/St';
import Sy from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sy';
import Sz from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Sz';
import Th from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Th';
import Tj from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Tj';
import Tm from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Tm';
import Tn from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Tn';
import To from 'react-native-svg-circle-country-flags/lib/commonjs/flags/To';
import Tr from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Tr';
import Tt from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Tt';
import Tw from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Tw';
import Tz from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Tz';
import Ua from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ua';
import Ug from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ug';
import Us from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Us';
import Uy from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Uy';
import Uz from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Uz';
import Ve from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ve';
import Vn from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Vn';
import Vu from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Vu';
import Ws from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ws';
import Ye from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Ye';
import Za from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Za';
import Zm from 'react-native-svg-circle-country-flags/lib/commonjs/flags/Zm';

export type FlagComponent = ComponentType<SvgProps>;

// Missing means "no flag": the caller draws the currency code instead.
export const CURRENCY_FLAGS: Record<string, FlagComponent | undefined> = {
  AED: Ae,
  AFN: Af,
  ALL: Al,
  AMD: Am,
  ANG: Cw,
  AOA: Ao,
  ARS: Ar,
  AUD: Au,
  AWG: Aw,
  AZN: Az,
  BAM: Ba,
  BBD: Bb,
  BDT: Bd,
  BGN: Bg,
  BHD: Bh,
  BIF: Bi,
  BMD: Bm,
  BND: Bn,
  BOB: Bo,
  BRL: Br,
  BSD: Bs,
  BTN: Bt,
  BWP: Bw,
  BYN: By,
  BZD: Bz,
  CAD: Ca,
  CDF: Cd,
  CHF: Ch,
  CLP: Cl,
  CNY: Cn,
  COP: Co,
  CRC: Cr,
  CUP: Cu,
  CVE: Cv,
  CZK: Cz,
  DJF: Dj,
  DKK: Dk,
  DOP: Do,
  DZD: Dz,
  EGP: Eg,
  ERN: Er,
  ETB: Et,
  EUR: Eu,
  FJD: Fj,
  FKP: Fk,
  GBP: Gb,
  GEL: Ge,
  GHS: Gh,
  GIP: Gi,
  GMD: Gm,
  GNF: Gn,
  GTQ: Gt,
  GYD: Gy,
  HKD: Hk,
  HNL: Hn,
  HTG: Ht,
  HUF: Hu,
  ILS: Il,
  INR: In,
  IQD: Iq,
  ISK: Is,
  JMD: Jm,
  JOD: Jo,
  JPY: Jp,
  KES: Ke,
  KGS: Kg,
  KHR: Kh,
  KMF: Km,
  KRW: Kr,
  KWD: Kw,
  KYD: Ky,
  KZT: Kz,
  LAK: La,
  LBP: Lb,
  LKR: Lk,
  LRD: Lr,
  LSL: Ls,
  LYD: Ly,
  MAD: Ma,
  MDL: Md,
  MGA: Mg,
  MKD: Mk,
  MMK: Mm,
  MNT: Mn,
  MOP: Mo,
  MRU: Mr,
  MUR: Mu,
  MVR: Mv,
  MWK: Mw,
  MXN: Mx,
  MYR: My,
  MZN: Mz,
  NAD: Na,
  NGN: Ng,
  NIO: Ni,
  NOK: No,
  NPR: Np,
  NZD: Nz,
  OMR: Om,
  PAB: Pa,
  PEN: Pe,
  PGK: Pg,
  PHP: Ph,
  PKR: Pk,
  PLN: Pl,
  PYG: Py,
  QAR: Qa,
  RON: Ro,
  RSD: Rs,
  RUB: Ru,
  RWF: Rw,
  SAR: Sa,
  SBD: Sb,
  SCR: Sc,
  SDG: Sd,
  SEK: Se,
  SGD: Sg,
  SHP: Sh,
  SLE: Sl,
  SOS: So,
  SRD: Sr,
  SSP: Ss,
  STN: St,
  SYP: Sy,
  SZL: Sz,
  THB: Th,
  TJS: Tj,
  TMT: Tm,
  TND: Tn,
  TOP: To,
  TRY: Tr,
  TTD: Tt,
  TWD: Tw,
  TZS: Tz,
  UAH: Ua,
  UGX: Ug,
  USD: Us,
  UYU: Uy,
  UZS: Uz,
  VES: Ve,
  VND: Vn,
  VUV: Vu,
  WST: Ws,
  YER: Ye,
  ZAR: Za,
  ZMW: Zm,
};
