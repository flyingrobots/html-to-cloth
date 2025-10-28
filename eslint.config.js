import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Disabled because our component patterns (factory exports and memoized wrappers)
      // trigger false positives in react-refresh/only-export-components.
      'react-refresh/only-export-components': 'off',
    },
  },
  // Test overrides
  {
    files: ['**/*.{test,spec}.ts', '**/*.{test,spec}.tsx', '**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.vitest,
      },
    },
    rules: {
      // Allow explicit any in tests only for convenience.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Setup files
  {
    files: ['vitest.setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
