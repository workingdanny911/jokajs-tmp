/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFilesAfterEnv: ['./jest.setup.js'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    testRegex: '\\.test\\.ts$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
    testPathIgnorePatterns: ['node_modules', 'src'],
    globals: {
        'ts-jest': {
            diagnostics: {
                ignoreCodes: ['TS2322'],
            },
        },
    },
    detectOpenHandles: true,
    forceExit: true,
    moduleNameMapper: {
        '@joka/(.*)$': '<rootDir>/src/$1/index.ts',
    },
};
