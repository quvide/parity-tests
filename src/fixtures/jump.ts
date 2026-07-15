import type { FixtureDef } from "../dsl"

export default {
  bpm: 120,
  subdivision: 8,
  pattern: `
    L..R
    .11.   | JU
    L..R   | JU
  `,
} satisfies FixtureDef
