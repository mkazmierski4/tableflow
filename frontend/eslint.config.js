const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'src/lib/api/schema.ts'],
  },
  {
    // Jest globals in tests and the setup file.
    files: ['**/*.test.{ts,tsx}', 'jest.setup.ts'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
]);
