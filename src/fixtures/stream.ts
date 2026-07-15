import type { FixtureDef } from "../dsl"

export default {
  bpm: 150,
  subdivision: 16,
  pattern: `
    L...
    .R..
    ..L.
    ...R
    .L..
    ..R.
    L...
    ...R
  `,
} satisfies FixtureDef
