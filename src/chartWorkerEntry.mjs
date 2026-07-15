// Plain-JS worker entry. Node runs .mjs natively with no loader, so this file
// is always reachable regardless of tsx version, execArgv, or whether tsx has
// patched worker_threads. It then uses tsx's official programmatic API to load
// the TypeScript worker logic and its transitive .ts imports. This avoids the
// version-fragile paths (auto-patched worker_threads / --import execArgv) that
// resolved the entry but not its nested imports (ERR_MODULE_NOT_FOUND on
// ./chartCompute) on some Node/tsx combinations.
import { tsImport } from "tsx/esm/api"

await tsImport("./chartWorker.ts", import.meta.url)
