import { rowsFromRecognized, type RecognizedText } from '../rows';

const line = (text: string, left: number, top: number, height = 20) => ({ text, frame: { left, top, width: 100, height } });

describe('rowsFromRecognized', () => {
  test('a label and its value that came out as two blocks are joined into one row', () => {
    const result: RecognizedText = {
      blocks: [
        { lines: [line('TOTAL', 10, 100), line('TUNAI', 10, 130), line('KEMBALI', 10, 160)] },
        { lines: [line('48.000', 200, 101), line('50.000', 200, 131), line('2.000', 200, 161)] },
      ],
    };
    expect(rowsFromRecognized(result)).toEqual(['TOTAL 48.000', 'TUNAI 50.000', 'KEMBALI 2.000']);
  });

  test('rows come top to bottom whatever order the blocks arrive in, and each row left to right', () => {
    const result: RecognizedText = {
      blocks: [{ lines: [line('48.000', 200, 100), line('Toko Maju', 10, 20), line('TOTAL', 10, 101)] }],
    };
    expect(rowsFromRecognized(result)).toEqual(['Toko Maju', 'TOTAL 48.000']);
  });

  test('lines on different rows stay apart even when close', () => {
    const result: RecognizedText = { blocks: [{ lines: [line('A', 10, 100, 20), line('B', 10, 125, 20)] }] };
    expect(rowsFromRecognized(result)).toEqual(['A', 'B']);
  });

  test('without positions the recognizer\'s own order is kept', () => {
    const result: RecognizedText = { blocks: [{ lines: [{ text: 'TOTAL' }, { text: '48.000' }] }] };
    expect(rowsFromRecognized(result)).toEqual(['TOTAL', '48.000']);
  });

  test('empty text and empty results give nothing', () => {
    expect(rowsFromRecognized({ blocks: [] })).toEqual([]);
    expect(rowsFromRecognized({ blocks: [{ lines: [{ text: '   ' }] }] })).toEqual([]);
  });
});
