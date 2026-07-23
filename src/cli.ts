import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { expandBpms, parseFixture, FixtureNote, ParsedFixture } from "./dsl"
import { FIXTURES } from "./fixtures/index"
import { availableParallelism } from "node:os"
import {
  runEngine,
  checkMirror,
  checkUDMirror,
  checkLRUDMirror,
  MirrorCheck,
} from "./engine"
import { evaluateFixture } from "./evaluate"
import { generateSong, GEN_DIR } from "./sscgen"
import { loadSSC, writeGolden } from "./ssc"
import { compareAnnotated, fmtEdgeSide, printComparison } from "./compare"
import {
  scaleTempo,
  chartMirrorChecks,
  analyzeChart,
  ChartResult,
} from "./chartCompute"
import { runChartPool } from "./chartPool"

// Single source of truth for flags: parseArgs config and --help output are
// both derived from this table. Add a flag here and it's parsed, validated,
// and documented.
interface OptSpec {
  type: "boolean" | "string"
  short?: string
  arg?: string // value placeholder shown in help, e.g. "<file.ssc>"
  desc: string
  group: keyof typeof GROUPS
}

const GROUPS = {
  fixture:
    "Fixture suite — positional args select fixtures by exact name, or by\nglob when the filter contains * or ? (a filter implies --fixtures):",
  chart:
    "Chart sweep — compare the engine's natural output against a real chart's\nhuman annotations (#PARITYGOLDEN baked target and/or #PARITY / data.sme\nsparse overrides):",
  general: "General:",
} as const

const OPTIONS: Record<string, OptSpec> = {
  fixtures: {
    type: "boolean",
    desc: "run only the fixture suite (skip the chart sweep); combine with --chart to run both explicitly",
    group: "fixture",
  },
  verbose: {
    type: "boolean",
    short: "v",
    desc: "per-row tables for every fixture (default output is status lines only)",
    group: "fixture",
  },
  explain: {
    type: "boolean",
    desc: "failing fixtures: force expected feet as overrides and report per-category cost deltas plus a per-edge cost breakdown of both paths; diverging charts: add the same per-edge breakdown; mirror-asymmetric fixtures: per-row mismatches with the same base/exp/mir per-edge breakdown",
    group: "general",
  },
  "no-mirror": {
    type: "boolean",
    desc: "skip mirror-invariance checks",
    group: "fixture",
  },
  gen: {
    type: "boolean",
    desc: `write openable .ssc charts to ${GEN_DIR}/ under the package root`,
    group: "fixture",
  },
  chart: {
    type: "string",
    arg: "[path]",
    desc: "chart to compare, or a directory to sweep every .ssc under it (one summary line per chart; -v for full divergence output). A value that isn't an existing path is searched for by filename under the working directory. With no argument, sweeps the bundled reference-charts corpus",
    group: "chart",
  },
  difficulty: {
    type: "string",
    arg: "<name>",
    desc: "pick a chart by difficulty (default: first in file)",
    group: "chart",
  },
  "write-golden": {
    type: "boolean",
    desc: "bake #PARITYGOLDEN from the annotation-guided run",
    group: "chart",
  },
  reverse: {
    type: "boolean",
    short: "r",
    desc: "print per-row tables bottom-up (notefield order)",
    group: "general",
  },
  facing: {
    type: "boolean",
    short: "f",
    desc: "show the engine-determined facing (L/F/R) after the feet in per-row tables",
    group: "general",
  },
  "bpm-factor": {
    type: "string",
    arg: "<f>",
    desc: "scale every tempo by this factor. Incompatible with --write-golden",
    group: "general",
  },
  jobs: {
    type: "string",
    short: "j",
    arg: "<n>",
    desc: "parallel workers for a directory chart sweep (default: CPU count, 1: no workers)",
    group: "general",
  },
  help: { type: "boolean", short: "h", desc: "show this help", group: "general" },
}

function usage(): string {
  const flagCol = (name: string, o: OptSpec) =>
    "  " +
    [o.short ? `-${o.short},` : undefined, `--${name}`, o.arg]
      .filter(Boolean)
      .join(" ")
  const width =
    Math.max(...Object.entries(OPTIONS).map(([n, o]) => flagCol(n, o).length)) + 2
  const lines = [
    "usage: parity [filter...] [options]",
    "",
    "With no mode selection (no --fixtures, --chart, or filter), the fixture",
    "suite and the reference-charts sweep both run in one invocation.",
  ]
  for (const [group, header] of Object.entries(GROUPS)) {
    lines.push("", header)
    for (const [name, o] of Object.entries(OPTIONS)) {
      if (o.group !== group) continue
      let col = flagCol(name, o).padEnd(width)
      for (const word of o.desc.split(" ")) {
        if (col.length + word.length > 78) {
          lines.push(col.trimEnd())
          col = " ".repeat(width)
        }
        col += word + " "
      }
      lines.push(col.trimEnd())
    }
  }
  return lines.join("\n")
}

// --chart with no argument defaults to the bundled reference-charts corpus.
// parseArgs has no notion of an optional-argument option, so patch the default
// value in when --chart is bare (last token, or followed by another flag).
// Resolve it against the package root so it works from any cwd (parity.sh runs
// tsx from wherever it was invoked).
const REFERENCE_CHARTS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "reference-charts"
)
const rawArgs = process.argv.slice(2)
const patchedArgs: string[] = []
for (let i = 0; i < rawArgs.length; i++) {
  patchedArgs.push(rawArgs[i])
  if (rawArgs[i] === "--chart") {
    const next = rawArgs[i + 1]
    if (next === undefined || next.startsWith("-")) patchedArgs.push(REFERENCE_CHARTS)
  }
}

let values: Record<string, string | boolean | undefined>
let filters: string[]
try {
  const parsed = parseArgs({
    args: patchedArgs,
    options: Object.fromEntries(
      Object.entries(OPTIONS).map(([name, o]) => [
        name,
        { type: o.type, ...(o.short ? { short: o.short } : {}) },
      ])
    ),
    allowPositionals: true,
  })
  values = parsed.values
  filters = parsed.positionals
} catch (err) {
  console.error(`${(err as Error).message}\n\n${usage()}`)
  process.exit(2)
}
if (values.help) {
  console.log(usage())
  process.exit(0)
}

const doGen = values.gen === true
const verbose = values.verbose === true
const noMirror = values["no-mirror"] === true
const explain = values.explain === true
const reverseRows = values.reverse === true
const showFacing = values.facing === true
const chartPath = values.chart as string | undefined
const bpmFactor =
  values["bpm-factor"] === undefined
    ? 1
    : parseFloat(values["bpm-factor"] as string)
if (!Number.isFinite(bpmFactor) || bpmFactor <= 0) {
  console.error(`invalid --bpm-factor: ${values["bpm-factor"]}`)
  process.exit(2)
}

const jobs =
  values.jobs === undefined
    ? Math.max(1, availableParallelism() - 1)
    : parseInt(values.jobs as string, 10)
if (!Number.isInteger(jobs) || jobs < 1) {
  console.error(`invalid --jobs: ${values.jobs}`)
  process.exit(2)
}

const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const CYAN = "\x1b[36m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"

function fmtExpectation(exp: {
  expectedTechs: string[]
  skip: boolean
}): string {
  if (exp.skip) return "*"
  return exp.expectedTechs.join(" ")
}

// pad to width based on the plain text, then colorize — ANSI codes would
// otherwise count toward padEnd's length
function padColored(plain: string, colored: string, width: number): string {
  return colored + " ".repeat(Math.max(0, width - plain.length))
}

function fmtFeet(feet: (string | null | undefined)[]): string {
  return [0, 1, 2, 3]
    .map(c => (feet[c] === undefined ? "." : feet[c] === null ? "?" : feet[c]))
    .join("")
}

// -------------------------------------------------------------- chart sweep
// Compare the engine's natural interpretation of a real chart against its
// manual #PARITY annotations, and explain divergences in cost terms.
// A directory sweeps every .ssc under it with one summary line per chart.

// Which suites run: an explicit --fixtures or --chart selects that suite, a
// positional filter implies --fixtures (it targets fixtures by name), and a
// bare invocation runs both — fixtures plus the reference-charts sweep.
const wantFixtures =
  values.fixtures === true || filters.length > 0 || chartPath === undefined
const wantCharts =
  chartPath !== undefined || (values.fixtures !== true && filters.length === 0)
let chartTarget = chartPath ?? (wantCharts ? REFERENCE_CHARTS : undefined)

// A --chart value that isn't an existing path is treated as a filename to
// look up: search the working directory recursively for a file whose name
// matches (with or without the .ssc extension).
function findChartByName(name: string): string[] {
  const wanted = new Set(
    [name, `${name}.ssc`].map(n => n.toLowerCase())
  )
  const matches: string[] = []
  const entries = fs.readdirSync(process.cwd(), {
    recursive: true,
  }) as string[]
  for (const rel of entries) {
    const parts = rel.split(path.sep)
    if (parts.some(p => p === "node_modules" || p.startsWith("."))) continue
    if (!wanted.has(parts[parts.length - 1].toLowerCase())) continue
    const abs = path.join(process.cwd(), rel)
    if (fs.statSync(abs).isFile()) matches.push(abs)
  }
  return matches.sort()
}

if (chartTarget !== undefined && !fs.existsSync(chartTarget)) {
  const matches = chartPath === undefined ? [] : findChartByName(chartPath)
  if (matches.length === 1) {
    console.log(`--chart ${chartPath}: found ${matches[0]}`)
    chartTarget = matches[0]
  } else if (matches.length > 1) {
    console.error(
      `--chart ${chartPath} matches multiple files:\n  ${matches.join("\n  ")}`
    )
    process.exit(2)
  } else {
    console.error(`no such file or directory: ${chartTarget}`)
    process.exit(2)
  }
}
const chartIsDir =
  chartTarget !== undefined && fs.statSync(chartTarget).isDirectory()
if (chartIsDir && values["write-golden"]) {
  console.error("--write-golden needs a single .ssc file, not a directory")
  process.exit(2)
}

async function runChartSweep(sweepDir: string): Promise<number> {
  const files = (fs.readdirSync(sweepDir, { recursive: true }) as string[])
    .filter(f => f.endsWith(".ssc"))
    .sort()
    .map(f => path.join(sweepDir, f))
  if (files.length === 0) {
    console.error(`no .ssc files under ${sweepDir}`)
    return 2
  }
  let agree = 0
  let diverged = 0
  let skipped = 0
  let errors = 0
  let mirrorAsymmetric = 0
  let segmentCount = 0
  const totalNatural: Record<string, number> = {}
  const totalAnnotated: Record<string, number> = {}

  // Format one chart's result and fold it into the running totals. Called as
  // each result arrives (in file order inline, in completion order from the
  // pool) so charts print live rather than all at the end; the summary totals
  // are order-independent sums, so streaming doesn't change them.
  const renderResult = (res: ChartResult) => {
    if (verbose && res.kind !== "error") {
      for (const w of res.warnings) console.log(`${YELLOW}warning: ${w}${RESET}`)
    }
    if (res.kind === "error") {
      errors++
      console.log(`${RED}ERROR${RESET}  ${path.relative(sweepDir, res.file)}: ${res.message}`)
      return
    }
    const name = `${path.relative(sweepDir, res.file)} [${res.difficulty}]`.padEnd(46)
    if (res.kind === "skip") {
      skipped++
      console.log(
        `${DIM}SKIP   ${name} ${"—".padStart(9)}  no annotations${RESET}`
      )
      return
    }
    const { cmp, asym } = res
    const delta = cmp.annotated.bestPathCost - cmp.natural.bestPathCost
    const deltaStr = `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`
    let mirrorTag = ""
    if (asym.length > 0) {
      mirrorAsymmetric++
      mirrorTag = asym
        .map(([label]) => `  ${YELLOW}${label}-asymmetric${RESET}`)
        .join("")
    }
    if (cmp.identical) {
      agree++
      // for a passing chart the interesting cost is the margin to the
      // engine's next-best interpretation: how comfortably it passes
      const margin = cmp.natural.nextBestDelta
      const marginStr =
        margin === undefined ? "—" : `+${Math.max(0, margin).toFixed(2)}`
      console.log(
        `${GREEN}PASS${RESET}   ${name} ${marginStr.padStart(9)}  ${DIM}to next-best${RESET}${mirrorTag}`
      )
    } else {
      diverged++
      segmentCount += cmp.segments.length
      for (const seg of cmp.segments) {
        for (const [cat, v] of Object.entries(seg.naturalCosts))
          totalNatural[cat] = (totalNatural[cat] ?? 0) + v
        for (const [cat, v] of Object.entries(seg.annotatedCosts))
          totalAnnotated[cat] = (totalAnnotated[cat] ?? 0) + v
      }
      console.log(
        `${RED}DIFF${RESET}   ${name} ${deltaStr.padStart(9)}  ${DIM}to golden, ` +
          `${cmp.segments.length} divergent segment${cmp.segments.length === 1 ? "" : "s"}${RESET}${mirrorTag}`
      )
      if (verbose)
        printComparison(cmp, s => console.log("   " + s), { edges: explain, reverse: reverseRows, facing: showFacing })
    }
    if (verbose) {
      for (const [label, c] of asym) {
        for (const d of c.violations.slice(0, 8)) {
          console.log(`   ${YELLOW}${label}: ${d}${RESET}`)
        }
        if (c.violations.length > 8) {
          console.log(`   ${DIM}… ${c.violations.length - 8} more${RESET}`)
        }
      }
    }
  }

  // Each chart is independent and the engine is stateless per run, so the
  // heavy per-file work (compareAnnotated + three mirror checks, each running
  // the engine) fans out across a worker pool, printing each chart as its
  // worker finishes. `-j1` skips the workers and runs inline in file order
  // (useful for profiling, debugging, and deterministic output).
  const job = {
    difficulty: values.difficulty as string | undefined,
    bpmFactor,
    noMirror,
  }
  if (jobs <= 1) {
    for (const file of files) renderResult(analyzeChart(file, job))
  } else {
    await runChartPool(files, job, jobs, renderResult)
  }

  console.log("─".repeat(60))
  console.log(
    `${agree}/${agree + diverged} annotated charts agree` +
      (diverged ? `, ${RED}${diverged} diverge${RESET}` : "") +
      (noMirror
        ? ""
        : mirrorAsymmetric
          ? `, ${YELLOW}${mirrorAsymmetric} mirror-asymmetric${RESET}`
          : ", mirror invariance holds") +
      (skipped ? `, ${skipped} unannotated skipped` : "") +
      (errors ? `, ${RED}${errors} errors${RESET}` : "")
  )
  if (diverged) {
    // same category-delta accounting printComparison does per segment,
    // summed over every divergent segment in the sweep
    const cats = new Set([
      ...Object.keys(totalNatural),
      ...Object.keys(totalAnnotated),
    ])
    cats.delete("TOTAL")
    const deltas = [...cats]
      .map(cat => ({
        cat,
        natural: totalNatural[cat] ?? 0,
        annotated: totalAnnotated[cat] ?? 0,
      }))
      .map(d => ({ ...d, delta: d.annotated - d.natural }))
      .filter(d => Math.abs(d.delta) > 0.005)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    console.log(
      `cost-category deltas summed over all ${segmentCount} divergent segments ` +
        `${DIM}(+ = the human path pays more there; the engine chased the negatives)${RESET}`
    )
    for (const d of deltas) {
      const sign = d.delta > 0 ? RED + "+" : GREEN + ""
      console.log(
        `   ${d.cat.padEnd(18)} ${sign}${d.delta.toFixed(2)}${RESET}` +
          `  ${DIM}(natural ${d.natural.toFixed(2)}, annotated ${d.annotated.toFixed(2)})${RESET}`
      )
    }
  }
  return diverged + errors + mirrorAsymmetric > 0 ? 1 : 0
}

function runSingleChart(chartFile: string): number {
  const chart = loadSSC(chartFile, {
    difficulty: values.difficulty as string | undefined,
  })
  console.log(
    `${chartFile} [${chart.difficulty}] — ${chart.notes.length} notes, ` +
      (chart.goldenCount
        ? `${chart.goldenCount} golden feet (#PARITYGOLDEN)` +
          (chart.overrideCount
            ? ` + ${chart.overrideCount} newer overrides overlaid`
            : "")
        : `${chart.overrideCount} manual foot annotations`)
  )
  for (const w of chart.warnings) console.log(`${YELLOW}warning: ${w}${RESET}`)

  if (values["write-golden"]) {
    if (bpmFactor !== 1) {
      // golden feet must be ground truth at the chart's real tempo
      console.error("--write-golden cannot be combined with --bpm-factor")
      return 2
    }
    // Snapshot #PARITYGOLDEN from the ANNOTATION-GUIDED run when overrides
    // exist (the engine constrained by the human marks — golden becomes the
    // target, and the remaining engine work is making the natural output
    // match it). Falls back to the natural run on unannotated charts, which
    // should only be done when the interpretation has been verified.
    const hasAnnotations = chart.goldenCount + chart.overrideCount > 0
    const run = runEngine(chart.notes, chart.lastBeat)
    const count = writeGolden(chartFile, chart.notes, run.labels)
    console.log(
      `${GREEN}wrote #PARITYGOLDEN for ${count} notes from the ` +
        `${hasAnnotations ? "annotation-guided" : "natural"} run${RESET}`
    )
    if (hasAnnotations) {
      console.log(
        `${DIM}review unannotated regions in SMEditor before treating this as fully golden${RESET}`
      )
    }
    return 0
  }

  if (chart.goldenCount === 0 && chart.overrideCount === 0) {
    console.log(
      "chart has no #PARITYGOLDEN or #PARITY overrides; annotate feet in SMEditor (parity edit mode) and save as .ssc"
    )
    return 2
  }
  const scaledNotes = scaleTempo(chart.notes, bpmFactor)
  if (bpmFactor !== 1) console.log(`${DIM}bpm ×${bpmFactor}${RESET}`)
  const cmp = compareAnnotated(scaledNotes, chart.lastBeat)
  printComparison(cmp, undefined, { edges: explain, reverse: reverseRows, facing: showFacing })
  if (cmp.identical && cmp.natural.nextBestDelta !== undefined) {
    console.log(
      `${DIM}next-best interpretation costs +${Math.max(0, cmp.natural.nextBestDelta).toFixed(2)}${RESET}`
    )
  }
  let mirrorsOk = true
  if (!noMirror) {
    const bad = chartMirrorChecks(
      scaledNotes,
      chart.lastBeat,
      cmp.natural
    ).filter(([, c]) => !c.ok)
    mirrorsOk = bad.length === 0
    if (mirrorsOk) {
      console.log(`${DIM}mirror invariance holds (lr, ud, lrud)${RESET}`)
    }
    for (const [label, c] of bad) {
      console.log(
        `${YELLOW}${label}-asymmetric — ${c.violations.length} violation${c.violations.length === 1 ? "" : "s"}:${RESET}`
      )
      for (const d of c.violations.slice(0, verbose ? Infinity : 8)) {
        console.log(`   ${YELLOW}${d}${RESET}`)
      }
      if (!verbose && c.violations.length > 8) {
        console.log(`   ${DIM}… ${c.violations.length - 8} more (-v for all)${RESET}`)
      }
    }
  }
  return cmp.identical && mirrorsOk ? 0 : 1
}

// Copy of the fixture's notes with every expected foot forced as a parity
// override, or undefined when the pattern has no foot expectations.
function forceExpectedFeet(parsed: ParsedFixture): FixtureNote[] | undefined {
  const overridden: FixtureNote[] = parsed.notedata.map(n => ({ ...n }))
  let count = 0
  for (const row of parsed.rows) {
    if (row.skip) continue
    for (let col = 0; col < 4; col++) {
      const want = row.feet[col]
      if (want !== "L" && want !== "R") continue
      const note = overridden.find(
        n => Math.abs(n.beat - row.beat) < 1e-6 && n.col === col
      )
      if (note) {
        note.parity = { override: want === "L" ? "Left" : "Right" }
        count++
      }
    }
  }
  return count === 0 ? undefined : overridden
}

// Force a fixture's expected feet as parity overrides, so the comparison
// explains WHY the engine deviates from the fixture's ground truth.
function explainFixture(parsed: ParsedFixture) {
  const overridden = forceExpectedFeet(parsed)
  if (overridden === undefined) {
    console.log(`   ${DIM}no expected feet to force${RESET}`)
    return
  }
  const cmp = compareAnnotated(overridden, parsed.lastBeat)
  printComparison(cmp, s => console.log("   " + s), { edges: true, reverse: reverseRows, facing: showFacing })
}

// Per-row table of a failing mirror run: the base run mapped into mirrored
// columns (what invariance predicts) against what the engine actually chose.
// With edges, each mismatched edge gets the same side-by-side cost breakdown
// a regular failing run gets under --explain: base (the reference), exp (the
// correct feet priced on the mirrored chart), mir (the engine's choice).
function printMirrorRun(name: string, check: MirrorCheck, edges: boolean) {
  console.log(
    `   ${YELLOW}${name} run — feet:exp is the base run mirrored; cost:exp prices those same feet on the mirrored chart (invariance says base = exp):${RESET}`
  )
  const totals = [
    `base path ${check.baseTotal.toFixed(2)}`,
    `mirrored engine chose ${check.mirroredTotal.toFixed(2)}`,
  ]
  if (check.expectedTotal !== undefined) {
    totals.push(
      `correct feet on mirrored chart ${check.expectedTotal.toFixed(2)}`
    )
  }
  if (check.mirAtBaseTotal !== undefined) {
    totals.push(
      `mirrored route on base chart ${check.mirAtBaseTotal.toFixed(2)}`
    )
  }
  console.log(`   ${DIM}${totals.join("  ·  ")}${RESET}`)
  if (check.mirAtBaseTotal !== undefined) {
    console.log(
      `   ${DIM}correct path prices symmetrically — the asymmetry is on the divergent route; mir@base reprices the mirrored engine's route on the base chart${RESET}`
    )
  }
  if (check.rows.length === 0) {
    for (const v of check.violations) console.log(`   ${YELLOW}${v}${RESET}`)
    return
  }
  console.log(
    `   ${DIM}${"row".padEnd(4)} ${"beat".padEnd(7)} ${"feet:exp".padEnd(9)} ${"feet:act".padEnd(9)} ${showFacing ? "fac:b→m→e".padEnd(10) + " " : ""}${"tech:base".padEnd(11)} ${"tech:mir".padEnd(11)} ${"cost:base→exp".padEnd(15)} err:base→mir${RESET}`
  )
  const rows = reverseRows ? [...check.rows].reverse() : check.rows
  const edgeDiffers = (a: Record<string, number>, b: Record<string, number>) => {
    const cats = new Set([...Object.keys(a), ...Object.keys(b)])
    cats.delete("TOTAL")
    return [...cats].some(c => Math.abs((a[c] ?? 0) - (b[c] ?? 0)) > 0.005)
  }
  for (const r of rows) {
    const mark = r.ok ? `${DIM}·${RESET}` : `${RED}✗${RESET}`
    const feetActCell = [...r.actualFeet]
      .map((ch, c) => (r.expectedFeet[c] !== ch ? `${RED}${ch}${RESET}` : ch))
      .join("")
    const techsBad = r.baseTechs.join(" ") !== r.mirroredTechs.join(" ")
    const techMir = r.mirroredTechs.join(" ") || (techsBad ? "-" : "")
    const techMirCell = techsBad ? `${RED}${techMir}${RESET}` : techMir
    // mirrored/priced facing painted red when it breaks the invariance
    // prediction (e = the run cost:exp actually prices)
    const facPlain = `${r.baseFacing}→${r.mirroredFacing}→${r.expectedRunFacing}`
    const paintFac = (f: string) =>
      f !== r.expectedFacing ? `${RED}${f}${RESET}` : f
    const facCell = `${r.baseFacing}→${paintFac(r.mirroredFacing)}→${paintFac(r.expectedRunFacing)}`
    const costEqual = Math.abs(r.baseCost - r.expectedCost) <= 0.005
    const cost = costEqual
      ? `${DIM}${r.baseCost.toFixed(2)}${RESET}${" ".repeat(Math.max(0, 15 - r.baseCost.toFixed(2).length))}`
      : `${RED}${`${r.baseCost.toFixed(2)}→${r.expectedCost.toFixed(2)}`.padEnd(15)}${RESET}`
    const picked =
      Math.abs(r.mirroredCost - r.expectedCost) > 0.005
        ? ` ${DIM}(picked ${r.mirroredCost.toFixed(2)})${RESET}`
        : ""
    const errsPlain =
      r.baseErrors.length || r.mirroredErrors.length
        ? `${r.baseErrors.join(" ") || "-"}→${r.mirroredErrors.join(" ") || "-"}`
        : ""
    const errsCell =
      r.baseErrors.join() !== r.mirroredErrors.join()
        ? `${RED}${errsPlain}${RESET}`
        : errsPlain
    console.log(
      ` ${mark} ${String(r.row).padEnd(4)} ${r.beat.toFixed(2).padEnd(7)} ` +
        `${r.expectedFeet.padEnd(9)} ${padColored(r.actualFeet, feetActCell, 9)} ` +
        `${showFacing ? padColored(facPlain, facCell, 10) + " " : ""}` +
        `${r.baseTechs.join(" ").padEnd(11)} ${padColored(techMir, techMirCell, 11)} ` +
        `${cost} ${errsCell}${picked}`
    )
    // cost:exp prices the forced run — if the engine refused an override,
    // that run stepped something other than feet:exp and the price is off
    if (r.expectedRunFeet !== r.expectedFeet) {
      console.log(
        `     ${YELLOW}priced run stepped ${r.expectedRunFeet}, not feet:exp — override not honored${RESET}`
      )
    }
    const showMirAtBase =
      r.mirAtBaseEdge !== undefined &&
      edgeDiffers(r.mirAtBaseEdge, r.mirroredEdge)
    if (!edges) {
      for (const d of r.costDiffs) {
        console.log(`     ${RED}${d}${RESET}`)
      }
      for (const d of r.mirCostDiffs ?? []) {
        console.log(`     ${RED}mir@base: ${d}${RESET}`)
      }
    } else if (
      r.costDiffs.length > 0 ||
      edgeDiffers(r.mirroredEdge, r.expectedEdge) ||
      showMirAtBase
    ) {
      console.log(`     ${DIM}${"base".padEnd(8)}${RESET} ${fmtEdgeSide(r.baseEdge)}`)
      console.log(`     ${DIM}${"exp".padEnd(8)}${RESET} ${fmtEdgeSide(r.expectedEdge)}`)
      console.log(`     ${DIM}${"mir".padEnd(8)}${RESET} ${fmtEdgeSide(r.mirroredEdge)}`)
      if (showMirAtBase) {
        console.log(
          `     ${DIM}${"mir@base".padEnd(8)}${RESET} ${fmtEdgeSide(r.mirAtBaseEdge!)}`
        )
      }
    }
  }
}

// ------------------------------------------------------------ fixture suite

// A filter matches by exact fixture name; * (any run) and ? (any char) turn
// it into a glob matched against the whole name.
function fixtureMatcher(q: string): (name: string) => boolean {
  if (!/[*?]/.test(q)) return name => name === q
  const re = new RegExp(
    "^" +
      q.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") +
      "$"
  )
  return name => re.test(name)
}

function runFixtures(): number {
  const matchers = filters.map(fixtureMatcher)
  const selected = FIXTURES.filter(
    f => filters.length === 0 || matchers.some(m => m(f.name))
  )

  if (selected.length === 0) {
    console.error(`No fixtures match: ${filters.join(", ")}`)
    return 2
  }

  let failures = 0
  let mirrorFailures = 0
  let udAsymmetries = 0
  let lrudAsymmetries = 0
  const summary: string[] = []

  // Per-fixture output is buffered and printed grouped by result:
  // passes first, then known issues, then partials, then failures/errors.
  const SECTIONS = ["PASS", "KNOWN", "PARTIAL", "FAIL"] as const
  type Section = (typeof SECTIONS)[number]
  const SECTION_LABELS: Record<Section, string> = {
    PASS: "passes",
    KNOWN: "known issues",
    PARTIAL: "partial",
    FAIL: "failures",
  }
  const grouped: Record<Section, string[]> = {
    PASS: [],
    KNOWN: [],
    PARTIAL: [],
    FAIL: [],
  }

  for (const fixture of selected) {
    let line: string
    let section: Section = "FAIL"
    const buffer: string[] = []
    const realLog = console.log
    console.log = (...args: unknown[]) => {
      buffer.push(args.map(String).join(" "))
    }
    try {
      // A multi-bpm fixture runs once per tempo but reports as a single entry;
      // the status line notes the tempo(s) that fail.
      const variants = expandBpms(fixture, bpmFactor)
      const multi = variants.length > 1

      if (doGen) {
        const songsRoot = path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          ".."
        )
        // one song per fixture, generated at the defined (first) tempo
        const dir = generateSong(parseFixture(variants[0]), songsRoot)
        console.log(`${DIM}wrote${RESET} ${dir}`)
      }

      const skipped: MirrorCheck = {
        ok: true,
        violations: [],
        tieBreaks: [],
        rows: [],
        baseTotal: 0,
        mirroredTotal: 0,
      }
      const results = variants.map(variant => {
        const parsed = parseFixture(variant)
        const run = runEngine(parsed.notedata, parsed.lastBeat)
        const report = evaluateFixture(parsed, run)
        // engine run with the expected feet forced, for the tech:ann column;
        // only computed when the per-row table can print (-v, or --explain
        // on a failing fixture — default mode prints no tables)
        const forced =
          verbose || (explain && report.problems > 0)
            ? forceExpectedFeet(parsed)
            : undefined
        const annRun = forced ? runEngine(forced, parsed.lastBeat) : undefined
        const mirror = noMirror ? skipped : checkMirror(parsed, run)
        // Front/back (D<->U) invariance is expected to hold at foot granularity
        // just like L/R — part-level heel/toe assignments necessarily flip.
        const udMirror = noMirror ? skipped : checkUDMirror(parsed, run)
        const lrudMirror = noMirror ? skipped : checkLRUDMirror(parsed, run)
        return {
          bpm: variant.bpm,
          parsed,
          run,
          annRun,
          report,
          mirror,
          udMirror,
          lrudMirror,
          pass: report.problems === 0,
          symmetric: mirror.ok && udMirror.ok && lrudMirror.ok,
        }
      })

      const pass = results.every(r => r.pass)
      const symmetric = results.every(r => r.symmetric)
      // feet fully correct but something secondary is off — tech-notation
      // expectations or a mirror invariant — reported as PARTIAL
      const notationOnly = !pass && results.every(r => r.report.footProblems === 0)
      const partial = notationOnly || (pass && !symmetric)
      const failedBpms = results
        .filter(r => !r.pass)
        .map(r => r.bpm)
        .sort((a, b) => a - b)
      // note failing tempos only when tempo actually discriminates: a fixture
      // that fails at every bpm carries no bpm tag
      const bpmTag =
        multi && failedBpms.length > 0 && failedBpms.length < results.length
          ? `  ${DIM}@${failedBpms.join(" @")}${RESET}`
          : ""
      const asymTag = (label: string, badBpms: number[]) =>
        badBpms.length === 0
          ? ""
          : `  ${YELLOW}${label}${
              multi && badBpms.length < results.length
                ? "@" + badBpms.sort((a, b) => a - b).join(",")
                : ""
            }${RESET}`
      const mirrorTag =
        asymTag("mirror-asymmetric", results.filter(r => !r.mirror.ok).map(r => r.bpm)) +
        asymTag("ud-mirror-asymmetric", results.filter(r => !r.udMirror.ok).map(r => r.bpm)) +
        asymTag("lrud-mirror-asymmetric", results.filter(r => !r.lrudMirror.ok).map(r => r.bpm))
      const known = fixture.knownIssue !== undefined
      if (!pass && !known) failures++
      if (results.some(r => !r.mirror.ok)) mirrorFailures++
      if (results.some(r => !r.udMirror.ok)) udAsymmetries++
      if (results.some(r => !r.lrudMirror.ok)) lrudAsymmetries++

      let status: string
      if (known && pass && symmetric) {
        status = `${YELLOW}FIXED?${RESET}` // passing but marked known-broken: update the fixture
        section = "KNOWN"
      } else if (known) {
        status = `${YELLOW}KNOWN${RESET}`
        section = "KNOWN"
      } else if (pass && symmetric) {
        status = `${GREEN}PASS${RESET}`
        section = "PASS"
      } else if (partial) {
        status = `${CYAN}PARTIAL${RESET}`
        section = "PARTIAL"
      } else {
        status = `${RED}FAIL${RESET}`
      }
      line = `${status}  ${fixture.name}${bpmTag}${mirrorTag}`
      console.log(line)
      if (known && pass && symmetric) {
        console.log(
          `   ${YELLOW}passes despite knownIssue — verify and remove the marker: ${fixture.knownIssue}${RESET}`
        )
      } else if (known) {
        if (!verbose) {
          console.log(`   ${DIM}${fixture.knownIssue}${RESET}`)
        }
      } else if (partial) {
        const reasons = []
        const notationProblems = results.reduce(
          (n, r) => n + r.report.notationProblems,
          0
        )
        if (notationProblems > 0) {
          reasons.push(
            `${notationProblems} tech-notation problem${notationProblems === 1 ? "" : "s"}`
          )
        }
        if (!symmetric) reasons.push("mirror asymmetry")
        console.log(`   ${DIM}feet match; ${reasons.join("; ")}${RESET}`)
      }

      for (const r of results) {
        // Default mode stays at one status line per fixture (the bpm tag
        // already names the failing tempos); per-row tables and mirror
        // detail need -v or --explain. Engine errors always surface.
        const show =
          verbose || (explain && ((!r.pass && !known) || !r.symmetric))
        if (!show) {
          if (r.report.error && !known) {
            if (multi) console.log(`   ${DIM}@${r.bpm}:${RESET}`)
            console.log(`   ${RED}${r.report.error}${RESET}`)
          }
          continue
        }
        if (multi) console.log(`   ${DIM}@${r.bpm}:${RESET}`)
        if (r.report.error) {
          console.log(`   ${RED}${r.report.error}${RESET}`)
        }
        if (!r.pass || verbose) {
          console.log(
            `   ${DIM}${"row".padEnd(4)} ${"beat".padEnd(7)} ${"cols".padEnd(5)} ${"feet:exp".padEnd(9)} ${"feet:act".padEnd(9)} ${showFacing ? "fac".padEnd(4) + " " : ""}${"tech:exp".padEnd(10)} ${"tech:act".padEnd(10)} ${"tech:ann".padEnd(10)} ${"cost".padEnd(8)} err${RESET}`
          )
          const rowEntries = [...r.report.rows.entries()]
          if (reverseRows) rowEntries.reverse()
          for (const [i, row] of rowEntries) {
            const exp = row.expectation
            const mark = row.problems.length ? `${RED}✗${RESET}` : `${DIM}·${RESET}`
            const cost = r.run.edgeCosts[i]?.["TOTAL"] ?? 0
            const beat = exp.beat.toFixed(2)
            const beatCell = row.badBeat ? `${RED}${beat}${RESET}` : beat
            const feetAct = fmtFeet(row.actual.feet)
            const feetActCell = [...feetAct]
              .map((ch, col) =>
                row.badCols.includes(col) ? `${RED}${ch}${RESET}` : ch
              )
              .join("")
            // a tech mismatch with no actual techs still needs something to
            // paint red, or the mismatch is invisible in the row
            const techAct =
              row.actual.techs.join(" ") || (row.badTechs ? "-" : "")
            const techActCell = row.badTechs ? `${RED}${techAct}${RESET}` : techAct
            const techAnn = (r.annRun ?? r.run).rows[i]?.techs.join(" ") ?? ""
            console.log(
              ` ${mark} ${String(i).padEnd(4)} ${padColored(beat, beatCell, 7)} ${exp.chars.padEnd(5)} ` +
                `${fmtFeet(exp.feet).padEnd(9)} ${padColored(feetAct, feetActCell, 9)} ` +
                `${showFacing ? (r.run.facings[i] ?? "?").padEnd(4) + " " : ""}` +
                `${fmtExpectation(exp).padEnd(10)} ${padColored(techAct, techActCell, 10)} ` +
                `${techAnn.padEnd(10)} ` +
                `${cost.toFixed(2).padEnd(8)} ${row.actual.errors.join(" ")}`
            )
          }
        }
        // per-beat violation lines are omitted here: the per-row tables below
        // show every mismatch with highlights
        if (!r.mirror.ok) printMirrorRun("mirror", r.mirror, explain)
        if (!r.udMirror.ok) printMirrorRun("ud-mirror", r.udMirror, explain)
        if (!r.lrudMirror.ok) printMirrorRun("lrud-mirror", r.lrudMirror, explain)
        if (verbose) {
          for (const d of r.mirror.tieBreaks.slice(0, 8)) {
            console.log(`   ${DIM}mirror tie-break: ${d}${RESET}`)
          }
        }
        console.log()
      }
      if (explain) {
        for (const r of results) {
          if (r.pass) continue
          if (multi) console.log(`   ${DIM}@${r.bpm}:${RESET}`)
          explainFixture(r.parsed)
          console.log()
        }
      }
      summary.push(
        `${section}${results.some(r => !r.mirror.ok) ? " (mirror!)" : ""}  ${fixture.name}`
      )
    } catch (err) {
      failures++
      section = "FAIL"
      console.log(`${RED}ERROR${RESET} ${fixture.name}: ${(err as Error).stack}`)
      summary.push(`ERROR ${fixture.name}`)
    } finally {
      console.log = realLog
    }
    grouped[section].push(buffer.join("\n"))
  }

  if (bpmFactor !== 1) console.log(`${DIM}bpm ×${bpmFactor}${RESET}`)
  for (const s of SECTIONS) {
    if (grouped[s].length === 0) continue
    console.log(`${DIM}${`── ${SECTION_LABELS[s]} `.padEnd(60, "─")}${RESET}`)
    for (const block of grouped[s]) console.log(block)
    console.log()
  }

  console.log("─".repeat(60))
  const knownCount = summary.filter(s => s.startsWith("KNOWN")).length
  const partialCount = summary.filter(s => s.startsWith("PARTIAL")).length
  // "invariance holds" is only claimed when every mirror check ran and
  // passed; otherwise each asymmetric mirror type is listed with its count
  const asymParts = [
    [mirrorFailures, "lr"],
    [udAsymmetries, "ud"],
    [lrudAsymmetries, "lrud"],
  ]
    .filter(([n]) => n)
    .map(([n, label]) => `${YELLOW}${n} ${label}-mirror-asymmetric${RESET}`)
  const mirrorSummary = noMirror
    ? `, ${DIM}mirror checks skipped${RESET}`
    : asymParts.length
      ? `, ${asymParts.join(", ")}`
      : ", mirror invariance holds (lr, ud, lrud)"
  console.log(
    `${summary.filter(s => s.startsWith("PASS")).length}/${selected.length} fixtures pass` +
      (partialCount
        ? `, ${CYAN}${partialCount} partial (feet ok; notation or symmetry differs)${RESET}`
        : "") +
      (knownCount ? `, ${knownCount} known issues` : "") +
      (failures ? `, ${RED}${failures} unexpected failures${RESET}` : "") +
      mirrorSummary
  )
  if (
    !verbose &&
    !explain &&
    (failures || partialCount || mirrorFailures || udAsymmetries || lrudAsymmetries)
  ) {
    console.log(`${DIM}(-v or --explain for per-row detail)${RESET}`)
  }
  return failures > 0 ? 1 : 0
}

// --------------------------------------------------------------- dispatcher
// In a combined run the sweep's worker pool starts before the fixture suite,
// so chart analysis proceeds on worker threads while the (synchronous)
// fixture loop occupies the main thread. Pool results only render once the
// promise is awaited — the fixture loop never yields to the event loop — so
// chart output always lands after the fixture report. -j1 has no pool; the
// sweep runs inline after fixtures instead.
let sweepEarly: Promise<number> | undefined
if (chartTarget !== undefined && chartIsDir && jobs > 1) {
  sweepEarly = runChartSweep(chartTarget)
}

const fixtureCode = wantFixtures ? runFixtures() : 0

let chartCode = 0
if (chartTarget !== undefined) {
  if (wantFixtures) {
    console.log()
    console.log(`${DIM}${"── charts ".padEnd(60, "─")}${RESET}`)
  }
  chartCode = chartIsDir
    ? await (sweepEarly ?? runChartSweep(chartTarget))
    : runSingleChart(chartTarget)
}

process.exit(Math.max(fixtureCode, chartCode))
