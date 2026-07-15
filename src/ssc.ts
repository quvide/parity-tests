// Minimal .ssc loader for the parity harness: notes, BPMS/STOPS/DELAYS/WARPS
// timing, and SMEditor's #PARITY manual foot annotations. Not a general
// simfile parser -- just enough to feed the engine the same (beat, second,
// col, type) rows SMEditor would.

import * as fs from "node:fs"
import * as nodePath from "node:path"
import { FixtureNote } from "./dsl"

export interface LoadedChart {
  title: string
  chartName: string
  difficulty: string
  stepsType: string
  notes: FixtureNote[]
  /** number of notes carrying a manual parity override */
  overrideCount: number
  /** number of notes with #PARITYGOLDEN feet (applied as overrides) */
  goldenCount: number
  lastBeat: number
  warnings: string[]
}

interface TimingPoint {
  beat: number
  bpm: number
}

class Timing {
  private bpms: TimingPoint[]
  private stops: [number, number][]
  private warps: [number, number][] // beat, lengthBeats
  private offset: number

  constructor(
    bpms: TimingPoint[],
    stops: [number, number][],
    warps: [number, number][],
    offset: number
  ) {
    this.bpms = bpms.length ? bpms : [{ beat: 0, bpm: 120 }]
    this.stops = stops.sort((a, b) => a[0] - b[0])
    this.warps = warps.sort((a, b) => a[0] - b[0])
    this.offset = offset
  }

  /** true if the beat is inside a warped (skipped) region */
  isWarped(beat: number): boolean {
    return this.warps.some(([start, len]) => beat >= start && beat < start + len)
  }

  secondsAt(beat: number): number {
    // integrate 60/bpm over [0, beat], skipping warped spans; stops add flat time
    let seconds = -this.offset
    let cursor = 0
    const points = this.bpms.filter(p => p.beat < beat)
    for (let i = 0; i < points.length; i++) {
      const end = i + 1 < points.length ? Math.min(points[i + 1].beat, beat) : beat
      seconds += this.spanSeconds(cursor, end, points[i].bpm)
      cursor = end
    }
    for (const [stopBeat, stopLen] of this.stops) {
      // a note exactly at the stop's beat plays before the stop elapses
      if (stopBeat < beat && !this.isWarped(stopBeat)) seconds += stopLen
    }
    return seconds
  }

  private spanSeconds(from: number, to: number, bpm: number): number {
    let beats = to - from
    for (const [start, len] of this.warps) {
      const overlap = Math.min(to, start + len) - Math.max(from, start)
      if (overlap > 0) beats -= overlap
    }
    return (beats * 60) / bpm
  }
}

function parseMSD(content: string): { key: string; value: string }[] {
  const props: { key: string; value: string }[] = []
  // strip // comments
  content = content.replace(/\/\/[^\n]*/g, "")
  const re = /#([^:;]+):([^;]*);/g
  let m
  while ((m = re.exec(content)) !== null) {
    props.push({ key: m[1].trim().toUpperCase(), value: m[2].trim() })
  }
  return props
}

function parsePairs(value: string): [number, number][] {
  return value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [a, b] = s.split("=")
      return [parseFloat(a), parseFloat(b)] as [number, number]
    })
    .filter(([a, b]) => isFinite(a) && isFinite(b))
}

function quantize(beat: number): number {
  for (const q of [4, 8, 12, 16, 24, 32, 48, 64, 96, 192]) {
    if (Math.abs(Math.round((beat * q) / 4) - (beat * q) / 4) < 1e-6) return q
  }
  return 192
}

export function loadSSC(
  path: string,
  opts: { difficulty?: string; stepsType?: string } = {}
): LoadedChart {
  const content = fs.readFileSync(path, "utf8")
  const props = parseMSD(content)
  const warnings: string[] = []

  // header = props before the first NOTEDATA; charts split on NOTEDATA
  const header: Record<string, string> = {}
  const charts: Record<string, string>[] = []
  let current: Record<string, string> | null = null
  for (const { key, value } of props) {
    if (key === "NOTEDATA") {
      current = {}
      charts.push(current)
      continue
    }
    if (current) {
      if (!(key in current)) current[key] = value
    } else if (!(key in header)) {
      header[key] = value
    }
  }
  if (charts.length === 0) throw new Error(`${path}: no #NOTEDATA sections (only .ssc supported)`)

  const stepsType = opts.stepsType ?? "dance-single"
  const candidates = charts.filter(c => c["STEPSTYPE"] === stepsType)
  if (candidates.length === 0) {
    throw new Error(
      `${path}: no ${stepsType} charts (found: ${charts.map(c => c["STEPSTYPE"]).join(", ")})`
    )
  }
  let chart = candidates[0]
  if (opts.difficulty) {
    const byDiff = candidates.find(
      c => c["DIFFICULTY"]?.toLowerCase() === opts.difficulty!.toLowerCase()
    )
    if (!byDiff) {
      throw new Error(
        `${path}: no ${opts.difficulty} chart (available: ${candidates.map(c => c["DIFFICULTY"]).join(", ")})`
      )
    }
    chart = byDiff
  } else if (candidates.length > 1) {
    warnings.push(
      `multiple ${stepsType} charts; using ${chart["DIFFICULTY"]} (pass --difficulty to select: ${candidates.map(c => c["DIFFICULTY"]).join(", ")})`
    )
  }

  // charts can override header timing in ssc; prefer chart-level values
  const timingVal = (key: string) => chart[key] ?? header[key] ?? ""
  const bpms = parsePairs(timingVal("BPMS")).map(([beat, bpm]) => ({ beat, bpm }))
  if (bpms.some(p => p.bpm <= 0)) warnings.push("negative/zero BPMs not supported; seconds may be wrong")
  const stops = parsePairs(timingVal("STOPS"))
  const delays = parsePairs(timingVal("DELAYS"))
  if (delays.length) {
    warnings.push("DELAYS treated as STOPS (close enough for parity elapsed times)")
    stops.push(...delays)
  }
  const warps = parsePairs(timingVal("WARPS"))
  const offset = parseFloat(header["OFFSET"] ?? "0") || 0
  const timing = new Timing(bpms, stops, warps, offset)

  const fakes = parsePairs(timingVal("FAKES"))
  const isFakeSegment = (beat: number) =>
    fakes.some(([start, len]) => beat >= start && beat < start + len)

  // notes
  const measures = (chart["NOTES"] ?? "").split(",").map(m =>
    m
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0)
  )
  const notes: FixtureNote[] = []
  const pendingHolds: ({ note: FixtureNote; beat: number } | null)[] = []
  for (let mi = 0; mi < measures.length; mi++) {
    const lines = measures[mi]
    for (let li = 0; li < lines.length; li++) {
      const beat = mi * 4 + (li / lines.length) * 4
      const line = lines[li]
      for (let col = 0; col < line.length; col++) {
        const c = line[col]
        if (c === "0") continue
        if (c === "3") {
          const pending = pendingHolds[col]
          if (!pending) {
            warnings.push(`hold tail without head at beat ${beat} col ${col}`)
            continue
          }
          pending.note.hold = beat - pending.beat
          pendingHolds[col] = null
          continue
        }
        const type =
          c === "1"
            ? "Tap"
            : c === "2"
              ? "Hold"
              : c === "4"
                ? "Roll"
                : c === "M"
                  ? "Mine"
                  : c === "F"
                    ? "Fake"
                    : c === "L"
                      ? "Lift"
                      : null
        if (type === null) continue // K (keysound) etc.
        const note: FixtureNote = {
          beat,
          col,
          type,
          second: timing.secondsAt(beat),
          warped: timing.isWarped(beat),
          fake: type === "Fake" || isFakeSegment(beat),
          quant: quantize(beat),
        }
        if (type === "Hold" || type === "Roll") {
          pendingHolds[col] = { note, beat }
        }
        notes.push(note)
      }
    }
  }
  for (let col = 0; col < pendingHolds.length; col++) {
    if (pendingHolds[col]) warnings.push(`unclosed hold in col ${col}`)
  }
  notes.sort((a, b) => a.beat - b.beat || a.col - b.col)

  // Manual parity annotations. Two sources, matching SMEditor's save paths:
  // - inline #PARITY property (written only in smebak autosave backups)
  // - data.sme sidecar next to the simfile (normal .ssc saves keep the chart
  //   file vanilla and store editor data here: {parity: {gameType: [perChart]}})
  const applyOverrides = (entries: unknown[], source: string): number => {
    let count = 0
    for (const entry of entries) {
      const [beat, col, override] = entry as [number, number, unknown]
      const value =
        typeof override === "number"
          ? override
          : /^[1-4]$/.test(String(override))
            ? parseInt(String(override))
            : String(override)
      if (
        value !== "Left" &&
        value !== "Right" &&
        !(typeof value === "number" && value >= 1 && value <= 4)
      ) {
        warnings.push(`${source} override at beat ${beat}: bad value ${override}`)
        continue
      }
      const foot = value as "Left" | "Right" | number
      const note = notes.find(
        n => Math.abs(n.beat - beat) < 1 / 96 && n.col === col
      )
      if (note) {
        note.parity = { ...note.parity, override: foot }
        count++
        continue
      }
      // No note here: a mid-hold takeover annotation (SMEditor stores these
      // as override entries whose beat falls inside a hold body).
      const hold = notes.find(
        n =>
          n.col === col &&
          n.hold !== undefined &&
          n.beat < beat &&
          n.beat + n.hold >= beat - 1 / 96
      )
      if (hold) {
        hold.parity ??= {}
        const list = (hold.parity.holdOverrides ??= [])
        list.push({ beat, foot })
        list.sort((a, b) => a.beat - b.beat)
        count++
        continue
      }
      warnings.push(
        `${source} override at beat ${beat} col ${col}: no note or hold found`
      )
    }
    return count
  }

  // Golden parity: one FEET_LABELS char (L l R r / .) per non-mine note in
  // notedata order — the complete verified assignment for golden charts.
  // Applied as part-level overrides; takes precedence over sparse overrides.
  let goldenCount = 0
  if (chart["PARITYGOLDEN"]) {
    const chars = chart["PARITYGOLDEN"].trim()
    const GOLDEN_FEET: Record<string, number> = { L: 1, l: 2, R: 3, r: 4 }
    let idx = 0
    for (const note of notes) {
      if (note.type === "Mine") continue
      const c = chars[idx++]
      if (c === undefined) {
        warnings.push("#PARITYGOLDEN shorter than notedata; truncated")
        break
      }
      if (GOLDEN_FEET[c] !== undefined) {
        // preserve holdOverrides: golden encodes per-note feet only, not
        // mid-hold takeovers
        note.parity = { ...note.parity, override: GOLDEN_FEET[c] }
        goldenCount++
      }
    }
    if (idx < chars.length) {
      warnings.push("#PARITYGOLDEN longer than notedata; chart may have changed since it was saved")
    }
  }

  // Sparse manual overrides overlay golden (they are the newer human input);
  // re-running --write-golden bakes them into a refreshed #PARITYGOLDEN.
  let overrideCount = 0
  if (chart["PARITY"]) {
    try {
      const data = JSON.parse(chart["PARITY"])
      overrideCount += applyOverrides(data.overrides ?? [], "#PARITY")
    } catch (e) {
      warnings.push(`failed to parse #PARITY: ${e}`)
    }
  }
  if (overrideCount === 0) {
    const smePath = nodePath.join(nodePath.dirname(path), "data.sme")
    if (fs.existsSync(smePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(smePath, "utf8"))
        const chartIdx = candidates.indexOf(chart)
        const perChart = data.parity?.[stepsType]?.[chartIdx]
        if (perChart) {
          overrideCount += applyOverrides(perChart.overrides ?? [], "data.sme")
        } else {
          warnings.push(
            `data.sme found but has no parity entry for ${stepsType} chart #${chartIdx}`
          )
        }
      } catch (e) {
        warnings.push(`failed to parse data.sme: ${e}`)
      }
    }
  }

  const lastBeat = Math.max(0, ...notes.map(n => n.beat + (n.hold ?? 0)))

  return {
    title: header["TITLE"] ?? path,
    chartName: chart["CHARTNAME"] ?? "",
    difficulty: chart["DIFFICULTY"] ?? "?",
    stepsType,
    notes,
    overrideCount,
    goldenCount,
    lastBeat,
    warnings,
  }
}

/**
 * Writes/replaces #PARITYGOLDEN in an .ssc from an engine run's labels.
 * Single-chart files only (property placement is per-NOTEDATA section).
 */
export function writeGolden(
  path: string,
  notes: FixtureNote[],
  feet: Map<string, number>
): number {
  let content = fs.readFileSync(path, "utf8")
  if ((content.match(/#NOTEDATA/g) ?? []).length > 1) {
    throw new Error("writeGolden supports single-chart files only")
  }
  const LABELS = [".", "L", "l", "R", "r"]
  let golden = ""
  let count = 0
  for (const note of notes) {
    if (note.type === "Mine") continue
    const foot = feet.get(note.beat.toFixed(3) + "-" + note.col)
    if (foot !== undefined && foot > 0) {
      golden += LABELS[foot]
      count++
    } else {
      golden += "."
    }
  }
  content = content.replace(/#PARITYGOLDEN:[^;]*;\n?/g, "")
  content = content.replace("#NOTES:", `#PARITYGOLDEN:${golden};\n#NOTES:`)
  fs.writeFileSync(path, content)
  return count
}
