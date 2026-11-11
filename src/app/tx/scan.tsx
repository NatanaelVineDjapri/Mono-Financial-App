// Scan a receipt (/tx/scan), the Scan choice of the + menu. Reading a receipt is a feature of
// its own (camera, text recognition, a review step) that is not specified or built yet, so
// this is a placeholder with the route in place.
import { ComingSoonScreen } from '@/components/ComingSoonScreen';
import { scanReceiptTitle, scanStubMessage } from '@/i18n/id';

export default function ScanReceiptScreen() {
  return <ComingSoonScreen title={scanReceiptTitle()} message={scanStubMessage()} />;
}
