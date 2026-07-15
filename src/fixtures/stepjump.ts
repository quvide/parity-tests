import type { FixtureDef } from "../dsl"

export default {
  bpm: 120,
  subdivision: 8,
  pattern: `
    .L..
    L..R   | JU
    L...   | SJ
    L..R   | JU SJ JA
  `,
} satisfies FixtureDef
