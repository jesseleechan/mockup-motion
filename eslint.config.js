import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['src/motion/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/motion must be pure TypeScript (no React).' },
            { name: 'react-dom', message: 'src/motion must be pure TypeScript (no React).' },
            { name: 'three', message: 'src/motion must be pure TypeScript (no Three.js).' },
          ],
          patterns: [
            {
              group: ['react/*', 'three/*', '*/engine/*', '*/ui/*'],
              message: 'src/motion must be pure TypeScript and not depend on engine, UI, or DOM.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/motion must not access window.' },
        { name: 'document', message: 'src/motion must not access document.' },
        { name: 'navigator', message: 'src/motion must not access navigator.' },
        { name: 'HTMLElement', message: 'src/motion must not access HTMLElement.' },
      ],
    },
  },
);
