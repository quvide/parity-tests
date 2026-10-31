import type { FixtureDef } from "../dsl"

// Caffeine Salad XO + JA pattern, beats 219.5 - 227.75
export default {
  bpm: [115, 128, 141],
  subdivision: 16,
  pattern: `
    ...R
    ..L.
    ....
    .R..
    ..L.
    ...R
    ..L.
    ....
    R...   | XO
    ..L.
    ....
    .R..
    ..L.
    ...R
    ....
    ...R   | JA
    ....
    ..L.
    .R..
    ML..   | FS
    ..R.
    .L..
    R...   | XO
    ....
    .L..
    ..R.
    .L..
    MR..   | FS
    ..L.
    .R..
    ...L   | XO
    ....
    .R..
    L...
  `,
} satisfies FixtureDef
