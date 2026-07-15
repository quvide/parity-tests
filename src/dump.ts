// Dump a beat range of a chart as DSL-ish rows, with the engine's natural
// interpretation and any manual annotations. Fixture-extraction helper.
//   npx tsx src/dump.ts <chart.ssc> <startBeat> <endBeat> [difficulty]
import { loadSSC } from "./ssc"
import { runEngine } from "./engine"

const [file, startArg, endArg, difficulty] = process.argv.slice(2)
const start = parseFloat(startArg)
const end = parseFloat(endArg)
const chart = loadSSC(file, { difficulty })
const natural = chart.notes.map(n => {
  if (!n.parity) return n
  const { parity, ...rest } = n
  return rest as typeof n
})
const run = runEngine(natural, chart.lastBeat)
const annotated = runEngine(chart.notes, chart.lastBeat)

const inRange = chart.notes.filter(n => n.beat >= start && n.beat <= end)
const beats = [...new Set(inRange.map(n => n.beat))].sort((a, b) => a - b)

console.log(`beats ${start}-${end}, 4ths per row shown as beat`)
for (const beat of beats) {
  const rowNotes = inRange.filter(n => Math.abs(n.beat - beat) < 1e-6)
  const chars = [".", ".", ".", "."]
  const ov = ["", "", "", ""]
  for (const n of rowNotes) {
    chars[n.col] =
      n.type === "Mine"
        ? "M"
        : n.type === "Hold" || n.type === "Roll"
          ? "2"
          : "1"
    if (n.hold) ov[n.col] += `(hold ${n.hold})`
    if (n.parity?.override) ov[n.col] += `=${n.parity.override}`
  }
  const fmt = (r?: { feet: (string | undefined)[]; techs: string[] }) =>
    r
      ? `${[0, 1, 2, 3].map(c => r.feet[c] ?? ".").join("")} ${r.techs.join(" ").padEnd(6)}`
      : "???? ".padEnd(11)
  const nRow = run.rows.find(r => Math.abs(r.beat - beat) < 1e-6)
  const aRow = annotated.rows.find(r => Math.abs(r.beat - beat) < 1e-6)
  console.log(
    `${beat.toFixed(2).padStart(7)}  ${chars.join("")}  natural:${fmt(nRow)} annotated:${fmt(aRow)} ${ov.filter(Boolean).join(" ")}`
  )
}
