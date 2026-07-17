import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Flat config, replacing .eslintrc.json. Next 16 dropped the `next lint`
 * subcommand, so linting runs through the ESLint CLI directly (see the `lint`
 * script). eslint-config-next 16 exports flat config arrays, so this needs no
 * FlatCompat shim.
 */
export default [
  {
    ignores: ['.next/**', 'coverage/**', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Both arrived with eslint-config-next 16 (React Compiler's hook rules)
      // and neither existed under the v15 config this project was written
      // against. At 'error' they fail the build on ~18 call sites that predate
      // them — every data-loading component, plus ThemeContext and Modal.
      // Warnings so they're visible and can be paid down deliberately;
      // rules-of-hooks stays an error, because that one catches real crashes.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // jest.config.js and friends are CommonJS by necessity.
    files: ['**/*.js', '**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]
