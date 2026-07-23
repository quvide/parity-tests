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
  /** facing label ("L" | "F" | "R") of each path's chosen state */
  naturalFacing: string
  annotatedFacing: string
}

export interface DivergenceSegment {
  startBeat: number
  endBeat: number
  /** first/last differing row index (differing feet or edge costs) */
  startRow: number
  endRow: number
  rows: DivergenceRow[]
  /** summed cost per category over the segment's edges */
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

  // divergence = rows where the chosen foot positions differ OR the edge
  // entering the row is priced differently. The cost check matters because
  // paths whose footColumns reconverge can still differ in hidden state
  // (traveledFeet, facing, …) and keep paying different costs afterwards —
  // e.g. a phantom jump on the annotated path dropping the doublestep shield
  // rows after the last visible foot difference. Without it those edges fall
  // outside every segment and the segment deltas don't add up to the
  // whole-path delta (a segment can even show negative).
  const EPS = 0.005
  const edgeDiffers = (i: number): boolean => {
    const n = natural.edgeCosts[i] ?? {}
    const a = annotated.edgeCosts[i] ?? {}
    const cats = new Set([...Object.keys(n), ...Object.keys(a)])
    cats.delete("TOTAL")
    for (const c of cats) {
      if (Math.abs((n[c] ?? 0) - (a[c] ?? 0)) > EPS) return true
    }
    return false
  }
  const differs: boolean[] = natural.footColumns.map(
    (fc, i) => fc.join() !== annotated.footColumns[i]?.join() || edgeDiffers(i)
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
    // last differing row; every cost-differing edge is inside the segment by
    // construction, so the cost sums need no extra reconvergence edge
    const end = i - 1
    // every row in the span, including ones where both paths step the same —
    // gaps in the table make the step sequence harder to follow
    const rows: DivergenceRow[] = []
    for (let r = start; r <= end; r++) {
      const n = natural.rows[r]
      const a = annotated.rows[r]
      rows.push({
        row: r,
        beat: n.beat,
        naturalFeet: feetString(n.feet),
        annotatedFeet: feetString(a.feet),
        naturalTechs: n.techs,
        annotatedTechs: a.techs,
        naturalFacing: natural.facings[r] ?? "?",
        annotatedFacing: annotated.facings[r] ?? "?",
      })
    }
    const naturalCosts = sumCosts(natural.edgeCosts, start, end)
    const annotatedCosts = sumCosts(annotated.edgeCosts, start, end)
    segments.push({
      startBeat: natural.rows[start].beat,
      endBeat: natural.rows[end].beat,
      startRow: start,
      endRow: end,
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

export interface PrintComparisonOptions {
  /** per-edge cost breakdown of both paths for each divergent segment */
  edges?: boolean
  /** print row tables bottom-up (notefield order) */
  reverse?: boolean
  /** append each path's facing (L/F/R) after the feet in row tables */
  facing?: boolean
}

export function printComparison(
  cmp: PathComparison,
  log: (s: string) => void = console.log,
  opts: PrintComparisonOptions = {}
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
    // with --facing each side shows the path's facing (L/F/R) after the feet
    const natWidth = opts.facing ? 18 : 16
    const fac = (label: string | undefined) =>
      opts.facing ? " " + (label ?? "?") : ""
    log(
      `   ${DIM}${"row".padEnd(6)} ${"beat".padEnd(8)} ${"natural".padEnd(natWidth)} annotated${RESET}`
    )
    // context: the agreed rows entering the segment, walked back until both
    // feet have hit (capped), so the reader sees where each foot stands
    // before the first divergent row
    const contextLines: string[] = []
    const seen = new Set<string>()
    for (let r = seg.startRow - 1; r >= 0 && contextLines.length < 4; r--) {
      const n = cmp.natural.rows[r]
      const a = cmp.annotated.rows[r]
      contextLines.unshift(
        `   ${DIM}${String(r).padEnd(6)} ${n.beat.toFixed(2).padEnd(8)} ` +
          `${(feetString(n.feet) + fac(cmp.natural.facings[r]) + "  " + n.techs.join(" ")).padEnd(natWidth)} ` +
          `${feetString(a.feet)}${fac(cmp.annotated.facings[r])}  ${a.techs.join(" ")}${RESET}`
      )
      for (const c of [0, 1, 2, 3]) {
        if (n.feet[c]) seen.add(n.feet[c]!.charAt(0).toUpperCase())
      }
      if (seen.has("L") && seen.has("R")) break
    }
    if (opts.reverse) contextLines.reverse()
    const shown = seg.rows.slice(0, 20)
    if (opts.reverse) shown.reverse()
    const truncated =
      seg.rows.length > 20
        ? `   ${DIM}… ${seg.rows.length - 20} more rows${RESET}`
        : undefined
    if (!opts.reverse) for (const l of contextLines) log(l)
    if (truncated && opts.reverse) log(truncated)
    // fixture-table style: paint the engine's divergences red against the
    // annotated ground truth — differing feet chars, and the tech cell when
    // notation differs ("-" placeholder keeps an empty mismatch visible).
    // Rows where both paths agree render dim, like the context rows.
    // ANSI codes would count toward padEnd, so pad on the plain text.
    for (const row of shown) {
      const techsBad =
        row.naturalTechs.join(" ") !== row.annotatedTechs.join(" ")
      const facingBad =
        opts.facing === true && row.naturalFacing !== row.annotatedFacing
      const agrees =
        row.naturalFeet === row.annotatedFeet && !techsBad && !facingBad
      if (agrees) {
        log(
          `   ${DIM}${String(row.row).padEnd(6)} ${row.beat.toFixed(2).padEnd(8)} ` +
            `${(row.naturalFeet + fac(row.naturalFacing) + "  " + row.naturalTechs.join(" ")).padEnd(natWidth)} ` +
            `${row.annotatedFeet}${fac(row.annotatedFacing)}  ${row.annotatedTechs.join(" ")}${RESET}`
        )
        continue
      }
      const feetCell = [...row.naturalFeet]
        .map((ch, c) => (row.annotatedFeet[c] !== ch ? `${RED}${ch}${RESET}` : ch))
        .join("")
      const facCell = opts.facing
        ? " " + (facingBad ? `${RED}${row.naturalFacing}${RESET}` : row.naturalFacing)
        : ""
      const tech = row.naturalTechs.join(" ") || (techsBad ? "-" : "")
      const techCell = techsBad ? `${RED}${tech}${RESET}` : tech
      const plain = row.naturalFeet + fac(row.naturalFacing) + "  " + tech
      log(
        `   ${String(row.row).padEnd(6)} ${row.beat.toFixed(2).padEnd(8)} ` +
          `${feetCell + facCell + "  " + techCell}${" ".repeat(Math.max(0, natWidth - plain.length))} ` +
          `${row.annotatedFeet}${fac(row.annotatedFacing)}  ${row.annotatedTechs.join(" ")}`
      )
    }
    if (truncated && !opts.reverse) log(truncated)
    if (opts.reverse) for (const l of contextLines) log(l)
    if (opts.edges) printSegmentEdges(cmp, seg, log, opts.reverse === true)
  }
}

/** one path's nonzero cost categories on an edge, biggest first: "CAT 1.00  CAT 2.00" */
export function fmtEdgeSide(costs: Record<string, number>): string {
  return (
    Object.entries(costs)
      .filter(([cat, v]) => cat !== "TOTAL" && Math.abs(v) > 0.005)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, v]) => `${cat} ${v.toFixed(2)}`)
      .join("  ") || "—"
  )
}

// One block per edge of the segment (the edge ENTERING each row), with each
// path's nonzero cost categories side by side.
function printSegmentEdges(
  cmp: PathComparison,
  seg: DivergenceSegment,
  log: (s: string) => void,
  reverse: boolean
) {
  const DIM = "\x1b[2m"
  const RED = "\x1b[31m"
  const GREEN = "\x1b[32m"
  const RESET = "\x1b[0m"

  const fmtSide = fmtEdgeSide

  log(`   ${DIM}per-edge costs (the edge entering each row):${RESET}`)
  const rowIndices = []
  for (let r = seg.startRow; r <= seg.endRow; r++) rowIndices.push(r)
  if (reverse) rowIndices.reverse()
  for (const r of rowIndices) {
    const nat = cmp.natural.edgeCosts[r] ?? {}
    const ann = cmp.annotated.edgeCosts[r] ?? {}
    const natTotal = nat["TOTAL"] ?? 0
    const annTotal = ann["TOTAL"] ?? 0
    const d = annTotal - natTotal
    const deltaStr =
      Math.abs(d) <= 0.005
        ? `${DIM}±0.00${RESET}`
        : d > 0
          ? `${RED}+${d.toFixed(2)}${RESET}`
          : `${GREEN}${d.toFixed(2)}${RESET}`
    log(
      `   ${DIM}→ row${RESET} ${String(r).padEnd(4)} ${DIM}beat${RESET} ${cmp.natural.rows[r].beat.toFixed(2).padEnd(7)} ` +
        `natural ${natTotal.toFixed(2)}, annotated ${annTotal.toFixed(2)} (${deltaStr})`
    )
    log(`        ${DIM}nat${RESET}  ${fmtSide(nat)}`)
    log(`        ${DIM}ann${RESET}  ${fmtSide(ann)}`)
  }
}
