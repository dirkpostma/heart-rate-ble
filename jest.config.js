/**
 * Plain ts-jest, not jest-expo: the store module is deliberately free
 * of react-native imports, so its timing rules run in a bare node
 * environment (decided in issue #11).
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  // ble-plx is a React Native library this environment cannot parse, and its
  // only runtime value is the `State` enum — which is why BleHeartRateMonitor
  // had no tests before #165. Swap it for a stub at test runtime only; `tsc`
  // still checks against the real package, and blePlxStub.test.ts guards the
  // enum against drift.
  moduleNameMapper: {
    '^@sfourdrinier/react-native-ble-plx$': '<rootDir>/src/ble/testing/blePlxStub.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', moduleResolution: 'node', jsx: 'react-jsx' } },
    ],
  },
};
