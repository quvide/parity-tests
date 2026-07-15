import type { FixtureDef } from "../dsl"

export default {
  bpm: 145,
  subdivision: 16,
  pattern: `
    L...
    ...R
    .L..
    ..RR   | BR
    ...L   | SS XO
    ..RR   | BR SS
    .L..
    ..R.
    L...
    ...R
  `,
} satisfies FixtureDef
