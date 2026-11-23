// Lets Android open MONO when an e-money card is held to the phone (the "NFC tag detected" behaviour of the system):
// ONE intent filter on the main activity, android.nfc.action.TECH_DISCOVERED, with ONE tech list, android.nfc.tech.IsoDep.
// E-money cards speak ISO-DEP, and so do debit and credit cards: Android cannot tell them apart before they are read, so MONO
// is also offered a bank card held to the phone. It does not read what it is offered: it opens the Scan kartu screen, which
// reads in reader mode and refuses anything that is not a declared e-money application (src/features/nfc/transceive.ts).
// Nothing about the tag in the system's intent is used, logged or stored.
//
// android/ is generated, so this is done by a plugin and survives every prebuild.
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const ACTION = 'android.nfc.action.TECH_DISCOVERED';
const FILTER_RESOURCE = 'nfc_tech_filter';

const TECH_FILTER_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
  <tech-list>
    <tech>android.nfc.tech.IsoDep</tech>
  </tech-list>
</resources>
`;

function withManifest(config) {
  return withAndroidManifest(config, mod => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    activity['intent-filter'] = activity['intent-filter'] ?? [];
    const hasFilter = activity['intent-filter'].some(f => (f.action ?? []).some(a => a.$['android:name'] === ACTION));
    if (!hasFilter) {
      activity['intent-filter'].push({
        action: [{ $: { 'android:name': ACTION } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      });
    }
    activity['meta-data'] = activity['meta-data'] ?? [];
    const hasMeta = activity['meta-data'].some(m => m.$['android:name'] === ACTION);
    if (!hasMeta) {
      activity['meta-data'].push({ $: { 'android:name': ACTION, 'android:resource': `@xml/${FILTER_RESOURCE}` } });
    }
    return mod;
  });
}

function withTechFilterFile(config) {
  return withDangerousMod(config, [
    'android',
    async mod => {
      const dir = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${FILTER_RESOURCE}.xml`), TECH_FILTER_XML);
      return mod;
    },
  ]);
}

module.exports = function withNfcLaunch(config) {
  return withTechFilterFile(withManifest(config));
};
