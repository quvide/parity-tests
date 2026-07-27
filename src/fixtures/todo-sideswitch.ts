import type { FixtureDef } from "../dsl"

// pattern from caffeine salad
export default {
  description: "",
  bpm: 150,
  subdivision: 16,
  pattern: `
    ...R
    ..L.
    R... | XO
    ..L.
    .R..
    ..L.
    ...R
    ...R | JA
    ..L.
    .R..
    .L.. | FS
    ..R.
    .L..
    R... | XO
  `,
  knownIssue: "engine thinks SS -> twist is a valid move, probably some asymmetry issue"
} satisfies FixtureDef
