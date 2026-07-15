import type { FixtureDef } from "../dsl"

export default {
  bpm: 150,
  subdivision: 16,
  pattern: `
    L...
    .R..
    L.L.   | BR
    LRLR   | BR JU
  `,
} satisfies FixtureDef
