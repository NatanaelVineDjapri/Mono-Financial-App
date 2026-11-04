# MONO bank cards v2

54 kartu 358x184 (PNG @3x = 1074x552, plus SVG): 51 brand (bank, e-wallet, Stockbit) + 3 netral (cash, default, valas).
- `bankCards.ts` : warna, fg, pola per slug. `slug` = slug logo idn-finlogos (kecuali `stockbit`).
- Semua kartu kontras teks >= 4.5:1 (cek di ujung gradient juga).
- Logo: pakai `Logo` dari idn-finlogos + react-native-svg, satu warna = fg. Stockbit: teks wordmark (tidak ada di idn-finlogos), warna PLACEHOLDER.
- Valas: bendera USD, EUR, SGD, JPY, GBP, AUD (flag-icons, MIT) sudah menyatu di background.
- Lisensi: artwork idn-finlogos CC BY-NC 4.0, merek milik pemiliknya. Untuk rilis komersial perlu izin.
