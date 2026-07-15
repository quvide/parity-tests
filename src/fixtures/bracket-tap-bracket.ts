import type { FixtureDef } from "../dsl"

export default {
  description: "Somewhat hard-to-interpret pattern from XXXX Girl. L holds LU and brackettaps L on the same row as R brackets DR.",
  bpm: 155,
  subdivision: 16,
  pattern: `
    L...
    ...R
    L.l.   | BR
    ....
    ....
    ....
    Lr.R   | BR BT JU
    ....
    .._.
    ....
    ._L.
    .R..
    L...
    ...R
  `,
  knownIssue: "TODO: BRACKETTAP is broken.",
} satisfies FixtureDef
