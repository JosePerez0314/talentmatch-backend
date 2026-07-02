/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",

  // babel-jest (see babel.config.cjs) transpiles both the .ts sources and the
  // legacy .js ESM files down to CommonJS for the test run. This decouples
  // Jest from the app's real "type": "module" runtime, so tests work with any
  // invocation (npm test, IDE test runners, CI) without --experimental-vm-modules.
  transform: {
    "^.+\\.(t|j)s$": "babel-jest",
  },

  // A few third-party deps (p-limit v7+ and its own dep yocto-queue) ship
  // ESM-only with no CJS build. Jest ignores node_modules by default, so
  // they must be explicitly allowed through the babel transform too.
  transformIgnorePatterns: ["/node_modules/(?!(p-limit|yocto-queue)/)"],

  // TS with moduleResolution "nodenext" forces relative imports to end in ".js"
  // even when the real file is ".ts". This resolves that at test time.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  setupFiles: ["<rootDir>/jest.setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.afterEnv.ts"],
  clearMocks: true,

  // All test files share one physical database (talentmatch_test) and every
  // file truncates it in afterEach/beforeAll/afterAll. Running files in
  // parallel would let one file's cleanup wipe another file's fixtures
  // mid-test, so they must run serially.
  maxWorkers: 1,
};
