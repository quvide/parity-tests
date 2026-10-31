import type { FixtureDef } from "../dsl"

// XO vs DS interpretation from Feel The Rush beats 192.5 - 196.25
export default {
  bpm: [138, 163, 188],
  subdivision: 16,
  patterns: {
    "xo": `
      .L..
      ...R
      .L..
      ..R.
      ...L   | XO
      ..R.
      .L..
      R...
      .L..
      ..R.
      ...L
      ..R.
      L...
      ...R
    `,
    "lazy-ds": `
      .L..
      ...R
      .L..
      ..R.
      ...R   | DS
      ..L.
      .R..
      L...
      .R..
      ..L.
      ...R
      ..L.
      L...   | DS
      ...R
    `,
  },
} satisfies FixtureDef
