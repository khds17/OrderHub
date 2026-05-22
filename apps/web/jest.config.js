/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/src/**/*.spec.tsx',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleNameMapper: {
    // Resolve `import 'foo.js'` to `foo.ts` so the in-tree contracts source
    // can be consumed without a build step.
    '^(.+)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@orderhub/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },
};
