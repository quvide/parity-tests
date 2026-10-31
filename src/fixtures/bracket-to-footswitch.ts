import type { FixtureDef } from "../dsl"

// Seems to be a regression test against old engine behavior
export default {
  bpm: 150,
  subdivision: 16,
  pattern: `
    L..R   | JU
    ....
    ..Rr   | BR
    ....
    LL._   | BR
    ..R.
    ..L.   | FS
  `,
} satisfies FixtureDef
