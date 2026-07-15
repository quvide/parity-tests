// Persistent chart-analysis worker. Spawned once and fed jobs from the pool
// in cli.ts (see runChartPool) so the engine/smeditor import cost is paid
// once per worker, not once per chart.
import { parentPort } from "node:worker_threads"
import { analyzeChart, ChartJob } from "./chartCompute"

interface JobMessage {
  type: "job"
  idx: number
  file: string
  job: ChartJob
}
interface ExitMessage {
  type: "exit"
}

const port = parentPort
if (!port) throw new Error("chartWorker must run as a worker thread")

port.on("message", (msg: JobMessage | ExitMessage) => {
  if (msg.type === "exit") {
    port.close()
    return
  }
  const result = analyzeChart(msg.file, msg.job)
  port.postMessage({ idx: msg.idx, result })
})
