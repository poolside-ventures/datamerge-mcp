import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDefaultEsmPreset } = require('ts-jest/dist/presets/create-jest-preset.js');

const tsJestPreset = createDefaultEsmPreset({
  tsconfig: 'tsconfig.test.json',
});

const config = {
  ...tsJestPreset,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  resolver: './jest.resolver.cjs',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};

export default config;
