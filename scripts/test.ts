import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createInterface } from "node:readline";
import { basename } from "node:path";

// Test files that contain opt-in describe blocks hitting real external services
// (OpenAI / Cloudinary). When the selected target matches one of these, the
// runner asks whether to run those blocks; otherwise they are skipped so the
// suite never calls a paid API by accident. See `describeExternal` in the
// test files, which reads RUN_EXTERNAL_TESTS.
const FILES_WITH_EXTERNAL: readonly string[] = [
  "positions.test.ts",
  "vacancies.test.ts",
];

// Performance/load tests that ALWAYS need real external services and persist
// their data (no per-test truncation). Selecting one auto-enables external
// credentials and KEEP_TEST_DATA — no prompt, since running it without the real
// API is pointless.
const PERF_FILES: readonly string[] = ["upload.test.ts"];

// Our own flags, stripped before forwarding the rest to Jest.
const FORCE_ON = new Set(["--external", "--with-external"]);
const FORCE_OFF = new Set(["--no-external", "--skip-external"]);

const rawArgs: string[] = process.argv.slice(2);
const forceOn: boolean = rawArgs.some((a) => FORCE_ON.has(a));
const forceOff: boolean = rawArgs.some((a) => FORCE_OFF.has(a));

// Jest matches its positional argument as a regex against the FULL absolute
// test path. On Windows that path starts with `C:\Users\...`, so a bare token
// like `users` would collide with the `Users` segment and match every file.
// A bare name is therefore anchored to the file name (`<name>...test.ts$`),
// while anything containing a path separator, dot or flag is passed through
// untouched (full paths and Jest flags keep working).
const isBareName = (arg: string): boolean => /^[A-Za-z0-9_-]+$/.test(arg);
const toJestArg = (arg: string): string =>
  isBareName(arg) ? `${arg}[^\\\\/]*\\.test\\.ts$` : arg;

const jestArgs: string[] = rawArgs
  .filter((a) => !FORCE_ON.has(a) && !FORCE_OFF.has(a))
  .map(toJestArg);

// The shared talentmatch_test DB is truncated by every test file's
// beforeAll/afterEach — running the whole suite by accident is wasteful and
// easy to do by muscle memory (`npm test`). Force an explicit target instead.
//
// The target is forwarded verbatim to Jest, whose positional argument is a
// regex matched against test file paths. So a bare name is enough:
//   npm test admin          -> runs src/tests/routes/admin.test.ts
//   npm test positions      -> runs src/tests/routes/positions.test.ts
// A full path or extra Jest flags (e.g. -t "returns 201") still work as-is.
if (jestArgs.length === 0) {
  console.error(
    "npm test requiere un target — ej: npm test positions  (o la ruta completa: npm test src/tests/routes/positions.test.ts)",
  );
  process.exit(1);
}

// Asks Jest which test files a set of args resolves to. `jest --listTests`
// exits 0 with empty stdout when nothing matches, so [] here means "no match"
// rather than a crash. Used both to guard against a mistyped target and to
// decide whether an external-service file is in the selection.
const listTests = (args: string[]): string[] => {
  const listed: SpawnSyncReturns<string> = spawnSync(
    "npx",
    ["jest", "--listTests", ...args],
    { encoding: "utf8", shell: true },
  );

  if (listed.status !== 0 || !listed.stdout) return [];

  return listed.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const testNameOf = (file: string): string =>
  basename(file).replace(/\.test\.ts$/, "");

// Resolve the selection once and reuse it. A mistyped shortcut (e.g.
// `vacacancies`) matches no file — surface the available names instead of
// letting Jest print its raw "No tests found" dump.
const selectedFiles = listTests(jestArgs);

if (selectedFiles.length === 0) {
  const target = rawArgs
    .filter((a) => !FORCE_ON.has(a) && !FORCE_OFF.has(a))
    .join(" ");
  const available = listTests([]).map(testNameOf).sort();

  console.error(
    `No hay ningún test que coincida con "${target}".` +
      (available.length > 0
        ? `\nTests disponibles: ${available.join(", ")}\nEj: npm test ${available[0]}`
        : ""),
  );
  process.exit(1);
}

const matchedExternalFiles = (): string[] =>
  selectedFiles.filter((file) => FILES_WITH_EXTERNAL.includes(basename(file)));

// A perf file in the selection forces real external services + data persistence,
// bypassing the prompt entirely.
const selectionHasPerf = selectedFiles.some((file) =>
  PERF_FILES.includes(basename(file)),
);

const ask = (question: string): Promise<string> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const shouldRunExternal = async (): Promise<boolean> => {
  if (selectionHasPerf) return true; // perf tests always need the real API
  if (forceOn) return true;
  if (forceOff) return false;
  if (process.env.RUN_EXTERNAL_TESTS !== undefined) {
    return process.env.RUN_EXTERNAL_TESTS === "true";
  }

  const external = matchedExternalFiles();
  if (external.length === 0) return false; // nothing external selected — don't ask

  // A non-interactive shell (CI, piped input, this project's own tooling)
  // can't answer a prompt, so default to skipping the paid-API tests.
  if (!process.stdin.isTTY) {
    console.log(
      "[test] entrada no interactiva — se omiten los tests de servicios externos (usa --external para forzarlos).",
    );
    return false;
  }

  const names = external.map((f) => basename(f)).join(", ");
  const answer = await ask(
    `\nLos tests seleccionados incluyen llamadas a servicios externos (OpenAI/Cloudinary):\n  ${names}\n¿Ejecutarlos también? (Y/N): `,
  );
  return /^y(es)?$/i.test(answer.trim());
};

const runExternal = await shouldRunExternal();

if (selectionHasPerf) {
  console.log(
    "[test] perf test detectado — usando credenciales reales de OpenAI/Cloudinary y PERSISTIENDO los candidatos (KEEP_TEST_DATA).",
  );
}

const result: SpawnSyncReturns<Buffer> = spawnSync(
  "npx",
  ["jest", ...jestArgs],
  {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      RUN_EXTERNAL_TESTS: runExternal ? "true" : "false",
      KEEP_TEST_DATA: selectionHasPerf ? "true" : "false",
    },
  },
);

process.exit(result.status ?? 1);
