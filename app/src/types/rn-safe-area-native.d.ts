// React Native ships this component without a declaration (`exports["./Libraries/*"].types` is null). It is RN's own
// Fabric SafeAreaView ("SafeAreaView" descriptor in CoreComponentsRegistry, Android view manager RCTSafeAreaView), whose
// native padding comes from onApplyWindowInsets - the probe behind the DEV-1 bottom-inset fallback (components/BottomInset).
declare module 'react-native/Libraries/Components/SafeAreaView/RCTSafeAreaViewNativeComponent' {
  import type { HostComponent, ViewProps } from 'react-native';
  const RCTSafeAreaViewNativeComponent: HostComponent<ViewProps>;
  export default RCTSafeAreaViewNativeComponent;
}
