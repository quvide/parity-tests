import type { FixtureDef } from "../dsl"

// SJ vs BR interpretation of a same-foot pair, from Destination beats 70.5 - 74.5
export default {
  bpm: 133,
  subdivision: 8,
  patterns: {
    "sj": `
      L...
      .R..
      ..L.
      ...R
      ....
      .L.R   | SJ
      ....
      L...   | DS
      .R..
    `,
    "br": `
      L...
      .R..
      ..L.
      ...R
      ....
      .R.R   | BR DS
      ....
      L...
      .R..
    `,
  },
} satisfies FixtureDef
