/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/test/**/*.test.[jt]s?(x)', '**/__tests__/**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/android/'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  // The first render in a file loads the engine (tz table, ephemeris) and the content corpus; allow for cold starts.
  testTimeout: 30000,
  moduleNameMapper: {
    // Binary assets required as Metro asset ids (the bundled gazetteer): a numeric stub under Jest.
    '\\.(sqlite|ttf)$': '<rootDir>/test/helpers/assetStub.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@shubhvela/.*)',
  ],
};
