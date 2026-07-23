import * as fs from "node:fs"
import * as path from "node:path"
import { ParsedFixture } from "./dsl"

/** Subdirectory of the songs root that generated fixture charts are written to. */
export const GEN_DIR = ".tmp-fixture-ssc"

function sscChar(c: string): string {
  if (c === "1" || c === "L" || c === "R") return "1"
  if (c === "2" || c === "l" || c === "r") return "2"
  if (c === "_") return "3"
  if (c === "M") return "M"
  return "0"
}

function silentWav(seconds = 1, sampleRate = 44100): Buffer {
  const samples = Math.round(seconds * sampleRate)
  const dataSize = samples * 2 // 16-bit mono
  const buf = Buffer.alloc(44 + dataSize)
  buf.write("RIFF", 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write("WAVE", 8)
  buf.write("fmt ", 12)
  buf.writeUInt32LE(16, 16) // fmt chunk size
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28) // byte rate
  buf.writeUInt16LE(2, 32) // block align
  buf.writeUInt16LE(16, 34) // bits per sample
  buf.write("data", 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf
}

export function generateSong(parsed: ParsedFixture, songsRoot: string): string {
  const { fixture, lines } = parsed
  const dir = path.join(songsRoot, GEN_DIR, fixture.name)
  fs.mkdirSync(dir, { recursive: true })

  const sub = fixture.subdivision
  const measures: string[][] = []
  for (let i = 0; i < lines.length; i += sub) {
    const measure = lines.slice(i, i + sub).map(l => [...l].map(sscChar).join(""))
    while (measure.length < sub) measure.push("0000")
    measures.push(measure)
  }
  if (measures.length === 0) measures.push(new Array(sub).fill("0000"))

  const ssc = `#VERSION:0.83;
#TITLE:${fixture.name};
#SUBTITLE:;
#ARTIST:parity-tests;
#CREDIT:${(fixture.description ?? "").replace(/[;:]/g, ",")};
#MUSIC:;
#OFFSET:0.000;
#SAMPLESTART:0.000;
#SAMPLELENGTH:1.000;
#SELECTABLE:YES;
#BPMS:0.000=${fixture.bpm.toFixed(3)};
#NOTEDATA:;
#CHARTNAME:${fixture.name};
#STEPSTYPE:dance-single;
#DESCRIPTION:;
#DIFFICULTY:Edit;
#METER:1;
#CREDIT:parity-tests;
#NOTES:
${measures.map(m => m.join("\n")).join("\n,\n")}
;
`
  fs.writeFileSync(path.join(dir, `${fixture.name}.ssc`), ssc)
  return dir
}
