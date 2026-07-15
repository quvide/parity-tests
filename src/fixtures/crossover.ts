import type { FixtureDef } from "../dsl"

export default {
  bpm: 120,
  subdivision: 8,
  pattern: `
    ...R
    ..L.
    R...   | XO
    ..L.
    ...R
  `,
} satisfies FixtureDef
