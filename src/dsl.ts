// Fixture DSL: a chart pattern is a multi-line string, one line per grid row.
//
//   <4 column chars>  [ | <expectation tokens> ]   [ // comment ]
//
// Column chars (position = panel: 0=Left 1=Down 2=Up 3=Right; letter = EXPECTED FOOT):
//   .  0   empty
//   1      tap, no foot expectation
//   L  R   tap, expected left/right foot
//   2      hold head, no foot expectation
//   l  r   hold head, expected left/right foot
//   _      hold tail (ends the hold started above in the same column)
//   M      mine
//
// CAUTION: case here means tap-vs-hold, NOT heel-vs-toe. This differs from
// SMEditor's debug node graph and override UI, where FEET_LABELS uses
// L/R = heel and l/r = toe (".R.r" in the graph = right heel D + right toe R).
// Fixture expectations are foot-granularity only; the evaluator collapses the
// engine's heel/toe answer to L/R, so bracket orientation is never asserted.
//
// Expectation tokens (only on lines that contain at least one tap/hold head):
//   FS XO SS JA BR DS HS JU BT SJ KS   row's tech annotations must equal
//                          EXACTLY the set of listed techs (order-insensitive)
//   *                      skip all checks for this row
//
// A note line with no `|` section asserts: no tech annotations (the empty
// case of the exact-match rule, not a separate mode).
//
// Tech ERRORS (the engine's chart-lint warnings: Ambiguous, UnmarkedDoublestep,
// MissedFootswitch) are not asserted; the runner shows them for information
// only, and mirror invariance still requires them to be symmetric.

export interface Fixture {
  name: string
  description?: string
  /**
   * A single bpm is auto-tested at -50/-25/+25/+50 offsets as well; an
   * explicit array runs exactly the listed tempos. Failing tempos are noted
   * on the fixture's single report entry.
   */
  bpm: number | number[]
  /** lines per measure, SM convention: 8 = 8th notes, 16 = 16th notes */
  subdivision: number
  pattern: string
  /**
   * Set when the fixture intentionally tracks an open engine finding.
   * A failing known-issue fixture doesn't fail the suite; a PASSING one is
   * reported so the marker can be removed.
   */
  knownIssue?: string
}

/**
 * Shape of a per-file fixture module's default export: the fixture minus its
 * name, which the loader derives from the filename.
 */
export type FixtureDef = Omit<Fixture, "name">

/** A runnable fixture variant: bpm resolved to a single tempo. */
export type ResolvedFixture = Fixture & { bpm: number }

/**
 * A single defined bpm is auto-swept at these offsets. The defined tempo
 * comes first so callers that want one canonical variant (song generation,
 * debug default) can take the first element.
 */
const BPM_SWEEP_OFFSETS = [0, -50, -25, 25, 50]

/**
 * Expand a fixture into one runnable variant per tempo (names unchanged).
 * An explicit bpm array is used as-is; a single bpm is swept across
 * BPM_SWEEP_OFFSETS. The factor scales the DEFINED tempo(s) before sweep
 * offsets are applied, so the sweep keeps probing the same absolute
 * time-gate distances around the scaled tempo.
 */
export function expandBpms(fixture: Fixture, bpmFactor = 1): ResolvedFixture[] {
  const { bpm } = fixture
  const bpms = Array.isArray(bpm)
    ? bpm.map(b => b * bpmFactor)
    : BPM_SWEEP_OFFSETS.map(o => bpm * bpmFactor + o).filter(b => b > 0)
  return bpms.map(b => ({ ...fixture, bpm: b }))
}

export type ExpectedFoot = "L" | "R" | null

export interface RowExpectation {
  lineIndex: number
  beat: number
  /** raw 4 chars, for display */
  chars: string
  /** per column; null = note present but no expectation, undefined = no note */
  feet: (ExpectedFoot | undefined)[]
  /** the row's tech annotations must equal exactly this set */
  expectedTechs: string[]
  skip: boolean
}

// Matches the shape of SMEditor's NotedataEntry closely enough for the engine.
export interface FixtureNote {
  beat: number
  col: number
  type: "Tap" | "Hold" | "Roll" | "Mine" | "Fake" | "Lift"
  hold?: number
  second: number
  warped: boolean
  fake: boolean
  quant: number
  /** manual foot annotation, as SMEditor's #PARITY overrides */
  parity?: {
    override?: "Left" | "Right" | number
    /** mid-hold takeover annotations: covering foot from each beat onward */
    holdOverrides?: { beat: number; foot: "Left" | "Right" | number }[]
  }
}

export interface ParsedFixture {
  fixture: ResolvedFixture
  /** grid lines, 4 chars each (including empty/mine-only lines) */
  lines: string[]
  notedata: FixtureNote[]
  /** expectations for lines that create engine rows, in row order */
  rows: RowExpectation[]
  lastBeat: number
}

const TECHS = new Set([
  "XO",
  "FS",
  "SS",
  "JA",
  "BR",
  "DS",
  "HS",
  "JU",
  "BT",
  "SJ",
  "KS",
])
const COL_CHARS = /^[.012_LRlrM]{4}$/

function quantize(beat: number): number {
  for (const q of [4, 8, 12, 16, 24, 32, 48, 64, 96, 192]) {
    if (Math.abs(Math.round((beat * q) / 4) - (beat * q) / 4) < 1e-6) return q
  }
  return 192
}

export function parseFixture(fixture: ResolvedFixture): ParsedFixture {
  const beatsPerLine = 4 / fixture.subdivision
  const secondsPerBeat = 60 / fixture.bpm

  const lines: string[] = []
  const rows: RowExpectation[] = []
  const notedata: FixtureNote[] = []
  // col -> line index of pending hold head
  const pendingHolds: (number | null)[] = [null, null, null, null]
  // deferred hold notes so we can fill in length when the tail appears
  const holdNotes: (FixtureNote | null)[] = [null, null, null, null]

  const rawLines = fixture.pattern.split("\n")
  for (const raw of rawLines) {
    let text = raw.replace(/\/\/.*$/, "").trim()
    if (text === "") continue

    let expectation: string | null = null
    const pipe = text.indexOf("|")
    if (pipe !== -1) {
      expectation = text.slice(pipe + 1).trim()
      text = text.slice(0, pipe).trim()
    }
    if (!COL_CHARS.test(text)) {
      throw new Error(`${fixture.name}: bad column chars "${text}"`)
    }

    const lineIndex = lines.length
    lines.push(text)
    const beat = lineIndex * beatsPerLine
    const second = beat * secondsPerBeat

    const feet: (ExpectedFoot | undefined)[] = [
      undefined,
      undefined,
      undefined,
      undefined,
    ]
    let hasNote = false

    for (let col = 0; col < 4; col++) {
      const c = text[col]
      if (c === "." || c === "0") continue
      if (c === "M") {
        notedata.push({
          beat,
          col,
          type: "Mine",
          second,
          warped: false,
          fake: false,
          quant: quantize(beat),
        })
        continue
      }
      if (c === "_") {
        const headLine = pendingHolds[col]
        if (headLine === null) {
          throw new Error(
            `${fixture.name}: hold tail without head at line ${lineIndex}, col ${col}`
          )
        }
        holdNotes[col]!.hold = (lineIndex - headLine) * beatsPerLine
        pendingHolds[col] = null
        holdNotes[col] = null
        continue
      }
      hasNote = true
      const foot: ExpectedFoot =
        c === "L" || c === "l" ? "L" : c === "R" || c === "r" ? "R" : null
      feet[col] = foot
      const isHold = c === "2" || c === "l" || c === "r"
      const note: FixtureNote = {
        beat,
        col,
        type: isHold ? "Hold" : "Tap",
        second,
        warped: false,
        fake: false,
        quant: quantize(beat),
      }
      if (isHold) {
        if (pendingHolds[col] !== null) {
          throw new Error(
            `${fixture.name}: nested hold at line ${lineIndex}, col ${col}`
          )
        }
        pendingHolds[col] = lineIndex
        holdNotes[col] = note
      }
      notedata.push(note)
    }

    if (!hasNote) {
      if (expectation) {
        throw new Error(
          `${fixture.name}: expectations on a line without notes (line ${lineIndex})`
        )
      }
      continue
    }

    const row: RowExpectation = {
      lineIndex,
      beat,
      chars: text,
      feet,
      expectedTechs: [],
      skip: false,
    }
    if (expectation) {
      for (const token of expectation.split(/\s+/).filter(Boolean)) {
        if (token === "*") {
          row.skip = true
        } else if (TECHS.has(token)) {
          row.expectedTechs.push(token)
        } else {
          throw new Error(
            `${fixture.name}: unknown expectation token "${token}" (line ${lineIndex})`
          )
        }
      }
    }
    rows.push(row)
  }

  for (let col = 0; col < 4; col++) {
    if (pendingHolds[col] !== null) {
      throw new Error(`${fixture.name}: hold in col ${col} never closed`)
    }
  }

  notedata.sort((a, b) => a.beat - b.beat || a.col - b.col)
  const lastBeat = Math.max(
    0,
    ...notedata.map(n => n.beat + (n.hold ?? 0))
  )

  return { fixture, lines, notedata, rows, lastBeat }
}
