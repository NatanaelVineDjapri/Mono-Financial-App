import { render } from '@testing-library/react-native';

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

  test('decorative by default: hidden from screen readers', async () => {
    const result = await render(<Icon name="check" color="#F5F5F5" testID="icon" />);
    const svg = result.getByTestId('icon', HIDDEN);
    expect(svg.props.accessibilityElementsHidden).toBe(true);
    expect(svg.props.importantForAccessibility).toBe('no');
  });

  test('with a label: exposed to screen readers', async () => {
    const result = await render(<Icon name="alert" color="#FF6B6B" label="Peringatan" testID="icon" />);
    const svg = result.getByTestId('icon');
    expect(svg.props.accessible).toBe(true);
    expect(svg.props.accessibilityLabel).toBe('Peringatan');
    expect(svg.props.accessibilityElementsHidden).toBe(false);
    expect(svg.props.importantForAccessibility).toBe('yes');
  });
});
