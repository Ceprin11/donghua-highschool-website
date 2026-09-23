import globals from 'globals';
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import unused from 'eslint-plugin-unused-imports';

export default [
  { ignores: ['node_modules/**', 'vendor/**', 'apps/**', 'public/experiments/**', 'dist/**', '.npm-cache/**', 'public/models/**', '_project_review/**', 'data/**', '.data/**', 'backups/**', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['src/**/*.{js,jsx}', 'server/**/*.js', 'shared/**/*.js', 'scripts/**/*.mjs', 'tests/**/*.{js,mjs}', '*.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser, ...globals.node }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, 'react-hooks': hooks, 'unused-imports': unused },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      'no-unused-vars': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/no-unknown-property': ['error', { ignore: ['cmdk-input-wrapper', 'toast-close'] }],
      'react-hooks/rules-of-hooks': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],
    },
  },
];
