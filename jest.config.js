const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // jsdom makes jest resolve this package's `browser` export — an ESM bundle
    // it can't parse. AIService only ever runs server-side, so point jest at the
    // CJS node build that actually runs in production.
    '^@google/genai$': '<rootDir>/node_modules/@google/genai/dist/node/index.cjs',
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
}

// next/jest overwrites transformIgnorePatterns, so patch the resolved config:
// these deps ship ESM-only and must be transformed rather than ignored.
const ESM_PACKAGES = ['franc', 'trigram-utils', 'n-gram', 'collapse-white-space', 'officeparser']

module.exports = async () => {
  const config = await createJestConfig(customJestConfig)()
  // Inject our ESM packages into next/jest's existing node_modules allowlist
  // (its `(geist|...)` negative lookaheads) so they get transformed too.
  const allow = ESM_PACKAGES.join('|')
  config.transformIgnorePatterns = (config.transformIgnorePatterns || []).map((p) =>
    p.replace(/\(geist\|/g, `(${allow}|geist|`)
  )
  return config
}
