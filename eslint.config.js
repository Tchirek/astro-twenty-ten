import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const runtimeGlobals = { ...globals.browser, ...globals.node };

export default [
  {
    ignores: ['.astro/**', 'dist/**', 'node_modules/**', 'services/**/dist/**'],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: runtimeGlobals,
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: {
      ...config.languageOptions,
      globals: runtimeGlobals,
    },
  })),
  ...astro.configs.recommended,
  {
    files: ['**/*.astro'],
    languageOptions: { globals: runtimeGlobals },
  },
  {
    files: ['**/*.{ts,astro}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, caughtErrorsIgnorePattern: '^_' }],
    },
  },
];
