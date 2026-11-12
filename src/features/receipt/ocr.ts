// Reading a photo of a receipt, on the device. A thin wrapper around the ML Kit text recognizer
// (@react-native-ml-kit/text-recognition, the bundled Latin model: no network, no account).
// Needs a development build; it does not run in Expo Go.
//
// This only reads. What happens to the picture afterwards is scan.ts's job (cache.ts): it is kept
// for the review's thumbnail and deleted when the review ends, and it is never sent anywhere.
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { rowsFromRecognized } from './rows';

// The text of the receipt at `uri`, one string per printed row.
export async function readReceiptLines(uri: string): Promise<string[]> {
  const result = await TextRecognition.recognize(uri);
  return rowsFromRecognized(result);
}
