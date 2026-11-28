// Screens are rendered in tests without the app's GestureHandlerRootView and without a UI runtime (the app has both, in
// app/_layout.tsx and on the phone): the two checks that need them are switched off here.
jest.mock('react-native-gesture-handler/lib/module/v3/detectors/useEnsureGestureHandlerRootView.js', () => ({ useEnsureGestureHandlerRootView: () => {} }));
jest.mock('react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings.js', () => ({ installUIRuntimeBindings: () => {} }));
