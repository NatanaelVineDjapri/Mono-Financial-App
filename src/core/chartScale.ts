// Axis maths for the Overview's two charts (Cash flow bars, Net worth history line):
// where the gridlines go and what their labels say. Presentation only: the values come from
// the views, this only picks a readable ceiling and step (integer arithmetic, no floats).

// Steps are a mantissa from this list times a power of ten, so labels stay round.
const MANTISSAS = [1, 2, 4, 5, 10] as const;
const MAX_INTERVALS = 3; // 0 plus up to three gridlines: 0, 4, 8 / 0, 10, 20, 30

export interface AxisScale {
  top: number; // the highest gridline, whole rupiah (>= max)
  step: number;
  ticks: number[]; // 0 .. top, ascending
}

// The smallest round step that covers `max` in at most three intervals. A non-positive max
// (nothing recorded yet) still gets a sane 0..1.000.000 axis rather than a flat one.
export function niceScale(max: number): AxisScale {
  const ceiling = max > 0 ? max : 1_000_000;
  let magnitude = 1;
  for (;;) {
    for (const mantissa of MANTISSAS) {
      const step = mantissa * magnitude;
      if (Math.ceil(ceiling / step) <= MAX_INTERVALS) {
        const intervals = Math.max(1, Math.ceil(ceiling / step));
        return { top: step * intervals, step, ticks: Array.from({ length: intervals + 1 }, (_, i) => i * step) };
      }
    }
    magnitude *= 10;
  }
}

// "8", "12", "0,5" — a value in Rp million with at most one decimal, comma decimal,
// rounded half away from zero (tenths of a million = 100.000 rupiah).
export function millions(value: number): string {
  const tenths = Math.floor((Math.abs(value) + 50_000) / 100_000);
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  const sign = value < 0 && tenths !== 0 ? '−' : '';
  return frac === 0 ? `${sign}${whole}` : `${sign}${whole},${frac}`;
}

// A table cell in Rp million with exactly one decimal: 0 -> "0,0", 6800000 -> "6,8",
// -1200000 -> "−1,2". Same rounding as millions() (half away from zero, 100.000 rupiah).
export function millionsFixed(value: number): string {
  const tenths = Math.floor((Math.abs(value) + 50_000) / 100_000);
  const whole = Math.floor(tenths / 10);
  const sign = value < 0 && tenths !== 0 ? '−' : '';
  return `${sign}${whole},${tenths % 10}`;
}

export interface AxisRange {
  low: number; // the lowest gridline, whole rupiah (<= min)
  high: number; // the highest gridline (>= max)
  step: number;
  ticks: number[]; // low .. high, ascending
}

// A y axis for a line that need not start at zero (an account balance over a month moves by a few
// percent, and an axis from 0 would show a flat line). The smallest round step that covers min..max in
// at most three intervals; low and high sit on multiples of that step. A flat line (min = max) still
// gets a band around it. Integer arithmetic only; `low` never goes below 0 for a non-negative min.
export function niceRange(min: number, max: number): AxisRange {
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (hi === lo) {
    // A flat line: open a band of about 10% of the value (at least Rp1.000) so the axis has height.
    const band = Math.max(1000, Math.round(Math.abs(hi) / 10));
    lo = lo >= 0 ? Math.max(0, lo - band) : lo - band;
    hi += band;
  }
  let magnitude = 1;
  for (;;) {
    for (const mantissa of MANTISSAS) {
      const step = mantissa * magnitude;
      const low = Math.floor(lo / step) * step;
      const high = Math.ceil(hi / step) * step;
      if (high > low && (high - low) / step <= MAX_INTERVALS) {
        const count = Math.round((high - low) / step);
        return { low, high, step, ticks: Array.from({ length: count + 1 }, (_, i) => low + i * step) };
      }
    }
    magnitude *= 10;
  }
}

// An axis label: millions once the axis reaches Rp1 million, plain thousands below it.
export function axisLabel(value: number, top: number): string {
  if (top >= 1_000_000) return millions(value);
  const k = Math.floor((Math.abs(value) + 500) / 1000);
  return `${value < 0 ? '−' : ''}${k}k`;
}

// A value as a short callout on the chart: "8,9 jt" (juta = million, how Indonesians say it).
export function millionsCallout(value: number): string {
  return `${millions(value)} jt`;
}

// Which of `count` x labels to draw so at most ~`max` show, always including the last one.
export function labelIndexes(count: number, max: number): number[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const stride = Math.ceil((count - 1) / (max - 1));
  const indexes: number[] = [];
  for (let i = count - 1; i >= 0; i -= stride) indexes.unshift(i);
  return indexes;
}
