import type { FixtureDef } from "../dsl"

export default {
  bpm: 100,
  subdivision: 8,
  pattern: `
    ...R
    L...
    ..r.
    ....
    .L..
    ...R   | BT
    .._.
  `,
  knownIssue: "TODO: BRACKETTAP is broken.",
} satisfies FixtureDef
