import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BADGE_SIZE, RingChart, hitTestSegment, layoutArcs, type RingSegment } from '../RingChart';

const OCT_EXPENSE_SEGMENTS: RingSegment[] = [
  { id: 1, label: 'Food & drink', valueIdr: 1425000, color: '#C7CDD6' },
  { id: 4, label: 'Bills', valueIdr: 1150000, color: '#A3A3A3' },
  { id: 3, label: 'Shopping', valueIdr: 812000, color: '#737373' },
  { id: 2, label: 'Transport', valueIdr: 540000, color: '#525252' },
  { id: -1, label: 'Others', valueIdr: 330000, color: '#3A3A3A' }, // Leisure 210.000 + Health 120.000
];

describe('layoutArcs (pure geometry)', () => {
  test('with a Rp5.000.000 limit and October\'s Rp4.257.000 spend, each arc\'s sweep is its own share of the limit, not of the spend', () => {
    const { arcs, isOverLimit } = layoutArcs(OCT_EXPENSE_SEGMENTS, 5000000);
    expect(isOverLimit).toBe(false);
    // Food & drink: 1.425.000 / 5.000.000 * 360 = 102.6deg
    expect(arcs[0].sweepDeg).toBeCloseTo(102.6, 5);
    // The arcs never reach a full 360 together, since spend < limit.
    const totalSweep = arcs.reduce((sum, a) => sum + a.sweepDeg, 0);
    expect(totalSweep).toBeCloseTo((4257000 / 5000000) * 360, 5);
    expect(totalSweep).toBeLessThan(360);
  });

  test('without a limit, the full circle is always divided by each segment\'s own share of the total', () => {
    const { arcs, isOverLimit } = layoutArcs(OCT_EXPENSE_SEGMENTS, undefined);
    expect(isOverLimit).toBe(false);
    const totalSweep = arcs.reduce((sum, a) => sum + a.sweepDeg, 0);
    expect(totalSweep).toBeCloseTo(360, 5);
  });

  test('over the limit, the ring falls back to a full-360 share split and flags isOverLimit — it never exceeds the circle', () => {
    const { arcs, isOverLimit } = layoutArcs(OCT_EXPENSE_SEGMENTS, 2000000); // spend 4.257.000 > limit 2.000.000
    expect(isOverLimit).toBe(true);
    const totalSweep = arcs.reduce((sum, a) => sum + a.sweepDeg, 0);
    expect(totalSweep).toBeCloseTo(360, 5);
  });

  test('a zero limit degrades to the no-limit (share-of-total) behaviour, not a division by zero', () => {
    const { arcs } = layoutArcs(OCT_EXPENSE_SEGMENTS, 0);
    const totalSweep = arcs.reduce((sum, a) => sum + a.sweepDeg, 0);
    expect(totalSweep).toBeCloseTo(360, 5);
    expect(Number.isFinite(totalSweep)).toBe(true);
  });
});

describe('hitTestSegment (pure geometry)', () => {
  const { arcs } = layoutArcs(OCT_EXPENSE_SEGMENTS, undefined);
  const CENTER = 110;
  const RADIUS = (220 - 16) / 2;

  function pointAtClockDeg(clockDeg: number, radius = RADIUS) {
    const rad = ((clockDeg - 90) * Math.PI) / 180;
    return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
  }

  test('a tap inside the first segment\'s own wedge (near 12 o\'clock) hits it', () => {
    const p = pointAtClockDeg(5); // just past 12 o'clock, well within Food & drink's wedge
    expect(hitTestSegment(arcs, p.x, p.y)).toBe(1);
  });

  test('a tap at dead centre (inside the ring\'s hole) hits nothing', () => {
    expect(hitTestSegment(arcs, CENTER, CENTER)).toBeUndefined();
  });

  test('a tap far outside the ring hits nothing', () => {
    expect(hitTestSegment(arcs, 0, 0)).toBeUndefined();
  });
});

describe('RingChart (rendered)', () => {
  test('carries the given accessibility label', async () => {
    const result = await render(
      <RingChart segments={OCT_EXPENSE_SEGMENTS} centerLabel="Spent" centerValue="Rp4.257.000" accessibilityLabel="Expense breakdown" />,
    );
    expect(result.getByLabelText('Expense breakdown')).toBeTruthy();
  });

  test('shows the centre label, value and sub-line', async () => {
    const result = await render(
      <RingChart
        segments={OCT_EXPENSE_SEGMENTS}
        centerLabel="Spent"
        centerValue="Rp4.257.000"
        centerSub="of Rp5.000.000 limit"
        accessibilityLabel="Expense breakdown"
      />,
    );
    expect(result.getByText('Spent')).toBeTruthy();
    expect(result.getByText('Rp4.257.000')).toBeTruthy();
    expect(result.getByText('of Rp5.000.000 limit')).toBeTruthy();
  });

  test('tapping the ring calls onSegmentPress with the tapped segment\'s id', async () => {
    const onSegmentPress = jest.fn();
    const result = await render(
      <RingChart
        segments={OCT_EXPENSE_SEGMENTS}
        centerLabel="Spent"
        centerValue="Rp4.257.000"
        accessibilityLabel="Expense breakdown"
        onSegmentPress={onSegmentPress}
        testID="ring"
      />,
    );
    const ring = result.getByTestId('ring');
    const RADIUS = (220 - 16) / 2;
    const rad = ((5 - 90) * Math.PI) / 180; // 5 degrees clockwise past 12 o'clock
    const locationX = 110 + RADIUS * Math.cos(rad);
    const locationY = 110 + RADIUS * Math.sin(rad);
    fireEvent(ring, 'press', { nativeEvent: { locationX, locationY } });
    expect(onSegmentPress).toHaveBeenCalledWith(1);
  });
});

describe('RingChart with badges', () => {
  const withBadges = OCT_EXPENSE_SEGMENTS.map(segment => ({ ...segment, badge: <Text>{segment.label}</Text> }));

  test('an arc wide enough carries its badge; a narrow one goes without', async () => {
    const segments = [...withBadges.slice(0, 2), { id: 9, label: 'Tiny', valueIdr: 10000, color: '#474D56', badge: <Text>Tiny</Text> }];
    const result = await render(<RingChart segments={segments} centerLabel="Spent" centerValue="x" accessibilityLabel="a" testID="ring" />);
    expect(result.getByTestId('ring-badge-1')).toBeTruthy();
    expect(result.getByTestId('ring-badge-4')).toBeTruthy();
    expect(result.queryByTestId('ring-badge-9')).toBeNull();
  });

  test('the room made for the badges is taken off a tap, so it still lands on its segment', async () => {
    const onSegmentPress = jest.fn();
    const result = await render(
      <RingChart segments={withBadges} centerLabel="Spent" centerValue="x" accessibilityLabel="a" onSegmentPress={onSegmentPress} testID="ring" />,
    );
    const radius = (220 - 16) / 2;
    const rad = ((100 - 90) * Math.PI) / 180; // 100 degrees clockwise: inside Food & drink (0 to 120)
    fireEvent(result.getByTestId('ring'), 'press', {
      nativeEvent: { locationX: BADGE_SIZE / 2 + 110 + radius * Math.cos(rad), locationY: BADGE_SIZE / 2 + 110 + radius * Math.sin(rad) },
    });
    expect(onSegmentPress).toHaveBeenCalledWith(1);
  });
});
