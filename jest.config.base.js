/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const path = require('path');

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFilesAfterEnv: [path.join(__dirname, './jest.setup.js')],
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
};
