import type { FixtureVariantDef } from "../dsl"

export default [
  {
    // fast reading: footswitch into crossover
    variant: "fs-xo",
    bpm: [175, 220],
    subdivision: 16,
    pattern: `
      ...R
      L...
      ..R.
      ..L. | FS
      .R..
      ...L | XO
      .R..
      ..L.
      .R..
      ...L  // TODO: engine doesn't treat this as XO as L hasn't gone to left
      .R..
      ..L.
      .R..
      .L.. | FS
      ...R
    `,
  },

  {
    // slow reading: jack, no crossover
    variant: "jack",
    bpm: [120, 170],
    subdivision: 16,
    pattern: `
      ...R
      L...
      ..R.
      ..R. | JA
      .L..
      ...R
      .L..
      ..R.
      .L..
      ...R
      .L..
      ..R.
      .L..
      .L.. | JA
      ...R
    `,
  },
] satisfies FixtureVariantDef[]
