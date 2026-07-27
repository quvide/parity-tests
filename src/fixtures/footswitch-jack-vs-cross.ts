import type { FixtureVariantDef } from "../dsl"

export default [
  {
    variant: "fs-xo",
    description: "fast reading: footswitch into crossover",
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
      ...L // engine doesn't treat this as XO as L hasn't gone to left
      .R..
      ..L.
      .R..
      .L.. | FS
      ...R
    `,
  },
  // TODO: this should probably not be read as XO
  {
    variant: "jack",
    description: "slow reading: jack, no crossover",
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
