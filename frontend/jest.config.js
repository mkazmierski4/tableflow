const preset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // Moti ships ESM in its build; the preset only lets React Native and Expo packages through.
  transformIgnorePatterns: preset.transformIgnorePatterns.map((pattern) =>
    pattern.startsWith('/node_modules/(?!(') ? pattern.replace('(?!(', '(?!(moti|') : pattern,
  ),
  // Slow CI runners transform every module on a cold cache; the first test of a file pays for it.
  testTimeout: 15000,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/lib/api/schema.ts', '!src/app/**'],
};
