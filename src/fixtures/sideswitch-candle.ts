import type { FixtureDef } from "../dsl"

export default {
  description: "From Gasoline",
  bpm: [140],
  subdivision: 16,
  pattern: `
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
} satisfies FixtureDef
