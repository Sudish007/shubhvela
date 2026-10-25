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

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
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
