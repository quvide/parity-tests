// Compares the engine's natural interpretation of a chart against the one
// forced by manual foot annotations (SMEditor #PARITY overrides), and explains
// each divergence in cost-model terms: which cost categories make the
// annotated (human-correct) path more expensive than the engine's choice.

import { FixtureNote } from "./dsl"
import { EngineRun, runEngine } from "./engine"

export interface DivergenceRow {
  /** index into the engine's notedataRows — matches SMEditor's parity-debug row numbers */
  row: number
  beat: number
  naturalFeet: string
  annotatedFeet: string
  naturalTechs: string[]
  annotatedTechs: string[]
}

export interface DivergenceSegment {
  startBeat: number
  endBeat: number
  rows: DivergenceRow[]
  /** summed cost per category over the segment's edges (incl. reconvergence edge) */
  naturalCosts: Record<string, number>
  annotatedCosts: Record<string, number>
  totalDelta: number
}

export interface PathComparison {
  identical: boolean
  natural: EngineRun
  annotated: EngineRun
  segments: DivergenceSegment[]
  /** overrides the engine refused/dropped (annotated run doesn't match request) */
  overridesNotHonored: string[]
}

export function stripOverrides(notes: FixtureNote[]): FixtureNote[] {
  return notes.map(n => {
    if (!n.parity) return n
    const { parity, ...rest } = n
    return rest as FixtureNote
  })
}

function feetString(feet: (string | undefined)[]): string {
  return [0, 1, 2, 3].map(c => feet[c] ?? ".").join("")
}

function sumCosts(
  edges: Record<string, number>[],
  from: number,
  to: number
): Record<string, number> {
  const out: Record<string, number> = {}
  for (let i = from; i <= to && i < edges.length; i++) {
    for (const [k, v] of Object.entries(edges[i])) {
      if (v) out[k] = (out[k] ?? 0) + v
    }
  }
  return out
}

export function compareAnnotated(
  annotatedNotes: FixtureNote[],
  lastBeat: number
): PathComparison {
  const natural = runEngine(stripOverrides(annotatedNotes), lastBeat, true)
  const annotated = runEngine(annotatedNotes, lastBeat)

  if (natural.rows.length !== annotated.rows.length) {
    throw new Error(
      `row count mismatch between runs: ${natural.rows.length} vs ${annotated.rows.length}`
    )
  }

  // check the engine actually honored the overrides (it drops invalid ones)
  const overridesNotHonored: string[] = []
  for (const note of annotatedNotes) {
    const ov = note.parity?.override
    if (ov === undefined) continue
    const row = annotated.rows.find(r => Math.abs(r.beat - note.beat) < 1e-6)
    const actual = row?.feet[note.col]
    const wanted =
      ov === "Left" ? "L" : ov === "Right" ? "R" : ov <= 2 ? "L" : "R"
    if (actual !== wanted) {
      overridesNotHonored.push(
        `beat ${note.beat} col ${note.col}: override ${ov} but engine used ${actual ?? "-"}`
      )
    }
  }

  // divergence = rows where the full chosen state differs; the edge INTO the
  // reconvergence row also differs between paths, so include it in cost sums
  const differs: boolean[] = natural.footColumns.map(
    (fc, i) => fc.join() !== annotated.footColumns[i]?.join()
  )
  const segments: DivergenceSegment[] = []
  let i = 0
  while (i < differs.length) {
    if (!differs[i]) {
      i++
      continue
    }
    const start = i
    while (i < differs.length && differs[i]) i++
    const end = i - 1 // last differing row; edge end+1 is the reconvergence edge
    const rows: DivergenceRow[] = []
    for (let r = start; r <= end; r++) {
      const n = natural.rows[r]
      const a = annotated.rows[r]
      if (
        feetString(n.feet) !== feetString(a.feet) ||
        n.techs.join() !== a.techs.join()
      ) {
        rows.push({
          row: r,
          beat: n.beat,
          naturalFeet: feetString(n.feet),
          annotatedFeet: feetString(a.feet),
          naturalTechs: n.techs,
          annotatedTechs: a.techs,
        })
      }
    }
    const naturalCosts = sumCosts(natural.edgeCosts, start, end + 1)
    const annotatedCosts = sumCosts(annotated.edgeCosts, start, end + 1)
    segments.push({
      startBeat: natural.rows[start].beat,
      endBeat: natural.rows[end].beat,
      rows,
      naturalCosts,
      annotatedCosts,
      totalDelta: (annotatedCosts["TOTAL"] ?? 0) - (naturalCosts["TOTAL"] ?? 0),
    })
  }

  return {
    identical: segments.length === 0,
    natural,
    annotated,
    segments,
    overridesNotHonored,
  }
}

export function printComparison(
  cmp: PathComparison,
  log: (s: string) => void = console.log
) {
  const DIM = "\x1b[2m"
  const RED = "\x1b[31m"
  const GREEN = "\x1b[32m"
  const YELLOW = "\x1b[33m"
  const RESET = "\x1b[0m"

  log(
    `natural path cost ${cmp.natural.bestPathCost.toFixed(2)}, ` +
      `annotated path cost ${cmp.annotated.bestPathCost.toFixed(2)} ` +
      `(annotations cost ${(cmp.annotated.bestPathCost - cmp.natural.bestPathCost >= 0 ? "+" : "")}${(cmp.annotated.bestPathCost - cmp.natural.bestPathCost).toFixed(2)})`
  )
  for (const o of cmp.overridesNotHonored) {
    log(`${YELLOW}override not honored: ${o}${RESET}`)
  }
  if (cmp.identical) {
    log(`${GREEN}engine agrees with the manual annotations everywhere${RESET}`)
    return
  }
  log(
    `${cmp.segments.length} divergence segment(s) — the engine disagrees with the annotations:`
  )
  for (const seg of cmp.segments) {
    log("")
    log(
      `── beats ${seg.startBeat.toFixed(2)}–${seg.endBeat.toFixed(2)}: ` +
        `annotated path pays ${seg.totalDelta >= 0 ? "+" : ""}${seg.totalDelta.toFixed(2)} over this segment`
    )
    // why: category deltas, biggest first
    const cats = new Set([
      ...Object.keys(seg.naturalCosts),
      ...Object.keys(seg.annotatedCosts),
    ])
    cats.delete("TOTAL")
    const deltas = [...cats]
      .map(cat => ({
        cat,
        natural: seg.naturalCosts[cat] ?? 0,
        annotated: seg.annotatedCosts[cat] ?? 0,
      }))
      .map(d => ({ ...d, delta: d.annotated - d.natural }))
      .filter(d => Math.abs(d.delta) > 0.005)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    for (const d of deltas) {
      const sign = d.delta > 0 ? RED + "+" : GREEN + ""
      log(
        `   ${d.cat.padEnd(18)} ${sign}${d.delta.toFixed(2)}${RESET}` +
          `  ${DIM}(natural ${d.natural.toFixed(2)}, annotated ${d.annotated.toFixed(2)})${RESET}`
      )
    }
    if (deltas.length === 0) {
      log(`   ${DIM}(no category-level cost difference — pure tie-break)${RESET}`)
    }
    log(
      `   ${DIM}${"row".padEnd(6)} ${"beat".padEnd(8)} ${"natural".padEnd(16)} annotated${RESET}`
    )
    for (const row of seg.rows.slice(0, 12)) {
      log(
        `   ${String(row.row).padEnd(6)} ${row.beat.toFixed(2).padEnd(8)} ` +
          `${(row.naturalFeet + "  " + row.naturalTechs.join(" ")).padEnd(16)} ` +
          `${row.annotatedFeet}  ${row.annotatedTechs.join(" ")}`
      )
    }
    if (seg.rows.length > 12) {
      log(`   ${DIM}… ${seg.rows.length - 12} more rows${RESET}`)
    }
  }
}
