import type { FixtureDef } from "../dsl"

export default {
  bpm: 100,
  subdivision: 8,
  patterns: {
    // likely meaning by author as the phrase starts with a forced DS
    "ds-xo": `
      .l..
      ...R
      ..R.   | DS
      R...   | DS XO
      ._.R   | DS
    `,

    // potential play by a lazy BT player
    "bt": `
      .l..
      ...R
      ..R.   | DS
      L...   | BT
      ._.R
    `
  }
} satisfies FixtureDef
