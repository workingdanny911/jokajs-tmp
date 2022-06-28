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
        joka$: '<rootDir>/src/index.ts',
        'joka/core$': '<rootDir>/src/core/index.ts',
        'joka/dependency-injection$':
            '<rootDir>/src/dependency-injection/index.ts',
        'joka/event-sourcing$': '<rootDir>/src/event-sourcing/index.ts',
        'joka/messaging$': '<rootDir>/src/messaging/index.ts',

        // single file modules
        'joka/config$': '<rootDir>/src/config.ts',
        'joka/test-helpers$': '<rootDir>/src/test-helpers.ts',
        'joka/utils$': '<rootDir>/src/utils.ts',
    },
};
