import { fireEvent, render } from '@testing-library/react-native';

import { TabFab } from '../TabFab';
import {
  ARC_ANGLES_DEG,
  ARC_RADIUS,
  BUBBLE_MS,
  OPEN_WAIT_MS,
  STAGGER_MS,
  TabFabMenu,
  arcOffset,
  bubbleDelayMs,
  type TabFabMenuItem,
} from '../TabFabMenu';

function flat(node: { props: { style?: unknown } }): Record<string, unknown> {
  return Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
}

function items(handlers: { scan?: () => void; ai?: () => void; manual?: () => void } = {}): TabFabMenuItem[] {
  return [
    { key: 'scan', accessibilityLabel: 'Scan a receipt', icon: 'scan', onPress: handlers.scan ?? (() => {}) },
    { key: 'ai', accessibilityLabel: 'Add with AI chat', icon: 'chat', onPress: handlers.ai ?? (() => {}) },
    { key: 'manual', accessibilityLabel: 'Add manually', icon: 'pencil', onPress: handlers.manual ?? (() => {}) },
  ];
}

function renderMenu(props: Partial<React.ComponentProps<typeof TabFabMenu>> = {}) {
  return render(
    <TabFabMenu open items={items()} centerFromBottom={78} onClose={() => {}} closeLabel="Close menu" testID="menu" {...props} />,
  );
}

describe('TabFabMenu', () => {
  test('closed: nothing is drawn', async () => {
    const result = await renderMenu({ open: false });
    expect(result.queryByTestId('menu')).toBeNull();
    expect(result.queryByRole('button', { name: 'Scan a receipt' })).toBeNull();
  });

  test('open: three labelled buttons, in the order scan, AI chat, manual, and no visible text on them', async () => {
    const result = await renderMenu();
    expect(result.getByRole('button', { name: 'Scan a receipt' })).toBeTruthy();
    expect(result.getByRole('button', { name: 'Add with AI chat' })).toBeTruthy();
    expect(result.getByRole('button', { name: 'Add manually' })).toBeTruthy();
    // The icon is the choice: no "Scan" / "AI chat" / "Manual" captions anywhere.
    expect(result.queryByText('Scan', { includeHiddenElements: true })).toBeNull();
    expect(result.queryByText('AI chat', { includeHiddenElements: true })).toBeNull();
    expect(result.queryByText('Manual', { includeHiddenElements: true })).toBeNull();
  });

  test('each bubble is 56 (a touch target over 44), round, charcoal with a 1px border; gold is not used on them', async () => {
    const result = await renderMenu();
    for (const key of ['scan', 'ai', 'manual']) {
      const style = flat(result.getByTestId(`menu-${key}`));
      expect(style).toMatchObject({ width: 56, height: 56, borderRadius: 28, borderWidth: 1 });
      expect(style.backgroundColor).not.toBe('#E3C27A');
    }
  });

  test('a tap on a bubble runs its action', async () => {
    const scan = jest.fn();
    const ai = jest.fn();
    const manual = jest.fn();
    const result = await renderMenu({ items: items({ scan, ai, manual }) });
    await fireEvent.press(result.getByRole('button', { name: 'Add with AI chat' }));
    expect(ai).toHaveBeenCalledTimes(1);
    await fireEvent.press(result.getByRole('button', { name: 'Scan a receipt' }));
    await fireEvent.press(result.getByRole('button', { name: 'Add manually' }));
    expect(scan).toHaveBeenCalledTimes(1);
    expect(manual).toHaveBeenCalledTimes(1);
  });

  test('a tap on the scrim closes the menu', async () => {
    const onClose = jest.fn();
    const result = await renderMenu({ onClose });
    await fireEvent.press(result.getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('every bubble starts tucked behind the + : its slot is level with the + centre, the arc is the transform', async () => {
    const centerFromBottom = 100;
    const result = await renderMenu({ centerFromBottom });
    for (const key of ['scan', 'ai', 'manual']) {
      const slot = flat(result.getByTestId(`menu-${key}`).parent!);
      expect(slot.bottom).toBe(centerFromBottom - 28); // a 56 bubble centred on the + centre
      expect(slot).toMatchObject({ position: 'absolute', left: 0, right: 0 });
    }
  });

  test('the arc: equal distance from the + centre, left, top and right, side by side and clear of the +', () => {
    const [scan, ai, manual] = ARC_ANGLES_DEG.map(angle => arcOffset(angle));
    for (const c of [scan, ai, manual]) expect(Math.hypot(c.x, c.y)).toBeCloseTo(ARC_RADIUS, 5);
    expect(ai.x).toBeCloseTo(0, 5);
    expect(scan.x).toBeLessThan(0);
    expect(manual.x).toBeGreaterThan(0);
    expect(scan.x).toBeCloseTo(-manual.x, 5);
    expect(scan.y).toBeCloseTo(manual.y, 5);
    expect(ai.y).toBeGreaterThan(scan.y);
    expect(Math.hypot(scan.x - ai.x, scan.y - ai.y)).toBeGreaterThan(56); // neighbours never overlap
    expect(ARC_RADIUS).toBeGreaterThan(32 + 7 + 28); // the + (64) with its 7 ring, and the bubble's half
  });

  test('arcOffset: 90° is straight up, 180° straight left, 0° straight right', () => {
    expect(arcOffset(90, 100).x).toBeCloseTo(0, 5);
    expect(arcOffset(90, 100).y).toBeCloseTo(100, 5);
    expect(arcOffset(180, 100).x).toBeCloseTo(-100, 5);
    expect(arcOffset(0, 100).x).toBeCloseTo(100, 5);
    expect(ARC_ANGLES_DEG).toEqual([140, 90, 40]);
  });
});

describe('the bubbles come out one by one', () => {
  test('opening: left to right, each one a step after the last, all after the + has started to turn', () => {
    const delays = [0, 1, 2].map(i => bubbleDelayMs(i, 3, true));
    expect(delays).toEqual([OPEN_WAIT_MS, OPEN_WAIT_MS + STAGGER_MS, OPEN_WAIT_MS + 2 * STAGGER_MS]);
    expect(delays[0]).toBeGreaterThan(0);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays); // scan, then AI chat, then manual
  });

  test('closing: the other way, right to left, straight away', () => {
    const delays = [0, 1, 2].map(i => bubbleDelayMs(i, 3, false));
    expect(delays).toEqual([2 * STAGGER_MS, STAGGER_MS, 0]);
  });

  test('timing is short enough to feel immediate: the whole thing under half a second', () => {
    expect(OPEN_WAIT_MS + 2 * STAGGER_MS + BUBBLE_MS).toBeLessThan(500);
  });
});

describe('TabFab with the menu', () => {
  test('is a button that says it is expanded while the menu is open', async () => {
    const closed = await render(<TabFab label="Add transaction" onPress={() => {}} testID="fab" />);
    expect(closed.getByRole('button', { name: 'Add transaction' }).props.accessibilityState).toMatchObject({ expanded: false });
    const open = await render(<TabFab label="Add transaction" onPress={() => {}} open testID="fab2" />);
    expect(open.getByRole('button', { name: 'Add transaction' }).props.accessibilityState).toMatchObject({ expanded: true });
  });

  test('stays gold, the one gold control: opening the menu changes only its icon turn', async () => {
    const result = await render(<TabFab label="Add transaction" onPress={() => {}} open testID="fab" />);
    expect(flat(result.getByTestId('fab').parent!)).toMatchObject({ backgroundColor: '#E3C27A', width: 64, height: 64 });
  });
});
