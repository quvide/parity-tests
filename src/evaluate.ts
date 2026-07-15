import { ParsedFixture, RowExpectation } from "./dsl"
import { EngineRow, EngineRun } from "./engine"

export interface RowReport {
  expectation: RowExpectation
  actual: EngineRow
  problems: string[]
}

export interface FixtureReport {
  name: string
  rows: RowReport[]
  problems: number
  /** structural failures: wrong feet, beat mismatches — the parity itself */
  footProblems: number
  /** annotation failures: tech tags / tech errors — the notation layer */
  notationProblems: number
  /** harness-level failure (row mismatch etc.), distinct from expectation failures */
  error?: string
}

export function evaluateFixture(
  parsed: ParsedFixture,
  run: EngineRun
): FixtureReport {
  const report: FixtureReport = {
    name: parsed.fixture.name,
    rows: [],
    problems: 0,
    footProblems: 0,
    notationProblems: 0,
  }

  if (run.rows.length !== parsed.rows.length) {
    report.error = `engine produced ${run.rows.length} rows, fixture expects ${parsed.rows.length}`
    report.problems++
    report.footProblems++
    return report
  }

  for (let i = 0; i < parsed.rows.length; i++) {
    const exp = parsed.rows[i]
    const act = run.rows[i]
    const problems: string[] = []
    // notation problems (tech tags / tech errors) are counted separately from
    // foot problems so the runner can report feet-correct fixtures as PARTIAL
    let footProblems = 0

    if (Math.abs(exp.beat - act.beat) > 1e-6) {
      problems.push(`row beat mismatch: expected ${exp.beat}, got ${act.beat}`)
      footProblems++
    } else if (!exp.skip) {
      for (let col = 0; col < 4; col++) {
        const want = exp.feet[col]
        if (want === undefined || want === null) continue
        if (act.feet[col] !== want) {
          problems.push(
            `col ${col}: expected ${want} foot, got ${act.feet[col] ?? "-"}`
          )
          footProblems++
        }
      }
      const wantTechs = [...exp.expectedTechs].sort().join(" ")
      const gotTechs = [...act.techs].sort().join(" ")
      if (wantTechs !== gotTechs) {
        problems.push(
          `techs: expected [${wantTechs || "none"}], got [${gotTechs || "none"}]`
        )
      }
    }

    report.rows.push({ expectation: exp, actual: act, problems })
    report.problems += problems.length
    report.footProblems += footProblems
    report.notationProblems += problems.length - footProblems
  }
  return report
}
