// Per-chart analysis, factored out so both the synchronous path and the
// worker pool run identical logic. Everything here is pure and returns
// structured-clone-safe data (plain objects/arrays plus the Map inside
// EngineRun.labels, which worker_threads clones natively) so a ChartResult
// can cross a worker boundary untouched and be formatted on the main thread.

import { FixtureNote } from "./dsl"
import { loadSSC } from "./ssc"
import { EngineRun, MirrorCheck, checkMirror, checkUDMirror, checkLRUDMirror } from "./engine"
import { compareAnnotated, stripOverrides, PathComparison } from "./compare"

export interface ChartJob {
  difficulty?: string
  bpmFactor: number
  noMirror: boolean
}

export type ChartResult =
  | { file: string; kind: "skip"; title: string; difficulty: string; warnings: string[] }
  | { file: string; kind: "error"; message: string }
  | {
      file: string
      kind: "ok"
      title: string
      difficulty: string
      warnings: string[]
      cmp: PathComparison
      /** only the mirror checks that FAILED, matching the old inline filter */
      asym: [string, MirrorCheck][]
    }

// Chart notes arrive with seconds precomputed from the chart's own BPMS, so
// a tempo factor is applied by scaling time directly (beats are unaffected).
export function scaleTempo(notes: FixtureNote[], bpmFactor: number): FixtureNote[] {
  return bpmFactor === 1
    ? notes
    : notes.map(n => ({ ...n, second: n.second / bpmFactor }))
}

// Mirror invariance on a chart is checked against the NATURAL run: human
// annotations aren't expected to be symmetric, so overrides are stripped
// before mirroring (`base` must be the natural run of the same notes).
export function chartMirrorChecks(
  notes: FixtureNote[],
  lastBeat: number,
  base: EngineRun
): [string, MirrorCheck][] {
  const input = { notedata: stripOverrides(notes), lastBeat }
  return [
    ["mirror", checkMirror(input, base)],
    ["ud-mirror", checkUDMirror(input, base)],
    ["lrud-mirror", checkLRUDMirror(input, base)],
  ]
}

/** Load, compare, and mirror-check a single chart. Never throws: load/compute
 *  failures come back as { kind: "error" } so one bad chart can't sink a sweep. */
export function analyzeChart(file: string, job: ChartJob): ChartResult {
  try {
    const chart = loadSSC(file, { difficulty: job.difficulty })
    if (chart.goldenCount === 0 && chart.overrideCount === 0) {
      return {
        file,
        kind: "skip",
        title: chart.title,
        difficulty: chart.difficulty,
        warnings: chart.warnings,
      }
    }
    const notes = scaleTempo(chart.notes, job.bpmFactor)
    const cmp = compareAnnotated(notes, chart.lastBeat)
    const asym = job.noMirror
      ? []
      : chartMirrorChecks(notes, chart.lastBeat, cmp.natural).filter(([, c]) => !c.ok)
    return {
      file,
      kind: "ok",
      title: chart.title,
      difficulty: chart.difficulty,
      warnings: chart.warnings,
      cmp,
      asym,
    }
  } catch (err) {
    return { file, kind: "error", message: (err as Error).message }
  }
}
