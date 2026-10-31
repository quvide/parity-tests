import type { FixtureDef } from "../dsl"

// XO vs DS interpretation of Deep Into The Vibe beats 176 - 180.5
// Doublestepping forward at the third R is accepted, DS back into the cross is not.
export default {
  bpm: 175,
  subdivision: 16,
  patterns: {
    "xo": `
      ...R
      .L..
      ..R.
      ....
      ...L   | XO
      ..R.
      .L..
      ....
      ...R
      ..L.
      .R..
      ....
      ...L   | XO
      .R..
      ..L.
      ....
      .RL.   | SJ
      ....
      ...R   | DS
    `,

    "ds": `
      ...R
      .L..
      ..R.
      ....
      ...L   | XO
      ..R.
      .L..
      ....
      ...R
      ..L.
      .R..
      ....
      ...R   | DS
      .L..
      ..R.
      ....
      .LR.   | SJ
      ....
      ...R   | DS
    `,
  },
} satisfies FixtureDef
