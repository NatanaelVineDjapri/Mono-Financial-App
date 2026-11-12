// Turns what the text recognizer returns into lines of text, one per printed row. Pure (no native
// module), so it is tested on its own.
//
// The recognizer groups text into blocks and lines of its own, and on a receipt it often puts the
// label ("TOTAL") and its value ("48.000") in different blocks. When every line has a position,
// lines that sit on the same row (their vertical centres overlap) are joined left to right, so
// the parser sees "TOTAL 48.000". Without positions the recognizer's own order is kept, and the
// parser's column pairing (parse.ts) deals with labels and values that came out as two runs.
export interface RecognizedLine {
  text: string;
  frame?: { top: number; left: number; width: number; height: number };
}

export interface RecognizedBlock {
  lines: RecognizedLine[];
}

export interface RecognizedText {
  blocks: RecognizedBlock[];
}

interface Row {
  centre: number;
  height: number;
  parts: { left: number; text: string }[];
}

export function rowsFromRecognized(result: RecognizedText): string[] {
  const lines = result.blocks.flatMap(b => b.lines).filter(l => l.text.trim().length > 0);
  if (lines.length === 0) return [];
  if (!lines.every(l => l.frame && l.frame.height > 0)) return lines.map(l => l.text.trim());

  const sorted = [...lines].sort((a, b) => (a.frame as NonNullable<RecognizedLine['frame']>).top - (b.frame as NonNullable<RecognizedLine['frame']>).top);
  const rows: Row[] = [];
  for (const line of sorted) {
    const frame = line.frame as NonNullable<RecognizedLine['frame']>;
    const centre = frame.top + frame.height / 2;
    const row = rows[rows.length - 1];
    // Same row: the centres are closer than half of the smaller of the two heights.
    if (row && Math.abs(centre - row.centre) < Math.min(row.height, frame.height) / 2) {
      row.parts.push({ left: frame.left, text: line.text.trim() });
      row.centre = (row.centre * (row.parts.length - 1) + centre) / row.parts.length;
      row.height = Math.min(row.height, frame.height);
    } else {
      rows.push({ centre, height: frame.height, parts: [{ left: frame.left, text: line.text.trim() }] });
    }
  }
  return rows.map(r => r.parts.sort((a, b) => a.left - b.left).map(p => p.text).join(' '));
}
