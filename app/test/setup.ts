// Jest setup (jest.config.js setupFiles): mocks for the few native/navigation modules the screens touch. Everything
// else (components, repositories, engine, content) runs real code; the database is node:sqlite (helpers/nodeDb.ts).
// Tests reach the mocks through the mocked modules themselves (e.g. `useRouter()` returns the shared mockRouter).
/* eslint-disable @typescript-eslint/no-require-imports */

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => mockRouter,
    router: mockRouter,
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    Redirect: () => null,
    Link: ({ children }: { children?: unknown }) => children ?? null,
    Stack: Object.assign(() => null, { Screen: () => null }),
  };
});

// C04: the model downloader reads NetworkStateType.WIFI and subscribes to changes; the download machine itself is tested
// with injected deps, so the default mock only has to keep the module loadable (type WIFI, no change events).
jest.mock('expo-network', () => ({
  NetworkStateType: { NONE: 'NONE', UNKNOWN: 'UNKNOWN', CELLULAR: 'CELLULAR', WIFI: 'WIFI', BLUETOOTH: 'BLUETOOTH', ETHERNET: 'ETHERNET', WIMAX: 'WIMAX', VPN: 'VPN', OTHER: 'OTHER' },
  getNetworkStateAsync: jest.fn(async () => ({ type: 'WIFI', isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const mockDatePicker = { open: jest.fn(), dismiss: jest.fn() };
jest.mock('@react-native-community/datetimepicker', () => ({ DateTimePickerAndroid: mockDatePicker }));

// expo-location is only called when Settings -> Location is 'gps'; the default mock denies so tests use the profile place.
jest.mock('expo-location', () => ({
  Accuracy: { Low: 2 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: false, status: 'denied' })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => {
    throw new Error('no location under Jest');
  }),
}));
// expo-notifications: permission defaults to "not yet asked" and the request grants; scheduling is a counter so the
// planner/scheduler tests can assert what would have reached the OS without a native module (A12).
jest.mock('expo-notifications', () => {
  let nextId = 1;
  return {
    getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
    scheduleNotificationAsync: jest.fn(async () => `n${nextId++}`),
    setNotificationChannelAsync: jest.fn(async () => null),
    setNotificationHandler: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(async () => []),
    SchedulableTriggerInputTypes: { DATE: 'date' },
    AndroidImportance: { DEFAULT: 3 },
  };
});

// react-native-google-mobile-ads (B03): no native SDK under Jest. initialize() is a spy (the Pro "never initialised"
// invariant is asserted on it), consent is "not required", every hook reports no fill, the views are plain Views.
jest.mock('react-native-google-mobile-ads', () => {
  const React = require('react');
  const { View } = require('react-native');
  const initialize = jest.fn(async () => []);
  const mobileAds = () => ({ initialize, setRequestConfiguration: jest.fn(async () => {}) });
  const consentInfo = { status: 'NOT_REQUIRED', canRequestAds: true, isConsentFormAvailable: false, privacyOptionsRequirementStatus: 'NOT_REQUIRED' };
  const fullScreen = () => ({
    status: 'no-fill',
    error: { code: 'no-fill', message: 'no fill under Jest' },
    autoLoad: true,
    clicked: false,
    impression: false,
    revenue: null,
    responseInfo: null,
    reward: null,
    earnedReward: false,
    load: jest.fn(),
    show: jest.fn(),
    retry: jest.fn(),
    destroy: jest.fn(),
  });
  const passthrough = ({ children, ...rest }: { children?: unknown }) => React.createElement(View, rest, children);
  return {
    __esModule: true,
    default: mobileAds,
    MobileAds: mobileAds,
    AdsConsent: {
      gatherConsent: jest.fn(async () => consentInfo),
      requestInfoUpdate: jest.fn(async () => consentInfo),
      loadAndShowConsentFormIfRequired: jest.fn(async () => consentInfo),
      showForm: jest.fn(async () => consentInfo),
    },
    AdsConsentStatus: { UNKNOWN: 'UNKNOWN', REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED', OBTAINED: 'OBTAINED' },
    TestIds: { BANNER: 'ca-app-pub-3940256099942544/6300978111', NATIVE: 'ca-app-pub-3940256099942544/2247696110', INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712', REWARDED: 'ca-app-pub-3940256099942544/5224354917' },
    BannerAdSize: { BANNER: 'BANNER', ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER', LARGE_ANCHORED_ADAPTIVE_BANNER: 'LARGE_ANCHORED_ADAPTIVE_BANNER' },
    NativeAdChoicesPlacement: { TOP_LEFT: 0, TOP_RIGHT: 1, BOTTOM_RIGHT: 2, BOTTOM_LEFT: 3 },
    NativeAdEventType: { IMPRESSION: 'impression', CLICKED: 'clicked', OPENED: 'opened', CLOSED: 'closed', PAID: 'paid' },
    NativeAssetType: { HEADLINE: 'headline', BODY: 'body', CALL_TO_ACTION: 'callToAction', ICON: 'icon', IMAGE: 'image' },
    AdEventType: { LOADED: 'loaded', ERROR: 'error', OPENED: 'opened', CLOSED: 'closed' },
    RewardedAdEventType: { LOADED: 'rewarded_loaded', EARNED_REWARD: 'rewarded_earned_reward' },
    BannerAd: (props: Record<string, unknown>) => React.createElement(View, { testID: 'mock-banner-ad', ...props }),
    NativeAdView: passthrough,
    NativeAsset: ({ children }: { children?: unknown }) => children ?? null,
    NativeMediaView: () => null,
    useNativeAd: jest.fn(() => ({ status: 'no-fill', nativeAd: null, error: { code: 'no-fill' }, autoLoad: true, retry: jest.fn(), destroy: jest.fn() })),
    useInterstitialAd: jest.fn(fullScreen),
    useRewardedAd: jest.fn(fullScreen),
  };
});

// expo-iap (B03): Play Billing is unreachable under Jest. The billing module is unit-tested through its injectable
// gateway (setBillingGateway); this default mock keeps screens renderable (no products, no purchases).
jest.mock('expo-iap', () => ({
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => true),
  fetchProducts: jest.fn(async () => []),
  getAvailablePurchases: jest.fn(async () => []),
  requestPurchase: jest.fn(async () => {
    throw { code: 'item-unavailable', message: 'no Play under Jest' };
  }),
  finishTransaction: jest.fn(async () => {}),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  subscriptionBillingIssueListener: jest.fn(() => ({ remove: jest.fn() })),
  deepLinkToSubscriptions: jest.fn(async () => {}),
  ErrorCode: { UserCancelled: 'user-cancelled', ItemUnavailable: 'item-unavailable', NetworkError: 'network-error' },
}));

// expo-clipboard (B06): the share sheet's Copy button; a spy records what would reach the clipboard.
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ''),
}));
// expo-camera (B06): no camera under Jest. Permission is granted by default; CameraView is a View that exposes its
// onBarcodeScanned prop so a test can feed it a QR payload.
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const granted = { granted: true, status: 'granted', canAskAgain: true, expires: 'never' };
  return {
    CameraView: (props: Record<string, unknown>) => React.createElement(View, { testID: 'mock-camera-view', ...props }),
    useCameraPermissions: jest.fn(() => [granted, jest.fn(async () => granted), jest.fn(async () => granted)]),
  };
});
// B07 documents and share cards: react-native-webview renders as a View that keeps its `source` prop (tests read the
// HTML from it); expo-print / expo-sharing / react-native-view-shot / expo-asset are spies - the preview screen and the
// share sheet inject their own deps in tests, these defaults only keep the modules loadable.
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { WebView: (props: Record<string, unknown>) => React.createElement(View, { testID: 'mock-webview', ...props }) };
});
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: 'file:///cache/Print.pdf', numberOfPages: 3 })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async () => 'file:///cache/card.png'),
}));
jest.mock('expo-asset', () => ({
  Asset: { fromModule: jest.fn(() => ({ localUri: 'file:///assets/font.ttf', uri: 'file:///assets/font.ttf', downloadAsync: jest.fn(async () => {}) })) },
}));
// C01: expo-speech (F10) has no engine under Jest - the hook is tested through its injectable SpeechDeps; these defaults
// report no voices so a screen that forgets to inject sees the honest "no voice" notice rather than a crash.
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
  isSpeakingAsync: jest.fn(async () => false),
}));
// C01: expo-task-manager / expo-background-task (F9 `extend-widget-state`): defineTask records the executor so a test can
// run it; registration is a spy. Status reports Available so registerExtendWidgetStateTask reaches registerTaskAsync.
jest.mock('expo-task-manager', () => {
  const tasks = new Map<string, unknown>();
  return {
    __tasks: tasks,
    defineTask: jest.fn((name: string, executor: unknown) => {
      tasks.set(name, executor);
    }),
    isTaskRegisteredAsync: jest.fn(async () => false),
    isAvailableAsync: jest.fn(async () => true),
  };
});
jest.mock('expo-background-task', () => ({
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => {}),
  unregisterTaskAsync: jest.fn(async () => {}),
  triggerTaskWorkerForTestingAsync: jest.fn(async () => false),
}));
// expo-sqlite is only reached through app/src/db/open.ts and gazetteer.ts; tests never open the asset database.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => {
    throw new Error('expo-sqlite is not available under Jest; use test/helpers/nodeDb.ts');
  },
  importDatabaseFromAssetAsync: async () => {
    throw new Error('expo-sqlite is not available under Jest');
  },
}));
