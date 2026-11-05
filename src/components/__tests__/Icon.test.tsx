import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { Icon, type IconName } from '../Icon';

const NAMES: IconName[] = [
  'check',
  'alert',
  'alert-circle',
  'close',
  'plus',
  'minus',
  'chevron-down',
  'chevron-right',
  'eye',
  'eye-off',
];

// Decorative icons (the default, no `label`) are hidden from accessibility, and RTL's
// queries exclude hidden elements unless told otherwise — pass includeHiddenElements.
const HIDDEN = { includeHiddenElements: true };

describe('Icon', () => {
  test.each(NAMES)('renders "%s" without error', async name => {
    const result = await render(<Icon name={name} color="#F5F5F5" testID="icon" />);
    expect(result.getByTestId('icon', HIDDEN)).toBeTruthy();
  });

  test('size prop sets width and height, default is 20', async () => {
    const defaultSize = await render(<Icon name="check" color="#F5F5F5" testID="icon" />);
    expect(defaultSize.getByTestId('icon', HIDDEN).props.width).toBe(20);
    expect(defaultSize.getByTestId('icon', HIDDEN).props.height).toBe(20);

    const explicitSize = await render(<Icon name="check" color="#F5F5F5" size={26} testID="icon" />);
    expect(explicitSize.getByTestId('icon', HIDDEN).props.width).toBe(26);
    expect(explicitSize.getByTestId('icon', HIDDEN).props.height).toBe(26);
  });

  test('color prop is applied to the stroke', async () => {
    const result = await render(<Icon name="check" color="#4ADE80" testID="icon" />);
    const svg = result.getByTestId('icon', HIDDEN);
    // react-native-svg wraps children in an implicit <RNSVGGroup>.
    const path = svg.props.children.props.children;
    expect(path.props.stroke).toBe('#4ADE80');
  });

  // accessibilityElementsHidden (iOS) and importantForAccessibility (Android) are each
  // only ever set on their own platform (never both, never on web — react-native-web
  // doesn't understand either and would forward them as raw, warning-triggering DOM
  // attributes), so only the prop matching Platform.OS in this test run can be asserted.
  test('decorative by default: hidden from screen readers', async () => {
    const result = await render(<Icon name="check" color="#F5F5F5" testID="icon" />);
    const svg = result.getByTestId('icon', HIDDEN);
    if (Platform.OS === 'ios') expect(svg.props.accessibilityElementsHidden).toBe(true);
    if (Platform.OS === 'android') expect(svg.props.importantForAccessibility).toBe('no');
  });

  test('with a label: exposed to screen readers', async () => {
    const result = await render(<Icon name="alert" color="#FF6B6B" label="Peringatan" testID="icon" />);
    const svg = result.getByTestId('icon');
    expect(svg.props.accessible).toBe(true);
    expect(svg.props.accessibilityLabel).toBe('Peringatan');
    if (Platform.OS === 'ios') expect(svg.props.accessibilityElementsHidden).toBe(false);
    if (Platform.OS === 'android') expect(svg.props.importantForAccessibility).toBe('yes');
  });

  describe('on web', () => {
    const realOS = Platform.OS;
    beforeEach(() => Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true }));
    afterEach(() => Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true }));

    // The whole point of the web branch: react-native-svg's <Svg> forwards RN-only a11y
    // props straight to the DOM on web, so none of accessible/accessibilityElementsHidden/
    // importantForAccessibility may be set there — only accessibilityLabel, which does
    // translate correctly (to aria-label).
    test('decorative: no native-only a11y props leak through', async () => {
      const result = await render(<Icon name="check" color="#F5F5F5" testID="icon" />);
      const svg = result.getByTestId('icon', HIDDEN);
      expect(svg.props.accessible).toBeUndefined();
      expect(svg.props.accessibilityElementsHidden).toBeUndefined();
      expect(svg.props.importantForAccessibility).toBeUndefined();
      expect(svg.props.accessibilityLabel).toBeUndefined();
    });

    test('with a label: only accessibilityLabel is set', async () => {
      const result = await render(<Icon name="alert" color="#FF6B6B" label="Peringatan" testID="icon" />);
      const svg = result.getByTestId('icon', HIDDEN);
      expect(svg.props.accessibilityLabel).toBe('Peringatan');
      expect(svg.props.accessible).toBeUndefined();
      expect(svg.props.accessibilityElementsHidden).toBeUndefined();
      expect(svg.props.importantForAccessibility).toBeUndefined();
    });
  });
});
