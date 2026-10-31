import type { FixtureDef } from "../dsl"

// 3-arrow footing alternatives, from PUSH UR T3MPRR beats 271.75 - 275
export default {
  bpm: 155,
  subdivision: 8,
  patterns: {
    "lookahead": `
      .R..
      L...
      ....
      .LRr   | BR JU
      ....
      L.._
      L...   | JA
      ..R.
    `,
    "planted": `
      .R..
      L...
      ....
      .RLr   | BR JU
      ....
      L.._
      L...   | JA
      ..R.
    `,
  },
} satisfies FixtureDef
