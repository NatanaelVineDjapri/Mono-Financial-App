// ocr.ts only reads: one string per printed row, nothing kept, nothing deleted.
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { readReceiptLines } from '../ocr';

jest.mock('@react-native-ml-kit/text-recognition', () => ({ __esModule: true, default: { recognize: jest.fn() } }));

const recognize = TextRecognition.recognize as jest.Mock;

test('returns one string per printed row', async () => {
  recognize.mockResolvedValue({
    text: 'TOTAL 48.000',
    blocks: [{ lines: [{ text: 'TOKO MAJU', frame: { left: 10, top: 10, width: 100, height: 20 } }, { text: 'TOTAL 48.000', frame: { left: 10, top: 60, width: 100, height: 20 } }] }],
  });
  await expect(readReceiptLines('file:///cache/a.jpg')).resolves.toEqual(['TOKO MAJU', 'TOTAL 48.000']);
  expect(recognize).toHaveBeenCalledWith('file:///cache/a.jpg');
});

test('a recognizer that fails rejects (scan.ts decides what the person sees)', async () => {
  recognize.mockRejectedValue(new Error('not linked'));
  await expect(readReceiptLines('file:///cache/a.jpg')).rejects.toThrow('not linked');
});
