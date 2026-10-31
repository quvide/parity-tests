import type { FixtureDef } from "../dsl"

// SS candle pattern from Gasoline beats 72 - 76.
// Facing stays rotated for the entire phrase.
export default {
  bpm: [140],
  subdivision: 16,
  patterns: {
    "ss": `
      L...
      .R..
      ..L.
      .R..
      ...L   | XO
      ...R   | SS
      L...
      R...   | SS
      ...L
      ...R   | SS
      ..L.
      ...R
      .L..
      ..R.
      ...L   | XO
      ...R   | SS
      .L..
    `,
    "jacks": `
      L...
      .R..
      ..L.
      .R..
      ...L   | XO
      ...R   | SS
      L...
      L...   | JA
      ...R
      ...R   | JA
      ..L.
      ...R
      .L..
      ..R.
      ...L   | XO
      ...R   | SS
      .L..
    `,
  },
} satisfies FixtureDef
