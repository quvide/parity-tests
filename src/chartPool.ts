// A minimal fixed-size worker pool for chart analysis. Each worker is
// long-lived and pulls the next unclaimed file as soon as it finishes one, so
// an uneven per-chart cost (the sweep is dominated by a few heavy charts)
// stays balanced without a scheduler. `onResult` fires as each chart finishes,
// in completion order, so the caller can stream output live.
import { Worker } from "node:worker_threads"
import { ChartJob, ChartResult } from "./chartCompute"

// Spawn the plain-JS entry (chartWorkerEntry.mjs), not the .ts logic directly:
// Node runs .mjs natively, and the entry uses tsx's tsImport() to load the
// TypeScript worker + its nested imports. This sidesteps the version-fragile
// tsx worker_threads auto-patch that failed to resolve nested .ts imports
// (ERR_MODULE_NOT_FOUND on ./chartCompute) on some Node/tsx combinations.

export function runChartPool(
  files: string[],
  job: ChartJob,
  concurrency: number,
  onResult: (result: ChartResult) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let next = 0
    let done = 0
    let settled = false
    const workers: Worker[] = []

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      for (const w of workers) void w.terminate()
      if (err) reject(err)
      else resolve()
    }

    const dispatch = (w: Worker) => {
      if (next >= files.length) {
        w.postMessage({ type: "exit" })
        return
      }
      const idx = next++
      w.postMessage({ type: "job", idx, file: files[idx], job })
    }

    const n = Math.max(1, Math.min(concurrency, files.length))
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL("./chartWorkerEntry.mjs", import.meta.url))
      workers.push(w)
      w.on("message", (msg: { idx: number; result: ChartResult }) => {
        try {
          onResult(msg.result)
        } catch (err) {
          finish(err as Error)
          return
        }
        if (++done === files.length) finish()
        else dispatch(w)
      })
      w.on("error", finish)
      dispatch(w)
    }
  })
}
