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
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', moduleResolution: 'node', jsx: 'react-jsx' } },
    ],
  },
};
