import type { FixtureDef } from "../dsl"

export default {
  description: "U/D is ambiguous but L/R should not move",
  bpm: 100,
  subdivision: 8,
  pattern: `
    L...
    ...R
    L11R   | BR JU
  `,
} satisfies FixtureDef
