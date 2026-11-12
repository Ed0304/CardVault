/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/setupEnv.ts"],
  extensionsToTreatAsEsm: [".ts"],
  // Source imports use ".js" extensions (NodeNext); map them back to the .ts files.
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript" }, target: "es2022" },
        module: { type: "es6" },
      },
    ],
  },
};
