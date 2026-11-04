// A regression guard for the "components" Jest project's config itself (package.json's
// jest.projects), not a component. render() is async in this @testing-library/react-native
// version (React 19 dropped react-test-renderer; the "test-renderer" peer dependency
// and an awaited render replace it) and Animated.View needs the
// react-native-reanimated/jest/resolver wired into the project's "resolver" option — if
// either regresses, every real component test would fail for a confusing, unrelated
// reason, so this stays as its own check.
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

test('renders and queries a plain component', async () => {
  const result = await render(<Text>hello mono</Text>);
  expect(result.getByText('hello mono')).toBeTruthy();
});

test('a Reanimated-based component renders without crashing', async () => {
  function Probe() {
    const value = useSharedValue(0);
    const style = useAnimatedStyle(() => ({ opacity: value.value + 1 }));
    return (
      <Animated.View style={style}>
        <Text>reanimated ok</Text>
      </Animated.View>
    );
  }
  const result = await render(<Probe />);
  expect(result.getByText('reanimated ok')).toBeTruthy();
});
