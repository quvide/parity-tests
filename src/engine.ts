import "./shim"
import { ParityInternals } from "../../smeditor/app/src/chart/stats/parity/ParityInternals"
import {
  FacingLabels,
  Foot,
  TechCategory,
  TechErrors,
  TECH_STRINGS,
  TECH_ERROR_STRINGS,
} from "../../smeditor/app/src/chart/stats/parity/ParityDataTypes"
import type { Notedata } from "../../smeditor/app/src/chart/sm/NoteTypes"
import { FixtureNote } from "./dsl"

/** subset of a fixture/chart the mirror checks need */
export interface MirrorInput {
  notedata: FixtureNote[]
  lastBeat: number
}

export interface EngineRow {
  beat: number
  second: number
  /** foot per column for note columns: "L" | "R", undefined where no note */
  feet: (string | undefined)[]
  techs: string[]
  errors: string[]
}

export interface EngineRun {
  rows: EngineRow[]
  bestPathCost: number
  /**
   * Cost margin to the cheapest path that differs from the best path in at
   * least one edge. Only computed when runEngine is asked for it; a small
   * margin means the chosen interpretation barely beat an alternative.
   */
  nextBestDelta?: number
  techCounts: Record<string, number>
  /** footColumns (col per foot part) of the chosen state at each row */
  footColumns: number[][]
  /** facing label ("L" | "F" | "R") of the chosen state at each row */
  facings: string[]
  /** cost-category breakdown of the best-path edge INTO each row */
  edgeCosts: Record<string, number>[]
  /** raw part-level labels: "beat-col" -> Foot (heel/toe resolution) */
  labels: Map<string, Foot>
}

export function footToLR(foot: Foot): "L" | "R" {
  return foot === Foot.LEFT_HEEL || foot === Foot.LEFT_TOE ? "L" : "R"
}

export function runEngine(
  notedata: FixtureNote[],
  lastBeat: number,
  withNextBest = false
): EngineRun {
  const internals = new ParityInternals("dance-single")
  const result = internals.compute(-1, lastBeat + 4, notedata as Notedata)
  if (!result) throw new Error("engine returned no result")

  const rows: EngineRow[] = internals.notedataRows.map((row, i) => {
    const feet: (string | undefined)[] = []
    for (let col = 0; col < 4; col++) {
      const note = row.notes[col]
      if (!note) continue
      const foot = result.parityLabels.get(note.beat.toFixed(3) + "-" + col)
      feet[col] = foot === undefined ? "?" : footToLR(foot)
    }
    const techSet = result.techRows[i]
    const errSet = result.techErrors.get(i)
    return {
      beat: row.beat,
      second: row.second,
      feet,
      techs: techSet
        ? [...techSet].map(t => TECH_STRINGS[t as TechCategory]).sort()
        : [],
      errors: errSet
        ? [...errSet].map(e => TECH_ERROR_STRINGS[e as TechErrors]).sort()
        : [],
    }
  })

  const techCounts: Record<string, number> = {}
  result.techCounts.forEach((count, tech) => {
    if (count) techCounts[TECH_STRINGS[tech as TechCategory]] = count
  })

  // Walk the best path to get per-row states and edge cost breakdowns.
  // initialNode is private (compile-time only); we need it for the first edge.
  const anyInternals = internals as any
  const path: string[] = internals.bestPath ?? []
  const footColumns: number[][] = []
  const facings: string[] = []
  const edgeCosts: Record<string, number>[] = []
  let node = anyInternals.initialNode
  for (let i = 1; i < path.length - 1; i++) {
    const child = internals.nodeMap.get(path[i])!
    edgeCosts.push(node.children.get(path[i]) ?? {})
    footColumns.push([...child.state.footColumns])
    facings.push(FacingLabels[child.state.facing])
    node = child
  }

  return {
    rows,
    bestPathCost: internals.bestPathCost,
    nextBestDelta: withNextBest ? computeNextBestDelta(internals) : undefined,
    techCounts,
    footColumns,
    facings,
    edgeCosts,
    labels: result.parityLabels,
  }
}

/**
 * Margin between the best path and the cheapest path whose FOOT LABELING
 * differs somewhere — i.e. the cheapest path through any node whose
 * combinedColumns differ from the best path's at that row. Paths that differ
 * only in bookkeeping state (facing lanes etc.) produce identical output and
 * are not alternatives; measuring raw next-best-path would report those
 * phantom 0-cost ties.
 */
function computeNextBestDelta(internals: ParityInternals): number | undefined {
  const anyInternals = internals as any
  const initial = anyInternals.initialNode
  const path = internals.bestPath
  if (!path || path.length < 2) return undefined

  const layers = [[initial], ...internals.nodeRows.map(r => r.nodes)]
  const lastLayer = layers[layers.length - 1]

  // forward: cheapest cost from the initial node to every node
  const fwd = new Map<string, number>([[initial.key, 0]])
  for (const layer of layers) {
    for (const node of layer) {
      const d = fwd.get(node.key)
      if (d === undefined) continue
      for (const [childKey, costs] of node.children) {
        const nd = d + (costs["TOTAL"] ?? 0)
        if (nd < (fwd.get(childKey) ?? Infinity)) fwd.set(childKey, nd)
      }
    }
  }

  // backward: cheapest cost from every node to END. The engine's END edges
  // exist only transiently inside its own path pass, so every last-row node
  // is treated as connecting to END at cost 0.
  const bwd = new Map<string, number>()
  for (const node of lastLayer) bwd.set(node.key, 0)
  for (let li = layers.length - 2; li >= 0; li--) {
    for (const node of layers[li]) {
      let best = Infinity
      for (const [childKey, costs] of node.children) {
        const b = bwd.get(childKey)
        if (b === undefined) continue
        const nd = (costs["TOTAL"] ?? 0) + b
        if (nd < best) best = nd
      }
      if (best < Infinity) bwd.set(node.key, best)
    }
  }

  let second = Infinity
  internals.nodeRows.forEach((nodeRow, i) => {
    const bestNode = internals.nodeMap.get(path[i + 1])
    if (!bestNode) return
    const bestProj = bestNode.state.combinedColumns.join()
    for (const node of nodeRow.nodes) {
      if (node.state.combinedColumns.join() === bestProj) continue
      const d = fwd.get(node.key)
      const b = bwd.get(node.key)
      if (d === undefined || b === undefined) continue
      if (d + b < second) second = d + b
    }
  })

  if (second === Infinity) return undefined
  return Math.max(0, second - internals.bestPathCost)
}

const MIRROR_COL = [3, 1, 2, 0]
// front/back mirror: D<->U swapped, sides kept. Expected to hold at foot
// granularity (feet/tech/cost) just like L/R. Part-level heel/toe
// assignments necessarily flip under it (toes point forward), so only
// part-agnostic quantities can be asserted.
const UD_MIRROR_COL = [0, 2, 1, 3]
// LR+UD combined = 180° pad rotation. Independent assertion: two separate
// asymmetries can cancel under composition, so this is not implied by the
// other two checks.
const LRUD_MIRROR_COL = [3, 2, 1, 0]

function mirrorWith(
  notedata: FixtureNote[],
  colMap: number[]
): FixtureNote[] {
  return notedata
    .map(n => ({ ...n, col: colMap[n.col] }))
    .sort((a, b) => a.beat - b.beat || a.col - b.col)
}

export function mirrorNotedata(notedata: FixtureNote[]): FixtureNote[] {
  return mirrorWith(notedata, MIRROR_COL)
}

export interface MirrorRow {
  /** row index — matches SMEditor's parity-debug numbering (same for both runs) */
  row: number
  beat: number
  /** base run's feet mapped into mirrored columns: what invariance predicts */
  expectedFeet: string
  /** what the engine actually chose on the mirrored chart */
  actualFeet: string
  baseTechs: string[]
  mirroredTechs: string[]
  baseErrors: string[]
  mirroredErrors: string[]
  /** facing of each run's chosen state ("L" | "F" | "R") */
  baseFacing: string
  mirroredFacing: string
  /**
   * facing invariance predicts on the mirrored chart: a single-axis mirror
   * (LR or UD) flips the body's rotation L<->R, a 180° rotation preserves it
   */
  expectedFacing: string
  /**
   * what the priced (exp) run actually stepped — equals expectedFeet unless
   * the engine refused a forced override. The mirrored run's feet when no
   * forced run was needed (the chosen path already is the correct one).
   */
  expectedRunFeet: string
  /** facing of the priced (exp) run's chosen state at this row */
  expectedRunFacing: string
  /** TOTAL of the best-path edge into this row on the base chart */
  baseCost: number
  /** TOTAL of the edge the mirrored engine actually chose */
  mirroredCost: number
  /**
   * TOTAL of the CORRECT edge on the mirrored chart — the base run's feet
   * forced as overrides. Invariance says this equals baseCost; when the
   * mirrored run already took the expected path it equals mirroredCost too.
   */
  expectedCost: number
  /**
   * cost categories where the correct mirrored edge disagrees with the base
   * edge (invariance says none should), formatted "CAT base→exp"
   */
  costDiffs: string[]
  /** full cost-category breakdown of each edge, for --explain display */
  baseEdge: Record<string, number>
  expectedEdge: Record<string, number>
  mirroredEdge: Record<string, number>
  /**
   * The mirrored engine's chosen route priced on the BASE chart (round-trip).
   * Only set when the correct path prices symmetrically (every costDiffs
   * empty) yet the totals differ — the asymmetry then lives on the divergent
   * route, and invariance says this edge must equal mirroredEdge.
   */
  mirAtBaseEdge?: Record<string, number>
  /** categories where the round-trip disagrees, formatted "CAT mir→mir@base" */
  mirCostDiffs?: string[]
  ok: boolean
}

export interface MirrorCheck {
  ok: boolean
  /** substantive asymmetries: tech/error/total-cost differences */
  violations: string[]
  /** foot assignments that differ at equal cost: 50/50 tie-breaks, informational */
  tieBreaks: string[]
  /** per-row expected-vs-actual of the mirrored run, for step-level display */
  rows: MirrorRow[]
  /** best-path totals: base chart and what the mirrored engine chose */
  baseTotal: number
  mirroredTotal: number
  /** the correct (base-mirrored) feet priced on the mirrored chart, when computed */
  expectedTotal?: number
  /** the mirrored engine's route priced back on the base chart, when computed */
  mirAtBaseTotal?: number
}

/**
 * Runs the mirrored chart and asserts engine(mirror(chart)) == mirror(engine(chart)).
 * Turns "the engine is implicitly symmetrical" into a checked invariant.
 * Foot differences with identical total cost and identical tech/error output are
 * reported separately as tie-breaks (a deterministic solver must pick one side
 * of a genuine 50/50; that is not an asymmetry in the cost model).
 */
const flipLR = (f: string) => (f === "L" ? "R" : f === "R" ? "L" : f)

export function checkMirror(input: MirrorInput, base: EngineRun): MirrorCheck {
  return checkMirrorWith(
    input,
    base,
    MIRROR_COL,
    f => (f === "L" ? "R" : f === "R" ? "L" : f),
    flipLR
  )
}

/** front/back (D<->U) mirror: feet keep their side, no flip */
export function checkUDMirror(
  input: MirrorInput,
  base: EngineRun
): MirrorCheck {
  return checkMirrorWith(input, base, UD_MIRROR_COL, f => f, flipLR)
}

/** 180° rotation (LR+UD): columns fully reversed, feet flip sides */
export function checkLRUDMirror(
  input: MirrorInput,
  base: EngineRun
): MirrorCheck {
  return checkMirrorWith(
    input,
    base,
    LRUD_MIRROR_COL,
    f => (f === "L" ? "R" : f === "R" ? "L" : f),
    f => f
  )
}

function checkMirrorWith(
  input: MirrorInput,
  base: EngineRun,
  colMap: number[],
  flip: (f: string | undefined) => string | undefined,
  /** what the base state's facing maps to under this transform */
  facingFlip: (f: string) => string
): MirrorCheck {
  const mirroredNotes = mirrorWith(input.notedata, colMap)
  const mirrored = runEngine(mirroredNotes, input.lastBeat)
  const violations: string[] = []
  const tieBreaks: string[] = []
  const rows: MirrorRow[] = []
  if (mirrored.rows.length !== base.rows.length) {
    return {
      ok: false,
      violations: [`row count ${mirrored.rows.length} != ${base.rows.length}`],
      tieBreaks: [],
      rows: [],
      baseTotal: base.bestPathCost,
      mirroredTotal: mirrored.bestPathCost,
    }
  }
  const costEqual =
    Math.abs(mirrored.bestPathCost - base.bestPathCost) <= 0.01
  const expectedFeetRows: (string | undefined)[][] = []
  let feetDiverged = false
  for (let i = 0; i < base.rows.length; i++) {
    const b = base.rows[i]
    const m = mirrored.rows[i]
    const expectedFeet: (string | undefined)[] = []
    for (let col = 0; col < 4; col++) {
      const expected = flip(b.feet[col])
      expectedFeet[colMap[col]] = expected
      const actual = m.feet[colMap[col]]
      if (expected !== actual) {
        feetDiverged = true
        const msg = `beat ${b.beat}: col ${col} ${b.feet[col]} mirrored to ${actual ?? "-"} (expected ${expected ?? "-"})`
        ;(costEqual ? tieBreaks : violations).push(msg)
      }
    }
    expectedFeetRows.push(expectedFeet)
    if (b.techs.join() !== m.techs.join()) {
      violations.push(
        `beat ${b.beat}: techs [${b.techs}] vs mirrored [${m.techs}]`
      )
    }
    if (b.errors.join() !== m.errors.join()) {
      violations.push(
        `beat ${b.beat}: errors [${b.errors}] vs mirrored [${m.errors}]`
      )
    }
  }

  // Edge costs are compared against the CORRECT edge on the mirrored chart.
  // Once the mirrored engine picks different feet, its best-path edges belong
  // to a different route, and diffing them against the base edges conflates
  // cost asymmetry with route choice. Forcing the expected feet as overrides
  // prices the base path on the mirrored chart; invariance says those edges
  // equal the base edges category-by-category, so any diff is the asymmetric
  // cost term itself. When the runs agree the chosen path IS the correct one
  // and no extra engine run is needed.
  let expected: EngineRun | undefined
  if (feetDiverged) {
    const forced: FixtureNote[] = mirroredNotes.map(n => ({
      ...n,
      parity: undefined,
    }))
    const byKey = new Map(
      forced.map(n => [n.beat.toFixed(3) + "-" + n.col, n])
    )
    for (let i = 0; i < base.rows.length; i++) {
      const beat = base.rows[i].beat
      for (let col = 0; col < 4; col++) {
        const f = expectedFeetRows[i][col]
        if (f !== "L" && f !== "R") continue
        const note = byKey.get(beat.toFixed(3) + "-" + col)
        if (note) note.parity = { override: f === "L" ? "Left" : "Right" }
      }
    }
    try {
      const run = runEngine(forced, input.lastBeat)
      if (run.rows.length === base.rows.length) expected = run
    } catch {
      // diagnostic only — fall back to comparing the chosen edges
    }
  }

  for (let i = 0; i < base.rows.length; i++) {
    const b = base.rows[i]
    const m = mirrored.rows[i]
    const expectedFeet = expectedFeetRows[i]
    const feetOk = [0, 1, 2, 3].every(c => expectedFeet[c] === m.feet[c])
    const bEdge = base.edgeCosts[i] ?? {}
    const mEdge = mirrored.edgeCosts[i] ?? {}
    const eEdge = expected ? expected.edgeCosts[i] ?? {} : mEdge
    const costDiffs = [...new Set([...Object.keys(bEdge), ...Object.keys(eEdge)])]
      .filter(cat => cat !== "TOTAL")
      .filter(cat => Math.abs((bEdge[cat] ?? 0) - (eEdge[cat] ?? 0)) > 0.005)
      .sort()
      .map(
        cat =>
          `${cat} ${(bEdge[cat] ?? 0).toFixed(2)}→${(eEdge[cat] ?? 0).toFixed(2)}`
      )
    rows.push({
      row: i,
      beat: b.beat,
      expectedFeet: [0, 1, 2, 3].map(c => expectedFeet[c] ?? ".").join(""),
      actualFeet: [0, 1, 2, 3].map(c => m.feet[c] ?? ".").join(""),
      baseTechs: b.techs,
      mirroredTechs: m.techs,
      baseErrors: b.errors,
      mirroredErrors: m.errors,
      baseFacing: base.facings[i] ?? "?",
      mirroredFacing: mirrored.facings[i] ?? "?",
      expectedFacing:
        base.facings[i] === undefined ? "?" : facingFlip(base.facings[i]),
      expectedRunFeet: expected
        ? [0, 1, 2, 3].map(c => expected.rows[i].feet[c] ?? ".").join("")
        : [0, 1, 2, 3].map(c => m.feet[c] ?? ".").join(""),
      expectedRunFacing:
        (expected ? expected.facings[i] : mirrored.facings[i]) ?? "?",
      baseCost: bEdge["TOTAL"] ?? 0,
      mirroredCost: mEdge["TOTAL"] ?? 0,
      expectedCost: eEdge["TOTAL"] ?? 0,
      costDiffs,
      baseEdge: bEdge,
      expectedEdge: eEdge,
      mirroredEdge: mEdge,
      ok:
        feetOk &&
        b.techs.join() === m.techs.join() &&
        b.errors.join() === m.errors.join() &&
        costDiffs.length === 0,
    })
  }
  // When the correct path prices identically on both charts yet the totals
  // differ, the asymmetry lives on the DIVERGENT route: the mirrored engine
  // found a cheaper path whose mirror image must be pricier on the base chart
  // (the base engine is optimal). Round-trip that route — force the mirrored
  // engine's feet, mapped back through the mirror, onto the base chart — and
  // diff it edge-by-edge against the mirrored pricing; invariance says the
  // two pricings of the same route must match category-by-category.
  let roundTrip: EngineRun | undefined
  if (
    expected !== undefined &&
    !costEqual &&
    rows.every(r => r.costDiffs.length === 0)
  ) {
    const forced: FixtureNote[] = input.notedata.map(n => ({
      ...n,
      parity: undefined,
    }))
    const byKey = new Map(
      forced.map(n => [n.beat.toFixed(3) + "-" + n.col, n])
    )
    for (const m of mirrored.rows) {
      for (let mc = 0; mc < 4; mc++) {
        const f = flip(m.feet[mc])
        if (f !== "L" && f !== "R") continue
        const note = byKey.get(m.beat.toFixed(3) + "-" + colMap[mc])
        if (note) note.parity = { override: f === "L" ? "Left" : "Right" }
      }
    }
    try {
      const run = runEngine(forced, input.lastBeat)
      if (run.rows.length === base.rows.length) roundTrip = run
    } catch {
      // diagnostic only
    }
    if (roundTrip) {
      for (let i = 0; i < rows.length; i++) {
        const mEdge = mirrored.edgeCosts[i] ?? {}
        const rtEdge = roundTrip.edgeCosts[i] ?? {}
        rows[i].mirAtBaseEdge = rtEdge
        rows[i].mirCostDiffs = [
          ...new Set([...Object.keys(mEdge), ...Object.keys(rtEdge)]),
        ]
          .filter(cat => cat !== "TOTAL")
          .filter(cat => Math.abs((mEdge[cat] ?? 0) - (rtEdge[cat] ?? 0)) > 0.005)
          .sort()
          .map(
            cat =>
              `${cat} ${(mEdge[cat] ?? 0).toFixed(2)}→${(rtEdge[cat] ?? 0).toFixed(2)}`
          )
      }
    }
  }

  if (!costEqual) {
    // first, not last: contexts that truncate the violation list must not
    // hide the one line that says which kind of asymmetry this is
    violations.unshift(
      `best path cost ${base.bestPathCost.toFixed(2)} vs mirrored ${mirrored.bestPathCost.toFixed(2)}` +
        (expected
          ? ` (correct feet on the mirrored chart cost ${expected.bestPathCost.toFixed(2)})`
          : "")
    )
  }
  return {
    ok: violations.length === 0,
    violations,
    tieBreaks,
    rows,
    baseTotal: base.bestPathCost,
    mirroredTotal: mirrored.bestPathCost,
    expectedTotal: expected?.bestPathCost,
    mirAtBaseTotal: roundTrip?.bestPathCost,
  }
}
