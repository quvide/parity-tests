// Print the best-path states + techs for a fixture, row by row.
//   npx tsx src/debug-states.ts <fixture-name>
import "./shim"
import { ParityInternals } from "../../smeditor/app/src/chart/stats/parity/ParityInternals"
import {
  FEET_LABELS,
  TECH_STRINGS,
} from "../../smeditor/app/src/chart/stats/parity/ParityDataTypes"
import type { Notedata } from "../../smeditor/app/src/chart/sm/NoteTypes"
import { expandBpms, parseFixture } from "./dsl"
import { FIXTURES } from "./fixtures/index"

// `<fixture-name>@<bpm>` picks a tempo of a multi-bpm fixture (default: first)
const [name, bpmArg] = process.argv[2].split("@")
const fixture = FIXTURES.find(f => f.name === name)
if (!fixture) throw new Error(`no fixture ${name}`)
const variants = expandBpms(fixture)
const variant = bpmArg
  ? variants.find(v => v.bpm === Number(bpmArg))
  : variants[0]
if (!variant) throw new Error(`no ${bpmArg}bpm variant of ${name}`)
const parsed = parseFixture(variant)
const internals = new ParityInternals("dance-single")
const result = internals.compute(-1, parsed.lastBeat + 4, parsed.notedata as Notedata)!

internals.notedataRows.forEach((row, i) => {
  const state = result.states[i + 1]
  const techs = result.techRows[i]
  const fmt = (arr: number[]) => arr.map(f => FEET_LABELS[f] ?? ".").join("")
  console.log(
    `row ${i} beat ${row.beat.toFixed(2)}  action=${fmt(state.action)} ` +
      `combined=${fmt(state.combinedColumns)} ` +
      `moved={${[...state.movedFeet].map(f => FEET_LABELS[f]).join(",")}} ` +
      `holdFeet={${[...state.holdFeet].map(f => FEET_LABELS[f]).join(",")}} ` +
      `holds=[${row.holds.map((h, c) => (h ? c : "")).join("")}] ` +
      `techs=${techs ? [...techs].map(t => TECH_STRINGS[t]).join(",") : "-"}`
  )
})
