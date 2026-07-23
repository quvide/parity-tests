import type { FixtureDef } from "../dsl"

export default {
  description: "A single -> bracket is interpreted as a doublestep",
  bpm: 150,
  subdivision: 16,
  pattern: `
    l...
    ...R
    ..RR | BR DS
    _...
  `,
} satisfies FixtureDef
