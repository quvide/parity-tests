import type { FixtureDef } from "../dsl"

export default {
  bpm: 150,
  subdivision: 16,
  pattern: `
    ...R
    .L..
    ..R.
    L...
    R...   | SS XO
    ..L.
    ...R
  `,
  knownIssue: "Development needed for facing detection for this ambiguous pattern"
} satisfies FixtureDef
