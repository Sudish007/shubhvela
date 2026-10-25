// Jest setup (jest.config.js setupFiles): mocks for the few native/navigation modules the screens touch. Everything
// else (components, repositories, engine, content) runs real code; the database is node:sqlite (helpers/nodeDb.ts).
// Tests reach the mocks through the mocked modules themselves (e.g. `useRouter()` returns the shared mockRouter).
/* eslint-disable @typescript-eslint/no-require-imports */

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
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

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
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

// expo-sqlite is only reached through app/src/db/open.ts and gazetteer.ts; tests never open the asset database.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => {
    throw new Error('expo-sqlite is not available under Jest; use test/helpers/nodeDb.ts');
  },
  importDatabaseFromAssetAsync: async () => {
    throw new Error('expo-sqlite is not available under Jest');
  },
}));
