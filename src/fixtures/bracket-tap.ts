import type { FixtureDef } from "../dsl"

export default {
  description: "Simple BT",
  bpm: 155,
  subdivision: 16,
  pattern: `
    L...
    ...R
    lL..   | BR
    ...R
    .L..   | BT
    _..R
  `,
  knownIssue: "TODO: BRACKETTAP is broken."
} satisfies FixtureDef
