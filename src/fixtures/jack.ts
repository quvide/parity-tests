import type { FixtureDef } from "../dsl"

export default {
  bpm: [50, 150],
  subdivision: 16,
  pattern: `
    L...
    ...R
    ..L.
    ..L.   | JA
    ...R
    .L..
  `,
} satisfies FixtureDef
