import type { FixtureDef } from "../dsl"

export default {
  bpm: 120,
  subdivision: 16,
  pattern: `
    ...R
    .L..
    ..R.
    L...
    M...
    R...   | SS XO
    ..L.
    ...R
    .L..
    R...   | XO
    L...   | SS
    ..R.
  `,
} satisfies FixtureDef
